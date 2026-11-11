import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";
import { Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import CmsPage from "@/pages/CmsPage";

const ServiceDetailPage = lazy(() => import("@/pages/ServiceDetailPage"));
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage"));
const TemplateDetailPage = lazy(() => import("@/pages/TemplatePages").then((m) => ({ default: m.TemplateDetailPage })));
const DemoPage = lazy(() => import("@/pages/TemplatePages").then((m) => ({ default: m.DemoPage })));
const Auth = {
  Login: lazy(() => import("@/features/auth/AuthPages").then((m) => ({ default: m.LoginPage }))),
  Register: lazy(() => import("@/features/auth/AuthPages").then((m) => ({ default: m.RegisterPage }))),
  Forgot: lazy(() => import("@/features/auth/AuthPages").then((m) => ({ default: m.ForgotPage }))),
  Confirm: lazy(() => import("@/features/auth/AuthPages").then((m) => ({ default: m.ConfirmPage }))),
  Reset: lazy(() => import("@/features/auth/AuthPages").then((m) => ({ default: m.ResetPage }))),
  Require: lazy(() => import("@/features/auth/AuthPages").then((m) => ({ default: m.RequireAuth }))),
};
const Account = {
  Layout: lazy(() => import("@/features/account/AccountPages").then((m) => ({ default: m.AccountLayout }))),
  Dashboard: lazy(() => import("@/features/account/AccountPages").then((m) => ({ default: m.AccountDashboard }))),
  Projects: lazy(() => import("@/features/account/AccountPages").then((m) => ({ default: m.AccountProjects }))),
  Project: lazy(() => import("@/features/account/AccountPages").then((m) => ({ default: m.AccountProjectDetail }))),
  Quotes: lazy(() => import("@/features/account/AccountPages").then((m) => ({ default: m.AccountQuotes }))),
  Coupons: lazy(() => import("@/features/account/AccountPages").then((m) => ({ default: m.AccountCoupons }))),
  Conversations: lazy(() => import("@/features/account/AccountPages").then((m) => ({ default: m.AccountConversations }))),
  Profile: lazy(() => import("@/features/account/AccountPages").then((m) => ({ default: m.AccountProfile }))),
};
const AdminApp = lazy(() => import("@/features/admin/AdminApp"));
const PreviewPage = lazy(() => import("@/features/admin/pages/PreviewPage"));

function Loading() {
  return (
    <div className="tone-dark flex min-h-[100svh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-lavender" aria-label="Cargando" />
    </div>
  );
}

const s = (node: ReactNode) => <Suspense fallback={<Loading />}>{node}</Suspense>;

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <CmsPage path="/" /> },
      { path: "servicios/:slug", element: s(<ServiceDetailPage />) },
      { path: "proyectos/:slug", element: s(<ProjectDetailPage />) },
      { path: "plantillas/:slug", element: s(<TemplateDetailPage />) },
      { path: "login", element: s(<Auth.Login />) },
      { path: "registro", element: s(<Auth.Register />) },
      { path: "recuperar", element: s(<Auth.Forgot />) },
      { path: "restablecer", element: s(<Auth.Reset />) },
      { path: "auth/confirmar", element: s(<Auth.Confirm />) },
      {
        path: "cuenta",
        element: s(
          <Auth.Require>
            <Account.Layout />
          </Auth.Require>,
        ),
        children: [
          { index: true, element: s(<Account.Dashboard />) },
          { path: "proyectos", element: s(<Account.Projects />) },
          { path: "proyectos/:id", element: s(<Account.Project />) },
          { path: "presupuestos", element: s(<Account.Quotes />) },
          { path: "cupones", element: s(<Account.Coupons />) },
          { path: "conversaciones", element: s(<Account.Conversations />) },
          { path: "perfil", element: s(<Account.Profile />) },
        ],
      },
      // Cualquier otra ruta se resuelve contra las páginas del CMS (o 404)
      { path: "*", element: <CmsPage /> },
    ],
  },
  { path: "demo/:slug", element: s(<DemoPage />) },
  {
    path: "admin/*",
    element: s(
      <Auth.Require staff>
        <AdminApp />
      </Auth.Require>,
    ),
  },
  {
    path: "__preview/*",
    element: s(
      <Auth.Require permission="content.manage">
        <PreviewPage />
      </Auth.Require>,
    ),
  },
]);
