import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const TermsOfService = ({ theme }) => {
    return (
        <div className="policy-page" data-theme={theme}>
            <div className="policy-container">
                <Link to="/" className="back-link">
                    <ArrowLeft size={20} />
                    <span>Back to Home</span>
                </Link>

                <h1 className="policy-title">Terms of Service</h1>
                <p className="last-updated">Last Updated: February 2026</p>

                <section className="policy-section">
                    <h2>1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using Randomic, you agree to be bound by these Terms of Service.
                        If you do not agree, strictly do not use our service.
                    </p>
                </section>

                <section className="policy-section">
                    <h2>2. Age and Eligibility</h2>
                    <p>
                        You must be at least 18 years old to use Randomic. By using the service, you represent
                        and warrant that you meet this age requirement.
                    </p>
                </section>

                <section className="policy-section">
                    <h2>3. User Conduct</h2>
                    <p>
                        Randomic is a place for respectful conversation. You agree NOT to:
                    </p>
                    <ul>
                        <li>Harass, threaten, or abuse other users</li>
                        <li>Promote hate speech, discrimination, or violence</li>
                        <li>Share illegal content or engage in illegal activities</li>
                        <li>Attempt to bypass security features or disrupt the service</li>
                        <li>Record calls without the other party's consent</li>
                    </ul>
                </section>

                <section className="policy-section">
                    <h2>4. Disclaimer of Warranties</h2>
                    <p>
                        The service is provided "as is" and "as available" without any warranties of any kind.
                        We do not guarantee that the service will be uninterrupted, secure, or error-free.
                    </p>
                </section>

                <section className="policy-section">
                    <h2>5. Limitation of Liability</h2>
                    <p>
                        Randomic and its creators shall not be liable for any indirect, incidental, special,
                        consequential, or punitive damages resulting from your use of the service.
                    </p>
                </section>

                <section className="policy-section">
                    <h2>6. Changes to Terms</h2>
                    <p>
                        We reserve the right to modify these terms at any time. Continued use of the service
                        after changes constitutes acceptance of the new terms.
                    </p>
                </section>
            </div>
        </div>
    );
};

export default TermsOfService;
