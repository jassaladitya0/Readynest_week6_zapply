import Dexie, { type Table } from 'dexie';
import type { Message, Conversation, Status, Channel, ChannelPost, Call } from '../types';

class ZapplyDB extends Dexie {
  messages!: Table<Message, string>;
  conversations!: Table<Conversation, string>;
  statuses!: Table<Status, string>;
  channels!: Table<Channel, string>;
  channelPosts!: Table<ChannelPost, string>;
  calls!: Table<Call, string>;
  contacts!: Table<{ userId: string; data: string }, string>;

  constructor() {
    super('ZapplyChat');
    this.version(1).stores({
      messages: 'id, conversationId, senderId, timestamp, ttl, status',
      conversations: 'id, type, updatedAt',
      statuses: 'id, userId, timestamp, expiresAt',
      channels: 'id, name',
      channelPosts: 'id, channelId, timestamp',
      calls: 'id, peerId, startTime, status',
      contacts: 'userId',
    });
  }
}

export const db = new ZapplyDB();

// ---- Auto-delete expired messages/statuses every hour ----
export const startAutoCleanup = () => {
  const cleanup = async () => {
    const now = Date.now();
    const expiredMessages = await db.messages.filter((m) => !!m.ttl && m.ttl < now).toArray();
    if (expiredMessages.length > 0) {
      await db.messages.bulkDelete(expiredMessages.map((m) => m.id));
      console.log(`🗑️ Deleted ${expiredMessages.length} expired messages`);
    }
    const expiredStatuses = await db.statuses.filter((s) => s.expiresAt < now).toArray();
    if (expiredStatuses.length > 0) {
      await db.statuses.bulkDelete(expiredStatuses.map((s) => s.id));
      console.log(`🗑️ Deleted ${expiredStatuses.length} expired statuses`);
    }
  };
  cleanup();
  const interval = setInterval(cleanup, 60 * 60 * 1000);
  return () => clearInterval(interval);
};

// ---- Add message with 24h TTL ----
export const addMessage = async (message: Omit<Message, 'ttl'>): Promise<Message> => {
  const TTL_24H = 24 * 60 * 60 * 1000;
  const msgWithTTL: Message = { ...message, ttl: message.timestamp + TTL_24H };
  await db.messages.put(msgWithTTL);
  const conv = await db.conversations.get(message.conversationId);
  if (conv) {
    await db.conversations.update(message.conversationId, {
      lastMessage: msgWithTTL,
      updatedAt: Date.now(),
    });
  }
  return msgWithTTL;
};

// ---- Get messages for a conversation ----
export const getMessages = async (conversationId: string, limit = 100): Promise<Message[]> => {
  const now = Date.now();
  const msgs = await db.messages
    .where('conversationId')
    .equals(conversationId)
    .filter((m) => !m.ttl || m.ttl > now)
    .reverse()
    .limit(limit)
    .toArray();
  return msgs.reverse();
};

// ---- Get all active statuses ----
export const getActiveStatuses = async (): Promise<Status[]> => {
  const now = Date.now();
  return db.statuses.filter((s) => s.expiresAt > now).toArray();
};

// ---- Save a status with 24h expiry ----
export const saveStatus = async (status: Omit<Status, 'expiresAt'>): Promise<Status> => {
  const TTL_24H = 24 * 60 * 60 * 1000;
  const statusWithExpiry: Status = { ...status, expiresAt: status.timestamp + TTL_24H };
  await db.statuses.put(statusWithExpiry);
  return statusWithExpiry;
};

// ---- Get or create conversation ----
export const getOrCreateConversation = async (
  myUserId: string,
  theirUserId: string,
  theirDetails: Partial<import('../types').User>
): Promise<Conversation> => {
  const id = [myUserId, theirUserId].sort().join('_');
  const existing = await db.conversations.get(id);
  if (existing) return existing;

  const newConv: Conversation = {
    id,
    type: 'direct',
    participants: [myUserId, theirUserId],
    participantDetails: { [theirUserId]: theirDetails },
    unreadCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.conversations.put(newConv);
  return newConv;
};

// ---- Save call record ----
export const saveCall = async (call: Call): Promise<void> => {
  await db.calls.put(call);
};

// ---- Get all calls ----
export const getCalls = async (): Promise<Call[]> => {
  return db.calls.orderBy('startTime').reverse().limit(50).toArray();
};

// ---- Clear all user data (on logout) ----
export const clearAllData = async () => {
  await Promise.all([
    db.messages.clear(),
    db.conversations.clear(),
    db.statuses.clear(),
    db.calls.clear(),
  ]);
  console.log('🗑️ All local data cleared');
};
