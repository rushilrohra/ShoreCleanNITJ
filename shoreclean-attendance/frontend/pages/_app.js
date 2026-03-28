import '../styles/globals.css';
import 'leaflet/dist/leaflet.css';
import Navbar from '../components/Navbar';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const HIDE_NAVBAR = ['/login', '/register'];

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [toasts, setToasts] = useState([]);
  const showNavbar = !HIDE_NAVBAR.includes(router.pathname);

  /* ─── AOS init (once) ─── */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initAOS = () => {
      if (typeof window.AOS !== 'undefined') {
        window.AOS.init({
          duration: 700,
          easing: 'ease-out-cubic',
          once: true,
          offset: 80,
        });
      } else {
        /* AOS script may not have loaded yet — retry shortly */
        setTimeout(initAOS, 200);
      }
    };

    initAOS();
  }, []);

  /* ─── Re-init AOS on route change ─── */
  useEffect(() => {
    const handleRouteChange = () => {
      if (typeof window !== 'undefined' && typeof window.AOS !== 'undefined') {
        setTimeout(() => window.AOS.refresh(), 300);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router]);

  /* ─── Toast system ─── */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.showToast = (message, type = 'success') => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 3500);
    };

    return () => {
      delete window.showToast;
    };
  }, []);

  return (
    <>
      {showNavbar && <Navbar />}
      <Component {...pageProps} />
      {toasts.map((toast, idx) => (
        <div
          key={toast.id}
          className={`alert alert-${toast.type}`}
          style={{
            position: 'fixed',
            bottom: 24 + idx * 70,
            right: 24,
            minWidth: 280,
            maxWidth: 360,
            zIndex: 300,
            animation: 'modal-in 0.2s ease',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {toast.message}
        </div>
      ))}
    </>
  );
}
