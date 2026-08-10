import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, Send, LifeBuoy, Wallet, Wrench, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { openTicketFn, replyTicketFn } from "@/lib/app.functions";
import { STATUS_CLASS, STATUS_LABEL, formatDateTime, toHref } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/app/support")({
  component: Support,
});

const CHANNELS = [
  { key: "support_whatsapp_group", label: "Grupo do WhatsApp", icon: MessageCircle },
  { key: "support_telegram_group", label: "Grupo do Telegram", icon: Send },
  { key: "support_technical", label: "Suporte técnico", icon: Wrench },
  { key: "support_help", label: "Suporte ajuda", icon: HelpCircle },
  { key: "support_financial", label: "Suporte financeiro", icon: Wallet },
];

function Support() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const openTicket = useServerFn(openTicketFn);
  const replyTicket = useServerFn(replyTicketFn);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["settings-public"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["tickets", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["ticket-messages", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", openId!)
        .order("created_at");
      return data ?? [];
    },
  });

  const available = CHANNELS.filter((c) => (settings?.[c.key] ?? "").trim().length > 0);

  const create = async () => {
    setBusy(true);
    try {
      await openTicket({ data: { subject, message } });
      toast.success("Pedido enviado ao suporte.");
      setSubject("");
      setMessage("");
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!openId || !reply.trim()) return;
    setBusy(true);
    try {
      await replyTicket({ data: { ticketId: openId, message: reply, asAdmin: false } });
      setReply("");
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível responder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suporte</h1>
        <p className="text-sm text-muted-foreground">Canais oficiais e atendimento direto.</p>
      </div>

      <div className="surface-card p-4">
        <h2 className="text-sm font-semibold">Canais de apoio</h2>
        {available.length === 0 ? (
          <div className="py-6 text-center">
            <LifeBuoy className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum canal de suporte foi publicado pelo administrador ainda.
            </p>
          </div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {available.map((channel) => {
              const raw = settings?.[channel.key] ?? "";
              const href = toHref(raw);
              return (
                <a
                  key={channel.key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-3 transition-colors hover:bg-accent/20"
                >
                  <channel.icon className="size-5 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{channel.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{raw}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      <div className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Abrir pedido de ajuda</h2>
        <div className="space-y-1.5">
          <Label htmlFor="subject">Assunto</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="message">Mensagem</Label>
          <Textarea id="message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <Button className="w-full" onClick={create} disabled={busy || !subject.trim() || !message.trim()}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Enviar pedido
        </Button>
      </div>

      <div className="surface-card p-4">
        <h2 className="text-sm font-semibold">Os meus pedidos</h2>
        {(tickets ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Ainda não abriu pedidos.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {(tickets ?? []).map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-border">
                <button
                  onClick={() => setOpenId(openId === ticket.id ? null : ticket.id)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(ticket.updated_at)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      STATUS_CLASS[ticket.status] ?? "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {STATUS_LABEL[ticket.status] ?? ticket.status}
                  </span>
                </button>
                {openId === ticket.id && (
                  <div className="space-y-2 border-t border-border p-3">
                    {(messages ?? []).map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          m.is_admin
                            ? "bg-secondary text-secondary-foreground"
                            : "ml-auto bg-primary text-primary-foreground"
                        }`}
                      >
                        <p>{m.message}</p>
                        <p className="mt-1 text-[10px] opacity-70">{formatDateTime(m.created_at)}</p>
                      </div>
                    ))}
                    {ticket.status !== "CLOSED" && (
                      <div className="flex gap-2 pt-1">
                        <Input
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Escreva uma resposta..."
                        />
                        <Button onClick={send} disabled={busy || !reply.trim()}>
                          Enviar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
