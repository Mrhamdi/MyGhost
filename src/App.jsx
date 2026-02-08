import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Peer from 'peerjs';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/Landing';
import VoiceChat from './components/VoiceChat';
import Notification from './components/Notification';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import './App.css';

//This for prod
const SOCKET_URL = 'https://server-tt1f.onrender.com/';

//This for dev
//const SOCKET_URL = 'http://localhost:3001';

function AppContent() {
  const [step, setStep] = useState('landing');
  const [status, setStatus] = useState('idle');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [notification, setNotification] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load auto-reconnect preference from localStorage
  const [autoReconnect, setAutoReconnect] = useState(() => {
    const saved = localStorage.getItem('autoReconnect');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Load theme preference from localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'light';
  });

  const socketRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();
  const remoteAudioRef = useRef();
  const timerRef = useRef(null);
  const callRef = useRef(null);
  const peerOpenRef = useRef(false);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };
  const streamTimeoutRef = useRef(null);

  // Emit find_partner only when PeerJS is open and local stream is ready
  const emitFindPartner = (tries = 0) => {
    const MAX_TRIES = 12;
    const WAIT_MS = 250;
    if (!socketRef.current) return;
    if (tries > MAX_TRIES) {
      return;
    }

    const peerReady = !!(peerOpenRef.current && peerRef.current && peerRef.current.id);
    const haveStream = !!localStreamRef.current;

    if (!peerReady || !haveStream) {
      setTimeout(() => emitFindPartner(tries + 1), WAIT_MS);
      return;
    }

    try {
      socketRef.current.emit('find_partner', peerRef.current.id);
    } catch (err) {
      setTimeout(() => emitFindPartner(tries + 1), WAIT_MS);
    }
  };

  // Initialize audio element on mount
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.id = 'remoteAudio';
      audio.autoplay = true;
      audio.playsinline = true;
      audio.controls = false;
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }

    return () => {
      // Cleanup audio on unmount
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    // Initialize Socket
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
    });

    socketRef.current.on('user_count', (count) => {
      setOnlineUsers(count);
    });

    // Helper: ensure local stream and peer are ready before calling
    const attemptCall = (partnerId, tries = 0) => {
      const MAX_TRIES = 10;
      const WAIT_MS = 300;
      if (!partnerId) return;
      if (tries > MAX_TRIES) {
        return;
      }

      const peerReady = peerRef.current && peerRef.current.id;
      const haveStream = !!localStreamRef.current;

      if (!peerReady || !haveStream) {
        // Retry after a short wait
        setTimeout(() => attemptCall(partnerId, tries + 1), WAIT_MS);
        return;
      }

      // Small additional delay to let the remote peer register with PeerJS server
      setTimeout(() => {
        try {
          callUser(partnerId);
        } catch (err) {
          setTimeout(() => attemptCall(partnerId, tries + 1), WAIT_MS);
        }
      }, 150);
    };

    socketRef.current.on('match_found', ({ partnerId, initiator }) => {
      // Keep UI in 'searching' state and wait for remote stream before marking connected
      setStatus('searching');
      setMessages([]);
      setCallDuration(0);
      setUnreadCount(0);



      // Notify server when we're ready (have local stream and peer open)
      const sendReady = (tries = 0) => {
        const MAX_TRIES = 12;
        const WAIT_MS = 250;
        if (tries > MAX_TRIES) {
          return;
        }

        const peerReady = !!(peerOpenRef.current && peerRef.current && peerRef.current.id);
        const haveStream = !!localStreamRef.current;

        if (!peerReady || !haveStream) {
          setTimeout(() => sendReady(tries + 1), WAIT_MS);
          return;
        }

        try { socketRef.current.emit('peer_ready'); } catch (err) { setTimeout(() => sendReady(tries + 1), WAIT_MS); }
      };

      sendReady();

      // Server will instruct initiator to start via 'start_call'
    });

    socketRef.current.on('start_call', ({ partnerId }) => {
      attemptCall(partnerId);
    });

    socketRef.current.on('preflight', ({ partnerId }) => {
      // Perform lightweight data connection to warm up signaling/ICE
      const doPreflight = () => {
        try {
          if (!peerRef.current) { socketRef.current.emit('preflight_done'); return; }

          const conn = peerRef.current.connect(partnerId, { reliable: true });
          conn.on('open', () => {
            try {
              conn.send({ type: 'preflight', ts: Date.now() });
            } catch (e) { }
            // close after a short delay
            setTimeout(() => {
              try { conn.close(); } catch (e) { }
              try { socketRef.current.emit('preflight_done'); } catch (e) { }
            }, 200);
          });
          conn.on('error', (err) => { try { socketRef.current.emit('preflight_done'); } catch (e) { } });
          // if connection object already open immediately, emit done
          setTimeout(() => {
            if (conn.open) {
              try { socketRef.current.emit('preflight_done'); } catch (e) { }
            }
          }, 500);
        } catch (e) {
          try { socketRef.current.emit('preflight_done'); } catch (er) { }
        }
      };

      // run preflight after small delay to avoid races
      setTimeout(doPreflight, 50);
    });

    // Log socket events for debugging
    socketRef.current.on('peer_not_ready', () => { });

    socketRef.current.on('partner_disconnected', () => {
      showNotification('Stranger disconnected');

      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Auto-reconnect if enabled
      if (autoReconnect && step === 'chat') {
        setTimeout(() => {
          setMessages([]);
          setCallDuration(0);
          setUnreadCount(0);
          setStatus('searching');
          // Get new stream before searching
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              localStreamRef.current = stream;
              emitFindPartner();
            })
            .catch((err) => { setStatus('idle'); });
        }, 1500);
      } else {
        setStatus('idle');
        setMessages([]);
        setCallDuration(0);
        setUnreadCount(0);
      }
    });

    socketRef.current.on('receive_message', (message) => {
      setMessages(prev => [...prev, { text: message, type: 'received' }]);
      setUnreadCount(prev => prev + 1);
    });

    // Initialize PeerJS (Production)
    peerRef.current = new Peer(undefined, {
      host: 'server-tt1f.onrender.com', // or your actual Render domain
      port: 443,
      path: '/peerjs/myapp',
      secure: true
    });

    peerRef.current.on('open', (id) => {
      peerOpenRef.current = true;
    });

    peerRef.current.on('call', (call) => {
      callRef.current = call;
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        localStreamRef.current = stream;
        call.answer(stream);
        // Start timeout waiting for remote stream
        clearStreamTimeout();
        streamTimeoutRef.current = setTimeout(() => {
          abortAndSearch();
        }, 5000);

        call.on('stream', (remoteStream) => {

          // remote stream arrived — clear any pending abort timer
          clearStreamTimeout();
          if (remoteAudioRef.current) {
            // Stop previous stream if any
            if (remoteAudioRef.current.srcObject) {
              remoteAudioRef.current.srcObject.getTracks().forEach(track => track.stop());
            }

            remoteAudioRef.current.srcObject = remoteStream;

            // Ensure autoplay properties are set
            remoteAudioRef.current.autoplay = true;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.volume = 1;

            // Play with error handling
            const playPromise = remoteAudioRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => { });
            }
            // Mark connection established when remote stream arrives
            establishConnection();
          }
        });

        call.on('error', (err) => { });

        call.on('close', () => {

          clearStreamTimeout();
          if (remoteAudioRef.current) {
            remoteAudioRef.current.pause();
            remoteAudioRef.current.srcObject = null;
          }
        });
      }).catch((err) => { });
    });

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      socketRef.current.disconnect();
      peerRef.current.destroy();
    };
  }, [autoReconnect, step]);

  const showNotification = (message) => {
    setNotification(message);
  };

  // Called when we actually receive a remote stream — mark connected and start timer
  const establishConnection = () => {
    if (status === 'connected') return;
    setStatus('connected');
    setMessages([]);
    setUnreadCount(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const clearStreamTimeout = () => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
  };

  const abortAndSearch = () => {
    clearStreamTimeout();

    // Close call if exists
    try {
      if (callRef.current && typeof callRef.current.close === 'function') {
        callRef.current.close();
      }
    } catch (e) { }
    callRef.current = null;

    // Stop local stream
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    } catch (e) { }

    // Notify server to disconnect partner (best-effort)
    try { socketRef.current?.emit('disconnect_call'); } catch (e) { }

    // Immediately start searching again silently
    setStatus('searching');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        emitFindPartner();
      })
      .catch((err) => { setStatus('idle'); });
  };

  const startSearch = () => {
    setStep('chat');
    setStatus('searching');

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        emitFindPartner();
      })
      .catch((err) => { showNotification('Microphone access is required!'); setStep('landing'); });
  };

  const callUser = (partnerId) => {
    if (!peerRef.current || !localStreamRef.current) {
      return;
    }

    const call = peerRef.current.call(partnerId, localStreamRef.current);
    callRef.current = call;
    // Start timeout waiting for remote stream
    clearStreamTimeout();
    streamTimeoutRef.current = setTimeout(() => {
      abortAndSearch();
    }, 5000);

    call.on('stream', (remoteStream) => {

      clearStreamTimeout();
      if (remoteAudioRef.current) {
        // Stop previous stream if any
        if (remoteAudioRef.current.srcObject) {
          remoteAudioRef.current.srcObject.getTracks().forEach(track => track.stop());
        }

        remoteAudioRef.current.srcObject = remoteStream;

        // Ensure autoplay properties are set
        remoteAudioRef.current.autoplay = true;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1;

        // Play with error handling
        const playPromise = remoteAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => { });
        }

        // Mark connection established when remote stream arrives
        establishConnection();
      }
    });

    call.on('error', (err) => { });

    call.on('close', () => {

      clearStreamTimeout();
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
    });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const handleSendMessage = (text) => {
    setMessages(prev => [...prev, { text, type: 'sent' }]);
    socketRef.current.emit('send_message', text);
  };

  const handleDisconnect = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Notify server to disconnect partner
    socketRef.current.emit('disconnect_call');

    setStatus('idle');
    setMessages([]);
    setCallDuration(0);
    setUnreadCount(0);
  };

  const handleStartCall = () => {
    setStatus('searching');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        emitFindPartner();
      })
      .catch((err) => { showNotification('Microphone access is required!'); setStatus('idle'); });
  };

  const handleHome = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    setStep('landing');
    setStatus('idle');
    setMessages([]);
    setCallDuration(0);
    setUnreadCount(0);
  };

  const toggleAutoReconnect = () => {
    const newValue = !autoReconnect;
    setAutoReconnect(newValue);
    localStorage.setItem('autoReconnect', JSON.stringify(newValue));
  };

  const handleChatOpen = () => {
    setUnreadCount(0);
  };

  const handleSkip = () => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Notify server to disconnect partner
    socketRef.current.emit('disconnect_call');

    // Clear messages and reset state
    setMessages([]);
    setCallDuration(0);
    setUnreadCount(0);
    setStatus('searching');

    // Immediately search for new partner
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        emitFindPartner();
      })
      .catch((err) => { showNotification('Microphone access is required!'); setStatus('idle'); });
  };

  return (
    <div className="app-container">
      {notification && (
        <Notification
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}

      <Routes>
        <Route path="/" element={
          step === 'landing' ? (
            <Landing onStart={startSearch} onlineUsers={onlineUsers} theme={theme} onToggleTheme={toggleTheme} />
          ) : (
            <VoiceChat
              status={status}
              isMuted={isMuted}
              toggleMute={toggleMute}
              onDisconnect={handleDisconnect}
              onHome={handleHome}
              onStartCall={handleStartCall}
              messages={messages}
              onSendMessage={handleSendMessage}
              callDuration={callDuration}
              autoReconnect={autoReconnect}
              onToggleAutoReconnect={toggleAutoReconnect}
              unreadCount={unreadCount}
              onChatOpen={handleChatOpen}
              onlineUsers={onlineUsers}
              onSkip={handleSkip}
            />
          )
        } />
        <Route path="/terms" element={<TermsOfService theme={theme} />} />
        <Route path="/privacy" element={<PrivacyPolicy theme={theme} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
