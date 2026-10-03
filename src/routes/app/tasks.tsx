import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Image as ImageIcon, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { MZN, formatDate, todayMaputo } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/tasks")({
  component: Tasks,
});

function Tasks() {
  const { userId } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [watchingIndex, setWatchingIndex] = useState<number | null>(null);
  const [watchedSeconds, setWatchedSeconds] = useState<Record<number, number>>({});
  const [watchStartedAt, setWatchStartedAt] = useState<Record<number, number>>({});

  const { data: plan, isLoading } = useQuery({
    queryKey: ["active-plan", userId],
    enabled: !!userId && !!profile,
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

  const { data: settings } = useQuery({
    queryKey: ["task-media-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });

  const { data: claims } = useQuery({
    queryKey: ["task-claims-today", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from(profile?.account_tier === "RECRUTA" ? "recruit_task_claims" : "task_claims")
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
  const isRecruit = !planRow;
  const total = planRow?.daily_task_count ?? 4;
  const taskValue = planRow?.task_value ?? 5;
  const taskIndexes = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setWatchedSeconds((current) => {
        const next = { ...current };
        Object.entries(watchStartedAt).forEach(([key, started]) => {
          const index = Number(key);
          next[index] = Math.max(0, Math.floor((Date.now() - started) / 1000));
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [watchStartedAt]);

  const videoUrl = (value: string) => {
    try {
      const u = new URL(value);
      if (u.hostname.includes("youtube.com") && u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}?rel=0&playsinline=1` : value;
      }
      if (u.hostname === "youtu.be") {
        return `https://www.youtube.com/embed/${u.pathname.slice(1)}?rel=0&playsinline=1`;
      }
      return value;
    } catch {
      return value;
    }
  };

  const startWatch = (index: number) => {
    setWatchingIndex(index);
    setWatchStartedAt((current) => ({ ...current, [index]: Date.now() }));
    setWatchedSeconds((current) => ({ ...current, [index]: 0 }));
  };

  const claim = async (index: number) => {
    if ((watchedSeconds[index] ?? 0) < 15) {
      toast.error("Assista ao vídeo durante pelo menos 15 segundos.");
      return;
    }
    setBusyIndex(index);
    try {
      const { data, error } = await supabase.rpc("claim_task", { _task_index: index });
      if (error) throw new Error(error.message);
      const result = data as { error?: string; amount?: number } | null;
      if (result?.error) throw new Error(result.error);
      toast.success(`Tarefa concluída! +${MZN(result?.amount ?? taskValue)}`);
      setWatchingIndex(null);
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

  const done = claimed.size;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tarefas diárias</h1>
        <p className="text-sm text-muted-foreground">
          {planRow ? `${planRow.name} · válido até ${formatDate(plan?.end_date)}` : "RECRUTA · 4 tarefas diárias de 5 MZN"}
        </p>
      </div>

      <div className="surface-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            Progresso de hoje: {done}/{total}
          </span>
          <span className="text-muted-foreground">{planRow ? `Ganho diário ${MZN(planRow.daily_income)}` : "Até 20 MZN por dia"}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-all"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {taskIndexes
          .filter((index) => !claimed.has(index))
          .map((index) => {
            const video = settings?.[`task_${index}_video_url`] || "";
            const seconds = watchedSeconds[index] ?? 0;
            const ready = seconds >= 15;
            return (
              <div key={index} className="surface-card overflow-hidden p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Tarefa {index}</p>
                    <p className="text-sm text-muted-foreground">Recompensa: {MZN(taskValue)}</p>
                  </div>
                  {isRecruit && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">RECRUTA</span>}
                </div>
                {settings?.[`task_${index}_image_url`] && (
                  <img src={settings[`task_${index}_image_url`]} alt={`Imagem da tarefa ${index}`} className="mt-3 h-40 w-full rounded-xl object-cover ring-1 ring-border" />
                )}
                {video ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border bg-black">
                    {video.includes("youtube.com") || video.includes("youtu.be") ? (
                      <iframe
                        src={videoUrl(video)}
                        title={`Vídeo da tarefa ${index}`}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : (
                      <a href={video} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-5 text-sm font-semibold text-primary-foreground">
                        <ExternalLink className="size-5" /> Abrir vídeo
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    <PlayCircle className="mx-auto size-6" />
                    <p className="mt-2">O administrador ainda não configurou o vídeo.</p>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {video ? `Tempo assistido: ${Math.min(seconds, 15)}s / 15s` : "Vídeo obrigatório"}
                  </p>
                  {!watchStartedAt[index] ? (
                    <Button size="sm" onClick={() => startWatch(index)} disabled={!video}>
                      <PlayCircle className="mr-2 size-4" /> Assistir agora
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => claim(index)} disabled={!ready || busyIndex !== null}>
                      {busyIndex === index && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {ready ? "Reivindicar agora" : `Aguarde ${15 - seconds}s`}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
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
