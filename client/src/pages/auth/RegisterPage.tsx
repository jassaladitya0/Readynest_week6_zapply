import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, User, Lock, AtSign, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { authAPI } from '../../lib/api';
import { generateKeyPair, setPrivateKey } from '../../lib/crypto';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import './Auth.css';

const step1Schema = z.object({
  phone: z.string().min(8, 'Enter a valid phone number').regex(/^\+?[1-9]\d{7,14}$/, 'Include country code e.g. +923001234567'),
});
const step3Schema = z.object({
  userId: z.string().min(3).max(30).regex(/^[a-z0-9_.]+$/, 'Only lowercase letters, numbers, _ and .'),
  displayName: z.string().min(2, 'At least 2 characters').max(50),
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords must match', path: ['confirmPassword'] });

type Step1Data = z.infer<typeof step1Schema>;
type Step3Data = z.infer<typeof step3Schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [userIdAvailable, setUserIdAvailable] = useState<boolean | null>(null);
  const [checkingUserId, setCheckingUserId] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const userIdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema) });

  // Step 1: Send OTP
  const handleSendOTP = async (data: Step1Data) => {
    setIsLoading(true);
    try {
      const res = await authAPI.sendOTP(data.phone, 'register');
      setPhone(data.phone);
      toast.success('OTP sent! Check your phone (or server console in dev mode)');
      // Show OTP in toast for dev
      if (res.message?.includes('check server console')) {
        toast(`Dev OTP: ${res.message}`, { duration: 30000, icon: '🔑' });
      }
      setStep(2);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP input handling
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
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = () => {
    const code = otp.join('');
    if (code.length < 6) {
      toast.error('Enter the complete 6-digit OTP');
      return;
    }
    setStep(3);
  };

  // UserId availability check (debounced)
  const checkUserId = (value: string) => {
    clearTimeout(userIdTimer.current);
    setUserIdAvailable(null);
    if (value.length < 3) return;
    setCheckingUserId(true);
    userIdTimer.current = setTimeout(async () => {
      try {
        const res = await authAPI.checkAvailability(value.toLowerCase());
        setUserIdAvailable(res.userIdAvailable);
      } catch { setUserIdAvailable(null); }
      finally { setCheckingUserId(false); }
    }, 500);
  };

  // Step 3: Register
  const handleRegister = async (data: Step3Data) => {
    if (userIdAvailable === false) {
      toast.error('UserID is not available');
      return;
    }
    setIsLoading(true);
    try {
      const { publicKey, privateKey } = generateKeyPair();
      setPrivateKey(privateKey);

      const res = await authAPI.register({
        phone,
        userId: data.userId.toLowerCase(),
        displayName: data.displayName,
        password: data.password,
        otp: otp.join(''),
        publicKey,
      });

      login(res.user, res.accessToken, res.refreshToken);
      toast.success('Welcome to Zapply! 🎉');
      navigate('/app/chats');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
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
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <span className="gradient-text" style={{ fontSize: 20, fontWeight: 800 }}>Zapply Chat</span>
        </div>

        {/* Progress */}
        <div className="auth-steps">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`auth-step ${step >= s ? 'active' : ''} ${step > s ? 'done' : ''}`}>
              <div className="step-dot">{step > s ? <CheckCircle size={12} /> : s}</div>
              <span className="step-label">
                {s === 1 ? 'Phone' : s === 2 ? 'Verify' : 'Details'}
              </span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Phone */}
          {step === 1 && (
            <motion.div key="step1" className="auth-step-content" {...stepAnim}>
              <h2 className="auth-title">Create Account</h2>
              <p className="auth-subtitle">Enter your phone number to get started</p>
              <form onSubmit={form1.handleSubmit(handleSendOTP)} className="auth-form">
                <div className="input-group">
                  <label className="input-label">Phone Number</label>
                  <div className="input-with-icon">
                    <Phone size={16} className="input-icon" />
                    <input
                      {...form1.register('phone')}
                      className="input"
                      placeholder="+923001234567"
                      style={{ paddingLeft: 44 }}
                      autoFocus
                    />
                  </div>
                  {form1.formState.errors.phone && (
                    <span className="input-error">{form1.formState.errors.phone.message}</span>
                  )}
                </div>
                <motion.button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? <span className="spinner" /> : <>Send OTP <ArrowRight size={18} /></>}
                </motion.button>
              </form>
              <p className="auth-footer-text">
                Already have an account? <Link to="/login">Sign In</Link>
              </p>
            </motion.div>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <motion.div key="step2" className="auth-step-content" {...stepAnim}>
              <h2 className="auth-title">Verify Phone</h2>
              <p className="auth-subtitle">Enter the 6-digit code sent to {phone}</p>
              <div className="otp-inputs" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
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
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={handleVerifyOTP}
                whileHover={{ scale: 1.02 }}
              >
                Verify OTP <ArrowRight size={18} />
              </motion.button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={14} /> Change number
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%' }}
                onClick={() => handleSendOTP({ phone })}
              >
                Resend OTP
              </button>
            </motion.div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <motion.div key="step3" className="auth-step-content" {...stepAnim}>
              <h2 className="auth-title">Your Profile</h2>
              <p className="auth-subtitle">Set up your Zapply identity</p>
              <form onSubmit={form3.handleSubmit(handleRegister)} className="auth-form">
                <div className="input-group">
                  <label className="input-label">@UserID</label>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <AtSign size={16} className="input-icon" />
                    <input
                      {...form3.register('userId', {
                        onChange: (e) => checkUserId(e.target.value),
                      })}
                      className={`input ${userIdAvailable === false ? 'input-invalid' : userIdAvailable === true ? 'input-valid' : ''}`}
                      placeholder="zapply_user"
                      style={{ paddingLeft: 44 }}
                      autoFocus
                    />
                    {checkingUserId && (
                      <span className="spinner" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    )}
                    {!checkingUserId && userIdAvailable === true && (
                      <CheckCircle size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--success)' }} />
                    )}
                  </div>
                  {userIdAvailable === false && <span className="input-error">This @userId is taken</span>}
                  {form3.formState.errors.userId && (
                    <span className="input-error">{form3.formState.errors.userId.message}</span>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Display Name</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input {...form3.register('displayName')} className="input" placeholder="Your Name" style={{ paddingLeft: 44 }} />
                  </div>
                  {form3.formState.errors.displayName && (
                    <span className="input-error">{form3.formState.errors.displayName.message}</span>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Password</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input {...form3.register('password')} className="input" type="password" placeholder="Min 8 characters" style={{ paddingLeft: 44 }} />
                  </div>
                  {form3.formState.errors.password && (
                    <span className="input-error">{form3.formState.errors.password.message}</span>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Confirm Password</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input {...form3.register('confirmPassword')} className="input" type="password" placeholder="Repeat password" style={{ paddingLeft: 44 }} />
                  </div>
                  {form3.formState.errors.confirmPassword && (
                    <span className="input-error">{form3.formState.errors.confirmPassword.message}</span>
                  )}
                </div>

                <motion.button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={isLoading || userIdAvailable === false}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? <span className="spinner" /> : <>Create Account 🎉</>}
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

const stepAnim = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
  transition: { duration: 0.25 },
};
