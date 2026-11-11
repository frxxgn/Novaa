import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, KeyRound, Loader2, MailCheck } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useAuth } from "@/app/auth";
import { useI18n } from "@/i18n";
import { useSeo } from "@/hooks/useSeo";
import { supabase } from "@/lib/supabase";
import { safeStorage } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { Logo, NovaliusMark } from "@/components/brand/Logo";

function authError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(message)) return "Tienes que verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.";
  if (/already registered|already been registered/i.test(message)) return "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.";
  if (/rate limit|too many/i.test(message)) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  if (/weak|password should/i.test(message)) return "La contraseña es demasiado débil: usa al menos 10 caracteres con letras y números.";
  if (/expired|invalid/i.test(message)) return "El enlace no es válido o ha caducado. Solicita uno nuevo.";
  return message;
}

/** Solo se permiten redirecciones internas (evita open redirect). */
function safeNext(next: string | null, fallback = "/cuenta"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="tone-dark relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-28">
      <div className="grid-lines absolute inset-0 opacity-40" aria-hidden />
      <div className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, var(--nv-primary), transparent)" }} aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="glass rounded-lg p-7 shadow-2xl sm:p-9">
          <NovaliusMark className="size-12" />
          <h1 className="mt-6 font-display text-3xl tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </section>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useSeo({ title: "Iniciar sesión", noindex: true });

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  return (
    <AuthShell
      title={t("auth.login_title")}
      subtitle="Accede a tus presupuestos, proyectos y cupones."
      footer={
        <>
          {t("auth.no_account")}{" "}
          <Link to={`/registro${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-lavender underline underline-offset-4">
            Crear cuenta
          </Link>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          setLoading(false);
          if (err) setError(authError(err.message));
          else navigate(next, { replace: true });
        }}
      >
        <Input label={t("auth.email")} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label={t("auth.password")} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link to="/recuperar" className="justify-self-end text-xs text-lavender underline underline-offset-4">
          {t("auth.forgot")}
        </Link>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" loading={loading}>
          Iniciar sesión
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  useSeo({ title: "Crear cuenta", noindex: true });

  if (done) {
    return (
      <AuthShell title="Revisa tu correo" subtitle={`Te hemos enviado un enlace de verificación a ${form.email}.`}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <MailCheck className="size-12 text-lavender" />
          <p className="text-sm text-muted">Pulsa el enlace del correo para activar tu cuenta. Si no lo ves, revisa la carpeta de spam.</p>
          <Link to="/login" className="text-sm text-lavender underline underline-offset-4">
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("auth.register_title")}
      subtitle="Guarda presupuestos, juega en Novalius Challenge y sigue tus proyectos."
      footer={
        <>
          {t("auth.have_account")}{" "}
          <Link to="/login" className="text-lavender underline underline-offset-4">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!accept) {
            setError("Debes aceptar los términos y la política de privacidad.");
            return;
          }
          if (form.password.length < 10 || !/[a-z]/i.test(form.password) || !/\d/.test(form.password)) {
            setError("La contraseña debe tener al menos 10 caracteres e incluir letras y números.");
            return;
          }
          setLoading(true);
          safeStorage.set("nv-after-verify", next);
          const { error: err } = await supabase.auth.signUp({
            email: form.email.trim(),
            password: form.password,
            options: { data: { full_name: form.name.trim(), company: form.company.trim() }, emailRedirectTo: `${window.location.origin}/auth/confirmar` },
          });
          setLoading(false);
          if (err) setError(authError(err.message));
          else setDone(true);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t("auth.name")} required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t("auth.company")} maxLength={160} autoComplete="organization" hint="Opcional" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </div>
        <Input label={t("auth.email")} type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label={t("auth.password")} type="password" required minLength={10} autoComplete="new-password" hint="Mínimo 10 caracteres, con letras y números." value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Checkbox
          checked={accept}
          onChange={setAccept}
          required
          label={
            <>
              Acepto los{" "}
              <Link to="/terminos" target="_blank" className="text-lavender underline">
                términos
              </Link>{" "}
              y la{" "}
              <Link to="/privacidad" target="_blank" className="text-lavender underline">
                política de privacidad
              </Link>
              .
            </>
          }
        />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" loading={loading}>
          Crear cuenta
        </Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useSeo({ title: "Recuperar contraseña", noindex: true });
  return (
    <AuthShell title="Recupera tu contraseña" subtitle="Te enviaremos un enlace seguro para crear una nueva." footer={<Link to="/login" className="text-lavender underline underline-offset-4">Volver a iniciar sesión</Link>}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <MailCheck className="size-12 text-lavender" />
          <p className="text-sm text-muted">Si existe una cuenta con {email}, recibirás un correo con el enlace en unos minutos.</p>
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/confirmar` });
            setLoading(false);
            // Por privacidad, no se revela si el correo existe
            if (err && /rate limit|too many/i.test(err.message)) setError(authError(err.message));
            else setSent(true);
          }}
        >
          <Input label="Correo electrónico" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" size="lg" loading={loading}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

