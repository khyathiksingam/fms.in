import { api } from '../../utils/api';
import { useTheme } from '../../context/ThemeContext';
import { getDisplayedLogo, DEFAULT_FALLBACK_LOGO } from '../../utils/branding';
import ThemeToggle from '../common/ThemeToggle';

const navItems = [
  ['Home', '/'],
  ['About', '/about'],
  ['Departments', '/college-departments'],
  ['Faculty', '/college-faculty'],
  ['Contact', '/about#contact']
];

export default function PublicSiteLayout({ activePage, children }) {
  const { isDark } = useTheme();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.publicGet('/settings/public')
      .then(response => setSettings(response.settings || null))
      .catch(error => console.warn('Unable to load public branding settings:', error.message));
  }, []);

  const logo = getDisplayedLogo(settings, isDark);
  const collegeName = settings?.college_name || 'College Portal';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-2xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <a href="/" className="flex items-center gap-3" aria-label={`${collegeName} home`}>
            <img
              src={logo}
              alt={`${collegeName} logo`}
              onError={event => { event.currentTarget.src = DEFAULT_FALLBACK_LOGO; }}
              className="h-10 w-10 rounded-xl object-contain"
            />
            <span className="min-w-0">
              <span className="block truncate text-xs font-black uppercase tracking-wide text-brand-900 dark:text-slate-100">{collegeName}</span>
              <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Faculty File Management System</span>
            </span>
          </a>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <ThemeToggle />
            <nav aria-label="Main navigation" className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {navItems.map(([label, href]) => {
                const active = activePage === label;
                return (
                  <a
                    key={label}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:px-3 ${
                      active ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </a>
                );
              })}
            </nav>
            <a href="/faculty-portal" className="btn-primary text-xs py-2 px-3.5">
              Login <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer id="contact" className="mt-16 bg-slate-900 dark:bg-slate-950 text-white border-t border-slate-800">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-base font-black">
              <GraduationCap className="h-5 w-5 text-amber-300" />
              {collegeName}
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-blue-100/75">
              Advancing engineering education, research, and student development at Bachupally, Hyderabad.
            </p>
          </div>
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-amber-300">Explore</h2>
            <div className="mt-3 flex flex-col items-start gap-2 text-sm text-blue-100/80">
              <a className="hover:text-white" href="/about">About VNRVJIET</a>
              <a className="hover:text-white" href="/college-departments">Departments</a>
              <a className="hover:text-white" href="/">Student Syllabus Library</a>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-amber-300">Visit</h2>
            <p className="mt-3 text-sm leading-6 text-blue-100/80">
              VNR Vignana Jyothi Institute of Engineering & Technology<br />
              Bachupally, Hyderabad, Telangana
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-blue-100/50">
          © {new Date().getFullYear()} {collegeName}. Faculty File Management System.
        </div>
      </footer>
    </div>
  );
}
