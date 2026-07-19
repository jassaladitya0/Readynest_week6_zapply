import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Zap, Clock, Radio, Phone, Camera, Lock, ChevronRight } from 'lucide-react';
import './LandingPage.css';

const features = [
  { icon: Lock, title: 'End-to-End Encrypted', desc: 'Every message protected with military-grade encryption' },
  { icon: Clock, title: '24h Auto-Delete', desc: 'Messages vanish automatically — nothing stored on servers' },
  { icon: Phone, title: 'Audio & Video Calls', desc: 'Crystal-clear real-time calls powered by WebRTC' },
  { icon: Camera, title: 'Status Stories', desc: 'Share moments that disappear in 24 hours' },
  { icon: Radio, title: 'Channels', desc: 'Broadcast to your audience with powerful channels' },
  { icon: Shield, title: 'Admin Protected', desc: 'Strong moderation keeps the community safe' },
];

const floatingMessages = [
  { text: 'Hey! 👋', delay: 0, x: '10%', y: '20%' },
  { text: 'Secure & private 🔐', delay: 0.3, x: '65%', y: '15%' },
  { text: 'E2E Encrypted ✅', delay: 0.6, x: '80%', y: '55%' },
  { text: 'Auto-delete in 24h ⏳', delay: 0.9, x: '5%', y: '65%' },
  { text: 'Video call? 📹', delay: 1.2, x: '50%', y: '75%' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Animated background */}
      <div className="landing-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Floating chat bubbles */}
      <div className="floating-messages" aria-hidden="true">
        {floatingMessages.map((msg, i) => (
          <motion.div
            key={i}
            className="floating-bubble"
            style={{ left: msg.x, top: msg.y }}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 0.15, scale: 1, y: [0, -10, 0] }}
            transition={{
              opacity: { delay: msg.delay, duration: 0.5 },
              scale: { delay: msg.delay, duration: 0.5 },
              y: { delay: msg.delay + 0.5, duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            {msg.text}
          </motion.div>
        ))}
      </div>

      {/* Header */}
      <motion.header
        className="landing-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="landing-logo">
          <div className="logo-icon">⚡</div>
          <span className="logo-text gradient-text">Zapply Chat</span>
        </div>
        <div className="landing-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>
      </motion.header>

      {/* Hero */}
      <main className="landing-hero">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Zap size={14} />
            <span>Now with E2E Encryption + 24h Auto-Delete</span>
          </motion.div>

          <h1 className="hero-title">
            The Most <span className="gradient-text">Secure</span> Way to Chat
          </h1>

          <p className="hero-subtitle">
            Real-time messaging, crystal-clear calls, and stories — all end-to-end encrypted.
            No data stored on servers. Your privacy is not negotiable.
          </p>

          <div className="hero-actions">
            <motion.button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/register')}
              whileHover={{ scale: 1.03, boxShadow: '0 8px 40px rgba(124,58,237,0.5)' }}
              whileTap={{ scale: 0.97 }}
            >
              Get Started Free
              <ChevronRight size={18} />
            </motion.button>
            <motion.button
              className="btn btn-secondary btn-lg"
              onClick={() => navigate('/login')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Sign In
            </motion.button>
          </div>

          <p className="hero-note">
            🔒 Zero chat history on servers · 📱 Works as PWA · ⚡ Real-time
          </p>
        </motion.div>

        {/* Mock phone preview */}
        <motion.div
          className="hero-preview"
          initial={{ opacity: 0, x: 60, rotateY: -20 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 0.8, delay: 0.4, type: 'spring' }}
        >
          <div className="phone-mockup">
            <div className="phone-screen">
              <div className="phone-header">
                <div className="phone-avatar">Z</div>
                <div>
                  <div className="phone-name">@zapply_user</div>
                  <div className="phone-status">Online</div>
                </div>
              </div>
              <div className="phone-messages">
                {[
                  { text: 'Hey! Love this app 🔥', sent: false },
                  { text: 'Thanks! It\'s fully encrypted', sent: true },
                  { text: 'Messages auto-delete too?', sent: false },
                  { text: 'Yes! After 24 hours 🗑️', sent: true },
                ].map((msg, i) => (
                  <motion.div
                    key={i}
                    className={`phone-msg ${msg.sent ? 'sent' : 'received'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.15 }}
                  >
                    {msg.text}
                  </motion.div>
                ))}
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Features */}
      <section className="landing-features">
        <motion.h2
          className="features-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Everything you need, <span className="gradient-text">nothing you don't</span>
        </motion.h2>

        <div className="features-grid">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="feature-card glass"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4, boxShadow: '0 8px 40px rgba(124,58,237,0.2)' }}
            >
              <div className="feature-icon">
                <feature.icon size={24} />
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <motion.section
        className="landing-cta"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="cta-card glass-2">
          <h2>Ready to chat securely?</h2>
          <p>Join Zapply Chat — where privacy meets performance</p>
          <motion.button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/register')}
            whileHover={{ scale: 1.05 }}
          >
            Create Your Account
            <ChevronRight size={18} />
          </motion.button>
        </div>
      </motion.section>

      <footer className="landing-footer">
        <span className="gradient-text">Zapply Chat</span> — Built with 🔐 for privacy
      </footer>
    </div>
  );
}
