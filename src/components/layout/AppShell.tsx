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
  LogOut,
  Megaphone,
  HeartHandshake,
  Loader2,
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
  { to: "/app/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/app/plans", label: "Planos", icon: Layers },
  { to: "/app/tasks", label: "Tarefas", icon: CheckSquare },
  { to: "/app/wallet", label: "Carteira", icon: Wallet },
  { to: "/app/team", label: "Equipa", icon: Users },
] as const;

const MORE = [
  { to: "/app/affiliate", label: "Afiliados", icon: Megaphone },
  { to: "/app/donations", label: "Doações", icon: HeartHandshake },
  { to: "/app/support", label: "Suporte", icon: LifeBuoy },
  { to: "/app/notifications", label: "Notificações", icon: Bell },
  { to: "/app/profile", label: "Perfil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, userId } = useSession();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useDeviceNotifications();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

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

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
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
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/app/dashboard" className="shrink-0">
            <Logo size={36} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-lg border border-border bg-secondary px-3 py-1.5 text-right sm:block">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo</p>
              <p className="text-sm font-bold text-foreground">{MZN(profile?.balance)}</p>
            </div>
            <SupportMenu />

            <Link to="/app/notifications" className="relative">
              <Button variant="ghost" size="icon" aria-label="Notificações">
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
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Shield className="size-4" /> <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair">
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            {allLinks.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
        <WelcomeGuide />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("size-5", active && "scale-110")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
