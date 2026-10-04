import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const depositFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { amount: number; senderNumber: string; transactionId: string; proofPath: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.submitDeposit(context.userId, data);
  });

export const withdrawFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.requestWithdrawal(context.userId, data.amount);
  });

export const affiliateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { type: string; url: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.submitAffiliate(context.userId, data.type, data.url);
  });

export const donateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.createDonation(context.userId, data.amount);
  });

export const openTicketFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subject: string; message: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.openTicket(context.userId, data.subject, data.message);
  });

export const replyTicketFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ticketId: string; message: string; asAdmin: boolean }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    if (data.asAdmin) await ops.assertAdmin(context.userId);
    return ops.replyTicket(context.userId, data.ticketId, data.message, data.asAdmin);
  });

export const syncFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const ops = await import("@/lib/ops.server");
    return ops.syncAccount();
  });

export const reviewDepositFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; approve: boolean }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.reviewDeposit(context.userId, data.id, data.approve);
  });

export const reviewWithdrawalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; approve: boolean }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.reviewWithdrawal(context.userId, data.id, data.approve);
  });

export const reviewAffiliateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; approve: boolean }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.reviewAffiliate(context.userId, data.id, data.approve);
  });

// ============================================================
// CONFIGURAÇÃO USDT TRC20 — ADMIN
// ============================================================

export const usdtAdminSettingsFn = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.getUsdtAdminSettings(context.userId);
  });

export const updateUsdtAdminSettingsFn = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      depositAddress: string;
      depositEnabled: boolean;
      withdrawalEnabled: boolean;
      usdtMznRate: number;
      minDepositUsdt: number;
      minWithdrawalUsdt: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.updateUsdtAdminSettings(
      context.userId,
      data,
    );
  });

export const adjustBalanceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; amount: number; reason: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.adjustBalance(context.userId, data.userId, data.amount, data.reason);
  });

export const setBlockedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; blocked: boolean }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.setBlocked(context.userId, data.userId, data.blocked);
  });

export const updateUserFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      userId: string;
      fields: { full_name: string; phone: string; wallet_number: string; province: string; district: string };
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.updateUserProfile(context.userId, data.userId, data.fields);
  });

export const removeUserPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.removeUserPlan(context.userId, data.userId);
  });

export const broadcastFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title: string; body: string; onlyBlocked: boolean }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.broadcast(context.userId, data.title, data.body, data.onlyBlocked);
  });

export const saveSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { values: Record<string, string> }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.saveSettings(context.userId, data.values);
  });

export const ticketStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ticketId: string; status: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.setTicketStatus(context.userId, data.ticketId, data.status);
  });

export const proofUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.proofUrl(context.userId, data.path);
  });


export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .inputValidator((data: { identifier: string }) => data)
  .handler(async ({ data }) => {
    const ops = await import("@/lib/ops.server");
    return ops.requestPasswordReset(data.identifier);
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const ops = await import("@/lib/ops.server");
    return ops.resetPassword(data.password);
  });

export const adminChangeUserPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      userId: string;
      newPassword: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.adminChangeUserPassword(
      context.userId,
      data.userId,
      data.newPassword,
    );
  });

export const updatePlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      planId: number;
      fields: { name: string; price: number; daily_task_count: number; daily_income: number; duration_days: number; active: boolean };
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.updatePlan(context.userId, data.planId, data.fields);
  });

export const purchasePlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planId: number }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.purchasePlan(context.userId, data.planId);
  });

export const createPromoCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bonus?: number; maxUses?: number; validityMinutes?: number }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.createPromoCode(context.userId, data);
  });

export const setPromoCodeActiveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { codeId: string; active: boolean }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.setPromoCodeActive(context.userId, data.codeId, data.active);
  });

export const redeemPromoCodeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const headers = getRequest().headers;
    const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("cf-connecting-ip") || null;
    let ipHash: string | null = null;
    if (ip) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
      ipHash = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return ops.redeemPromoCode(context.supabase, context.userId, data.code, ipHash);
  });

export const startTaskWatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskIndex: number }) => data)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc("start_task_watch", {
      _task_index: data.taskIndex,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const grantShareRewardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { publicId: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.grantShareReward(context.userId, data.publicId);
  });

export const claimShareRewardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rewardId: string }) => data)
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.claimShareReward(context.supabase, context.userId, data.rewardId);
  });

export const spinRouletteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.spinRoulette(context.userId);
  });

export const rouletteFeedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const ops = await import("@/lib/ops.server");
    return ops.rouletteFeed();
  });

// ============================================================
// USDT TRC20
// ============================================================

export const usdtSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("@/lib/ops.server");
    return ops.getUsdtSettings(context.userId);
  });

export const createUsdtDepositFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      txid: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.createUsdtDeposit(
      context.userId,
      data.txid,
    );
  });

export const requestUsdtWithdrawalFn = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      amountMzn: number;
      destinationAddress: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.requestUsdtWithdrawal(
      context.userId,
      data.amountMzn,
      data.destinationAddress,
    );
  });

// ============================================================
// TEMPORÁRIO — IP DE SAÍDA DO SERVIDOR
// ============================================================

export const getServerOutboundIpFn = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.getServerOutboundIp(
      context.userId,
    );
  });

// ============================================================
// BINANCE USDT TRC20
// ============================================================

export const binanceSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.getBinanceSettings(context.userId);
  });

export const updateBinanceSettingsFn = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      enabled: boolean;
      automaticWithdrawals: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.updateBinanceSettings(
      context.userId,
      data,
    );
  });

export const testBinanceConnectionFn = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.testBinanceConnection(context.userId);
  });

export const binanceUsdtBalanceFn = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.getBinanceUsdtBalance(
      context.userId,
    );
  });

export const processUsdtWithdrawalFn = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { withdrawalId: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.processUsdtWithdrawal(
      context.userId,
      data.withdrawalId,
    );
  });

export const transferFundsFn = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      recipientPublicId: string;
      amount: number;
      purpose: "DEPOSIT" | "WITHDRAWAL";
      clientReference: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.transferFunds(
      context.userId,
      data,
    );
  });

export const financialStatsFn = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ops = await import("@/lib/ops.server");

    return ops.getFinancialStats(context.userId);
  });