/** Destino de los enlaces de los correos de Auth (verificación, recuperación, invitación). */
export function ConfirmPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  useSeo({ title: "Verificando", noindex: true });

  useEffect(() => {
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") ?? "email") as EmailOtpType;
    const next = safeNext(params.get("next") ?? safeStorage.get("nv-after-verify"));
    safeStorage.remove("nv-after-verify");
    if (!tokenHash) {
      setError("El enlace no es válido.");
      return;
    }
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error: err }) => {
      if (err) {
        setError(authError(err.message));
        return;
      }
      setOk(true);
      if (type === "recovery" || type === "invite") navigate("/restablecer", { replace: true });
      else setTimeout(() => navigate(next === "/cuenta" ? "/cuenta?verificado=1" : next, { replace: true }), 1200);
    });
  }, [params, navigate]);

  return (
    <AuthShell title={error ? "No se pudo verificar" : ok ? "¡Listo!" : "Verificando…"}>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {error ? (
          <>
            <Notice tone="danger">{error}</Notice>
            <Link to="/login" className="text-sm text-lavender underline underline-offset-4">
              Ir a iniciar sesión
            </Link>
          </>
        ) : ok ? (
          <CheckCircle2 className="size-12 text-success" />
        ) : (
          <Loader2 className="size-10 animate-spin text-lavender" />
        )}
      </div>
    </AuthShell>
  );
}

/** Nueva contraseña (tras recuperación o invitación). Requiere sesión válida. */
export function ResetPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useSeo({ title: "Nueva contraseña", noindex: true });

  if (ready && !user) {
    return (
      <AuthShell title="Enlace caducado" subtitle="Solicita un nuevo enlace de recuperación.">
        <Link to="/recuperar" className="text-sm text-lavender underline underline-offset-4">
          Recuperar contraseña
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crea una nueva contraseña" subtitle={user?.email}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (password !== repeat) return setError("Las contraseñas no coinciden.");
          if (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password)) return setError("Mínimo 10 caracteres, con letras y números.");
          setLoading(true);
          const { error: err } = await supabase.auth.updateUser({ password });
          setLoading(false);
          if (err) setError(authError(err.message));
          else navigate("/cuenta?password=1", { replace: true });
        }}
      >
        <Input label="Nueva contraseña" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input label="Repite la contraseña" type="password" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" loading={loading} icon={<KeyRound className="size-4" />}>
          Guardar contraseña
        </Button>
      </form>
    </AuthShell>
  );
}

export function RequireAuth({ children, permission, staff }: { children: ReactNode; permission?: string; staff?: boolean }) {
  const { user, ready, can, isStaff, configured } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !user) navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`, { replace: true });
  }, [ready, user, navigate]);
  if (!configured) {
    return (
      <div className="tone-dark flex min-h-[100svh] items-center justify-center p-6">
        <Notice tone="warning">El backend (Supabase) no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.</Notice>
      </div>
    );
  }
  if (!ready || !user) {
    return (
      <div className="tone-dark flex min-h-[100svh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-lavender" />
      </div>
    );
  }
  if ((staff && !isStaff) || (permission && !can(permission))) {
    return (
      <div className="tone-dark flex min-h-[100svh] flex-col items-center justify-center gap-4 p-6 text-center">
        <Logo />
        <h1 className="font-display text-2xl">Acceso restringido</h1>
        <p className="max-w-md text-muted">Tu cuenta no tiene permisos para acceder a esta sección.</p>
        <Link to="/" className="text-lavender underline underline-offset-4">
          Volver al inicio
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
