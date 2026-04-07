import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Video, MessageSquare, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface StartChatFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartChatFlow = ({ isOpen, onClose }: StartChatFlowProps) => {
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const navigate = useNavigate();

  const handleClose = () => {
    onClose();
  };

  const handleAgeConsent = async (isAdult: boolean) => {
    if (!isAdult) {
      toast.error("Sorry, you must be 18 or older to use this service.");
      handleClose();
      return;
    }

    setIsRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      toast.success("Camera permission granted!");
      navigate("/chat?mode=video");
    } catch (err) {
      toast.error("Camera permission is required for video chat.");
    } finally {
      setIsRequestingCamera(false);
    }
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
              <motion.div
                key="step1"
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

                <div className="flex w-full gap-4 mt-4 relative">
                  {isRequestingCamera && (
                    <div className="absolute inset-0 z-10 bg-card/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => handleAgeConsent(false)}
                    disabled={isRequestingCamera}
                    className="flex-1 py-3 px-4 rounded-xl font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-all duration-300"
                  >
                    No, I am not
                  </button>
                  <button
                    onClick={() => handleAgeConsent(true)}
                    disabled={isRequestingCamera}
                    className="flex-1 py-3 px-4 rounded-xl font-medium bg-foreground text-background hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 glow-button"
                  >
                    Yes, I am 18+
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
