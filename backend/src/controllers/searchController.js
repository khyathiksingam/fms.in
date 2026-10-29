const { dbHelper } = require('../config/db');

function extractSnippet(fullText, query, snippetLength = 160) {
  if (!fullText || !query) return '';
  const lowerText = fullText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return fullText.length > snippetLength ? fullText.substring(0, snippetLength) + '...' : fullText;
  }

  const start = Math.max(0, index - 40);
  const end = Math.min(fullText.length, index + query.length + snippetLength - 40);
  let snippet = fullText.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';

  return snippet;
}

const searchController = {
  async search(req, res) {
    try {
      const user = req.user;
      const {
        q = '',
        file_type,
        department_id,
        owner_id,
        folder_id,
        is_starred,
        scope, // 'all', 'my', 'shared', 'department'
        sort = 'relevance',
        page = 1,
        limit = 25
      } = req.query;

      const queryTerm = q.trim();

      const fromSql = `
        FROM files f
        LEFT JOIN users u ON f.owner_id = u.id
        LEFT JOIN departments d ON f.department_id = d.id
        LEFT JOIN folders fold ON f.folder_id = fold.id
      `;
      let whereSql = `
        WHERE f.deleted_at IS NULL
      `;
      const baseParams = [];

      // RBAC filtering
      if (user.role_name === 'faculty') {
        whereSql += ` AND (
          f.owner_id = ? 
          OR (COALESCE(f.visibility, 'public') = 'public' AND (f.department_id = ? OR f.department_id IS NULL))
          OR EXISTS(SELECT 1 FROM shared_files sf WHERE sf.file_id = f.id AND (sf.shared_with_user = ? OR sf.shared_with_department = ?))
        )`;
        baseParams.push(user.id, user.department_id || -1, user.id, user.department_id || -1);
      } else if (user.role_name === 'hod') {
        whereSql += ` AND (
          f.department_id = ?
          OR f.owner_id = ?
          OR (COALESCE(f.visibility, 'public') = 'public' AND f.department_id = ?)
        )`;
        baseParams.push(user.department_id || -1, user.id, user.department_id || -1);
      }

      // Keyword / OCR Search
      if (queryTerm) {
        const likeTerm = `%${queryTerm.toLowerCase()}%`;
        whereSql += ` AND (
          LOWER(f.name) LIKE ? 
          OR LOWER(f.original_name) LIKE ? 
          OR LOWER(f.extracted_text) LIKE ? 
          OR LOWER(u.full_name) LIKE ? 
          OR LOWER(d.name) LIKE ?
          OR LOWER(fold.name) LIKE ?
        )`;
        baseParams.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
      }

      // Filters
      if (file_type && file_type !== 'all') {
        whereSql += " AND f.file_type = ?";
        baseParams.push(file_type);
      }

      if (department_id) {
        if (user.role_name === 'hod' &&
            !user.department_ids?.includes(Number(department_id))) {
          return res.status(403).json({ error: 'You are not assigned to the selected department.' });
        }
        whereSql += " AND f.department_id = ?";
        baseParams.push(department_id);
      }

      if (owner_id) {
        whereSql += " AND f.owner_id = ?";
        baseParams.push(owner_id);
      }

      if (folder_id) {
        whereSql += " AND f.folder_id = ?";
        baseParams.push(folder_id);
      }

      // Sorting
      let sortSql = '';
      const sortParams = [];
      switch (sort) {
        case 'name_asc':
          sortSql = " ORDER BY f.name ASC";
          break;
        case 'name_desc':
          sortSql = " ORDER BY f.name DESC";
          break;
        case 'newest':
          sortSql = " ORDER BY f.created_at DESC";
          break;
        case 'oldest':
          sortSql = " ORDER BY f.created_at ASC";
          break;
        case 'largest':
          sortSql = " ORDER BY f.size DESC";
          break;
        case 'smallest':
          sortSql = " ORDER BY f.size ASC";
          break;
        case 'type':
          sortSql = " ORDER BY f.file_type ASC, f.name ASC";
          break;
        case 'relevance':
        default:
          if (queryTerm) {
            sortSql = ` ORDER BY 
              CASE 
                WHEN LOWER(f.name) LIKE ? THEN 1 
                WHEN LOWER(f.original_name) LIKE ? THEN 2 
                WHEN LOWER(f.extracted_text) LIKE ? THEN 3 
                ELSE 4 
              END ASC, f.created_at DESC`;
            const qLike = `%${queryTerm.toLowerCase()}%`;
            sortParams.push(qLike, qLike, qLike);
          } else {
            sortSql = " ORDER BY f.created_at DESC";
          }
          break;
      }

      // Pagination
      const countSql = `SELECT COUNT(*) as total ${fromSql} ${whereSql}`;
      const countRes = await dbHelper.get(countSql, baseParams);
      const total = countRes ? countRes.total : 0;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
      const offset = (pageNum - 1) * limitNum;

      const selectSql = `
        SELECT f.id, f.name, f.original_name, f.file_type, f.mime_type, f.size,
               f.storage_path, f.folder_id, f.owner_id, f.department_id, f.drive_link,
               f.version, f.ocr_status, f.extracted_text, f.created_at, f.updated_at,
               COALESCE(u.full_name, 'Potta Devika') as owner_name, u.username as owner_username,
               d.name as department_name, d.code as department_code,
               fold.name as folder_name,
               (CASE WHEN fav.id IS NOT NULL THEN 1 ELSE 0 END) as is_starred
        ${fromSql}
        LEFT JOIN favorites fav ON fav.file_id = f.id AND fav.user_id = ?
        ${whereSql}
        ${sortSql}
        LIMIT ${limitNum} OFFSET ${offset}
      `;
      const selectParams = [user.id, ...baseParams, ...sortParams];

      const rawResults = await dbHelper.all(selectSql, selectParams);

      // Enhance results with OCR match indicators and snippets
      const results = rawResults.map(file => {
        const hasOcrMatch = queryTerm && file.extracted_text && file.extracted_text.toLowerCase().includes(queryTerm.toLowerCase());
        const hasNameMatch = queryTerm && (file.name.toLowerCase().includes(queryTerm.toLowerCase()) || file.original_name.toLowerCase().includes(queryTerm.toLowerCase()));

        let matchType = 'metadata';
        if (hasNameMatch && hasOcrMatch) matchType = 'name_and_ocr';
        else if (hasOcrMatch) matchType = 'ocr_content';
        else if (hasNameMatch) matchType = 'filename';

        const snippet = queryTerm ? extractSnippet(file.extracted_text, queryTerm) : '';

        // Don't send entire massive extracted_text payload back in search list
        const { extracted_text, ...rest } = file;

        return {
          ...rest,
          match_type: matchType,
          ocr_matched: Boolean(hasOcrMatch),
          snippet: snippet,
          has_extracted_text: Boolean(file.extracted_text && file.extracted_text.length > 0)
        };
      });

      res.json({
        query: queryTerm,
        results,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search query execution failed.' });
    }
  }
};

module.exports = searchController;
