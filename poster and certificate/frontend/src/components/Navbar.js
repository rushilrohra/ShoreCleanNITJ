import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    const handleLogout = () => {
        setOpen(false);
        onLogout();
        navigate('/login');
    };

    useEffect(() => {
        function handleOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        }

        function handleKey(e) {
            if (e.key === 'Escape') setOpen(false);
        }

        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, []);

    return (
        <nav className="bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-8 py-4">
                <div className="flex justify-between items-center">
                    <Link to="/dashboard" className="text-2xl font-bold flex items-center gap-2">
                        <span className="text-3xl">🌊</span> ShoreClean
                    </Link>

                    <div className="flex gap-6 items-center">
                        {user?.role === 'volunteer' && (
                            <>
                                <Link to="/check-in" className="hover:opacity-80 transition">📱 Check In</Link>
                                <Link to="/check-out" className="hover:opacity-80 transition">✓ Check Out</Link>
                                <Link to="/certificates" className="hover:opacity-80 transition">📜 Certificates</Link>
                                <Link to="/test-certificate" className="hover:opacity-80 transition text-yellow-200" title="Test mode - generate certificates without QR">🧪 Test</Link>
                            </>
                        )}

                        {user?.role === 'organizer' && (
                            <>
                                <Link to="/dashboard" className="hover:opacity-80 transition">🛠️ Organizer Dashboard</Link>
                            </>
                        )}

                        <div className="relative" ref={wrapperRef}>
                            <button
                                type="button"
                                aria-haspopup="true"
                                aria-expanded={open}
                                onClick={() => setOpen(v => !v)}
                                className="hover:opacity-80 transition flex items-center gap-2 focus:outline-none cursor-pointer"
                            >
                                {user?.email} <span aria-hidden="true">▼</span>
                            </button>

                            <div
                                role="menu"
                                className={`absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-lg z-50 transform origin-top-right transition-all duration-150 ${open ? 'opacity-100 scale-100 pointer-events-auto dropdown-animate' : 'opacity-0 scale-95 pointer-events-none'}`}
                            >
                                <button onClick={handleLogout} role="menuitem" className="w-full text-left px-4 py-2 hover:bg-gray-100">
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
