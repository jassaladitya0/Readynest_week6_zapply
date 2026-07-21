import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Lock, ArrowRight } from 'lucide-react';
import { authAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import './Auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return toast.error('Fill in all fields');
    setIsLoading(true);
    try {
      const res = await authAPI.login(identifier, password);
      if (res.requiresOTP) {
        setPhone(res.phone);
        // Send OTP
        const otpRes = await authAPI.sendOTP(res.phone, 'login');
        const code = otpRes.otp || (otpRes.message?.match(/\d{6}/)?.[0]);
        if (code) {
          toast(`🔑 Your OTP is: ${code}`, { duration: 30000 });
        } else {
          toast.success(otpRes.message || 'OTP sent to your phone');
        }
        setStep(2);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split('')); otpRefs.current[5]?.focus(); }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) return toast.error('Enter the full 6-digit code');
    setIsLoading(true);
    try {
      const res = await authAPI.login(identifier, password, code);
      login(res.user, res.accessToken, res.refreshToken);
      toast.success(`Welcome back, ${res.user.displayName}! 👋`);
      navigate('/app/chats');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
      </div>

      <motion.div
        className="auth-card glass-2"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <span className="gradient-text" style={{ fontSize: 20, fontWeight: 800 }}>Zapply Chat</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" className="auth-step-content" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="auth-title">Welcome Back</h2>
              <p className="auth-subtitle">Sign in to your account</p>
              <form onSubmit={handleStep1} className="auth-form">
                <div className="input-group">
                  <label className="input-label">Phone or @UserID</label>
                  <div className="input-with-icon">
                    <Phone size={16} className="input-icon" />
                    <input
                      className="input"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="+923001234567 or @zapply_user"
                      style={{ paddingLeft: 44 }}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Password</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input
                      className="input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      style={{ paddingLeft: 44 }}
                    />
                  </div>
                </div>
                <motion.button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? <span className="spinner" /> : <>Continue <ArrowRight size={18} /></>}
                </motion.button>
              </form>
              <p className="auth-footer-text">
                No account? <Link to="/register">Create one</Link>
              </p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" className="auth-step-content" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="auth-title">Verify Identity</h2>
              <p className="auth-subtitle">Enter the OTP sent to {phone}</p>
              <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="otp-inputs" onPaste={handleOtpPaste}>
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      className="otp-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
                      }}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                <motion.button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                >
                  {isLoading ? <span className="spinner" /> : 'Sign In →'}
                </motion.button>
              </form>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => setStep(1)}>
                ← Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
