import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Video, MessageSquare, AlertTriangle, LogIn, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface StartChatFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartChatFlow = ({ isOpen, onClose }: StartChatFlowProps) => {
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [step, setStep] = useState<"age" | "auth" | "profile" | "mode">("age");
  const [form, setForm] = useState({
    nickname: "",
    photoUrl: "",
    instagramId: "",
    snapchatId: "",
    bio: "",
    whatsapp: "",
    portfolioUrl: "",
  });
  const navigate = useNavigate();
  const { profile, isAuthenticated, signInWithGoogle, signInAsGuest, saveProfile } = useAuthProfile();

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      nickname: profile.nickname || "",
      photoUrl: profile.photoUrl || "",
      instagramId: profile.instagramId || "",
      snapchatId: profile.snapchatId || "",
      bio: profile.bio || "",
      whatsapp: profile.whatsapp || "",
      portfolioUrl: profile.portfolioUrl || "",
    });
    setStep(isAuthenticated ? "profile" : "age");
  }, [isOpen, isAuthenticated, profile]);

  const handleClose = () => {
    onClose();
  };

  const handleAgeConsent = async (isAdult: boolean) => {
    if (!isAdult) {
      toast.error("Sorry, you must be 18 or older to use this service.");
      handleClose();
      return;
    }

    setStep("auth");
  };

  const requestCameraIfNeeded = async (mode: "video" | "chat") => {
    if (mode !== "video") return true;
    setIsRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      toast.error("Camera permission is required for video chat.");
      return false;
    } finally {
      setIsRequestingCamera(false);
    }
  };

  const startChat = async (mode: "video" | "chat") => {
    const ok = await requestCameraIfNeeded(mode);
    if (!ok) return;
    const saved = await saveProfile(form);
    sessionStorage.setItem("active-profile", JSON.stringify(saved));
    navigate(`/chat?mode=${mode}`);
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unsupported provider")) {
        toast.error("Google auth is not enabled in Supabase yet. Enable Google provider in Auth settings.");
        return;
      }
      toast.error("Google login failed. Please try again.");
    }
  };

  const handleGuest = () => {
    signInAsGuest();
    setStep("profile");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-card border shadow-2xl p-6 md:p-8"
          >
            <button
              onClick={handleClose}
              disabled={isRequestingCamera}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>

            <AnimatePresence mode="wait">
              {step === "age" && (
                <motion.div
                  key="age"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col items-center text-center gap-6"
                >
                  <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="space-y-2 relative">
                    <h2 className="text-2xl font-bold">Age Verification</h2>
                    <p className="text-muted-foreground">
                      This service requires users to be at least 18 years old. Are you 18 or older?
                    </p>
                  </div>
                  <div className="flex w-full gap-4 mt-4">
                    <button
                      onClick={() => handleAgeConsent(false)}
                      className="flex-1 py-3 px-4 rounded-xl font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-300"
                    >
                      No, I am not
                    </button>
                    <button
                      onClick={() => handleAgeConsent(true)}
                      className="flex-1 py-3 px-4 rounded-xl font-medium bg-foreground text-background hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 glow-button"
                    >
                      Yes, I am 18+
                    </button>
                  </div>
                </motion.div>
              )}

              {step === "auth" && (
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col gap-4"
                >
                  <h2 className="text-2xl font-bold text-center">Choose how to continue</h2>
                  <Button onClick={handleGoogle} className="w-full h-12">
                    <LogIn className="w-4 h-4" /> Continue with Google
                  </Button>
                  <Button onClick={handleGuest} variant="secondary" className="w-full h-12">
                    <UserRound className="w-4 h-4" /> Continue as Guest
                  </Button>
                </motion.div>
              )}

              {step === "profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1"
                >
                  <h2 className="text-2xl font-bold">Set up your profile</h2>
                  <Input placeholder="Nickname (optional)" value={form.nickname} onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))} />
                  <Input placeholder="Profile photo URL (optional)" value={form.photoUrl} onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))} />
                  <Input placeholder="Instagram ID (optional)" value={form.instagramId} onChange={(e) => setForm((p) => ({ ...p, instagramId: e.target.value }))} />
                  <Input placeholder="Snapchat ID (optional)" value={form.snapchatId} onChange={(e) => setForm((p) => ({ ...p, snapchatId: e.target.value }))} />
                  <Input placeholder="WhatsApp (optional)" value={form.whatsapp} onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))} />
                  <Input placeholder="Portfolio link (optional)" value={form.portfolioUrl} onChange={(e) => setForm((p) => ({ ...p, portfolioUrl: e.target.value }))} />
                  <Textarea placeholder="Bio (optional)" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} />
                  <Button onClick={() => setStep("mode")} className="mt-2">Continue</Button>
                </motion.div>
              )}

              {step === "mode" && (
                <motion.div
                  key="mode"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <h2 className="text-2xl font-bold text-center">Pick chat mode</h2>
                  <button
                    onClick={() => startChat("video")}
                    className="w-full py-4 rounded-xl bg-accent text-accent-foreground font-semibold flex items-center justify-center gap-2"
                    disabled={isRequestingCamera}
                  >
                    <Video size={20} />
                    Start Video Chat
                  </button>
                  <button
                    onClick={() => startChat("chat")}
                    className="w-full py-4 rounded-xl border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors font-semibold flex items-center justify-center gap-2"
                    disabled={isRequestingCamera}
                  >
                    <MessageSquare size={20} />
                    Start Text Chat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
