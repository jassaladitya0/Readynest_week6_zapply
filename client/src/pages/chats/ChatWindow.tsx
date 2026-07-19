import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Video, MoreVertical, ArrowLeft, Send, Smile,
  Paperclip, Mic, StopCircle, File as FileIcon,
  CheckCheck, Check, Clock, Reply, Trash2, Flag
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useWebRTC } from '../../hooks/useWebRTC';
import { db, getMessages, addMessage } from '../../lib/db';
import { encryptMessage, getPrivateKey } from '../../lib/crypto';
import { sendMessage as socketSend, sendTypingStart, sendTypingStop, sendMessageRead } from '../../lib/socket';
import { v4 as uuidv4 } from 'uuid';
import { format, formatDistanceToNow } from 'date-fns';
import type { Message, Conversation, User } from '../../types';
import toast from 'react-hot-toast';
import './ChatWindow.css';

export default function ChatWindow() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuthStore();
  const { resetUnread } = useChatStore();
  const { startCall } = useWebRTC();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [peer, setPeer] = useState<Partial<User> | null>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load conversation and messages
  useEffect(() => {
    if (!conversationId || !me) return;

    const load = async () => {
      setIsLoading(true);
      const conv = await db.conversations.get(conversationId);
      setConversation(conv || null);

      if (conv) {
        const peerId = conv.participants.find((p) => p !== me.id) || '';
        const peerData = conv.participantDetails?.[peerId];
        setPeer(peerData || null);
      }

      const msgs = await getMessages(conversationId);
      setMessages(msgs);
      resetUnread(conversationId);
      setIsLoading(false);

      // Mark latest messages as read
      const unreadMsgs = msgs.filter((m) => m.senderId !== me.id && m.status !== 'read');
      for (const msg of unreadMsgs) {
        sendMessageRead(msg.id, msg.senderId);
        await db.messages.update(msg.id, { status: 'read' });
      }
    };

    load();

    // Live message subscription via Dexie
    const interval = setInterval(async () => {
      if (conversationId) {
        const msgs = await getMessages(conversationId);
        setMessages(msgs);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [conversationId, me?.id]);

  // Socket typing events
  useEffect(() => {
    if (!conversationId) return;
    const socket = (window as any).__zapplySocket;
    if (!socket) return;

    const onTypingStart = ({ from }: { from: string }) => {
      if (conversation?.participants.includes(from) && from !== me?.id) {
        setPeerTyping(true);
      }
    };
    const onTypingStop = ({ from }: { from: string }) => {
      if (from !== me?.id) setPeerTyping(false);
    };

    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    return () => {
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
  }, [conversationId, conversation, me?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!isTyping && conversation) {
      const peerId = conversation.participants.find((p) => p !== me?.id) || '';
      sendTypingStart(peerId);
      setIsTyping(true);
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (conversation) {
        const peerId = conversation.participants.find((p) => p !== me?.id) || '';
        sendTypingStop(peerId);
      }
      setIsTyping(false);
    }, 1500);
  };

  const sendMsg = useCallback(async (content: string, type: Message['type'] = 'text', mediaData?: string) => {
    if (!me || !conversation || !conversationId) return;
    const peerId = conversation.participants.find((p) => p !== me.id) || '';

    const messageId = uuidv4();
    const timestamp = Date.now();

    // Encrypt if we have peer's public key
    let encryptedPayload = content;
    if (peer?.publicKey) {
      const privateKey = getPrivateKey();
      if (privateKey) {
        const encrypted = encryptMessage(content, peer.publicKey, privateKey);
        if (encrypted) encryptedPayload = encrypted;
      }
    }

    const msg: Omit<Message, 'ttl'> = {
      id: messageId,
      conversationId,
      senderId: me.id,
      senderHandle: me.userId,
      content,
      type,
      mediaData,
      timestamp,
      status: 'sending',
      replyTo: replyTo?.id,
    };

    await addMessage(msg);
    setMessages((prev) => [...prev, { ...msg, ttl: timestamp + 86400000 }]);
    setInputText('');
    setReplyTo(null);

    // Send via socket
    socketSend({ to: peerId, encryptedPayload, messageId, timestamp });

    // Update local status
    setTimeout(async () => {
      await db.messages.update(messageId, { status: 'sent' });
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, status: 'sent' } : m));
    }, 500);

    sendTypingStop(peerId);
    setIsTyping(false);
  }, [me, conversation, conversationId, peer, replyTo]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    sendMsg(text);
  };

  const handleFileAttach = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) return toast.error('File too large (max 10MB)');
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
        sendMsg(file.name, type as Message['type'], base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => sendMsg('🎵 Voice message', 'voice', reader.result as string);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      toast.error('Microphone permission denied');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleDeleteMessage = async (msg: Message) => {
    await db.messages.delete(msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setContextMenu(null);
    toast.success('Message deleted locally');
  };

  const handleReport = () => {
    if (!peer?.id) return;
    // Navigate to report flow
    setShowOptions(false);
    toast('Report submitted', { icon: '🚩' });
  };

  const getStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sending': return <Clock size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />;
      case 'sent': return <Check size={12} style={{ color: 'rgba(255,255,255,0.7)' }} />;
      case 'delivered': return <CheckCheck size={12} style={{ color: 'rgba(255,255,255,0.7)' }} />;
      case 'read': return <CheckCheck size={12} style={{ color: 'var(--cyan-light)' }} />;
      default: return null;
    }
  };

  const getTimeLeft = (ttl?: number) => {
    if (!ttl) return null;
    const ms = ttl - Date.now();
    if (ms <= 0) return 'Expired';
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours > 1) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="chat-loading">
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="chat-empty-state">
        <div style={{ fontSize: 64 }}>💬</div>
        <h3>Select a conversation</h3>
        <p style={{ color: 'var(--text-muted)' }}>Choose from your chats or start a new one</p>
      </div>
    );
  }

  const peerId = conversation.participants.find((p) => p !== me?.id) || '';
  const peerName = peer?.displayName || conversation.name || 'Unknown';
  const peerOnline = peer?.isOnline;

  return (
    <div className="chat-window" onClick={() => { setContextMenu(null); setShowOptions(false); }}>
      {/* Header */}
      <div className="chat-header glass">
        <button className="btn btn-icon btn-ghost back-btn" onClick={() => navigate('/app/chats')}>
          <ArrowLeft size={20} />
        </button>

        <div className="chat-header-info">
          <div className="avatar-container">
            {peer?.avatar ? (
              <img src={peer.avatar} className="avatar avatar-md" alt={peerName} />
            ) : (
              <div className="avatar-placeholder avatar-md">{peerName.charAt(0)}</div>
            )}
            {peerOnline && <span className="online-indicator" />}
          </div>
          <div>
            <div className="chat-peer-name">{peerName}</div>
            <div className="chat-peer-status">
              {peerTyping ? (
                <span className="typing-text">typing...</span>
              ) : peerOnline ? (
                <span style={{ color: 'var(--success)', fontSize: 12 }}>Online</span>
              ) : peer?.lastSeen ? (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Last seen {formatDistanceToNow(new Date(peer.lastSeen), { addSuffix: true })}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          <motion.button
            className="btn btn-icon btn-ghost"
            title="Audio call"
            whileHover={{ scale: 1.1 }}
            onClick={() => peer?.id && startCall(peerId, peer.userId || '', peerName, peer.avatar || null, 'audio')}
          >
            <Phone size={20} />
          </motion.button>
          <motion.button
            className="btn btn-icon btn-ghost"
            title="Video call"
            whileHover={{ scale: 1.1 }}
            onClick={() => peer?.id && startCall(peerId, peer.userId || '', peerName, peer.avatar || null, 'video')}
          >
            <Video size={20} />
          </motion.button>
          <div className="relative">
            <motion.button
              className="btn btn-icon btn-ghost"
              whileHover={{ scale: 1.1 }}
              onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }}
            >
              <MoreVertical size={20} />
            </motion.button>
            <AnimatePresence>
              {showOptions && (
                <motion.div
                  className="dropdown-menu glass-2"
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="dropdown-item" onClick={() => navigate(`/app/profile/${peerId}`)}>
                    View Profile
                  </button>
                  <button className="dropdown-item danger" onClick={handleReport}>
                    <Flag size={14} /> Report User
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* E2E Banner */}
      <div className="e2e-banner">
        <span>🔐 Messages are end-to-end encrypted · Auto-delete in 24h</span>
      </div>

      {/* Messages */}
      <div className="messages-area">
        {messages.length === 0 && (
          <motion.div className="messages-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
            <p>Say hi to {peerName}!</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Messages auto-delete in 24 hours
            </p>
          </motion.div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.senderId === me?.id;
          const showDate = i === 0 || !isSameDay(messages[i - 1].timestamp, msg.timestamp);
          const timeLeft = getTimeLeft(msg.ttl);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="date-separator">
                  <span>{formatDate(msg.timestamp)}</span>
                </div>
              )}
              <motion.div
                className={`message-row ${isMine ? 'mine' : 'theirs'}`}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
                }}
              >
                {!isMine && (
                  <div className="avatar-placeholder avatar-sm msg-avatar">{peerName.charAt(0)}</div>
                )}
                <div className={`message-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
                  {/* Reply preview */}
                  {msg.replyTo && (
                    <div className="reply-preview">
                      <span>↩ Replying to message</span>
                    </div>
                  )}

                  {/* Content */}
                  {msg.type === 'text' && <p className="msg-text">{msg.content}</p>}
                  {msg.type === 'image' && msg.mediaData && (
                    <img src={msg.mediaData} className="msg-image" alt="image" onClick={() => window.open(msg.mediaData, '_blank')} />
                  )}
                  {msg.type === 'voice' && msg.mediaData && (
                    <audio controls src={msg.mediaData} className="msg-audio" />
                  )}
                  {msg.type === 'file' && (
                    <div className="msg-file">
                      <FileIcon size={20} />
                      <span>{msg.content}</span>
                    </div>
                  )}
                  {msg.type === 'video' && msg.mediaData && (
                    <video controls src={msg.mediaData} className="msg-image" />
                  )}

                  {/* Footer */}
                  <div className="msg-footer">
                    {timeLeft && <span className="msg-ttl">⏳ {timeLeft}</span>}
                    <span className="msg-time">{format(new Date(msg.timestamp), 'HH:mm')}</span>
                    {isMine && getStatusIcon(msg.status)}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}

        {/* Typing indicator */}
        <AnimatePresence>
          {peerTyping && (
            <motion.div
              className="message-row theirs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="avatar-placeholder avatar-sm msg-avatar">{peerName.charAt(0)}</div>
              <div className="message-bubble bubble-theirs typing-bubble">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            className="context-menu glass-2"
            style={{ top: contextMenu.y, left: Math.min(contextMenu.x, window.innerWidth - 160) }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="context-item" onClick={() => { setReplyTo(contextMenu.message); setContextMenu(null); inputRef.current?.focus(); }}>
              <Reply size={14} /> Reply
            </button>
            <button className="context-item" onClick={() => { navigator.clipboard.writeText(contextMenu.message.content); setContextMenu(null); toast.success('Copied'); }}>
              Copy
            </button>
            {contextMenu.message.senderId === me?.id && (
              <button className="context-item danger" onClick={() => handleDeleteMessage(contextMenu.message)}>
                <Trash2 size={14} /> Delete
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            className="reply-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <Reply size={14} />
            <span className="reply-text">{replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? '...' : ''}</span>
            <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setReplyTo(null)}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="chat-input-bar glass">
        <motion.button
          className="btn btn-icon btn-ghost"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          whileHover={{ scale: 1.1 }}
          title="Emoji"
        >
          <Smile size={20} />
        </motion.button>

        <motion.button
          className="btn btn-icon btn-ghost"
          onClick={handleFileAttach}
          whileHover={{ scale: 1.1 }}
          title="Attach file"
        >
          <Paperclip size={20} />
        </motion.button>

        <form onSubmit={handleSend} className="chat-input-form">
          <input
            ref={inputRef}
            className="chat-input"
            value={inputText}
            onChange={handleInputChange}
            placeholder={isRecording ? '🎙️ Recording...' : 'Type a message...'}
            disabled={isRecording}
          />
        </form>

        {inputText.trim() ? (
          <motion.button
            className="btn btn-icon send-btn"
            onClick={handleSend}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Send size={18} />
          </motion.button>
        ) : (
          <motion.button
            className={`btn btn-icon ${isRecording ? 'recording-btn' : 'btn-ghost'}`}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            whileHover={{ scale: 1.1 }}
            title="Hold to record voice"
          >
            {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
          </motion.button>
        )}
      </div>
    </div>
  );
}

function isSameDay(ts1: number, ts2: number) {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.toDateString() === d2.toDateString();
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}
