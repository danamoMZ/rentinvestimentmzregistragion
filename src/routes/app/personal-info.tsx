import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, CircleUserRound, Landmark, LockKeyhole, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/app/personal-info")({
  head: () => ({ meta: [
    { title: "Informações pessoais — BLUE ORIGIN" },
    { name: "description", content: "Gerencie a sua foto, conta bancária e senha de login na BLUE ORIGIN." },
    { property: "og:title", content: "Informações pessoais — BLUE ORIGIN" },
    { property: "og:description", content: "Gerencie as informações e a segurança da sua conta BLUE ORIGIN." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PersonalInfoPage,
});

async function cacheSize() {
  if (!("caches" in window)) return 0;
  let bytes = 0;
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (response && response.type !== "opaque") bytes += (await response.blob()).size;
    }
  }
  return bytes;
}

function PersonalInfoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, session } = useSession();
  const { data: profile } = useProfile();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<"bank" | "password" | null>(null);
  const [wallet, setWallet] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [bytes, setBytes] = useState<number | null>(null);
  useEffect(() => { void cacheSize().then(setBytes).catch(() => setBytes(null)); }, []);

  const saveWallet = async () => {
    if (!userId) return;
    const number = wallet.replace(/\s/g, "").replace(/^\+?258/, "");
    if (!/^8[2-7]\d{7}$/.test(number)) { toast.error("Introduza um número de carteira válido de 9 dígitos."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ wallet_number: number }).eq("id", userId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      setDialog(null);
      toast.success("Conta bancária atualizada.");
    } catch { toast.error("Não foi possível guardar a conta bancária."); }
    finally { setBusy(false); }
  };

  const changePassword = async () => {
    if (!session?.user.email) return;
    if (!oldPassword || newPassword.length < 6) { toast.error("Preencha a senha atual e uma nova senha com pelo menos 6 caracteres."); return; }
    if (newPassword !== confirmation) { toast.error("As novas senhas não correspondem."); return; }
    setBusy(true);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: oldPassword });
      if (loginError) { toast.error("A senha atual está incorreta."); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setDialog(null); setOldPassword(""); setNewPassword(""); setConfirmation("");
      toast.success("Senha de login atualizada.");
    } catch { toast.error("Não foi possível alterar a senha. Escolha uma senha forte e tente novamente."); }
    finally { setBusy(false); }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file || !userId) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Escolha uma foto JPG, PNG ou WebP até 5 MB."); return;
    }
    setBusy(true);
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Foto indisponível");
      const side = Math.min(image.width, image.height);
      context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 256, 256);
      const avatar = canvas.toDataURL("image/jpeg", 0.8);
      const { error } = await supabase.from("profiles").update({ avatar_url: avatar }).eq("id", userId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success("Avatar atualizado.");
    } catch { toast.error("Não foi possível atualizar o avatar."); }
    finally { URL.revokeObjectURL(objectUrl); setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  const clearCache = async () => {
    setClearing(true);
    try {
      if ("caches" in window) await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
      await queryClient.cancelQueries();
      queryClient.removeQueries({ predicate: (query) => !["profile", "is-admin"].includes(String(query.queryKey[0])) });
      setBytes(await cacheSize());
      toast.success("Cache limpo. A sua sessão foi mantida.");
    } catch { toast.error("Não foi possível limpar o cache."); }
    finally { setClearing(false); }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      queryClient.clear();
      await navigate({ to: "/auth", replace: true });
    } catch { toast.error("Não foi possível sair. Tente novamente."); setBusy(false); }
  };

  const row = "h-auto w-full justify-start gap-5 whitespace-normal px-6 py-6 text-left text-lg font-extrabold hover:bg-secondary [&_svg]:size-6";
  return (
    <div className="-mx-4 -mt-4 min-h-[calc(100dvh-6rem)] bg-background lg:mx-0 lg:mt-0">
      <header className="relative flex min-h-24 items-center justify-center border-b border-border bg-card/50 px-20">
        <Button variant="secondary" size="icon" aria-label="Voltar à Conta" title="Voltar" onClick={() => navigate({ to: "/app/profile" })} className="absolute left-5 size-12 rounded-full border border-border [&_svg]:size-6"><ArrowLeft /></Button>
        <h1 className="text-center text-xl font-extrabold">Informações pessoais</h1>
      </header>
      <div className="mx-auto max-w-2xl space-y-6 px-5 py-6 sm:px-7">
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher avatar" className="hidden" onChange={(e) => void uploadAvatar(e.target.files?.[0])} />
        <Button variant="ghost" disabled={busy} onClick={() => fileInput.current?.click()} className={`${row} min-h-28 rounded-[2rem] border border-border bg-card`}>
          <CircleUserRound className="text-primary" /><span className="flex-1">Avatar</span>
          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-secondary">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="O seu avatar" className="size-full object-cover" /> : <CircleUserRound className="text-primary !size-11" />}
          </span>
        </Button>
        <div className="overflow-hidden rounded-[2rem] border border-border bg-card">
          <Button variant="ghost" onClick={() => { setWallet(profile?.wallet_number ?? ""); setDialog("bank"); }} className={`${row} min-h-20 rounded-none border-b border-border`}><Landmark className="text-primary" /><span className="flex-1">Conta bancária</span><ChevronRight className="text-muted-foreground" /></Button>
          <Button variant="ghost" onClick={() => setDialog("password")} className={`${row} min-h-20 rounded-none`}><LockKeyhole className="text-primary" /><span className="flex-1">Senha de login</span><ChevronRight className="text-muted-foreground" /></Button>
        </div>
        <Button variant="ghost" disabled={clearing} onClick={clearCache} className={`${row} min-h-20 rounded-[2rem] border border-border bg-card`}><Trash2 className="text-primary" /><span className="flex-1">Limpar cache</span><span className="text-base text-muted-foreground">{clearing ? "…" : bytes === null ? "—" : `${(bytes / (1024 * 1024)).toLocaleString("pt-MZ", { maximumFractionDigits: 1 })} MB`}</span></Button>
        <div className="px-3 pt-3"><Button disabled={busy} onClick={signOut} className="brand-gradient h-20 w-full rounded-[1.5rem] text-xl font-black text-primary-foreground">SAIR</Button></div>
      </div>
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !busy) setDialog(null); }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
          <DialogHeader><DialogTitle>{dialog === "bank" ? "Conta bancária" : "Senha de login"}</DialogTitle><DialogDescription>{dialog === "bank" ? "Número da carteira móvel para os seus levantamentos." : "Atualize a senha de acesso à sua conta."}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void (dialog === "bank" ? saveWallet() : changePassword()); }}>
            {dialog === "bank" ? <div><Label htmlFor="wallet-number">Número da carteira</Label><Input id="wallet-number" className="mt-2" type="tel" inputMode="tel" autoComplete="tel" placeholder="+258 841234567" value={wallet} onChange={(e) => setWallet(e.target.value)} required /></div> : <>
              <div><Label htmlFor="old-password">Senha atual</Label><Input id="old-password" className="mt-2" type="password" autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required /></div>
              <div><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" className="mt-2" type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
              <div><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" className="mt-2" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required /></div>
            </>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? "A guardar…" : "Guardar alterações"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}