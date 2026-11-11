import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export interface Access {
  roles: string[];
  permissions: string[];
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  access: Access;
  ready: boolean;
  configured: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  can: (permission: string) => boolean;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
}

const EMPTY: Access = { roles: [], permissions: [] };
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>(EMPTY);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  // Los permisos se piden al servidor (función my_access): la interfaz los usa
  // para mostrar u ocultar opciones, pero la base de datos los vuelve a validar.
  const loadAccess = useCallback(async (s: Session | null) => {
    if (!s) {
      setAccess(EMPTY);
      return;
    }
    const { data } = await supabase.rpc("my_access");
    const a = (data ?? {}) as Partial<Access>;
    setAccess({ roles: a.roles ?? [], permissions: a.permissions ?? [] });
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setReady(true);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadAccess(data.session);
      if (mounted) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void loadAccess(s);
        void qc.invalidateQueries({ queryKey: ["me"] });
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadAccess, qc]);

  const value = useMemo<AuthCtx>(() => {
    const isAdmin = access.roles.includes("admin");
    return {
      session,
      user: session?.user ?? null,
      access,
      ready,
      configured: supabaseConfigured,
      isAdmin,
      isStaff: isAdmin || access.roles.includes("team"),
      can: (p: string) => isAdmin || access.permissions.includes(p),
      refreshAccess: () => loadAccess(session),
      signOut: async () => {
        await supabase.auth.signOut();
        qc.clear();
      },
    };
  }, [session, access, ready, loadAccess, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
