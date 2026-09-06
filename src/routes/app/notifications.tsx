import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CheckCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useDeviceNotifications } from "@/hooks/use-device-notifications";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ShareRewardCard } from "@/components/layout/ShareRewardCard";

export const Route = createFileRoute("/app/notifications")({
  component: Notifications,
});

function Notifications() {
  const { userId } = useSession();
  const queryClient = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { permission, enable } = useDeviceNotifications();

  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId!).eq("read", false);
    queryClient.invalidateQueries();
  };

  const activate = async () => {
    const result = await enable();
    if (result === "granted") toast.success("Notificações ativadas neste telemóvel.");
    else if (result === "denied")
      toast.error("Permissão negada. Ative as notificações nas definições do navegador.");
    else if (result === "unsupported") toast.error("Este dispositivo não suporta notificações.");
  };


  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
          <p className="text-sm text-muted-foreground">Avisos da plataforma e das suas operações.</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAll} className="gap-1.5">
          <CheckCheck className="size-4" /> Marcar lidas
        </Button>
      </div>

      <ShareRewardCard />

      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Notificações no telemóvel</p>
            <p className="text-xs text-muted-foreground">
              {permission === "granted"
                ? "Ativas — os avisos aparecem na barra de notificações do seu dispositivo."
                : permission === "denied"
                  ? "Bloqueadas. Ative as notificações nas definições do navegador para este site."
                  : permission === "unsupported"
                    ? "Este dispositivo/navegador não suporta notificações."
                    : "Ative para receber os avisos da RENT INVESTIMENT diretamente no telemóvel."}
            </p>
          </div>
        </div>
        {permission !== "granted" && permission !== "unsupported" && (
          <Button size="sm" onClick={activate} className="gap-1.5">
            <BellRing className="size-4" /> Ativar
          </Button>
        )}
      </div>

      <div className="surface-card divide-y divide-border p-4">
        {(items ?? []).length === 0 && (
          <div className="py-10 text-center">
            <Bell className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Sem notificações.</p>
          </div>
        )}
        {(items ?? []).map((n) => (
          <div key={n.id} className="flex gap-3 py-3">
            <span className={`mt-2 size-2 shrink-0 rounded-full ${n.read ? "bg-border" : "bg-primary"}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
