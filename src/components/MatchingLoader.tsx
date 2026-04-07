import { useOnlineCount } from "@/hooks/useOnlineCount";

const MatchingLoader = () => {
  const onlineCount = useOnlineCount();

  return (
    <div className="flex flex-col items-center justify-center gap-6 animate-fade-in-up">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-accent/50 animate-ping" style={{ animationDelay: "0.3s" }} />
        <div className="absolute inset-4 rounded-full border-2 border-accent/70 animate-ping" style={{ animationDelay: "0.6s" }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-accent animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-2 max-w-xs">
        <p className="text-foreground text-xl font-semibold">
          Finding someone...
        </p>
        <p className="text-muted-foreground text-sm font-medium leading-relaxed bg-secondary/50 py-2 px-4 rounded-xl border border-white/5">
          {onlineCount <= 3 
            ? `There are only ${onlineCount} user${onlineCount === 1 ? '' : 's'} online. Please wait for a new stranger to join.` 
            : `Currently ${onlineCount} active users online.`}
        </p>
      </div>
    </div>
  );
};

export default MatchingLoader;
