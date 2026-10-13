import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, LogOut, User, 
  Shield, ChevronDown, Menu, X, Sun, Moon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { VNRVJIET_DARK_EMBLEM } from '../../utils/branding';

export default function Navbar({ onSearch, onNavigate, onToggleMobileMenu, mobileMenuOpen, currentSearchQuery = '' }) {
  const { user, logout, collegeSettings } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState(currentSearchQuery);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  const profileRef = useRef(null);
  const collegeLogo = collegeSettings?.college_logo || collegeSettings?.system_logo || '/logo.png';
  const displayedCollegeLogo = isDark ? VNRVJIET_DARK_EMBLEM : collegeLogo;
  const collegeName = collegeSettings?.college_name || 'VNRVJIET';

  useEffect(() => {
    setSearchQuery(currentSearchQuery || '');
  }, [currentSearchQuery]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
      setShowMobileSearch(false);
    }
  };

  const roleColor = user?.role_name === 'admin' 
    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800' 
    : user?.role_name === 'hod' 
    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800' 
    : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-3 sm:px-6 backdrop-blur-md shadow-xs dark:border-slate-800 dark:bg-slate-900/95">
      {/* Left: Mobile Menu Toggle & Official 3D Emblem */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onToggleMobileMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden transition cursor-pointer"
          title="Toggle Navigation Menu"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Official VNRVJIET emblem */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden ${isDark ? '' : 'bg-white'}`}>
          <img 
            src={displayedCollegeLogo}
            alt={`${collegeName} logo`}
            className="h-full w-full object-contain" 
          />
        </div>

        <div className="text-left min-w-0">
          <h1 className="text-xs font-extrabold uppercase tracking-wide text-[#14295f] dark:text-blue-200 line-clamp-1 max-w-[180px] sm:max-w-md lg:max-w-lg">
            {collegeName}
          </h1>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
            <span className="truncate">{collegeSettings?.system_name || 'Faculty File Management System'}</span>
            <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider shrink-0">COLLEGE PORTAL</span>
          </p>
        </div>
      </div>

      {/* Middle: Universal Search (Desktop) */}
      <div className="hidden md:block mx-4 flex-1 max-w-md lg:max-w-lg">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents, folders, question papers, OCR text..."
            className="w-full rounded-full border border-slate-200 bg-slate-50/80 py-2 pl-10 pr-20 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:bg-slate-800 transition"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 transition cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Right Controls: Search Toggle (Mobile), Dark/Light Mode Option, Role Badge, User Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Mobile Search Toggle */}
        <button
          onClick={() => setShowMobileSearch(!showMobileSearch)}
          className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Dark / Light Mode Switcher Option (Replaced Fullscreen) */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-750 dark:hover:border-amber-400/30 transition cursor-pointer"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-amber-400 animate-in spin-in-180 duration-300" />
          ) : (
            <Moon className="h-4 w-4 text-slate-700 animate-in spin-in-180 duration-300" />
          )}
        </button>

        {user?.role_name === 'hod' && user.assigned_departments?.length > 1 && (
          <label className="flex items-center">
            <span className="sr-only">Active department</span>
            <select
              value={localStorage.getItem('ffms_active_department') || user.department_id}
              onChange={(event) => {
                localStorage.setItem('ffms_active_department', event.target.value);
                window.location.reload();
              }}
              className="max-w-28 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:max-w-48 sm:px-2.5 sm:text-xs"
            >
              {user.assigned_departments.map(department => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </label>
        )}

        {/* Current Role Badge */}
        <div className={`hidden sm:flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${roleColor}`}>
          <Shield className="h-3.5 w-3.5" />
          <span>Role: <strong className="uppercase">{user?.role_name || 'FACULTY'}</strong></span>
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1.5 pr-2 transition hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-750 cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white uppercase shadow-xs">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[120px] truncate leading-tight">
                {user?.full_name}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold leading-tight">
                {user?.department_code || user?.role_name}
              </div>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl z-50 dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 dark:border-slate-800 p-2 text-left">
                <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                  {user?.full_name}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  @{user?.username} • {user?.email}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${roleColor}`}>
                    {user?.role_name}
                  </span>
                  {user?.department_code && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {user?.department_code}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-1 space-y-0.5">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onNavigate) onNavigate('/profile');
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  My Profile
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Search Overlay Bar */}
      {showMobileSearch && (
        <div className="absolute inset-x-0 top-16 bg-white border-b border-slate-200 p-3 shadow-md z-30 md:hidden dark:bg-slate-900 dark:border-slate-800 animate-in slide-in-from-top duration-150">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents, OCR text..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs"
            >
              Search
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
