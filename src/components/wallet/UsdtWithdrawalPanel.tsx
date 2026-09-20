import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestUsdtWithdrawalFn,
  usdtSettingsFn,
} from "@/lib/app.functions";

type UsdtSettings = {
  network: string;
  symbol: string;
  withdrawal_enabled: boolean;
  usdt_mzn_rate: number;
  min_withdrawal_usdt: number;
};

export function UsdtWithdrawalPanel() {
  const [settings, setSettings] = useState<UsdtSettings | null>(null);
  const [amountMzn, setAmountMzn] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    usdtSettingsFn()
      .then((result) => {
        if (mounted) {
          setSettings(result as UsdtSettings);
        }
      })
      .catch((error) => {
        console.error(error);
        if (mounted) {
          toast.error("Não foi possível carregar as configurações USDT.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = Number(amountMzn) || 0;

  const rate = Number(settings?.usdt_mzn_rate) || 0;

  const estimatedUsdt = rate > 0 ? value / rate : 0;

  async function submit() {
    if (!settings?.withdrawal_enabled) {
      toast.error("Os saques USDT TRC20 estão temporariamente indisponíveis.");
      return;
    }

    if (!destinationAddress.trim()) {
      toast.error("Introduza o endereço USDT TRC20.");
      return;
    }

    if (!destinationAddress.trim().startsWith("T")) {
      toast.error("O endereço TRC20 parece inválido. Deve começar por T.");
      return;
    }

    if (value <= 0) {
      toast.error("Introduza o valor do saque.");
      return;
    }

    if (rate <= 0) {
      toast.error("A taxa USDT/MZN ainda não foi configurada.");
      return;
    }

    if (
      settings?.min_withdrawal_usdt > 0 &&
      estimatedUsdt < settings.min_withdrawal_usdt
    ) {
      toast.error(
        `O mínimo é ${settings.min_withdrawal_usdt} USDT.`,
      );
      return;
    }

    try {
      setBusy(true);

      const result = await requestUsdtWithdrawalFn({
        data: {
          amountMzn: value,
          destinationAddress: destinationAddress.trim(),
        },
      });

      toast.success(
        "Pedido de saque USDT TRC20 enviado para processamento.",
      );

      setAmountMzn("");
      setDestinationAddress("");

      console.log("USDT withdrawal:", result);
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível solicitar o saque USDT.";

      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-card flex items-center justify-center p-6">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="surface-card space-y-4 p-4">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h2 className="text-sm font-semibold">Saque USDT TRC20</h2>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Receba o seu saque em USDT através da rede TRON (TRC20).
        </p>
      </div>

      {!settings?.withdrawal_enabled ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Os saques USDT TRC20 ainda não estão disponíveis.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-secondary p-3 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                Rede
              </span>
              <span className="font-semibold">
                TRON / TRC20
              </span>
            </div>

            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted-foreground">
                Taxa de conversão
              </span>
              <span className="font-semibold">
                {rate > 0 ? `${rate} MZN = 1 USDT` : "Não configurada"}
              </span>
            </div>

            {settings.min_withdrawal_usdt > 0 && (
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-muted-foreground">
                  Mínimo
                </span>
                <span className="font-semibold">
                  {settings.min_withdrawal_usdt} USDT
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usdt-withdraw-amount">
              Valor do saque (MZN)
            </Label>

            <Input
              id="usdt-withdraw-amount"
              type="number"
              inputMode="decimal"
              min="0"
              value={amountMzn}
              onChange={(e) => setAmountMzn(e.target.value)}
              placeholder="1000"
              disabled={busy}
            />
          </div>

          {value > 0 && rate > 0 && (
            <div className="rounded-lg border border-border bg-secondary p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Valor aproximado
                </span>

                <span className="font-bold">
                  {estimatedUsdt.toFixed(2)} USDT
                </span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="usdt-trc20-address">
              Endereço USDT TRC20
            </Label>

            <Input
              id="usdt-trc20-address"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="T..."
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              className="font-mono text-xs"
            />

            <p className="text-[11px] text-muted-foreground">
              Confirme cuidadosamente o endereço e a rede TRC20 antes de
              enviar. Um endereço ou rede incorreta pode resultar na perda dos
              fundos.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={submit}
            disabled={
              busy ||
              value <= 0 ||
              !destinationAddress.trim() ||
              rate <= 0
            }
          >
            {busy && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Solicitar saque USDT
          </Button>
        </>
      )}
    </div>
  );
}
