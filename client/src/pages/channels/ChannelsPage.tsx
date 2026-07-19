import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import type { Channel } from '../../types';

const SEED_CHANNELS: Channel[] = [
  { id: 'ch1', name: 'Zapply Updates', description: 'Official Zapply Chat updates and announcements', avatar: null, ownerId: 'system', ownerHandle: 'zapply', subscriberCount: 12400, posts: [], createdAt: Date.now() - 86400000 },
  { id: 'ch2', name: 'Tech News', description: 'Latest in technology, AI and software development', avatar: null, ownerId: 'system', ownerHandle: 'technews', subscriberCount: 8900, posts: [], createdAt: Date.now() - 86400000 * 3 },
  { id: 'ch3', name: 'Privacy & Security', description: 'Tips and news about digital privacy and security', avatar: null, ownerId: 'system', ownerHandle: 'privacytips', subscriberCount: 5600, posts: [], createdAt: Date.now() - 86400000 * 7 },
];

export default function ChannelsPage() {
  const [channels] = useState<Channel[]>(SEED_CHANNELS);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const toggle = (id: string) => {
    setSubscribed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (activeChannel) {
    return (
      <div style={{ padding: 24, height: '100vh', overflowY: 'auto' }}>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }} onClick={() => setActiveChannel(null)}>
          ← Back
        </button>
        <div className="glass" style={{ borderRadius: 20, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="avatar-placeholder avatar-lg" style={{ fontSize: 28 }}>📡</div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{activeChannel.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{activeChannel.description}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {activeChannel.subscriberCount.toLocaleString()} subscribers
              </p>
            </div>
            <motion.button
              className={`btn btn-sm ${subscribed.has(activeChannel.id) ? 'btn-secondary' : 'btn-primary'}`}
              style={{ marginLeft: 'auto' }}
              onClick={() => toggle(activeChannel.id)}
              whileHover={{ scale: 1.05 }}
            >
              {subscribed.has(activeChannel.id) ? 'Following' : 'Follow'}
            </motion.button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="glass" style={{ borderRadius: 16, padding: 20 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Welcome to <strong>{activeChannel.name}</strong>! Stay tuned for updates.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Posted just now</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, height: '100vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Channels</h2>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Discover Channels
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {channels.map((ch, i) => (
          <motion.div
            key={ch.id}
            className="glass"
            style={{ borderRadius: 16, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ backgroundColor: 'var(--bg-hover)' }}
            onClick={() => setActiveChannel(ch)}
          >
            <div className="avatar-placeholder avatar-md" style={{ fontSize: 22 }}>📡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ch.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ch.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Users size={11} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ch.subscriberCount.toLocaleString()}</span>
              </div>
            </div>
            <motion.button
              className={`btn btn-sm ${subscribed.has(ch.id) ? 'btn-secondary' : 'btn-primary'}`}
              onClick={(e) => { e.stopPropagation(); toggle(ch.id); }}
              whileHover={{ scale: 1.05 }}
            >
              {subscribed.has(ch.id) ? '✓ Following' : 'Follow'}
            </motion.button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
