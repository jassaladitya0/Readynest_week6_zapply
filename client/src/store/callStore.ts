import { create } from 'zustand';
import type { Call } from '../types';

interface IncomingCallData {
  from: string;
  fromHandle: string;
  fromDisplayName: string;
  fromAvatar: string | null;
  offer: RTCSessionDescriptionInit;
  callType: 'audio' | 'video';
}

interface CallStore {
  activeCall: Call | null;
  incomingCall: IncomingCallData | null;
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  callDuration: number;

  setActiveCall: (call: Call | null) => void;
  setIncomingCall: (call: IncomingCallData | null) => void;
  setPeerConnection: (pc: RTCPeerConnection | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  setCallDuration: (duration: number) => void;
  clearCall: () => void;
}

export const useCallStore = create<CallStore>()((set, get) => ({
  activeCall: null,
  incomingCall: null,
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOff: false,
  callDuration: 0,

  setActiveCall: (call) => set({ activeCall: call }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => { track.enabled = isMuted; });
    }
    set({ isMuted: !isMuted });
  },

  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => { track.enabled = isCameraOff; });
    }
    set({ isCameraOff: !isCameraOff });
  },

  setCallDuration: (duration) => set({ callDuration: duration }),

  clearCall: () => {
    const { peerConnection, localStream } = get();
    if (peerConnection) {
      peerConnection.close();
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    set({
      activeCall: null,
      incomingCall: null,
      peerConnection: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isCameraOff: false,
      callDuration: 0,
    });
  },
}));
