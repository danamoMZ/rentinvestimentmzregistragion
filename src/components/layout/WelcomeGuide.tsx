import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Layers, CheckSquare, Users, HeartHandshake, Wallet, Send, ChevronDown, ChevronUp } from "lucide-react";
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
              Saque a partir de <strong>125 MZN</strong> (máximo 18.000 MZN) com taxa de 3%, diretamente para a
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
              <a href={toHref(telegram)} target="_blank" rel="noopener noreferrer">
                <Send className="size-4" /> Entrar no grupo do Telegram
              </a>
            </Button>
          )}
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
