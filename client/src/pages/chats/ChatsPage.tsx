import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, MessageCircle } from 'lucide-react';
import { usersAPI } from '../../lib/api';
import { db, getOrCreateConversation } from '../../lib/db';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../types';
import './ChatsPage.css';

export default function ChatsPage() {
  const navigate = useNavigate();
  const { user: me } = useAuthStore();
  const { conversations, addConversation, setConversations } = useChatStore();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Load conversations from DB
    db.conversations.orderBy('updatedAt').reverse().toArray().then(setConversations);
  }, []);

  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await usersAPI.search(q);
        setSearchResults(results);
      } catch { /* ignore */ }
      finally { setIsSearching(false); }
    }, 400);
  };

  const startConversation = async (user: User) => {
    if (!me) return;
    const conv = await getOrCreateConversation(me.id, user.id, {
      id: user.id,
      userId: user.userId,
      displayName: user.displayName,
      avatar: user.avatar,
      publicKey: user.publicKey,
      isOnline: user.isOnline,
    });
    addConversation(conv);
    setSearch('');
    setSearchResults([]);
    setShowNewChat(false);
    navigate(`/app/chats/${conv.id}`);
  };



  return (
    <div className="chats-page">
      <div className="chats-content">
        {/* Header */}
        <div className="chats-header">
          <div className="search-bar">
            <div className="input-with-icon">
              <Search size={16} className="input-icon" />
              <input
                className="input"
                placeholder="Search or start a new chat..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                style={{ paddingLeft: 40, borderRadius: 999 }}
              />
            </div>
          </div>
          <motion.button
            className="btn btn-primary btn-icon"
            onClick={() => setShowNewChat(!showNewChat)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="New Chat"
          >
            <Plus size={20} />
          </motion.button>
        </div>

        {/* Search results */}
        <AnimatePresence>
          {(searchResults.length > 0 || isSearching) && (
            <motion.div
              className="search-results"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {isSearching && <div className="search-loading"><span className="spinner" /> Searching...</div>}
              {searchResults.map((user) => (
                <motion.div
                  key={user.id}
                  className="search-result-item"
                  onClick={() => startConversation(user)}
                  whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                >
                  <div className="avatar-container">
                    {user.avatar ? (
                      <img src={user.avatar} className="avatar avatar-md" alt={user.displayName} />
                    ) : (
                      <div className="avatar-placeholder avatar-md">{user.displayName.charAt(0)}</div>
                    )}
                    {user.isOnline && <span className="online-indicator" />}
                  </div>
                  <div>
                    <div className="result-name">{user.displayName}</div>
                    <div className="result-handle">@{user.userId}</div>
                  </div>
                  <MessageCircle size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {conversations.length === 0 && !search && (
          <motion.div
            className="chats-empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ fontSize: 80, marginBottom: 20 }}>💬</div>
            <h3>No chats yet</h3>
            <p>Search for a user to start chatting</p>
            <motion.button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => document.querySelector<HTMLInputElement>('.search-bar input')?.focus()}
              whileHover={{ scale: 1.05 }}
            >
              <Plus size={16} /> Start a Chat
            </motion.button>
          </motion.div>
        )}

        {/* Chat list (shown in sidebar, main area shows empty or selected) */}
        <AnimatePresence>
          {!search && conversations.length > 0 && (
            <motion.div
              className="chat-welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div style={{ fontSize: 60 }}>👈</div>
              <h3>Select a conversation</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 260, textAlign: 'center' }}>
                Choose a chat from the sidebar or search for someone new
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
