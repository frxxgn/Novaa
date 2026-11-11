import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/index.css";
import { router } from "./app/router";
import { SiteProvider, useSite } from "./app/site";
import { AuthProvider } from "./app/auth";
import { PrefsProvider } from "./app/prefs";
import { I18nProvider } from "./i18n";
import { ToastProvider } from "./components/ui/feedback";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

function Localized() {
  const { settings, translations } = useSite();
  return (
    <I18nProvider enabled={settings.locales?.enabled ?? ["es"]} defaultLocale={settings.locales?.default ?? "es"} overrides={translations}>
      <PrefsProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </PrefsProvider>
    </I18nProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SiteProvider>
        <AuthProvider>
          <Localized />
        </AuthProvider>
      </SiteProvider>
    </QueryClientProvider>
  </StrictMode>,
);
