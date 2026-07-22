import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, KeyRound, Info } from 'lucide-react';
import { authAPI } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import './Auth.css';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string>('123456');

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const formatPhone = (p: string) => {
    let cleaned = p.trim().replace(/[\s\-\(\)]/g, '');
    if (!cleaned.startsWith('+')) {
      cleaned = '+91' + cleaned.replace(/^0+/, '');
    }
    return cleaned;
  };

  // Step 1: Submit Identifier & Password
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      return toast.error('Please enter both UserID/Phone and Password');
    }

    setIsLoading(true);
    try {
      toast('Signing in...', { icon: '⚡', duration: 2500 });
      const res = await authAPI.login(cleanId, password);

      // If user requires 2FA / OTP verification
      if (res.requiresOTP) {
        const targetPhone = formatPhone(res.phone);
        setPhone(targetPhone);

        const otpRes = await authAPI.sendOTP(targetPhone, 'login');
        const code = otpRes.otp || (otpRes.message?.match(/\d{6}/)?.[0]) || '123456';
        setDemoOtp(code);

        toast(`🔑 Your Verification OTP is: ${code}`, { duration: 30000 });
        setStep(2);
      } else {
        // Direct successful login
        login(res.user, res.accessToken, res.refreshToken);
        toast.success(`Welcome back, ${res.user.displayName || res.user.userId}! 👋`);
        navigate('/app/chats');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      toast.error(err.response?.data?.error || err.message || 'Login failed. Check credentials or try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Handling
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // Step 2: Submit 6-digit OTP
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      return toast.error('Please enter the full 6-digit OTP code');
    }

    setIsLoading(true);
    try {
      const res = await authAPI.login(identifier, password, code);
      login(res.user, res.accessToken, res.refreshToken);
      toast.success(`Welcome back, ${res.user.displayName || res.user.userId}! 👋`);
      navigate('/app/chats');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid OTP verification code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Background Lighting Orbs */}
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
      </div>

      <motion.div
        className="auth-card glass-2"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Brand Header */}
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <span className="gradient-text" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Zapply Chat
          </span>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Identifier & Password */}
          {step === 1 && (
            <motion.div key="step1" className="auth-step-content" {...pageVariants}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h2 className="auth-title">Welcome Back</h2>
                <p className="auth-subtitle">Sign in to access your secure messages</p>
              </div>

              <form onSubmit={handleStep1Submit} className="auth-form">
                {/* UserID / Phone Input */}
                <div className="input-group">
                  <label className="input-label">User ID or Phone Number</label>
                  <div className="input-with-icon">
                    <User size={18} className="input-icon" style={{ color: 'var(--accent-primary)' }} />
                    <input
                      className="input"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="@username or +919876543210"
                      style={{ paddingLeft: 46 }}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="input-group">
                  <label className="input-label">Password</label>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <Lock size={18} className="input-icon" style={{ color: 'var(--accent-primary)' }} />
                    <input
                      className="input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      style={{ paddingLeft: 46, paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      Sign In <ArrowRight size={18} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Card Footer */}
              <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
                Don't have an account?{' '}
                <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
                  Create Account
                </Link>
              </div>

              {/* End-to-End Encrypted Security Badge */}
              <div
                style={{
                  marginTop: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                <ShieldCheck size={14} style={{ color: 'var(--accent-primary)' }} />
                <span>Protected by TweetNaCl End-to-End Encryption</span>
              </div>
            </motion.div>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <motion.div key="step2" className="auth-step-content" {...pageVariants}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'rgba(124, 58, 237, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <KeyRound size={24} />
                </div>
                <h2 className="auth-title">Security Verification</h2>
                <p className="auth-subtitle">
                  Enter the 6-digit OTP code for <strong style={{ color: 'var(--text-primary)' }}>{phone}</strong>
                </p>
              </div>

              {/* On-Screen OTP Instruction Card */}
              <div
                style={{
                  background: 'rgba(124, 58, 237, 0.12)',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 20,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Info size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 2 }}>
                    🔑 Demo OTP Code: <span style={{ color: '#a78bfa', letterSpacing: 2 }}>{demoOtp}</span>
                  </strong>
                  Check the on-screen popup alert or type <strong style={{ color: '#fff' }}>{demoOtp}</strong> to verify instantly.
                </div>
              </div>

              <form onSubmit={handleStep2Submit} className="auth-form">
                <div className="otp-inputs" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      className="otp-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <motion.button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', marginTop: 16 }}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? <span className="spinner" /> : <>Verify & Complete Login <ArrowRight size={18} /></>}
                </motion.button>
              </form>

              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', marginTop: 12, color: 'var(--text-secondary)' }}
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
