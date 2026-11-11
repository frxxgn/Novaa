import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Send } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { Badge, useToast } from "@/components/ui/feedback";
import { AdminPage } from "../components/ui";
import { ResourceManager } from "../components/ResourceManager";

export default function CustomersAdmin() {
  const toast = useToast();
  const qc = useQueryClient();
  const invite = useMutation({
    mutationFn: (id: string) => api<{ invited: boolean }>(`/admin/customers/${id}/invite`, { body: {} }),
    onSuccess: (r) => {
      toast("success", r.invited ? "Invitación enviada" : "Acceso al portal activado", r.invited ? "El cliente recibirá un correo para crear su contraseña." : "La cuenta existente ya puede ver sus proyectos.");
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
    onError: (e) => toast("error", "No se pudo invitar", errorMessage(e)),
  });
  return (
    <AdminPage title="Clientes" description="Empresas y personas con proyectos. Vincúlalos a una cuenta para que accedan a su portal privado (/cuenta), donde solo ven su propia información.">
      <ResourceManager
        config={{
          table: "customers",
          permission: "customers.manage",
          title: "Clientes",
          singular: "cliente",
          orderBy: [{ column: "created_at", ascending: false }],
          searchKeys: ["name", "email", "contact_name", "phone"],
          defaults: { name: "", contact_name: "", email: "", phone: "", tax_id: "", notes: "" },
          columns: [
            { key: "name", label: "Cliente", render: (r) => <span><span className="block font-medium">{String(r.name)}</span><span className="text-xs text-muted">{String(r.email)}</span></span> },
            { key: "contact_name", label: "Contacto", hideOnMobile: true },
            { key: "user_id", label: "Portal", render: (r) => <Badge tone={r.user_id ? "success" : "neutral"}>{r.user_id ? "Con acceso" : "Sin cuenta"}</Badge> },
          ],
          rowActions: (r) => (
            <>
              <Link to={`/admin/proyectos?cliente=${r.id}`} className="rounded p-1.5 text-muted hover:bg-white/10" title="Proyectos" aria-label="Proyectos del cliente">
                <FolderKanban className="size-4" />
              </Link>
              {!r.user_id && (
                <button className="rounded p-1.5 text-muted hover:bg-white/10" title="Invitar al portal" aria-label="Invitar al portal" onClick={() => invite.mutate(String(r.id))}>
                  <Send className="size-4" />
                </button>
              )}
            </>
          ),
          visibilityField: undefined,
          orderable: false,
          fields: [
            { name: "name", label: "Nombre o razón social", type: "text", required: true },
            { name: "contact_name", label: "Persona de contacto", type: "text" },
            { name: "email", label: "Correo", type: "email", required: true },
            { name: "phone", label: "Teléfono", type: "text" },
            { name: "tax_id", label: "NIF/CIF", type: "text" },
            { name: "notes", label: "Notas internas", type: "textarea" },
            { name: "user_id", label: "Cuenta vinculada", type: "readonly", help: "Usa el botón «Invitar al portal» de la lista para crear o vincular la cuenta." },
          ],
        }}
      />
    </AdminPage>
  );
}
