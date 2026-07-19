import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Eye, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getActiveStatuses, saveStatus } from '../../lib/db';
import type { Status } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import './StatusPage.css';

const BG_COLORS = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function StatusPage() {
  const { user: me } = useAuthStore();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [myStatuses, setMyStatuses] = useState<Status[]>([]);
  const [viewingStatus, setViewingStatus] = useState<Status | null>(null);
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0]);
  const [viewProgress, setViewProgress] = useState(0);

  useEffect(() => {
    loadStatuses();
  }, []);

  const loadStatuses = async () => {
    const all = await getActiveStatuses();
    setMyStatuses(all.filter((s) => s.userId === me?.id));
    setStatuses(all.filter((s) => s.userId !== me?.id));
  };

  const handleAddStatus = async () => {
    if (!statusText.trim() || !me) return;
    const status: Status = {
      id: uuidv4(),
      userId: me.id,
      userHandle: me.userId,
      userDisplayName: me.displayName,
      userAvatar: me.avatar,
      type: 'text',
      content: statusText,
      backgroundColor: selectedBg,
      views: [],
      timestamp: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
    await saveStatus(status);
    setStatusText('');
    setShowAddStatus(false);
    loadStatuses();
  };

  const handleView = (status: Status) => {
    setViewingStatus(status);
    setViewProgress(0);
    // Auto-advance progress
    const interval = setInterval(() => {
      setViewProgress((p) => {
        if (p >= 100) { clearInterval(interval); setViewingStatus(null); return 0; }
        return p + 2;
      });
    }, 100);
  };

  const timeLeft = (expiresAt: number) => {
    const h = Math.floor((expiresAt - Date.now()) / 3600000);
    return h > 0 ? `${h}h left` : 'Expiring soon';
  };

  return (
    <div className="status-page">
      <div className="status-header">
        <h2 className="page-title">Status</h2>
        <motion.button className="btn btn-primary btn-sm" onClick={() => setShowAddStatus(true)} whileHover={{ scale: 1.05 }}>
          <Plus size={16} /> Add Status
        </motion.button>
      </div>

      {/* My Status */}
      <div className="status-section">
        <h3 className="section-label">My Status</h3>
        {myStatuses.length === 0 ? (
          <div className="my-status-placeholder" onClick={() => setShowAddStatus(true)}>
            <div className="add-status-btn">
              <Plus size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>My status</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tap to add status update</div>
            </div>
          </div>
        ) : (
          <div className="status-grid">
            {myStatuses.map((s) => (
              <motion.div
                key={s.id}
                className="status-card"
                style={{ background: s.backgroundColor || 'var(--gradient)' }}
                onClick={() => handleView(s)}
                whileHover={{ scale: 1.02 }}
              >
                <p className="status-text">{s.content}</p>
                <span className="status-ttl">{timeLeft(s.expiresAt)}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Others' Status */}
      {statuses.length > 0 && (
        <div className="status-section">
          <h3 className="section-label">Recent Updates</h3>
          <div className="status-list">
            {statuses.map((s) => (
              <motion.div
                key={s.id}
                className="status-list-item"
                onClick={() => handleView(s)}
                whileHover={{ backgroundColor: 'var(--bg-hover)' }}
              >
                <div className="status-ring">
                  {s.userAvatar ? (
                    <img src={s.userAvatar} className="avatar avatar-md" alt={s.userDisplayName} />
                  ) : (
                    <div className="avatar-placeholder avatar-md">{s.userDisplayName.charAt(0)}</div>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.userDisplayName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(s.timestamp, 'HH:mm')}</div>
                </div>
                <Eye size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Add Status Modal */}
      <AnimatePresence>
        {showAddStatus && (
          <motion.div className="add-status-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="add-status-card"
              style={{ background: selectedBg }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <button className="status-close-btn" onClick={() => setShowAddStatus(false)}><X size={20} /></button>
              <textarea
                className="status-textarea"
                placeholder="Type a status..."
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                maxLength={200}
                autoFocus
              />
              <div className="bg-picker">
                {BG_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`bg-swatch ${selectedBg === color ? 'selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => setSelectedBg(color)}
                  />
                ))}
              </div>
              <motion.button className="btn btn-secondary" onClick={handleAddStatus} whileHover={{ scale: 1.05 }}>
                Share Status
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Viewer */}
      <AnimatePresence>
        {viewingStatus && (
          <motion.div
            className="status-viewer"
            style={{ background: viewingStatus.backgroundColor || 'var(--bg-tertiary)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingStatus(null)}
          >
            <div className="status-progress-bar">
              <motion.div className="status-progress-fill" style={{ width: `${viewProgress}%` }} />
            </div>
            <div className="status-viewer-header">
              <div className="avatar-placeholder avatar-sm">{viewingStatus.userDisplayName.charAt(0)}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{viewingStatus.userDisplayName}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{format(viewingStatus.timestamp, 'HH:mm')}</div>
              </div>
              <button className="status-close-btn" style={{ marginLeft: 'auto' }} onClick={() => setViewingStatus(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="status-viewer-content">
              <p className="status-viewer-text">{viewingStatus.content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
