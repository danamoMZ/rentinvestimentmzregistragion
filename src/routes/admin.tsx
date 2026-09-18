import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  ShieldAlert,
  ExternalLink,
  ArrowLeft,
  Copy,
  Gift,
  KeyRound,
  Eye,
  EyeOff,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/hooks/use-session";
import {
  adjustBalanceFn,
  adminChangeUserPasswordFn,
  broadcastFn,
  proofUrlFn,
  reviewAffiliateFn,
  reviewDepositFn,
  reviewWithdrawalFn,
  saveSettingsFn,
  setBlockedFn,
  ticketStatusFn,
  replyTicketFn,
  updatePlanFn,
  createPromoCodeFn,
  setPromoCodeActiveFn,
  grantShareRewardFn,
  removeUserPlanFn,
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
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="promo">Recarga secreta</TabsTrigger>
            <TabsTrigger value="share">Partilha e Ganha</TabsTrigger>
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
          <TabsContent value="plans">
            <PlansAdmin onDone={refresh} />
          </TabsContent>
          <TabsContent value="promo">
            <PromoAdmin onDone={refresh} />
          </TabsContent>
          <TabsContent value="share">
            <ShareRewardAdmin />
          </TabsContent>
          <TabsContent value="settings">
            <Settings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function useProfilesMap() {
  const { data } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, public_id");
      return Object.fromEntries(
        (data ?? []).map((p) => [p.id, p as { id: string; full_name: string; email: string; public_id: string }]),
      );
    },
  });
  return data ?? {};
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="surface-card mt-3 p-4">{children}</div>;
}

