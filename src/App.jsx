import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'peerjs';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './components/Landing';
import VoiceChat from './components/VoiceChat';
import Notification from './components/Notification';
import Preferences from './components/Preferences';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import './App.css';

//This for prod
// SOCKET URL selection (Prod vs Dev)
const SOCKET_URL = import.meta.env.PROD 
  ? 'https://server-tt1f.onrender.com' 
  : 'http://localhost:3001';

function AppContent() {
  const [step, setStep] = useState('landing');
  const [status, setStatus] = useState('idle');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [notification, setNotification] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [partnerInfo, setPartnerInfo] = useState(null); // Stores matched partner country and flag
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [partnerMuted, setPartnerMuted] = useState(false);

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

  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('randomic_prefs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Safety: filter out any items with JSX labels (objects)
        const cleanCountry = (arr) => Array.isArray(arr) ? arr.filter(i => typeof i.label !== 'object') : [];
        return {
          targetCountry: cleanCountry(parsed.targetCountry || []),
          blockedCountry: cleanCountry(parsed.blockedCountry || []),
          ownCountry: parsed.ownCountry || 'Unknown',
          ownCountryCode: parsed.ownCountryCode || '',
          userFlag: parsed.userFlag || '', // emoji fallback
          userGender: parsed.userGender || 'Male',
          targetGender: parsed.targetGender || 'Anyone'
        };
      } catch (e) {
        console.error("Prefs load error:", e);
      }
    }
    return {
      targetCountry: [], // Matches Globally
      blockedCountry: [],
      ownCountry: 'Unknown',
      ownCountryCode: '',
      userFlag: '',
      userGender: 'Male',
      targetGender: 'Anyone'
    };
  });
  const currentFilterRef = useRef(preferences);

  useEffect(() => {
    localStorage.setItem('randomic_prefs', JSON.stringify(preferences));
    currentFilterRef.current = {
      ...preferences,
      targetCountry: (preferences.targetCountry || []).map(o => o.value),
      blockedCountry: (preferences.blockedCountry || []).map(o => o.value)
    };
  }, [preferences]);

  useEffect(() => {
    const fetchGeo = async () => {
      try {
        // Fetch via our own backend proxy to bypass browser CORS
        // Safety: ensure no double slash
        const baseUrl = SOCKET_URL.endsWith('/') ? SOCKET_URL.slice(0, -1) : SOCKET_URL;
        const res = await fetch(`${baseUrl}/api/geo`);
        const data = await res.json();
        if (data.success && data.country) {
          return { cname: data.country, cca2: (data.country_code || '').toLowerCase() };
        }
      } catch (err) {
        console.error("Backend Geo Proxy failed:", err);
      }
      return null;
    };

    fetchGeo().then(geo => {
      if (geo) {
        const { cname, cca2 } = geo;
        fetch('https://restcountries.com/v3.1/alpha/' + cca2)
          .then(r => r.json())
          .then(cData => {
            const flag = cData && cData[0] ? cData[0].flag : '';
            setPreferences(p => ({ ...p, ownCountry: cname, userFlag: flag, ownCountryCode: cca2 }));
          })
          .catch(() => setPreferences(p => ({ ...p, ownCountry: cname, ownCountryCode: cca2 })));
      }
    });
  }, [SOCKET_URL]);

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
    setPartnerMuted(false);
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
      socketRef.current.emit('find_partner', {
        peerId: peerRef.current.id,
        targetCountry: currentFilterRef.current.targetCountry,
        blockedCountry: currentFilterRef.current.blockedCountry,
        ownCountry: currentFilterRef.current.ownCountry,
        ownCountryCode: currentFilterRef.current.ownCountryCode,
        userFlag: currentFilterRef.current.userFlag,
        userGender: currentFilterRef.current.userGender,
        targetGender: currentFilterRef.current.targetGender
      });
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

    socketRef.current.on('match_found', ({ partnerId, partnerCountry, partnerCountryCode, partnerFlag, partnerGender, initiator }) => {
      // Keep UI in 'searching' state and wait for remote stream before marking connected
      setStatus('searching');
      resetCallState();
      setPartnerMuted(false);
      if (partnerCountry || partnerGender) {
        setPartnerInfo({ country: partnerCountry || 'Unknown', countryCode: partnerCountryCode || '', flag: partnerFlag || '', gender: partnerGender || 'Unknown' });
      }

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
      setPartnerInfo(null);

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

    socketRef.current.on('partner_mute_status', (isMuted) => {
      setPartnerMuted(isMuted);
    });

    // Initialize PeerJS (Production/Dev dynamic)
    const createPeer = () => {
      let peerHost = 'localhost';
      let peerPort = 3001;
      let peerSecure = false;

      if (import.meta.env.PROD) {
        // Extract host from Render URL: 'https://server-tt1f.onrender.com' -> 'server-tt1f.onrender.com'
        peerHost = SOCKET_URL.replace('https://', '').replace('http://', '').split(':')[0].split('/')[0];
        peerPort = 443;
        peerSecure = true;
      }

      const peer = new Peer(undefined, {
        host: peerHost,
        port: peerPort,
        path: '/peerjs/myapp',
        secure: peerSecure
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
        // Don't reconnect if we are already trying to establish a new one
        setTimeout(() => {
          if (!peer.destroyed && !peerOpenRef.current) {
            try { peer.reconnect(); } catch (e) {
              console.log('PeerJS reconnect failed');
            }
          }
        }, 1000);
      });

      peer.on('error', (err) => {
        console.log('PeerJS error:', err.type, err.message);
        // Fatal errors: create a new peer
        if (err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          peerOpenRef.current = false;
          try { peer.destroy(); } catch (e) { }
          setTimeout(() => {
            if (!peerOpenRef.current) {
              peerRef.current = createPeer();
            }
          }, 1500);
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

  // Initialize and start searching
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
        const newMuteState = !audioTrack.enabled;
        setIsMuted(newMuteState);
        socketRef.current.emit('mute_status', newMuteState);
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
    setPartnerInfo(null);
    resetCallState();
    isSearchingRef.current = false;
  };

  const handleHome = () => {
    fullCleanup();
    socketRef.current.emit('disconnect_call');
    setStep('landing');
    setStatus('idle');
    setPartnerInfo(null);
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

      <Navbar onlineUsers={onlineUsers} theme={theme} onToggleTheme={toggleTheme} onOpenSettings={() => setSettingsOpen(true)} />

      <Preferences preferences={preferences} setPreferences={setPreferences} isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <Routes>
        <Route path="/" element={
          step === 'landing' ? (
            <Landing onStart={startSearch} onOpenSettings={() => setSettingsOpen(true)} />
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
              partnerInfo={partnerInfo}
              partnerMuted={partnerMuted}
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
