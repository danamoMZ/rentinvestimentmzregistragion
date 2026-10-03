import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Coins, CreditCard, Crown, Loader2, Upload, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { depositFn, purchasePlanFn } from "@/lib/app.functions";
import { getPlanImage } from "@/lib/brand";
import { MZN, PAYMENT_FIELDS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/plans")({
  component: Plans,
});

type Plan = {
  id: number;
  name: string;
  price: number;
  daily_income: number;
  daily_task_count: number;
  task_value: number;
  total_task_income: number;
  duration_days: number;
};

const PLAN_GRADIENTS = [
  "bg-[linear-gradient(135deg,#174f39,#0d3024)]",
  "bg-[linear-gradient(135deg,#334c9b,#1d326e)]",
  "bg-[linear-gradient(135deg,#6b2495,#41115f)]",
  "bg-[linear-gradient(135deg,#bd4b1e,#7f2d16)]",
  "bg-[linear-gradient(135deg,#245d43,#143b2b)]",
  "bg-[linear-gradient(135deg,#344c9d,#24366f)]",
  "bg-[linear-gradient(135deg,#6d2698,#461364)]",
  "bg-[linear-gradient(135deg,#bf4b1d,#7f2d16)]",
  "bg-[linear-gradient(135deg,#28302d,#1b211f)]",
  "bg-[linear-gradient(135deg,#173e67,#102c4b)]",
  "bg-[linear-gradient(135deg,#244e78,#173653)]",
];

