import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  FileText,
  HandHeart,
  Home,
  LogOut,
  LockKeyhole,
  Settings,
  ShieldCheck,
  UsersRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { MZN, todayMaputo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

const SERVICES = [
  { label: "Informações pessoais", icon: FileText, to: "/app/profile" },
  { label: "Relatórios da Equipe", icon: UsersRound, to: "/app/team" },
  { label: "Programa de Encaminhamento", icon: Home, to: "/app/affiliate" },
  { label: "Histórico de faturamento", icon: CreditCard, to: "/app/wallet" },
  { label: "Central de Suporte", icon: HandHeart, to: "/app/support" },
] as const;

function ProfilePage() {
  const { userId, session } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    wallet_number: "",
    province: "",
    district: "",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: activePlan } = useQuery({
    queryKey: ["profile-active-plan", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("*, plans(*)")
        .eq("user_id", userId!)
        .eq("status", "ACTIVE")
        .lte("start_date", todayMaputo())
        .gte("end_date", todayMaputo())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: claimsCount = 0 } = useQuery({
    queryKey: ["profile-claims-count", userId, profile?.account_tier],
    enabled: !!userId && !!profile,
    queryFn: async () => {
      const table = profile?.account_tier === "RECRUTA" ? "recruit_task_claims" : "task_claims";
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: todayClaimsCount = 0 } = useQuery({
    queryKey: ["profile-today-claims", userId, profile?.account_tier],
    enabled: !!userId && !!profile,
    queryFn: async () => {
      const table = profile?.account_tier === "RECRUTA" ? "recruit_task_claims" : "task_claims";
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("task_date", todayMaputo());
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: earnings = [] } = useQuery({
    queryKey: ["profile-earnings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_transactions")
        .select("amount, created_at, type, description")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const planRow = activePlan?.plans as
    | { name?: string; daily_task_count?: number }
    | undefined;

  const remainingTasks = useMemo(() => {
    if (profile?.account_tier === "RECRUTA") return Math.max(0, 4 - claimsCount);
    return Math.max(0, Number(planRow?.daily_task_count ?? 0) - todayClaimsCount);
  }, [claimsCount, planRow?.daily_task_count, profile?.account_tier, todayClaimsCount]);

  const maputoDate = (value: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Maputo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));

  const dateWithOffset = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return maputoDate(date.toISOString());
  };

  const incomeForDate = (offset: number) =>
    earnings
      .filter((row) => maputoDate(row.created_at) === dateWithOffset(offset) && Number(row.amount) > 0)
      .reduce((sum, row) => sum + Number(row.amount), 0);

  const yesterdayIncome = incomeForDate(-1);
  const todayIncome = incomeForDate(0);
  const totalProfit = earnings
    .filter((row) => Number(row.amount) > 0)
    .reduce((sum, row) => sum + Number(row.amount), 0);

  const save = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update(form).eq("id", userId);
      if (error) throw new Error(error.message);
      toast.success("Perfil atualizado.");
      setEditing(false);
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (!session?.user.email) {
      toast.error("Não foi possível identificar o email da sua conta.");
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos da palavra-passe.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da nova palavra-passe não corresponde.");
      return;
    }

    setPasswordBusy(true);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });
      if (loginError) throw new Error("A palavra-passe antiga está incorreta.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Palavra-passe alterada com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível alterar a palavra-passe.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const startEditing = () => {
    setForm({
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      wallet_number: profile?.wallet_number ?? "",
      province: profile?.province ?? "",
      district: profile?.district ?? "",
    });
    setEditing(true);
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const tierLabel = profile?.account_tier === "RECRUTA" ? "RECRUTA" : profile?.account_tier ?? "RECRUTA";
  const displayName = profile?.public_id || profile?.full_name || "RECRUTA";

  return (
    <div className="-mx-4 -mt-4 min-h-[calc(100vh-1rem)] bg-[#050b09] text-foreground lg:mx-0 lg:mt-0 lg:rounded-3xl">
      <div className="space-y-5 pb-8">
        <section className="relative overflow-hidden rounded-b-[2.75rem] border-b border-border/60 bg-[radial-gradient(circle_at_30%_0%,rgba(15,91,61,0.24),transparent_48%),linear-gradient(180deg,#0b2119,#07100c)] px-5 pb-7 pt-5">
          <div className="flex justify-end gap-3">
            <Link to="/app/notifications" aria-label="Notificações">
              <span className="flex size-14 items-center justify-center rounded-full border border-border/70 bg-black/10">
                <Bell className="size-6" />
              </span>
            </Link>
            <Link to="/app/wallet" aria-label="Carteira">
              <span className="flex size-14 items-center justify-center rounded-full border border-border/70 bg-black/10">
                <Wallet className="size-6" />
              </span>
            </Link>
          </div>

          <div className="mt-7 flex items-center gap-5">
            <div className="flex size-[118px] shrink-0 items-center justify-center rounded-[2rem] border-4 border-primary bg-white/90 p-1 shadow-[0_0_24px_rgba(16,255,130,0.22)]">
              <div className="flex size-full items-center justify-center rounded-[1.55rem] bg-slate-200 text-slate-700">
                <CircleUserRound className="size-20" strokeWidth={1.4} />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-black tracking-tight">{displayName}</h1>
              <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary px-3 py-1 text-sm font-extrabold text-primary">
                <ShieldCheck className="size-4" />
                {tierLabel}
              </span>
            </div>
          </div>
        </section>

        <section className="mx-4 rounded-[2.5rem] border-2 border-primary/90 bg-[linear-gradient(135deg,rgba(8,34,23,0.98),rgba(10,43,28,0.92))] p-5 shadow-[0_0_26px_rgba(16,255,130,0.07)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Saldo disponível</p>
              <p className="mt-2 text-3xl font-black">{MZN(profile?.balance ?? 0)}</p>
              <Link to="/app/wallet" className="mt-4 inline-flex rounded-full bg-primary px-7 py-3 text-sm font-black text-primary-foreground shadow-lg">
                RECARREGAR
              </Link>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Depósito de segurança</p>
              <p className="mt-2 text-3xl font-black">{MZN(0)}</p>
              <Link to="/app/wallet" className="mt-4 inline-flex rounded-full bg-primary px-7 py-3 text-sm font-black text-primary-foreground shadow-lg">
                RETIRAR
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4">
          <h2 className="mb-4 text-2xl font-black tracking-tight">Análise de conta</h2>
          <div className="grid grid-cols-3 gap-3">
            <AnalysisCard label="ONTEM" value={MZN(yesterdayIncome)} />
            <AnalysisCard label="HOJE" value={MZN(todayIncome)} />
            <AnalysisCard label="LUCRO TOTAL" value={MZN(totalProfit)} active />
            <AnalysisCard label="TAREFAS CONCLUÍDAS" value={String(claimsCount)} />
            <AnalysisCard label="RESTANTE" value={String(remainingTasks)} />
            <AnalysisCard label="REEMBOLSO PARA EQUIPES" value={MZN(0)} />
          </div>
        </section>

        <section className="px-4">
          <h2 className="mb-4 text-2xl font-black tracking-tight">Serviços</h2>
          <div className="overflow-hidden rounded-[2.25rem] border border-border/80 bg-[#111b17]">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <Link
                  key={service.label}
                  to={service.to}
                  className="flex min-h-[102px] items-center gap-5 border-b border-border/70 px-7 last:border-b-0 active:bg-secondary/60"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-[#07100c]">
                    <Icon className="size-7 text-foreground" />
                  </span>
                  <span className="flex-1 text-lg font-extrabold">{service.label}</span>
                  <ChevronRight className="size-7 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="px-4">
          <button type="button" onClick={startEditing} className="flex w-full items-center gap-4 rounded-2xl border border-border bg-[#111b17] px-5 py-4 text-left">
            <Settings className="size-5 text-primary" />
            <span className="flex-1">
              <span className="block text-sm font-bold">Configurações da conta</span>
              <span className="block text-xs text-muted-foreground">Editar dados pessoais e palavra-passe</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>
        </section>

        {editing && (
          <div className="mx-4 space-y-5 rounded-[2rem] border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Configurações</h2>
              <Button variant="ghost" onClick={() => setEditing(false)}>Fechar</Button>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="full_name">Nome completo</Label>
                <Input id="full_name" className="mt-1.5" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" className="mt-1.5" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="wallet_number">Número da carteira</Label>
                  <Input id="wallet_number" className="mt-1.5" value={form.wallet_number} onChange={(e) => setForm((p) => ({ ...p, wallet_number: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="province">Província</Label>
                  <Input id="province" className="mt-1.5" value={form.province} onChange={(e) => setForm((p) => ({ ...p, province: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="district">Distrito</Label>
                  <Input id="district" className="mt-1.5" value={form.district} onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={save} disabled={busy}>Guardar alterações</Button>
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div className="flex items-center gap-2">
                <LockKeyhole className="size-5 text-primary" />
                <h3 className="font-bold">Alterar palavra-passe</h3>
              </div>
              <Input type="password" autoComplete="current-password" placeholder="Palavra-passe antiga" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <Input type="password" autoComplete="new-password" placeholder="Nova palavra-passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Input type="password" autoComplete="new-password" placeholder="Confirmar nova palavra-passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <Button className="w-full" onClick={changePassword} disabled={passwordBusy}>Alterar palavra-passe</Button>
            </div>

            <Button variant="outline" className="w-full gap-2" onClick={signOut}>
              <LogOut className="size-4" />
              Terminar sessão
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalysisCard({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={`min-h-[128px] rounded-[1.75rem] border p-4 text-center ${active ? "border-primary bg-primary/10" : "border-border bg-[#111b17]"}`}>
      <p className={`text-xs font-extrabold tracking-wide ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-5 text-2xl font-black ${active ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
