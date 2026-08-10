import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { mode?: "login" | "register"; ref?: string };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search["mode"] === "register" ? "register" : "login",
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
  const isRegister = mode === "register";

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    wallet_number: "",
    province: "",
    district: "",
    referral_code: ref ?? "",
    password: "",
  });

  useEffect(() => {
    if (!loading && session) navigate({ to: "/app/dashboard", replace: true });
  }, [loading, session, navigate]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isRegister) {
        if (form.password.length < 6) throw new Error("A palavra-passe deve ter pelo menos 6 caracteres.");
        if (!form.full_name.trim()) throw new Error("Informe o seu nome completo.");
        const { error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.full_name.trim(),
              phone: form.phone.trim(),
              wallet_number: form.wallet_number.trim() || form.phone.trim(),
              province: form.province.trim(),
              district: form.district.trim(),
              referral_code: form.referral_code.trim().toUpperCase(),
            },
          },
        });
        if (error) throw error;
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (signInError) {
          toast.success("Conta criada! Confirme o seu e-mail para entrar.");
          navigate({ to: "/auth", search: { mode: "login" } });
          return;
        }
        toast.success("Conta criada com sucesso! Bónus de 25 MZN aplicado.");
        navigate({ to: "/app/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) throw new Error("E-mail ou palavra-passe incorretos.");
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
          <h1 className="text-xl font-bold tracking-tight">{isRegister ? "Criar conta" : "Entrar na conta"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRegister ? "Receba 25 MZN de bónus de registo." : "Aceda ao seu painel RENT INVESTIMENT."}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {isRegister && (
              <>
                <Field id="full_name" label="Nome completo" value={form.full_name} onChange={set("full_name")} required />
                <div className="grid grid-cols-2 gap-3">
                  <Field id="phone" label="Telefone" value={form.phone} onChange={set("phone")} required />
                  <Field
                    id="wallet_number"
                    label="Número da carteira"
                    value={form.wallet_number}
                    onChange={set("wallet_number")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="province" label="Província" value={form.province} onChange={set("province")} />
                  <Field id="district" label="Distrito" value={form.district} onChange={set("district")} />
                </div>
              </>
            )}
            <Field id="email" label="E-mail" type="email" value={form.email} onChange={set("email")} required />
            <Field
              id="password"
              label="Palavra-passe"
              type="password"
              value={form.password}
              onChange={set("password")}
              required
            />
            {isRegister && (
              <Field
                id="referral_code"
                label="Código de convite (opcional)"
                value={form.referral_code}
                onChange={set("referral_code")}
              />
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isRegister ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isRegister ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
            <Link
              to="/auth"
              search={{ mode: isRegister ? "login" : "register", ref }}
              className="font-semibold text-primary hover:underline"
            >
              {isRegister ? "Entrar" : "Criar agora"}
            </Link>
          </p>
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
