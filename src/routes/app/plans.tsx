import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { depositFn, purchasePlanFn } from "@/lib/app.functions";
import { getPlanImage } from "@/lib/brand";
import { MZN, PAYMENT_FIELDS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoAsset from "@/assets/ri-logo.jpg.asset.json";
const logo = logoAsset.url;

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

function Plans() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const deposit = useServerFn(depositFn);
  const purchase = useServerFn(purchasePlanFn);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [sender, setSender] = useState("");
  const [txId, setTxId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyingPlanId, setBuyingPlanId] = useState<number | null>(null);

  const { data: profile } = useQuery({
  queryKey: ["my-profile-balance", userId],
  enabled: !!userId,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId!)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
});

const balance = Number(profile?.balance ?? 0);
  const { data: balances } = useQuery({
    queryKey: ["my-profile-balances", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("balance, promotional_balance")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as { balance: number; promotional_balance: number } | null;
    },
  });
  const promotionalBalance = Number(balances?.promotional_balance ?? 0);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").eq("active", true).order("sort_order").order("id");
      if (error) throw error;
      return data as Plan[];
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
        .select("*, plans(name)")
        .eq("user_id", userId!)
        .eq("status", "PENDING")
        .maybeSingle();
      return data;
    },
  });

  const buyWithBalance = async (plan: Plan) => {
  if (!userId) {
    toast.error("Não foi possível identificar a sua conta.");
    return;
  }

  if (balance < Number(plan.price)) {
    toast.error(
      `Saldo insuficiente. O ${plan.name} custa ${MZN(plan.price)} e o seu saldo actual é ${MZN(balance)}.`,
    );
    return;
  }

  const confirmed = window.confirm(
    `Comprar ${plan.name} por ${MZN(plan.price)} usando o seu saldo?\n\nSaldo actual: ${MZN(balance)}\nSaldo depois da compra: ${MZN(balance - Number(plan.price))}`,
  );

  if (!confirmed) return;

  setBuyingPlanId(plan.id);

  try {
    const result = await purchase({
      data: {
        planId: plan.id,
      },
    });

    toast.success(
      `${result.planName} comprado com sucesso! Saldo actual: ${MZN(result.balance)}.`,
    );

    await queryClient.invalidateQueries({
      queryKey: ["my-profile-balance", userId],
    });

    await queryClient.invalidateQueries({
      queryKey: ["active-plan", userId],
    });

    await queryClient.invalidateQueries({
      queryKey: ["plans"],
    });
  } catch (err) {
    toast.error(
      err instanceof Error
        ? err.message
        : "Não foi possível comprar o plano.",
    );
  } finally {
    setBuyingPlanId(null);
  }
};

  const submit = async () => {
    if (!selected || !userId) return;
    if (!sender.trim() || !txId.trim()) {
      toast.error("Preencha o número usado e o ID da transação.");
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
        data: { planId: selected.id, senderNumber: sender, transactionId: txId, proofPath },
      });
      toast.success("Pedido enviado! Aguarde a aprovação do administrador.");
      setSelected(null);
      setSender("");
      setTxId("");
      setFile(null);
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">Planos VIP</h1>
    <p className="text-sm text-muted-foreground">
      Escolha um VIP e utilize primeiro o crédito promocional de 200 MZN.
    </p>
  </div>

  <div className="rounded-xl border border-border bg-secondary px-4 py-3">
    <p className="text-xs text-muted-foreground">Saldo para levantamento</p>
    <p className="text-lg font-bold">{MZN(balance)}</p>
    <p className="mt-1 text-xs text-muted-foreground">Crédito para VIPs: <span className="font-semibold text-primary">{MZN(promotionalBalance)}</span></p>
  </div>
</div>

      {pending && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Pedido em análise</p>
          <p className="text-muted-foreground">
            {(pending.plans as { name: string } | null)?.name} · {MZN(pending.amount)} — aguarde a aprovação.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(plans ?? []).map((plan) => (
          <article key={plan.id} className="surface-card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border bg-[image:var(--gradient-soft)] p-4">
              <img
                src={settings?.[`plan_${plan.id}_image_url`] || getPlanImage(plan.id)}
                alt={`Imagem do VIP ${plan.id}`}
                className="size-16 rounded-xl object-cover ring-1 ring-border"
              />
              <div>
                <h2 className="font-bold">VIP {plan.id}</h2>
                <p className="text-xs text-muted-foreground">{plan.duration_days} dias</p>
              </div>
            </div>
            <div className="space-y-1.5 p-4 text-sm">
              <Row label="Preço" value={MZN(plan.price)} />
              <Row label="Renda diária" value={MZN(plan.daily_income)} />
              <Row label="Tarefas/dia" value={String(plan.daily_task_count)} />
              <Row label="Valor por tarefa" value={MZN(plan.task_value)} />
              <Row label="Total do ciclo" value={MZN(plan.total_task_income)} />
              <div className="mt-3 grid gap-2">
  <Button
    className="w-full"
    disabled={
      !!pending ||
      buyingPlanId === plan.id ||
      balance < Number(plan.price)
    }
    onClick={() => buyWithBalance(plan)}
  >
    {buyingPlanId === plan.id ? (
      <>
        <Loader2 className="mr-2 size-4 animate-spin" />
        A comprar...
      </>
    ) : (
      <>
        <Wallet className="mr-2 size-4" />
        {balance >= Number(plan.price)
          ? "Comprar com saldo"
          : "Saldo insuficiente"}
      </>
    )}
  </Button>

  <Button
    type="button"
    variant="outline"
    className="w-full"
    disabled={!!pending}
    onClick={() => setSelected(plan)}
  >
    {pending ? "Pedido pendente" : "Depositar / pagar"}
  </Button>
</div>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Depositar para {selected?.name}</DialogTitle>
            <DialogDescription>
              Envie {selected ? MZN(selected.price) : ""} para um dos números abaixo e confirme os dados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-border bg-secondary p-3 text-sm">
              {PAYMENT_FIELDS.map((field) => {
                const value = settings?.[field.key] || "";
                return (
                  <div key={field.key} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{field.label}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold">{value || "—"}</span>
                      {value && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label={`Copiar ${field.label}`}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(value);
                              toast.success("Copiado!");
                            } catch {
                              toast.error("Não foi possível copiar.");
                            }
                          }}
                        >
                          <Copy className="size-4" />
                        </Button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>


            <div className="space-y-1.5">
              <Label htmlFor="sender">Número usado no pagamento</Label>
              <Input id="sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="84 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="txid">ID da transação</Label>
              <Input id="txid" value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="Ex.: PP2504..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proof">Comprovativo (imagem, opcional)</Label>
              <Input
                id="proof"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button className="w-full" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
              Enviar pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
