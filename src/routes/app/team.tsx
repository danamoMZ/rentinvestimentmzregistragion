import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { MZN, formatDate } from "@/lib/format";
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
      ? `${window.location.origin}/auth?mode=register&ref=${profile.referral_code}`
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">A minha equipa</h1>
        <p className="text-sm text-muted-foreground">Convide amigos e ganhe comissões por cada plano ativado.</p>
      </div>

      <div className="surface-card space-y-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Código de convite</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-2xl font-extrabold tracking-widest">{profile?.referral_code ?? "—"}</p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => copy(profile?.referral_code ?? "", "Código")}
              aria-label="Copiar código"
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            className="w-full truncate rounded-lg border border-input bg-secondary px-3 py-2 text-xs"
          />
          <Button onClick={() => copy(link, "Link")}>Copiar</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Convidados" value={String((referrals ?? []).length)} />
        <Stat label="Ativos" value={String(rewarded)} />
        <Stat label="Ganhos" value={MZN(earned)} />
      </div>

      <div className="surface-card p-4">
        <h2 className="text-sm font-semibold">Níveis de comissão</h2>
        <div className="mt-3 divide-y divide-border">
          {LEVELS.map((l) => (
            <div key={l.level} className="flex items-center justify-between py-2.5 text-sm">
              <span>
                <strong>Nível {l.level}</strong> · {l.range}
              </span>
              <span className="font-bold text-primary">{l.pct}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card p-4">
        <h2 className="text-sm font-semibold">Convidados</h2>
        {(referrals ?? []).length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Ainda não convidou ninguém.</p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {(referrals ?? []).map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium">Convidado #{r.referred_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                </div>
                <span className={r.rewarded ? "font-semibold text-success" : "text-muted-foreground"}>
                  {r.rewarded ? `+${MZN(r.reward_amount)}` : "Sem plano ativo"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
