import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { registerAuthenticatedUser } from "@/lib/adminStore";

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
  shouldSetupProfile: boolean;
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

const hasProfileData = (p: UserProfile) => {
  return Boolean(
    p.nickname.trim() ||
      p.bio.trim() ||
      p.instagramId.trim() ||
      p.snapchatId.trim() ||
      p.whatsapp.trim() ||
      p.portfolioUrl.trim() ||
      p.photoUrl.trim()
  );
};

const parseProfileFromSession = (session: Session | null): Partial<UserProfile> => {
  const metadata = session?.user?.user_metadata ?? {};
  return {
    nickname: (metadata.nickname as string) || getGoogleDefaultNickname(session),
    photoUrl: (metadata.photo_url as string) || getGooglePhoto(session),
    instagramId: (metadata.instagram_id as string) || "",
    snapchatId: (metadata.snapchat_id as string) || "",
    bio: (metadata.bio as string) || "",
    whatsapp: (metadata.whatsapp as string) || "",
    portfolioUrl: (metadata.portfolio_url as string) || "",
  };
};

const getOAuthRedirectUrl = () => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/?auth=callback`;
};

export const AuthProfileProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [shouldSetupProfile, setShouldSetupProfile] = useState(false);

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
    if (!session) {
      setShouldSetupProfile(false);
      return;
    }

    const metadata = session.user.user_metadata ?? {};
    const fromSupabase = parseProfileFromSession(session);
    const profileCompleted = metadata.profile_completed === true;

    setProfile((prev) => {
      const merged = {
        ...prev,
        ...fromSupabase,
        isGuest: false,
      };
      setShouldSetupProfile(!profileCompleted && !hasProfileData(merged));
      return merged;
    });

    registerAuthenticatedUser({
      id: session.user.id,
      email: session.user.email,
      nickname: fromSupabase.nickname,
      photoUrl: fromSupabase.photoUrl,
    });
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
    setProfile({ ...emptyProfile, isGuest: true });
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
          email: session.user.email || undefined,
          nickname: merged.nickname,
          photo_url: merged.photoUrl,
          instagram_id: merged.instagramId,
          snapchat_id: merged.snapchatId,
          bio: merged.bio,
          whatsapp: merged.whatsapp,
          portfolio_url: merged.portfolioUrl,
          profile_completed: true,
        },
      });
      setShouldSetupProfile(false);
    }

    return merged;
  };

  const value = {
    session,
    isAuthenticated: Boolean(session),
    shouldSetupProfile,
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
