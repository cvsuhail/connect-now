import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const OnlineCountContext = createContext<number>(0);

export const OnlineCountProvider = ({ children }: { children: ReactNode }) => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    
    // Subscribe to the global presence channel and track self
    const channel = supabase.channel('global-presence', {
      config: { presence: { key: crypto.randomUUID() } }
    });

    channel.on('presence', { event: 'sync' }, () => {
      if (!isMounted) return;
      
      const state = channel.presenceState();
      let total = 0;
      for (const key in state) {
        if (Object.prototype.hasOwnProperty.call(state, key)) {
          total += state[key].length;
        }
      }
      setCount(total);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && isMounted) {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
      <OnlineCountContext.Provider value={count}>
        {children}
      </OnlineCountContext.Provider>
  );
};

export const useOnlineCount = () => {
  return useContext(OnlineCountContext);
};
