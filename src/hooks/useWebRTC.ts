import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [connectionState, setConnectionState] = useState<"idle" | "matching" | "connecting" | "connected" | "disconnected">("idle");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionIdRef = useRef<string>("");
  const userIdRef = useRef<string>(crypto.randomUUID());

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
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRemoteStream(null);
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

    const stream = localStream || (await getMedia());
    if (!stream) {
      setConnectionState("idle");
      return;
    }

    // Use Supabase Realtime for signaling
    const sessionId = `room-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionIdRef.current = sessionId;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const remote = new MediaStream();
    setRemoteStream(remote);

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

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

    channel
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.targetId !== userIdRef.current) return;
        setConnectionState("connecting");
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "answer",
          payload: { answer, targetId: payload.senderId },
        });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.targetId !== userIdRef.current) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.targetId !== userIdRef.current) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {}
      })
      .on("broadcast", { event: "seeking" }, async ({ payload }) => {
        if (payload.senderId === userIdRef.current) return;
        // Found a match - create offer
        setConnectionState("connecting");
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: { candidate: event.candidate, targetId: payload.senderId, senderId: userIdRef.current },
            });
          }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({
          type: "broadcast",
          event: "offer",
          payload: { offer, targetId: payload.senderId, senderId: userIdRef.current },
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Announce we're seeking
          channel.send({
            type: "broadcast",
            event: "seeking",
            payload: { senderId: userIdRef.current },
          });
        }
      });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        // Will be overridden when match is found
      }
    };
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
  };
};
