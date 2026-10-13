const express = require('express');
const router = express.Router();

const { authenticate, requireRoles } = require('../middleware/auth');
const upload = require('../middleware/upload');
const logoUpload = require('../middleware/logoUpload');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const departmentController = require('../controllers/departmentController');
const folderController = require('../controllers/folderController');
const fileController = require('../controllers/fileController');
const searchController = require('../controllers/searchController');
const shareController = require('../controllers/shareController');
const versionController = require('../controllers/versionController');
const analyticsController = require('../controllers/analyticsController');
const activityController = require('../controllers/activityController');
const notificationController = require('../controllers/notificationController');
const settingsController = require('../controllers/settingsController');
const syllabusController = require('../controllers/syllabusController');
const academicRegulationController = require('../controllers/academicRegulationController');
const studentActivityController = require('../controllers/studentActivityController');
const hodController = require('../controllers/hodController');

function handleLogoUpload(req, res, next) {
  logoUpload.single('logo')(req, res, error => {
    if (error) return res.status(400).json({ error: 'Logo must be a PNG, JPG, WebP, or SVG image no larger than 2 MB.' });
    next();
  });
}

// ---------------- Authentication Routes ----------------
router.post('/auth/login', authController.login);
router.post('/auth/student-login', authController.studentLogin);
router.post('/auth/student-register', authController.studentRegister);
router.post('/auth/verify-student-email', authController.verifyStudentEmail);
router.post('/auth/resend-otp', authController.resendStudentVerification);
router.post('/auth/student-change-email', authController.changeStudentEmail);
router.get('/auth/me', authenticate, authController.me);
router.post('/auth/heartbeat', authenticate, authController.heartbeat);
router.put('/auth/profile', authenticate, authController.updateProfile);
router.post('/auth/change-password', authenticate, authController.changePassword);
router.post('/auth/logout', authenticate, authController.logout);
router.get('/hod/dashboard', authenticate, requireRoles('hod'), hodController.dashboard);
router.patch('/hod/submissions/:id', authenticate, requireRoles('hod'), hodController.reviewSubmission);

// ---------------- Public Settings Route (for branding before login) ----------------
router.get('/settings/public', settingsController.getSettings);
router.get('/public/logo/:filename', settingsController.getLogo);
router.get('/public/syllabus/filters', syllabusController.getPublicFilters);
router.get('/public/syllabus/master-data', syllabusController.getPublicMasterData);
router.get('/public/syllabus', syllabusController.getPublicSyllabus);
router.get('/public/departments', departmentController.getPublicDepartments);
router.get('/public/faculty', departmentController.getPublicFaculty);
router.get('/public/departments/:id', departmentController.getPublicDepartmentById);
router.get('/public/syllabus/:id/preview', authenticate, requireRoles('student', 'admin', 'hod', 'faculty'), syllabusController.previewPublicSyllabus);
router.get('/public/syllabus/:id/download', authenticate, requireRoles('student', 'admin', 'hod', 'faculty'), syllabusController.downloadPublicSyllabus);
router.post('/student/activity', authenticate, requireRoles('student'), studentActivityController.recordStudentAction);
router.get('/student/activity/mine', authenticate, requireRoles('faculty', 'hod'), studentActivityController.facultyActivity);
router.get('/student/activity/monitor', authenticate, requireRoles('admin'), studentActivityController.adminMonitor);

// ---------------- Protected Settings Routes ----------------
router.get('/settings', authenticate, settingsController.getSettings);
router.put('/settings', authenticate, requireRoles('admin'), settingsController.updateSettings);
router.patch('/settings/student-registration', authenticate, requireRoles('admin'), settingsController.toggleStudentSelfRegistration);
router.post('/settings/logo', authenticate, requireRoles('admin'), handleLogoUpload, settingsController.uploadLogo);

// Syllabus catalogue management. Faculty and HOD may submit entries; only Admin may publish or edit.
router.get('/syllabus', authenticate, requireRoles('admin', 'hod', 'faculty'), syllabusController.getCatalogue);
router.get('/syllabus/master-data', authenticate, requireRoles('admin', 'hod', 'faculty'), syllabusController.getCatalogueMasterData);
router.get('/syllabus/files', authenticate, requireRoles('admin', 'hod', 'faculty'), syllabusController.getAvailableFiles);
router.get('/syllabus/filters', authenticate, requireRoles('admin', 'hod', 'faculty'), syllabusController.getCatalogueFilters);
router.post('/syllabus', authenticate, requireRoles('admin', 'hod', 'faculty'), syllabusController.createCatalogueEntry);
router.put('/syllabus/:id', authenticate, requireRoles('admin', 'hod', 'faculty'), syllabusController.updateCatalogueEntry);
router.patch('/syllabus/:id/published', authenticate, requireRoles('admin'), syllabusController.setPublished);
router.delete('/syllabus/:id', authenticate, requireRoles('admin', 'hod', 'faculty'), syllabusController.deleteCatalogueEntry);
router.get('/academic-regulations', authenticate, requireRoles('admin'), academicRegulationController.list);
router.post('/academic-regulations', authenticate, requireRoles('admin'), academicRegulationController.create);
router.put('/academic-regulations/:id', authenticate, requireRoles('admin'), academicRegulationController.update);
router.patch('/academic-regulations/:id/status', authenticate, requireRoles('admin'), academicRegulationController.setStatus);

