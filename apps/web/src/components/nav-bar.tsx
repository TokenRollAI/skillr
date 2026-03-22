'use client';

import { useEffect, useState } from 'react';

interface User {
  username: string;
  role: string;
}

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('skillhub_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }

    // Listen for storage changes (login/logout in other tabs)
    const handler = () => {
      const s = localStorage.getItem('skillhub_user');
      setUser(s ? JSON.parse(s) : null);
    };
    window.addEventListener('storage', handler);
    // Also listen for custom event from same-tab login
    window.addEventListener('skillhub:auth', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('skillhub:auth', handler);
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem('skillhub_token');
    localStorage.removeItem('skillhub_user');
    setUser(null);
    window.location.href = '/';
  }

  return (
    <nav className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <a href="/" className="text-xl font-bold text-[var(--color-primary)]">
          ⚡ Skillr
        </a>
        <div className="flex items-center gap-6">
          <a href="/skills" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            Skills
          </a>
          <a href="/skills/publish" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            Publish
          </a>
          <a href="/namespaces" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            Namespaces
          </a>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-[var(--color-text-secondary)]">
                {user.username}
                {user.role === 'admin' && (
                  <span className="ml-2 rounded bg-[var(--color-warning)] px-1.5 py-0.5 text-xs text-black">admin</span>
                )}
              </span>
              {user.role === 'admin' && (
                <a href="/admin" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Admin</a>
              )}
              <a href="/settings" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Settings</a>
              <button
                onClick={handleLogout}
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
              >
                Logout
              </button>
            </div>
          ) : (
            <a href="/login" className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-black hover:opacity-90">
              Login
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
