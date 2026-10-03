import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile, useSession } from "@/hooks/use-session";
import { MZN, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { userId, session } = useSession();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    wallet_number: "",
    province: "",
    district: "",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        wallet_number: profile.wallet_number ?? "",
        province: profile.province ?? "",
        district: profile.district ?? "",
      });
    }
  }, [profile]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({
        ...prev,
        [key]: e.target.value,
      }));
    };

  const save = async () => {
    if (!userId) return;

    setBusy(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update(form)
        .eq("id", userId);

      if (error) {
        throw new Error(error.message);
      }

      toast.success("Perfil atualizado.");

      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível guardar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (!session?.user.email) {
      toast.error(
        "Não foi possível identificar o email da sua conta.",
      );
      return;
    }

    if (!currentPassword) {
      toast.error(
        "Introduza a palavra-passe antiga.",
      );
      return;
    }

    if (!newPassword) {
      toast.error(
        "Introduza a nova palavra-passe.",
      );
      return;
    }

    if (newPassword.length < 6) {
      toast.error(
        "A nova palavra-passe deve ter pelo menos 6 caracteres.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        "A confirmação da nova palavra-passe não corresponde.",
      );
      return;
    }

    if (currentPassword === newPassword) {
      toast.error(
        "A nova palavra-passe deve ser diferente da antiga.",
      );
      return;
    }

    setPasswordBusy(true);

    try {
      /*
       * Primeiro verifica se a palavra-passe antiga está correta.
       */
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: currentPassword,
        });

      if (loginError) {
        toast.error(
          "A palavra-passe antiga está incorreta.",
        );
        return;
      }

      /*
       * Altera para a nova palavra-passe.
       */
      const { error: passwordError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (passwordError) {
        throw new Error(passwordError.message);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast.success(
        "Palavra-passe alterada com sucesso.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar a palavra-passe.",
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const signOut = async () => {
    await queryClient.cancelQueries();

    queryClient.clear();

    await supabase.auth.signOut();

    navigate({
      to: "/auth",
      replace: true,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          O meu perfil
        </h1>

        <p className="text-sm text-muted-foreground">
          Dados da conta e informações de recebimento.
        </p>
      </div>

      {/* INFORMAÇÕES DA CONTA */}

      <div className="surface-card bg-[image:var(--gradient-soft)] p-5">
        <p className="text-lg font-bold">
          {profile?.full_name || "—"}
        </p>

        <p className="text-sm text-muted-foreground">
          {profile?.email}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">
              ID público
            </p>

            <p className="font-semibold">
              {profile?.public_id ?? "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Saldo
            </p>

            <p className="font-semibold">
              {MZN(profile?.balance)}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Registo
            </p>

            <p className="font-semibold">
              {formatDate(profile?.created_at)}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">
              Tipo de conta
            </p>

            <p className="font-semibold">
              {isAdmin
                ? "Administrador"
                : profile?.account_tier === "RECRUTA"
                  ? "RECRUTA"
                  : profile?.account_tier ?? "Utilizador"}
            </p>
          </div>
        </div>
      </div>

      {/* EDITAR DADOS */}

      <div className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">
          Editar dados
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="full_name">
            Nome completo
          </Label>

          <Input
            id="full_name"
            value={form.full_name}
            onChange={set("full_name")}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              Telefone
            </Label>

            <Input
              id="phone"
              value={form.phone}
              onChange={set("phone")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wallet_number">
              Número da carteira
            </Label>

            <Input
              id="wallet_number"
              value={form.wallet_number}
              onChange={set("wallet_number")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="province">
              Província
            </Label>

            <Input
              id="province"
              value={form.province}
              onChange={set("province")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="district">
              Distrito
            </Label>

            <Input
              id="district"
              value={form.district}
              onChange={set("district")}
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={save}
          disabled={busy}
        >
          {busy && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}

          Guardar alterações
        </Button>
      </div>

      {/* ALTERAR PALAVRA-PASSE */}

      <div className="surface-card space-y-4 p-4">
        <div className="flex items-center gap-2">
          <LockKeyhole className="size-5 text-primary" />

          <div>
            <h2 className="text-sm font-semibold">
              Alterar palavra-passe
            </h2>

            <p className="text-xs text-muted-foreground">
              Introduza a palavra-passe antiga e escolha uma nova.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="current_password">
            Palavra-passe antiga
          </Label>

          <Input
            id="current_password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) =>
              setCurrentPassword(e.target.value)
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new_password">
            Nova palavra-passe
          </Label>

          <Input
            id="new_password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) =>
              setNewPassword(e.target.value)
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm_password">
            Confirmar nova palavra-passe
          </Label>

          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
          />
        </div>

        <Button
          className="w-full"
          onClick={changePassword}
          disabled={passwordBusy}
        >
          {passwordBusy && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}

          Alterar palavra-passe
        </Button>
      </div>

      {/* TERMINAR SESSÃO */}

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={signOut}
      >
        <LogOut className="size-4" />

        Terminar sessão
      </Button>
    </div>
  );
}
