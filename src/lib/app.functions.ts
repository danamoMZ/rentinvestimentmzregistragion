import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const depositFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { planId: number; senderNumber: string; transactionId: string; proofPath: string | null }) => data,
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
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? getRequestHeader("cf-connecting-ip") ?? null;
    let ipHash: string | null = null;
    if (ip) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
      ipHash = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return ops.redeemPromoCode(context.supabase, context.userId, data.code, ipHash);
  });
