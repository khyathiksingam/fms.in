# Production Deployment Guide: Node.js 22 Backend + Managed PostgreSQL + Vercel Frontend

## System Overview & Architecture

The Faculty File Management System (FFMS) is built with a production-ready, highly decoupled modern architecture:

- **Backend Runtime**: **Node.js 22 LTS** with **Express 5.x** written entirely in JavaScript.
- **Database**: Managed **PostgreSQL** with connection pooling (`pg.Pool`, `max: 20`, idle/connection timeouts) and pure SQL versioned migrations.
- **Frontend**: **React 18 / Vite 6** Single Page Application hosted on **Vercel**, preserving the complete REST API contract.
- **Authentication**: Stateless **JWT** authentication with **`bcryptjs`** salted password hashing and session tracking.
- **File & Logo Storage**: Durable persistent storage mounted at `/var/data` or cloud object storage (S3 / Cloudflare R2 / MinIO).
- **Security & Privacy**: Strict 2-party private student discussions (asking student + exact faculty/HOD uploader), targeted notifications, and zero exposure of sensitive discussion content to global search or activity logs.

---

## 1. Required Production Environment Variables

Configure these backend-only and frontend variables in your hosting provider's dashboard:

### Backend Variables (Render / Railway / Docker / VPS)

| Variable | Description | Example / Safe Placeholder | Required in Production |
|---|---|---|---|
| `DATABASE_URL` | Managed PostgreSQL connection string (backend-only, with SSL) | `postgresql://user:pass@host:5432/dbname?sslmode=require` | **Yes** |
| `JWT_SECRET` | Cryptographically random secret key (minimum 32 characters / 256 bits) | `your_super_secret_jwt_key_at_least_32_chars_long!` | **Yes** |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend domain origins | `https://fmsin.vercel.app,https://resourcehub-demo.vercel.app` | **Yes** |
| `STORAGE_PROVIDER` | Storage engine type (`local` for mounted disk, or `s3` / `r2` / `minio`) | `local` | **Yes** (default: `local`) |
| `STORAGE_BUCKET` | S3 / R2 / MinIO bucket name (when `STORAGE_PROVIDER=s3/r2`) | `ffms-production-assets` | When using S3/R2 |
| `STORAGE_ACCESS_KEY` | Cloud object storage access key ID | `your_storage_access_key` | When using S3/R2 |
| `STORAGE_SECRET_KEY` | Cloud object storage secret key | `your_storage_secret_key` | When using S3/R2 |
| `EMAIL_PROVIDER_API_KEY` | Transactional email provider API key (Brevo / SendGrid / Resend) | `your_email_provider_api_key` | For verification OTPs |
| `EMAIL_FROM` | Sender email address for outgoing verification OTPs | `noreply@college.edu` | No (default: noreply@college.edu) |
| `EMAIL_FROM_NAME` | Sender display name | `Faculty File Management System` | No |
| `STORAGE_LOCAL_DIR` | Base directory for persistent mounted storage | `/var/data` | Default: `./backend/storage` |
| `STORAGE_UPLOAD_DIR` | Storage directory for uploaded user files | `/var/data/uploads` | Default: `./backend/storage/uploads` |
| `STORAGE_LOGO_DIR` | Storage directory for uploaded college/system logos | `/var/data/logos` | Default: `./backend/storage/logos` |
| `ADMIN_PASSWORD` | Initial seed password for administrator (first boot only, never resets existing passwords) | `InitialAdminPassword#2026` | First boot only |
| `FFMS_HOD_TEMP_PASSWORD` | Initial temporary password for HOD accounts | `InitialHodPassword#2026` | First boot only |
| `PORT` | HTTP port for the Node.js Express server | `5000` | Default: `5000` |

### Frontend Variables (Vercel)

| Variable | Description | Safe Placeholder |
|---|---|---|
| `VITE_API_BASE_URL` | Public HTTPS URL of the deployed Node.js backend API | `https://ffms-backend.onrender.com` |

> [!CAUTION]
> **Zero Exposure Rule**:
> Never expose `DATABASE_URL`, `JWT_SECRET`, cloud storage keys, or email API keys with a `VITE_` prefix or in frontend repository files. Frontend only requires public `VITE_API_BASE_URL`.

---

## 2. PostgreSQL Migrations & Database Design

Database migrations are written in pure ANSI SQL in `backend/migrations/` and tracked in `schema_migrations`:

