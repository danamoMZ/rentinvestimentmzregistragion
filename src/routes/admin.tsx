import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/hooks/use-session";
import {
  adjustBalanceFn,
  broadcastFn,
  proofUrlFn,
  reviewAffiliateFn,
  reviewDepositFn,
  reviewWithdrawalFn,
  saveSettingsFn,
  setBlockedFn,
  ticketStatusFn,
  replyTicketFn,
} from "@/lib/app.functions";
import { MZN, PAYMENT_FIELDS, STATUS_CLASS, STATUS_LABEL, SUPPORT_FIELDS, formatDateTime } from "@/lib/format";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminPage,
});

function Pill({ status }: { status: string }) {
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

function AdminPage() {
  const { session, loading } = useSession();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const refresh = () => queryClient.invalidateQueries();

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface-card max-w-sm p-8 text-center">
          <ShieldAlert className="mx-auto size-8 text-destructive" />
          <h1 className="mt-3 text-lg font-bold">Acesso restrito</h1>
          <p className="mt-1 text-sm text-muted-foreground">Esta área é exclusiva para administradores.</p>
          <Link to="/app/dashboard">
            <Button className="mt-4">Voltar ao painel</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo size={34} />
          <Link to="/app/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="size-4" /> Painel
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administração</h1>
          <p className="text-sm text-muted-foreground">Gestão completa da plataforma RENT INVESTIMENT.</p>
        </div>

        <Tabs defaultValue="deposits">
          <TabsList className="flex w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="deposits">Depósitos</TabsTrigger>
            <TabsTrigger value="withdrawals">Saques</TabsTrigger>
            <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
            <TabsTrigger value="users">Utilizadores</TabsTrigger>
            <TabsTrigger value="tickets">Suporte</TabsTrigger>
            <TabsTrigger value="broadcast">Avisos</TabsTrigger>
            <TabsTrigger value="settings">Definições</TabsTrigger>
          </TabsList>

          <TabsContent value="deposits">
            <Deposits onDone={refresh} />
          </TabsContent>
          <TabsContent value="withdrawals">
            <Withdrawals onDone={refresh} />
          </TabsContent>
          <TabsContent value="affiliates">
            <Affiliates onDone={refresh} />
          </TabsContent>
          <TabsContent value="users">
            <Users onDone={refresh} />
          </TabsContent>
          <TabsContent value="tickets">
            <Tickets onDone={refresh} />
          </TabsContent>
          <TabsContent value="broadcast">
            <Broadcast />
          </TabsContent>
          <TabsContent value="settings">
            <Settings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="surface-card mt-3 p-4">{children}</div>;
}

function Deposits({ onDone }: { onDone: () => void }) {
  const review = useServerFn(reviewDepositFn);
  const getProof = useServerFn(proofUrlFn);
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposit_requests")
        .select("*, plans(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const act = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await review({ data: { id, approve } });
      toast.success(approve ? "Depósito aprovado e plano ativado." : "Depósito rejeitado.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar.");
    } finally {
      setBusy(null);
    }
  };

  const viewProof = async (path: string) => {
    try {
      const { url } = await getProof({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Não foi possível abrir o comprovativo.");
    }
  };

  return (
    <Card>
      {(data ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem pedidos.</p>}
      <div className="divide-y divide-border">
        {(data ?? []).map((d) => {
          const user = d.profiles as { full_name: string; public_id: string; email: string } | null;
          return (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {user?.full_name || user?.email} · {(d.plans as { name: string } | null)?.name} · {MZN(d.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Nº {d.sender_number} · ID {d.transaction_id} · {formatDateTime(d.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {d.proof_path && (
                  <Button size="sm" variant="ghost" onClick={() => viewProof(d.proof_path!)} className="gap-1">
                    <ExternalLink className="size-4" /> Comprovativo
                  </Button>
                )}
                {d.status === "PENDING" ? (
                  <>
                    <Button size="sm" onClick={() => act(d.id, true)} disabled={busy === d.id}>
                      Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => act(d.id, false)} disabled={busy === d.id}>
                      Rejeitar
                    </Button>
                  </>
                ) : (
                  <Pill status={d.status} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Withdrawals({ onDone }: { onDone: () => void }) {
  const review = useServerFn(reviewWithdrawalFn);
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const act = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await review({ data: { id, approve } });
      toast.success(approve ? "Saque aprovado." : "Saque rejeitado.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      {(data ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem pedidos.</p>}
      <div className="divide-y divide-border">
        {(data ?? []).map((w) => {
          const user = w.profiles as { full_name: string; email: string } | null;
          return (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {user?.full_name || user?.email} · {MZN(w.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {w.reference} · líquido {MZN(w.net_amount)} · {w.phone} · {formatDateTime(w.created_at)}
                </p>
              </div>
              {w.status === "PENDING" ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act(w.id, true)} disabled={busy === w.id}>
                    Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => act(w.id, false)} disabled={busy === w.id}>
                    Rejeitar
                  </Button>
                </div>
              ) : (
                <Pill status={w.status} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Affiliates({ onDone }: { onDone: () => void }) {
  const review = useServerFn(reviewAffiliateFn);
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-affiliates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const act = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await review({ data: { id, approve } });
      toast.success(approve ? "Submissão aprovada." : "Submissão rejeitada.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      {(data ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem submissões.</p>}
      <div className="divide-y divide-border">
        {(data ?? []).map((a) => {
          const user = a.profiles as { full_name: string; email: string } | null;
          return (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {user?.full_name || user?.email} · {a.type === "VIDEO" ? "Vídeo" : "Publicação"} · {MZN(a.reward)}
                </p>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-primary hover:underline"
                >
                  {a.url}
                </a>
              </div>
              {a.status === "PENDING" ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act(a.id, true)} disabled={busy === a.id}>
                    Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => act(a.id, false)} disabled={busy === a.id}>
                    Rejeitar
                  </Button>
                </div>
              ) : (
                <Pill status={a.status} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Users({ onDone }: { onDone: () => void }) {
  const adjust = useServerFn(adjustBalanceFn);
  const block = useServerFn(setBlockedFn);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`full_name.ilike.${term},email.ilike.${term},public_id.ilike.${term},phone.ilike.${term}`);
      }
      const { data } = await query;
      return data ?? [];
    },
  });

  const doAdjust = async (userId: string) => {
    setBusy(true);
    try {
      await adjust({ data: { userId, amount: Number(amount), reason } });
      toast.success("Saldo ajustado.");
      setAmount("");
      setReason("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ajustar.");
    } finally {
      setBusy(false);
    }
  };

  const doBlock = async (userId: string, blocked: boolean) => {
    setBusy(true);
    try {
      await block({ data: { userId, blocked } });
      toast.success(blocked ? "Utilizador bloqueado." : "Utilizador desbloqueado.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Input
        placeholder="Pesquisar por nome, e-mail, ID ou telefone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mt-3 divide-y divide-border">
        {(data ?? []).map((u) => (
          <div key={u.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {u.full_name || u.email} {u.blocked && <span className="text-destructive">(bloqueado)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {u.public_id} · {u.email} · {u.phone} · Saldo {MZN(u.balance)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpenId(openId === u.id ? null : u.id)}>
                  Gerir
                </Button>
                <Button
                  size="sm"
                  variant={u.blocked ? "secondary" : "destructive"}
                  onClick={() => doBlock(u.id, !u.blocked)}
                  disabled={busy}
                >
                  {u.blocked ? "Desbloquear" : "Bloquear"}
                </Button>
              </div>
            </div>
            {openId === u.id && (
              <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Valor (use negativo para debitar)</Label>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Motivo</Label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" onClick={() => doAdjust(u.id)} disabled={busy || !amount || !reason.trim()}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Aplicar ajuste
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Tickets({ onDone }: { onDone: () => void }) {
  const reply = useServerFn(replyTicketFn);
  const setStatus = useServerFn(ticketStatusFn);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["admin-ticket-messages", openId],
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

  const send = async () => {
    if (!openId) return;
    setBusy(true);
    try {
      await reply({ data: { ticketId: openId, message: text, asAdmin: true } });
      setText("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao responder.");
    } finally {
      setBusy(false);
    }
  };

  const close = async (ticketId: string) => {
    try {
      await setStatus({ data: { ticketId, status: "CLOSED" } });
      toast.success("Ticket fechado.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao fechar.");
    }
  };

  return (
    <Card>
      {(tickets ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem tickets.</p>}
      <div className="space-y-2">
        {(tickets ?? []).map((t) => {
          const user = t.profiles as { full_name: string; email: string } | null;
          return (
            <div key={t.id} className="rounded-xl border border-border">
              <button
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.full_name || user?.email} · {formatDateTime(t.updated_at)}
                  </p>
                </div>
                <Pill status={t.status} />
              </button>
              {openId === t.id && (
                <div className="space-y-2 border-t border-border p-3">
                  {(messages ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        m.is_admin ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"
                      }`}
                    >
                      <p>{m.message}</p>
                      <p className="mt-1 text-[10px] opacity-70">{formatDateTime(m.created_at)}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Responder..." />
                    <Button onClick={send} disabled={busy || !text.trim()}>
                      Enviar
                    </Button>
                    <Button variant="outline" onClick={() => close(t.id)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Broadcast() {
  const send = useServerFn(broadcastFn);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await send({ data: { title, body, onlyBlocked: false } });
      toast.success(`Aviso enviado para ${result.sent} utilizadores.`);
      setTitle("");
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="title">Título</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">Mensagem</Label>
          <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button onClick={submit} disabled={busy || !title.trim()}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Enviar para todos
        </Button>
      </div>
    </Card>
  );
}

function Settings() {
  const save = useServerFn(saveSettingsFn);
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });

  useEffect(() => {
    if (data) setValues(data);
  }, [data]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload: Record<string, string> = {};
      [...SUPPORT_FIELDS, ...PAYMENT_FIELDS].forEach((f) => {
        payload[f.key] = values[f.key] ?? "";
      });
      await save({ data: { values: payload } });
      toast.success("Definições guardadas. Já estão visíveis para os utilizadores.");
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao guardar.");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: string, label: string, placeholder: string) => (
    <div key={key} className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={values[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Card>
      <div className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Suporte do site</h2>
          <p className="text-xs text-muted-foreground">
            Preencha e guarde — os canais aparecem imediatamente no botão Suporte dos utilizadores. Campos vazios ficam
            ocultos.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SUPPORT_FIELDS.map((f) => field(f.key, f.label, f.placeholder))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Dados de pagamento (depósitos)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PAYMENT_FIELDS.map((f) => field(f.key, f.label, f.placeholder))}
          </div>
        </div>
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Guardar definições
        </Button>
      </div>
    </Card>
  );
}
