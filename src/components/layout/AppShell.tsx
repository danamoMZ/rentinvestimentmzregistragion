import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Layers,
  CheckSquare,
  Wallet,
  Users,
  LifeBuoy,
  Bell,
  User,
  Shield,
  ShieldAlert,
  LogOut,
  Megaphone,
  HeartHandshake,
  Loader2,
  Gamepad2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile, useSession } from "@/hooks/use-session";
import { useDeviceNotifications } from "@/hooks/use-device-notifications";
import { Logo } from "@/components/brand/Logo";
import { SupportMenu } from "@/components/layout/SupportMenu";
import { WelcomeGuide } from "@/components/layout/WelcomeGuide";
import { MZN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/app/dashboard", label: "LAR", icon: LayoutDashboard },
  { to: "/app/tasks", label: "TAREFAS", icon: CheckSquare },
  { to: "/app/plans", label: "PACOTES", icon: Layers },
  { to: "/app/profile", label: "CONTA", icon: User },
] as const;

const MORE = [
  { to: "/app/wallet", label: "Carteira", icon: Wallet },
  { to: "/app/team", label: "Equipa", icon: Users },
  { to: "/app/affiliate", label: "Afiliados", icon: Megaphone },
  { to: "/app/donations", label: "Doações", icon: HeartHandshake },
  { to: "/app/support", label: "Suporte", icon: LifeBuoy },
  { to: "/app/notifications", label: "Notificações", icon: Bell },
  { to: "/app/game", label: "Jogo", icon: Gamepad2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, userId } = useSession();
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useDeviceNotifications();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!userId || !session) return;
    const interval = window.setInterval(() => refetchProfile(), 5000);
    return () => window.clearInterval(interval);
  }, [userId, session, refetchProfile]);

  const { data: unread } = useQuery({
    queryKey: ["unread", userId],
    enabled: !!userId,
    refetchInterval: 60000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false)
        .or(`user_id.eq.${userId},user_id.is.null`);
      return count ?? 0;
    },
  });

  if (loading || !session || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  const isNewBlueOriginAccount =
    session.user.email?.toLowerCase().endsWith("@blueorigin.mz") === true;

  if (profile && profile.platform_version !== 2 && !isAdmin && !isNewBlueOriginAccount) {
    void supabase.auth.signOut().then(() => navigate({ to: "/auth", replace: true }));
    return null;
  }

  if (profile?.blocked === true) {
    const handleBlockedLogout = async () => {
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-destructive/30 bg-card shadow-2xl">
          <div className="bg-destructive px-6 py-8 text-center text-destructive-foreground">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-white/15">
              <ShieldAlert className="size-10" />
            </div>
            <h1 className="mt-5 text-3xl font-extrabold">Conta bloqueada</h1>
            <p className="mt-2 text-sm opacity-90">O acesso à sua conta foi temporariamente bloqueado.</p>
          </div>
          <div className="space-y-5 p-6 text-center">
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-semibold">O acesso à plataforma está impedido.</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Não pode utilizar o saldo, planos, tarefas, jogos, carteira ou outras funcionalidades enquanto a conta permanecer bloqueada.
              </p>
            </div>
            <Button type="button" variant="destructive" className="w-full gap-2 rounded-xl py-6 text-base font-bold" onClick={handleBlockedLogout}>
              <LogOut className="size-5" />
              Sair da conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const allLinks = [...NAV, ...MORE];

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <header className="hidden border-b border-border/70 bg-card/90 backdrop-blur-xl lg:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/app/dashboard" className="shrink-0" aria-label="Ir para o início">
            <Logo size={36} />
          </Link>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo</p>
              <p className="text-sm font-bold">{MZN(profile?.balance)}</p>
            </div>

            <SupportMenu />

            <Link to="/app/notifications" className="relative">
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notificações">
                <Bell className="size-5" />
              </Button>
              {!!unread && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
                  <Shield className="size-4" />
                  Admin
                </Button>
              </Link>
            )}

            <Link to="/app/profile" aria-label="Abrir meu perfil" className="flex size-11 items-center justify-center rounded-full bg-secondary">
              <User className="size-6 text-primary" />
            </Link>

            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair" className="rounded-full">
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-4 lg:py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-6 space-y-1">
            {allLinks.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
        <WelcomeGuide />
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 shadow-[0_-10px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden"
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid h-[78px] w-full max-w-lg grid-cols-4 px-3 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-center transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-2xl transition-all",
                    active && "bg-primary/12 shadow-[0_0_22px_rgba(34,197,94,0.18)]",
                  )}
                >
                  <item.icon className={cn("size-6", active && "fill-current")} strokeWidth={active ? 2.6 : 2} />
                </span>
                <span className="text-[11px] font-extrabold tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
