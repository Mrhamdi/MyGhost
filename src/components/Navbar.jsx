import React, { useState } from 'react';
import { Moon, Sun, Settings, Home, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = ({ onlineUsers, theme, onToggleTheme, onOpenSettings }) => {
    return (
        <header className="app-navbar">
            {/* Left side: Logo & Online Count */}
            <div className="ghost-logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1 }}>
                <img src="/logo.svg" alt="Randomic Logo" className="ghost-logo-icon" width={40} height={40} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <h1 className="ghost-title" style={{ margin: 0 }}>Randomic</h1>
                    <div className="online-badge" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', border: 'none', background: 'transparent' }}>
                        <span className="pulse-dot"></span>
                        <span>{onlineUsers} Online</span>
                    </div>
                </div>
            </div>

            {/* Center: Links — absolutely centered, hidden on mobile */}
            <nav className="navbar-desktop-links" style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                zIndex: 1
            }}>
                <Link to="/" style={{ color: 'var(--text-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <Home size={18} /> <span>Home</span>
                </Link>
                <button onClick={onOpenSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '1rem', padding: 0 }}>
                    <Settings size={18} /> <span>Preferences</span>
                </button>
            </nav>

            {/* Right side: Tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1 }}>
                <button
                    className="theme-toggle-btn"
                    onClick={onToggleTheme}
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
                {/* Toggle: mobile only (calls settings directly) */}
                <button
                    className="navbar-hamburger"
                    onClick={onOpenSettings}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-color)', display: 'none', alignItems: 'center' }}
                    title="Open Preferences"
                >
                    <Settings size={22} />
                </button>
            </div>
        </header>
    );
};

export default Navbar;
