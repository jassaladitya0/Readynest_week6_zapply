import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MicOff, Mic, VideoOff, Video, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import { useWebRTC } from '../../hooks/useWebRTC';
import './CallUI.css';

export default function ActiveCallUI() {
  const { activeCall, localStream, remoteStream, isMuted, isCameraOff, toggleMute, toggleCamera } = useCallStore();
  const { endCall } = useWebRTC();
  const [duration, setDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef(Date.now());

  // Attach streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!activeCall) return null;

  const isVideo = activeCall.type === 'video';

  return (
    <motion.div
      className="active-call-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {isVideo ? (
        /* Video call */
        <div className="video-call">
          {/* Remote stream (full screen) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
          />
          {!remoteStream && (
            <div className="remote-placeholder">
              <div className="caller-avatar-placeholder large">
                {activeCall.peerDisplayName?.charAt(0)}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12 }}>Connecting...</p>
            </div>
          )}

          {/* Local stream (PiP) */}
          <motion.div
            className="local-video-pip"
            drag
            dragConstraints={{ left: 0, right: 200, top: 0, bottom: 400 }}
          >
            <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
          </motion.div>
        </div>
      ) : (
        /* Audio call */
        <div className="audio-call">
          <div className="call-bg-gradient" />
          <motion.div
            className="audio-avatar-ring"
            animate={{ boxShadow: ['0 0 0 0 rgba(124,58,237,0.4)', '0 0 0 40px rgba(124,58,237,0)', '0 0 0 0 rgba(124,58,237,0)'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {activeCall.peerAvatar ? (
              <img src={activeCall.peerAvatar} className="caller-avatar" alt="peer" />
            ) : (
              <div className="caller-avatar-placeholder large">
                {activeCall.peerDisplayName?.charAt(0)}
              </div>
            )}
          </motion.div>
          <h2 className="caller-name" style={{ marginTop: 24 }}>{activeCall.peerDisplayName}</h2>
          <p className="caller-handle">@{activeCall.peerHandle}</p>
        </div>
      )}

      {/* Call info overlay */}
      <div className="call-info-overlay">
        <div className="call-duration">{formatDuration(duration)}</div>
        <div className="call-status">{activeCall.status === 'outgoing' ? 'Calling...' : 'Connected'}</div>
      </div>

      {/* Controls */}
      <div className="call-controls glass">
        <motion.button
          className={`call-ctrl-btn ${isMuted ? 'active-ctrl' : ''}`}
          onClick={toggleMute}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </motion.button>

        {isVideo && (
          <motion.button
            className={`call-ctrl-btn ${isCameraOff ? 'active-ctrl' : ''}`}
            onClick={toggleCamera}
            whileHover={{ scale: 1.1 }}
            title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
          </motion.button>
        )}

        <motion.button
          className={`call-ctrl-btn ${!isSpeakerOn ? 'active-ctrl' : ''}`}
          onClick={() => setIsSpeakerOn(!isSpeakerOn)}
          whileHover={{ scale: 1.1 }}
        >
          {isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </motion.button>

        <motion.button
          className="call-btn decline-btn"
          onClick={() => endCall(activeCall.peerId, activeCall.peerHandle)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <PhoneOff size={26} />
        </motion.button>
      </div>
    </motion.div>
  );
}
