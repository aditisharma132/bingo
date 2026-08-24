import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "creator" | "brand" | "admin";

export type CreatorProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  onboarding_completed: boolean;
};

export type BrandProfileRow = {
  id: string;
  user_id: string;
  brand_name: string;
  onboarding_completed: boolean;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  creator: CreatorProfileRow | null;
  brand: BrandProfileRow | null;
  displayName: string;
  needsOnboarding: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [creator, setCreator] = useState<CreatorProfileRow | null>(null);
  const [brand, setBrand] = useState<BrandProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setRole(null);
      setCreator(null);
      setBrand(null);
      return;
    }
    const [{ data: roles }, { data: creatorRow }, { data: brandRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("creator_profiles")
        .select("id, user_id, display_name, onboarding_completed")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("brand_profiles")
        .select("id, user_id, brand_name, onboarding_completed")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const list = (roles ?? []).map((r) => r.role as AppRole);
    setRole(list.includes("admin") ? "admin" : (list[0] ?? null));
    setCreator(creatorRow ?? null);
    setBrand(brandRow ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      await loadProfile(data.session?.user.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(nextSession);
      void loadProfile(nextSession?.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(() => {
    const user = session?.user ?? null;
    const displayName =
      creator?.display_name ||
      brand?.brand_name ||
      (user?.user_metadata?.["full_name"] as string | undefined) ||
      user?.email ||
      "";
    const needsOnboarding =
      !!user &&
      ((role === "creator" && !creator?.onboarding_completed) ||
        (role === "brand" && !brand?.onboarding_completed) ||
        role === null);

    return {
      loading,
      session,
      user,
      role,
      creator,
      brand,
      displayName,
      needsOnboarding,
      refresh: async () => loadProfile(session?.user.id),
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setRole(null);
        setCreator(null);
        setBrand(null);
      },
    };
  }, [loading, session, role, creator, brand, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
