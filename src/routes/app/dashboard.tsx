import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  BarChart3,
  CheckSquare,
  Layers,
  Users,
  Wallet,
  HeartHandshake,
  Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import {
  syncFn,
  transferFundsFn,
  financialStatsFn,
} from "@/lib/app.functions";
import { MZN, formatDate, formatDateTime, todayMaputo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ShareRewardCard } from "@/components/layout/ShareRewardCard";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { userId } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const sync = useServerFn(syncFn);

  const transferFunds = useServerFn(transferFundsFn);
const financialStats = useServerFn(financialStatsFn);

const [transferOpen, setTransferOpen] = useState(false);
const [statsOpen, setStatsOpen] = useState(false);
const [recipientId, setRecipientId] = useState("");
const [transferAmount, setTransferAmount] = useState("");
const [transferPurpose, setTransferPurpose] = useState<
  "DEPOSIT" | "WITHDRAWAL"
>("DEPOSIT");
const [transferLoading, setTransferLoading] = useState(false);
const [statsLoading, setStatsLoading] = useState(false);
const [stats, setStats] = useState<Awaited<
  ReturnType<typeof financialStats>
> | null>(null);

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
        .from(profile?.account_tier === "RECRUTA" ? "recruit_task_claims" : "task_claims")
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

  const openStatistics = async () => {
  setStatsOpen(true);

  if (stats) return;

  setStatsLoading(true);

  try {
    const result = await financialStats({
      data: undefined,
    });

    setStats(result);
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

  const submitTransfer = async () => {
  const amount = Number(transferAmount.replace(",", "."));

  if (!recipientId.trim()) {
    toast.error("Digite o ID do destinatário.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    toast.error("Digite um valor válido.");
    return;
  }

  setTransferLoading(true);

  try {
    const result = await transferFunds({
      data: {
        recipientPublicId: recipientId.trim().toUpperCase(),
        amount,
        purpose: transferPurpose,
        clientReference: crypto.randomUUID(),
      },
    });

    toast.success(result.message);

    setRecipientId("");
    setTransferAmount("");
    setTransferPurpose("DEPOSIT");
    setTransferOpen(false);

    await queryClient.invalidateQueries();
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "Não foi possível realizar a transferência.",
    );
  } finally {
    setTransferLoading(false);
  }
};

  return (
    <div className="space-y-6">
      <ShareRewardCard />
      <section className="overflow-hidden rounded-2xl bg-[image:var(--gradient-brand)] p-5 text-primary-foreground shadow-[var(--shadow-float)]">
  <p className="text-sm/none opacity-90">
    Olá, {profile?.full_name || "RECRUTA"} 👋
  </p>

  <div className="mt-3 flex items-end justify-between gap-2">
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-widest opacity-80">
        Saldo levantável
      </p>

      <p className="mt-0.5 text-3xl font-extrabold tracking-tight">
        {MZN(profile?.balance)}
      </p>
    </div>

    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={openStatistics}
      className="shrink-0 gap-1 px-2.5 text-xs font-semibold"
    >
      <BarChart3 className="size-3.5" />
      Ver estatísticas
    </Button>
  </div>

  <p className="mt-2 text-xs opacity-80">
    ID: {profile?.public_id ?? "—"}
  </p>

  <div className="mt-4 grid grid-cols-3 gap-2">
    <Link to="/app/plans" className="min-w-0">
      <Button
        variant="secondary"
        size="sm"
        className="w-full gap-1 px-1.5 text-xs"
      >
        <ArrowDownLeft className="size-3.5 shrink-0" />
        <span className="truncate">Depositar</span>
      </Button>
    </Link>

    <Link to="/app/wallet" className="min-w-0">
      <Button
        variant="secondary"
        size="sm"
        className="w-full gap-1 px-1.5 text-xs"
      >
        <ArrowUpRight className="size-3.5 shrink-0" />
        <span className="truncate">Sacar</span>
      </Button>
    </Link>

    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => setTransferOpen(true)}
      className="w-full min-w-0 gap-1 px-1.5 text-xs"
    >
      <ArrowLeftRight className="size-3.5 shrink-0" />
      <span className="truncate">Transferir</span>
    </Button>
  </div>
</section>

      {transferOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Transferir fundos</h2>
          <p className="text-sm text-muted-foreground">
            Envie fundos para outro utilizador.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTransferOpen(false)}
          className="rounded-full px-3 py-1 text-lg text-muted-foreground hover:bg-muted"
        >
          ×
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-medium">
            ID do destinatário
          </label>

          <input
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            placeholder="RI-XXXXXXXX"
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-sm font-medium">
            Valor
          </label>

          <input
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Ex.: 500"
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <p className="text-sm font-medium">
            Finalidade dos fundos
          </p>

          <div className="mt-2 grid gap-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
              <input
                type="radio"
                name="transfer-purpose"
                checked={transferPurpose === "DEPOSIT"}
                onChange={() => setTransferPurpose("DEPOSIT")}
                className="mt-1"
              />

              <span>
                <span className="block text-sm font-semibold">
                  Para depósito
                </span>
                <span className="block text-xs text-muted-foreground">
                  O destinatário não poderá levantar este valor.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
              <input
                type="radio"
                name="transfer-purpose"
                checked={transferPurpose === "WITHDRAWAL"}
                onChange={() => setTransferPurpose("WITHDRAWAL")}
                className="mt-1"
              />

              <span>
                <span className="block text-sm font-semibold">
                  Para levantamento
                </span>
                <span className="block text-xs text-muted-foreground">
                  O destinatário poderá utilizar este valor para saque.
                </span>
              </span>
            </label>
          </div>
        </div>

        <Button
          type="button"
          onClick={submitTransfer}
          disabled={transferLoading}
          className="w-full"
        >
          {transferLoading
            ? "A transferir..."
            : "Transferir fundos"}
        </Button>
      </div>
    </div>
  </div>
)}

      {statsOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Estatísticas</h2>
          <p className="text-sm text-muted-foreground">
            Resumo financeiro da sua conta.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setStatsOpen(false)}
          className="rounded-full px-3 py-1 text-lg text-muted-foreground hover:bg-muted"
        >
          ×
        </button>
      </div>

      {statsLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          A carregar estatísticas...
        </div>
      ) : stats ? (
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Saldo disponível"
              value={MZN(stats.balance)}
            />

            <StatCard
              label="Total investido"
              value={MZN(stats.totalInvested)}
            />

            <StatCard
              label="Total levantado"
              value={MZN(stats.totalWithdrawn)}
            />

            <StatCard
              label="Total transferido"
              value={MZN(stats.totalTransferred)}
            />
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-sm font-semibold">
              Ganhos
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-muted-foreground">
                  Hoje
                </p>
                <p className="mt-1 text-sm font-bold">
                  {MZN(stats.gainsToday)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Semana
                </p>
                <p className="mt-1 text-sm font-bold">
                  {MZN(stats.gainsWeek)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  Mês
                </p>
                <p className="mt-1 text-sm font-bold">
                  {MZN(stats.gainsMonth)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  </div>
)}

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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-base font-bold">
        {value}
      </p>
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
