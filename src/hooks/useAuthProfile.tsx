import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserProfile = {
  nickname: string;
  photoUrl: string;
  instagramId: string;
  snapchatId: string;
  bio: string;
  whatsapp: string;
  portfolioUrl: string;
  isGuest: boolean;
};

const PROFILE_STORAGE_KEY = "connect-now-profile";

const emptyProfile: UserProfile = {
  nickname: "",
  photoUrl: "",
  instagramId: "",
  snapchatId: "",
  bio: "",
  whatsapp: "",
  portfolioUrl: "",
  isGuest: true,
};

type AuthProfileContextType = {
  session: Session | null;
  isAuthenticated: boolean;
  profile: UserProfile;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
  saveProfile: (next: Partial<UserProfile>) => Promise<UserProfile>;
};

const AuthProfileContext = createContext<AuthProfileContextType | null>(null);

const getGoogleDefaultNickname = (session: Session | null) => {
  const metadata = session?.user?.user_metadata;
  return metadata?.full_name || metadata?.name || metadata?.email?.split("@")[0] || "";
};

const getGooglePhoto = (session: Session | null) => {
  const metadata = session?.user?.user_metadata;
  return metadata?.avatar_url || metadata?.picture || "";
};

const getOAuthRedirectUrl = () => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/?auth=callback`;
};

export const AuthProfileProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);

  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch {
        setProfile(emptyProfile);
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (!session) return;
    setProfile((prev) => ({
      ...prev,
      isGuest: false,
      nickname: prev.nickname || getGoogleDefaultNickname(session),
      photoUrl: prev.photoUrl || getGooglePhoto(session),
    }));
  }, [session]);

  const signInWithGoogle = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Supabase environment variables are missing.");
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getOAuthRedirectUrl(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) throw error;
  };

  const signInAsGuest = () => {
    setSession(null);
    setProfile((prev) => ({ ...prev, isGuest: true }));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile((prev) => ({ ...prev, isGuest: true }));
  };

  const saveProfile = async (next: Partial<UserProfile>) => {
    const merged: UserProfile = {
      ...profile,
      ...next,
      isGuest: !session,
    };

    if (!merged.nickname.trim()) {
      merged.nickname = getGoogleDefaultNickname(session) || "Guest";
    }
    if (!merged.photoUrl.trim()) {
      merged.photoUrl = getGooglePhoto(session);
    }

    setProfile(merged);

    if (session) {
      await supabase.auth.updateUser({
        data: {
          nickname: merged.nickname,
          photo_url: merged.photoUrl,
          instagram_id: merged.instagramId,
          snapchat_id: merged.snapchatId,
          bio: merged.bio,
          whatsapp: merged.whatsapp,
          portfolio_url: merged.portfolioUrl,
        },
      });
    }

    return merged;
  };

  const value = {
    session,
    isAuthenticated: Boolean(session),
    profile,
    loading,
    signInWithGoogle,
    signInAsGuest,
    signOut,
    saveProfile,
  };

  return <AuthProfileContext.Provider value={value}>{children}</AuthProfileContext.Provider>;
};

export const useAuthProfile = () => {
  const ctx = useContext(AuthProfileContext);
  if (!ctx) {
    throw new Error("useAuthProfile must be used within AuthProfileProvider");
  }
  return ctx;
};
