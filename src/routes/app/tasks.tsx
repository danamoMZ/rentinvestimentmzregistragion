import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { MZN, formatDate, todayMaputo } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/tasks")({
  component: Tasks,
});

function maputoDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Maputo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function dayDifference(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  return Math.round((Date.UTC(ey ?? 0, (em ?? 1) - 1, ed ?? 1) - Date.UTC(sy ?? 0, (sm ?? 1) - 1, sd ?? 1)) / 86400000);
}

function Tasks() {
  const { userId } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [watchedSeconds, setWatchedSeconds] = useState<Record<number, number>>({});
  const [watchStartedAt, setWatchStartedAt] = useState<Record<number, number>>({});

  const isRecruit = profile?.account_tier === "RECRUTA";
  const today = todayMaputo();

  const { data: plan, isLoading } = useQuery({
    queryKey: ["active-plan", userId],
    enabled: !!userId && !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("*, plans(*)")
        .eq("user_id", userId!)
        .eq("status", "ACTIVE")
        .lte("start_date", today)
        .gte("end_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
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
    queryKey: ["task-claims-today", userId, isRecruit],
    enabled: !!userId,
    queryFn: async () => {
      const table = isRecruit ? "recruit_task_claims" : "task_claims";
      const { data, error } = await supabase
        .from(table)
        .select("task_index, amount")
        .eq("user_id", userId!)
        .eq("task_date", today);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recruitClaimCount } = useQuery({
    queryKey: ["recruit-task-total", userId],
    enabled: !!userId && isRecruit,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("recruit_task_claims")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const planRow = plan?.plans as
    | { name: string; daily_task_count: number; task_value: number; daily_income: number }
    | undefined;

  const recruitDay =
    isRecruit && profile?.created_at
      ? dayDifference(maputoDate(profile.created_at), today) + 1
      : 1;
  const recruitWindowOpen = isRecruit && recruitDay >= 1 && recruitDay <= 4;
  const recruitFinished = isRecruit && (recruitDay > 4 || (recruitClaimCount ?? 0) >= 4);

  const claimed = new Set((claims ?? []).map((c) => c.task_index));
  const total = planRow?.daily_task_count ?? (isRecruit && recruitWindowOpen ? 1 : 0);
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

  const startWatch = async (index: number) => {
    try {
      const { error } = await (supabase as any).rpc("start_task_watch", { _task_index: index });
      if (error) throw new Error(error.message);
      setWatchStartedAt((current) => ({ ...current, [index]: Date.now() }));
      setWatchedSeconds((current) => ({ ...current, [index]: 0 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a tarefa.");
    }
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
      setWatchStartedAt((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
      await queryClient.invalidateQueries();
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
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tarefas diárias</h1>
        <p className="text-sm text-muted-foreground">
          {planRow
            ? `${planRow.name} · válido até ${formatDate(plan?.end_date)}`
            : isRecruit
              ? "RECRUTA · 1 tarefa por dia de 5 MZN · 4 dias"
              : "Sem tarefas disponíveis"}
        </p>
      </div>

      {isRecruit && (
        <div className="surface-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Ciclo RECRUTA</p>
              <p className="mt-1 text-sm font-semibold">
                {recruitFinished ? "Período RECRUTA concluído" : `Dia ${Math.min(Math.max(recruitDay, 1), 4)} de 4`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tarefas concluídas</p>
              <p className="text-lg font-extrabold">{Math.min(recruitClaimCount ?? 0, 4)}/4</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-[image:var(--gradient-brand)] transition-all"
              style={{ width: `${Math.min((recruitClaimCount ?? 0) / 4, 1) * 100}%` }}
            />
          </div>
        </div>
      )}

      {!planRow && isRecruit && recruitFinished ? (
        <div className="surface-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-9 text-primary" />
          <p className="mt-3 text-base font-extrabold">As 4 tarefas RECRUTA foram concluídas.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Depois dos 4 dias, não são criadas novas tarefas. Para continuar, ative um VIP usando os seus créditos VIP.
          </p>
          <Button className="mt-4" onClick={() => window.location.assign("/app/plans")}>Ver VIPs</Button>
        </div>
      ) : (
        <>
          {total > 0 && claimed.size >= total && (
            <div className="surface-card p-6 text-center">
              <CheckCircle2 className="mx-auto size-8 text-success" />
              <p className="mt-2 text-sm font-semibold text-success">Tarefa de hoje concluída.</p>
              <p className="text-xs text-muted-foreground">
                {isRecruit
                  ? "Amanhã poderá reivindicar a próxima tarefa, dentro dos 4 dias RECRUTA."
                  : "Novas tarefas ficam disponíveis amanhã."}
              </p>
            </div>
          )}

          <div className="grid gap-3">
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
                      {isRecruit && (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">RECRUTA</span>
                      )}
                    </div>

                    {settings?.[`task_${index}_image_url`] && (
                      <img
                        src={settings[`task_${index}_image_url`]}
                        alt={`Imagem da tarefa ${index}`}
                        className="mt-3 h-40 w-full rounded-xl object-cover ring-1 ring-border"
                      />
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
                          <a
                            href={video}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 p-5 text-sm font-semibold text-primary-foreground"
                          >
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
        </>
      )}
    </div>
  );
}
