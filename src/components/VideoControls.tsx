import { Mic, MicOff, Video, VideoOff, SkipForward, X } from "lucide-react";

interface VideoControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onNext: () => void;
  onStop: () => void;
}

const VideoControls = ({ isMuted, isCameraOff, onToggleMute, onToggleCamera, onNext, onStop }: VideoControlsProps) => {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onNext}
        className="glass rounded-2xl p-3 transition-all duration-200 hover:scale-105 hover:shadow-[var(--glow-yellow)] active:bg-accent active:text-accent-foreground"
        title="Next"
      >
        <SkipForward className="w-5 h-5" />
      </button>
      <button
        onClick={onToggleMute}
        className={`glass rounded-2xl p-3 transition-all duration-200 hover:scale-105 ${isMuted ? "bg-accent text-accent-foreground" : ""}`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
      <button
        onClick={onToggleCamera}
        className={`glass rounded-2xl p-3 transition-all duration-200 hover:scale-105 ${isCameraOff ? "bg-accent text-accent-foreground" : ""}`}
        title={isCameraOff ? "Turn on camera" : "Turn off camera"}
      >
        {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
      </button>
      <button
        onClick={onStop}
        className="glass rounded-2xl p-3 transition-all duration-200 hover:scale-105 hover:bg-destructive hover:text-destructive-foreground"
        title="Stop"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default VideoControls;
