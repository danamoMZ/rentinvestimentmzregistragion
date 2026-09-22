import { useEffect, useState } from "react";
import {
  createUsdtDepositFn,
  usdtSettingsFn,
} from "@/lib/app.functions";

export function UsdtTrc20Panel() {
  const [loading, setLoading] = useState(true);
  const [depositLoading, setDepositLoading] = useState(false);

  const [settings, setSettings] = useState<{
    network: string;
    symbol: string;
    depositAddress: string;
    depositEnabled: boolean;
    withdrawalEnabled: boolean;
    usdtMznRate: number;
    minDepositUsdt: number;
    minWithdrawalUsdt: number;
  } | null>(null);

  const [txid, setTxid] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const result = await usdtSettingsFn();

        if (mounted) {
          setSettings(result);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar as configurações USDT.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  async function submitDeposit() {
    setError("");
    setMessage("");

    const cleanTxid = txid.trim();

    if (!cleanTxid) {
      setError("Informe o TXID da transferência.");
      return;
    }

    setDepositLoading(true);

    try {
      const result = await createUsdtDepositFn({
        data: {
          txid: cleanTxid,
        },
      });

      setMessage(
        `Depósito confirmado: ${result.amountUsdt} USDT = ${result.amountMzn.toFixed(2)} MZN.`,
      );

      setTxid("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível verificar o depósito.",
      );
    } finally {
      setDepositLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border p-4">
        <p className="text-sm text-muted-foreground">
          A carregar USDT TRC20...
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-2xl border p-4">
        <p className="text-sm text-red-500">
          {error || "Configuração USDT indisponível."}
        </p>
      </div>
    );
  }

  const isEnabled =
    settings.depositEnabled &&
    settings.depositAddress &&
    settings.usdtMznRate > 0;

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold">
          USDT TRC20
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Deposite USDT pela rede TRON (TRC20).
        </p>
      </div>

      {!isEnabled && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Os depósitos USDT TRC20 ainda não estão disponíveis.
        </div>
      )}

      {isEnabled && (
        <>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Endereço para depósito
            </p>

            <p className="mt-1 break-all font-mono text-sm">
              {settings.depositAddress}
            </p>
          </div>

          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Taxa atual
            </p>

            <p className="mt-1 font-semibold">
              1 USDT = {settings.usdtMznRate.toFixed(2)} MZN
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">
              TXID da transferência
            </label>

            <input
              type="text"
              value={txid}
              onChange={(event) =>
                setTxid(event.target.value)
              }
              placeholder="Cole aqui o TXID da transação"
              className="mt-2 w-full rounded-xl border bg-background px-3 py-3 text-sm outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={submitDeposit}
            disabled={depositLoading}
            className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {depositLoading
              ? "A verificar..."
              : "Verificar depósito"}
          </button>

          <p className="text-xs text-muted-foreground">
            Envie somente USDT pela rede TRC20 para este
            endereço. Uma rede diferente pode resultar na
            perda dos fundos.
          </p>
        </>
      )}
    </div>
  );
}
