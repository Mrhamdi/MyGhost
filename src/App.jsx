import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const streamTimeoutRef = useRef(null);

  // Refs to read mutable state inside stable callbacks without re-creating socket/peer
  const autoReconnectRef = useRef(autoReconnect);
  const stepRef = useRef(step);
  const statusRef = useRef(status);
  const callRetriedRef = useRef(false);
  const isSearchingRef = useRef(false); // guard against double-searching

  // Keep refs in sync with state
  useEffect(() => { autoReconnectRef.current = autoReconnect; }, [autoReconnect]);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // ──────────── HELPERS ────────────

  const showNotification = (message) => {
    setNotification(message);
  };

  const clearStreamTimeout = () => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRemoteAudio = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      if (remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      remoteAudioRef.current.srcObject = null;
    }
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const closeCall = () => {
    clearStreamTimeout();
    try {
      if (callRef.current && typeof callRef.current.close === 'function') {
        callRef.current.close();
      }
    } catch (e) { }
    callRef.current = null;
    callRetriedRef.current = false;
  };

  // Full cleanup of everything call-related
  const fullCleanup = () => {
    stopTimer();
    closeCall();
    stopRemoteAudio();
    stopLocalStream();
  };

  // Reset all call state
  const resetCallState = () => {
    setMessages([]);
    setCallDuration(0);
    setUnreadCount(0);
    setIsMuted(false);
  };

  // ──────────── CORE CONNECTION LOGIC ────────────

  // Emit find_partner only when PeerJS is open and local stream is ready
  const emitFindPartner = (tries = 0) => {
    const MAX_TRIES = 12;
    const WAIT_MS = 250;
    if (!socketRef.current || !socketRef.current.connected) return;
    if (tries > MAX_TRIES) {
      console.log('emitFindPartner: max retries exceeded, giving up');
      showNotification('Connection failed. Please try again.');
      setStatus('idle');
      isSearchingRef.current = false;
      return;
    }

    const peerReady = !!(peerOpenRef.current && peerRef.current && peerRef.current.id);
    const haveStream = !!(localStreamRef.current && localStreamRef.current.active);

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

  // Called when we actually receive a remote stream — mark connected and start timer
  const establishConnection = () => {
    if (statusRef.current === 'connected') return;
    callRetriedRef.current = false;
    isSearchingRef.current = false;
    setStatus('connected');
    resetCallState();
    stopTimer();
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const abortAndSearch = () => {
    closeCall();
    stopRemoteAudio();
    stopLocalStream();

    // Notify server to disconnect partner (best-effort)
    try { socketRef.current?.emit('disconnect_call'); } catch (e) { }

    // Immediately start searching again silently
    setStatus('searching');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        emitFindPartner();
      })
      .catch((err) => {
        console.log('Failed to get mic for re-search:', err);
        setStatus('idle');
        isSearchingRef.current = false;
      });
  };

  const callUser = (partnerId) => {
    if (!peerRef.current || !localStreamRef.current) {
      console.log('callUser: peer or stream not ready');
      return;
    }

    const call = peerRef.current.call(partnerId, localStreamRef.current);
    if (!call) {
      console.log('callUser: peerRef.call returned null');
      abortAndSearch();
      return;
    }

    callRef.current = call;
    // Start timeout waiting for remote stream — retry once before aborting
    clearStreamTimeout();
    streamTimeoutRef.current = setTimeout(() => {
      if (!callRetriedRef.current && peerRef.current && localStreamRef.current) {
        callRetriedRef.current = true;
        console.log('First call attempt timed out, retrying...');
        try { call.close(); } catch (e) { }
        callUser(partnerId);
      } else {
        abortAndSearch();
      }
    }, 5000);

    call.on('stream', (remoteStream) => {
      clearStreamTimeout();
      if (remoteAudioRef.current) {
        stopRemoteAudio();
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.autoplay = true;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1;
        const playPromise = remoteAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => { });
        }
        establishConnection();
      }
    });

    call.on('error', (err) => {
      console.log('Outgoing call error:', err);
    });

    call.on('close', () => {
      clearStreamTimeout();
      stopRemoteAudio();
    });
  };

  // ──────────── EFFECTS ────────────

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
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  // MOUNT-ONLY: initialize socket + PeerJS once
  useEffect(() => {
    // Initialize Socket
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
    });

    // Handle socket reconnect — if user was searching, re-emit find_partner
    socketRef.current.on('reconnect', () => {
      console.log('Socket reconnected');
      if (statusRef.current === 'searching' && isSearchingRef.current) {
        emitFindPartner();
      }
    });

    // Explicitly disconnect on page refresh/close
    const handleBeforeUnload = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    socketRef.current.on('user_count', (count) => {
      setOnlineUsers(count);
    });

    // Helper: ensure local stream and peer are ready before calling
    const attemptCall = (partnerId, tries = 0) => {
      const MAX_TRIES = 10;
      const WAIT_MS = 300;
      if (!partnerId) return;
      if (tries > MAX_TRIES) {
        console.log('attemptCall: max retries, aborting');
        abortAndSearch();
        return;
      }

      const peerReady = peerRef.current && peerRef.current.id;
      const haveStream = !!(localStreamRef.current && localStreamRef.current.active);

      if (!peerReady || !haveStream) {
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
      resetCallState();

      // Notify server when we're ready (have local stream and peer open)
      const sendReady = (tries = 0) => {
        const MAX_TRIES = 12;
        const WAIT_MS = 250;
        if (tries > MAX_TRIES) {
          console.log('sendReady: max retries exceeded');
          return;
        }

        const peerReady = !!(peerOpenRef.current && peerRef.current && peerRef.current.id);
        const haveStream = !!(localStreamRef.current && localStreamRef.current.active);

        if (!peerReady || !haveStream) {
          setTimeout(() => sendReady(tries + 1), WAIT_MS);
          return;
        }

        try { socketRef.current.emit('peer_ready'); } catch (err) { setTimeout(() => sendReady(tries + 1), WAIT_MS); }
      };

      sendReady();
    });

    socketRef.current.on('start_call', ({ partnerId }) => {
      attemptCall(partnerId);
    });

    socketRef.current.on('preflight', ({ partnerId }) => {
      const doPreflight = () => {
        try {
          if (!peerRef.current) { socketRef.current.emit('preflight_done'); return; }

          let preflightEmitted = false;
          const emitOnce = () => {
            if (preflightEmitted) return;
            preflightEmitted = true;
            try { socketRef.current.emit('preflight_done'); } catch (e) { }
          };

          const conn = peerRef.current.connect(partnerId, { reliable: true });
          conn.on('open', () => {
            try { conn.send({ type: 'preflight', ts: Date.now() }); } catch (e) { }
            setTimeout(() => {
              try { conn.close(); } catch (e) { }
              emitOnce();
            }, 200);
          });
          conn.on('error', () => { emitOnce(); });

          // Fallback timeout
          setTimeout(() => { emitOnce(); }, 1000);
        } catch (e) {
          try { socketRef.current.emit('preflight_done'); } catch (er) { }
        }
      };

      setTimeout(doPreflight, 50);
    });

    socketRef.current.on('peer_not_ready', () => { });

    socketRef.current.on('partner_disconnected', () => {
      showNotification('Stranger disconnected');
      fullCleanup();

      if (autoReconnectRef.current && stepRef.current === 'chat') {
        resetCallState();
        setTimeout(() => {
          setStatus('searching');
          isSearchingRef.current = true;
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
              localStreamRef.current = stream;
              emitFindPartner();
            })
            .catch((err) => {
              setStatus('idle');
              isSearchingRef.current = false;
            });
        }, 1500);
      } else {
        setStatus('idle');
        resetCallState();
        isSearchingRef.current = false;
      }
    });

    socketRef.current.on('receive_message', (message) => {
      setMessages(prev => [...prev, { text: message, type: 'received' }]);
      setUnreadCount(prev => prev + 1);
    });

    // Initialize PeerJS (Production)
    const createPeer = () => {
      const peer = new Peer(undefined, {
        host: 'server-tt1f.onrender.com',
        port: 443,
        path: '/peerjs/myapp',
        secure: true
      });

      peer.on('open', (id) => {
        peerOpenRef.current = true;
        console.log('PeerJS open with id:', id);
      });

      peer.on('call', (call) => {
        callRef.current = call;
        callRetriedRef.current = false;

        const answerWithStream = (stream) => {
          localStreamRef.current = stream;
          call.answer(stream);
          clearStreamTimeout();
          streamTimeoutRef.current = setTimeout(() => {
            abortAndSearch();
          }, 5000);

          call.on('stream', (remoteStream) => {
            clearStreamTimeout();
            if (remoteAudioRef.current) {
              stopRemoteAudio();
              remoteAudioRef.current.srcObject = remoteStream;
              remoteAudioRef.current.autoplay = true;
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1;
              const playPromise = remoteAudioRef.current.play();
              if (playPromise !== undefined) {
                playPromise.catch(() => { });
              }
              establishConnection();
            }
          });

          call.on('error', (err) => {
            console.log('Incoming call error:', err);
          });

          call.on('close', () => {
            clearStreamTimeout();
            stopRemoteAudio();
          });
        };

        if (localStreamRef.current && localStreamRef.current.active) {
          answerWithStream(localStreamRef.current);
        } else {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(answerWithStream)
            .catch((err) => {
              console.log('Failed to get microphone for incoming call:', err);
            });
        }
      });

      // PeerJS disconnected from signaling server — reconnect it
      peer.on('disconnected', () => {
        console.log('PeerJS disconnected from server, reconnecting...');
        peerOpenRef.current = false;
        try { peer.reconnect(); } catch (e) {
          console.log('PeerJS reconnect failed, creating new peer');
          peerRef.current = createPeer();
        }
      });

      peer.on('error', (err) => {
        console.log('PeerJS error:', err.type, err.message);
        // Fatal errors: create a new peer
        if (err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          peerOpenRef.current = false;
          try { peer.destroy(); } catch (e) { }
          setTimeout(() => {
            peerRef.current = createPeer();
          }, 1000);
        }
      });

      peer.on('close', () => {
        peerOpenRef.current = false;
        console.log('PeerJS closed');
      });

      return peer;
    };

    peerRef.current = createPeer();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopTimer();
      clearStreamTimeout();
      if (socketRef.current) socketRef.current.disconnect();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);  // mount-only

  // ──────────── USER ACTIONS ────────────

  const startSearch = () => {
    if (isSearchingRef.current) return; // prevent double-click
    isSearchingRef.current = true;
    setStep('chat');
    setStatus('searching');
    setIsMuted(false);

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        emitFindPartner();
      })
      .catch((err) => {
        showNotification('Microphone access is required!');
        setStep('landing');
        isSearchingRef.current = false;
      });
  };

  const handleStartCall = () => {
    if (isSearchingRef.current) return; // prevent double-click
    isSearchingRef.current = true;
    setStatus('searching');
    setIsMuted(false);

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        emitFindPartner();
      })
      .catch((err) => {
        showNotification('Microphone access is required!');
        setStatus('idle');
        isSearchingRef.current = false;
      });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { text, type: 'sent' }]);
    socketRef.current.emit('send_message', text);
  };

  const handleDisconnect = () => {
    fullCleanup();
    socketRef.current.emit('disconnect_call');
    setStatus('idle');
    resetCallState();
    isSearchingRef.current = false;
  };

  const handleHome = () => {
    fullCleanup();
    socketRef.current.emit('disconnect_call');
    setStep('landing');
    setStatus('idle');
    resetCallState();
    isSearchingRef.current = false;
  };

  const handleSkip = () => {
    fullCleanup();
    socketRef.current.emit('disconnect_call');

    resetCallState();
    setStatus('searching');
    isSearchingRef.current = true;

    // Immediately search for new partner
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        emitFindPartner();
      })
      .catch((err) => {
        showNotification('Microphone access is required!');
        setStatus('idle');
        isSearchingRef.current = false;
      });
  };

  const toggleAutoReconnect = () => {
    const newValue = !autoReconnect;
    setAutoReconnect(newValue);
    localStorage.setItem('autoReconnect', JSON.stringify(newValue));
  };

  const handleChatOpen = () => {
    setUnreadCount(0);
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
