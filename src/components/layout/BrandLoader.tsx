import { BRAND_LOGO } from "@/lib/brand";

export function BrandLoader({ label = "A preparar a próxima página" }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <span className="relative flex size-20 items-center justify-center rounded-2xl bg-primary shadow-[var(--shadow-glow)]">
        <span className="absolute inset-0 animate-ping rounded-2xl border border-primary/40" />
        <img src={BRAND_LOGO} alt="" className="relative size-16 rounded-xl object-cover" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
  );
}
