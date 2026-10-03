import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { MZN } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/team")({
  component: Team,
});

const LEVELS = [
  { level: 1, range: "0 – 30 convidados", pct: "10%" },
  { level: 2, range: "31 – 60 convidados", pct: "15%" },
  { level: 3, range: "61 – 90 convidados", pct: "20%" },
  { level: 4, range: "91 – 120 convidados", pct: "30%" },
  { level: 5, range: "121+ convidados", pct: "50%" },
];

function Team() {
  const { userId } = useSession();
  const { data: profile } = useProfile();

  const { data: referrals } = useQuery({
    queryKey: ["referrals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", userId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const rewarded = (referrals ?? []).filter((r) => r.rewarded).length;
  const earned = (referrals ?? []).reduce((sum, r) => sum + Number(r.reward_amount ?? 0), 0);
  const link =
    typeof window !== "undefined" && profile
      ? `https://app.rentinvestiment.workers.dev/auth?mode=register&ref=${profile.referral_code}`
      : "";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="min-h-screen space-y-5 bg-[#050b09] pb-8">
      <header className="-mx-4 flex items-center gap-4 rounded-b-[2.75rem] border-b border-border/60 bg-[#0b2119] px-5 py-5">
        <button type="button" onClick={() => window.history.back()} className="flex size-12 items-center justify-center rounded-full border border-border/70" aria-label="Voltar"><ArrowLeft className="size-6" /></button>
        <h1 className="flex-1 text-center text-2xl font-black">Análise de Equipe</h1><span className="size-12" />
      </header>
      <section className="mx-4 rounded-[2.5rem] border border-primary/60 bg-[linear-gradient(135deg,#0c512f,#0d3d27)] p-6">
        <div className="grid grid-cols-2 divide-x divide-primary/50">
          <Summary label="TOTAL DE MEMBROS" value={String(referrals.length)} />
          <Summary label="ATIVO (PCE)" value={String(rewarded)} />
        </div>
      </section>
      <div className="mx-4 flex rounded-3xl border border-border/80 bg-[#111b17] p-1.5">
        <button type="button" className="flex-1 rounded-2xl bg-primary px-3 py-4 text-sm font-black text-primary-foreground">VISÃO GERAL</button>
        <button type="button" className="flex-1 rounded-2xl px-3 py-4 text-sm font-black text-muted-foreground" onClick={() => document.getElementById("team-members")?.scrollIntoView({behavior:"smooth"})}>LISTA DE MEMBROS</button>
      </div>
      <div className="mx-4 grid grid-cols-4 gap-2">
        {["NÍVEL A","NÍVEL B","NÍVEL C","GERAL"].map((level,index)=><span key={level} className={`rounded-full border px-2 py-3 text-center text-xs font-black ${index===0?"border-primary text-primary":"border-border text-muted-foreground"}`}>{level}</span>)}
      </div>
      <section className="mx-4 grid grid-cols-2 gap-3">
        <Stat label="DEPÓSITO TOTAL" value={MZN(0)} />
        <Stat label="SAQUE TOTAL" value={MZN(0)} />
        <Stat label="TAREFAS CONCLUÍDAS" value="0" />
        <Stat label="COMISSÃO" value={MZN(earned)} />
      </section>
      <section id="team-members" className="mx-4 overflow-hidden rounded-[2.25rem] border border-border/80 bg-[#111b17]">
        <div className="grid grid-cols-4 bg-[#17231e] px-5 py-5 text-xs font-black text-muted-foreground"><span>MEMBRO</span><span>RECARREGAR</span><span>TAREFAS</span><span>LUCRO</span></div>
        {referrals.length===0 ? <div className="flex min-h-40 items-center justify-center gap-3 text-sm font-bold text-muted-foreground"><UsersRound className="size-6"/>Nenhum membro encontrado</div> : referrals.map(r=><div key={r.id} className="grid grid-cols-4 gap-2 border-t border-border/70 px-5 py-5 text-sm"><span className="truncate font-bold">#{r.referred_id.slice(0,8)}</span><span>—</span><span>—</span><span className="font-bold text-primary">{MZN(r.reward_amount ?? 0)}</span></div>)}
      </section>
    </div>
  );
}

