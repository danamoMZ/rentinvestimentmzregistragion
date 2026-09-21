import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { processUsdtWithdrawalFn } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";

type UsdtWithdrawal = {
  id: string;
  user_id: string;
  network: string;
  token: string;
  destination_address: string;
  amount_mzn: number | string;
  exchange_rate: number | string;
  amount_usdt: number | string;
  fee_mzn: number | string;
  net_amount_mzn: number | string;
  status: string;
  binance_client_id: string | null;
  created_at: string;
};

function formatMzn(value: number | string) {
  return `${Number(value ?? 0).toFixed(2)} MZN`;
}

function formatUsdt(value: number | string) {
  return `${Number(value ?? 0).toFixed(6)} USDT`;
}

function shortAddress(value: string) {
  if (!value) return "-";

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 9)}...${value.slice(-7)}`;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("pt-PT");
  } catch {
    return value;
  }
}

export function UsdtWithdrawalAdmin() {
  const [withdrawals, setWithdrawals] = useState<UsdtWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadWithdrawals() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("usdt_withdrawals")
        .select(`
          id,
          user_id,
          network,
          token,
          destination_address,
          amount_mzn,
          exchange_rate,
          amount_usdt,
          fee_mzn,
          net_amount_mzn,
          status,
          binance_client_id,
          created_at
        `)
        .in("status", ["PENDING", "PROCESSING"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        throw new Error(error.message);
      }

      setWithdrawals(
        Array.isArray(data)
          ? (data as UsdtWithdrawal[])
          : [],
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os saques USDT.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWithdrawals();
  }, []);

  async function processWithdrawal(withdrawalId: string) {
    try {
      setProcessingId(withdrawalId);

      const result = await processUsdtWithdrawalFn({
        data: {
          withdrawalId,
        },
      });

      toast.success(
        result?.message ||
          "Saque USDT colocado em PROCESSING.",
      );

      await loadWithdrawals();
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível processar o saque USDT.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Saques USDT — Binance
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Pedidos USDT pendentes para processamento.
              Nesta etapa o botão apenas coloca o pedido em
              PROCESSING. Nenhum USDT é enviado para a Binance.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void loadWithdrawals()}
            disabled={loading}
          >
            {loading ? "A carregar..." : "Atualizar"}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="surface-card p-5">
          <p className="text-sm text-muted-foreground">
            A carregar pedidos USDT...
          </p>
        </div>
      )}

      {!loading && withdrawals.length === 0 && (
        <div className="surface-card p-5">
          <p className="font-medium">
            Nenhum saque USDT pendente.
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Quando um utilizador solicitar um levantamento
            USDT, ele aparecerá aqui.
          </p>
        </div>
      )}

      {!loading && withdrawals.length > 0 && (
        <div className="space-y-3">
          {withdrawals.map((withdrawal) => {
            const isPending =
              withdrawal.status === "PENDING";

            const isProcessing =
              withdrawal.status === "PROCESSING";

            const isBusy =
              processingId === withdrawal.id;

            return (
              <div
                key={withdrawal.id}
                className="surface-card p-5"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        USDT TRC20
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        ID: {withdrawal.id}
                      </p>
                    </div>

                    <span
                      className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${
                        isPending
                          ? "border-yellow-500/30 text-yellow-600"
                          : "border-blue-500/30 text-blue-600"
                      }`}
                    >
                      {withdrawal.status}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">
                        Valor USDT
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatUsdt(
                          withdrawal.amount_usdt,
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">
                        Valor MZN
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatMzn(
                          withdrawal.amount_mzn,
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">
                        Taxa
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatMzn(
                          withdrawal.fee_mzn,
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">
                        Câmbio
                      </p>

                      <p className="mt-1 font-semibold">
                        {Number(
                          withdrawal.exchange_rate,
                        ).toFixed(4)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground">
                      Endereço TRC20
                    </p>

                    <p className="mt-1 break-all font-mono text-sm">
                      {withdrawal.destination_address}
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                      Resumo:{" "}
                      {shortAddress(
                        withdrawal.destination_address,
                      )}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Utilizador
                      </p>

                      <p className="mt-1 break-all text-sm">
                        {withdrawal.user_id}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Pedido em
                      </p>

                      <p className="mt-1 text-sm">
                        {formatDate(
                          withdrawal.created_at,
                        )}
                      </p>
                    </div>
                  </div>

                  {withdrawal.binance_client_id && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">
                        Binance Client ID
                      </p>

                      <p className="mt-1 break-all font-mono text-sm">
                        {withdrawal.binance_client_id}
                      </p>
                    </div>
                  )}

                  {isPending && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() =>
                          void processWithdrawal(
                            withdrawal.id,
                          )
                        }
                        disabled={isBusy}
                      >
                        {isBusy
                          ? "A processar..."
                          : "Processar saque Binance"}
                      </Button>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="rounded-lg border border-blue-500/30 p-4">
                      <p className="font-medium">
                        Saque em processamento
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Este pedido já foi preparado para a
                        próxima etapa da integração Binance.
                        Nenhum novo processamento deve ser
                        iniciado manualmente.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
      }
