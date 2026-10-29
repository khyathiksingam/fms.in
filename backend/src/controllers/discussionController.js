const { dbHelper } = require('../config/db');

function sanitizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

const discussionController = {
  /**
   * Start a private student doubt or important question on a file
   */
  async createDiscussion(req, res) {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const { fileId, subject, messageType, messageBody } = req.body;
      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required.' });
      }

      // 1. Fetch file and uploader details
      const file = await dbHelper.get(`
        SELECT f.id, f.name, f.owner_id, u.full_name as owner_name, r.name as owner_role
        FROM files f
        JOIN users u ON u.id = f.owner_id
        JOIN roles r ON r.id = u.role_id
        WHERE f.id = $1 AND f.deleted_at IS NULL
      `, [fileId]);

      if (!file) {
        return res.status(404).json({ error: `File not found with ID: ${fileId}` });
      }

      const ownerRole = (file.owner_role || '').toLowerCase();
      if (ownerRole !== 'faculty' && ownerRole !== 'hod') {
        return res.status(400).json({ error: 'Discussions can only be started for files uploaded by a faculty member or HOD.' });
      }

      if (Number(file.owner_id) === Number(currentUser.id)) {
        return res.status(400).json({ error: 'You cannot start a student doubt discussion with yourself.' });
      }

      const cleanSubject = sanitizeText(subject) || `Doubt regarding ${file.name}`;
      const cleanBody = sanitizeText(messageBody);

      if (!cleanBody) {
        return res.status(400).json({ error: 'Message body cannot be empty.' });
      }
      if (cleanBody.length > 5000) {
        return res.status(400).json({ error: 'Message exceeds maximum allowed length of 5000 characters.' });
      }

      const normalizedType = messageType === 'important_question' ? 'important_question' : 'doubt';

      // 2. Insert into file_conversations
      const convRes = await dbHelper.run(`
        INSERT INTO file_conversations (file_id, student_id, faculty_id, subject, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [file.id, currentUser.id, file.owner_id, cleanSubject]);

      const conversationId = convRes.lastID;

      // 3. Insert initial message
      const msgRes = await dbHelper.run(`
        INSERT INTO file_messages (conversation_id, sender_id, message_type, message_body, is_read, created_at)
        VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)
      `, [conversationId, currentUser.id, normalizedType, cleanBody]);

      // 4. Targeted Notification ONLY to the faculty/HOD uploader
      await dbHelper.run(`
        INSERT INTO notifications (user_id, sender_id, title, message, event_type, related_conversation_id, related_file_id, link, read_status, created_at)
        VALUES ($1, $2, $3, $4, 'doubt_received', $5, $6, $7, 0, CURRENT_TIMESTAMP)
      `, [
        file.owner_id,
        currentUser.id,
        `New Student ${normalizedType === 'important_question' ? 'Question' : 'Doubt'}`,
        `${currentUser.full_name} asked: "${cleanSubject}" on file ${file.name}`,
        conversationId,
        file.id,
        `/discussions/${conversationId}`
      ]);

      const conversation = {
        id: conversationId,
        subject: cleanSubject,
        status: 'open',
        updated_at: new Date().toISOString(),
        file: { id: file.id, name: file.name },
        student: { id: currentUser.id, fullName: currentUser.full_name },
        faculty: { id: file.owner_id, fullName: file.owner_name }
      };

      res.status(200).json(conversation);
    } catch (err) {
      console.error('createDiscussion error:', err);
      res.status(500).json({ error: err.message || 'Failed to create discussion.' });
    }
  },

  /**
   * Post reply to a private discussion (strict 2-party participants only)
   */
  async postReply(req, res) {
    try {
      const currentUser = req.user;
      const conversationId = Number(req.params.id);
      const rawBody = req.body.messageBody;

      const conv = await dbHelper.get(`
        SELECT fc.*, f.name as file_name,
               s.full_name as student_name,
               fac.full_name as faculty_name
        FROM file_conversations fc
        JOIN files f ON f.id = fc.file_id
        JOIN users s ON s.id = fc.student_id
        JOIN users fac ON fac.id = fc.faculty_id
        WHERE fc.id = $1
      `, [conversationId]);

      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      // ENFORCE STRICT PRIVACY: Only the asking student or the faculty uploader can reply
      const isStudent = Number(currentUser.id) === Number(conv.student_id);
      const isFaculty = Number(currentUser.id) === Number(conv.faculty_id);

      if (!isStudent && !isFaculty) {
        return res.status(403).json({ error: 'Access denied: You are not an authorized participant in this private discussion.' });
      }

      const cleanBody = sanitizeText(rawBody);
      if (!cleanBody) {
        return res.status(400).json({ error: 'Message body cannot be empty.' });
      }
      if (cleanBody.length > 5000) {
        return res.status(400).json({ error: 'Message exceeds maximum allowed length of 5000 characters.' });
      }

      // Insert reply message
      const msgRes = await dbHelper.run(`
        INSERT INTO file_messages (conversation_id, sender_id, message_type, message_body, is_read, created_at)
        VALUES ($1, $2, 'reply', $3, 0, CURRENT_TIMESTAMP)
      `, [conversationId, currentUser.id, cleanBody]);

      // Update conversation updated_at and reopen if resolved
      await dbHelper.run(`
        UPDATE file_conversations
        SET updated_at = CURRENT_TIMESTAMP,
            status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END
        WHERE id = $1
      `, [conversationId]);

      // Targeted Notification strictly to the other party
      const recipientId = isStudent ? conv.faculty_id : conv.student_id;
      const preview = cleanBody.length > 100 ? cleanBody.substring(0, 97) + '…' : cleanBody;

      await dbHelper.run(`
        INSERT INTO notifications (user_id, sender_id, title, message, event_type, related_conversation_id, related_file_id, link, read_status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, CURRENT_TIMESTAMP)
      `, [
        recipientId,
        currentUser.id,
        isStudent ? 'New Reply from Student' : 'Faculty Replied to Your Doubt',
        `${currentUser.full_name}: ${preview}`,
        isStudent ? 'doubt_student_replied' : 'doubt_faculty_replied',
        conversationId,
        conv.file_id,
        `/discussions/${conversationId}`
      ]);

      const message = {
        id: msgRes.lastID,
        conversationId,
        senderId: currentUser.id,
        senderName: currentUser.full_name,
        messageType: 'reply',
        messageBody: cleanBody,
        isRead: 0,
        createdAt: new Date().toISOString()
      };

      res.status(200).json(message);
    } catch (err) {
      console.error('postReply error:', err);
      res.status(500).json({ error: err.message || 'Failed to post reply.' });
    }
  },

  /**
   * Get messages for conversation (participant only, 403 Forbidden for all others)
   */
  async getConversationMessages(req, res) {
    try {
      const currentUser = req.user;
      const conversationId = Number(req.params.id);

      const conv = await dbHelper.get(`
        SELECT student_id, faculty_id FROM file_conversations WHERE id = $1
      `, [conversationId]);

      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      // ENFORCE STRICT PRIVACY
      const isStudent = Number(currentUser.id) === Number(conv.student_id);
      const isFaculty = Number(currentUser.id) === Number(conv.faculty_id);

      if (!isStudent && !isFaculty) {
        return res.status(403).json({ error: 'Access denied: You are not authorized to view this private discussion.' });
      }

      // Mark messages from the other party as read
      await dbHelper.run(`
        UPDATE file_messages
        SET is_read = 1
        WHERE conversation_id = $1 AND sender_id != $2
      `, [conversationId, currentUser.id]);

      const messages = await dbHelper.all(`
        SELECT m.id, m.conversation_id as "conversationId",
               m.sender_id as "senderId", u.full_name as "senderName",
               m.message_type as "messageType", m.message_body as "messageBody",
               m.is_read as "isRead", m.created_at as "createdAt"
        FROM file_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC
      `, [conversationId]);

      res.status(200).json(messages);
    } catch (err) {
      console.error('getConversationMessages error:', err);
      res.status(500).json({ error: err.message || 'Failed to retrieve messages.' });
    }
  },

  /**
   * Get discussions for the current user:
   * - Students see only their own asked questions
   * - Faculty / HOD see only questions asked on their files
   * - Others (including admins) see empty array
   */
  async getMyConversations(req, res) {
    try {
      const currentUser = req.user;
      const role = (currentUser.role_name || '').toLowerCase();

      let rows = [];
      if (role === 'student') {
        rows = await dbHelper.all(`
          SELECT fc.id, fc.subject, fc.status, fc.created_at, fc.updated_at,
                 f.id as file_id, f.name as file_name,
                 s.id as student_id, s.full_name as student_name, s.roll_number as student_roll,
                 fac.id as faculty_id, fac.full_name as faculty_name,
                 (SELECT COUNT(*) FROM file_messages m WHERE m.conversation_id = fc.id AND m.is_read = 0 AND m.sender_id != $1) as unread_count
          FROM file_conversations fc
          JOIN files f ON f.id = fc.file_id
          JOIN users s ON s.id = fc.student_id
          JOIN users fac ON fac.id = fc.faculty_id
          WHERE fc.student_id = $1
          ORDER BY fc.updated_at DESC
        `, [currentUser.id]);
      } else if (role === 'faculty' || role === 'hod') {
        rows = await dbHelper.all(`
          SELECT fc.id, fc.subject, fc.status, fc.created_at, fc.updated_at,
                 f.id as file_id, f.name as file_name,
                 s.id as student_id, s.full_name as student_name, s.roll_number as student_roll,
                 fac.id as faculty_id, fac.full_name as faculty_name,
                 (SELECT COUNT(*) FROM file_messages m WHERE m.conversation_id = fc.id AND m.is_read = 0 AND m.sender_id != $1) as unread_count
          FROM file_conversations fc
          JOIN files f ON f.id = fc.file_id
          JOIN users s ON s.id = fc.student_id
          JOIN users fac ON fac.id = fc.faculty_id
          WHERE fc.faculty_id = $1
          ORDER BY fc.updated_at DESC
        `, [currentUser.id]);
      } else {
        // Admins and unassigned roles have 0 access to private discussions
        return res.status(200).json([]);
      }

      const formatted = rows.map(r => ({
        id: r.id,
        subject: r.subject,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        unreadCount: Number(r.unread_count || 0),
        file: { id: r.file_id, name: r.file_name },
        student: { id: r.student_id, fullName: r.student_name, rollNumber: r.student_roll },
        faculty: { id: r.faculty_id, fullName: r.faculty_name }
      }));

      res.status(200).json(formatted);
    } catch (err) {
      console.error('getMyConversations error:', err);
      res.status(500).json({ error: err.message || 'Failed to retrieve conversations.' });
    }
  },

  /**
   * Get discussions for a file (filtered strictly to current user's participation)
   */
  async getConversationsForFile(req, res) {
    try {
      const currentUser = req.user;
      const fileId = Number(req.params.fileId);
      const role = (currentUser.role_name || '').toLowerCase();

      let rows = [];
      if (role === 'student') {
        rows = await dbHelper.all(`
          SELECT fc.id, fc.subject, fc.status, fc.created_at, fc.updated_at,
                 f.id as file_id, f.name as file_name,
                 s.id as student_id, s.full_name as student_name,
                 fac.id as faculty_id, fac.full_name as faculty_name
          FROM file_conversations fc
          JOIN files f ON f.id = fc.file_id
          JOIN users s ON s.id = fc.student_id
          JOIN users fac ON fac.id = fc.faculty_id
          WHERE fc.file_id = $1 AND fc.student_id = $2
          ORDER BY fc.updated_at DESC
        `, [fileId, currentUser.id]);
      } else if (role === 'faculty' || role === 'hod') {
        rows = await dbHelper.all(`
          SELECT fc.id, fc.subject, fc.status, fc.created_at, fc.updated_at,
                 f.id as file_id, f.name as file_name,
                 s.id as student_id, s.full_name as student_name,
                 fac.id as faculty_id, fac.full_name as faculty_name
          FROM file_conversations fc
          JOIN files f ON f.id = fc.file_id
          JOIN users s ON s.id = fc.student_id
          JOIN users fac ON fac.id = fc.faculty_id
          WHERE fc.file_id = $1 AND fc.faculty_id = $2
          ORDER BY fc.updated_at DESC
        `, [fileId, currentUser.id]);
      }

      const formatted = rows.map(r => ({
        id: r.id,
        subject: r.subject,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        file: { id: r.file_id, name: r.file_name },
        student: { id: r.student_id, fullName: r.student_name },
        faculty: { id: r.faculty_id, fullName: r.faculty_name }
      }));

      res.status(200).json(formatted);
    } catch (err) {
      console.error('getConversationsForFile error:', err);
      res.status(500).json({ error: err.message || 'Failed to retrieve file conversations.' });
    }
  },

  /**
   * Update conversation status (resolve or reopen)
   */
  async updateStatus(req, res) {
    try {
      const currentUser = req.user;
      const conversationId = Number(req.params.id);
      const newStatus = req.body.status === 'resolved' ? 'resolved' : 'open';

      const conv = await dbHelper.get(`
        SELECT student_id, faculty_id FROM file_conversations WHERE id = $1
      `, [conversationId]);

      if (!conv) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      if (Number(currentUser.id) !== Number(conv.student_id) && Number(currentUser.id) !== Number(conv.faculty_id)) {
        return res.status(403).json({ error: 'Access denied: You are not authorized to update this discussion.' });
      }

      await dbHelper.run(`
        UPDATE file_conversations
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newStatus, conversationId]);

      res.status(200).json({ id: conversationId, status: newStatus });
    } catch (err) {
      console.error('updateStatus error:', err);
      res.status(500).json({ error: err.message || 'Failed to update discussion status.' });
    }
  }
};

module.exports = discussionController;