function Plans() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const deposit = useServerFn(depositFn);
  const purchase = useServerFn(purchasePlanFn);

  const [amount, setAmount] = useState("");
  const [sender, setSender] = useState("");
  const [txId, setTxId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyingPlanId, setBuyingPlanId] = useState<number | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-vip-balances", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("balance, promotional_balance")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as { balance: number; promotional_balance: number } | null;
    },
  });

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("sort_order")
        .order("id");
      if (error) throw error;
      return data as Plan[];
    },
  });

  const { data: activePlan } = useQuery({
    queryKey: ["active-plan", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("plan_id, status")
        .eq("user_id", userId!)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings-public"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });

  const { data: pending } = useQuery({
    queryKey: ["pending-deposit", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("deposit_requests")
        .select("*")
        .eq("user_id", userId!)
        .eq("status", "PENDING")
        .maybeSingle();
      return data;
    },
  });

  const vipCredits = Number(profile?.promotional_balance ?? 0);
  const cashBalance = Number(profile?.balance ?? 0);
  const rechargeAmount = Number(amount || 0);
  const rechargeCredit = rechargeAmount > 0 ? rechargeAmount * 3 : 0;

  const submitRecharge = async () => {
    if (!userId) {
      toast.error("Não foi possível identificar a sua conta.");
      return;
    }
    if (!Number.isFinite(rechargeAmount) || rechargeAmount <= 0) {
      toast.error("Informe um valor de recarga maior que 0 MZN.");
      return;
    }
    if (!sender.trim() || !txId.trim()) {
      toast.error("Preencha o número usado no pagamento e o ID da transação.");
      return;
    }
    if (pending) {
      toast.error("Já existe uma recarga em análise. Aguarde a aprovação.");
      return;
    }

    setBusy(true);
    try {
      let proofPath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("proofs").upload(path, file);
        if (error) throw new Error(`Falha ao enviar o comprovativo: ${error.message}`);
        proofPath = path;
      }

      await deposit({
        data: {
          amount: rechargeAmount,
          senderNumber: sender,
          transactionId: txId,
          proofPath,
        },
      });

      toast.success("Recarga enviada. Aguarde a aprovação do administrador.");
      setAmount("");
      setSender("");
      setTxId("");
      setFile(null);
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a recarga.");
    } finally {
      setBusy(false);
    }
  };

  const buyWithCredits = async (plan: Plan) => {
    if (!userId) {
      toast.error("Não foi possível identificar a sua conta.");
      return;
    }
    if (vipCredits < Number(plan.price)) {
      toast.error(
        `Créditos VIP insuficientes. O VIP ${plan.id} custa ${MZN(plan.price)} e você tem ${MZN(vipCredits)}.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Ativar VIP ${plan.id} por ${MZN(plan.price)} usando exclusivamente os seus créditos VIP?

Créditos actuais: ${MZN(vipCredits)}
Créditos depois da compra: ${MZN(vipCredits - Number(plan.price))}`,
    );
    if (!confirmed) return;

    setBuyingPlanId(plan.id);
    try {
      const result = await purchase({ data: { planId: plan.id } });
      toast.success(
        `${result.planName} ativado com sucesso! Créditos VIP restantes: ${MZN(result.promotionalBalance)}.`,
      );
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ativar o VIP.");
    } finally {
      setBuyingPlanId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <section className="surface-card overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#0d2f4d,#092238)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Coins className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">Créditos para VIPs</h1>
              <p className="text-xs text-white/65">
                As recargas aprovadas são convertidas em créditos exclusivos para ativação de VIPs.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Créditos VIP</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{MZN(vipCredits)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Saldo levantável</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{MZN(cashBalance)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <h2 className="font-extrabold">Recarregar</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Exemplo: uma recarga de 100 MZN, depois de aprovada pelo administrador, gera 300 MZN em créditos VIP. Estes créditos não entram no saldo levantável.
            </p>
          </div>

          {pending && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-bold">Recarga em análise</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Valor enviado: {MZN(pending.amount)} · crédito previsto: {MZN(Number(pending.amount) * 3)}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="recharge-amount">Valor da recarga (MZN)</Label>
            <Input
              id="recharge-amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              disabled={!!pending}
            />
          </div>

          {rechargeAmount > 0 && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Crédito VIP após aprovação</span>
                <strong className="text-lg text-primary">{MZN(rechargeCredit)}</strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Conversão: 1 MZN de recarga = 3 MZN em créditos VIP.</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sender">Número usado no pagamento</Label>
              <Input id="sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="84 000 0000" disabled={!!pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txid">ID da transação</Label>
              <Input id="txid" value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="Ex.: PP2504..." disabled={!!pending} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proof">Comprovativo (opcional)</Label>
            <Input id="proof" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={!!pending} />
          </div>

          <Button className="w-full rounded-2xl" onClick={submitRecharge} disabled={busy || !!pending}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Upload className="mr-2 size-4" />
            Enviar recarga para aprovação
          </Button>

          <div className="rounded-2xl border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Dados de pagamento</p>
            <div className="mt-2 grid gap-2">
              {PAYMENT_FIELDS.map((field) => {
                const value = settings?.[field.key] || "";
                return (
                  <div key={field.key} className="flex items-center justify-between gap-3">
                    <span>{field.label}</span>
                    <span className="font-bold text-foreground">{value || "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Privilégios VIP</h2>
          <p className="text-sm text-muted-foreground">
            VIP 1 a VIP 11 · percorra a lista para ver o valor e os benefícios de cada plano.
          </p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}

        {(plans ?? []).map((plan, index) => {
          const active = activePlan?.plan_id === plan.id;
          const enough = vipCredits >= Number(plan.price);
          return (
            <article key={plan.id} className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-[var(--shadow-card)]">
              <div className={`relative min-h-[180px] overflow-hidden p-6 text-white ${PLAN_GRADIENTS[index] ?? PLAN_GRADIENTS[0]}`}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative z-10 pr-28">
                  <p className="text-3xl font-extrabold tracking-tight">VIP {plan.id}</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-sm font-bold backdrop-blur">
                    <CalendarDays className="size-4" />
                    Ciclo: {plan.duration_days} dias
                  </div>
                </div>
                <img
                  src={settings?.[`plan_${plan.id}_image_url`] || getPlanImage(plan.id)}
                  alt={`Ícone VIP ${plan.id}`}
                  className="absolute right-5 top-5 size-28 object-contain drop-shadow-2xl sm:size-32"
                />
              </div>

              <div className="space-y-0 px-6 py-5">
                <PlanRow icon={<Coins className="size-5" />} label="Recompensa por tarefa" value={MZN(plan.task_value)} />
                <PlanRow icon={<Zap className="size-5" />} label="Limite diário de tarefas" value={`${plan.daily_task_count} tarefas`} />
                <PlanRow icon={<CreditCard className="size-5" />} label="Taxa de ativação" value={MZN(plan.price)} />
                <PlanRow icon={<Wallet className="size-5" />} label="Rendimento diário" value={MZN(plan.daily_income)} />

                <div className="pt-5">
                  <Button
                    className="h-14 w-full rounded-2xl text-base font-extrabold shadow-lg"
                    disabled={active || !enough || !!pending || buyingPlanId === plan.id}
                    onClick={() => buyWithCredits(plan)}
                  >
                    {buyingPlanId === plan.id ? (
                      <><Loader2 className="mr-2 size-5 animate-spin" /> A ativar...</>
                    ) : active ? (
                      <><Crown className="mr-2 size-5" /> PLANO ATUAL</>
                    ) : enough ? (
                      <><Crown className="mr-2 size-5" /> PLANO DE ATUALIZAÇÃO</>
                    ) : (
                      `PRECISA DE ${MZN(Number(plan.price) - vipCredits)} CRÉDITOS`
                    )}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function PlanRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-border/70 py-4 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-primary">{icon}</span>
        <span className="text-sm font-semibold text-muted-foreground sm:text-base">{label}</span>
      </div>
      <span className="shrink-0 text-base font-extrabold sm:text-lg">{value}</span>
    </div>
  );
}
