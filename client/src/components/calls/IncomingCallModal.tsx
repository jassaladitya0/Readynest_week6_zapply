import { motion } from 'framer-motion';
import { PhoneOff, Mic, Video } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useEffect, useState } from 'react';
import { rejectCall } from '../../lib/socket';
import './CallUI.css';

export default function IncomingCallModal() {
  const { incomingCall, setIncomingCall } = useCallStore();
  const { answerIncomingCall } = useWebRTC();
  const [ringing, setRinging] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setRinging((r) => !r), 600);
    return () => clearInterval(timer);
  }, []);

  if (!incomingCall) return null;

  const handleAccept = () => {
    answerIncomingCall(incomingCall);
  };

  const handleDecline = () => {
    rejectCall(incomingCall.from);
    setIncomingCall(null);
  };

  return (
    <motion.div
      className="incoming-call-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background blur */}
      <div className="call-bg-blur" />

      <motion.div
        className="incoming-call-card glass-2"
        initial={{ scale: 0.8, y: -50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.8, y: -50, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* Ring animation */}
        <div className="ring-container">
          <motion.div
            className="ring-outer"
            animate={{ scale: ringing ? 1.15 : 1, opacity: ringing ? 0.2 : 0.4 }}
            transition={{ duration: 0.6 }}
          />
          <motion.div
            className="ring-middle"
            animate={{ scale: ringing ? 1.08 : 1, opacity: ringing ? 0.35 : 0.5 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          />
          <div className="caller-avatar-wrap">
            {incomingCall.fromAvatar ? (
              <img src={incomingCall.fromAvatar} className="caller-avatar" alt="caller" />
            ) : (
              <div className="caller-avatar-placeholder">
                {incomingCall.fromDisplayName?.charAt(0) || '?'}
              </div>
            )}
          </div>
        </div>

        <div className="caller-info">
          <h2 className="caller-name">{incomingCall.fromDisplayName}</h2>
          <p className="caller-handle">@{incomingCall.fromHandle}</p>
          <p className="call-type-label">
            {incomingCall.callType === 'video' ? '📹' : '📞'} Incoming {incomingCall.callType} call
          </p>
        </div>

        <div className="call-actions">
          <motion.button
            className="call-btn decline-btn"
            onClick={handleDecline}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <PhoneOff size={28} />
          </motion.button>

          <motion.button
            className="call-btn accept-btn"
            onClick={handleAccept}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={{ boxShadow: ringing ? '0 0 30px rgba(16,185,129,0.6)' : '0 0 15px rgba(16,185,129,0.3)' }}
          >
            {incomingCall.callType === 'video' ? <Video size={28} /> : <Mic size={28} />}
          </motion.button>
        </div>

        <p className="swipe-hint">Tap green to answer · Red to decline</p>
      </motion.div>
    </motion.div>
  );
}
