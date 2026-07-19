const { verifyAccessToken } = require('../utils/auth');
const User = require('../models/User');

// Map of socket ID -> user ID and vice versa
const socketToUser = new Map();
const userToSocket = new Map();

module.exports = (io) => {
  // Socket auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      if (!decoded) return next(new Error('Invalid token'));

      const user = await User.findById(decoded.userId).select('_id userId displayName avatar isDeleted isSuspended');
      if (!user || user.isDeleted || user.isSuspendedNow()) {
        return next(new Error('Account not accessible'));
      }

      socket.userId = user._id.toString();
      socket.userHandle = user.userId;
      socket.userData = user;
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`✅ User connected: @${socket.userHandle} (${socket.id})`);

    // Register user
    socketToUser.set(socket.id, userId);
    userToSocket.set(userId, socket.id);

    // Update online status
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

    // Notify contacts of online status
    socket.broadcast.emit('user:status', { userId, isOnline: true });

    // Join user's personal room
    socket.join(`user:${userId}`);

    // =====================
    // CHAT EVENTS
    // =====================

    // Client sends a message (encrypted payload)
    socket.on('message:send', async (data) => {
      try {
        const { to, encryptedPayload, messageId, timestamp } = data;
        // to = target userId
        // encryptedPayload = already E2E encrypted by client
        // We only relay - never store!

        const targetSocketId = userToSocket.get(to);
        const deliveryData = {
          from: userId,
          fromHandle: socket.userHandle,
          messageId,
          encryptedPayload,
          timestamp,
        };

        if (targetSocketId) {
          // Online: deliver immediately
          io.to(targetSocketId).emit('message:receive', deliveryData);
          socket.emit('message:delivered', { messageId, to });
        } else {
          // Offline: store delivery intent (not message content!)
          // We just notify sender of offline status
          socket.emit('message:offline', { messageId, to });
        }
      } catch (err) {
        socket.emit('error', { message: 'Message delivery failed' });
      }
    });

    // Message read receipt
    socket.on('message:read', ({ messageId, to }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('message:read', { messageId, by: userId });
      }
    });

    // Typing indicator
    socket.on('typing:start', ({ to }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('typing:start', { from: userId, fromHandle: socket.userHandle });
      }
    });

    socket.on('typing:stop', ({ to }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('typing:stop', { from: userId });
      }
    });

    // =====================
    // GROUP EVENTS
    // =====================

    socket.on('group:join', ({ groupId }) => {
      socket.join(`group:${groupId}`);
    });

    socket.on('group:leave', ({ groupId }) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on('group:message', (data) => {
      const { groupId, encryptedPayload, messageId, timestamp } = data;
      // Relay to group room (not stored on server)
      socket.to(`group:${groupId}`).emit('group:message', {
        from: userId,
        fromHandle: socket.userHandle,
        groupId,
        messageId,
        encryptedPayload,
        timestamp,
      });
    });

    // =====================
    // WEBRTC SIGNALING
    // =====================

    socket.on('call:offer', ({ to, offer, callType }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:incoming', {
          from: userId,
          fromHandle: socket.userHandle,
          fromAvatar: socket.userData?.avatar,
          fromDisplayName: socket.userData?.displayName,
          offer,
          callType, // 'audio' | 'video'
        });
      } else {
        socket.emit('call:unavailable', { to });
      }
    });

    socket.on('call:answer', ({ to, answer }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:answer', { from: userId, answer });
      }
    });

    socket.on('call:ice-candidate', ({ to, candidate }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ice-candidate', { from: userId, candidate });
      }
    });

    socket.on('call:reject', ({ to }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:rejected', { from: userId });
      }
    });

    socket.on('call:end', ({ to }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ended', { from: userId });
      }
    });

    socket.on('call:busy', ({ to }) => {
      const targetSocketId = userToSocket.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:busy', { from: userId });
      }
    });

    // =====================
    // STATUS EVENTS
    // =====================

    // Notify contacts when user posts a status
    socket.on('status:posted', ({ contacts }) => {
      contacts.forEach((contactId) => {
        const targetSocketId = userToSocket.get(contactId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('status:new', {
            from: userId,
            fromHandle: socket.userHandle,
          });
        }
      });
    });

    // =====================
    // DISCONNECT
    // =====================

    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: @${socket.userHandle}`);
      socketToUser.delete(socket.id);
      userToSocket.delete(userId);

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      socket.broadcast.emit('user:status', { userId, isOnline: false, lastSeen: new Date() });
    });
  });

  // Export helper to get socket by userId (for admin notifications)
  io.getUserSocket = (userId) => userToSocket.get(userId);
};
