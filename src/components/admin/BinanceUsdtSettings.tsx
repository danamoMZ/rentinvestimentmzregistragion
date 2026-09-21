import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  binanceSettingsFn,
  updateBinanceSettingsFn,
  testBinanceConnectionFn,
  binanceUsdtBalanceFn,
} from "@/lib/app.functions";
import { Button } from "@/components/ui/button";

type BinanceSettings = {
  enabled: boolean;
  automaticWithdrawals: boolean;
  asset: string;
  network: string;
  apiConfigured: boolean;
};

type BinanceConnectionResult = {
  success: boolean;
  message: string;
  enableReading?: boolean;
  enableWithdrawals?: boolean;
  ipRestrict?: boolean;
};

export function BinanceUsdtSettings() {
  const [settings, setSettings] = useState<BinanceSettings | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [automaticWithdrawals, setAutomaticWithdrawals] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [connectionResult, setConnectionResult] =
    useState<BinanceConnectionResult | null>(null);
  
  type BinanceBalance = {
  success: boolean;
  asset: string;
  free: number;
  locked: number;
  total: number;
  message: string;
};

const [binanceBalance, setBinanceBalance] =
  useState<BinanceBalance | null>(null);

const [loadingBalance, setLoadingBalance] =
  useState(false);

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

  async function testConnection() {
    try {
      setTesting(true);
      setConnectionResult(null);

      const result = await testBinanceConnectionFn();

      const connection: BinanceConnectionResult = {
        success: Boolean(result.success),
        message: String(
          result.message ?? "Conexão Binance testada com sucesso.",
        ),
        enableReading:
          typeof result.enableReading === "boolean"
            ? result.enableReading
            : undefined,
        enableWithdrawals:
          typeof result.enableWithdrawals === "boolean"
            ? result.enableWithdrawals
            : undefined,
        ipRestrict:
          typeof result.ipRestrict === "boolean"
            ? result.ipRestrict
            : undefined,
      };

      setConnectionResult(connection);

      if (connection.success) {
        toast.success("Conexão com a Binance funcionando.");
      } else {
        toast.error(connection.message);
      }
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível testar a conexão com a Binance.";

      setConnectionResult({
        success: false,
        message,
      });

      toast.error(message);
    } finally {
      setTesting(false);
    }
  }

  async function loadBinanceBalance() {
  try {
    setLoadingBalance(true);

    const result = await binanceUsdtBalanceFn();

    const balance: BinanceBalance = {
      success: Boolean(result.success),
      asset: String(result.asset ?? "USDT"),
      free: Number(result.free ?? 0),
      locked: Number(result.locked ?? 0),
      total: Number(result.total ?? 0),
      message: String(
        result.message ??
          "Saldo Binance consultado.",
      ),
    };

    setBinanceBalance(balance);

    if (!balance.success) {
      toast.error(balance.message);
    }
  } catch (error) {
    console.error(
      "[BINANCE BALANCE UI]",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível consultar o saldo USDT da Binance.";

    setBinanceBalance({
      success: false,
      asset: "USDT",
      free: 0,
      locked: 0,
      total: 0,
      message,
    });

    toast.error(message);
  } finally {
    setLoadingBalance(false);
  }
  }

  if (loading) {
    return (
      <div className="surface-card p-5">
        <p className="text-sm text-muted-foreground">
          A carregar configuração Binance...
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="surface-card p-5">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar a configuração Binance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-card p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">
            Binance — USDT TRC20
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Configuração da integração Binance utilizada para a operação
            USDT através da rede TRC20.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Ativo</p>
            <p className="mt-1 font-semibold">{settings.asset}</p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Rede</p>
            <p className="mt-1 font-semibold">{settings.network}</p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">API</p>
            <p className="mt-1 font-semibold">
              {settings.apiConfigured
                ? "Configurada"
                : "Não configurada"}
            </p>
          </div>
        </div>

        {/* SALDO BINANCE */}
<div className="mt-5 rounded-lg border p-4">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="font-medium">
        Saldo Binance — USDT
      </p>

      <p className="mt-1 text-sm text-muted-foreground">
        Consulta o saldo real da conta Binance.
        Esta operação é somente de leitura.
      </p>
    </div>

    <Button
      type="button"
      variant="outline"
      onClick={loadBinanceBalance}
      disabled={loadingBalance}
    >
      {loadingBalance
        ? "A consultar..."
        : "Atualizar saldo"}
    </Button>
  </div>

  {binanceBalance && (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border p-4">
        <p className="text-xs text-muted-foreground">
          Disponível
        </p>

        <p className="mt-1 text-lg font-semibold">
          {binanceBalance.free.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            },
          )}{" "}
          USDT
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs text-muted-foreground">
          Bloqueado
        </p>

        <p className="mt-1 text-lg font-semibold">
          {binanceBalance.locked.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            },
          )}{" "}
          USDT
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs text-muted-foreground">
          Total
        </p>

        <p className="mt-1 text-lg font-bold">
          {binanceBalance.total.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            },
          )}{" "}
          USDT
        </p>
      </div>
    </div>
  )}

  {!binanceBalance && !loadingBalance && (
    <p className="mt-4 text-sm text-muted-foreground">
      Clique em “Atualizar saldo” para consultar o saldo
      atual da Binance.
    </p>
  )}
