import { useNavigate } from "react-router-dom";
import Particles from "@/components/Particles";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      <Particles />

      {/* Gradient glow behind CTA */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-accent/10 blur-[120px] animate-pulse-glow z-0" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-fade-in-up">
        {/* Logo */}
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-foreground">
          U<span className="text-accent">MI</span>GLE
        </h1>

        {/* Tagline */}
        <p className="text-muted-foreground text-lg md:text-xl text-center max-w-md leading-relaxed">
          Talk to strangers. Face to face. Instantly.
        </p>

        {/* CTA */}
        <button
          onClick={() => navigate("/chat")}
          className="glow-button bg-accent text-accent-foreground font-semibold text-lg px-10 py-4 rounded-2xl mt-4"
        >
          Start Chatting
        </button>
      </div>
    </div>
  );
};

export default Landing;
