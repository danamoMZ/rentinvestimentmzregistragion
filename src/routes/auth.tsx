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
import {
  requestPasswordResetFn,
  resetPasswordFn,
} from "@/lib/app.functions";

type Search = {
  mode?:
    | "login"
    | "register"
    | "forgot-password"
    | "reset-password"
    | undefined;
  ref?: string | undefined;
};

export const Route = createFileRoute("/auth")({
  ssr: false,

  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: (search["mode"] as any) || "login",
    ref:
      typeof search["ref"] === "string"
        ? search["ref"]
        : undefined,
  }),

  head: () => ({
    meta: [
      {
        title: "Entrar ou registar — BLUE ORIGIN",
      },
      {
        name: "description",
        content:
          "Aceda à sua conta BLUE ORIGIN ou crie uma nova em segundos.",
      },
      {
        property: "og:title",
        content: "Entrar ou registar — BLUE ORIGIN",
      },
      {
        property: "og:description",
        content:
          "Aceda à sua conta BLUE ORIGIN ou crie uma nova em segundos.",
      },
    ],
  }),

  component: AuthPage,
});

function AuthPage() {
  const { mode, ref } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useSession();

  const [busy, setBusy] = useState(false);

  const requestReset = useServerFn(
    requestPasswordResetFn,
  );

  const resetPass = useServerFn(
    resetPasswordFn,
  );

  const [form, setForm] = useState({
    email: "",
    phone: "",
    referral_code: ref ?? "",
    password: "",
    confirm_password: "",
    identifier: "",
  });

  const digits = (v: string) =>
    v.replace(/\D/g, "");

  const normalizePhone = (v: string) => {
    let d = digits(v);

    if (d.startsWith("258")) {
      d = d.slice(3);
    }

    if (d.startsWith("0")) {
      d = d.slice(1);
    }

    return d.slice(0, 9);
  };

  const phoneEmail = (v: string) =>
    `258${normalizePhone(v)}@blueorigin.mz`;

  useEffect(() => {
    if (
      !loading &&
      session &&
      mode !== "reset-password"
    ) {
      navigate({
        to: "/app/dashboard",
        replace: true,
      });
    }
  }, [
    loading,
    session,
    navigate,
    mode,
  ]);

  const set =
    (key: keyof typeof form) =>
    (
      e: React.ChangeEvent<HTMLInputElement>,
    ) =>
      setForm((prev) => ({
        ...prev,
        [key]: e.target.value,
      }));

  const handleSubmit = async (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    setBusy(true);

    try {
      /*
       * ============================
       * REGISTAR
       * ============================
       */

      if (mode === "register") {
        const tel =
          normalizePhone(form.phone);

        if (tel.length !== 9) {
          throw new Error(
            "Informe um número válido de 9 dígitos (ex: 841234567).",
          );
        }

        if (form.password.length < 6) {
          throw new Error(
            "A palavra-passe deve ter pelo menos 6 caracteres.",
          );
        }

        const login =
          phoneEmail(tel);

        const { error } =
          await supabase.auth.signUp({
            email: login,
            password: form.password,

            options: {
              data: {
                full_name: "RECRUTA",
                phone: `+258${tel}`,
                wallet_number: tel,
                referral_code:
                  form.referral_code
                    .trim()
                    .toUpperCase(),
              },
            },
          });

        if (error) {
          if (
            /already|registered|exists/i.test(
              error.message,
            )
          ) {
            throw new Error(
              "Este número já está registado. Faça login.",
            );
          }

          throw error;
        }

        const {
          error: signInError,
        } =
          await supabase.auth.signInWithPassword(
            {
              email: login,
              password: form.password,
            },
          );

        if (signInError) {
          throw new Error(
            signInError.message,
          );
        }

        toast.success(
          "Conta criada com sucesso! Recebeu 200 MZN de crédito exclusivo para VIPs.",
        );

        navigate({
          to: "/app/dashboard",
          replace: true,
        });

        return;
      }

      /*
       * ============================
       * RECUPERAR CONTA
       * ============================
       */

      if (
        mode === "forgot-password"
      ) {
        if (!form.identifier.trim()) {
          throw new Error(
            "Informe o seu e-mail ou número de telefone.",
          );
        }

        await requestReset({
          data: {
            identifier:
              form.identifier,
          },
        });

        toast.success(
          "Código de recuperação enviado! Verifique o seu e-mail ou SMS.",
        );

        return;
      }

      /*
       * ============================
       * NOVA PALAVRA-PASSE
       * ============================
       */

      if (
        mode === "reset-password"
      ) {
        if (
          form.password !==
          form.confirm_password
        ) {
          throw new Error(
            "As palavras-passe não coincidem.",
          );
        }

        if (form.password.length < 6) {
          throw new Error(
            "A nova palavra-passe deve ter pelo menos 6 caracteres.",
          );
        }

        const { error } =
          await supabase.auth.updateUser({
            password:
              form.password,
          });

        if (error) {
          throw error;
        }

        toast.success(
          "Palavra-passe alterada com sucesso!",
        );

        navigate({
          to: "/app/dashboard",
          replace: true,
        });

        return;
      }

      /*
       * ============================
       * LOGIN
       * ============================
       *
       * Aceita:
       *
       * 1. Número moçambicano
       *    821234567
       *
       * 2. Número com +258
       *    +258 821234567
       *
       * 3. E-mail de usuário antigo
       *    usuario@gmail.com
       *
       * O e-mail antigo é enviado
       * diretamente para o Supabase.
       */

      const raw =
        form.email.trim();

      if (!raw) {
        throw new Error(
          "Informe o seu número de telefone.",
        );
      }

      const login = phoneEmail(raw);

      const { error } =
        await supabase.auth.signInWithPassword(
          {
            email: login,
            password: form.password,
          },
        );

      if (error) {
        throw new Error(
          "Número, e-mail ou palavra-passe incorretos.",
        );
      }

      toast.success(
        "Bem-vindo de volta!",
      );

      navigate({
        to: "/app/dashboard",
        replace: true,
      });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-soft)] px-4 py-10">
      <div className="w-full max-w-md">

        {/* LOGO */}

        <Link
          to="/"
          className="mb-6 flex justify-center"
        >
          <Logo size={44} />
        </Link>

        <div className="surface-card p-6">

          {/* ==========================
              ENTRAR / REGISTAR
              ========================== */}

          <div className="mb-6 grid grid-cols-2 gap-2">

            <Link
              to="/auth"
              search={{
                mode: "login",
                ref,
              }}
              className={`flex h-14 items-center justify-center rounded-2xl border text-base font-semibold transition ${
                mode === "login"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-transparent text-muted-foreground hover:bg-secondary"
              }`}
            >
              Entrar
            </Link>

            <Link
              to="/auth"
              search={{
                mode: "register",
                ref,
              }}
              className={`flex h-14 items-center justify-center rounded-2xl border text-base font-semibold transition ${
                mode === "register"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-transparent text-muted-foreground hover:bg-secondary"
              }`}
            >
              Registar
            </Link>

          </div>

          {/* ==========================
              TÍTULO
              ========================== */}

          <h1 className="text-xl font-bold tracking-tight">
            {mode === "register"
              ? "Criar conta"
              : mode ===
                  "forgot-password"
                ? "Recuperar conta"
                : mode ===
                    "reset-password"
                  ? "Nova palavra-passe"
                  : "Entrar na conta"}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "register"
              ? "Crie a sua conta BLUE ORIGIN e entre como RECRUTA."
              : mode ===
                  "forgot-password"
                ? "Enviaremos um código para o seu e-mail ou telefone."
                : mode ===
                    "reset-password"
                  ? "Defina a sua nova palavra-passe de acesso."
                  : "Aceda ao seu painel BLUE ORIGIN."}
          </p>

          {/* ==========================
              FORMULÁRIO
              ========================== */}

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
          >

            {/* ==========================
                REGISTAR
                ========================== */}

            {mode === "register" && (
              <>

                {/* NÚMERO DE TELEFONE */}

                <PhoneField
                  value={form.phone}
                  onChange={(value) =>
                    setForm(
                      (prev) => ({
                        ...prev,
                        phone:
                          normalizePhone(
                            value,
                          ),
                      }),
                    )
                  }
                />

                {/* PALAVRA-PASSE */}

                <Field
                  id="password"
                  label="Palavra-passe"
                  type="password"
                  value={
                    form.password
                  }
                  onChange={set(
                    "password",
                  )}
                  required
                  placeholder="••••••••"
                />

                {/* CÓDIGO DE CONVITE */}

                <Field
                  id="referral_code"
                  label="Código de convite"
                  value={
                    form.referral_code
                  }
                  onChange={set(
                    "referral_code",
                  )}
                  placeholder="Opcional"
                />

              </>
            )}

            {/* ==========================
                LOGIN
                ========================== */}

            {mode === "login" && (
              <>
                <PhoneField
                  value={form.email}
                  allowEmail
                  onChange={(value) =>
                    setForm(
                      (prev) => ({
                        ...prev,
                        email: value,
                      }),
                    )
                  }
                />

                <div className="space-y-1.5">

                  <Field
                    id="login-password"
                    label="Palavra-passe"
                    type="password"
                    value={
                      form.password
                    }
                    onChange={set(
                      "password",
                    )}
                    required
                    placeholder="••••••••"
                  />

                  <div className="flex justify-end pt-1">

                    <Link
                      to="/auth"
                      search={{
                        mode: "forgot-password",
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Esqueceu a senha?
                    </Link>

                  </div>

                </div>
              </>
            )}

            {/* ==========================
                RECUPERAR CONTA
                ========================== */}

            {mode ===
              "forgot-password" && (
              <>
                <Field
                  id="identifier"
                  label="Número de telefone (+258)"
                  value={
                    form.identifier
                  }
                  onChange={set(
                    "identifier",
                  )}
                  required
                  placeholder="ex: +258 841234567"
                />

                <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-xs text-primary/80">

                  <KeyRound className="size-4 shrink-0" />

                  <span>
                    Enviaremos um código oficial da equipa BLUE ORIGIN.
                  </span>

                </div>
              </>
            )}

            {/* ==========================
                RESET DA PALAVRA-PASSE
                ========================== */}

            {mode ===
              "reset-password" && (
              <>
                <Field
                  id="new-password"
                  label="Nova palavra-passe"
                  type="password"
                  value={
                    form.password
                  }
                  onChange={set(
                    "password",
                  )}
                  required
                  placeholder="••••••••"
                />

                <Field
                  id="confirm_password"
                  label="Confirmar nova palavra-passe"
                  type="password"
                  value={
                    form.confirm_password
                  }
                  onChange={set(
                    "confirm_password",
                  )}
                  required
                  placeholder="••••••••"
                />
              </>
            )}

            {/* ==========================
                BOTÃO
                ========================== */}

            <Button
              type="submit"
              className="h-14 w-full rounded-2xl text-base font-bold uppercase"
              disabled={busy}
            >
              {busy && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}

              {mode === "register"
                ? "Criar Conta"
                : mode ===
                    "forgot-password"
                  ? "Enviar código"
                  : mode ===
                      "reset-password"
                    ? "Confirmar nova senha"
                    : "Entrar"}
            </Button>

          </form>

          {/* ==========================
              LINKS
              ========================== */}

          <div className="mt-5 flex flex-col items-center gap-3 text-sm text-muted-foreground">

            {(
              mode ===
                "forgot-password" ||
              mode ===
                "reset-password"
            ) ? (
              <Link
                to="/auth"
                search={{
                  mode: "login",
                }}
                className="flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="size-3.5" />

                Voltar ao login
              </Link>
            ) : (
              <p>
                {mode === "register"
                  ? "Já tem conta?"
                  : "Ainda não tem conta?"}{" "}

                <Link
                  to="/auth"
                  search={{
                    mode:
                      mode ===
                      "register"
                        ? "login"
                        : "register",
                    ref,
                  }}
                  className="font-semibold text-primary hover:underline"
                >
                  {mode === "register"
                    ? "Entrar"
                    : "Criar agora"}
                </Link>
              </p>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}

/*
 * ==================================
 * CAMPO DE TELEFONE
 * ==================================
 *
 * No REGISTO:
 * somente número de telefone.
 *
 * No LOGIN:
 * aceita telefone OU e-mail antigo.
 */

function PhoneField({
  value,
  onChange,
  allowEmail = false,
}: {
  value: string;
  onChange: (value: string) => void;
  allowEmail?: boolean;
}) {
  return (
    <div className="space-y-1.5">

      <Label htmlFor="phone">
        {allowEmail
          ? "Número de telefone ou e-mail"
          : "Número de telefone"}
      </Label>

      <div className="flex h-14 overflow-hidden rounded-2xl border border-input bg-background">

        {/* ==========================
            BANDEIRA DE MOÇAMBIQUE
            ========================== */}

        <div className="flex shrink-0 items-center gap-2 border-r border-input px-4 text-sm font-semibold">

          <span
            className="text-xl leading-none"
            aria-hidden="true"
          >
            🇲🇿
          </span>

          <span>
            +258
          </span>

        </div>

        {/* ==========================
            CAMPO
            ========================== */}

        <Input
          id="phone"
          type={
            allowEmail
              ? "text"
              : "tel"
          }
          inputMode={
            allowEmail
              ? "text"
              : "numeric"
          }
          autoComplete={
            allowEmail
              ? "username"
              : "tel-national"
          }
          value={value}
          onChange={(event) => {
          if (allowEmail) {
            onChange(event.target.value);
            return;
          }

          let value = event.target.value.replace(/\D/g, "");

          if (value.startsWith("258")) {
           value = value.slice(3);
          }

          if (value.startsWith("0")) {
           value = value.slice(1);
          }

          value = value.slice(0, 9);

          onChange(value);
        }}
          required
          maxLength={
            allowEmail
              ? undefined
              : 9
          }
          placeholder={
            allowEmail
              ? "821234567 ou seu@email.com"
              : "821234567"
          }
          className="h-full rounded-none border-0 bg-transparent px-4 text-base shadow-none focus-visible:ring-0"
        />

      </div>

      <p className="text-xs text-muted-foreground">
        {allowEmail
          ? "Use o seu número de telefone ou o e-mail da conta antiga."
          : "Introduza os 9 dígitos do seu número."}
      </p>

    </div>
  );
}

/*
 * ==================================
 * CAMPO NORMAL
 * ==================================
 */

function Field({
  id,
  label,
  ...props
}: {
  id: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">

      <Label htmlFor={id}>
        {label}
      </Label>

      <Input
        id={id}
        {...props}
        className={`h-14 rounded-2xl px-4 text-base ${
          props.className ?? ""
        }`}
      />

    </div>
  );
}