</div>

        {/* TESTE DA API */}
        <div className="mt-5 rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Teste da conexão</p>

              <p className="text-sm text-muted-foreground">
                Faz uma consulta somente de leitura à Binance. Nenhum
                levantamento será realizado.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={testing}
            >
              {testing
                ? "A testar..."
                : "Testar conexão Binance"}
            </Button>
          </div>

          {connectionResult && (
            <div
              className={`mt-4 rounded-lg border p-4 ${
                connectionResult.success
                  ? "border-green-500/30"
                  : "border-red-500/30"
              }`}
            >
              <p className="font-medium">
                {connectionResult.success
                  ? "✓ Conexão aprovada"
                  : "✕ Falha na conexão"}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {connectionResult.message}
              </p>

              {connectionResult.success && (
                <div className="mt-3 grid gap-2 text-sm">
                  {typeof connectionResult.enableReading ===
                    "boolean" && (
                    <div>
                      Leitura:{" "}
                      <strong>
                        {connectionResult.enableReading
                          ? "Ativada"
                          : "Desativada"}
                      </strong>
                    </div>
                  )}

                  {typeof connectionResult.enableWithdrawals ===
                    "boolean" && (
                    <div>
                      Levantamentos:{" "}
                      <strong>
                        {connectionResult.enableWithdrawals
                          ? "Ativados"
                          : "Desativados"}
                      </strong>
                    </div>
                  )}

                  {typeof connectionResult.ipRestrict ===
                    "boolean" && (
                    <div>
                      Restrição por IP:{" "}
                      <strong>
                        {connectionResult.ipRestrict
                          ? "Ativada"
                          : "Desativada"}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* INTEGRAÇÃO */}
        <div className="mt-5 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                Ativar integração Binance
              </p>

              <p className="text-sm text-muted-foreground">
                Permite que o sistema utilize a integração Binance.
              </p>
            </div>

            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) =>
                setEnabled(event.target.checked)
              }
              className="h-5 w-5"
            />
          </div>
        </div>

        {/* SAQUES AUTOMÁTICOS */}
        <div className="mt-4 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                Saques automáticos
              </p>

              <p className="text-sm text-muted-foreground">
                Permite que os pedidos de saque USDT sejam enviados
                automaticamente através da Binance quando a integração
                estiver pronta.
              </p>
            </div>

            <input
              type="checkbox"
              checked={automaticWithdrawals}
              onChange={(event) =>
                setAutomaticWithdrawals(event.target.checked)
              }
              className="h-5 w-5"
            />
          </div>
        </div>

        {/* SEGURANÇA */}
        <div className="mt-4 rounded-lg border p-4">
          <p className="font-medium">Segurança</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Nunca coloque a API Secret da Binance neste arquivo ou no
            GitHub. As credenciais deverão ficar somente nas variáveis
            seguras do servidor.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            onClick={saveSettings}
            disabled={saving}
          >
            {saving
              ? "A guardar..."
              : "Guardar configuração"}
          </Button>
        </div>
      </div>
    </div>
  );
}
