import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Lock, Database, Eye, MessageCircle, Sun, Moon, Globe, ChevronLeft, Flame } from 'lucide-react';
import COUNTRIES, { getCountryFlag } from '../data/countries';

const Landing = ({ onStart, onlineUsers, theme, onToggleTheme, userCountry, targetCountry, setTargetCountry, excludeCountry, setExcludeCountry }) => {
    const [activeSection, setActiveSection] = useState(null);
    const [selectedService, setSelectedService] = useState('randomic');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const features = [
        {
            key: 'security',
            icon: Lock,
            title: 'End-to-End Encrypted',
            content: 'Your safety is our priority. All voice connections are encrypted. No data is stored on our servers - everything happens peer-to-peer.'
        },
        {
            key: 'privacy',
            icon: Eye,
            title: 'Complete Privacy',
            content: 'No registration, no emails, no phone numbers. We don\'t track your conversations. You remain completely anonymous.'
        },
        {
            key: 'nodata',
            icon: Database,
            title: 'Zero Data Retention',
            content: 'We have NO database for chats. Once you disconnect, the conversation is gone forever. Truly ephemeral messaging.'
        }
    ];

    const handleCardClick = (key) => {
        setActiveSection(activeSection === key ? null : key);
    };

    const toggleService = () => {
        if (selectedService === 'randomic') {
            setSelectedService('hotline');
            setSidebarOpen(true);
        } else {
            setSelectedService('randomic');
            setSidebarOpen(false);
        }
    };

    const handleStartChat = () => {
        onStart(selectedService);
    };

    return (
        <main className="ghost-landing">
            <div className="ghost-bg-particles" />

            {/* HotLine Left Sidebar */}
            <div className={`hotline-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <Globe size={20} />
                    <h3>HotLine Filters</h3>
                    <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
                        <ChevronLeft size={20} />
                    </button>
                </div>

                <div className="sidebar-content">
                    <div className="sidebar-section">
                        <div className="sidebar-country-display">
                            <span className="sidebar-label">Your Country</span>
                            <span className="sidebar-value">{getCountryFlag(userCountry)} {userCountry || 'Detecting...'}</span>
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <label className="sidebar-label">Preferred Country</label>
                        <select
                            className="sidebar-select"
                            value={targetCountry}
                            onChange={(e) => setTargetCountry(e.target.value)}
                        >
                            <option value="">🌍 Any Country</option>
                            {COUNTRIES.map(c => (
                                <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="sidebar-section">
                        <label className="sidebar-label">Not Preferred</label>
                        <select
                            className="sidebar-select"
                            value={excludeCountry}
                            onChange={(e) => setExcludeCountry(e.target.value)}
                        >
                            <option value="">None</option>
                            {COUNTRIES.map(c => (
                                <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            {selectedService === 'hotline' && !sidebarOpen && (
                <button className="sidebar-tab" onClick={() => setSidebarOpen(true)}>
                    <Globe size={16} />
                    <span>Filters</span>
                </button>
            )}

            <header className="ghost-header">
                <div className="ghost-logo-container">
                    <img src="/logo.svg" alt="Randomic Logo" className="ghost-logo-icon" width={40} height={40} />
                    <h1 className="ghost-title">Randomic</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        className={`hotline-toggle-btn ${selectedService === 'hotline' ? 'active' : ''}`}
                        onClick={toggleService}
                        title={selectedService === 'hotline' ? 'Switch to Randomic' : 'Switch to HotLine'}
                    >
                        <Flame size={18} className="flame-icon" />
                        <span>HotLine</span>
                        <div className="fire-particles">
                            <span className="fire-particle"></span>
                            <span className="fire-particle"></span>
                            <span className="fire-particle"></span>
                            <span className="fire-particle"></span>
                            <span className="fire-particle"></span>
                        </div>
                    </button>

                    <button
                        className="theme-toggle-btn"
                        onClick={onToggleTheme}
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                    <div className="online-badge">
                        <span className="pulse-dot"></span>
                        <span>{onlineUsers} Online</span>
                    </div>
                </div>
            </header>

            <section className="hero-banner">
                <div className="banner-container">
                    <img
                        src="banner.png"
                        alt="Randomic - Connect with strangers"
                        className="banner-image"
                    />
                    <div className="banner-overlay">
                        <h2 className="banner-title">Connect Anonymously</h2>
                        <p className="banner-subtitle">Voice chat with people around the world</p>
                    </div>
                </div>
            </section>

            <section className="ghost-hero">
                <p className="ghost-tagline">Speak Freely, Vanish Completely</p>

                <div className={`mode-indicator ${selectedService}`}>
                    {selectedService === 'hotline' ? (
                        <>
                            <Flame size={18} />
                            <span>HotLine Mode — Match by country</span>
                        </>
                    ) : (
                        <>
                            <MessageCircle size={18} />
                            <span>Randomic Mode — Chat with anyone</span>
                        </>
                    )}
                </div>

                <div className="ghost-cta-wrapper">
                    <button
                        className={`ghost-start-btn ${selectedService === 'hotline' ? 'hotline-start' : ''}`}
                        onClick={handleStartChat}
                    >
                        {selectedService === 'hotline' ? <Flame size={24} /> : <MessageCircle size={24} />}
                        <span>{selectedService === 'hotline' ? 'Start HotLine' : 'Start Chat'}</span>
                    </button>
                </div>
            </section>

            <section className="ghost-features">
                <h2 className="section-title">Why Randomic?</h2>
                <div className="features-grid">
                    {features.map((feature) => {
                        const Icon = feature.icon;
                        const isActive = activeSection === feature.key;
                        return (
                            <div
                                key={feature.key}
                                className={`feature-card ${isActive ? 'active' : ''}`}
                                onClick={() => handleCardClick(feature.key)}
                            >
                                <div className="feature-header">
                                    <Icon size={24} className="feature-icon" />
                                    <h3>{feature.title}</h3>
                                </div>
                                <p className="feature-content">{feature.content}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="ghost-goal">
                <div className="goal-content">
                    <Users size={32} className="goal-icon" />
                    <h2>Our Goal</h2>
                    <p>
                        To foster genuine human connections in a world of digital noise.
                        We believe in the power of anonymous, unprejudiced conversation.
                        Connect, share, and discover new perspectives without fear of judgment.
                    </p>
                </div>
            </section>
            <footer className="ghost-footer">
                <p>© 2025 Randomic • <Link to="/terms" className="footer-link">Terms</Link> • <Link to="/privacy" className="footer-link">Privacy</Link></p>
            </footer>
        </main>
    );
}

export default Landing;
