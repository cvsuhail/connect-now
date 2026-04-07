import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/hooks/useAuthProfile";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.relay.metered.ca:80" },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "69f6cef1ad2010fe37062e6b",
    credential: "hcETBBGBoiA7yq62",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "69f6cef1ad2010fe37062e6b",
    credential: "hcETBBGBoiA7yq62",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "69f6cef1ad2010fe37062e6b",
    credential: "hcETBBGBoiA7yq62",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "69f6cef1ad2010fe37062e6b",
    credential: "hcETBBGBoiA7yq62",
  },
];

type WireMessage =
  | { type: "chat"; text: string }
  | { type: "profile"; profile: UserProfile; peerId: string }
  | { type: "ttt"; index: number; symbol: "X" | "O" };

export const useWebRTC = (
  mode: "video" | "chat" = "video",
  onReceiveMessage?: (text: string) => void,
  localProfile?: UserProfile,
  onReceiveProfile?: (profile: UserProfile, peerId: string) => void,
  onReceiveTicTacToeMove?: (index: number, symbol: "X" | "O") => void,
) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [connectionState, setConnectionState] = useState<"idle" | "matching" | "connecting" | "connected" | "disconnected">("idle");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionIdRef = useRef<string>("");
  const userIdRef = useRef<string>(crypto.randomUUID());
  const matchedPeerIdRef = useRef<string | null>(null);
  const seekingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMatchedRef = useRef(false);
  
  const onReceiveMessageRef = useRef(onReceiveMessage);
  const localProfileRef = useRef(localProfile);
  const onReceiveProfileRef = useRef(onReceiveProfile);
  const onReceiveTicTacToeMoveRef = useRef(onReceiveTicTacToeMove);
  useEffect(() => {
    onReceiveMessageRef.current = onReceiveMessage;
  }, [onReceiveMessage]);
  useEffect(() => {
    localProfileRef.current = localProfile;
  }, [localProfile]);
  useEffect(() => {
    onReceiveProfileRef.current = onReceiveProfile;
  }, [onReceiveProfile]);
  useEffect(() => {
    onReceiveTicTacToeMoveRef.current = onReceiveTicTacToeMove;
  }, [onReceiveTicTacToeMove]);

  const sendPacket = useCallback((payload: WireMessage) => {
    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const sendProfile = useCallback(() => {
    if (!localProfileRef.current) return;
    sendPacket({
      type: "profile",
      profile: localProfileRef.current,
      peerId: userIdRef.current,
    });
  }, [sendPacket]);

  const handleIncomingMessage = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw) as WireMessage;
      if (parsed.type === "chat") onReceiveMessageRef.current?.(parsed.text);
      if (parsed.type === "profile") onReceiveProfileRef.current?.(parsed.profile, parsed.peerId);
      if (parsed.type === "ttt") onReceiveTicTacToeMoveRef.current?.(parsed.index, parsed.symbol);
      return;
    } catch {
      onReceiveMessageRef.current?.(raw);
    }
  }, []);

  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch {
      setError("Camera/microphone permission denied");
      return null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (seekingIntervalRef.current) {
      clearInterval(seekingIntervalRef.current);
      seekingIntervalRef.current = null;
    }
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRemoteStream(null);
    isMatchedRef.current = false;
    matchedPeerIdRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsMuted((prev) => !prev);
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      setIsCameraOff((prev) => !prev);
    }
  }, [localStream]);

  const startMatching = useCallback(async () => {
    cleanup();
    setConnectionState("matching");

    let stream: MediaStream | null = null;
    if (mode === "video") {
      stream = localStream || (await getMedia());
      if (!stream) {
        setConnectionState("idle");
        return;
      }
    }

    // Use Supabase Realtime for signaling
    const sessionId = `room-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionIdRef.current = sessionId;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    const remote = new MediaStream();
    setRemoteStream(remote);

    // Always create a data channel so WebRTC has something to negotiate if there are no tracks
    const dc = pc.createDataChannel("chat");
    dataChannelRef.current = dc;
    dc.onmessage = (event) => {
      handleIncomingMessage(event.data);
    };
    dc.onopen = () => {
      sendProfile();
    };

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.ondatachannel = (event) => {
      dataChannelRef.current = event.channel;
      event.channel.onmessage = (e) => {
        handleIncomingMessage(e.data);
      };
      event.channel.onopen = () => {
        sendProfile();
      };
    };

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => remote.addTrack(track));
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") setConnectionState("connected");
      if (state === "disconnected" || state === "failed") setConnectionState("disconnected");
    };

    // Join the matchmaking channel
    const channel = supabase.channel("matchmaking", {
      config: { broadcast: { self: false } },
    });

    channelRef.current = channel;

    // Set up ICE candidate handler globally - sends to matched peer
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current && matchedPeerIdRef.current) {
        channel.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate, targetId: matchedPeerIdRef.current, senderId: userIdRef.current },
        });
      }
    };

    channel
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.targetId !== userIdRef.current) return;
        if (isMatchedRef.current) return;
        isMatchedRef.current = true;
        matchedPeerIdRef.current = payload.senderId;
        if (seekingIntervalRef.current) clearInterval(seekingIntervalRef.current);
        setConnectionState("connecting");
        
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "answer",
            payload: { answer, targetId: payload.senderId, senderId: userIdRef.current },
          });
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.targetId !== userIdRef.current) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        } catch (err) {
          console.error("Error handling answer:", err);
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.targetId !== userIdRef.current) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.debug("Failed to add ICE candidate", err);
        }
      })
      .on("broadcast", { event: "seeking" }, async ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        if (isMatchedRef.current) return;

        // Glare resolution: only the user with the HIGHER ID creates the offer
        if (userIdRef.current < payload.senderId) return;

        isMatchedRef.current = true;
        matchedPeerIdRef.current = payload.senderId;
        if (seekingIntervalRef.current) clearInterval(seekingIntervalRef.current);
        setConnectionState("connecting");

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: "broadcast",
            event: "offer",
            payload: { offer, targetId: payload.senderId, senderId: userIdRef.current },
          });
        } catch (err) {
          console.error("Error creating offer:", err);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          const broadcastSeeking = () => {
            if (!isMatchedRef.current) {
              channel.send({
                type: "broadcast",
                event: "seeking",
                payload: { senderId: userIdRef.current, mode },
              });
            }
          };
          broadcastSeeking();
          seekingIntervalRef.current = setInterval(broadcastSeeking, 2000);
        }
      });
  }, [cleanup, getMedia, handleIncomingMessage, localStream, mode, sendProfile]);

  const stop = useCallback(() => {
    cleanup();
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setConnectionState("idle");
  }, [cleanup, localStream]);

  const next = useCallback(() => {
    cleanup();
    setConnectionState("idle");
    setTimeout(() => startMatching(), 300);
  }, [cleanup, startMatching]);

  useEffect(() => {
    return () => {
      cleanup();
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [cleanup, localStream]);

  // Failsafe timeout: if stuck on "connecting" for over 15 seconds, assume network failure
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (connectionState === "connecting") {
      timeout = setTimeout(() => {
        setConnectionState("disconnected");
        console.warn("Connection timed out after 15 seconds");
      }, 15000);
    }
    return () => clearTimeout(timeout);
  }, [connectionState]);

  const sendMessage = useCallback((text: string) => {
    sendPacket({ type: "chat", text });
  }, [sendPacket]);

  const sendTicTacToeMove = useCallback((index: number, symbol: "X" | "O") => {
    sendPacket({ type: "ttt", index, symbol });
  }, [sendPacket]);

  return {
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    connectionState,
    error,
    getMedia,
    startMatching,
    stop,
    next,
    toggleMute,
    toggleCamera,
    sendMessage,
    sendTicTacToeMove,
    userPeerId: userIdRef.current,
    remotePeerId: matchedPeerIdRef.current,
  };
};
