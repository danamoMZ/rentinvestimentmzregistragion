import { useEffect, useState } from "react";
import { getServerOutboundIpFn } from "@/lib/app.functions";
import { toast } from "sonner";

import {
  binanceSettingsFn,
  updateBinanceSettingsFn,
  testBinanceConnectionFn,
  usdtAdminSettingsFn,
  updateUsdtAdminSettingsFn,
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
  enableReading?: boolean | undefined;
  enableWithdrawals?: boolean | undefined;
  ipRestrict?: boolean | undefined;
};

type UsdtSettings = {
  network: string;
  symbol: string;
  depositAddress: string;
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
  usdtMznRate: number;
  minDepositUsdt: number;
  minWithdrawalUsdt: number;
  updatedAt: string | null;
};

export function BinanceUsdtSettings() {
  const [settings, setSettings] =
    useState<BinanceSettings | null>(null);

  const [enabled, setEnabled] =
    useState(false);

  const [automaticWithdrawals, setAutomaticWithdrawals] =
    useState(false);

  const [usdtSettings, setUsdtSettings] =
    useState<UsdtSettings | null>(null);

  const [depositAddress, setDepositAddress] =
    useState("");

  const [depositEnabled, setDepositEnabled] =
    useState(false);

  const [withdrawalEnabled, setWithdrawalEnabled] =
    useState(false);

  const [usdtMznRate, setUsdtMznRate] =
    useState("0");

  const [minDepositUsdt, setMinDepositUsdt] =
    useState("1");

  const [minWithdrawalUsdt, setMinWithdrawalUsdt] =
    useState("1");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [savingUsdt, setSavingUsdt] =
    useState(false);

  const [testing, setTesting] =
    useState(false);

  const [connectionResult, setConnectionResult] =
    useState<BinanceConnectionResult | null>(null);


  async function loadSettings() {
    try {
      setLoading(true);

      const [
        binance,
        usdt,
      ] = await Promise.all([
        binanceSettingsFn(),
        usdtAdminSettingsFn(),
      ]);

      setSettings(binance);

      setEnabled(
        Boolean(binance.enabled),
      );

      setAutomaticWithdrawals(
        Boolean(
          binance.automaticWithdrawals,
        ),
      );

      setUsdtSettings(usdt);

      setDepositAddress(
        usdt.depositAddress ?? "",
      );

      setDepositEnabled(
        Boolean(usdt.depositEnabled),
      );

      setWithdrawalEnabled(
        Boolean(
          usdt.withdrawalEnabled,
        ),
      );

      setUsdtMznRate(
        String(
          usdt.usdtMznRate ?? 0,
        ),
      );

      setMinDepositUsdt(
        String(
          usdt.minDepositUsdt ?? 1,
        ),
      );

      setMinWithdrawalUsdt(
        String(
          usdt.minWithdrawalUsdt ?? 1,
        ),
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as configurações.",
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadSettings();
  }, []);


  async function saveBinanceSettings() {
    try {
      setSaving(true);

      const result =
        await updateBinanceSettingsFn({
          data: {
            enabled,
            automaticWithdrawals,
          },
        });

      setSettings(result);

      setEnabled(
        result.enabled,
      );

      setAutomaticWithdrawals(
        result.automaticWithdrawals,
      );

      toast.success(
        "Configuração Binance atualizada.",
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível guardar a configuração Binance.",
      );
    } finally {
      setSaving(false);
    }
  }


  async function saveUsdtSettings() {
    try {
      setSavingUsdt(true);

      const rate =
        Number(
          usdtMznRate.replace(
            ",",
            ".",
          ),
        );

      const minDeposit =
        Number(
          minDepositUsdt.replace(
            ",",
            ".",
          ),
        );

      const minWithdrawal =
        Number(
          minWithdrawalUsdt.replace(
            ",",
            ".",
          ),
        );

      if (
        !Number.isFinite(rate) ||
        rate <= 0
      ) {
        toast.error(
          "Informe uma taxa USDT/MZN válida.",
        );

        return;
      }

      if (
        !Number.isFinite(minDeposit) ||
        minDeposit <= 0
      ) {
        toast.error(
          "Informe um mínimo de depósito válido.",
        );

        return;
      }

      if (
        !Number.isFinite(minWithdrawal) ||
        minWithdrawal <= 0
      ) {
        toast.error(
          "Informe um mínimo de saque válido.",
        );

        return;
      }

      if (
        depositAddress.trim() &&
        !/^T[a-zA-Z0-9]{33}$/.test(
          depositAddress.trim(),
        )
      ) {
        toast.error(
          "O endereço informado não parece ser um endereço TRON TRC20 válido.",
        );

        return;
      }

      const result =
        await updateUsdtAdminSettingsFn({
          data: {
            depositAddress:
              depositAddress.trim(),

            depositEnabled,

            withdrawalEnabled,

            usdtMznRate:
              rate,

            minDepositUsdt:
              minDeposit,

            minWithdrawalUsdt:
              minWithdrawal,
          },
        });

      setUsdtSettings(
        result,
      );

      setDepositAddress(
        result.depositAddress,
      );

      setDepositEnabled(
        result.depositEnabled,
      );

      setWithdrawalEnabled(
        result.withdrawalEnabled,
      );

      setUsdtMznRate(
        String(
          result.usdtMznRate,
        ),
      );

      setMinDepositUsdt(
        String(
          result.minDepositUsdt,
        ),
      );

      setMinWithdrawalUsdt(
        String(
          result.minWithdrawalUsdt,
        ),
      );

      toast.success(
        "Configuração USDT TRC20 guardada com sucesso.",
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível guardar a configuração USDT.",
      );
    } finally {
      setSavingUsdt(false);
    }
  }


  async function testConnection() {
    try {
      setTesting(true);

      setConnectionResult(null);

      const result =
        await testBinanceConnectionFn();

      const connection: BinanceConnectionResult =
        {
          success:
            Boolean(
              result.success,
            ),

          message:
            String(
              result.message ??
                "Conexão Binance testada com sucesso.",
            ),

          enableReading:
            typeof result.enableReading ===
            "boolean"
              ? result.enableReading
              : undefined,

          enableWithdrawals:
            typeof result.enableWithdrawals ===
            "boolean"
              ? result.enableWithdrawals
              : undefined,

          ipRestrict:
            typeof result.ipRestrict ===
            "boolean"
              ? result.ipRestrict
              : undefined,
        };

      setConnectionResult(
        connection,
      );

      if (
        connection.success
      ) {
        toast.success(
          "Conexão com a Binance funcionando.",
        );
      } else {
        toast.error(
          connection.message,
        );
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


  if (loading) {
    return (
      <div className="surface-card p-5">
        <p className="text-sm text-muted-foreground">
          A carregar configuração Binance e USDT...
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
    <div className="space-y-4">

      {/* =====================================================
          BINANCE
      ====================================================== */}

      <div className="surface-card p-5">

        <div className="mb-5">
          <h2 className="text-lg font-semibold">
            Binance — USDT TRC20
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Configuração da integração Binance utilizada
            para a operação USDT através da rede TRC20.
          </p>
        </div>


        <div className="grid gap-4 sm:grid-cols-3">

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              Ativo
            </p>

            <p className="mt-1 font-semibold">
              {settings.asset}
            </p>
          </div>


          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">
              Rede
            </p>

            <p className="mt-1 font-semibold">
              {settings.network}
            </p>
          </div>


          <div className="rounded-lg border p-4">
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


        {/* TESTE API */}

        <div className="mt-5 rounded-lg border p-4">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="font-medium">
                Teste da conexão
              </p>

              <p className="text-sm text-muted-foreground">
                Consulta somente de leitura à Binance.
                Nenhum levantamento será realizado.
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

                  <Button
  type="button"
  variant="outline"
  onClick={async () => {
    try {
      const result = await getServerOutboundIpFn();

      toast.success(
        `IP do servidor: ${result.ip}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível descobrir o IP.",
      );
    }
  }}
>
  Descobrir IP do servidor
</Button>


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
                setEnabled(
                  event.target.checked,
                )
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
                Permite preparar o processamento automático
                dos pedidos USDT quando essa função estiver
                devidamente configurada.
              </p>
            </div>


            <input
              type="checkbox"
              checked={automaticWithdrawals}
              onChange={(event) =>
                setAutomaticWithdrawals(
                  event.target.checked,
                )
              }
              className="h-5 w-5"
            />

          </div>

        </div>


        <div className="mt-5 flex justify-end">

          <Button
            type="button"
            onClick={saveBinanceSettings}
            disabled={saving}
          >
            {saving
              ? "A guardar..."
              : "Guardar configuração Binance"}
          </Button>

        </div>

      </div>


      {/* =====================================================
          CONFIGURAÇÃO USDT TRC20
      ====================================================== */}

      <div className="surface-card p-5">

        <div className="mb-5">

          <h2 className="text-lg font-semibold">
            Configuração USDT TRC20
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Configure aqui o endereço de depósito, taxa
            USDT/MZN, limites e disponibilidade da carteira.
          </p>

        </div>


        {/* ENDEREÇO */}

        <div className="space-y-2">

          <label className="text-sm font-medium">
            Endereço USDT TRC20 para depósitos
          </label>

          <input
            type="text"
            value={depositAddress}
            onChange={(event) =>
              setDepositAddress(
                event.target.value,
              )
            }
            placeholder="Ex.: T..."
            className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />

          <p className="text-xs text-muted-foreground">
            Use somente um endereço da rede TRON (TRC20).
            Não utilize endereço ERC20 ou BEP20.
          </p>

        </div>


        {/* TAXA */}

        <div className="mt-5 grid gap-4 sm:grid-cols-3">

          <div className="space-y-2">

            <label className="text-sm font-medium">
              Taxa USDT → MZN
            </label>

            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={usdtMznRate}
              onChange={(event) =>
                setUsdtMznRate(
                  event.target.value,
                )
              }
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />

            <p className="text-xs text-muted-foreground">
              Ex.: 65 significa 1 USDT = 65 MZN.
            </p>

          </div>


          <div className="space-y-2">

            <label className="text-sm font-medium">
              Mínimo depósito USDT
            </label>

            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={minDepositUsdt}
              onChange={(event) =>
                setMinDepositUsdt(
                  event.target.value,
                )
              }
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />

          </div>


          <div className="space-y-2">

            <label className="text-sm font-medium">
              Mínimo saque USDT
            </label>

            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={minWithdrawalUsdt}
              onChange={(event) =>
                setMinWithdrawalUsdt(
                  event.target.value,
                )
              }
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />

          </div>

        </div>


        {/* DEPÓSITOS */}

        <div className="mt-5 rounded-lg border p-4">

          <div className="flex items-center justify-between gap-4">

            <div>
              <p className="font-medium">
                Ativar depósitos USDT
              </p>

              <p className="text-sm text-muted-foreground">
                Permite que os utilizadores utilizem
                o depósito USDT TRC20.
              </p>
            </div>


            <input
              type="checkbox"
              checked={depositEnabled}
              onChange={(event) =>
                setDepositEnabled(
                  event.target.checked,
                )
              }
              className="h-5 w-5"
            />

          </div>

        </div>


        {/* SAQUES */}

        <div className="mt-4 rounded-lg border p-4">

          <div className="flex items-center justify-between gap-4">

            <div>
              <p className="font-medium">
                Ativar saques USDT
              </p>

              <p className="text-sm text-muted-foreground">
                Permite que os utilizadores solicitem
                levantamentos USDT através da rede TRC20.
              </p>
            </div>


            <input
              type="checkbox"
              checked={withdrawalEnabled}
              onChange={(event) =>
                setWithdrawalEnabled(
                  event.target.checked,
                )
              }
              className="h-5 w-5"
            />

          </div>

        </div>


        {/* SEGURANÇA */}

        <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">

          <p className="font-medium">
            ⚠️ Segurança
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            O endereço acima é apenas o endereço público
            de depósito. Nunca coloque a API Key ou API
            Secret da Binance neste campo.
          </p>

        </div>


        {/* GUARDAR USDT */}

        <div className="mt-5 flex justify-end">

          <Button
            type="button"
            onClick={saveUsdtSettings}
            disabled={savingUsdt}
          >
            {savingUsdt
              ? "A guardar USDT..."
              : "Guardar configuração USDT"}
          </Button>

        </div>


        {/* RESUMO */}

        {usdtSettings && (
          <div className="mt-5 rounded-lg border bg-muted/20 p-4">

            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estado actual
            </p>

            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">

              <div>
                Rede:{" "}
                <strong>
                  {usdtSettings.network}
                </strong>
              </div>

              <div>
                Moeda:{" "}
                <strong>
                  {usdtSettings.symbol}
                </strong>
              </div>

              <div>
                Depósitos:{" "}
                <strong>
                  {usdtSettings.depositEnabled
                    ? "Ativados"
                    : "Desativados"}
                </strong>
              </div>

              <div>
                Saques:{" "}
                <strong>
                  {usdtSettings.withdrawalEnabled
                    ? "Ativados"
                    : "Desativados"}
                </strong>
              </div>

              <div>
                Taxa:{" "}
                <strong>
                  {usdtSettings.usdtMznRate} MZN
                </strong>{" "}
                / USDT
              </div>

              <div>
                Mínimo depósito:{" "}
                <strong>
                  {usdtSettings.minDepositUsdt} USDT
                </strong>
              </div>

              <div>
                Mínimo saque:{" "}
                <strong>
                  {usdtSettings.minWithdrawalUsdt} USDT
                </strong>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
