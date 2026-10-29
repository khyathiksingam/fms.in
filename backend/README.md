# Production Node.js 22 Backend (Express + Managed PostgreSQL)

This directory contains the production-ready Node.js 22 Express backend for the Faculty File Management System (FFMS).

## Architecture & Technology Stack
- **Runtime**: Node.js 22 LTS
- **Framework**: Express 5.x
- **Database**: Managed PostgreSQL with `pg` connection pooling (`pg.Pool`)
- **Database Migrations**: SQL migrations in `backend/migrations/` managed by `npm run migrate`
- **Authentication**: Stateless JWT authentication with `bcryptjs` password hashing and session tracking
- **File Uploads & Storage**: Multer with durable mounted storage (`STORAGE_UPLOAD_DIR`, `STORAGE_LOGO_DIR`) or cloud object storage
- **Private File Discussions**: Strict 2-party private student questions/doubts with targeted notifications and zero leakage to global search or public activity logs

## Production Execution
```bash
# Apply database migrations
npm run migrate

# Start backend server
npm start
```
