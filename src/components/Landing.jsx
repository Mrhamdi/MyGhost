import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Info, FileText, Shield, Lock, Database, Eye, MessageCircle } from 'lucide-react';

const Landing = ({ onStart, onOpenSettings }) => {
    const [activeSection, setActiveSection] = useState(null);

    const features = [
        {
            icon: Users,
            title: "Peer-to-Peer",
            content: "Direct WebRTC connections. No servers in between your audio.",
            key: "p2p"
        },
        {
            icon: Shield,
            title: "Zero Data",
            content: "No accounts, no logs, no history. We keep nothing.",
            key: "zero"
        },
        {
            icon: Eye,
            title: "True Anonymity",
            content: "Connect instantly with strangers worldwide. Pure anonymity.",
            key: "anon"
        }
    ];

    const handleCardClick = (key) => {
        setActiveSection(activeSection === key ? null : key);
    };

    return (
        <main className="ghost-landing">
            <div className="ghost-bg-particles" />

            {/* Hero Banner */}
            <section className="hero-banner">
                <div className="banner-container">
                    <img
                        src="banner.png"
                        alt="Randomic - Connect with strangers"
                        className="banner-image"
                    />
                </div>
            </section>

            <section className="ghost-hero">
                <p className="ghost-tagline">Speak Freely, Vanish Completely</p>
                <div className="ghost-cta-wrapper">
                    <button className="ghost-start-btn" onClick={() => onStart()}>
                        <MessageCircle size={24} />
                        <span>Start Chat</span>
                    </button>
                    <p style={{ color: 'var(--text-color)', fontSize: '0.9rem', opacity: 0.8 }}>
                        Configure your matches in the <span onClick={onOpenSettings} style={{ color: 'var(--primary-color)', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer' }}>Preferences</span> tab!
                    </p>
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
