import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { addMessage, db } from '../lib/db';
import { decryptMessage, getPrivateKey } from '../lib/crypto';
import { usersAPI } from '../lib/api';
import toast from 'react-hot-toast';

export const useSocket = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { updateConversation, incrementUnread, activeConversationId, conversations } = useChatStore();
  const { setIncomingCall, clearCall } = useCallStore();
  const isSetup = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      disconnectSocket();
      isSetup.current = false;
      return;
    }

    const accessToken = localStorage.getItem('zapply_access_token');
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

    if (isSetup.current) return;
    isSetup.current = true;

    // ---- Incoming direct message ----
    socket.on('message:receive', async (data: {
      from: string;
      fromHandle: string;
      messageId: string;
      encryptedPayload: string;
      timestamp: number;
    }) => {
      const privateKey = getPrivateKey();
      let content = '[Encrypted message]';

      // Try to get sender's public key for decryption
      if (privateKey) {
        try {
          const senderUser = await usersAPI.getUser(data.fromHandle);
          if (senderUser?.publicKey) {
            const decrypted = decryptMessage(data.encryptedPayload, senderUser.publicKey, privateKey);
            if (decrypted) content = decrypted;
          }
        } catch {
          // Fallback to encrypted payload display
        }
      }

      const conversationId = [user.id, data.from].sort().join('_');
      const message = {
        id: data.messageId,
        conversationId,
        senderId: data.from,
        senderHandle: data.fromHandle,
        content,
        type: 'text' as const,
        timestamp: data.timestamp,
        status: 'delivered' as const,
      };

      await addMessage(message);

      // Update conversation
      updateConversation(conversationId, {
        lastMessage: message,
        updatedAt: data.timestamp,
      });

      // Increment unread if not active conversation
      if (activeConversationId !== conversationId) {
        incrementUnread(conversationId);

        // Browser notification
        if (Notification.permission === 'granted') {
          new Notification(`@${data.fromHandle}`, {
            body: content.length > 60 ? content.slice(0, 60) + '...' : content,
            icon: '/icons/icon-192.png',
          });
        }
      }
    });

    // ---- Message delivery status ----
    socket.on('message:delivered', async ({ messageId }: { messageId: string; to: string }) => {
      const msg = await db.messages.get(messageId);
      if (msg) {
        await db.messages.update(messageId, { status: 'delivered' });
      }
    });

    // ---- Message read receipt ----
    socket.on('message:read', async ({ messageId }: { messageId: string; by: string }) => {
      const msg = await db.messages.get(messageId);
      if (msg) {
        await db.messages.update(messageId, { status: 'read' });
      }
    });

    // ---- Group message ----
    socket.on('group:message', async (data: {
      from: string;
      fromHandle: string;
      groupId: string;
      messageId: string;
      encryptedPayload: string;
      timestamp: number;
    }) => {
      await addMessage({
        id: data.messageId,
        conversationId: `group_${data.groupId}`,
        senderId: data.from,
        senderHandle: data.fromHandle,
        content: data.encryptedPayload, // groups can be unencrypted for simplicity
        type: 'text',
        timestamp: data.timestamp,
        status: 'delivered',
      });

      if (`group_${data.groupId}` !== activeConversationId) {
        incrementUnread(`group_${data.groupId}`);
      }
    });

    // ---- User online status ----
    socket.on('user:status', ({ userId, isOnline, lastSeen }: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      // Update conversation participant details
      const conv = conversations.find((c) => c.participants.includes(userId));
      if (conv) {
        updateConversation(conv.id, {
          participantDetails: {
            ...conv.participantDetails,
            [userId]: { ...(conv.participantDetails?.[userId] || {}), isOnline, lastSeen },
          },
        });
      }
    });

    // ---- Incoming call ----
    socket.on('call:incoming', (data: {
      from: string;
      fromHandle: string;
      fromDisplayName: string;
      fromAvatar: string | null;
      offer: RTCSessionDescriptionInit;
      callType: 'audio' | 'video';
    }) => {
      setIncomingCall(data);
      toast(`📞 Incoming ${data.callType} call from @${data.fromHandle}`, {
        duration: 30000,
        id: 'incoming-call',
        icon: data.callType === 'video' ? '📹' : '📞',
      });
    });

    // ---- Call answered ----
    socket.on('call:answer', async ({ answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const { peerConnection } = useCallStore.getState();
      if (peerConnection && answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // ---- ICE candidate ----
    socket.on('call:ice-candidate', async ({ candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const { peerConnection } = useCallStore.getState();
      if (peerConnection && candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // ---- Call rejected ----
    socket.on('call:rejected', () => {
      toast.error('Call was rejected');
      clearCall();
    });

    // ---- Call ended ----
    socket.on('call:ended', () => {
      clearCall();
      toast('Call ended', { icon: '📵' });
    });

    // ---- Call busy ----
    socket.on('call:busy', () => {
      toast.error('User is busy on another call');
      clearCall();
    });

    // ---- New status notification ----
    socket.on('status:new', ({ fromHandle }: { from: string; fromHandle: string }) => {
      toast(`@${fromHandle} posted a new status`, { icon: '📸' });
    });

    return () => {
      // Don't disconnect on cleanup, only on logout
      isSetup.current = false;
    };
  }, [isAuthenticated, user?.id]);

  return { socket: getSocket(), isConnected: getSocket()?.connected || false };
};
