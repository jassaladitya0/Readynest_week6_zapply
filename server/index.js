require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// MongoDB connection configuration
let mongoURI = process.env.MONGODB_URI;

// Clean up any potential formatting issues from environment variables (e.g. quotes or leading/trailing spaces)
if (mongoURI) {
  mongoURI = mongoURI.trim();
  if ((mongoURI.startsWith('"') && mongoURI.endsWith('"')) || 
      (mongoURI.startsWith("'") && mongoURI.endsWith("'"))) {
    mongoURI = mongoURI.slice(1, -1).trim();
  }
}

// Ensure MONGODB_URI is provided in production environment
if (!mongoURI) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ MongoDB connection failed: MONGODB_URI environment variable is missing.');
    console.error('💡 In production, you must configure a MongoDB database (e.g. MongoDB Atlas) and set the MONGODB_URI environment variable in your Render service settings dashboard.');
    process.exit(1);
  }
  // In development, default to local MongoDB
  mongoURI = 'mongodb://localhost:27017/zapply';
}

mongoose.connect(mongoURI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Zapply server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    
    // Help debug issues with MONGODB_URI formatting
    const rawUri = process.env.MONGODB_URI;
    if (rawUri) {
      let maskedUri = rawUri;
      try {
        const urlObj = new URL(rawUri);
        if (urlObj.password) urlObj.password = '****';
        maskedUri = urlObj.toString();
      } catch (e) {
        // Fallback simple masking
        maskedUri = rawUri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
      }
      console.log(`💡 Attempted to connect to MONGODB_URI: "${maskedUri}" (length: ${rawUri.length})`);
      if (rawUri.startsWith('"') || rawUri.endsWith('"') || rawUri.startsWith("'") || rawUri.endsWith("'")) {
        console.log('💡 WARNING: Your MONGODB_URI environment variable contains leading or trailing quotes. Please remove them in your environment settings.');
      }
      if (rawUri.includes(' ')) {
        console.log('💡 WARNING: Your MONGODB_URI contains spaces. Please check for accidental spaces.');
      }
      if (rawUri.endsWith(';')) {
        console.log('💡 WARNING: Your MONGODB_URI ends with a semicolon. Please remove it.');
      }
      if (!rawUri.startsWith('mongodb://') && !rawUri.startsWith('mongodb+srv://')) {
        console.log('💡 WARNING: Your MONGODB_URI must start with "mongodb://" or "mongodb+srv://".');
      }
    } else {
      console.log('💡 MONGODB_URI environment variable is not defined.');
    }
    
    console.log('💡 Make sure MongoDB is running. Start it with: mongod');
    process.exit(1);
  });

// Socket.IO handler
socketHandler(io);

module.exports = { app, io };
