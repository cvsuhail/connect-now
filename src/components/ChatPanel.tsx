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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm text-center mt-8">
            Say hello to your stranger!
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "you" ? "justify-end" : "justify-start"} animate-slide-in-bottom`}
          >
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.sender === "you"
                  ? "bg-accent text-accent-foreground rounded-br-md"
                  : "bg-secondary text-secondary-foreground rounded-bl-md"
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
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-secondary text-foreground rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-accent placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            className="bg-accent text-accent-foreground rounded-xl p-2.5 transition-all duration-200 hover:scale-105"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
