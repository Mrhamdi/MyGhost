import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = ({ theme }) => {
    return (
        <div className="policy-page" data-theme={theme}>
            <div className="policy-container">
                <Link to="/" className="back-link">
                    <ArrowLeft size={20} />
                    <span>Back to Home</span>
                </Link>

                <h1 className="policy-title">Privacy Policy</h1>
                <p className="last-updated">Last Updated: February 2026</p>

                <section className="policy-section">
                    <h2>1. Introduction</h2>
                    <p>
                        Welcome to Randomic. We are committed to protecting your privacy and ensuring you have a safe,
                        anonymous experience when using our voice chat service. This Privacy Policy explains how we handle
                        your information.
                    </p>
                </section>

                <section className="policy-section">
                    <h2>2. Information We Do Not Collect</h2>
                    <p>
                        Randomic is designed with privacy as a core principle. We do NOT collect:
                    </p>
                    <ul>
                        <li>Your name, email address, or phone number</li>
                        <li>Your location data</li>
                        <li>Logs of your conversations</li>
                        <li>Your IP address for storage purposes</li>
                    </ul>
                </section>

                <section className="policy-section">
                    <h2>3. How Our Technology Works</h2>
                    <p>
                        Randomic uses Peer-to-Peer (P2P) technology (WebRTC) to connect you directly with other users.
                        Your voice data is encrypted and travels directly from your device to the other user's device.
                        It does not pass through or get stored on our servers.
                    </p>
                </section>

                <section className="policy-section">
                    <h2>4. Temporary Data</h2>
                    <p>
                        To establish connections, we use a signaling server that temporarily facilitates the "handshake"
                        between users. Once connected, the server is no longer involved in transmitting your voice data.
                        Connection metadata is not stored persistently.
                    </p>
                </section>

                <section className="policy-section">
                    <h2>5. Local Storage</h2>
                    <p>
                        We use your browser's local storage solely to save your preferences, such as:
                    </p>
                    <ul>
                        <li>Dark/Light mode theme setting</li>
                    </ul>
                    <p>This data stays on your device and is never sent to our servers.</p>
                </section>

                <section className="policy-section">
                    <h2>6. Contact Us</h2>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us at support@randomic.app.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
