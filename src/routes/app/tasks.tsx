import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { MZN, formatDate, todayMaputo } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/tasks")({
  component: Tasks,
});

function Tasks() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [busyIndex, setBusyIndex] = useState<number | null>(null);

  const { data: plan, isLoading } = useQuery({
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

  const { data: claims } = useQuery({
    queryKey: ["task-claims-today", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("task_claims")
        .select("task_index, amount")
        .eq("user_id", userId!)
        .eq("task_date", todayMaputo());
      return data ?? [];
    },
  });

  const planRow = plan?.plans as
    | { name: string; daily_task_count: number; task_value: number; daily_income: number }
    | undefined;
  const claimed = new Set((claims ?? []).map((c) => c.task_index));

  const claim = async (index: number) => {
    setBusyIndex(index);
    try {
      const { data, error } = await supabase.rpc("claim_task", { _task_index: index });
      if (error) throw new Error(error.message);
      const result = data as { error?: string; amount?: number } | null;
      if (result?.error) throw new Error(result.error);
      toast.success(`Tarefa coletada com sucesso! +${MZN(result?.amount ?? 0)}`);
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao concluir a tarefa.");
    } finally {
      setBusyIndex(null);
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!planRow) {
    return (
      <div className="surface-card p-8 text-center">
        <Lock className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-bold">Sem plano ativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ative um plano para desbloquear as tarefas diárias.</p>
        <Link to="/app/plans">
          <Button className="mt-4">Ver planos</Button>
        </Link>
      </div>
    );
  }

  const total = planRow.daily_task_count;
  const done = claimed.size;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tarefas diárias</h1>
        <p className="text-sm text-muted-foreground">
          {planRow.name} · válido até {formatDate(plan?.end_date)}
        </p>
      </div>

      <div className="surface-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            Progresso de hoje: {done}/{total}
          </span>
          <span className="text-muted-foreground">Ganho diário {MZN(planRow.daily_income)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-all"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: total }, (_, i) => i + 1)
          .filter((index) => !claimed.has(index))
          .map((index) => (
            <div key={index} className="surface-card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">Tarefa {index}</p>
                <p className="text-sm text-muted-foreground">Recompensa {MZN(planRow.task_value)}</p>
              </div>
              <Button size="sm" onClick={() => claim(index)} disabled={busyIndex !== null}>
                {busyIndex === index && <Loader2 className="mr-2 size-4 animate-spin" />}
                Concluir
              </Button>
            </div>
          ))}
      </div>

      {done >= total && (
        <div className="surface-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" />
          <p className="mt-2 text-sm font-semibold text-success">
            Todas as tarefas de hoje foram coletadas com sucesso.
          </p>
          <p className="text-xs text-muted-foreground">Novas tarefas ficam disponíveis amanhã.</p>
        </div>
      )}

    </div>
  );
}
