import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  binanceSettingsFn,
  updateBinanceSettingsFn,
} from "@/lib/app.functions";
import { Button } from "@/components/ui/button";

type BinanceSettings = {
  enabled: boolean;
  automaticWithdrawals: boolean;
  asset: string;
  network: string;
  apiConfigured: boolean;
};

export function BinanceUsdtSettings() {
  const [settings, setSettings] = useState<BinanceSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [automaticWithdrawals, setAutomaticWithdrawals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadSettings() {
    try {
      setLoading(true);

      const result = await binanceSettingsFn();

      setSettings(result);
      setEnabled(result.enabled);
      setAutomaticWithdrawals(result.automaticWithdrawals);
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

  async function saveSettings() {
    try {
      setSaving(true);

      const result = await updateBinanceSettingsFn({
        data: {
          enabled,
          automaticWithdrawals,
        },
      });

      setSettings(result);

      setEnabled(result.enabled);
      setAutomaticWithdrawals(result.automaticWithdrawals);

      toast.success("Configuração Binance atualizada.");
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível guardar a configuração.",
      );
    } finally {
      setSaving(false);
    }
  }

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

        <Button
          type="button"
          className="mt-4"
          onClick={() => void loadSettings()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="surface-card space-y-6 rounded-2xl p-5">
      <div>
        <h2 className="text-lg font-semibold">
          Binance — USDT TRC20
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Configuração da integração Binance utilizada para a operação
          USDT através da rede TRC20.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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

        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">
            API
          </p>

          <p className="mt-1 font-semibold">
            {settings.apiConfigured
              ? "Configurada"
              : "Não configurada"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="font-medium">
              Ativar integração Binance
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Permite que o sistema utilize a integração Binance.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((value) => !value)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              enabled
                ? "bg-primary"
                : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                enabled
                  ? "left-6"
                  : "left-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="font-medium">
              Saques automáticos
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Permite que os pedidos de saque USDT sejam enviados
              automaticamente através da Binance quando a integração
              estiver pronta.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={automaticWithdrawals}
            disabled={!enabled}
            onClick={() =>
              setAutomaticWithdrawals((value) => !value)
            }
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              automaticWithdrawals
                ? "bg-primary"
                : "bg-muted"
            } ${
              !enabled
                ? "cursor-not-allowed opacity-50"
                : ""
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                automaticWithdrawals
                  ? "left-6"
                  : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <p className="font-medium">
          Segurança
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          Nunca coloque a API Secret da Binance neste arquivo ou no
          GitHub. As credenciais deverão ficar somente nas variáveis
          seguras do servidor.
        </p>
      </div>

      <Button
        type="button"
        disabled={saving}
        onClick={() => void saveSettings()}
      >
        {saving ? "A guardar..." : "Guardar configuração"}
      </Button>
    </div>
  );
}
