import { create } from 'zustand';
import type { Conversation, Message } from '../types';

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  setActiveConversation: (id: string | null) => void;
  incrementUnread: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
  updateLastMessage: (conversationId: string, message: Partial<Message>) => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  conversations: [],
  activeConversationId: null,

  setConversations: (convs) =>
    set({ conversations: convs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) }),

  addConversation: (conv) =>
    set((state) => {
      const exists = state.conversations.find((c) => c.id === conv.id);
      if (exists) return state;
      return { conversations: [conv, ...state.conversations] };
    }),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations
        .map((c) => (c.id === id ? { ...c, ...updates } : c))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    })),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  incrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c
      ),
    })),

  resetUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    })),

  updateLastMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations
        .map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: { ...c.lastMessage, ...message } as Message, updatedAt: Date.now() }
            : c
        )
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    })),
}));
