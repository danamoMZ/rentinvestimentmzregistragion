import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { donateFn } from "@/lib/app.functions";
import { MZN, STATUS_CLASS, STATUS_LABEL, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/donations")({
  component: Donations,
});

function Donations() {
  const { userId } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const donate = useServerFn(donateFn);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["donations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("donations")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const value = Number(amount || 0);

  const submit = async () => {
    setBusy(true);
    try {
      await donate({ data: { amount: value } });
      toast.success("Doação registada! O retorno será creditado em 30 dias.");
      setAmount("");
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível doar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Doações</h1>
        <p className="text-sm text-muted-foreground">
          Doe à empresa e receba o valor com +15% após 30 dias. Saldo atual: {MZN(profile?.balance)}.
        </p>
      </div>

      <div className="surface-card space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="donation">Valor da doação (mínimo 100 MZN)</Label>
          <Input
            id="donation"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
          />
        </div>
        {value > 0 && (
          <div className="rounded-lg border border-border bg-secondary p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retorno em 30 dias</span>
              <span className="font-bold text-success">{MZN(value * 1.15)}</span>
            </div>
          </div>
        )}
        <Button className="w-full" onClick={submit} disabled={busy || value <= 0}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Confirmar doação
        </Button>
      </div>

      <div className="surface-card p-4">
        <h2 className="text-sm font-semibold">Histórico de doações</h2>
        {(items ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ainda não fez doações.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {(items ?? []).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{MZN(d.principal)}</p>
                  <p className="text-xs text-muted-foreground">
                    Retorno {MZN(d.return_amount)} em {formatDate(d.end_date)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    STATUS_CLASS[d.status] ?? "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
