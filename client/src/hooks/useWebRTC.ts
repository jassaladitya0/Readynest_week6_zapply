import { useCallback, useRef } from 'react';
import { useCallStore } from '../store/callStore';
import { useAuthStore } from '../store/authStore';
import { sendIceCandidate, answerCall as socketAnswerCall, initiateCall, endCall as socketEndCall } from '../lib/socket';
import { saveCall } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Add your TURN server here for production:
  // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
];

export const useWebRTC = () => {
  const { user } = useAuthStore();
  const {
    setPeerConnection, setLocalStream, setRemoteStream,
    setActiveCall, setIncomingCall, clearCall,
  } = useCallStore();

  const callStartTimeRef = useRef<number>(0);

  const createPeerConnection = useCallback(
    (peerId: string, peerHandle: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendIceCandidate(peerId, event.candidate.toJSON());
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0] || null);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          endCallLocal(peerId, peerHandle);
        }
        if (pc.connectionState === 'connected') {
          callStartTimeRef.current = Date.now();
        }
      };

      setPeerConnection(pc);
      return pc;
    },
    [setPeerConnection, setRemoteStream]
  );

  const getMediaStream = async (callType: 'audio' | 'video'): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  };

  // ---- Start outgoing call ----
  const startCall = useCallback(
    async (peerId: string, peerHandle: string, peerDisplayName: string, peerAvatar: string | null, callType: 'audio' | 'video') => {
      if (!user) return;
      try {
        const stream = await getMediaStream(callType);
        setLocalStream(stream);

        const pc = createPeerConnection(peerId, peerHandle);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        initiateCall(peerId, offer, callType);

        const callId = uuidv4();
        setActiveCall({
          id: callId,
          type: callType,
          status: 'outgoing',
          peerId,
          peerHandle,
          peerDisplayName,
          peerAvatar,
          startTime: Date.now(),
        });
      } catch (err) {
        console.error('Call failed:', err);
        toast.error('Could not start call. Check camera/mic permissions.');
        clearCall();
      }
    },
    [user, createPeerConnection, setLocalStream, setActiveCall, clearCall]
  );

  // ---- Answer incoming call ----
  const answerIncomingCall = useCallback(
    async (incomingData: {
      from: string; fromHandle: string; fromDisplayName: string; fromAvatar: string | null;
      offer: RTCSessionDescriptionInit; callType: 'audio' | 'video';
    }) => {
      if (!user) return;
      try {
        const stream = await getMediaStream(incomingData.callType);
        setLocalStream(stream);

        const pc = createPeerConnection(incomingData.from, incomingData.fromHandle);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(incomingData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketAnswerCall(incomingData.from, answer);
        setIncomingCall(null);

        const callId = uuidv4();
        setActiveCall({
          id: callId,
          type: incomingData.callType,
          status: 'active',
          peerId: incomingData.from,
          peerHandle: incomingData.fromHandle,
          peerDisplayName: incomingData.fromDisplayName,
          peerAvatar: incomingData.fromAvatar,
          startTime: Date.now(),
        });
      } catch (err) {
        console.error('Answer call failed:', err);
        toast.error('Could not answer call. Check permissions.');
        clearCall();
      }
    },
    [user, createPeerConnection, setLocalStream, setActiveCall, setIncomingCall, clearCall]
  );

  // ---- End call ----
  const endCallLocal = useCallback(
    async (peerId: string, _peerHandle: string) => {
      const { activeCall } = useCallStore.getState();
      socketEndCall(peerId);

      if (activeCall) {
        const duration = callStartTimeRef.current
          ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
          : 0;
        await saveCall({
          ...activeCall,
          status: 'ended',
          endTime: Date.now(),
          duration,
        });
      }

      clearCall();
    },
    [clearCall]
  );

  return {
    startCall,
    answerIncomingCall,
    endCall: endCallLocal,
  };
};
