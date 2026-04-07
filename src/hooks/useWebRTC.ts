import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const METERED_DOMAIN = "umigle.metered.live";
const METERED_API_KEY = "Bz2Bl3G_yCpg7dLdl369vah5AUsb3-5uDS6T1S5bvQKdNo0G";

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: `stun:${METERED_DOMAIN}:80` },
  { urls: `turn:${METERED_DOMAIN}:80`, username: "turn", credential: "turn" },
  { urls: `turn:${METERED_DOMAIN}:443`, username: "turn", credential: "turn" },
  { urls: `turns:${METERED_DOMAIN}:443`, username: "turn", credential: "turn" },
];

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(
      `https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );
    if (!res.ok) throw new Error("Failed to fetch TURN credentials");
    const servers: RTCIceServer[] = await res.json();
    return [{ urls: "stun:stun.l.google.com:19302" }, ...servers];
  } catch (err) {
    console.warn("Using fallback ICE servers:", err);
    return FALLBACK_ICE_SERVERS;
  }
}

export const useWebRTC = (mode: "video" | "chat" = "video", onReceiveMessage?: (text: string) => void) => {
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
  const seekingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMatchedRef = useRef(false);
  
  const onReceiveMessageRef = useRef(onReceiveMessage);
  useEffect(() => {
    onReceiveMessageRef.current = onReceiveMessage;
  }, [onReceiveMessage]);

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
    let matchedPeerId: string | null = null;

    const remote = new MediaStream();
    setRemoteStream(remote);

    // Always create a data channel so WebRTC has something to negotiate if there are no tracks
    const dc = pc.createDataChannel("chat");
    dataChannelRef.current = dc;
    dc.onmessage = (event) => {
      onReceiveMessageRef.current?.(event.data);
    };

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.ondatachannel = (event) => {
      dataChannelRef.current = event.channel;
      event.channel.onmessage = (e) => {
        onReceiveMessageRef.current?.(e.data);
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
      if (event.candidate && channelRef.current && matchedPeerId) {
        channel.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate, targetId: matchedPeerId, senderId: userIdRef.current },
        });
      }
    };

    channel
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.targetId !== userIdRef.current) return;
        if (isMatchedRef.current) return;
        isMatchedRef.current = true;
        matchedPeerId = payload.senderId;
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
        } catch {}
      })
      .on("broadcast", { event: "seeking" }, async ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        if (isMatchedRef.current) return;

        // Glare resolution: only the user with the HIGHER ID creates the offer
        if (userIdRef.current < payload.senderId) return;

        isMatchedRef.current = true;
        matchedPeerId = payload.senderId;
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
  }, [localStream, getMedia, cleanup]);

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
  }, []);

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
    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.send(text);
    }
  }, []);

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
  };
};
