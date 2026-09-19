import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Gift,
  Layers,
  CheckSquare,
  Users,
  HeartHandshake,
  Wallet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { MZN, toHref } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "ri-welcome-shown";

export function WelcomeGuide() {
  const { userId } = useSession();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const shown = window.sessionStorage.getItem(STORAGE_KEY);
    if (shown !== userId) {
      setOpen(true);
      window.sessionStorage.setItem(STORAGE_KEY, userId);
    }
  }, [userId]);

  const { data: settings } = useQuery({
    queryKey: ["settings-public"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, string>;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("active", true).order("sort_order").order("id");
      return data ?? [];
    },
  });

  const telegram = (settings?.["support_telegram_group"] ?? "").trim();
  const whatsapp = (
   settings?.["support_whatsapp"] ??
   settings?.["support_whatsapp_group"] ??
   settings?.["whatsapp"] ??
   ""
  ).trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle className="text-xl">Bem-vindo à RENT INVESTIMENT 👋</DialogTitle>
          <DialogDescription>
            Veja como a plataforma funciona e como pode maximizar os seus ganhos.
          </DialogDescription>
        </DialogHeader>

        <div className={`space-y-4 overflow-y-auto px-6 py-2 text-sm ${expanded ? "" : "max-h-[38vh]"}`}>
          <Section icon={Gift} title="Bónus de boas-vindas">
            <p>
              Ao criar a sua conta recebe automaticamente <strong>50 MZN</strong> de bónus de registo, já
              disponíveis no seu saldo.
            </p>
          </Section>

          <Section icon={Layers} title="Ativação do primeiro plano">
            <p>
              Ao pagar o seu primeiro plano e após a aprovação do administrador, o plano é ativado e recebe um
              bónus adicional de <strong>100 MZN</strong>, creditado automaticamente na sua conta.
            </p>
          </Section>

          <Section icon={CheckSquare} title="Tarefas diárias">
            <p className="mb-2">
              Cada plano dá direito a tarefas diárias. Ao concluir uma tarefa o valor é creditado de imediato
              no seu saldo. Ganhos por plano:
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Plano</th>
                    <th className="px-2 py-1.5 text-right font-medium">Tarefas/dia</th>
                    <th className="px-2 py-1.5 text-right font-medium">Por tarefa</th>
                    <th className="px-2 py-1.5 text-right font-medium">Por dia</th>
                  </tr>
                </thead>
                <tbody>
                  {(plans ?? []).map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-2 py-1.5 font-semibold">{p.name}</td>
                      <td className="px-2 py-1.5 text-right">{p.daily_task_count}</td>
                      <td className="px-2 py-1.5 text-right">{MZN(p.task_value)}</td>
                      <td className="px-2 py-1.5 text-right text-success">{MZN(p.daily_income)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section icon={Users} title="Programa de afiliados">
            <p className="mb-2">
              Partilhe o seu código de convite. Sempre que um convidado ativa o primeiro plano, recebe uma
              comissão sobre o valor do plano, de acordo com o seu nível:
            </p>
            <ul className="grid grid-cols-2 gap-1 text-xs">
              <li>• Nível 1 (0–30 ativos): <strong>10%</strong></li>
              <li>• Nível 2 (31–60 ativos): <strong>15%</strong></li>
              <li>• Nível 3 (61–90 ativos): <strong>20%</strong></li>
              <li>• Nível 4 (91–120 ativos): <strong>30%</strong></li>
              <li>• Nível 5 (121+ ativos): <strong>50%</strong></li>
            </ul>
          </Section>

          <Section icon={HeartHandshake} title="Doações">
            <p>
              Pode fazer doações a partir de <strong>100 MZN</strong>, sem limite de quantidade, desde que
              tenha saldo. Cada doação devolve <strong>115%</strong> do valor (retorno de 15%) ao fim de{" "}
              <strong>30 dias</strong>, creditado automaticamente no seu saldo.
            </p>
          </Section>

          <Section icon={Wallet} title="Levantamentos">
            <p>
              Saque a partir de <strong>125 MZN</strong> (máximo 18.000 MZN) com taxa de 10%, diretamente para a
              sua carteira. É necessário ter um plano ativo.
            </p>
          </Section>
        </div>

        <div className="px-6">
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1 text-xs"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                Mostrar menos <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                Mostrar mais <ChevronDown className="size-4" />
              </>
            )}
          </Button>
        </div>

        <DialogFooter className="flex-col gap-2 px-6 pb-6 sm:flex-col">
            {telegram && (
  <Button asChild className="w-full gap-2">
    <a
      href={toHref(telegram)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5 fill-current"
        aria-hidden="true"
      >
        <path d="M21.4 3.6 18.2 20c-.24 1.16-.87 1.45-1.77.9l-4.9-3.61-2.36 2.27c-.26.26-.48.48-.98.48l.35-4.99 9.08-8.2c.4-.35-.09-.55-.62-.2L5.77 13.7.94 12.19c-1.05-.33-1.07-1.05.22-1.56L20.04 3.1c.88-.32 1.65.2 1.36.5Z" />
      </svg>
      Entrar no grupo do Telegram
    </a>
  </Button>
)}

{whatsapp && (
  <Button
    asChild
    variant="outline"
    className="w-full gap-2"
  >
    <a
      href={toHref(whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5 fill-current"
        aria-hidden="true"
      >
        <path d="M12 2a9.9 9.9 0 0 0-8.53 14.92L2 22l5.25-1.38A9.9 9.9 0 1 0 12 2Zm0 18.18a8.25 8.25 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31A8.25 8.25 0 1 1 12 20.18Zm4.53-6.19c-.25-.13-1.48-.73-1.71-.81-.23-.09-.4-.13-.57.13-.17.25-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.13-1.05-.39-2-1.24-.74-.66-1.24-1.48-1.39-1.73-.15-.25-.02-.39.11-.52.12-.12.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.21-.5-.42-.43-.57-.44h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.02 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.48-.61 1.69-1.2.21-.59.21-1.1.15-1.2-.06-.1-.23-.16-.48-.29Z" />
      </svg>
      Entrar no grupo do WhatsApp
    </a>
  </Button>
)}

<Button
  variant="outline"
  className="w-full"
  onClick={() => setOpen(false)}
>
  Entendi, começar
</Button>
          <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
            Entendi, começar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </div>
  );
}
