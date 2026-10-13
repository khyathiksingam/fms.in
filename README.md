# College File Management System

A secure, modern, responsive full-stack web application designed for colleges and universities to organize, search, preview, share, version, and manage academic and administrative files in a Google Drive-style interface.

---

## 🔒 Live HTTPS URL & Deployment

- **Student Syllabus Library**: `http://localhost:5000/syllabus`
- **Local Network (Wi-Fi)**: `http://<server-ip>:5000`
- **Localhost**: `http://localhost:5000`
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
# Configure backend/.env first:
# ADMIN_PASSWORD=<unique administrator password>
# ADMIN_USERNAME=admin
# ADMIN_EMAIL=admin@example.edu
# FFMS_HOD_TEMP_PASSWORD=<unique temporary HOD password>

# Build frontend assets
npm run build --prefix frontend

# Start backend server
node backend/src/server.js
```

### 4. Student email verification
Student self-registration uses a 6-digit email OTP delivered only through Brevo. Create `backend/.env` with:
```env
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=your_verified_sender@example.com
EMAIL_FROM_NAME=Your Institution
```

The backend explicitly loads `backend/.env`. Keep the Brevo key on the backend; do not add it to frontend environment variables. OTPs expire after 10 minutes, allow five verification attempts, and can be resent once per 60 seconds.

Student authentication endpoints:
- `POST /api/auth/student-register`
- `POST /api/auth/verify-student-email`
- `POST /api/auth/resend-otp`
- `POST /api/auth/student-change-email`
- `POST /api/auth/student-login`

---

## 🔐 Initial administrator setup

Set `ADMIN_PASSWORD` in `backend/.env` before the first server start. Optionally
set `ADMIN_USERNAME`, `ADMIN_FULL_NAME`, and `ADMIN_EMAIL` to configure the
initial administrator identity. Never commit `backend/.env`.

To provision HOD accounts, set `FFMS_HOD_TEMP_PASSWORD` in `backend/.env`.
Newly provisioned HOD accounts must change that temporary password on first login;
existing HOD passwords are not reset by startup.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express.js
- **Database**: SQLite via `sql.js` (WebAssembly)
- **OCR Engine**: Tesseract.js & pdf-parse
- **Authentication**: JWT & bcryptjs
- **Storage**: Private Local Object Storage with UUID hashing
