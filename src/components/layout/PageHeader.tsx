import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  const router = useRouter();
  return (
    <div className="flex items-start gap-3">
      <Button variant="ghost" size="icon" onClick={() => router.history.back()} aria-label="Voltar" title="Voltar" className="mt-0.5 shrink-0 rounded-full border border-border">
        <ArrowLeft />
      </Button>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-normal">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
