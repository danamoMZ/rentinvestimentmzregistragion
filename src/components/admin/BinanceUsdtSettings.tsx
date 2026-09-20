import { useEffect, useState } from "react";
import { toast } from "sonner";
import { binanceSettingsFn } from "@/lib/app.functions";

type BinanceSettings = {
  enabled: boolean;
  automaticWithdrawals: boolean;
  asset: string;
  network: string;
  apiConfigured: boolean;
};

export function BinanceUsdtSettings() {
  const [settings, setSettings] = useState<BinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSettings() {
    try {
      setLoading(true);

      const result = await binanceSettingsFn();

      setSettings(result);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a configuração Binance.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="surface-card rounded-2xl p-5">
        <p className="text-sm text-muted-foreground">
          A carregar configuração Binance...
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="surface-card rounded-2xl p-5">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar a configuração Binance.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card space-y-5 rounded-2xl p-5">
      <div>
        <h2 className="text-lg font-semibold">
          Binance — USDT TRC20
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Estado da integração utilizada para pagamentos e saques USDT.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            Integração Binance
          </p>

          <p className="mt-1 font-semibold">
            {settings.enabled ? "Ativada" : "Desativada"}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            Saques automáticos
          </p>

          <p className="mt-1 font-semibold">
            {settings.automaticWithdrawals
              ? "Ativados"
              : "Desativados"}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            Ativo
          </p>

          <p className="mt-1 font-semibold">
            {settings.asset}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            Rede
          </p>

          <p className="mt-1 font-semibold">
            {settings.network}
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground">
          API Binance
        </p>

        <p className="mt-1 font-semibold">
          {settings.apiConfigured
            ? "Configurada"
            : "Ainda não configurada"}
        </p>

        {!settings.apiConfigured && (
          <p className="mt-2 text-xs text-muted-foreground">
            As credenciais serão configuradas de forma segura no
            ambiente do servidor. Nunca coloque a Secret Key no GitHub.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        <p className="font-medium">
          Integração em preparação
        </p>

        <p className="mt-1 text-muted-foreground">
          O envio automático de USDT ainda não está sendo executado.
          Primeiro vamos configurar e testar a comunicação com a
          Binance de forma segura.
        </p>
      </div>
    </div>
  );
            }
