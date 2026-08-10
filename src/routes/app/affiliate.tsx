import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { affiliateFn } from "@/lib/app.functions";
import { MZN, STATUS_CLASS, STATUS_LABEL, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/app/affiliate")({
  component: Affiliate,
});

function Affiliate() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const submitFn = useServerFn(affiliateFn);
  const [type, setType] = useState("VIDEO");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["affiliate", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_submissions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submit = async () => {
    setBusy(true);
    try {
      await submitFn({ data: { type, url } });
      toast.success("Submetido! Aguarde a validação do administrador.");
      setUrl("");
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível submeter.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Programa de afiliados</h1>
        <p className="text-sm text-muted-foreground">
          Publique sobre a RENT INVESTIMENT e receba: vídeo 300 MZN · publicação 150 MZN.
        </p>
      </div>

      <div className="surface-card space-y-3 p-4">
        <div className="space-y-1.5">
          <Label>Tipo de conteúdo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIDEO">Vídeo — 300 MZN</SelectItem>
              <SelectItem value="POST">Publicação — 150 MZN</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="url">Link da publicação</Label>
          <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </div>
        <Button className="w-full" onClick={submit} disabled={busy || !url.trim()}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Submeter para análise
        </Button>
      </div>

      <div className="surface-card p-4">
        <h2 className="text-sm font-semibold">As minhas submissões</h2>
        {(items ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ainda não submeteu conteúdos.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {(items ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.type === "VIDEO" ? "Vídeo" : "Publicação"} · {MZN(item.reward)} ·{" "}
                    {formatDateTime(item.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    STATUS_CLASS[item.status] ?? "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
