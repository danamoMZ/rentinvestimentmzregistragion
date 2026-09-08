import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SessionState = {
  session: Session | null;
  userId: string | null;
  loading: boolean;
};

const SessionContext = createContext<SessionState>({
  session: null,
  userId: null,
  loading: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      // Mantém a sessão iniciada: renovações de token não devem "deslogar" o utilizador.
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        if (nextSession) setSession(nextSession);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        queryClient.clear();
        return;
      }
      setSession(nextSession);
      setLoading(false);
      if (nextSession) queryClient.invalidateQueries();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Ao voltar à aplicação, revalida/renova a sessão guardada em vez de exigir novo login.
    const revalidate = () => {
      if (document.visibilityState !== "visible") return;
      supabase.auth.getSession().then(({ data }) => {
        if (active && data.session) setSession(data.session);
      });
    };
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("focus", revalidate);

    return () => {
      active = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("focus", revalidate);
    };
  }, [queryClient]);

  return (
    <SessionContext.Provider value={{ session, userId: session?.user.id ?? null, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export type Profile = {
  id: string;
  public_id: string;
  full_name: string;
  email: string;
  phone: string;
  wallet_number: string;
  province: string;
  district: string;
  avatar_url: string | null;
  balance: number;
  blocked: boolean;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
};

export function useProfile() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useIsAdmin() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}
