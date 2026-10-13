# College File Management System

A secure, modern, responsive full-stack web application designed for colleges and universities to organize, search, preview, share, version, and manage academic and administrative files in a Google Drive-style interface.

---

## Deployment

- **Student Syllabus Library**: `/syllabus`
- **GitHub Repository**: **[https://github.com/khyathiksingam/fms](https://github.com/khyathiksingam/fms)**

---

## 🌟 Key Features

- **Role-Based Access Control (RBAC)**: Distinct permissions and dashboards for **Admin**, **Head of Department (HOD)**, and **Faculty Members**.
- **OCR Search Inside Scanned Documents**: Background OCR indexing using `tesseract.js` for images and `pdf-parse` for PDFs, enabling full-text keyword search inside scanned exam papers and documents.
- **In-App File Previews**: Rich multi-format previewers for PDF documents, zoomable/rotatable images, video streaming, audio player, CSV tabular data spreadsheets, and raw OCR text inspector.
- **Multi-Target File Sharing**: Share files with individual faculty or entire departments with granular permissions (`View Only`, `View & Download`, `Edit / Manage`).
- **Preserved Version History**: Upload new iterations without overwriting; inspect revision notes, download prior versions, and restore past versions with one click.
- **Recycle Bin & Recovery**: Soft-delete safety net with restoration and permanent deletion capabilities.
- **Storage Analytics**: Real-time quota monitoring, department storage breakdown, file category distribution, and top largest documents tracker.
- **Mobile Responsive & Network Ready**: Accessible across desktop, tablet, and mobile devices connected to the local network.
- **Public Syllabus Library**: Students can search and filter published syllabus PDFs by program, regulation, academic year, department, semester, and subject without a faculty account. Only active, published, public PDF files are exposed.
- **Admin Syllabus Catalogue**: Admins can upload or link PDFs, maintain subject metadata, publish or unpublish entries, and unlink catalogue metadata without deleting stored files.
- **Managed College Logo**: Admin Settings validates and stores PNG, JPG, WebP, or SVG logo uploads at a generated server-managed path.
- **Public College Pages**: Responsive About VNRVJIET and department-directory pages use the configured college logo and public department data.
- **HOD Department Workflow**: HOD accounts can be assigned to multiple departments, switch their active department, and review faculty file submissions with server-side department authorization.
- **HOD First-Login Security**: Newly provisioned HOD accounts must change their temporary password before accessing portal APIs. Set `FFMS_HOD_TEMP_PASSWORD` before deployment to choose the initial password; existing HOD passwords are not reset by the migration.
- **Progressive Web App (PWA)**: Installable directly onto Android & iOS devices without browser address bar.

The public department and faculty directories are available at `/college-departments` and `/college-faculty`; the administrative department-management page remains protected by the existing Admin role. Proposed Vision, Mission, Quality Policy, and Objectives copy is maintained in `frontend/src/content/aboutContent.js` for replacement with approved institutional wording.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v20.19+ or v22.12+)
- npm

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/khyathiksingam/fms.git
cd fms

# Install root & backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Build & Run
```bash
# Build frontend assets
npm run build --prefix frontend

# Start backend server
node backend/src/server.js
```

The API is a separate Express process; Vercel serves the frontend and does not
run this backend. In local development, the frontend defaults to `/api`, which
the Vite development proxy forwards to `http://localhost:5000`. For production,
set the Vercel project's `VITE_API_BASE_URL` build environment variable to the
actual public backend origin. The value may be the origin alone or may end in
`/api`; the shared API URL builder normalizes it to exactly one `/api` prefix.
Get the hostname from the backend hosting service; do not use a guessed URL.
Redeploy the frontend after changing this variable. It is public configuration
and must not contain secrets.

The frontend calls these API routes:

| Feature | Request |
| --- | --- |
| Syllabus filters | `GET /api/public/syllabus/filters` |
| Syllabus departments and catalogue metadata | `GET /api/public/syllabus/master-data` |
| Published syllabus resources | `GET /api/public/syllabus` |
| Department browser | `GET /api/public/departments` |
| Student login | `POST /api/auth/student-login` |
| Preview / download | `GET /api/public/syllabus/:id/preview` and `/download` (Bearer token required) |

`/syllabus/departments` is a frontend page route, not an API route.

### Deploy the existing Express backend with persistent storage

The root `render.yaml` deploys this existing Express server to Render with a
persistent disk mounted at `/var/data`. It stores the SQLite database there and
configures separate persistent upload and logo directories. It is a single
backend instance; do not scale it horizontally while using the local SQLite
database.

1. In Render, create a Blueprint from this repository using `render.yaml`.
2. Obtain the actual public service origin assigned by Render. This project
   does not assume or prescribe a backend hostname.
