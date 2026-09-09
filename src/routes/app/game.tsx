import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-session";
import { rouletteFeedFn, spinRouletteFn } from "@/lib/app.functions";
import { MZN, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/game")({
  component: GamePage,
  head: () => ({
    meta: [
      { title: "Roleta da Sorte | RENT INVESTIMENT" },
      { name: "description", content: "Gire a Roleta da Sorte da RENT INVESTIMENT por 5 MZN e ganhe prémios de 2 a 300 MZN." },
      { property: "og:title", content: "Roleta da Sorte | RENT INVESTIMENT" },
      { property: "og:description", content: "Gire a Roleta da Sorte por 5 MZN e ganhe prémios instantâneos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SEGMENTS = [2, 5, 10, 20, 50, 100, 150, 30];
const SPIN_COST = 5;
const SEG_ANGLE = 360 / SEGMENTS.length;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(index: number, r = 150) {
  const a0 = index * SEG_ANGLE;
  const a1 = a0 + SEG_ANGLE;
  const p0 = polar(160, 160, r, a0);
  const p1 = polar(160, 160, r, a1);
  return `M160 160 L ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y} Z`;
}

function GamePage() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const spin = useServerFn(spinRouletteFn);
  const feedFn = useServerFn(rouletteFeedFn);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ prize: number; multiplier: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: feed } = useQuery({
    queryKey: ["roulette-feed"],
    refetchInterval: 30000,
    queryFn: () => feedFn({}),
  });

  const balance = Number(profile?.balance ?? 0);

  const handleSpin = async () => {
    if (spinning) return;
    if (balance < SPIN_COST) {
      toast.error(`Saldo insuficiente. Precisa de ${SPIN_COST} MZN para girar.`);
      return;
    }
    setSpinning(true);
    setResult(null);
    try {
      const r = await spin({});
      const target = 360 * 6 - (r.segmentIndex * SEG_ANGLE + SEG_ANGLE / 2);
      const base = Math.ceil(rotation / 360) * 360;
      setRotation(base + target);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setSpinning(false);
        setResult({ prize: r.prize, multiplier: r.multiplier });
        toast.success(`Ganhou ${MZN(r.prize)}! Creditado no seu saldo.`);
        queryClient.invalidateQueries();
      }, 5200);
    } catch (err) {
      setSpinning(false);
      toast.error(err instanceof Error ? err.message : "Não foi possível girar a roleta.");
    }
  };

  const inviteLink =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/auth?mode=register&ref=${profile.referral_code}`
      : "";

  const copyInvite = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast.success("Link de convite copiado! Partilhe e ganhe comissões.");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Roleta da Sorte</h1>
        <p className="text-xs text-muted-foreground">
          Cada giro custa {SPIN_COST} MZN. O prémio é creditado automaticamente no seu saldo.
        </p>
      </div>

      <div className="grid gap-2 grid-cols-2">
        <div className="surface-card bg-[image:var(--gradient-soft)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Saldo disponível</p>
          <p className="text-lg font-extrabold">{MZN(profile?.balance)}</p>
        </div>
        <div className="surface-card px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Último prémio</p>
          <p className="text-lg font-extrabold text-success">{result ? MZN(result.prize) : "—"}</p>
          {result && result.multiplier > 1 && (
            <p className="text-[10px] font-semibold text-warning">Casa 150 MZN com bónus x{result.multiplier}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="surface-card flex flex-col items-center gap-3 p-4">
        <div className="relative">
          {/* ponteiro */}
          <div className="absolute left-1/2 top-[-6px] z-20 -translate-x-1/2">
            <div className="size-0 border-x-[12px] border-t-[22px] border-x-transparent border-t-[color:var(--primary)] drop-shadow" />
          </div>

          <div className="rounded-full border-4 border-primary/40 bg-card p-2 shadow-[0_0_40px_-8px_var(--primary)]">
            <svg
              viewBox="0 0 320 320"
              className="size-[min(230px,68vw)] transition-transform duration-[5000ms] ease-[cubic-bezier(0.15,0.85,0.2,1)]"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {SEGMENTS.map((value, i) => {
                const mid = i * SEG_ANGLE + SEG_ANGLE / 2;
                const label = polar(160, 160, 105, mid);
                return (
                  <g key={value}>
                    <path
                      d={sectorPath(i)}
                      fill={i % 2 === 0 ? "var(--primary)" : "var(--secondary)"}
                      stroke="var(--border)"
                      strokeWidth={1.5}
                    />
                    <text
                      x={label.x}
                      y={label.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${mid} ${label.x} ${label.y})`}
                      className="text-[15px] font-extrabold"
                      fill={i % 2 === 0 ? "var(--primary-foreground)" : "var(--foreground)"}
                    >
                      {value} MZN
                    </text>
                  </g>
                );
              })}
              <circle cx={160} cy={160} r={150} fill="none" stroke="var(--primary)" strokeWidth={4} />
            </svg>
          </div>

          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning}
            aria-label="Girar a roleta"
            className="absolute left-1/2 top-1/2 z-10 flex size-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-primary bg-card text-center font-extrabold uppercase tracking-wide shadow-lg transition active:scale-95 disabled:opacity-70"
          >
            {spinning ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <>
                <Sparkles className="mb-0.5 size-5 text-primary" />
                <span className="text-sm">Girar</span>
                <span className="text-[10px] font-semibold text-muted-foreground">-{SPIN_COST} MZN</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Clique no centro da roleta para girar. Prémios: 2, 5, 10, 20, 30, 50, 100 e 150 MZN.
        </p>
      </div>

      <div className="surface-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="size-4 text-warning" />
          <h2 className="text-sm font-semibold">Ganhadores recentes</h2>
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {(feed ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Ainda não há ganhadores. Seja o primeiro!</p>
          )}
          {(feed ?? []).map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold">ID {w.publicId}</p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(w.createdAt)}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-success">+{MZN(w.prize)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
