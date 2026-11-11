import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { api, errorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/feedback";

/** Lee y guarda una clave de site_settings (con permisos validados por RLS). */
export function useSetting<T extends Record<string, unknown>>(key: string, fallback: T) {
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["admin", "setting", key],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("value, updated_at").eq("key", key).maybeSingle();
      if (error) throw error;
      return { ...fallback, ...((data?.value as T) ?? {}) } as T;
    },
  });
  const save = useMutation({
    mutationFn: async (value: T) => {
      const { error } = await supabase.from("site_settings").update({ value }).eq("key", key);
      if (error) throw error;
      await api("/admin/cache/clear", { body: {} }).catch(() => undefined);
    },
    onSuccess: () => {
      toast("success", "Configuración guardada");
      void qc.invalidateQueries({ queryKey: ["admin", "setting", key] });
      void qc.invalidateQueries({ queryKey: ["site-bundle"] });
    },
    onError: (e) => toast("error", "No se pudo guardar", errorMessage(e)),
  });
  return { query, save };
}

export interface StaffMember {
  id: string;
  email: string;
  full_name: string;
}

export function useStaff() {
  return useQuery({
    queryKey: ["admin", "staff"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_staff");
      if (error) throw error;
      return (data ?? []) as (StaffMember & { roles: string[] })[];
    },
    staleTime: 60_000,
  });
}
