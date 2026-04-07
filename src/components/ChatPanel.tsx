import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

export interface ChatMessage {
  id: string;
  text: string;
  sender: "you" | "stranger";
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isTyping?: boolean;
}

const ChatPanel = ({ messages, onSend, isTyping }: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-secondary/20">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center mt-8 rounded-xl border border-dashed border-border p-5 bg-background/60">
            <p className="text-muted-foreground text-sm">Say hello to your stranger!</p>
            <p className="text-[11px] text-muted-foreground mt-1">Keep it respectful and friendly.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "you" ? "justify-end" : "justify-start"} animate-slide-in-bottom`}
          >
            <div
              className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                msg.sender === "you"
                  ? "bg-accent text-accent-foreground rounded-br-md"
                  : "bg-background border border-border text-secondary-foreground rounded-bl-md"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-slide-in-bottom">
            <div className="bg-secondary text-muted-foreground px-4 py-2.5 rounded-2xl rounded-bl-md text-sm italic">
              Stranger is typing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 pb-safe border-t border-border bg-background/95 backdrop-blur">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-secondary text-foreground rounded-xl px-4 py-3 text-sm outline-none border border-transparent focus:border-accent/40 focus:ring-2 focus:ring-accent/30 placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            className="bg-accent text-accent-foreground rounded-xl px-4 py-3 transition-all duration-200 hover:scale-105 hover:shadow-md flex items-center justify-center shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
