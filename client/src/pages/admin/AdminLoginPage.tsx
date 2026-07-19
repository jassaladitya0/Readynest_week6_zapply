import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, Key, Eye, EyeOff } from 'lucide-react';
import { adminAPI } from '../../lib/api';
import toast from 'react-hot-toast';
import './AdminPages.css';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await adminAPI.login(username, password, secretKey);
      sessionStorage.setItem('zapply_admin_token', res.adminToken);
      sessionStorage.setItem('zapply_admin_expires', String(Date.now() + res.expiresIn * 1000));
      toast.success('Admin access granted');
      navigate('/admin-zapply-secret/dashboard');
    } catch (err: any) {
      // Deliberate generic error
      setTimeout(() => toast.error('Access denied'), 1000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-bg" />
      <motion.div
        className="admin-login-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="admin-login-header">
          <div className="admin-shield-icon">
            <Shield size={32} />
          </div>
          <h1>Admin Access</h1>
          <p>Zapply Chat Control Panel</p>
          <div className="admin-warning">
            ⚠️ This panel is for authorized administrators only.<br />
            All actions are logged and audited.
          </div>
        </div>

        <form onSubmit={handleLogin} className="admin-login-form">
          <div className="input-group">
            <label className="input-label">Username</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                className="input admin-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin username"
                style={{ paddingLeft: 44 }}
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                className="input admin-input"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                style={{ paddingLeft: 44, paddingRight: 44 }}
                autoComplete="off"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Secret Key</label>
            <div className="input-with-icon">
              <Key size={16} className="input-icon" />
              <input
                className="input admin-input"
                type={showKey ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Admin secret key"
                style={{ paddingLeft: 44, paddingRight: 44 }}
                autoComplete="off"
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <motion.button
            type="submit"
            className="btn admin-login-btn"
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? <span className="spinner" /> : <><Shield size={16} /> Access Admin Panel</>}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
