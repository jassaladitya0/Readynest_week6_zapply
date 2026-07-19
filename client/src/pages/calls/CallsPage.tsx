import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Video, PhoneIncoming, PhoneMissed, PhoneOutgoing, Trash2 } from 'lucide-react';
import { getCalls, db } from '../../lib/db';
import { useWebRTC } from '../../hooks/useWebRTC';
import type { Call } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const { startCall } = useWebRTC();

  useEffect(() => {
    getCalls().then(setCalls);
  }, []);

  const handleClearHistory = async () => {
    if (!confirm('Clear all call history? (Local only)')) return;
    await db.calls.clear();
    setCalls([]);
    toast.success('Call history cleared');
  };

  const getCallIcon = (call: Call) => {
    if (call.status === 'missed') return <PhoneMissed size={18} style={{ color: 'var(--danger)' }} />;
    if (call.status === 'outgoing' || call.status === 'ended') {
      return call.type === 'video' ? <Video size={18} style={{ color: 'var(--success)' }} /> : <PhoneOutgoing size={18} style={{ color: 'var(--success)' }} />;
    }
    return <PhoneIncoming size={18} style={{ color: 'var(--cyan)' }} />;
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return 'Not connected';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: 24, height: '100vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Calls</h2>
        {calls.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={handleClearHistory}>
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      {calls.length === 0 ? (
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--text-secondary)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Phone size={60} style={{ opacity: 0.2 }} />
          <h3>No call history</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Call history is stored locally and auto-deleted with messages</p>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {calls.map((call, i) => (
            <motion.div
              key={call.id}
              className="glass"
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, cursor: 'pointer' }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ backgroundColor: 'var(--bg-hover)' }}
            >
              <div className="avatar-placeholder avatar-md">{call.peerDisplayName?.charAt(0) || '?'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{call.peerDisplayName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {getCallIcon(call)}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {call.type === 'video' ? 'Video' : 'Audio'} · {formatDuration(call.duration)}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                <div>{format(new Date(call.startTime), 'MMM d')}</div>
                <div>{format(new Date(call.startTime), 'HH:mm')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <motion.button
                  className="btn btn-icon btn-ghost btn-sm"
                  title="Audio call"
                  onClick={() => startCall(call.peerId, call.peerHandle, call.peerDisplayName, call.peerAvatar, 'audio')}
                  whileHover={{ scale: 1.1 }}
                >
                  <Phone size={16} />
                </motion.button>
                <motion.button
                  className="btn btn-icon btn-ghost btn-sm"
                  title="Video call"
                  onClick={() => startCall(call.peerId, call.peerHandle, call.peerDisplayName, call.peerAvatar, 'video')}
                  whileHover={{ scale: 1.1 }}
                >
                  <Video size={16} />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
