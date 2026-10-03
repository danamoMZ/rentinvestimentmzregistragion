import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, CircleUserRound, LockKeyhole, LogOut, Trash2, ChevronRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { session, userId } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<"bank"|"password"|null>(null);
  const [form, setForm] = useState({ wallet_number: profile?.wallet_number ?? "", province: profile?.province ?? "", district: profile?.district ?? "" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const saveBank = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ wallet_number: form.wallet_number, province: form.province, district: form.district }).eq("id", userId);
      if (error) throw error;
      toast.success("Dados bancários atualizados.");
      setEditing(null); queryClient.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível guardar."); }
    finally { setBusy(false); }
  };

  const changePassword = async () => {
    if (!session?.user.email) return toast.error("Conta não identificada.");
    if (newPassword.length < 6) return toast.error("A nova palavra-passe deve ter pelo menos 6 caracteres.");
    if (newPassword !== confirmPassword) return toast.error("As palavras-passe não coincidem.");
    setBusy(true);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
      if (loginError) throw new Error("A palavra-passe atual está incorreta.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setEditing(null);
      toast.success("Palavra-passe alterada com sucesso.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível alterar."); }
    finally { setBusy(false); }
  };

  const clearCache = () => {
    queryClient.clear();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    toast.success("Cache local limpo.");
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-[#050b09] pb-8 text-foreground">
      <header className="-mx-4 flex items-center gap-4 border-b border-border/60 bg-[#0b2119] px-5 py-5">
        <button type="button" onClick={() => window.history.back()} className="flex size-12 items-center justify-center rounded-full border border-border/70" aria-label="Voltar"><ArrowLeft className="size-6"/></button>
        <h1 className="flex-1 text-center text-2xl font-black">Informações pessoais</h1><span className="size-12"/>
      </header>

      <div className="space-y-4 p-4">
        <section className="flex items-center justify-between rounded-[2rem] border border-border/80 bg-[#111b17] p-6">
          <div className="flex items-center gap-5"><CircleUserRound className="size-9 text-primary"/><span className="text-xl font-black">Avatar</span></div>
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-white">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="size-full object-cover"/> : <CircleUserRound className="size-12 text-slate-500"/>}
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-border/80 bg-[#111b17]">
          <button type="button" onClick={()=>{setForm({wallet_number:profile?.wallet_number??"",province:profile?.province??"",district:profile?.district??""});setEditing("bank")}} className="flex w-full items-center gap-5 border-b border-border/70 p-6 text-left">
            <Building2 className="size-8 text-primary"/><span className="flex-1 text-xl font-black">Conta bancária</span><ChevronRight className="size-6 text-muted-foreground"/>
          </button>
          <button type="button" onClick={()=>setEditing("password")} className="flex w-full items-center gap-5 p-6 text-left">
            <LockKeyhole className="size-8 text-primary"/><span className="flex-1 text-xl font-black">Senha de login</span><ChevronRight className="size-6 text-muted-foreground"/>
          </button>
        </section>

        <button type="button" onClick={clearCache} className="flex w-full items-center gap-5 rounded-[2rem] border border-border/80 bg-[#111b17] p-6 text-left">
          <Trash2 className="size-8 text-primary"/><span className="flex-1 text-xl font-black">Limpar cache</span><span className="text-sm font-bold text-muted-foreground">local</span>
        </button>

        <Button onClick={signOut} className="h-16 w-full rounded-3xl text-xl font-black">SAIR <LogOut className="ml-2 size-6"/></Button>

        {editing === "bank" && <section className="rounded-[2rem] border border-border bg-[#111b17] p-5 space-y-3">
          <h2 className="text-lg font-black">Conta bancária</h2>
          <Input placeholder="Número da carteira / conta" value={form.wallet_number} onChange={e=>setForm(p=>({...p,wallet_number:e.target.value}))}/>
          <Input placeholder="Província" value={form.province} onChange={e=>setForm(p=>({...p,province:e.target.value}))}/>
          <Input placeholder="Distrito" value={form.district} onChange={e=>setForm(p=>({...p,district:e.target.value}))}/>
          <Button className="w-full" onClick={saveBank} disabled={busy}>Guardar</Button>
          <Button variant="outline" className="w-full" onClick={()=>setEditing(null)}>Cancelar</Button>
        </section>}

        {editing === "password" && <section className="rounded-[2rem] border border-border bg-[#111b17] p-5 space-y-3">
          <h2 className="text-lg font-black">Senha de login</h2>
          <Input type="password" placeholder="Senha atual" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/>
          <Input type="password" placeholder="Nova senha" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
          <Input type="password" placeholder="Confirmar nova senha" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/>
          <Button className="w-full" onClick={changePassword} disabled={busy}>Alterar senha</Button>
          <Button variant="outline" className="w-full" onClick={()=>setEditing(null)}>Cancelar</Button>
        </section>}
      </div>
    </div>
  );
}
