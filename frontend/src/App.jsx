import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { api } from './utils/api';

import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FilesPage from './pages/FilesPage';
import FoldersPage from './pages/FoldersPage';
import SharedFilesPage from './pages/SharedFilesPage';
import FavoritesPage from './pages/FavoritesPage';
import RecentFilesPage from './pages/RecentFilesPage';
import TrashPage from './pages/TrashPage';
import SearchResultsPage from './pages/SearchResultsPage';
import UsersPage from './pages/UsersPage';
import DepartmentsPage from './pages/DepartmentsPage';
import StoragePage from './pages/StoragePage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import SyllabusPage from './pages/SyllabusPage';
import SyllabusCataloguePage from './pages/SyllabusCataloguePage';
import StudentLoginPage from './pages/StudentLoginPage';
import StudentRegisterPage from './pages/StudentRegisterPage';
import StudentEmailVerificationPage from './pages/StudentEmailVerificationPage';
import StudentResourceActivityPage from './pages/StudentResourceActivityPage';
import AboutPage from './pages/AboutPage';
import CollegeDepartmentsPage from './pages/CollegeDepartmentsPage';
import CollegeDepartmentDetailPage from './pages/CollegeDepartmentDetailPage';
import CollegeFacultyPage from './pages/CollegeFacultyPage';
import HODDashboardPage from './pages/HODDashboardPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import FileUploadModal from './components/files/FileUploadModal';
import NewFolderModal from './components/files/NewFolderModal';
import FilePreviewModal from './components/files/FilePreviewModal';
import FileShareModal from './components/files/FileShareModal';
import { getToken } from './utils/api';

