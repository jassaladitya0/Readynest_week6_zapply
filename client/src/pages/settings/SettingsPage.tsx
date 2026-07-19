import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, User, Lock, Shield, Bell, Info, LogOut, ChevronRight, Check } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usersAPI, authAPI } from '../../lib/api';
import { clearAllData } from '../../lib/db';
import { clearPrivateKey } from '../../lib/crypto';
import { disconnectSocket } from '../../lib/socket';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './SettingsPage.css';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [isChangingPwd, setIsChangingPwd] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) return toast.error('Display name cannot be empty');
    setIsSaving(true);
    try {
      const updated = await usersAPI.updateMe({ displayName, bio });
      updateUser(updated);
      toast.success('Profile updated!');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const updated = await usersAPI.updateMe({ avatar: base64 });
        updateUser(updated);
        toast.success('Avatar updated!');
      } catch {
        toast.error('Failed to update avatar');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async () => {
    if (newPwd !== confirmPwd) return toast.error('Passwords do not match');
    if (newPwd.length < 8) return toast.error('Password must be at least 8 characters');
    setIsChangingPwd(true);
    try {
      await usersAPI.changePassword(currentPwd, newPwd);
      toast.success('Password changed! Please log in again.');
      handleLogout();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('zapply_refresh_token');
    if (refreshToken) await authAPI.logout(refreshToken).catch(() => {});
    await clearAllData();
    clearPrivateKey();
    disconnectSocket();
    logout();
    navigate('/');
  };

  const handleUpdatePrivacy = async (key: string, value: string) => {
    try {
      const updated = await usersAPI.updateMe({
        privacySettings: { ...user?.privacySettings, [key]: value }
      });
      updateUser(updated);
      toast.success('Privacy setting updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const sections = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2 className="page-title">Settings</h2>
      </div>

      {/* Profile card */}
      <div className="profile-card glass">
        <div className="profile-avatar-section">
          <div className="avatar-upload-wrap" onClick={() => fileInputRef.current?.click()}>
            {user?.avatar ? (
              <img src={user.avatar} className="avatar avatar-xl" alt="avatar" />
            ) : (
              <div className="avatar-placeholder avatar-xl">{user?.displayName?.charAt(0)}</div>
            )}
            <div className="avatar-overlay"><Camera size={20} /></div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.displayName}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{user?.userId}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Display Name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
          </div>
          <div className="input-group">
            <label className="input-label">Bio</label>
            <input className="input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Add a bio..." maxLength={160} />
          </div>
          <motion.button
            className="btn btn-primary"
            onClick={handleSaveProfile}
            disabled={isSaving}
            whileHover={{ scale: 1.02 }}
          >
            {isSaving ? <span className="spinner" /> : <><Check size={16} /> Save Profile</>}
          </motion.button>
        </div>
      </div>

      {/* Settings nav */}
      <div className="settings-nav">
        {sections.map((s) => (
          <motion.button
            key={s.id}
            className={`settings-nav-item ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
            whileHover={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <div className="settings-nav-icon">
              <s.icon size={18} />
            </div>
            <span>{s.label}</span>
            <ChevronRight
              size={16}
              style={{
                marginLeft: 'auto',
                color: 'var(--text-muted)',
                transform: activeSection === s.id ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.2s'
              }}
            />
          </motion.button>
        ))}
      </div>

      {/* Expanded sections */}
      <AnimatePresence>
        {activeSection === 'security' && (
          <motion.div className="settings-expand glass" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Change Password</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Current Password</label>
                <input className="input" type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">New Password</label>
                <input className="input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Confirm New Password</label>
                <input className="input" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={handleChangePassword} disabled={isChangingPwd}>
                {isChangingPwd ? <span className="spinner" /> : 'Change Password'}
              </button>
            </div>
          </motion.div>
        )}

        {activeSection === 'privacy' && (
          <motion.div className="settings-expand glass" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Privacy Settings</h3>
            {[
              { key: 'lastSeen', label: 'Last Seen' },
              { key: 'profilePhoto', label: 'Profile Photo' },
              { key: 'status', label: 'Status' },
            ].map((setting) => (
              <div key={setting.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: 14 }}>{setting.label}</span>
                <select
                  className="input"
                  style={{ width: 140 }}
                  value={(user?.privacySettings as any)?.[setting.key] || 'everyone'}
                  onChange={(e) => handleUpdatePrivacy(setting.key, e.target.value)}
                >
                  <option value="everyone">Everyone</option>
                  <option value="contacts">Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
            ))}
          </motion.div>
        )}

        {activeSection === 'about' && (
          <motion.div className="settings-expand glass" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
              <div>⚡ <strong className="gradient-text">Zapply Chat</strong> v1.0.0</div>
              <div>🔐 End-to-end encrypted</div>
              <div>🗑️ Messages auto-delete after 24h</div>
              <div>📱 No chat data stored on servers</div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Built with security and privacy in mind.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout */}
      <div className="settings-footer">
        <motion.button
          className="btn btn-danger"
          style={{ width: '100%' }}
          onClick={() => {
            if (confirm('Are you sure you want to logout?')) handleLogout();
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut size={16} /> Logout
        </motion.button>
      </div>
    </div>
  );
}
