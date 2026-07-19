import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageCircle, Circle, Radio, Phone, Settings,
  Search, Edit, LogOut
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { disconnectSocket } from '../lib/socket';
import { clearAllData } from '../lib/db';
import { clearPrivateKey } from '../lib/crypto';
import { authAPI } from '../lib/api';
import { format } from 'date-fns';
import './Sidebar.css';

const navItems = [
  { path: '/app/chats', icon: MessageCircle, label: 'Chats' },
  { path: '/app/status', icon: Circle, label: 'Status' },
  { path: '/app/channels', icon: Radio, label: 'Channels' },
  { path: '/app/calls', icon: Phone, label: 'Calls' },
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { conversations } = useChatStore();

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('zapply_refresh_token');
    if (refreshToken) {
      await authAPI.logout(refreshToken).catch(() => {});
    }
    await clearAllData();
    clearPrivateKey();
    disconnectSocket();
    logout();
    navigate('/');
  };

  

  return (
    <aside className="sidebar">
      {/* Nav Rail */}
      <nav className="sidebar-nav">
        {/* Logo */}
        <div className="sidebar-logo" onClick={() => navigate('/app/chats')}>
          <div className="sidebar-logo-icon">⚡</div>
        </div>

        {/* Nav Items */}
        <div className="sidebar-nav-items">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const showBadge = item.label === 'Chats' && totalUnread > 0;
            return (
              <motion.button
                key={item.path}
                className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={item.label}
              >
                <item.icon size={22} />
                {showBadge && (
                  <span className="nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
                )}
                {isActive && (
                  <motion.div className="nav-active-indicator" layoutId="navIndicator" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* User avatar + logout */}
        <div className="sidebar-nav-bottom">
          <motion.button
            className="sidebar-nav-btn"
            onClick={() => navigate('/app/settings')}
            whileHover={{ scale: 1.05 }}
            title={user?.displayName}
          >
            {user?.avatar ? (
              <img src={user.avatar} className="avatar avatar-sm" alt="me" />
            ) : (
              <div className="avatar-placeholder avatar-sm">
                {user?.displayName?.charAt(0) || '?'}
              </div>
            )}
          </motion.button>

          <motion.button
            className="sidebar-nav-btn logout-btn"
            onClick={handleLogout}
            whileHover={{ scale: 1.05 }}
            title="Logout"
          >
            <LogOut size={18} />
          </motion.button>
        </div>
      </nav>

      {/* Content Panel */}
      <div className="sidebar-panel">
        <SidebarPanel currentPath={location.pathname} />
      </div>
    </aside>
  );
}

function SidebarPanel({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate();
  const { conversations } = useChatStore();
  const { user } = useAuthStore();

  if (currentPath.startsWith('/app/chats')) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Chats</h2>
          <motion.button
            className="btn btn-icon btn-ghost"
            whileHover={{ scale: 1.1 }}
            onClick={() => navigate('/app/chats')}
            title="New Chat"
          >
            <Edit size={18} />
          </motion.button>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <div className="input-with-icon">
            <Search size={16} className="input-icon" />
            <input
              className="input"
              placeholder="Search chats..."
              style={{ paddingLeft: 40 }}
              readOnly
              onClick={() => navigate('/app/chats')}
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="conversation-list">
          {conversations.length === 0 ? (
            <div className="sidebar-empty">
              <MessageCircle size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>No conversations yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Start a new chat</p>
            </div>
          ) : (
            conversations.map((conv, i) => {
              const peerId = conv.participants.find((p) => p !== user?.id) || '';
              const peerDetails = conv.participantDetails?.[peerId];
              const name = peerDetails?.displayName || conv.name || 'Unknown';
              const avatar = peerDetails?.avatar || null;
              const lastMsg = conv.lastMessage;
              const isOnline = peerDetails?.isOnline;

              return (
                <motion.div
                  key={conv.id}
                  className={`conversation-item ${conv.id === location.pathname.split('/').pop() ? 'active' : ''}`}
                  onClick={() => navigate(`/app/chats/${conv.id}`)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                >
                  <div className="conv-avatar-wrap">
                    <div className="avatar-container">
                      {avatar ? (
                        <img src={avatar} className="avatar avatar-md" alt={name} />
                      ) : (
                        <div className="avatar-placeholder avatar-md">{name.charAt(0)}</div>
                      )}
                      {isOnline && <span className="online-indicator" />}
                    </div>
                  </div>
                  <div className="conv-info">
                    <div className="conv-name-row">
                      <span className="conv-name">{name}</span>
                      {lastMsg && (
                        <span className="conv-time">
                          {format(new Date(lastMsg.timestamp), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <div className="conv-last-row">
                      <span className="conv-last-msg">
                        {lastMsg?.content || 'Start chatting...'}
                      </span>
                      {(conv.unreadCount || 0) > 0 && (
                        <span className="badge">{conv.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (currentPath.startsWith('/app/status')) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Status</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 16px' }}>
          View and share 24h status updates
        </p>
      </div>
    );
  }

  if (currentPath.startsWith('/app/channels')) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Channels</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 16px' }}>
          Discover and follow channels
        </p>
      </div>
    );
  }

  if (currentPath.startsWith('/app/calls')) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Calls</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 16px' }}>
          Recent call history
        </p>
      </div>
    );
  }

  if (currentPath.startsWith('/app/settings')) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Settings</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 16px' }}>
          Manage your account
        </p>
      </div>
    );
  }

  return null;
}
