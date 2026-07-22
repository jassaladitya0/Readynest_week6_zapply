import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Phone, User, Lock, AtSign, ArrowRight, ArrowLeft, CheckCircle, Eye, EyeOff, ShieldCheck, KeyRound, Sparkles, Check, X } from 'lucide-react';
import { authAPI } from '../../lib/api';
import { generateKeyPair, setPrivateKey } from '../../lib/crypto';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import './Auth.css';

import { isFirebaseConfigured, initRecaptcha, sendFirebasePhoneOTP } from '../../lib/firebase';
import type { ConfirmationResult } from 'firebase/auth';

// Validation Schemas
const step1Schema = z.object({
  phone: z.string().min(8, 'Enter a valid phone number (e.g. 9876543210 or +919876543210)'),
});

const step3Schema = z.object({
  userId: z.string().min(3, 'Minimum 3 characters').max(30).regex(/^[a-z0-9_.]+$/, 'Only lowercase letters, numbers, _ and .'),
  displayName: z.string().min(2, 'At least 2 characters').max(50),
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords must match', path: ['confirmPassword'] });

type Step1Data = z.infer<typeof step1Schema>;
type Step3Data = z.infer<typeof step3Schema>;

const stepAnim = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // UserID availability state
  const [userIdAvailable, setUserIdAvailable] = useState<boolean | null>(null);
  const [checkingUserId, setCheckingUserId] = useState(false);
  const userIdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Firebase Auth Confirmation
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<ConfirmationResult | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema) });

  const formatPhone = (p: string) => {
    let cleaned = p.trim().replace(/[\s\-\(\)]/g, '');
    if (!cleaned.startsWith('+')) {
      cleaned = '+91' + cleaned.replace(/^0+/, '');
    }
    return cleaned;
  };

  // Step 1: Send OTP via Firebase (or fallback to backend)
  const handleSendOTP = async (data: Step1Data) => {
    setIsLoading(true);
    const targetPhone = formatPhone(data.phone);

    try {
      if (isFirebaseConfigured) {
        try {
          const verifier = initRecaptcha('recaptcha-container');
          if (verifier) {
            toast('Dispatching SMS via Firebase...', { icon: '📱', duration: 2500 });
            const confirmation = await sendFirebasePhoneOTP(targetPhone, verifier);
            setFirebaseConfirmation(confirmation);
            setPhone(targetPhone);
            toast.success('SMS OTP sent via Firebase! Check your phone 📱');
            setStep(2);
            setIsLoading(false);
            return;
          }
        } catch (fbErr: any) {
          console.warn('Firebase Phone Auth notice:', fbErr);
          toast.error(`Firebase Notice: ${fbErr.code || fbErr.message || 'Error'}. Using fallback OTP...`, { duration: 4500 });
        }
      }

      // Fallback to Zapply backend API OTP
      toast('Connecting to authentication server...', { icon: '⚡', duration: 3000 });
      const res = await authAPI.sendOTP(targetPhone, 'register');
      setPhone(targetPhone);
      const code = res.otp || (res.message?.match(/\d{6}/)?.[0]);
      if (code) {
        toast(`🔑 Your Verification OTP is: ${code}`, { duration: 30000 });
      } else {
        toast.success(res.message || 'Verification OTP sent to your phone');
      }
      setStep(2);
    } catch (err: any) {
      console.error('Send OTP error:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to send OTP. Please check your phone number and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Inputs handling
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

  // Step 2: Verify 6-digit OTP Code
  const handleVerifyOTP = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      toast.error('Please enter the complete 6-digit OTP code');
      return;
    }

    if (firebaseConfirmation) {
      setIsLoading(true);
      try {
        await firebaseConfirmation.confirm(code);
        toast.success('Phone verified via Firebase! ✅');
        setStep(3);
      } catch (err: any) {
        console.error('Firebase OTP verify error:', err);
        toast.error('Invalid Firebase OTP code. Please check and re-enter.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Direct transition for backend OTP verification on step 3 completion
    setStep(3);
  };

  // Check UserID Availability in Real-Time
  const checkUserIdAvailability = (value: string) => {
    clearTimeout(userIdTimer.current);
    setUserIdAvailable(null);
    if (value.length < 3) return;

    setCheckingUserId(true);
    userIdTimer.current = setTimeout(async () => {
      try {
        const res = await authAPI.checkAvailability(value.toLowerCase());
        setUserIdAvailable(res.userIdAvailable);
      } catch {
        setUserIdAvailable(null);
      } finally {
        setCheckingUserId(false);
      }
    }, 400);
  };

  // Step 3: Complete Account Registration
  const handleRegisterSubmit = async (data: Step3Data) => {
    if (userIdAvailable === false) {
      toast.error('User ID is already taken. Please choose another username.');
      return;
    }

    setIsLoading(true);
    try {
      toast('Generating TweetNaCl E2E Encryption Keys...', { icon: '🔐', duration: 2500 });
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
      toast.success('Account created successfully! Welcome to Zapply Chat 🎉');
      navigate('/app/chats');
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div id="recaptcha-container"></div>

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

        {/* Step Progress Tracker */}
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
          {/* STEP 1: Phone Input & Firebase OTP */}
          {step === 1 && (
            <motion.div key="step1" className="auth-step-content" {...stepAnim}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h2 className="auth-title">Create Account</h2>
                <p className="auth-subtitle">Enter your phone number to get started</p>
              </div>

              <form onSubmit={form1.handleSubmit(handleSendOTP)} className="auth-form">
                <div className="input-group">
                  <label className="input-label">Phone Number</label>
                  <div className="input-with-icon">
                    <Phone size={18} className="input-icon" style={{ color: 'var(--accent-primary)' }} />
                    <input
                      {...form1.register('phone')}
                      className="input"
                      placeholder="9876543210 or +919876543210"
                      style={{ paddingLeft: 46 }}
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
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? <span className="spinner" /> : <>Send OTP <ArrowRight size={18} /></>}
                </motion.button>
              </form>

              <div style={{ marginTop: 20, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
                  Sign In
                </Link>
              </div>
            </motion.div>
          )}

          {/* STEP 2: 6-Digit OTP Verification */}
          {step === 2 && (
            <motion.div key="step2" className="auth-step-content" {...stepAnim}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
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
                <h2 className="auth-title">Verify Phone Number</h2>
                <p className="auth-subtitle">
                  Enter the 6-digit code sent to <strong style={{ color: 'var(--text-primary)' }}>{phone}</strong>
                </p>
              </div>

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
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 20 }}
                onClick={handleVerifyOTP}
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? <span className="spinner" /> : <>Verify OTP <ArrowRight size={18} /></>}
              </motion.button>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, color: 'var(--text-secondary)' }}
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={14} /> Change Number
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, color: 'var(--accent-primary)' }}
                  onClick={() => handleSendOTP({ phone })}
                >
                  Resend Code
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Profile & Encryption Credentials */}
          {step === 3 && (
            <motion.div key="step3" className="auth-step-content" {...stepAnim}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h2 className="auth-title">Set Up Your Profile</h2>
                <p className="auth-subtitle">Create your Zapply identity & encryption key</p>
              </div>

              <form onSubmit={form3.handleSubmit(handleRegisterSubmit)} className="auth-form">
                {/* Display Name */}
                <div className="input-group">
                  <label className="input-label">Display Name</label>
                  <div className="input-with-icon">
                    <User size={18} className="input-icon" style={{ color: 'var(--accent-primary)' }} />
                    <input
                      {...form3.register('displayName')}
                      className="input"
                      placeholder="Aditya Jassal"
                      style={{ paddingLeft: 46 }}
                      autoFocus
                    />
                  </div>
                  {form3.formState.errors.displayName && (
                    <span className="input-error">{form3.formState.errors.displayName.message}</span>
                  )}
                </div>

                {/* Username (@userId) */}
                <div className="input-group">
                  <label className="input-label">Username (@userId)</label>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <AtSign size={18} className="input-icon" style={{ color: 'var(--accent-primary)' }} />
                    <input
                      {...form3.register('userId')}
                      className="input"
                      placeholder="adityajassal"
                      style={{ paddingLeft: 46, paddingRight: 44 }}
                      onChange={(e) => {
                        form3.setValue('userId', e.target.value);
                        checkUserIdAvailability(e.target.value);
                      }}
                    />
                    {checkingUserId && (
                      <span className="spinner" style={{ position: 'absolute', right: 14, top: '35%', width: 16, height: 16 }} />
                    )}
                    {!checkingUserId && userIdAvailable === true && (
                      <Check size={18} style={{ position: 'absolute', right: 14, top: '35%', color: '#10b981' }} />
                    )}
                    {!checkingUserId && userIdAvailable === false && (
                      <X size={18} style={{ position: 'absolute', right: 14, top: '35%', color: '#ef4444' }} />
                    )}
                  </div>
                  {form3.formState.errors.userId && (
                    <span className="input-error">{form3.formState.errors.userId.message}</span>
                  )}
                  {userIdAvailable === false && (
                    <span className="input-error">Username is already taken</span>
                  )}
                </div>

                {/* Password */}
                <div className="input-group">
                  <label className="input-label">Password</label>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <Lock size={18} className="input-icon" style={{ color: 'var(--accent-primary)' }} />
                    <input
                      {...form3.register('password')}
                      className="input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
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
                  {form3.formState.errors.password && (
                    <span className="input-error">{form3.formState.errors.password.message}</span>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="input-group">
                  <label className="input-label">Confirm Password</label>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <Lock size={18} className="input-icon" style={{ color: 'var(--accent-primary)' }} />
                    <input
                      {...form3.register('confirmPassword')}
                      className="input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      style={{ paddingLeft: 46, paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {form3.formState.errors.confirmPassword && (
                    <span className="input-error">{form3.formState.errors.confirmPassword.message}</span>
                  )}
                </div>

                {/* Submit Register Button */}
                <motion.button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', marginTop: 12 }}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isLoading ? <span className="spinner" /> : <>Complete Registration <Sparkles size={18} /></>}
                </motion.button>
              </form>

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
                <span>TweetNaCl E2E Public Key Pair will be auto-generated</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