// ---------------- User Management Routes ----------------
router.get('/users', authenticate, userController.getAllUsers);
router.get('/users/roles', authenticate, userController.getRoles);
router.get('/users/:id', authenticate, userController.getUserById);
router.post('/users', authenticate, requireRoles('admin'), userController.createUser);
router.put('/users/:id', authenticate, requireRoles('admin'), userController.updateUser);
router.patch('/users/:id/toggle-status', authenticate, requireRoles('admin'), userController.toggleUserStatus);
router.post('/users/:id/reset-password', authenticate, requireRoles('admin'), userController.resetPassword);
router.delete('/users/:id', authenticate, requireRoles('admin'), userController.deleteUser);

// ---------------- Department Management Routes ----------------
router.get('/departments', authenticate, departmentController.getAllDepartments);
router.get('/departments/:id', authenticate, departmentController.getDepartmentById);
router.post('/departments', authenticate, requireRoles('admin'), departmentController.createDepartment);
router.put('/departments/:id', authenticate, requireRoles('admin'), departmentController.updateDepartment);
router.patch('/departments/:id/status', authenticate, requireRoles('admin'), departmentController.setStatus);
router.post('/departments/:id/assign-hod', authenticate, requireRoles('admin'), departmentController.assignHOD);
router.delete('/departments/:id', authenticate, requireRoles('admin'), departmentController.deleteDepartment);

// ---------------- Folder Routes ----------------
router.get('/folders', authenticate, folderController.getFolders);
router.get('/folders/tree', authenticate, folderController.getFolderTree);
router.get('/folders/:id/breadcrumbs', authenticate, folderController.getFolderBreadcrumbs);
router.post('/folders', authenticate, folderController.createFolder);
router.put('/folders/:id/rename', authenticate, folderController.renameFolder);
router.put('/folders/:id/move', authenticate, folderController.moveFolder);
router.delete('/folders/:id', authenticate, folderController.deleteFolder);

// ---------------- File Routes ----------------
router.post('/files/upload', authenticate, upload.array('files', 15), fileController.uploadFiles);
router.get('/files', authenticate, fileController.getFiles);
router.get('/files/:id', authenticate, fileController.getFileById);
router.get('/files/:id/download', authenticate, fileController.downloadFile);
router.get('/files/:id/preview', authenticate, fileController.previewFile);
router.put('/files/:id/rename', authenticate, fileController.renameFile);
router.put('/files/:id/move', authenticate, fileController.moveFile);
router.post('/files/:id/star', authenticate, fileController.toggleStar);
router.patch('/files/:id/visibility', authenticate, fileController.toggleVisibility);
router.post('/files/batch-trash', authenticate, fileController.batchMoveToTrash);
router.post('/files/batch-visibility', authenticate, fileController.batchChangeVisibility);
router.delete('/files/:id', authenticate, fileController.deleteFile); // soft delete to trash
router.post('/files/:id/restore', authenticate, fileController.restoreFile);
router.post('/trash/restore-all', authenticate, fileController.restoreAllTrash);
router.post('/trash/restore-selected', authenticate, fileController.restoreSelectedTrash);
router.delete('/files/:id/permanent', authenticate, fileController.permanentlyDeleteFile);
router.delete('/trash/empty', authenticate, fileController.emptyTrash);

// ---------------- Search & OCR Routes ----------------
router.get('/search', authenticate, searchController.search);

// ---------------- File Sharing Routes ----------------
router.post('/files/:file_id/share', authenticate, shareController.shareFile);
router.delete('/shares/:share_id', authenticate, shareController.removeShare);
router.get('/shared-with-me', authenticate, shareController.getSharedWithMe);

// ---------------- Version History Routes ----------------
router.get('/files/:id/versions', authenticate, versionController.getFileVersions);
router.post('/files/:id/versions', authenticate, upload.single('file'), versionController.uploadNewVersion);
router.get('/files/:id/versions/:versionNumber/download', authenticate, versionController.downloadVersion);
router.post('/files/:id/versions/:versionNumber/restore', authenticate, versionController.restoreVersion);

// ---------------- Analytics & Dashboard Routes ----------------
router.get('/analytics/dashboard', authenticate, analyticsController.getDashboardStats);
router.get('/analytics/storage', authenticate, analyticsController.getStorageAnalytics);

// ---------------- Activity Logs Routes ----------------
router.get('/activity', authenticate, activityController.getActivityLogs);

// ---------------- Notification Routes ----------------
router.get('/notifications', authenticate, notificationController.getNotifications);
router.patch('/notifications/:id/read', authenticate, notificationController.markAsRead);
router.patch('/notifications/read-all', authenticate, notificationController.markAllAsRead);
router.delete('/notifications', authenticate, notificationController.clearNotifications);

module.exports = router;