function Deposits({ onDone }: { onDone: () => void }) {
  const profiles = useProfilesMap();
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
          const user = profiles[d.user_id];
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
  const profiles = useProfilesMap();
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
          const user = profiles[w.user_id];
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
  const profiles = useProfilesMap();
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
          const user = profiles[a.user_id];
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
  const removePlan = useServerFn(removeUserPlanFn);
  const changePassword = useServerFn(adminChangeUserPasswordFn);

  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [removingPlan, setRemovingPlan] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(
          `full_name.ilike.${term},email.ilike.${term},public_id.ilike.${term},phone.ilike.${term}`,
        );
      }

      const { data } = await query;
      return data ?? [];
    },
  });

  const doAdjust = async (userId: string) => {
    setBusy(true);

    try {
      await adjust({
        data: {
          userId,
          amount: Number(amount),
          reason,
        },
      });

      toast.success("Saldo ajustado.");

      setAmount("");
      setReason("");

      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erro ao ajustar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const doBlock = async (userId: string, blocked: boolean) => {
    setBusy(true);

    try {
      await block({
        data: {
          userId,
          blocked,
        },
      });

      toast.success(
        blocked
          ? "Utilizador bloqueado."
          : "Utilizador desbloqueado.",
      );

      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openPasswordForm = (userId: string) => {
    if (passwordUserId === userId) {
      setPasswordUserId(null);
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      return;
    }

    setPasswordUserId(userId);
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const doChangePassword = async (userId: string) => {
    if (!newPassword) {
      toast.error("Digite a nova palavra-passe.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error(
        "A palavra-passe deve ter pelo menos 8 caracteres.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        "As palavras-passe não coincidem.",
      );
      return;
    }

    setPasswordBusy(true);

    try {
      const result = await changePassword({
        data: {
          userId,
          newPassword,
        },
      });

      toast.success(
        `Palavra-passe de ${result.name || result.publicId || "utilizador"} alterada com sucesso.`,
      );

      setNewPassword("");
      setConfirmPassword("");
      setPasswordUserId(null);
      setShowPassword(false);
      setShowConfirmPassword(false);

      onDone();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar a palavra-passe.",
      );
    } finally {
      setPasswordBusy(false);
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
                  {u.full_name || u.email}{" "}
                  {u.blocked && (
                    <span className="text-destructive">
                      (bloqueado)
                    </span>
                  )}
                </p>

                <p className="text-xs text-muted-foreground">
                  {u.public_id} · {u.email} · {u.phone} · Saldo{" "}
                  {MZN(u.balance)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setOpenId(
                      openId === u.id ? null : u.id,
                    )
                  }
                >
                  Gerir
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openPasswordForm(u.id)
                  }
                  className="gap-1.5"
                >
                  <KeyRound className="size-4" />
                  Palavra-passe
                </Button>

                <Button
                  size="sm"
                  variant={
                    u.blocked
                      ? "secondary"
                      : "destructive"
                  }
                  onClick={() =>
                    doBlock(u.id, !u.blocked)
                  }
                  disabled={busy}
                >
                  {u.blocked
                    ? "Desbloquear"
                    : "Bloquear"}
                </Button>
              </div>
            </div>

            {openId === u.id && (
              <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>
                      Valor (use negativo para debitar)
                    </Label>

                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Motivo</Label>

                    <Input
                      value={reason}
                      onChange={(e) =>
                        setReason(e.target.value)
                      }
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => doAdjust(u.id)}
                  disabled={
                    busy ||
                    !amount ||
                    !reason.trim()
                  }
                >
                  {busy && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}

                  Aplicar ajuste
                </Button>
              </div>
            )}

            {passwordUserId === u.id && (
              <div className="mt-3 rounded-xl border border-primary/30 bg-secondary p-4">
                <div className="mb-3 flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" />

                  <div>
                    <p className="text-sm font-semibold">
                      Alterar palavra-passe
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {u.full_name ||
                        u.email ||
                        u.public_id}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`new-password-${u.id}`}>
                      Nova palavra-passe
                    </Label>

                    <div className="relative">
                      <Input
                        id={`new-password-${u.id}`}
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={newPassword}
                        onChange={(e) =>
                          setNewPassword(
                            e.target.value,
                          )
                        }
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="new-password"
                        className="pr-10"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (value) => !value,
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showPassword
                            ? "Ocultar palavra-passe"
                            : "Mostrar palavra-passe"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`confirm-password-${u.id}`}
                    >
                      Confirmar palavra-passe
                    </Label>

                    <div className="relative">
                      <Input
                        id={`confirm-password-${u.id}`}
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        value={confirmPassword}
                        onChange={(e) =>
                          setConfirmPassword(
                            e.target.value,
                          )
                        }
                        placeholder="Repita a nova palavra-passe"
                        autoComplete="new-password"
                        className="pr-10"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(
                            (value) => !value,
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showConfirmPassword
                            ? "Ocultar confirmação"
                            : "Mostrar confirmação"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      doChangePassword(u.id)
                    }
                    disabled={
                      passwordBusy ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="gap-1.5"
                  >
                    {passwordBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <KeyRound className="size-4" />
                    )}

                    Alterar palavra-passe
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPasswordUserId(null);
                      setNewPassword("");
                      setConfirmPassword("");
                      setShowPassword(false);
                      setShowConfirmPassword(false);
                    }}
                    disabled={passwordBusy}
                  >
                    Cancelar
                  </Button>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  A nova palavra-passe deve ter pelo menos
                  8 caracteres.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
         
function Tickets({ onDone }: { onDone: () => void }) {
  const profiles = useProfilesMap();
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
          const user = profiles[t.user_id];
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

/* ------------------------------- Planos ------------------------------- */

type PlanRow = {
  id: number;
  name: string;
  price: number;
  daily_task_count: number;
  task_value: number;
  daily_income: number;
  duration_days: number;
  total_task_income: number;
  active: boolean;
  sort_order: number;
};

type PlanDraft = { name: string; price: string; daily_task_count: string; daily_income: string; duration_days: string; active: boolean };

function PlansAdmin({ onDone }: { onDone: () => void }) {
  const update = useServerFn(updatePlanFn);
  const [drafts, setDrafts] = useState<Record<number, PlanDraft>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("sort_order").order("id");
      if (error) throw error;
      return data as PlanRow[];
    },
  });

  const draftFor = (p: PlanRow): PlanDraft =>
    drafts[p.id] ?? {
      name: p.name,
      price: String(p.price),
      daily_task_count: String(p.daily_task_count),
      daily_income: String(p.daily_income),
      duration_days: String(p.duration_days),
      active: p.active,
    };

  const setDraft = (p: PlanRow, patch: Partial<PlanDraft>) =>
    setDrafts((prev) => ({ ...prev, [p.id]: { ...draftFor(p), ...patch } }));

  const save = async (p: PlanRow) => {
    const d = draftFor(p);
    const price = Number(d.price);
    const tasks = Number(d.daily_task_count);
    const income = Number(d.daily_income);
    const days = Number(d.duration_days);
    if ([price, tasks, income, days].some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error("Valores inválidos: não são permitidos negativos.");
      return;
    }
    if (tasks <= 0 || days <= 0) {
      toast.error("Tarefas por dia e duração devem ser maiores que zero.");
      return;
    }
    setBusyId(p.id);
    try {
      await update({
        data: {
          planId: p.id,
          fields: { name: d.name, price, daily_task_count: tasks, daily_income: income, duration_days: days, active: d.active },
        },
      });
      toast.success(`${d.name} atualizado. Valor por tarefa e total recalculados.`);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[p.id];
        return next;
      });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao guardar o plano.");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) return <Card><Loader2 className="mx-auto size-5 animate-spin text-primary" /></Card>;

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-xs text-muted-foreground">
          Edite preço, tarefas/dia, ganho diário e duração. O valor por tarefa (ganho diário ÷ tarefas) e o total do ciclo
          (ganho diário × dias) são calculados automaticamente. Planos inativos deixam de aparecer aos utilizadores.
        </p>
      </Card>
      {(plans ?? []).map((p) => {
        const d = draftFor(p);
        const income = Number(d.daily_income) || 0;
        const tasks = Number(d.daily_task_count) || 0;
        const days = Number(d.duration_days) || 0;
        const perTask = tasks > 0 ? Math.round((income / tasks) * 100) / 100 : 0;
        const total = Math.round(income * days * 100) / 100;
        const num = (key: keyof PlanDraft, label: string) => (
          <div className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={d[key] as string}
              onChange={(e) => setDraft(p, { [key]: e.target.value } as Partial<PlanDraft>)}
            />
          </div>
        );
        return (
          <Card key={p.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">#{p.id}</span>
                <Input className="h-8 w-40 font-semibold" value={d.name} onChange={(e) => setDraft(p, { name: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={d.active} onChange={(e) => setDraft(p, { active: e.target.checked })} />
                Ativo
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              {num("price", "Preço (MZN)")}
              {num("daily_task_count", "Tarefas/dia")}
              {num("daily_income", "Ganho diário (MZN)")}
              {num("duration_days", "Duração (dias)")}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Por tarefa: <strong className="text-foreground">{MZN(perTask)}</strong> · Total do ciclo:{" "}
                <strong className="text-foreground">{MZN(total)}</strong>
              </span>
              <Button size="sm" onClick={() => save(p)} disabled={busyId !== null}>
                {busyId === p.id && <Loader2 className="mr-2 size-4 animate-spin" />} Guardar
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------- Recarga secreta --------------------------- */

type PromoRow = {
  id: string;
  code: string;
  bonus: number;
  max_uses: number;
  uses_count: number;
  expires_at: string;
  active: boolean;
  created_at: string;
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function countdown(expiresAt: string, now: number) {
  const diff = Math.max(0, new Date(expiresAt).getTime() - now);
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function PromoAdmin({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createPromoCodeFn);
  const setActive = useServerFn(setPromoCodeActiveFn);
  const now = useNow();
  const [bonus, setBonus] = useState("20");
  const [maxUses, setMaxUses] = useState("1");
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: codes } = useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as PromoRow[];
    },
    refetchInterval: 15000,
  });

  const { data: redemptions } = useQuery({
    queryKey: ["admin-promo-redemptions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("promo_redemptions")
        .select("id, code_id, user_id, bonus_value, redeemed_at, status")
        .order("redeemed_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const profiles = useProfilesMap();
  const codeById = new Map((codes ?? []).map((c) => [c.id, c.code]));

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Código copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const generate = async () => {
    const b = Number(bonus);
    const m = Number(maxUses);
    if (!Number.isFinite(b) || b <= 0) {
      toast.error("O bónus deve ser maior que zero.");
      return;
    }
    if (!Number.isFinite(m) || m <= 0) {
      toast.error("A quantidade de utilizações deve ser maior que zero.");
      return;
    }
    setBusy(true);
    try {
      const created = await create({ data: { bonus: b, maxUses: Math.floor(m), validityMinutes: 60 } });
      toast.success(`Código ${created.code} gerado — válido por 1 hora.`);
      await copy(created.code);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar o código.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: PromoRow) => {
    setToggling(c.id);
    try {
      await setActive({ data: { codeId: c.id, active: !c.active } });
      toast.success(c.active ? "Código desativado." : "Código reativado.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar o código.");
    } finally {
      setToggling(null);
    }
  };

  const statusOf = (c: PromoRow) => {
    if (!c.active) return { label: "Desativado", cls: "border-border bg-muted text-muted-foreground" };
    if (new Date(c.expires_at).getTime() <= now) return { label: "Expirado", cls: STATUS_CLASS["REJECTED"] ?? "" };
    if (c.uses_count >= c.max_uses) return { label: "Esgotado", cls: STATUS_CLASS["REJECTED"] ?? "" };
    return { label: "Ativo", cls: STATUS_CLASS["APPROVED"] ?? "" };
  };

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-2">
          <Gift className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Gerar código de recarga secreta</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada código é válido por <strong>1 hora</strong>, tem limite de utilizações e só pode ser usado uma vez por
          utilizador. O bónus é creditado de imediato no saldo.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Bónus (MZN)</Label>
            <Input type="number" min={1} value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Utilizações máximas</Label>
            <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={generate} disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Gerar código (1h)
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Códigos</h2>
        <div className="mt-2 divide-y divide-border">
          {(codes ?? []).length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nenhum código gerado.</p>}
          {(codes ?? []).map((c) => {
            const st = statusOf(c);
            const live = st.label === "Ativo";
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm font-bold tracking-wider">{c.code}</code>
                    <Button size="icon" variant="ghost" className="size-7" aria-label="Copiar código" onClick={() => copy(c.code)}>
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {MZN(c.bonus)} · {c.uses_count}/{c.max_uses} usos · criado {formatDateTime(c.created_at)}
                    {live && (
                      <>
                        {" "}· expira em <span className="font-mono font-semibold text-foreground">{countdown(c.expires_at, now)}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  <Button size="sm" variant="outline" onClick={() => toggle(c)} disabled={toggling !== null}>
                    {toggling === c.id && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                    {c.active ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Histórico de resgates</h2>
        <div className="mt-2 divide-y divide-border">
          {(redemptions ?? []).length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sem resgates.</p>}
          {(redemptions ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{profiles?.[r.user_id]?.full_name ?? r.user_id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">
                  {codeById.get(r.code_id) ?? "—"} · {formatDateTime(r.redeemed_at)}
                </p>
              </div>
              <span className="font-bold text-success">+{MZN(r.bonus_value)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ShareRewardAdmin() {
  const grant = useServerFn(grantShareRewardFn);
  const queryClient = useQueryClient();
  const [publicId, setPublicId] = useState("");
  const [busy, setBusy] = useState(false);
  const now = useNow();

  const { data: rewards } = useQuery({
    queryKey: ["admin-share-rewards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("share_rewards")
        .select("id, user_id, amount, reward_date, expires_at, status, claimed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const { data: profiles } = useQuery({
    queryKey: ["admin-share-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, public_id");
      return new Map((data ?? []).map((p) => [p.id, p]));
    },
  });

  const submit = async () => {
    setBusy(true);
    try {
      const res = await grant({ data: { publicId } });
      toast.success(`Bónus de 40 MZN enviado para ${res.name || res.publicId}. Válido por 3 horas.`);
      setPublicId("");
      queryClient.invalidateQueries({ queryKey: ["admin-share-rewards"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar o bónus.");
    } finally {
      setBusy(false);
    }
  };

  const statusOf = (r: { status: string; expires_at: string }) => {
    if (r.status === "CLAIMED") return { label: "Reivindicado", cls: "text-emerald-400" };
    if (r.status === "EXPIRED" || new Date(r.expires_at).getTime() <= now) return { label: "Expirado", cls: "text-destructive" };
    return { label: `Pendente · ${countdown(r.expires_at, now)}`, cls: "text-primary" };
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-3">
          <div>
            <p className="font-semibold">PARTILHA E GANHA</p>
            <p className="text-xs text-muted-foreground">
              Introduza o ID do utilizador. Ele recebe uma notificação com o botão para reivindicar 40 MZN, válida por 3 horas.
              Cada ID só pode ser usado 1 vez por dia (dia calculado no servidor, fuso de Maputo).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="share-id">ID do utilizador</Label>
            <Input
              id="share-id"
              placeholder="Ex.: A1B2C3D4E5"
              value={publicId}
              onChange={(e) => setPublicId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && publicId.trim() && !busy && submit()}
            />
          </div>
          <Button onClick={submit} disabled={busy || !publicId.trim()} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />} Enviar bónus de 40 MZN
          </Button>
        </div>
      </Card>

      <Card>
        <p className="mb-3 font-semibold">Histórico</p>
        {(rewards ?? []).length === 0 && <p className="text-sm text-muted-foreground">Ainda sem registos.</p>}
        <div className="divide-y divide-border">
          {(rewards ?? []).map((r) => {
            const p = profiles?.get(r.user_id);
            const s = statusOf(r);
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {p?.public_id ?? "—"} · {p?.full_name ?? "Utilizador"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.reward_date} · {MZN(r.amount)} · enviado {formatDateTime(r.created_at)}
                    {r.claimed_at ? ` · reivindicado ${formatDateTime(r.claimed_at)}` : ""}
                  </p>
                </div>
                <span className={`font-mono text-xs ${s.cls}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