1. **`001_init_schema.sql`**:
   - `roles`: System access tiers (`admin`, `hod`, `faculty`, `student`).
   - `departments`: College departments, display groups, and sort order.
   - `academic_regulations`: Curriculum regulations (`R25`, `R22`, `R19`, etc.).
   - `system_settings`: College branding, system names, durable logo URLs, upload limits.
   - `users`: User profiles, bcrypt password hashes, email verification tokens, and role assignments.
   - `folders` & `files`: Hierarchical folder trees, file metadata, MIME categories, OCR extraction text, visibility (`public`/`private`), and approval statuses.
   - `favorites`: Starred file bookmarks per user (`uq_user_file_fav`).
   - `file_versions`: Document revision history.
   - `shared_files`: User-level and department-level sharing permissions.
   - `syllabus_catalog`: Official syllabus catalogue published records.
   - `sessions`: Real-time session tokens, last seen timestamps, and duration tracking.
   - `activity_logs`: Administrative audit trail (strictly excludes private student discussions).

2. **`002_seed_baseline_data.sql`**:
   - Non-destructive idempotent baseline seed: roles, 22 academic departments, 9 academic regulations, and system settings.
   - Uses `INSERT INTO ... ON CONFLICT DO NOTHING` to guarantee zero data loss.

3. **`003_add_discussions_schema.sql`**:
   - `file_conversations`: Private discussion threads strictly linked to `(file_id, student_id, faculty_id)`.
   - `file_messages`: Discussion messages (`doubt`, `important_question`, `reply`), timestamped and read-tracked.
   - `notifications`: Targeted notification inbox (`doubt_received`, `doubt_student_replied`, `doubt_faculty_replied`).
   - Composite indexes for rapid queries: `(student_id)`, `(faculty_id)`, `(file_id)`, `(user_id, read_status)`.

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Deploy Managed PostgreSQL Database
1. Provision a PostgreSQL 15+ database on **Neon**, **Supabase**, **Render Postgres**, or **AWS RDS**.
2. Copy the managed database connection string (`DATABASE_URL`).
3. Ensure SSL mode is enabled (`?sslmode=require`).

### Step 2: Deploy Node.js 22 Backend (Render / Docker)

#### Deploying via Docker (Render / Railway / Fly.io / VPS):
1. In Render, select **New -> Web Service** and connect this repository.
2. Select **Runtime**: `Docker` (`./Dockerfile`).
3. Set **Health Check Path**: `/api/health`.
4. Attach a **Persistent Disk** mounted at `/var/data` with at least 1 GB capacity.
5. In **Environment Variables**, add the variables from Section 1 above:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CORS_ALLOWED_ORIGINS`
   - `STORAGE_PROVIDER=local`
   - `STORAGE_LOCAL_DIR=/var/data`
   - `STORAGE_UPLOAD_DIR=/var/data/uploads`
   - `STORAGE_LOGO_DIR=/var/data/logos`
   - `EMAIL_PROVIDER_API_KEY`
   - `EMAIL_FROM`
   - `ADMIN_PASSWORD`
   - `FFMS_HOD_TEMP_PASSWORD`
6. Click **Deploy**. On container boot, the Node.js backend automatically executes:
   - Safe environment validation (`validateEnvironment()`).
   - PostgreSQL schema migrations (`runMigrations()`).
   - Non-destructive idempotent seeding (`seed()`).

### Step 3: Deploy React / Vite Frontend on Vercel
1. In Vercel, click **Add New -> Project** and import the repository.
2. Set **Root Directory**: `frontend`.
3. Set **Framework Preset**: `Vite`.
4. Configure Build & Development Settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Under **Environment Variables**, add:
   - `VITE_API_BASE_URL`: `https://<your-backend-domain>` (e.g. `https://ffms-backend.onrender.com`)
6. Click **Deploy**.
7. **Confirm SPA Routing**:
   The `frontend/vercel.json` configuration provides complete Single Page Application rewrites for `/faculty-portal`, `/faculty-portal/*`, and all application routes:
   ```json
   {
     "cleanUrls": true,
     "rewrites": [
       { "source": "/faculty-portal", "destination": "/index.html" },
       { "source": "/faculty-portal/(.*)", "destination": "/index.html" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```

---

## 4. Local Development & Deployment Scripts

The root `package.json` provides standard production and development scripts:

```bash
# Start backend in development mode
npm run dev

# Start backend in production mode
npm start

# Run standalone database migrations
npm run migrate

# Run complete automated test suite (backend unit/integration tests + frontend tests)
npm test

# Build frontend production bundle
npm run build
```

---

## 5. Verification & Health Check Commands

After deployment, verify the live installation:

1. **Backend Health Check**:
   ```bash
   curl -i https://<backend-domain>/api/health
   # Expected: HTTP 200 {"status":"online","timestamp":"...","system":"Faculty File Management System"}
   ```

2. **Public Branding API**:
   ```bash
   curl -i https://<backend-domain>/api/settings/public
   # Verify college_logo and system_name return user-configured settings
   ```

3. **Frontend Route Verification**:
   Navigate to `https://<frontend-domain>/faculty-portal` in your browser. Confirm the page renders properly without 404 errors.
