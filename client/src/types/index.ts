export interface User {
  id: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  publicKey: string;
  bio?: string;
  phoneNumber?: string;
  isOnline?: boolean;
  lastSeen?: string | Date;
  privacySettings?: {
    lastSeen?: string;
    profilePhoto?: string;
    status?: string;
  };
}

export interface Conversation {
  id: string;
  type?: 'direct' | 'group';
  name?: string;
  participants: string[];
  participantDetails?: Record<string, Partial<User>>;
  unreadCount?: number;
  createdAt?: number;
  updatedAt?: number;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderHandle: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'voice' | 'file';
  mediaData?: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  replyTo?: string;
  ttl?: number;
}

export interface Status {
  id: string;
  userId: string;
  userHandle: string;
  userDisplayName: string;
  userAvatar: string | null;
  type: 'text' | 'image';
  content: string;
  backgroundColor?: string;
  views: string[];
  timestamp: number;
  expiresAt: number;
}

export interface Call {
  id: string;
  type: 'audio' | 'video';
  status: 'outgoing' | 'incoming' | 'active' | 'ended' | 'missed';
  peerId: string;
  peerHandle: string;
  peerDisplayName: string;
  peerAvatar: string | null;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export interface AdminUser {
  _id: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  isSuspended?: boolean;
  isVerified?: boolean;
  reportCount?: number;
  createdAt: string;
}

export interface Report {
  _id: string;
  reportedUserHandle: string;
  reportedUserId: string | { _id: string; isSuspended?: boolean };
  reporterId: string | { userId?: string };
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  avatar: string | null;
  ownerId: string;
  ownerHandle: string;
  subscriberCount: number;
  posts: ChannelPost[];
  createdAt: number;
}

export interface ChannelPost {
  id: string;
  channelId: string;
  content: string;
  mediaData?: string;
  timestamp: number;
}
