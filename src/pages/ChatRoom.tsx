import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import VideoControls from "@/components/VideoControls";
import ChatPanel, { ChatMessage } from "@/components/ChatPanel";
import MatchingLoader from "@/components/MatchingLoader";
import { useAuthProfile, type UserProfile } from "@/hooks/useAuthProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { addReport } from "@/lib/adminStore";
import { toast } from "sonner";

type Cell = "X" | "O" | null;
const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const initialGuestProfile: UserProfile = {
  nickname: "Guest",
  photoUrl: "",
  instagramId: "",
  snapchatId: "",
  bio: "",
  whatsapp: "",
  portfolioUrl: "",
  isGuest: true,
};

const ChatRoom = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get("mode") as "chat" | "video") || "video";
  const { profile, session } = useAuthProfile();
  const [localProfile, setLocalProfile] = useState<UserProfile>(profile);
  const [remoteProfile, setRemoteProfile] = useState<UserProfile | null>(null);
  const [remotePeerId, setRemotePeerId] = useState<string>("");
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [gameWinner, setGameWinner] = useState<"X" | "O" | "draw" | null>(null);

  const handleReceiveMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, sender: "stranger", timestamp: Date.now() },
    ]);
  }, []);

  const handleReceiveProfile = useCallback((incomingProfile: UserProfile, remotePeerId: string) => {
    setRemoteProfile(incomingProfile);
    setRemotePeerId(remotePeerId);
  }, []);

  const handleReceiveTicTacToeMove = useCallback((index: number, symbol: "X" | "O") => {
    setBoard((prev) => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = symbol;
      return next;
    });
  }, []);

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
    sendMessage,
    sendTicTacToeMove,
    userPeerId,
  } = useWebRTC(mode, handleReceiveMessage, localProfile, handleReceiveProfile, handleReceiveTicTacToeMove);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const mobileLocalVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const fromSession = sessionStorage.getItem("active-profile");
    if (fromSession) {
      try {
        setLocalProfile(JSON.parse(fromSession));
        return;
      } catch {
        setLocalProfile(profile || initialGuestProfile);
      }
    }
    setLocalProfile(profile || initialGuestProfile);
  }, [profile]);

  useEffect(() => {
    startMatching();
  }, [startMatching]);

  useEffect(() => {
    if (connectionState === "matching") {
      setMessages([]);
      setRemoteProfile(null);
      setRemotePeerId("");
      setBoard(Array(9).fill(null));
      setGameWinner(null);
    }
  }, [connectionState]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (mobileLocalVideoRef.current && localStream) {
      mobileLocalVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleSend = (text: string) => {
    sendMessage(text);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, sender: "you", timestamp: Date.now() },
    ]);
  };

  const handleStop = () => {
    stop();
    navigate("/");
  };

  const mySymbol: "X" | "O" = !remotePeerId || userPeerId < remotePeerId ? "X" : "O";

  const currentTurn = board.filter(Boolean).length % 2 === 0 ? "X" : "O";

  useEffect(() => {
    for (const [a, b, c] of winningLines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        setGameWinner(board[a] as "X" | "O");
        return;
      }
    }
    if (board.every(Boolean)) {
      setGameWinner("draw");
    } else {
      setGameWinner(null);
    }
  }, [board]);

  const playMove = (index: number) => {
    if (localProfile.isGuest) return;
    if (connectionState !== "connected" || gameWinner) return;
    if (board[index]) return;
    if (currentTurn !== mySymbol) return;

    setBoard((prev) => {
      const next = [...prev];
      next[index] = mySymbol;
      return next;
    });
    sendTicTacToeMove(index, mySymbol);
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setGameWinner(null);
  };

  const reportStranger = () => {
    const reason = window.prompt("Report reason (nudity, abuse, spam, etc.)");
    if (!reason?.trim()) return;
    addReport({
      reporterEmail: session?.user.email || "guest@local",
      reporterNickname: localProfile.nickname || "Guest",
      reportedPeerId: remotePeerId || "unknown-peer",
      reportedNickname: remoteProfile?.nickname || "Unknown",
      reason: reason.trim(),
    });
    toast.success("Report submitted to admin");
  };

  const renderOverlays = () => {
    return (
      <>
        {connectionState === "matching" && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm">
            <MatchingLoader />
          </div>
        )}
        {connectionState === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm pointer-events-none">
            <p className="text-foreground text-lg font-medium animate-pulse">Connecting...</p>
          </div>
        )}
        {connectionState === "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 animate-fade-in-up">
              <p className="text-foreground text-lg font-medium">Stranger disconnected</p>
              <button
                onClick={next}
                className="bg-accent text-accent-foreground font-semibold px-6 py-3 rounded-xl transition-all hover:scale-105 glow-button"
              >
                Find Next
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 animate-fade-in-up md:p-8 p-6 text-center max-w-sm">
              <p className="text-destructive font-semibold text-lg">{error}</p>
              <button
                onClick={() => navigate("/")}
                className="bg-secondary text-foreground px-6 py-3 rounded-xl font-medium hover:bg-secondary/80 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden relative">
      {/* Dynamic Overlays that always cover the entire app to block interactions while matching */}
      <div className={`absolute inset-0 z-50 pointer-events-none ${connectionState === "connected" && !error ? "hidden" : ""}`}>
        <div className="relative w-full h-full pointer-events-auto">
          {renderOverlays()}
        </div>
      </div>

      {mode === "video" ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="relative flex-1 lg:basis-[40%] lg:max-w-[40%] bg-secondary overflow-hidden border-r border-border/70">
            <div className="absolute inset-0 lg:static lg:h-full lg:flex lg:flex-col">
              <div className="relative h-full lg:h-1/2 overflow-hidden border-b border-border/70">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden lg:block relative h-1/2 overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: "scaleX(-1)" }}
                />
                {isCameraOff && (
                  <div className="absolute inset-0 bg-secondary/95 flex items-center justify-center">
                    <p className="text-muted-foreground text-xs">Camera off</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:hidden absolute top-4 right-4 w-28 h-36 rounded-xl overflow-hidden border border-white/40 shadow-2xl z-20 bg-black/40">
              <video
                ref={mobileLocalVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
                style={{ transform: "scaleX(-1)" }}
              />
              {isCameraOff && (
                <div className="absolute inset-0 bg-secondary/95 flex items-center justify-center">
                  <p className="text-muted-foreground text-xs">Camera off</p>
                </div>
              )}
            </div>

            {connectionState === "connected" && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 glass rounded-full">
                <div className="w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_8px_hsl(142_76%_46%)]" style={{ backgroundColor: "hsl(142 76% 46%)" }} />
                <span className="text-xs font-medium text-foreground tracking-wide">Connected</span>
              </div>
            )}
            {connectionState === "connected" && (
              <button
                onClick={reportStranger}
                className="absolute top-4 left-28 z-20 text-xs rounded-full px-3 py-1.5 bg-destructive text-destructive-foreground"
              >
                Report
              </button>
            )}

            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="lg:hidden absolute top-4 right-36 z-20 glass rounded-xl p-3 shadow-lg hover:bg-white/10 transition-colors"
            >
              <MessageCircle className="w-5 h-5 text-foreground" />
              <div className="absolute -bottom-2 right-1/2 translate-x-1/2 opacity-70">
                {chatOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </div>
            </button>

            <div className="lg:hidden absolute bottom-28 left-0 right-0 flex justify-center px-4 z-20">
              <div className="glass rounded-2xl px-3 py-2.5 shadow-lg">
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

            <div className="lg:hidden absolute bottom-4 left-4 right-4 h-20 rounded-xl border border-border/80 bg-background/90 backdrop-blur-sm flex items-center justify-center z-20">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Banner Ad Space</p>
            </div>
          </div>

          <div className="hidden lg:flex lg:basis-[40%] lg:max-w-[40%] flex-col border-r border-border bg-background/95">
            <div className="p-3 border-b border-border space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {[{ title: "You", data: localProfile }, { title: "Stranger", data: remoteProfile }].map((item) => (
                  <div key={item.title} className="rounded-xl border border-border p-2 bg-secondary/40">
                    <div className="flex gap-2 items-start">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={item.data?.photoUrl} />
                        <AvatarFallback>{(item.data?.nickname || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold">{item.title}: {item.data?.nickname || "Unknown"}</p>
                        {item.data?.bio && <p className="text-muted-foreground">{item.data.bio}</p>}
                        {item.data?.instagramId && <p>Instagram: {item.data.instagramId}</p>}
                        {item.data?.snapchatId && <p>Snapchat: {item.data.snapchatId}</p>}
                        {item.data?.whatsapp && <p>WhatsApp: {item.data.whatsapp}</p>}
                        {item.data?.portfolioUrl && <p className="truncate">Portfolio: {item.data.portfolioUrl}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border p-3 bg-secondary/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">Realtime Tic-Tac-Toe</p>
                  <button className="text-xs underline" onClick={resetGame}>Reset</button>
                </div>
                {localProfile.isGuest && (
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Sign in with Google to play realtime games.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mb-2">
                  You are <strong>{mySymbol}</strong>. {gameWinner ? (gameWinner === "draw" ? "Draw game." : `Winner: ${gameWinner}`) : `Turn: ${currentTurn}`}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {board.map((cell, idx) => (
                    <button
                      key={idx}
                      className="h-10 rounded-md bg-background border border-border text-lg font-bold"
                      onClick={() => playMove(idx)}
                    >
                      {cell}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <ChatPanel messages={messages} onSend={handleSend} strangerProfile={remoteProfile} />
            </div>

            <div className="px-4 pb-4">
              <div className="flex justify-center">
                <div className="glass rounded-2xl px-4 py-3 shadow-lg">
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
            </div>
          </div>

          <aside className="hidden lg:flex lg:basis-[20%] lg:max-w-[20%] flex-col gap-3 p-3 bg-background/80">
            <div className="h-1/2 rounded-xl border border-border bg-secondary/30 flex items-center justify-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide text-center px-2">AdSense Slot 1</p>
            </div>
            <div className="h-1/2 rounded-xl border border-border bg-secondary/30 flex items-center justify-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide text-center px-2">AdSense Slot 2</p>
            </div>
          </aside>

          <div
            className={`
              lg:hidden fixed inset-x-0 bottom-0 z-30 bg-background border-t border-border
              transition-all duration-300 shadow-2xl
              ${chatOpen ? "h-[58vh] translate-y-0 opacity-100" : "h-0 translate-y-full opacity-0"}
            `}
          >
            <div className="p-3 border-b border-border space-y-3">
              <div className="rounded-xl border border-border p-3 bg-secondary/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">Realtime Tic-Tac-Toe</p>
                  <button className="text-xs underline" onClick={resetGame}>Reset</button>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">
                  You are <strong>{mySymbol}</strong>. {gameWinner ? (gameWinner === "draw" ? "Draw game." : `Winner: ${gameWinner}`) : `Turn: ${currentTurn}`}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {board.map((cell, idx) => (
                    <button
                      key={idx}
                      className="h-10 rounded-md bg-background border border-border text-lg font-bold"
                      onClick={() => playMove(idx)}
                    >
                      {cell}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ChatPanel messages={messages} onSend={handleSend} strangerProfile={remoteProfile} />
          </div>
        </div>
      ) : (
        <div className="flex-1 w-full relative z-10">
          <div className="p-3 border-b border-border space-y-3">
          <div className="grid grid-cols-1 gap-2">
            {[{ title: "You", data: localProfile }, { title: "Stranger", data: remoteProfile }].map((item) => (
              <div key={item.title} className="rounded-xl border border-border p-2 bg-secondary/40">
                <div className="flex gap-2 items-start">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={item.data?.photoUrl} />
                    <AvatarFallback>{(item.data?.nickname || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold">{item.title}: {item.data?.nickname || "Unknown"}</p>
                    {item.data?.bio && <p className="text-muted-foreground">{item.data.bio}</p>}
                    {item.data?.instagramId && <p>Instagram: {item.data.instagramId}</p>}
                    {item.data?.snapchatId && <p>Snapchat: {item.data.snapchatId}</p>}
                    {item.data?.whatsapp && <p>WhatsApp: {item.data.whatsapp}</p>}
                    {item.data?.portfolioUrl && <p className="truncate">Portfolio: {item.data.portfolioUrl}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border p-3 bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Realtime Tic-Tac-Toe</p>
              <button className="text-xs underline" onClick={resetGame}>Reset</button>
            </div>
            {localProfile.isGuest && (
              <p className="text-[11px] text-muted-foreground mb-2">
                Sign in with Google to play realtime games.
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mb-2">
              You are <strong>{mySymbol}</strong>. {gameWinner ? (gameWinner === "draw" ? "Draw game." : `Winner: ${gameWinner}`) : `Turn: ${currentTurn}`}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {board.map((cell, idx) => (
                <button
                  key={idx}
                  className="h-10 rounded-md bg-background border border-border text-lg font-bold"
                  onClick={() => playMove(idx)}
                >
                  {cell}
                </button>
              ))}
            </div>
          </div>
          </div>

          {mode === "chat" && connectionState === "connected" && (
            <div className="absolute top-safe right-4 mt-4 z-40 flex items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-full">
                <div className="w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_hsl(142_76%_46%)]" style={{ backgroundColor: "hsl(142 76% 46%)" }} />
                <span className="text-xs font-medium text-foreground">Connected</span>
              </div>
              <button onClick={next} className="text-xs bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-full font-medium transition-colors">Skip</button>
              <button onClick={handleStop} className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1.5 rounded-full font-medium transition-colors">Stop</button>
            </div>
          )}
          <ChatPanel messages={messages} onSend={handleSend} strangerProfile={remoteProfile} />
        </div>
      )}
    </div>
  );
};

export default ChatRoom;
