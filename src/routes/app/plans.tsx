import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Crown,
  Loader2,
  Smartphone,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { depositFn, purchasePlanFn } from "@/lib/app.functions";
import { getPlanImage } from "@/lib/brand";
import { MZN, PAYMENT_FIELDS, RECHARGE_QUICK_AMOUNT_DEFAULTS } from "@/lib/format";
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

type RechargeMethod = "mpesa" | "emola" | "p20" | "bnb" | "usdt";

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

  const [step, setStep] = useState<"amount" | "method" | "payment" | "submitted">("amount");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<RechargeMethod | null>(null);
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
  const rechargeCredit = rechargeAmount * 3;
  const minRecharge = Number(settings?.['recharge_min_amount'] || 200);

  const quickAmounts = useMemo(() => {
    const raw = settings?.['recharge_quick_amounts']?.trim();
    if (!raw) return [...RECHARGE_QUICK_AMOUNT_DEFAULTS];
    const values = raw
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    return values.length ? values : [...RECHARGE_QUICK_AMOUNT_DEFAULTS];
  }, [settings?.['recharge_quick_amounts']]);

  const methods = useMemo(() => {
    const list: { id: RechargeMethod; label: string; account: string; holder: string; color: string }[] = [
      { id: "mpesa", label: "M-Pesa", account: settings?.['payment_mpesa'] || "", holder: settings?.['payment_mpesa_holder'] || settings?.['payment_holder'] || "", color: "text-red-600" },
      { id: "emola", label: "E-Mola", account: settings?.['payment_emola'] || "", holder: settings?.['payment_emola_holder'] || settings?.['payment_holder'] || "", color: "text-orange-600" },
      { id: "p20", label: "P20", account: settings?.['payment_p20'] || "", holder: "", color: "text-primary" },
      { id: "bnb", label: "BNB", account: settings?.['payment_bnb'] || "", holder: "", color: "text-yellow-600" },
      { id: "usdt", label: "USDT TRC20", account: settings?.['payment_usdt_trc20'] || "", holder: "", color: "text-emerald-600" },
    ];
    return list.filter((item) => item.account.trim());
  }, [settings]);

  const selectedMethod = methods.find((item) => item.id === method);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const startRecharge = () => {
    if (!Number.isFinite(rechargeAmount) || rechargeAmount < minRecharge) {
      toast.error(`A recarga mínima é ${MZN(minRecharge)}.`);
      return;
    }
    if (pending) {
      toast.error("Já existe uma recarga em análise. Aguarde a aprovação.");
      return;
    }
    setStep("method");
  };

  const chooseMethod = (value: RechargeMethod) => {
    setMethod(value);
    setStep("payment");
  };

  const submitRecharge = async () => {
    if (!userId || !selectedMethod) return;
    if (!sender.trim()) {
      toast.error("Introduza a conta/número que utilizou para pagar.");
      return;
    }
    if (!txId.trim()) {
      toast.error("Introduza o ID ou referência da transação.");
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

      setStep("submitted");
      await queryClient.invalidateQueries();
      toast.success("Recarga enviada para aprovação.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a recarga.");
    } finally {
      setBusy(false);
    }
  };

  const resetRecharge = () => {
    setStep("amount");
    setMethod(null);
    setSender("");
    setTxId("");
    setFile(null);
  };

  const buyWithCredits = async (plan: Plan) => {
    if (!userId) return;
    if (vipCredits < Number(plan.price)) {
      toast.error(`Créditos VIP insuficientes. O VIP ${plan.id} custa ${MZN(plan.price)} e você tem ${MZN(vipCredits)}.`);
      return;
    }
    if (!window.confirm(`Ativar VIP ${plan.id} por ${MZN(plan.price)} usando os seus créditos VIP?\n\nCréditos depois: ${MZN(vipCredits - Number(plan.price))}`)) return;
    setBuyingPlanId(plan.id);
    try {
      const result = await purchase({ data: { planId: plan.id } });
      toast.success(`${result.planName} ativado! Créditos restantes: ${MZN(result.promotionalBalance)}.`);
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
              <p className="text-xs text-white/65">Recarregue e, após aprovação, receba 3x o valor em créditos exclusivos para VIPs.</p>
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

        {step === "amount" && (
          <div className="space-y-5 p-5">
            <div>
              <h2 className="text-xl font-extrabold">Recarregar</h2>
              <p className="mt-1 text-sm text-muted-foreground">Escolha um valor rápido abaixo ou introduza um valor personalizado.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {quickAmounts.map((value) => (
                <Button key={value} type="button" variant={rechargeAmount === value ? "default" : "outline"} className="h-16 rounded-2xl text-base font-bold" onClick={() => setAmount(String(value))}>
                  {value}
                </Button>
              ))}
            </div>
            <div className="text-center text-sm text-muted-foreground">
              Selecionado: <strong className="text-xl text-primary">{MZN(rechargeAmount)}</strong>
            </div>
            <Input
              type="number"
              min={minRecharge}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ou introduza um valor personalizado"
              className="h-14 rounded-2xl text-base"
            />
            <div className="rounded-2xl border border-border bg-secondary/50 p-4 text-sm">
              <p className="font-bold">Regras de recarga</p>
              <p className="mt-2 text-muted-foreground">Valor mínimo de recarga: {MZN(minRecharge)}.</p>
              <p className="mt-1 text-muted-foreground">Após aprovação, o valor da recarga é multiplicado por 3 e convertido em créditos VIP.</p>
            </div>
            <Button className="h-14 w-full rounded-2xl text-base font-extrabold" onClick={startRecharge}>
              <Wallet className="mr-2 size-5" /> Recarregar agora
            </Button>
          </div>
        )}

        {step === "method" && (
          <div className="space-y-5 p-5">
            <StepHeader title="Selecionar método de pagamento" onBack={() => setStep("amount")} />
            <div className="rounded-2xl bg-secondary/60 p-4 text-center">
              <p className="text-sm text-muted-foreground">Valor do pagamento</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">{MZN(rechargeAmount)}</p>
            </div>
            <p className="text-sm font-semibold">Selecione um método de pagamento</p>
            {methods.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Os métodos de pagamento ainda não foram configurados pelo administrador.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {methods.map((item) => (
                  <button key={item.id} type="button" onClick={() => chooseMethod(item.id)} className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary hover:shadow-md">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
                      <Smartphone className={`size-7 ${item.color}`} />
                    </div>
                    <p className="mt-3 font-extrabold">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Pagamento manual</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "payment" && selectedMethod && (
          <div className="space-y-5 p-5">
            <StepHeader title="Copiar e pagar" onBack={() => setStep("method")} />
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Copie esta conta <strong className="text-primary">{selectedMethod.label}</strong> e efetue o pagamento.</p>
              <p className="mt-4 text-xs text-muted-foreground">Valor total</p>
              <p className="text-3xl font-extrabold text-primary">{MZN(rechargeAmount)}</p>
              <CopyRow label={selectedMethod.label} value={selectedMethod.account} onCopy={copy} />
              {selectedMethod.holder && <CopyRow label="Nome da conta" value={selectedMethod.holder} onCopy={copy} />}
            </div>

            {selectedMethod.id === "usdt" && settings?.['payment_usdt_qr_url'] && (
              <img src={settings['payment_usdt_qr_url']} alt="QR Code USDT" className="mx-auto size-48 rounded-xl border object-contain p-2" />
            )}

            <div className="rounded-2xl border border-border bg-secondary/50 p-4">
              <p className="font-bold">Pagamento concluído?</p>
              <p className="mt-1 text-sm text-muted-foreground">Depois de pagar, introduza a referência da transação e a conta que utilizou.</p>
              <div className="mt-4 grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sender">A sua conta de pagamento</Label>
                  <Input id="sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="+258 84 000 0000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txid">ID/referência da transação</Label>
                  <Input id="txid" value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="ID da transação" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proof">Comprovativo (opcional)</Label>
                  <Input id="proof" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <Button className="mt-4 h-12 w-full rounded-2xl" onClick={submitRecharge} disabled={busy}>
                {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                Enviar comprovativo
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">A recarga fica pendente até o administrador confirmar o pagamento.</p>
            </div>
          </div>
        )}

        {step === "submitted" && (
          <div className="space-y-5 p-6 text-center">
            <CheckCircle2 className="mx-auto size-14 text-success" />
            <h2 className="text-2xl font-extrabold">Pagamento enviado</h2>
            <p className="text-sm text-muted-foreground">A sua recarga de {MZN(rechargeAmount)} foi enviada para análise. Após aprovação, serão adicionados {MZN(rechargeCredit)} em créditos VIP.</p>
            <Button className="w-full rounded-2xl" onClick={resetRecharge}>Nova recarga</Button>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Privilégios VIP</h2>
          <p className="text-sm text-muted-foreground">VIP 1 a VIP 11 · percorra a lista para ver o valor e os benefícios de cada plano.</p>
        </div>
        {isLoading && <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>}
        {(plans ?? []).map((plan, index) => {
          const active = activePlan?.plan_id === plan.id;
          const enough = vipCredits >= Number(plan.price);
          return (
            <article key={plan.id} className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-[var(--shadow-card)]">
              <div className={`relative min-h-[180px] overflow-hidden p-6 text-white ${PLAN_GRADIENTS[index] ?? PLAN_GRADIENTS[0]}`}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative z-10 pr-28">
                  <p className="text-3xl font-extrabold tracking-tight">VIP {plan.id}</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-sm font-bold backdrop-blur"><CalendarDays className="size-4" /> Ciclo: {plan.duration_days} dias</div>
                </div>
                <img src={settings?.[`plan_${plan.id}_image_url`] || getPlanImage(plan.id)} alt={`Imagem VIP ${plan.id}`} className="absolute right-5 top-5 size-28 object-contain drop-shadow-2xl sm:size-32" />
              </div>
              <div className="space-y-0 px-6 py-5">
                <PlanRow icon={<Coins className="size-5" />} label="Recompensa por tarefa" value={MZN(plan.task_value)} />
                <PlanRow icon={<Zap className="size-5" />} label="Limite diário de tarefas" value={`${plan.daily_task_count} tarefas`} />
                <PlanRow icon={<CreditCard className="size-5" />} label="Taxa de ativação" value={MZN(plan.price)} />
                <PlanRow icon={<Wallet className="size-5" />} label="Rendimento diário" value={MZN(plan.daily_income)} />
                <div className="pt-5">
                  <Button className="h-14 w-full rounded-2xl text-base font-extrabold shadow-lg" disabled={active || !enough || !!pending || buyingPlanId === plan.id} onClick={() => buyWithCredits(plan)}>
                    {buyingPlanId === plan.id ? <><Loader2 className="mr-2 size-5 animate-spin" /> A ativar...</> : active ? <><Crown className="mr-2 size-5" /> PLANO ATUAL</> : enough ? <><Crown className="mr-2 size-5" /> ATIVAR VIP</> : `PRECISA DE ${MZN(Number(plan.price) - vipCredits)} CRÉDITOS`}
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

function StepHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar"><ArrowLeft className="size-5" /></Button>
      <h2 className="text-xl font-extrabold">{title}</h2>
    </div>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string) => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <strong className="break-all text-lg text-primary">{value}</strong>
        <Button variant="outline" size="icon" onClick={() => onCopy(value)} aria-label={`Copiar ${label}`}><Copy className="size-4" /></Button>
      </div>
    </div>
  );
}

function PlanRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-border/70 py-4 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3"><span className="shrink-0 text-primary">{icon}</span><span className="text-sm font-semibold text-muted-foreground sm:text-base">{label}</span></div>
      <span className="shrink-0 text-base font-extrabold sm:text-lg">{value}</span>
    </div>
  );
}
