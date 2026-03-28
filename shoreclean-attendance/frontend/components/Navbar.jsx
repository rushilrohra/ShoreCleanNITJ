import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export function NavSpacer() {
  return <div style={{ height: '64px' }} />;
}

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = localStorage.getItem('shoreclean_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (error) {
        setUser(null);
      }
    }

    const handler = () => {
      const nextStored = localStorage.getItem('shoreclean_user');
      if (!nextStored) {
        setUser(null);
        return;
      }

      try {
        setUser(JSON.parse(nextStored));
      } catch (error) {
        setUser(null);
      }
    };

    window.addEventListener('auth-change', handler);
    return () => window.removeEventListener('auth-change', handler);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (href) => {
    if (href === '/') {
      return router.pathname === '/';
    }

    return router.pathname === href || router.pathname.startsWith(`${href}/`);
  };

  const navLinkStyle = (href) => ({
    fontSize: '15px',
    fontWeight: 500,
    color: isActive(href) ? 'var(--ocean-700)' : 'var(--color-text-muted)',
    background: isActive(href) ? 'var(--ocean-100)' : 'transparent',
    padding: '6px 12px',
    borderRadius: 'var(--r-md)',
    transition: 'var(--t)',
  });

  const closeMobile = () => setMobileOpen(false);

  const handleLogout = () => {
    localStorage.removeItem('shoreclean_token');
    localStorage.removeItem('shoreclean_user');
    window.dispatchEvent(new Event('auth-change'));
    setMobileOpen(false);
    router.push('/');
  };

  const userInitial = (user?.name || 'U').charAt(0).toUpperCase();

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2000,
          height: '64px',
          background: 'white',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: scrolled ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        }}
      >
        <div className="container nav-inner">
          <Link href="/" onClick={closeMobile}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--ocean-700)',
              }}
            >
              🌊 ShoreClean
            </span>
          </Link>

          <div className="nav-center">
            <Link href="/events" style={navLinkStyle('/events')}>Events</Link>
            <Link href="/waste-scanner" style={navLinkStyle('/waste-scanner')}>Waste Scanner</Link>

            {user && user.role === 'volunteer' && (
              <Link href="/dashboard" style={navLinkStyle('/dashboard')}>My Dashboard</Link>
            )}

            {user && (user.role === 'ngo' || user.role === 'admin') && (
              <>
                <Link href="/ngo/dashboard" style={navLinkStyle('/ngo/dashboard')}>NGO Dashboard</Link>
                <Link href="/volunteer/scanner" style={navLinkStyle('/volunteer/scanner')}>Scanner</Link>
              </>
            )}
          </div>

          <div className="nav-right">
            {!user && (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Log In</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Sign Up</Link>
              </>
            )}

            {user && (
              <>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    background: 'var(--ocean-100)',
                    color: 'var(--ocean-700)',
                    fontWeight: 700,
                    fontSize: 14,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {userInitial}
                </div>
                <span
                  className="hide-mobile"
                  style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}
                >
                  {user.name}
                </span>
                <button type="button" onClick={handleLogout} className="btn btn-ghost btn-sm">
                  Log Out
                </button>
              </>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-icon mobile-toggle"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle mobile menu"
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="mobile-menu">
          <Link href="/events" className="mobile-link" onClick={closeMobile}>Events</Link>
          <Link href="/waste-scanner" className="mobile-link" onClick={closeMobile}>Waste Scanner</Link>

          {user && user.role === 'volunteer' && (
            <Link href="/dashboard" className="mobile-link" onClick={closeMobile}>My Dashboard</Link>
          )}

          {user && (user.role === 'ngo' || user.role === 'admin') && (
            <>
              <Link href="/ngo/dashboard" className="mobile-link" onClick={closeMobile}>NGO Dashboard</Link>
              <Link href="/volunteer/scanner" className="mobile-link" onClick={closeMobile}>Scanner</Link>
            </>
          )}

          {!user && (
            <>
              <Link href="/login" className="mobile-link" onClick={closeMobile}>Log In</Link>
              <Link href="/register" className="mobile-link" onClick={closeMobile}>Sign Up</Link>
            </>
          )}

          {user && (
            <button type="button" className="mobile-link logout-mobile" onClick={handleLogout}>
              Log Out
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
          gap: var(--sp-4);
        }

        .nav-center {
          display: flex;
          align-items: center;
          gap: var(--sp-2);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: var(--sp-2);
        }

        .mobile-toggle {
          display: none;
          font-size: 18px;
          line-height: 1;
        }

        .mobile-menu {
          position: fixed;
          top: 64px;
          left: 0;
          right: 0;
          background: white;
          border-bottom: 1px solid var(--color-border);
          box-shadow: var(--shadow-md);
          z-index: 1999;
          padding: var(--sp-3) 0;
        }

        .mobile-link {
          display: block;
          width: 100%;
          padding: var(--sp-3) var(--sp-6);
          font-size: 16px;
          color: var(--color-text);
        }

        .logout-mobile {
          text-align: left;
          background: transparent;
          border: none;
        }

        @media (max-width: 768px) {
          .nav-center {
            display: none;
          }

          .nav-right :global(.btn.btn-ghost.btn-sm),
          .nav-right :global(.btn.btn-primary.btn-sm),
          .nav-right .hide-mobile,
          .nav-right div[style*='border-radius: 50%'] {
            display: none !important;
          }

          .mobile-toggle {
            display: inline-flex;
          }
        }
      `}</style>
    </>
  );
}