3. Configure backend service variables:
   - `JWT_SECRET`: generate a strong secret; the supplied Render Blueprint
     generates one.
   - `CORS_ORIGINS`: exact Vercel frontend origin(s), comma-separated if more
     than one. Origins do not include a path such as `/api`.
   - `FFMS_DATA_DIR=/var/data`, `FFMS_STORAGE_DIR=/var/data/uploads`, and
     `FFMS_LOGO_DIR=/var/data/logos` for the persistent disk in the Blueprint.
   - `ADMIN_PASSWORD` is required only to initialize an administrator on a
     new database. Set `FFMS_HOD_TEMP_PASSWORD` if provisioning HOD accounts.
     Configure `BREVO_API_KEY`, `EMAIL_FROM`, and `EMAIL_FROM_NAME` if student
     email verification is required.
4. In Vercel, set the Production environment variable
   `VITE_API_BASE_URL` to the actual backend origin returned by Render, with or
   without a trailing `/api`; the client normalizes it. This is a build-time
   variable, so redeploy after changing it. Ensure Vercel Deployment
   Protection does not block the public production frontend/API requests.
5. Before serving existing resources, migrate the existing SQLite database
   and matching uploaded files to the persistent disk using a trusted,
   authorized transfer. A new Render disk starts empty; this deployment
   configuration does not copy local data or fabricate catalogue resources.
6. Check `<actual-backend-origin>/api/health`, then verify the public syllabus
   endpoints and authenticated student login/preview/download from the Vercel
   origin.

Use the names in `frontend/.env.example` when building outside Vercel. The
backend environment variables for persistent locations are `FFMS_DATA_DIR`,
`FFMS_STORAGE_DIR`, and `FFMS_LOGO_DIR`.

### Student email verification

Student self-registration uses a 6-digit email OTP delivered only through
Brevo. Configure `backend/.env` locally or the corresponding backend service
environment variables in production:
```env
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=your_verified_sender@example.com
EMAIL_FROM_NAME=VNRVJIET
```

The backend explicitly loads `backend/.env`. Keep the Brevo key on the backend; do not add it to frontend environment variables. OTPs expire after 10 minutes, allow five verification attempts, and can be resent once per 60 seconds.

Student authentication endpoints:
- `POST /api/auth/student-register`
- `POST /api/auth/verify-student-email`
- `POST /api/auth/resend-otp`
- `POST /api/auth/student-change-email`
- `POST /api/auth/student-login`

---

## Initial account setup

On a new database, configure `ADMIN_PASSWORD` before starting the backend.
Optionally set `ADMIN_USERNAME`, `ADMIN_FULL_NAME`, and `ADMIN_EMAIL`.
Configure `FFMS_HOD_TEMP_PASSWORD` when HOD accounts should be provisioned;
new HOD accounts must change that temporary password on first login. Startup
does not reset passwords for existing administrator or HOD accounts. Never
commit environment files or production database/upload data.

### Reset an existing administrator password

`ADMIN_PASSWORD` is used only when startup creates the first administrator. It
does not rename or reset an existing account. To reset one safely, open an
interactive shell for the backend host, verify that `FFMS_DATA_DIR` points to
the existing persistent database, and run:

```bash
npm run admin:reset-password
```

The command refuses to create a database or administrator, prompts for the
existing administrator usernames and account statuses (not password data),
then prompts for the exact username. It reads and confirms the new password
without echoing it or accepting it as a command-line argument. It changes only
the matching administrator password, leaves the account status and other
records unchanged, and revokes that administrator's active sessions. If the
username `administrator` is not listed, selecting it will make no changes; use
one of the exact existing usernames shown. For Render, run it from the service
shell with the persistent disk mounted and `FFMS_DATA_DIR=/var/data`.
The backend uses `sql.js` and keeps its SQLite database loaded in the Express
process's memory. A separate reset command updates the persisted database file,
not the already-running process's memory. Restart the existing Express service
immediately after a successful reset and before testing login; do not rerun the
reset merely because the old process still has its pre-reset hash loaded.

For a login failure that still returns HTTP 401, temporarily set
`AUTH_DIAGNOSTICS=true` on the backend service, redeploy/restart it, and make
one login attempt. Backend logs then report the selected absolute database
file, whether the account lookup matched, and a category such as
`account_not_found` or `password_mismatch`; they never include the username,
password, hash, or token. Compare that path with the `Database file:` path
printed by the reset command. Disable `AUTH_DIAGNOSTICS` after diagnosis.
Disabled accounts return HTTP 403 (`account_disabled` in diagnostics), rather
than the generic 401.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express.js
- **Database**: SQLite via `sql.js` (WebAssembly)
- **OCR Engine**: Tesseract.js & pdf-parse
- **Authentication**: JWT & bcryptjs
- **Storage**: Private Local Object Storage with UUID hashing
