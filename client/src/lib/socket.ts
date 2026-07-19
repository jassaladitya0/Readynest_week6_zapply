import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => console.log('🔌 Socket connected:', socket?.id));
  socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
  socket.on('connect_error', (err) => console.error('🔌 Socket error:', err.message));

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => socket;

// ============================================================
// Typed event emitters
// ============================================================
export const sendMessage = (payload: {
  to: string;
  encryptedPayload: string;
  messageId: string;
  timestamp: number;
}) => socket?.emit('message:send', payload);

export const sendGroupMessage = (payload: {
  groupId: string;
  encryptedPayload: string;
  messageId: string;
  timestamp: number;
}) => socket?.emit('group:message', payload);

export const sendTypingStart = (to: string) => socket?.emit('typing:start', { to });
export const sendTypingStop = (to: string) => socket?.emit('typing:stop', { to });
export const sendMessageRead = (messageId: string, to: string) =>
  socket?.emit('message:read', { messageId, to });

export const joinGroup = (groupId: string) => socket?.emit('group:join', { groupId });
export const leaveGroup = (groupId: string) => socket?.emit('group:leave', { groupId });

// WebRTC signaling
export const initiateCall = (to: string, offer: RTCSessionDescriptionInit, callType: 'audio' | 'video') =>
  socket?.emit('call:offer', { to, offer, callType });

export const answerCall = (to: string, answer: RTCSessionDescriptionInit) =>
  socket?.emit('call:answer', { to, answer });

export const rejectCall = (to: string) => socket?.emit('call:reject', { to });
export const endCall = (to: string) => socket?.emit('call:end', { to });
export const sendIceCandidate = (to: string, candidate: RTCIceCandidateInit) =>
  socket?.emit('call:ice-candidate', { to, candidate });

export const notifyStatusPosted = (contacts: string[]) =>
  socket?.emit('status:posted', { contacts });

export { socket };
