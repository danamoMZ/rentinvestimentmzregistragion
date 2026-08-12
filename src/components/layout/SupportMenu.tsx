import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_FIELDS, toHref } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SupportMenu() {
  const { data: settings } = useQuery({
    queryKey: ["settings-public"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });

  const available = SUPPORT_FIELDS.filter((f) => (settings?.[f.key] ?? "").trim().length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Phone className="size-4" /> <span className="hidden sm:inline">Suporte</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Suporte</DropdownMenuLabel>
        {available.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum canal de suporte disponível.</div>
        ) : (
          available.map((f) => (
            <DropdownMenuItem key={f.key} asChild>
              <a href={toHref(settings?.[f.key] ?? "")} target="_blank" rel="noopener noreferrer">
                {f.label}
              </a>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
