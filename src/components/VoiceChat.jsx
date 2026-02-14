import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, PhoneOff, Loader, Send, MessageCircle, X, Home, SkipForward } from 'lucide-react';

const VoiceChat = ({
    status,
    isMuted,
    toggleMute,
    onDisconnect,
    onHome,
    onStartCall,
    messages,
    onSendMessage,
    callDuration,
    autoReconnect,
    onToggleAutoReconnect,
    unreadCount,
    onChatOpen,
    onlineUsers,
    onSkip
}) => {
    const [messageText, setMessageText] = useState('');
    const [showAnimation, setShowAnimation] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false); // Closed by default
    const [chatPosition, setChatPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const messagesEndRef = useRef(null);
    const chatRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (status === 'connected') {
            setShowAnimation(true);
            setTimeout(() => setShowAnimation(false), 600);
        }
    }, [status]);

    // Dragging logic
    const handleMouseDown = (e) => {
        if (e.target.closest('.chat-input-container') || e.target.closest('button')) {
            return; // Don't drag when clicking input or buttons
        }

        setIsDragging(true);
        const rect = chatRef.current.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        setChatPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    const handleSend = (e) => {
        e.preventDefault();
        if (messageText.trim() && status === 'connected') {
            onSendMessage(messageText);
            setMessageText('');
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleChat = () => {
        setIsChatOpen(!isChatOpen);
        if (!isChatOpen && onChatOpen) {
            onChatOpen();
        }
    };

    const chatStyle = chatPosition.x !== 0 || chatPosition.y !== 0 ? {
        left: `${chatPosition.x}px`,
        top: `${chatPosition.y}px`,
        transform: 'none'
    } : {};

    return (
        <div className="container">
            {/* Online Users Count - Fixed Top Left */}
            <div className="online-badge fixed-badge">
                <span className="pulse-dot"></span>
                <span>{onlineUsers} Online</span>
            </div>

            {status === 'connected' && (
                <>
                    <button className={`chat-toggle-btn ${isChatOpen ? 'hidden-mobile' : ''}`} onClick={toggleChat}>
                        {isChatOpen ? <X size={24} /> : <MessageCircle size={24} />}
                        {!isChatOpen && unreadCount > 0 && (
                            <span className="badge">{unreadCount}</span>
                        )}
                    </button>

                    <div
                        ref={chatRef}
                        className={`chat-container ${isChatOpen ? '' : 'collapsed'} ${isDragging ? 'dragging' : ''}`}
                        style={chatStyle}
                        onMouseDown={handleMouseDown}
                    >
                        <div className="chat-header-mobile">
                            <span>Chat</span>
                            <button className="close-btn-mobile" onClick={toggleChat}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="drag-hint">💡 Drag to move</div>
                        <div className="chat-messages">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`message ${msg.type}`}
                                >
                                    {msg.text}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSend} className="chat-input-container">
                            <input
                                type="text"
                                className="chat-input"
                                placeholder="Type a message..."
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="send-btn"
                                disabled={!messageText.trim()}
                            >
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                </>
            )}

            {status === 'idle' ? (
                <div className="idle-state">
                    <h1 className="title">Randomic</h1>
                    <p className="subtitle">By Black And White</p>
                    <button
                        className="btn-primary"
                        onClick={onStartCall}
                        style={{ marginTop: '3rem' }}
                    >
                        Ready to Call
                    </button>
                </div>
            ) : status === 'searching' ? (
                <div className="searching">
                    <div className="search-animation">
                        <div className="search-circle"></div>
                        <div className="search-circle"></div>
                        <div className="search-circle"></div>
                    </div>
                    <p style={{ marginTop: '2rem', fontSize: '1.2rem', fontWeight: '500' }}>Searching for a stranger...</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        This may take a few moments
                    </p>
                </div>
            ) : (
                <div className={`connected ${showAnimation ? 'connection-animation' : ''}`}>
                    <div className="visualizer">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="bar"
                                style={{ animationDelay: `${i * 0.1}s` }}
                            ></div>
                        ))}
                    </div>
                    <p>Connected with Stranger</p>
                    {callDuration > 0 && (
                        <div className="timer">{formatTime(callDuration)}</div>
                    )}
                </div>
            )}

            <div className="controls" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button
                    className={`btn-icon ${isMuted ? 'active' : ''}`}
                    onClick={toggleMute}
                    disabled={status === 'searching' || status === 'idle'}
                >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                {status === 'connected' && (
                    <>
                        <button
                            className="btn-icon active"
                            onClick={onDisconnect}
                        >
                            <PhoneOff size={24} />
                        </button>

                        <button
                            className="btn-icon btn-skip"
                            onClick={onSkip}
                            title="Skip to next stranger"
                        >
                            <SkipForward size={24} />
                        </button>
                    </>
                )}

                <button className="btn-icon" onClick={onHome}>
                    <Home size={24} />
                </button>
            </div>

            {status !== 'connected' && (
                <div className="toggle-container">
                    <div
                        className={`toggle-switch ${autoReconnect ? 'active' : ''}`}
                        onClick={onToggleAutoReconnect}
                    >
                        <div className="toggle-slider"></div>
                    </div>
                    <span>Auto-search on disconnect</span>
                </div>
            )}
        </div>
    );
};

export default VoiceChat;
