import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useOnlineCount = () => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    
    // Subscribe to the global presence channel without tracking self
    // (self is tracked in App.tsx PresenceProvider)
    const channel = supabase.channel('global-presence');

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

    channel.subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
};
