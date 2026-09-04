import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, TrendingUp, Users, Wallet, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

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
      { property: "og:url", content: "https://rentinvestimentmzregistragion.lovable.app" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "RENT INVESTIMENT — Planos de rendimento diário" },
      { name: "twitter:description", content: "Ative um plano RENT, complete tarefas diárias e acompanhe o seu saldo em MZN." },
    ],
    links: [
      { rel: "canonical", href: "https://rentinvestimentmzregistragion.lovable.app" },
    ],
  }),
  component: Landing,
});

function Landing() {
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
              <span className="bg-[image:var(--gradient-brand)] bg-clip-text text-transparent">RENT 1 a RENT 11</span>
            </h1>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Ative o seu plano, complete as tarefas diárias e acompanhe cada movimento do seu saldo em meticais.
              Registo gratuito com bónus de boas-vindas de 50 MZN.
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
          <div className="hidden md:block">
            <div className="surface-card space-y-4 p-6">
              <h2 className="text-lg font-bold">Como funciona</h2>
              {[
                { step: "1", title: "Crie a sua conta", text: "Registo gratuito com bónus de boas-vindas de 50 MZN." },
                { step: "2", title: "Ative um plano", text: "Escolha um plano RENT e receba 100 MZN de bónus no primeiro plano." },
                { step: "3", title: "Complete tarefas", text: "Realize as tarefas diárias e veja o saldo crescer todos os dias." },
                { step: "4", title: "Levante os ganhos", text: "Saques a partir de 125 MZN diretamente para a sua carteira." },
              ].map((s) => (
                <div key={s.step} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center">
          <Logo size={32} />
        </div>
      </footer>
    </div>
  );
}
