import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LockKeyhole, LogOut } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { data: profile, isLoading } = useProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">
          A verificar a sua conta...
        </p>
      </div>
    );
  }

  if (profile?.blocked === true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <LockKeyhole className="size-8 text-destructive" />
          </div>

          <h1 className="text-2xl font-bold text-destructive">
            Conta bloqueada
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            A sua conta foi bloqueada pelo administrador.
          </p>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            O acesso ao painel e às funcionalidades da plataforma está
            temporariamente impedido.
          </p>

          <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-medium">
              Não é possível utilizar esta conta enquanto ela estiver
              bloqueada.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground"
          >
            <LogOut className="mr-2 size-4" />
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
