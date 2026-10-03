import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckSquare,
  Coins,
  Layers,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Wallet,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import {
  financialStatsFn,
  syncFn,
} from "@/lib/app.functions";
import { MZN, formatDate, todayMaputo } from "@/lib/format";
import { getPlanImage } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

const SERVICES = [
  { label: "Recarregar", icon: Wallet, to: "/app/plans" },
  { label: "Retirar", icon: Coins, to: "/app/wallet" },
  { label: "Configurações", icon: Settings, to: "/app/profile" },
  { label: "Mensagens", icon: MessageCircle, to: "/app/notifications" },
  { label: "Perfil", icon: UserRoundCog, to: "/app/profile" },
] as const;

function Dashboard() {
  const { userId } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const sync = useServerFn(syncFn);
  const financialStats = useServerFn(financialStatsFn);
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof financialStats>> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    sync({ data: undefined })
      .then(() => queryClient.invalidateQueries())
      .catch(() => undefined);
  }, [queryClient, sync]);

  const { data: plan } = useQuery({
    queryKey: ["active-plan", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("*, plans(*)")
        .eq("user_id", userId!)
        .eq("status", "ACTIVE")
        .lte("start_date", todayMaputo())
        .gte("end_date", todayMaputo())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: todayClaims } = useQuery({
    queryKey: ["today-claims", userId],
    enabled: !!userId,
    queryFn: async () => {
      const table =
        profile?.account_tier === "RECRUTA"
          ? "recruit_task_claims"
          : "task_claims";

      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("task_date", todayMaputo());

      return count ?? 0;
    },
  });

  const { data: teamCount } = useQuery({
    queryKey: ["team-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", userId!);

      return count ?? 0;
    },
  });

  const planRow = plan?.plans as
    | {
        name: string;
        daily_task_count: number;
        daily_income: number;
        duration_days: number;
      }
    | undefined;

  const activeNode = planRow?.name ?? "Estagiário";

  const nodes = useMemo(
    () => ["Estagiário", "VIP1", "VIP2", "VIP3", "VIP4", "VIP5", "VIP6", "VIP7", "VIP8"],
    [],
  );

  const openStatistics = async () => {
    setStatsOpen(true);
    if (stats) return;

    setStatsLoading(true);
    try {
      setStats(await financialStats({ data: undefined }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as estatísticas.",
      );
      setStatsOpen(false);
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <div className="blue-home space-y-5">
      <section className="blue-hero relative overflow-hidden">
        <img
          src={getPlanImage(1)}
          alt="Máquina e tecnologia BLUE ORIGIN"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,10,7,0.08),rgba(2,10,7,0.9))]" />
        <div className="relative flex min-h-[205px] flex-col justify-between p-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
              BLUE ORIGIN
            </span>
            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold text-primary-foreground">
              OFICIAL
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-primary">ECOSSISTEMA BLUE ORIGIN</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Bem-vindo, {profile?.full_name || "RECRUTA"}
            </h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-white/70">
              Acompanhe tarefas, VIPs, carteira e movimentos da sua conta num único lugar.
            </p>
          </div>
        </div>
      </section>

      <section className="blue-welcome flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Zap className="size-5 fill-current" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            Bem-vindo ao Ecossistema BLUE ORIGIN
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Conta {profile?.account_tier || "RECRUTA"} · ID {profile?.public_id || "—"}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-extrabold tracking-tight">Serviços pessoais</h2>
          <button
            type="button"
            onClick={openStatistics}
            className="text-xs font-bold text-primary"
          >
            ESTATÍSTICAS
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <Link
                key={service.label}
                to={service.to}
                className="blue-service group flex min-w-0 flex-col items-center gap-2 rounded-2xl p-2 text-center"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary transition-transform group-active:scale-95">
                  <Icon className="size-5" strokeWidth={2.5} />
                </span>
                <span className="w-full truncate text-[10px] font-bold text-muted-foreground">
                  {service.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h2 className="text-xl font-extrabold tracking-tight">Nós ativos</h2>
          </div>
          <span className="text-xs font-bold text-primary">STATUS</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {nodes.map((node) => {
            const active = node === activeNode;
            return (
              <Link
                key={node}
                to={node === "Estagiário" ? "/app/tasks" : "/app/plans"}
                className={`blue-node relative min-h-[112px] rounded-3xl p-4 transition-transform active:scale-[0.98] ${active ? "blue-node-active" : ""}`}
              >
                {active && (
                  <span className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <ShieldCheck className="size-4" />
                  </span>
                )}
                <p className="text-center text-lg font-extrabold">{node}</p>
                <p className="mt-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-primary">
                  {active ? "CONECTADO" : "SINCRONIZAÇÃO"}
                </p>
                {!active && (
                  <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-wider text-primary/80">
                    NECESSÁRIA
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="blue-balance rounded-3xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Saldo levantável
            </p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">{MZN(profile?.balance)}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl"
            onClick={openStatistics}
            aria-label="Ver estatísticas"
          >
            <BarChart3 className="size-5" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/app/plans">
            <Button className="w-full gap-2 rounded-2xl">
              <ArrowDownLeft className="size-4" />
              Recarregar
            </Button>
          </Link>
          <Link to="/app/wallet">
            <Button variant="secondary" className="w-full gap-2 rounded-2xl">
              <ArrowUpRight className="size-4" />
              Retirar
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Metric label="Tarefas concluídas" value={String(todayClaims ?? 0)} icon={CheckSquare} />
        <Metric label="Equipa" value={String(teamCount ?? 0)} icon={UserRoundCog} />
        <Metric label="Plano atual" value={planRow?.name ?? "Nenhum"} icon={Package} />
        <Metric
          label="Renda diária"
          value={planRow ? MZN(planRow.daily_income) : "0,00 MZN"}
          icon={Coins}
        />
      </section>

      <section className="blue-shortcuts">
        <Shortcut icon={CheckSquare} title="Tarefas diárias" description="Assista aos vídeos e acompanhe o progresso." to="/app/tasks" />
        <Shortcut icon={Package} title="Pacotes VIP" description="Veja os VIPs disponíveis e os seus detalhes." to="/app/plans" />
        <Shortcut icon={Wallet} title="Carteira" description="Consulte saldo, depósitos e levantamentos." to="/app/wallet" />
        <Shortcut icon={MessageCircle} title="Central de suporte" description="Entre em contacto com a equipa." to="/app/support" />
      </section>

      {statsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Estatísticas</h2>
                <p className="mt-1 text-sm text-muted-foreground">Resumo da sua conta.</p>
              </div>
              <button
                type="button"
                onClick={() => setStatsOpen(false)}
                className="rounded-full px-3 py-1 text-lg text-muted-foreground hover:bg-secondary"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {statsLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">A carregar...</div>
            ) : stats ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Saldo" value={MZN(stats.balance)} />
                <Metric label="Investido" value={MZN(stats.totalInvested)} />
                <Metric label="Levantado" value={MZN(stats.totalWithdrawn)} />
                <Metric label="Transferido" value={MZN(stats.totalTransferred)} />
              </div>
            ) : null}

            <Button className="mt-5 w-full rounded-2xl" onClick={() => setStatsOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Coins;
}) {
  return (
    <div className="blue-metric rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-primary" /> : null}
      </div>
      <p className="mt-2 text-lg font-extrabold">{value}</p>
    </div>
  );
}

function Shortcut({
  icon: Icon,
  title,
  description,
  to,
}: {
  icon: typeof Coins;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-border/70 py-4 last:border-0"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
