import { useState } from "react";
import Particles from "@/components/Particles";
import { motion } from "framer-motion";
import { StartChatFlow } from "@/components/StartChatFlow";
import { useOnlineCount } from "@/hooks/useOnlineCount";
import { Users } from "lucide-react";

const Landing = () => {
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const onlineCount = useOnlineCount();

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center px-6 overflow-hidden">
      <Particles />

      {/* Gradient glow behind CTA */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.6, 0.8, 0.6]
        }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        style={{
          background: "radial-gradient(circle, hsl(var(--accent)/0.15) 0%, transparent 70%)",
          willChange: "transform, opacity"
        }}
        className="absolute w-[600px] h-[600px] md:w-[1000px] md:h-[1000px] rounded-full z-0 pointer-events-none" 
      />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full">
        {/* Active Users Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-md rounded-full border border-border"
        >
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </div>
          <span className="text-sm font-medium text-foreground tracking-wide flex items-center gap-1.5">
            <Users size={14} className="text-muted-foreground" />
            {onlineCount.toLocaleString()} {onlineCount === 1 ? "User" : "Users"} Online
          </span>
        </motion.div>

        {/* Logo */}
        <motion.h1 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="text-6xl md:text-8xl font-black tracking-tight text-foreground drop-shadow-sm"
        >
          U<motion.span 
              initial={{ color: "hsl(var(--foreground))" }}
              animate={{ color: "hsl(var(--accent))" }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-accent"
            >MI</motion.span>GLE
        </motion.h1>

        {/* Tagline */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-muted-foreground text-lg md:text-2xl text-center max-w-lg leading-relaxed font-medium"
        >
          Talk to strangers. Face to face. Instantly.
        </motion.p>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05, boxShadow: "0 0 30px hsl(var(--accent)/0.5)" }}
          whileTap={{ scale: 0.95 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 400, damping: 10 }}
          onClick={() => setIsFlowOpen(true)}
          className="relative bg-accent text-accent-foreground font-bold text-xl md:text-2xl px-12 py-5 rounded-full mt-6 overflow-hidden group"
        >
          <span className="relative z-10">Start Chatting</span>
          <div className="absolute inset-0 h-full w-0 bg-white/20 transition-all duration-300 ease-out group-hover:w-full z-0" />
        </motion.button>
      </div>

      <StartChatFlow isOpen={isFlowOpen} onClose={() => setIsFlowOpen(false)} />

      {/* Footer */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-6 z-10 text-sm md:text-base font-medium text-muted-foreground/80"
      >
        Created with ❤️ by{" "}
        <a 
          href="https://suhail.awwads.in" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-foreground hover:text-accent transition-colors underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
        >
          CV
        </a>
      </motion.div>
    </div>
  );
};

export default Landing;

