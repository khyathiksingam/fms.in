-- 003_add_discussions_schema.sql
-- Private Student Doubts, Important Questions, and Targeted Notification Tables

CREATE TABLE IF NOT EXISTS file_conversations (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    faculty_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS file_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES file_conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('doubt', 'important_question', 'reply')),
    message_body TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    related_conversation_id INTEGER REFERENCES file_conversations(id) ON DELETE CASCADE,
    related_file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    read_status INTEGER DEFAULT 0 CHECK (read_status IN (0, 1)),
    link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Privacy and Performance Indexes
CREATE INDEX IF NOT EXISTS idx_conv_file ON file_conversations(file_id);
CREATE INDEX IF NOT EXISTS idx_conv_student ON file_conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_conv_faculty ON file_conversations(faculty_id);
CREATE INDEX IF NOT EXISTS idx_conv_updated_at ON file_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON file_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_sender ON file_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_id, read_status);
