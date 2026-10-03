import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Link2, QrCode, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { MZN, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/affiliate")({ component: Affiliate });

function Affiliate() {
  const { userId } = useSession();
  const { data: profile } = useProfile();
  const [copied, setCopied] = useState("");
  const { data: referrals = [] } = useQuery({
    queryKey: ["referrals", userId], enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("referrals").select("*").eq("referrer_id", userId!).order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
  });
  const code = profile?.referral_code ?? "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteLink = code ? `${origin}/auth?mode=register&ref=${encodeURIComponent(code)}` : "";
  const qrUrl = inviteLink ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(inviteLink)}` : "";
  const copy = async (value:string,label:string) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(label); toast.success(`${label} copiado!`); window.setTimeout(()=>setCopied(""),1600); }
    catch { toast.error("Não foi possível copiar."); }
  };
  const rewarded = referrals.filter(x=>x.rewarded).length;
  const earned = referrals.reduce((s,x)=>s+Number(x.reward_amount??0),0);
  return <div className="min-h-screen space-y-5 bg-[#050b09] pb-8 text-foreground">
    <header className="-mx-4 flex items-center gap-4 border-b border-border/60 bg-[#0b2119] px-5 py-5">
      <button type="button" onClick={()=>window.history.back()} className="flex size-12 items-center justify-center rounded-full border border-border/70"><ArrowLeft className="size-6"/></button>
      <h1 className="flex-1 text-center text-2xl font-black">Convide amigos</h1><span className="size-12"/>
    </header>
    <section className="mx-4 rounded-[2.5rem] border border-border/80 bg-[#111b17] p-7 text-center">
      <h2 className="text-3xl font-black leading-tight">Convide seus amigos para conhecerem<br/>a BLUE ORIGIN!</h2>
      <div className="mx-auto mt-7 flex size-[260px] items-center justify-center overflow-hidden rounded-3xl bg-white p-3 shadow-[0_0_35px_rgba(16,255,130,0.12)]">
        {qrUrl ? <img src={qrUrl} alt="QR Code do convite" className="size-full object-contain"/> : <QrCode className="size-24 text-slate-400"/>}
      </div>
      <p className="mt-6 text-sm font-bold uppercase tracking-wide text-muted-foreground">Escaneie o código QR para participar agora.</p>
      <div className="mt-6 space-y-3 text-left">
        <CopyRow label="COPIAR CÓDIGO" value={code} onCopy={()=>copy(code,"Código")} icon={<Copy className="size-5"/>}/>
        <CopyRow label="COPIAR LINK" value={inviteLink} onCopy={()=>copy(inviteLink,"Link")} icon={<Link2 className="size-5"/>}/>
      </div>
    </section>
    <section className="mx-4 grid grid-cols-3 gap-3">
      <Stat icon={<Users className="mx-auto size-5"/>} label="CONVIDADOS" value={String(referrals.length)}/>
      <Stat label="ATIVOS" value={String(rewarded)}/><Stat label="GANHOS" value={MZN(earned)}/>
    </section>
    <section className="mx-4 rounded-[2rem] border border-border/80 bg-[#111b17] p-5">
      <h2 className="text-lg font-black">Histórico de convites</h2>
      {referrals.length===0 ? <p className="py-8 text-center text-sm text-muted-foreground">Ainda não convidou ninguém.</p> :
      <div className="mt-3 divide-y divide-border/70">{referrals.map(item=><div key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold">Membro #{item.referred_id.slice(0,8)}</p><p className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p></div><span className={item.rewarded?"font-bold text-primary":"text-xs text-muted-foreground"}>{item.rewarded?MZN(item.reward_amount):"Sem plano ativo"}</span></div>)}</div>}
    </section>
    {copied && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow-xl">{copied}</div>}
  </div>;
}
function CopyRow({label,value,onCopy,icon}:{label:string;value:string;onCopy:()=>void;icon:React.ReactNode}){return <div className="flex items-center gap-3 rounded-3xl border border-border/80 bg-[#050b09] p-4"><div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-muted-foreground">{label}</p><p className="mt-1 break-all text-base font-black">{value||"A gerar..."}</p></div><button type="button" onClick={onCopy} disabled={!value} className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg disabled:opacity-40">{icon}</button></div>}
function Stat({label,value,icon}:{label:string;value:string;icon?:React.ReactNode}){return <div className="rounded-3xl border border-border/80 bg-[#111b17] p-4 text-center">{icon}<p className="mt-2 text-[11px] font-extrabold text-muted-foreground">{label}</p><p className="mt-2 text-lg font-black">{value}</p></div>}
