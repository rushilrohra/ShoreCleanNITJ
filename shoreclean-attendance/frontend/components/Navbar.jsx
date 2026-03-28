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
  const isOrganizer = user?.role === 'ngo' || user?.role === 'organizer' || user?.role === 'admin';

  // Volunteer Navigation Items
  const volunteerNavItems = [
    { label: 'Home', icon: '🏠', href: '/' },
    { label: 'Browse Events', icon: '🌊', href: '/events' },
    { label: 'My Dashboard', icon: '📋', href: '/dashboard' },
    ,
  ];

  // Organizer Navigation Items
  const organizerNavItems = [
    { label: 'Home', icon: '🏠', href: '/' },
    { label: 'Dashboard', icon: '📊', href: '/ngo/dashboard' },
    { label: 'Check-In Scanner', icon: '✅', href: '/volunteer/scanner' },
    { label: 'Browse Events', icon: '🌊', href: '/events' },
    { label: 'Waste Scanner', icon: '♻️', href: '/waste-scanner' }
  ];

  const navItems = isOrganizer ? organizerNavItems : volunteerNavItems;

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
            {user && (
              <>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: isOrganizer ? 'var(--coral-600)' : 'var(--green-600)',
                    background: isOrganizer ? 'var(--coral-100)' : 'var(--green-100)',
                    padding: '4px 10px',
                    borderRadius: 'var(--r-full)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {isOrganizer ? '🏢 Organizer' : '🙋 Volunteer'}
                </div>
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} style={navLinkStyle(item.href)}>
                    <span>{item.icon}</span>
                    <span className="hide-sm">{item.label}</span>
                  </Link>
                ))}
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                    paddingRight: 'var(--sp-2)',
                    borderRight: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      background: isOrganizer
                        ? 'linear-gradient(135deg, var(--coral-500), var(--orange-500))'
                        : 'linear-gradient(135deg, var(--ocean-500), var(--green-500))',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 14,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    {userInitial}
                  </div>
                  <span className="hide-sm" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                    {user.name?.split(' ')[0]}
                  </span>
                </div>
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
              style={{
                fontSize: '20px',
                display: 'none',
                background: mobileOpen ? 'var(--ocean-100)' : 'transparent',
              }}
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="mobile-menu">
          {/* Mobile Navigation */}
          {user && (
            <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: isOrganizer
                      ? 'linear-gradient(135deg, var(--coral-500), var(--orange-500))'
                      : 'linear-gradient(135deg, var(--ocean-500), var(--green-500))',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 16,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {userInitial}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--color-text)' }}>{user.name}</div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isOrganizer ? 'var(--coral-600)' : 'var(--green-600)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {isOrganizer ? '🏢 Organizer' : '🙋 Volunteer'}
                  </div>
                </div>
              </div>

              {/* Mobile Navigation Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    style={{
                      padding: 'var(--sp-3) var(--sp-2)',
                      fontSize: '15px',
                      fontWeight: 500,
                      borderRadius: 'var(--r-md)',
                      background: isActive(item.href) ? 'var(--ocean-100)' : 'transparent',
                      color: isActive(item.href) ? 'var(--ocean-700)' : 'var(--color-text-muted)',
                      transition: 'all 0.2s ease',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Mobile Auth Links */}
          {!user && (
            <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <Link href="/login" className="btn btn-ghost btn-block" onClick={closeMobile}>
                Log In
              </Link>
              <Link href="/register" className="btn btn-primary btn-block" onClick={closeMobile}>
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile Logout */}
          {user && (
            <div style={{ padding: 'var(--sp-4)', borderTop: '1px solid var(--color-border)' }}>
              <button type="button" className="btn btn-ghost btn-block" onClick={handleLogout}>
                Log Out
              </button>
            </div>
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
                  padding: 0 var(--sp-4);
        }

        .nav-center {
          display: flex;
          align-items: center;
          gap: var(--sp-2);
                  flex: 1;
                  justify-content: center;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: var(--sp-3);
          flex-wrap: nowrap;
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
          box-shadow: var(--shadow-lg);
          z-index: 1999;
          animation: slideDown 0.2s ease;
          max-height: calc(100vh - 64px);
          overflow-y: auto;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hide-sm {
          display: inline;
        }

        /* Tablet & Mobile Responsive */
        @media (max-width: 1024px) {
          .nav-center {
            gap: var(--sp-1);
          }

          .nav-center :global(a) {
            padding: 4px 8px;
            font-size: 13px;
          }
        }

        @media (max-width: 768px) {
          .nav-inner {
            padding: 0 var(--sp-3);
          }

          .nav-center {
            display: none;
          }

          .nav-right :global(.btn:not(.mobile-toggle)) {
            display: none;
          }

          .nav-right > div {
            display: none;
          }

          .mobile-toggle {
            display: inline-flex;
          }

          .hide-sm {
            display: none;
          }

          :global(.btn.btn-block) {
            width: 100%;
          }
        }

        @media (max-width: 480px) {
          :global(.container.nav-inner) {
            padding: 0 var(--sp-2);
          }

          .nav-inner {
            padding: 0 var(--sp-2);
          }

          .nav-inner > a {
            font-size: 16px;
          }
        }
      `}</style>
    </>
  );
}
