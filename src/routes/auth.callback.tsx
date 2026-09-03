import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("A confirmar o seu e-mail...");

  useEffect(() => {
    const confirmEmail = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (!code) {
        setMessage("Link de confirmação inválido ou expirado.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("ERRO NA CONFIRMAÇÃO:", error);
        setMessage("Não foi possível confirmar o e-mail. O link pode ter expirado.");
        return;
      }

      setMessage("E-mail confirmado com sucesso!");

      setTimeout(() => {
        navigate({
          to: "/auth",
          search: { mode: "login" },
          replace: true,
        });
      }, 1500);
    };

    confirmEmail();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-3">
          Confirmação de e-mail
        </h1>
        <p>{message}</p>
      </div>
    </div>
  );
}
