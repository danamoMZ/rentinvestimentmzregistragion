import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckSquare,
  Layers,
  Users,
  Wallet,
  HeartHandshake,
  Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { syncFn } from "@/lib/app.functions";
import { MZN, formatDate, formatDateTime, todayMaputo } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { userId } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const sync = useServerFn(syncFn);

  useEffect(() => {
    sync({ data: undefined })
      .then(() => queryClient.invalidateQueries())
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: plan } = useQuery({
    queryKey: ["active-plan", userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = todayMaputo();
      const { data } = await supabase
        .from("user_plans")
        .select("*, plans(*)")
        .eq("user_id", userId!)
        .eq("status", "ACTIVE")
        .lte("start_date", today)
        .gte("end_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: todayClaims } = useQuery({
    queryKey: ["today-claims", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from("task_claims")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("task_date", todayMaputo());
      return count ?? 0;
    },
  });

  const { data: ledger } = useQuery({
    queryKey: ["recent-ledger", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
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

  const planRow = plan?.plans as { name: string; daily_task_count: number; daily_income: number } | undefined;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-[image:var(--gradient-brand)] p-6 text-primary-foreground shadow-[var(--shadow-float)]">
        <p className="text-sm/none opacity-90">Olá, {profile?.full_name || "investidor"} 👋</p>
        <p className="mt-3 text-xs uppercase tracking-widest opacity-80">Saldo disponível</p>
        <p className="text-4xl font-extrabold tracking-tight">{MZN(profile?.balance)}</p>
        <p className="mt-2 text-xs opacity-80">ID: {profile?.public_id ?? "—"}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/app/plans">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <ArrowDownLeft className="size-4" /> Depositar
            </Button>
          </Link>
          <Link to="/app/wallet">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <ArrowUpRight className="size-4" /> Sacar
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="surface-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="size-4 text-primary" /> Plano ativo
          </div>
          {planRow ? (
            <>
              <p className="mt-2 text-2xl font-bold">{planRow.name}</p>
              <p className="text-sm text-muted-foreground">
                Válido até {formatDate(plan?.end_date)} · {MZN(planRow.daily_income)}/dia
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">Ainda não tem um plano ativo.</p>
              <Link to="/app/plans">
                <Button size="sm" className="mt-3">
                  Ver planos
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="surface-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckSquare className="size-4 text-primary" /> Tarefas de hoje
          </div>
          <p className="mt-2 text-2xl font-bold">
            {todayClaims ?? 0}
            <span className="text-base font-medium text-muted-foreground">/{planRow?.daily_task_count ?? 0}</span>
          </p>
          <Link to="/app/tasks">
            <Button size="sm" variant="outline" className="mt-3">
              Ir para tarefas
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink to="/app/team" icon={Users} label="Equipa" sub={`${teamCount ?? 0} convidados`} />
        <QuickLink to="/app/affiliate" icon={Megaphone} label="Afiliados" sub="Ganhe extra" />
        <QuickLink to="/app/donations" icon={HeartHandshake} label="Doações" sub="+15% em 30 dias" />
        <QuickLink to="/app/wallet" icon={Wallet} label="Carteira" sub="Histórico" />
      </section>

      <section className="surface-card p-4">
        <h2 className="text-sm font-semibold">Movimentos recentes</h2>
        <div className="mt-3 divide-y divide-border">
          {(ledger ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há movimentos.</p>
          )}
          {(ledger ?? []).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(tx.created_at)}</p>
              </div>
              <span
                className={`shrink-0 text-sm font-bold ${Number(tx.amount) >= 0 ? "text-success" : "text-destructive"}`}
              >
                {Number(tx.amount) >= 0 ? "+" : ""}
                {MZN(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  sub,
}: {
  to: string;
  icon: typeof Users;
  label: string;
  sub: string;
}) {
  return (
    <Link to={to} className="surface-card flex flex-col gap-1 p-3 transition-shadow hover:shadow-[var(--shadow-float)]">
      <Icon className="size-5 text-primary" />
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </Link>
  );
}
