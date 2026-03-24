import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Notification = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 2000); // Faster: 2 seconds

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="notification-toast">
            <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>{message}</p>
            </div>
            <button
                onClick={onClose}
                className="notification-close"
            >
                <X size={18} />
            </button>
        </div>
    );
};

export default Notification;
