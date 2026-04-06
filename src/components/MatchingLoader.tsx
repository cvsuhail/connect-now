const MatchingLoader = () => {
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
      <p className="text-muted-foreground text-lg font-medium">
        Finding someone for you...
      </p>
    </div>
  );
};

export default MatchingLoader;
