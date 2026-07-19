import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from './store/authStore';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import AppLayout from './components/AppLayout';
import ChatsPage from './pages/chats/ChatsPage';
import ChatWindow from './pages/chats/ChatWindow';
import StatusPage from './pages/status/StatusPage';
import ChannelsPage from './pages/channels/ChannelsPage';
import CallsPage from './pages/calls/CallsPage';
import SettingsPage from './pages/settings/SettingsPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import { useSocket } from './hooks/useSocket';
import IncomingCallModal from './components/calls/IncomingCallModal';
import { useCallStore } from './store/callStore';

function App() {
  const { isAuthenticated } = useAuthStore();
  const { incomingCall } = useCallStore();
  useSocket(); // Setup socket globally if auth

  return (
    <Router>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased overflow-hidden selection:bg-purple-500/30">
        <AnimatePresence mode="wait">
          {incomingCall && <IncomingCallModal key="incoming-call" />}
        </AnimatePresence>

        <Routes>
          <Route path="/" element={!isAuthenticated ? <LandingPage /> : <Navigate to="/app/chats" />} />
          <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/app/chats" />} />
          <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/app/chats" />} />
          
          <Route path="/app" element={isAuthenticated ? <AppLayout /> : <Navigate to="/login" />}>
            <Route index element={<Navigate to="/app/chats" />} />
            <Route path="chats" element={<ChatsPage />} />
            <Route path="chats/:conversationId" element={<ChatWindow />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="channels" element={<ChannelsPage />} />
            <Route path="calls" element={<CallsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="/admin-zapply-secret" element={<AdminLoginPage />} />
          <Route path="/admin-zapply-secret/dashboard" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
