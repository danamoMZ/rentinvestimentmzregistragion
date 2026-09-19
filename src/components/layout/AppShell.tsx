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
  {
    to: "/app/dashboard",
    label: "Início",
    icon: LayoutDashboard,
  },
  {
    to: "/app/plans",
    label: "Planos",
    icon: Layers,
  },
  {
    to: "/app/tasks",
    label: "Tarefas",
    icon: CheckSquare,
  },
  {
    to: "/app/game",
    label: "Jogo",
    icon: Gamepad2,
  },
  {
    to: "/app/wallet",
    label: "Carteira",
    icon: Wallet,
  },
  {
    to: "/app/team",
    label: "Equipa",
    icon: Users,
  },
] as const;

const MORE = [
  {
    to: "/app/affiliate",
    label: "Afiliados",
    icon: Megaphone,
  },
  {
    to: "/app/donations",
    label: "Doações",
    icon: HeartHandshake,
  },
  {
    to: "/app/support",
    label: "Suporte",
    icon: LifeBuoy,
  },
  {
    to: "/app/notifications",
    label: "Notificações",
    icon: Bell,
  },
  {
    to: "/app/profile",
    label: "Perfil",
    icon: User,
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, userId } = useSession();
const navigate = useNavigate();

const {
  data: profile,
  isLoading: profileLoading,
  refetch: refetchProfile,
} = useProfile();

const { data: isAdmin } = useIsAdmin();

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  useDeviceNotifications();

  useEffect(() => {
    if (!loading && !session) {
      navigate({
        to: "/auth",
        replace: true,
      });
    }
  }, [loading, session, navigate]);

  useEffect(() => {
  if (!userId || !session) return;

  const interval = window.setInterval(() => {
    refetchProfile();
  }, 5000);

  return () => {
    window.clearInterval(interval);
  };
}, [userId, session, refetchProfile]);

  const { data: unread } = useQuery({
    queryKey: ["unread", userId],
    enabled: !!userId,
    refetchInterval: 60000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("read", false)
        .or(`user_id.eq.${userId},user_id.is.null`);

      return count ?? 0;
    },
  });

  if (loading || !session || profileLoading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
  }

  if (profile?.blocked === true) {
  const handleBlockedLogout = async () => {
    await supabase.auth.signOut();

    navigate({
      to: "/auth",
      replace: true,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-3xl border border-destructive/30 bg-card shadow-2xl">
          <div className="bg-destructive px-6 py-8 text-center text-destructive-foreground">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-white/15">
              <ShieldAlert className="size-10" />
            </div>

            <h1 className="mt-5 text-3xl font-extrabold">
              Conta bloqueada
            </h1>

            <p className="mt-2 text-sm opacity-90">
              O acesso à sua conta foi temporariamente bloqueado.
            </p>
          </div>

          <div className="space-y-5 p-6 text-center">
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-semibold text-foreground">
                O acesso à plataforma está impedido.
              </p>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Não pode utilizar o saldo, planos, tarefas, jogos,
                carteira ou outras funcionalidades enquanto a conta
                permanecer bloqueada.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Estado da conta
              </p>

              <p className="mt-1 text-lg font-bold text-destructive">
                BLOQUEADA
              </p>
            </div>

            <Button
              type="button"
              variant="destructive"
              className="w-full gap-2 rounded-xl py-6 text-base font-bold"
              onClick={handleBlockedLogout}
            >
              <LogOut className="size-5" />
              Sair da conta
            </Button>

            <p className="text-xs leading-5 text-muted-foreground">
              Se acredita que este bloqueio foi feito por engano,
              entre em contacto com o suporte da plataforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();

    navigate({
      to: "/auth",
      replace: true,
    });
  };

  const allLinks = [...NAV, ...MORE];

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">

      {/* =========================
          CABEÇALHO SUPERIOR
          ========================= */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">

          {/* LOGO */}
          <Link
            to="/app/dashboard"
            className="shrink-0"
            aria-label="Ir para o início"
          >
            <Logo size={36} />
          </Link>

          {/* AÇÕES DO CABEÇALHO */}
          <div className="flex items-center gap-2">

            {/* SALDO */}
            <div className="hidden rounded-lg border border-border bg-secondary px-3 py-1.5 text-right sm:block">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Saldo
              </p>

              <p className="text-sm font-bold text-foreground">
                {MZN(profile?.balance)}
              </p>
            </div>

            {/* SUPORTE */}
            <SupportMenu />

            {/* NOTIFICAÇÕES */}
            <Link
              to="/app/notifications"
              className="relative shrink-0"
              aria-label="Abrir notificações"
            >
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Notificações"
              >
                <Bell className="size-5" />
              </Button>

              {!!unread && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {/* ADMIN */}
            {isAdmin && (
              <Link to="/admin">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-full"
                >
                  <Shield className="size-4" />

                  <span className="hidden sm:inline">
                    Admin
                  </span>
                </Button>
              </Link>
            )}

            {/* PERFIL */}
            <Link
              to="/app/profile"
              aria-label="Abrir meu perfil"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-soft)] shadow-md transition-transform hover:shadow-lg active:scale-95"
            >
              <User className="size-6 text-primary-foreground" />
            </Link>

            {/* SAIR */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sair"
              className="rounded-full"
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* =========================
          CONTEÚDO PRINCIPAL
          ========================= */}
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">

        {/* MENU DESKTOP */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">

            {allLinks.map((item) => {
              const active = pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
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

        {/* PÁGINA */}
        <main className="min-w-0 flex-1">
          {children}
        </main>

        <WelcomeGuide />
      </div>

      {/* =========================
          MENU INFERIOR MOBILE
          ========================= */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl lg:hidden"
        aria-label="Navegação principal"
      >
        <div className="mx-auto grid w-full max-w-lg grid-cols-6 px-1 pb-[env(safe-area-inset-bottom)]">

          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className="group relative flex min-w-0 flex-col items-center justify-center py-2.5 text-center"
              >

                {/* =========================
                    BOTÃO ATIVO — CIRCULAR
                    ========================= */}
                {active ? (
                  <>
                    <span
                      className="flex size-[50px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_5px_18px_rgba(14,165,233,0.40)] transition-all duration-200 group-hover:scale-105 group-active:scale-95"
                    >
                      <item.icon
                        className="size-6"
                        strokeWidth={2.5}
                      />
                    </span>

                    <span className="mt-1 text-[10px] font-bold leading-none text-primary">
                      {item.label}
                    </span>
                  </>
                ) : (

                  /* =========================
                     BOTÃO NORMAL — SIMPLES
                     ========================= */
                  <>
                    <span className="flex size-[50px] items-center justify-center rounded-full text-muted-foreground transition-all duration-200 group-hover:bg-secondary group-hover:text-foreground group-active:scale-95">
                      <item.icon
                        className="size-5"
                        strokeWidth={2}
                      />
                    </span>

                    <span className="mt-1 w-full truncate px-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                      {item.label}
                    </span>
                  </>
                )}

              </Link>
            );
          })}

        </div>
      </nav>
    </div>
  );
}