function MainApp({ currentPath, navigate }) {
  const { user, loading, isAdmin, isHOD } = useAuth();
  const searchQuery = currentPath.startsWith('/search')
    ? new URLSearchParams(currentPath.split('?')[1] || '').get('q') || ''
    : '';
  const [storageStats, setStorageStats] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global modals
  const [globalUploadOpen, setGlobalUploadOpen] = useState(false);
  const [globalNewFolderOpen, setGlobalNewFolderOpen] = useState(false);
  const [globalPreviewFile, setGlobalPreviewFile] = useState(null);
  const [globalShareFile, setGlobalShareFile] = useState(null);

  const handleGlobalDownload = (file) => {
    if (!file) return;
    const token = getToken();
    const link = document.createElement('a');
    link.href = `/api/files/${file.id}/download?token=${token || ''}`;
    link.download = file.name || file.original_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (user && !user.must_change_password) {
      loadStorageStats();
    }
  }, [user, currentPath]);

  useEffect(() => {
    if (loading) return;
    if (user?.must_change_password) {
      if (currentPath !== '/change-password') navigate('/change-password', true);
      return;
    }
    if (user?.role_name === 'student') {
      navigate('/student-syllabus', true);
      return;
    }
    if (!user && currentPath !== '/faculty-portal') {
      navigate('/faculty-portal', true);
    } else if (user && currentPath === '/faculty-portal') {
      navigate('/dashboard', true);
    }
  }, [currentPath, loading, navigate, user]);

  const loadStorageStats = async () => {
    try {
      const data = await api.get('/analytics/dashboard');
      if (data && data.stats) {
        setStorageStats(data.stats);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleSearch = (q) => {
    if (q && q.trim()) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const handleNavigate = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading Faculty File Management System...
          </p>
        </div>
      </div>
    );
  }

  if (user?.must_change_password && currentPath !== '/change-password') {
    return <div className="flex min-h-screen items-center justify-center text-sm font-semibold text-slate-500">Opening the required password update…</div>;
  }

  if (user?.role_name === 'student') {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Opening Student Syllabus Library…</div>;
  }

  if (!user) {
    if (currentPath === '/faculty-portal') {
      return <LoginPage onLoginSuccess={() => navigate('/dashboard')} />;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Redirecting to Faculty Portal...
        </p>
      </div>
    );
  }

  if (currentPath === '/faculty-portal') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Opening Faculty File Management System...
        </p>
      </div>
    );
  }

  const renderCurrentView = () => {
    if (currentPath.startsWith('/search')) {
      return (
        <SearchResultsPage
          query={searchQuery}
          onPreviewFile={(f) => setGlobalPreviewFile(f)}
        />
      );
    }

    switch (currentPath.split('?')[0]) {
      case '/dashboard':
        if (isHOD) return <HODDashboardPage />;
        return (
          <DashboardPage
            onNavigate={handleNavigate}
            onUploadClick={() => setGlobalUploadOpen(true)}
            onPreviewFile={(f) => setGlobalPreviewFile(f)}
          />
        );
      case '/files':
        return (
          <FilesPage
            scope={isAdmin ? 'all' : isHOD ? 'department' : 'my'}
            title={isAdmin ? 'All College Files' : isHOD ? `${user.department_code || 'Dept'} Files` : 'My Files'}
          />
        );
      case '/folders':
        return (
          <FoldersPage
            onOpenFolder={() => handleNavigate('/files')}
          />
        );
      case '/shared':
        return <SharedFilesPage />;
      case '/favorites':
        return <FavoritesPage />;
      case '/recent':
        return <RecentFilesPage />;
      case '/trash':
        return <TrashPage />;
      case '/users':
      case '/faculty':
        return <UsersPage />;
      case '/departments':
        return <DepartmentsPage />;
      case '/storage':
        return <StoragePage />;
      case '/activity':
        return <ActivityLogsPage />;
      case '/settings':
        return <SettingsPage />;
      case '/syllabus-management':
        return <SyllabusCataloguePage />;
      case '/student-resource-activity':
        return <StudentResourceActivityPage />;
      case '/profile':
        return <ProfilePage />;
      case '/change-password':
        return <ChangePasswordPage onComplete={() => navigate('/dashboard', true)} />;
      default:
        return (
          <DashboardPage
            onNavigate={handleNavigate}
            onUploadClick={() => setGlobalUploadOpen(true)}
            onPreviewFile={(f) => setGlobalPreviewFile(f)}
          />
        );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        currentSearchQuery={searchQuery}
        onSearch={handleSearch}
        onNavigate={handleNavigate}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        mobileMenuOpen={mobileMenuOpen}
      />

      {/* Main Content Area with Responsive Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentPath={currentPath}
          onNavigate={handleNavigate}
          onUploadClick={() => setGlobalUploadOpen(true)}
          onNewFolderClick={() => setGlobalNewFolderOpen(true)}
          storageStats={storageStats}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {renderCurrentView()}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <FileUploadModal
        isOpen={globalUploadOpen}
        onClose={() => setGlobalUploadOpen(false)}
        onUploadComplete={() => {
          loadStorageStats();
        }}
      />

      <NewFolderModal
        isOpen={globalNewFolderOpen}
        onClose={() => setGlobalNewFolderOpen(false)}
        onFolderCreated={() => {
          handleNavigate('/folders');
        }}
      />

      <FilePreviewModal
        isOpen={Boolean(globalPreviewFile)}
        file={globalPreviewFile}
        onClose={() => setGlobalPreviewFile(null)}
        onShare={(file) => setGlobalShareFile(file)}
        onDownload={handleGlobalDownload}
      />

      <FileShareModal
        isOpen={Boolean(globalShareFile)}
        file={globalShareFile}
        onClose={() => setGlobalShareFile(null)}
        onShareUpdated={() => {
          loadStorageStats();
        }}
      />
    </div>
  );
}

function getCurrentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function AppContent() {
  const [currentPath, setCurrentPath] = useState(getCurrentPath);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(getCurrentPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const pathname = currentPath.split('?')[0];
    if (['/', '/syllabus'].includes(pathname)) {
      document.title = 'Syllabus Library | VNRVJIET';
    } else if (pathname === '/syllabus/departments') {
      document.title = 'Browse Departments | Syllabus Library | VNRVJIET';
    } else if (pathname === '/about') {
      document.title = 'About VNRVJIET | Faculty File Management System';
    } else if (pathname === '/college-departments' || /^\/college-departments\/\d+$/.test(pathname)) {
      document.title = 'Departments | VNRVJIET';
    } else if (pathname === '/college-faculty') {
      document.title = 'Faculty | VNRVJIET';
    } else if (pathname === '/student-login' || pathname === '/student-syllabus') {
      document.title = 'Student Syllabus Library | VNRVJIET';
    } else if (pathname === '/student-register') {
      document.title = 'Student Registration | VNRVJIET';
    } else if (pathname === '/verify-student-email') {
      document.title = 'Verify Student OTP | VNRVJIET';
    } else if (pathname === '/faculty-portal') {
      document.title = 'Faculty Portal | VNRVJIET';
    } else {
      document.title = 'Faculty File Management System | VNRVJIET';
    }
  }, [currentPath]);

  const navigate = React.useCallback((path, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(getCurrentPath());
  }, []);

  const pathname = currentPath.split('?')[0];

  if (['/', '/syllabus'].includes(pathname)) {
    return <SyllabusPage />;
  }

  if (pathname === '/syllabus/departments') {
    return <SyllabusPage departmentBrowserView />;
  }

  if (pathname === '/about') {
    return <AboutPage />;
  }
  if (pathname === '/college-departments') {
    return <CollegeDepartmentsPage />;
  }
  if (pathname === '/college-faculty') {
    return <CollegeFacultyPage />;
  }
  const departmentRoute = pathname.match(/^\/college-departments\/(\d+)$/);
  if (departmentRoute) {
    return <CollegeDepartmentDetailPage departmentId={departmentRoute[1]} />;
  }

  if (pathname === '/student-login') {
    return <StudentLoginPage />;
  }

  if (pathname === '/student-register') {
    return <StudentRegisterPage />;
  }

  if (pathname === '/verify-student-email') {
    return <StudentEmailVerificationPage />;
  }

  if (pathname === '/student-syllabus') {
    return <SyllabusPage studentView />;
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <MainApp currentPath={currentPath} navigate={navigate} />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
