import { Building2, Github, LogIn, LogOut, MapPinned } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/authContext';
import { API_BASE_URL } from '../config/env';

const appBaseUrl = import.meta.env.BASE_URL;

export default function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string>();

  async function handleLogout() {
    setSigningOut(true);
    setLogoutError(undefined);
    try {
      navigate('/', { replace: true });
      await auth.logout();
    } catch {
      setLogoutError('Sign out failed. Your session may still be active; please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <img
                src={`${appBaseUrl}sunbird-icon-192.png`}
                alt=""
                className="size-9 object-contain"
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold uppercase tracking-[0.08em] text-slate-500">
                Sunbird AI
              </span>
              <span className="block truncate text-lg font-extrabold text-slate-950">Noise Dashboard</span>
            </span>
          </NavLink>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden max-w-80 truncate rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 md:inline">
              API: {API_BASE_URL.replace(/^https?:\/\//, '')}
            </span>
            <a
              href="https://sunbird.ai"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              aria-label="Open Sunbird AI website"
              title="Sunbird AI"
            >
              <MapPinned size={18} aria-hidden="true" />
            </a>
            <a
              href="https://github.com/SunbirdAI"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              aria-label="Open Sunbird AI GitHub"
              title="Sunbird AI GitHub"
            >
              <Github size={18} aria-hidden="true" />
            </a>
            {auth.status === 'authenticated' ? (
              <>
                <NavLink
                  to="/portal"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <Building2 size={17} aria-hidden="true" />
                  <span className="hidden sm:inline">Partner portal</span>
                </NavLink>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={signingOut}
                  className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-60"
                  aria-label="Sign out"
                  title={`Sign out ${auth.user?.email || auth.user?.username || ''}`}
                >
                  <LogOut size={17} aria-hidden="true" />
                </button>
              </>
            ) : auth.status === 'anonymous' ? (
              <NavLink
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 font-extrabold text-white transition hover:bg-slate-800"
              >
                <LogIn size={17} aria-hidden="true" />
                <span className="hidden sm:inline">Partner sign in</span>
              </NavLink>
            ) : null}
          </div>
        </div>
        {logoutError ? (
          <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-800" role="alert">
            {logoutError}
          </div>
        ) : null}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
