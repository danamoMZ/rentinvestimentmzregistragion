import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { redeemPromoCodeFn, withdrawFn } from "@/lib/app.functions";
import { MZN, STATUS_CLASS, STATUS_LABEL, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsdtTrc20Panel } from "@/components/wallet/UsdtTrc20Panel";
import { UsdtWithdrawalPanel } from "@/components/wallet/UsdtWithdrawalPanel";

export const Route = createFileRoute("/app/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { userId } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const withdraw = useServerFn(withdrawFn);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const redeem = useServerFn(redeemPromoCodeFn);
  const [promo, setPromo] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);

  const submitPromo = async () => {
    const code = promo.trim().toUpperCase();
    if (!code) {
      toast.error("Introduza o código de recarga secreta.");
      return;
    }
    setPromoBusy(true);
    try {
      const result = await redeem({ data: { code } });
      toast.success(`Recarga secreta aplicada! +${MZN(result.bonus)} no seu saldo.`);
      setPromo("");
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível resgatar o código.");
    } finally {
      setPromoBusy(false);
    }
  };

  const { data: withdrawals } = useQuery({
    queryKey: ["withdrawals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: deposits } = useQuery({
    queryKey: ["deposits", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("deposit_requests")
        .select("*, plans(name)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: ledger } = useQuery({
    queryKey: ["ledger", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ledger_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const value = Number(amount || 0);
  const fee = Math.round(value * 0.10 * 100) / 100;

  const submit = async () => {
    if (!Number.isFinite(value) || value < 20) {
      toast.error("O primeiro saque pode ser feito a partir de 20 MZN; depois, o mínimo é 150 MZN.");
      return;
    }
    if (value > 18000) {
      toast.error("O valor máximo de saque é 18.000 MZN.");
      return;
    }
    setBusy(true);
    try {
      const result = await withdraw({ data: { amount: value } });

      toast.success(`Pedido enviado! Referência ${result.reference}`);
      setAmount("");
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível pedir o saque.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">Carteira</h1>
    <p className="text-sm text-muted-foreground">
      Saldo, saques e histórico completo.
    </p>
  </div>

  <div className="surface-card bg-[image:var(--gradient-soft)] p-5">
    {profile?.account_tier === "RECRUTA" && (
      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs font-semibold text-primary">RECRUTA</p>
        <p className="mt-1 text-sm">Saldo para levantamento: <strong>{MZN(profile?.balance ?? 0)}</strong></p>
        <p className="text-sm">Crédito exclusivo para VIPs: <strong>{MZN(profile?.promotional_balance ?? 0)}</strong></p>
      </div>
    )}
    <p className="text-xs uppercase tracking-widest text-muted-foreground">
      Saldo disponível
    </p>
    <p className="text-3xl font-extrabold">{MZN(profile?.balance)}</p>
  </div>

  {/* USDT TRC20 */}
  <UsdtTrc20Panel />

  <UsdtWithdrawalPanel />

  <div className="surface-card space-y-3 p-4">
    <h2 className="text-sm font-semibold">Pedir saque</h2>
    <p className="text-xs text-muted-foreground">
      Mínimo 125 MZN · Máximo 18.000 MZN · Taxa de 10% · Requer plano ativo.
    </p>

    <div className="space-y-1.5">
      <Label htmlFor="amount">Valor (MZN)</Label>
      <Input
        id="amount"
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="1000"
      />
    </div>

    {value > 0 && (
      <div className="rounded-lg border border-border bg-secondary p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxa (10%)</span>
          <span className="font-semibold">{MZN(fee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Vai receber</span>
          <span className="font-bold text-success">{MZN(value - fee)}</span>
        </div>
      </div>
    )}

    <p className="text-xs text-muted-foreground">
      Número de recebimento:{" "}
      <span className="font-semibold">
        {profile?.wallet_number || profile?.phone || "—"}
      </span>
    </p>

    <Button
      className="w-full"
      onClick={submit}
      disabled={busy || value <= 0}
    >
      {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
      Pedir saque
    </Button>
  </div>

      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Gift className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Recarga secreta</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Tem um código secreto? Introduza-o abaixo. Cada código vale por 1 hora e só pode ser usado uma vez por conta.
        </p>
        <div className="flex gap-2">
          <Input
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
            placeholder="RI-XXXXX-XXXXX"
            className="font-mono uppercase"
            autoCapitalize="characters"
          />
          <Button onClick={submitPromo} disabled={promoBusy || !promo.trim()}>
            {promoBusy && <Loader2 className="mr-2 size-4 animate-spin" />} Resgatar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ledger">
        <TabsList className="w-full">
          <TabsTrigger value="ledger" className="flex-1">
            Movimentos
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="flex-1">
            Saques
          </TabsTrigger>
          <TabsTrigger value="deposits" className="flex-1">
            Depósitos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="surface-card mt-3 divide-y divide-border p-4">
          {(ledger ?? []).length === 0 && <Empty text="Sem movimentos." />}
          {(ledger ?? []).map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(tx.created_at)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-bold ${Number(tx.amount) >= 0 ? "text-success" : "text-destructive"}`}>
                  {Number(tx.amount) >= 0 ? "+" : ""}
                  {MZN(tx.amount)}
                </p>
                <p className="text-[11px] text-muted-foreground">Saldo: {MZN(tx.balance_after)}</p>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="withdrawals" className="surface-card mt-3 divide-y divide-border p-4">
          {(withdrawals ?? []).length === 0 && <Empty text="Sem pedidos de saque." />}
          {(withdrawals ?? []).map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{MZN(w.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {w.reference} · líquido {MZN(w.net_amount)} · {formatDateTime(w.created_at)}
                </p>
              </div>
              <StatusPill status={w.status} />
            </div>
          ))}
        </TabsContent>

        <TabsContent value="deposits" className="surface-card mt-3 divide-y divide-border p-4">
          {(deposits ?? []).length === 0 && <Empty text="Sem depósitos." />}
          {(deposits ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {(d.plans as { name: string } | null)?.name} · {MZN(d.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  ID {d.transaction_id} · {formatDateTime(d.created_at)}
                </p>
              </div>
              <StatusPill status={d.status} />
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        STATUS_CLASS[status] ?? "border-border bg-muted text-muted-foreground"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
