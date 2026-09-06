import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { claimShareRewardFn } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function countdown(expiresAt: string, now: number) {
  const s = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Cartão "PARTILHA E GANHA" — aparece apenas quando o utilizador tem um bónus pendente por reivindicar. */
export function ShareRewardCard() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const claim = useServerFn(claimShareRewardFn);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  const { data: reward } = useQuery({
    queryKey: ["share-reward", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("share_rewards")
        .select("id, amount, expires_at, status")
        .eq("user_id", userId!)
        .eq("status", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  if (!reward) return null;
  const remaining = new Date(reward.expires_at).getTime() - now;
  if (remaining <= 0) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const res = await claim({ data: { rewardId: reward.id } });
      toast.success(`Bónus de ${res.amount} MZN creditado! Novo saldo: ${res.balance} MZN`);
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reivindicar.");
      queryClient.invalidateQueries({ queryKey: ["share-reward", userId] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card flex flex-wrap items-center justify-between gap-3 border-primary/40 p-4">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 size-5 text-primary" />
        <div>
          <p className="text-sm font-bold tracking-wide">PARTILHA E GANHA</p>
          <p className="text-xs text-muted-foreground">
            Tem {reward.amount} MZN à sua espera. Reivindique antes que o prazo termine.
          </p>
          <p className="mt-1 flex items-center gap-1 font-mono text-xs text-primary">
            <Timer className="size-3.5" /> {countdown(reward.expires_at, now)}
          </p>
        </div>
      </div>
      <Button size="sm" onClick={submit} disabled={busy} className="gap-1.5">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />} Reivindicar {reward.amount} MZN
      </Button>
    </div>
  );
}
