import { Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import IncomingCallModal from './calls/IncomingCallModal';
import ActiveCallUI from './calls/ActiveCallUI';
import { useCallStore } from '../store/callStore';
import { useChatStore } from '../store/chatStore';
import { useSocket } from '../hooks/useSocket';
import { db } from '../lib/db';
import { startAutoCleanup } from '../lib/db';
import { Toaster } from 'react-hot-toast';
import './AppLayout.css';

export default function AppLayout() {
  const { incomingCall, activeCall } = useCallStore();
  const { setConversations } = useChatStore();
  useSocket();

  useEffect(() => {
    // Load conversations from IndexedDB
    const loadConversations = async () => {
      const convs = await db.conversations.orderBy('updatedAt').reverse().toArray();
      setConversations(convs);
    };
    loadConversations();

    // Start 24h auto-cleanup
    const stopCleanup = startAutoCleanup();

    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Listen for service worker cleanup messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'RUN_CLEANUP') {
          stopCleanup();
          startAutoCleanup();
        }
      });
    }

    return () => stopCleanup();
  }, []);

  return (
    <div className="app-layout">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a2e',
            color: '#f0f0ff',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: '12px',
          },
        }}
      />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="app-main">
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </main>

      {/* Global modals */}
      <AnimatePresence>
        {incomingCall && <IncomingCallModal key="incoming-call" />}
        {activeCall && <ActiveCallUI key="active-call" />}
      </AnimatePresence>
    </div>
  );
}
