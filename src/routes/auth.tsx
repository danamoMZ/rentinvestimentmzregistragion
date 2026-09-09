import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { requestPasswordResetFn, resetPasswordFn } from "@/lib/app.functions";

type Search = { mode?: "login" | "register" | "forgot-password" | "reset-password" | undefined; ref?: string | undefined };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: (search["mode"] as any) || "login",
    ref: typeof search["ref"] === "string" ? search["ref"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar ou registar — RENT INVESTIMENT" },
      { name: "description", content: "Aceda à sua conta RENT INVESTIMENT ou crie uma nova em segundos." },
      { property: "og:title", content: "Entrar ou registar — RENT INVESTIMENT" },
      { property: "og:description", content: "Aceda à sua conta RENT INVESTIMENT ou crie uma nova em segundos." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode, ref } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);
  
  const requestReset = useServerFn(requestPasswordResetFn);
  const resetPass = useServerFn(resetPasswordFn);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    wallet_number: "",
    referral_code: ref ?? "",
    password: "",
    confirm_password: "",
    identifier: "", // for forgot password
  });

  const digits = (v: string) => v.replace(/\D/g, "");
  const normalizePhone = (v: string) => {
    let d = digits(v);
    if (d.startsWith("258")) d = d.slice(3);
    if (d.startsWith("0")) d = d.slice(1);
    return d;
  };
  const phoneEmail = (v: string) => `258${normalizePhone(v)}@rentinvestiment.mz`;

  useEffect(() => {
    if (!loading && session && mode !== "reset-password") {
      navigate({ to: "/app/dashboard", replace: true });
    }
  }, [loading, session, navigate, mode]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        const nome = form.full_name.trim();
        const tel = normalizePhone(form.phone);
        if (!nome) throw new Error("Informe o seu nome de utilizador.");
        if (tel.length !== 9) throw new Error("Informe um número válido de 9 dígitos (ex: 841234567).");
        if (form.password.length < 6) throw new Error("A palavra-passe deve ter pelo menos 6 caracteres.");
        const login = phoneEmail(tel);
        const { error } = await supabase.auth.signUp({
          email: login,
          password: form.password,
          options: {
            data: {
              full_name: nome,
              phone: `+258${tel}`,
              wallet_number: tel,
              referral_code: form.referral_code.trim().toUpperCase(),
            },
          },
        });
        if (error) {
          if (/already|registered|exists/i.test(error.message))
            throw new Error("Este número já está registado. Faça login.");
          throw error;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: login,
          password: form.password,
        });
        if (signInError) throw new Error(signInError.message);
        toast.success("Conta criada com sucesso! Bónus de 50 MZN aplicado.");
        navigate({ to: "/app/dashboard", replace: true });
      } else if (mode === "forgot-password") {
        if (!form.identifier.trim()) throw new Error("Informe o seu e-mail ou número de telefone.");
        await requestReset({ data: { identifier: form.identifier } });
        toast.success("Código de recuperação enviado! Verifique o seu e-mail ou SMS.");
      } else if (mode === "reset-password") {
        if (form.password !== form.confirm_password) throw new Error("As palavras-passe não coincidem.");
        if (form.password.length < 6) throw new Error("A nova palavra-passe deve ter pelo menos 6 caracteres.");
        
        const { error } = await supabase.auth.updateUser({ password: form.password });
        if (error) throw error;
        
        toast.success("Palavra-passe alterada com sucesso!");
        navigate({ to: "/app/dashboard", replace: true });
      } else {
        const raw = form.email.trim();
        if (!raw) throw new Error("Informe o seu número de telefone.");
        const login = raw.includes("@") ? raw : phoneEmail(raw);
        const { error } = await supabase.auth.signInWithPassword({
          email: login,
          password: form.password,
        });

        if (error) throw new Error("Número ou palavra-passe incorretos.");

        toast.success("Bem-vindo de volta!");
        navigate({ to: "/app/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocorreu um erro.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-soft)] px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex justify-center">
          <Logo size={44} />
        </Link>
        <div className="surface-card p-6">
          <h1 className="text-xl font-bold tracking-tight">
            {mode === "register" ? "Criar conta" : 
             mode === "forgot-password" ? "Recuperar conta" : 
             mode === "reset-password" ? "Nova palavra-passe" : 
             "Entrar na conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "register" ? "Receba 50 MZN de bónus de registo." : 
             mode === "forgot-password" ? "Enviaremos um código para o seu e-mail ou telefone." :
             mode === "reset-password" ? "Defina a sua nova palavra-passe de acesso." :
             "Aceda ao seu painel RENT INVESTIMENT."}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {mode === "register" && (
              <>
                <Field id="full_name" label="Nome completo" value={form.full_name} onChange={set("full_name")} required />
                <div className="grid grid-cols-2 gap-3">
                  <Field id="phone" label="Telefone (+258)" value={form.phone} onChange={set("phone")} required placeholder="861585911" />
                  <Field
                    id="wallet_number"
                    label="Número da carteira"
                    value={form.wallet_number}
                    onChange={set("wallet_number")}
                  />
                </div>
                <Field id="email" label="E-mail" type="email" value={form.email} onChange={set("email")} required />
                <Field
                  id="password"
                  label="Palavra-passe"
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  required
                />
                <Field
                  id="referral_code"
                  label="Código de convite (opcional)"
                  value={form.referral_code}
                  onChange={set("referral_code")}
                />
              </>
            )}

            {mode === "login" && (
              <>
                <Field id="email" label="E-mail" type="email" value={form.email} onChange={set("email")} required />
                <div className="space-y-1">
                  <Field
                    id="password"
                    label="Palavra-passe"
                    type="password"
                    value={form.password}
                    onChange={set("password")}
                    required
                  />
                  <div className="flex justify-end">
                    <Link 
                      to="/auth" 
                      search={{ mode: "forgot-password" }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                </div>
              </>
            )}

            {mode === "forgot-password" && (
              <>
                <Field 
                  id="identifier" 
                  label="E-mail ou Telefone (+258)" 
                  value={form.identifier} 
                  onChange={set("identifier")} 
                  required 
                  placeholder="ex: +258 861585911 ou saloobeet@gmail.com"
                />
                <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-xs text-primary/80">
                  <KeyRound className="size-4 shrink-0" />
                  <span>Enviaremos um código oficial da equipa RENT INVESTIMENT.</span>
                </div>
              </>
            )}

            {mode === "reset-password" && (
              <>
                <Field
                  id="password"
                  label="Nova palavra-passe"
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  required
                />
                <Field
                  id="confirm_password"
                  label="Confirmar nova palavra-passe"
                  type="password"
                  value={form.confirm_password}
                  onChange={set("confirm_password")}
                  required
                />
              </>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "register" ? "Criar conta" : 
               mode === "forgot-password" ? "Enviar código" :
               mode === "reset-password" ? "Confirmar nova senha" :
               "Entrar"}
            </Button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            {(mode === "forgot-password" || mode === "reset-password") ? (
              <Link
                to="/auth"
                search={{ mode: "login" }}
                className="flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="size-3.5" /> Voltar ao login
              </Link>
            ) : (
              <p>
                {mode === "register" ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
                <Link
                  to="/auth"
                  search={{ mode: mode === "register" ? "login" : "register", ref }}
                  className="font-semibold text-primary hover:underline"
                >
                  {mode === "register" ? "Entrar" : "Criar agora"}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}
