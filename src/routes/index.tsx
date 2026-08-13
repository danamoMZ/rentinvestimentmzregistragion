import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, TrendingUp, Users, Wallet, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { MZN } from "@/lib/format";
import logoAsset from "@/assets/ri-logo.jpg.asset.json";
const logo = logoAsset.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RENT INVESTIMENT — Planos de rendimento diário" },
      {
        name: "description",
        content:
          "Ative um plano RENT, complete tarefas diárias e acompanhe o seu saldo em MZN. Registo com bónus de boas-vindas.",
      },
      { property: "og:title", content: "RENT INVESTIMENT — Planos de rendimento diário" },
      {
        property: "og:description",
        content: "Ative um plano RENT, complete tarefas diárias e acompanhe o seu saldo em MZN.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: plans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("id");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-card/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo size={36} />
          <div className="flex items-center gap-2">
            <Link to="/auth" search={{ mode: "login" }}>
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
            <Link to="/auth" search={{ mode: "register" }}>
              <Button size="sm">Criar conta</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="size-3.5" /> Plataforma oficial RENT
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Rendimento diário com os planos{" "}
              <span className="bg-[image:var(--gradient-brand)] bg-clip-text text-transparent">RENT 1 a RENT 9</span>
            </h1>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Ative o seu plano, complete as tarefas diárias e acompanhe cada movimento do seu saldo em meticais.
              Registo gratuito com bónus de boas-vindas de 25 MZN.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "register" }}>
                <Button size="lg" className="shadow-[var(--shadow-float)]">
                  Começar agora
                </Button>
              </Link>
              <Link to="/auth" search={{ mode: "login" }}>
                <Button size="lg" variant="outline">
                  Já tenho conta
                </Button>
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {[
                { icon: TrendingUp, label: "Tarefas diárias" },
                { icon: Users, label: "5 níveis de equipa" },
                { icon: Wallet, label: "Saques rápidos" },
              ].map((item) => (
                <div key={item.label} className="surface-card p-3">
                  <item.icon className="mx-auto size-5 text-primary" />
                  <p className="mt-1.5 text-xs font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-[2rem] bg-[image:var(--gradient-brand)] opacity-20 blur-2xl" />
            <img
              src={logo}
              alt="Logótipo RENT INVESTIMENT"
              className="relative w-full rounded-[2rem] object-cover shadow-[var(--shadow-float)]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-2xl font-bold tracking-tight">Planos disponíveis</h2>
        <p className="mt-1 text-sm text-muted-foreground">Todos os planos têm duração de 90 dias.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <article key={plan.id} className="surface-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border bg-[image:var(--gradient-soft)] p-4">
                <img src={logo} alt="" className="size-11 rounded-xl object-cover ring-1 ring-border" />
                <div>
                  <h3 className="font-bold">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.duration_days} dias</p>
                </div>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <Row label="Preço" value={MZN(plan.price)} />
                <Row label="Renda diária" value={MZN(plan.daily_income)} />
                <Row label="Tarefas por dia" value={String(plan.daily_task_count)} />
                <Row label="Valor por tarefa" value={MZN(plan.task_value)} />
                <Row label="Total do ciclo" value={MZN(plan.total_task_income)} />
                <Link to="/auth" search={{ mode: "register" }} className="block pt-2">
                  <Button className="w-full">Ativar plano</Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center">
          <Logo size={32} />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-success" /> Feito com excelência em Maputo · Valores em MZN
          </p>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
