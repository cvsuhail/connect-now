import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import VideoControls from "@/components/VideoControls";
import ChatPanel, { ChatMessage } from "@/components/ChatPanel";
import MatchingLoader from "@/components/MatchingLoader";

const ChatRoom = () => {
  const navigate = useNavigate();
  const {
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    connectionState,
    error,
    startMatching,
    stop,
    next,
    toggleMute,
    toggleCamera,
  } = useWebRTC();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    startMatching();
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleSend = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, sender: "you", timestamp: Date.now() },
    ]);
  };

  const handleStop = () => {
    stop();
    navigate("/");
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* Video Area */}
      <div className="flex-1 relative flex flex-col">
        {/* Remote Video */}
        <div className="flex-1 relative bg-secondary overflow-hidden">
          {connectionState === "matching" && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <MatchingLoader />
            </div>
          )}
          {connectionState === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm">
              <p className="text-muted-foreground text-lg font-medium animate-pulse">Connecting...</p>
            </div>
          )}
          {connectionState === "disconnected" && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-4 animate-fade-in-up">
                <p className="text-muted-foreground text-lg">Stranger disconnected</p>
                <button
                  onClick={next}
                  className="bg-accent text-accent-foreground font-semibold px-6 py-3 rounded-xl transition-all hover:scale-105"
                >
                  Find Next
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-4 animate-fade-in-up">
                <p className="text-destructive text-lg">{error}</p>
                <button
                  onClick={() => navigate("/")}
                  className="bg-secondary text-foreground px-6 py-3 rounded-xl"
                >
                  Go Back
                </button>
              </div>
            </div>
          )}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        </div>

        {/* Local Video */}
        <div className="absolute bottom-24 right-4 w-28 h-40 md:w-36 md:h-48 rounded-2xl overflow-hidden border-2 border-border shadow-xl z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
          {isCameraOff && (
            <div className="absolute inset-0 bg-secondary flex items-center justify-center">
              <p className="text-muted-foreground text-xs">Camera off</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
          <div className="glass rounded-2xl px-4 py-3">
            <VideoControls
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              onToggleMute={toggleMute}
              onToggleCamera={toggleCamera}
              onNext={next}
              onStop={handleStop}
            />
          </div>
        </div>

        {/* Connection Status */}
        {connectionState === "connected" && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "hsl(142 76% 46%)" }} />
            <span className="text-xs text-muted-foreground">Connected</span>
          </div>
        )}

        {/* Mobile Chat Toggle */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="lg:hidden absolute top-4 right-4 z-20 glass rounded-xl p-2.5"
        >
          <MessageCircle className="w-5 h-5" />
          {chatOpen ? <ChevronDown className="w-3 h-3 absolute -bottom-1 right-1/2 translate-x-1/2" /> : <ChevronUp className="w-3 h-3 absolute -bottom-1 right-1/2 translate-x-1/2" />}
        </button>
      </div>

      {/* Chat Panel - Desktop: sidebar, Mobile: overlay */}
      <div
        className={`
          lg:w-[380px] lg:border-l lg:border-border lg:relative lg:translate-y-0 lg:opacity-100
          fixed inset-x-0 bottom-0 z-30 bg-background border-t border-border
          transition-all duration-300 lg:h-full
          ${chatOpen ? "h-[50vh] translate-y-0 opacity-100" : "h-0 translate-y-full opacity-0 lg:opacity-100 lg:translate-y-0 lg:h-full"}
        `}
      >
        <ChatPanel messages={messages} onSend={handleSend} />
      </div>
    </div>
  );
};

export default ChatRoom;
