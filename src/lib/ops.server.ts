// Regras de negócio executadas exclusivamente no servidor.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const REFERRAL_LEVELS = [
  { level: 1, min: 0, max: 30, pct: 0.1 },
  { level: 2, min: 31, max: 60, pct: 0.15 },
  { level: 3, min: 61, max: 90, pct: 0.2 },
  { level: 4, min: 91, max: 120, pct: 0.3 },
  { level: 5, min: 121, max: Number.MAX_SAFE_INTEGER, pct: 0.5 },
];

export function levelFor(activeReferrals: number) {
  return REFERRAL_LEVELS.find((l) => activeReferrals >= l.min && activeReferrals <= l.max) ?? REFERRAL_LEVELS[0]!;
}

export const AFFILIATE_REWARDS: Record<string, number> = { VIDEO: 300, POST: 150 };

export const FIRST_PLAN_BONUS = 100;
export const WITHDRAWAL_FEE_RATE = 0.10;
export const PROMO_DEFAULT_BONUS = 20;
export const PROMO_VALIDITY_MS = 60 * 60 * 1000;

export function todayMaputo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Maputo" }).format(new Date());
}

export async function assertNotBlocked(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, blocked, wallet_number, phone, balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Perfil não encontrado.");
  if (data.blocked) throw new Error("A sua conta está bloqueada. Contacte o suporte.");
  return data;
}

export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

export async function logAdmin(
  adminId: string,
  action: string,
  targetUserId: string | null,
  amount: number | null,
  reason: string | null,
  result: string,
) {
  await supabaseAdmin.from("admin_actions").insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    amount,
    reason,
    result,
  });
}

export async function notify(userId: string | null, title: string, body: string) {
  await supabaseAdmin.from("notifications").insert({ user_id: userId, title, body });
}

export async function ledger(
  userId: string,
  type: string,
  amount: number,
  reference: string | null,
  description: string,
) {
  const { error } = await supabaseAdmin.rpc("apply_ledger", {
    _user_id: userId,
    _type: type,
    _amount: amount,
    _reference: reference ?? "",
    _description: description,
  });
  if (error) throw new Error(error.message);
}

export async function getActivePlan(userId: string) {
  const today = todayMaputo();
  const { data } = await supabaseAdmin
    .from("user_plans")
    .select("*, plans(*)")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
export async function purchasePlan(userId: string, planId: number) {
  const profile = await assertNotBlocked(userId);

  if (!Number.isInteger(planId) || planId <= 0) {
    throw new Error("Plano inválido.");
  }

  const { data: plan, error: planError } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", planId)
    .eq("active", true)
    .maybeSingle();

  if (planError) {
    throw new Error(planError.message);
  }

  if (!plan) {
    throw new Error("Este plano não está disponível.");
  }

  const price = Number(plan.price);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("O preço deste plano é inválido.");
  }

  const currentBalance = Number(profile.balance ?? 0);

  if (!Number.isFinite(currentBalance)) {
    throw new Error("Não foi possível verificar o seu saldo.");
  }

  if (currentBalance < price) {
    throw new Error(
      `Saldo insuficiente. O ${plan.name} custa ${price} MZN e o seu saldo actual é ${currentBalance} MZN. Deposite ou recarregue o seu saldo para comprar este plano.`,
    );
  }

  /*
   * O débito é feito no servidor através do apply_ledger.
   * Não confiamos apenas na verificação de saldo feita pela interface.
   */
  const purchaseReference = `PLAN-${plan.id}-${userId}-${Date.now()}`;

  await ledger(
    userId,
    "PLAN_PURCHASE",
    -price,
    purchaseReference,
    `Compra do plano ${plan.name} — -${price} MZN`,
  );

  try {
    const start = todayMaputo();

    const durationDays = Number(plan.duration_days);

    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      throw new Error("A duração deste plano é inválida.");
    }

    const end = new Date(
      new Date(`${start}T00:00:00Z`).getTime() +
        durationDays * 86400000,
    )
      .toISOString()
      .slice(0, 10);

    /*
     * Activamos primeiro o novo plano.
     * O plano anterior será marcado como REPLACED depois.
     */
    const { data: newPlan, error: insertError } = await supabaseAdmin
      .from("user_plans")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        start_date: start,
        end_date: end,
        status: "ACTIVE",
      })
      .select("id")
      .single();

    if (insertError || !newPlan) {
      throw new Error(
        insertError?.message ?? "Não foi possível activar o plano.",
      );
    }

    /*
     * Se o utilizador já tinha outro plano activo,
     * ele passa para REPLACED.
     */
    const { error: replaceError } = await supabaseAdmin
      .from("user_plans")
      .update({ status: "REPLACED" })
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .neq("id", newPlan.id);

    if (replaceError) {
      /*
       * Se não conseguimos substituir o plano anterior,
       * removemos o novo plano e fazemos o estorno.
       */
      await supabaseAdmin
        .from("user_plans")
        .delete()
        .eq("id", newPlan.id);

      throw new Error(replaceError.message);
    }

    /*
     * Lemos novamente o saldo depois da compra.
     * Assim a resposta enviada à página contém o saldo actual.
     */
    const { data: updatedProfile, error: balanceError } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .maybeSingle();

    if (balanceError) {
      throw new Error(balanceError.message);
    }

    const newBalance = Number(updatedProfile?.balance ?? 0);

    await notify(
      userId,
      "🎉 Plano comprado com sucesso!",
      `O seu ${plan.name} foi activado até ${end}. Foram descontados ${price} MZN do seu saldo. Saldo actual: ${newBalance} MZN.`,
    );

    return {
      ok: true as const,
      planId: plan.id,
      planName: plan.name,
      amount: price,
      balance: newBalance,
      startDate: start,
      endDate: end,
    };
  } catch (error) {
    /*
     * Se a activação falhar depois do débito,
     * tentamos devolver o dinheiro através do ledger.
     */
    try {
      await ledger(
        userId,
        "PLAN_PURCHASE_REFUND",
        price,
        `PLAN-REFUND-${plan.id}-${Date.now()}`,
        `Estorno da compra do ${plan.name} devido a falha na activação.`,
      );
    } catch (refundError) {
      console.error(
        "Falha crítica ao estornar compra do plano:",
        refundError,
      );
    }

    throw error instanceof Error
      ? error
      : new Error("Não foi possível concluir a compra do plano.");
  }
}

export async function removeUserPlan(
  adminId: string,
  userId: string,
) {
  await assertAdmin(adminId);

  if (!userId) {
    throw new Error("Utilizador inválido.");
  }

  const { data: activePlan, error: findError } = await supabaseAdmin
    .from("user_plans")
    .select("id, user_id, plan_id, status")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  if (!activePlan) {
    throw new Error("Este utilizador não possui um plano ativo.");
  }

  const { error: updateError } = await supabaseAdmin
    .from("user_plans")
    .update({
      status: "REPLACED",
    })
    .eq("id", activePlan.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await logAdmin(
    adminId,
    "REMOVE_USER_PLAN",
    userId,
    null,
    "Plano retirado/desativado pelo administrador",
    "SUCCESS",
  );

  await notify(
    userId,
    "Plano desativado",
    "O seu plano foi desativado pelo administrador. A sua conta está sem plano ativo.",
  );

  return {
    success: true,
    message: "Plano retirado com sucesso.",
  };
}

/* ------------------------- Operações do utilizador ------------------------- */

export async function submitDeposit(
  userId: string,
  input: { planId: number; senderNumber: string; transactionId: string; proofPath: string | null },
) {
  await assertNotBlocked(userId);
  const { data: plan, error: planError } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("id", input.planId)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new Error("Plano inválido.");

  const { count } = await supabaseAdmin
    .from("deposit_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "PENDING");
  if ((count ?? 0) > 0) throw new Error("Já tem um pedido de depósito em análise.");

  const { error } = await supabaseAdmin.from("deposit_requests").insert({
    user_id: userId,
    plan_id: plan.id,
    amount: plan.price,
    sender_number: input.senderNumber.trim(),
    transaction_id: input.transactionId.trim(),
    proof_path: input.proofPath,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function requestWithdrawal(userId: string, amount: number) {
  const profile = await assertNotBlocked(userId);
  if (!Number.isFinite(amount)) throw new Error("Valor inválido.");
  if (amount < 125) throw new Error("O valor mínimo de saque é 125 MZN.");
  if (amount > 18000) throw new Error("O valor máximo de saque é 18.000 MZN.");

  const plan = await getActivePlan(userId);
  if (!plan) throw new Error("❌ Você não possui um plano ativo.");
  if (Number(profile.balance) < amount) throw new Error("❌ Saldo insuficiente.");

  const { count } = await supabaseAdmin
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "PENDING");
  if ((count ?? 0) > 0) throw new Error("Já tem um pedido de saque em análise.");

  const fee = Math.round(amount * WITHDRAWAL_FEE_RATE * 100) / 100;
  const net = Math.round((amount - fee) * 100) / 100;
  const reference = `REF${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { error } = await supabaseAdmin.from("withdrawals").insert({
    user_id: userId,
    amount,
    fee,
    net_amount: net,
    phone: profile.wallet_number || profile.phone,
    reference,
  });
  if (error) throw new Error(error.message);
  return { reference, fee, net };
}

export async function submitAffiliate(userId: string, type: string, url: string) {
  await assertNotBlocked(userId);
  const reward = AFFILIATE_REWARDS[type];
  if (!reward) throw new Error("Tipo inválido.");
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith("http")) throw new Error("bad");
  } catch {
    throw new Error("Link inválido. Cole um URL completo (https://...).");
  }
  const { error } = await supabaseAdmin
    .from("affiliate_submissions")
    .insert({ user_id: userId, type, url: url.trim(), reward });
  if (error) {
    if (error.code === "23505") throw new Error("Este link já foi submetido.");
    throw new Error(error.message);
  }
  return { ok: true as const };
}

export async function createDonation(userId: string, amount: number) {
  const profile = await assertNotBlocked(userId);
  if (!Number.isFinite(amount) || amount < 100) throw new Error("A doação mínima é 100 MZN.");
  if (Number(profile.balance) < amount) throw new Error("Saldo insuficiente para esta doação.");




  const returnAmount = Math.round(amount * 1.15 * 100) / 100;
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("donations")
    .insert({ user_id: userId, principal: amount, return_rate: 0.15, return_amount: returnAmount, end_date: end })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  try {
    await ledger(userId, "DONATION_DEBIT", -amount, `DON-${data.id}`, "Doação à empresa");
  } catch (e) {
    await supabaseAdmin.from("donations").delete().eq("id", data.id);
    throw e;
  }
  return { id: data.id, returnAmount, endDate: end };
}

export async function openTicket(userId: string, subject: string, message: string) {
  await assertNotBlocked(userId);
  if (!subject.trim() || !message.trim()) throw new Error("Preencha o assunto e a mensagem.");
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({ user_id: userId, subject: subject.trim() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: msgError } = await supabaseAdmin
    .from("support_messages")
    .insert({ ticket_id: data.id, sender_id: userId, is_admin: false, message: message.trim() });
  if (msgError) throw new Error(msgError.message);
  return { id: data.id };
}

export async function replyTicket(userId: string, ticketId: string, message: string, isAdmin: boolean) {
  if (!message.trim()) throw new Error("Escreva uma mensagem.");
  if (!isAdmin) {
    const { data } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .eq("id", ticketId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) throw new Error("Ticket não encontrado.");
  }
  const { error } = await supabaseAdmin
    .from("support_messages")
    .insert({ ticket_id: ticketId, sender_id: userId, is_admin: isAdmin, message: message.trim() });
  if (error) throw new Error(error.message);
  await supabaseAdmin
    .from("support_tickets")
    .update({ status: isAdmin ? "IN_PROGRESS" : "OPEN", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (isAdmin) {
    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("user_id, subject")
      .eq("id", ticketId)
      .maybeSingle();
    if (ticket) await notify(ticket.user_id, "📞 Resposta do suporte", `Assunto: ${ticket.subject}`);
  }
  return { ok: true as const };
}

export async function syncAccount() {
  await supabaseAdmin.rpc("process_due_donations");
  await supabaseAdmin.rpc("expire_plans");
  return { ok: true as const };
}

/* --------------------------- Operações do admin --------------------------- */

export async function reviewDeposit(adminId: string, depositId: string, approve: boolean) {
  await assertAdmin(adminId);
  const { data: deposit, error } = await supabaseAdmin
    .from("deposit_requests")
    .update({
      status: approve ? "APPROVED" : "REJECTED",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq("id", depositId)
    .eq("status", "PENDING")
    .select("*, plans(*)")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!deposit) throw new Error("Pedido já foi processado.");

  if (!approve) {
    await notify(deposit.user_id, "❌ Depósito rejeitado", "O seu comprovativo não foi aceite. Contacte o suporte.");
    await logAdmin(adminId, "REJECT_DEPOSIT", deposit.user_id, Number(deposit.amount), null, "REJECTED");
    return { ok: true as const };
  }

  const plan = deposit.plans as { id: number; name: string; price: number; duration_days: number };
  const start = todayMaputo();
  const end = new Date(new Date(`${start}T00:00:00Z`).getTime() + plan.duration_days * 86400000)
    .toISOString()
    .slice(0, 10);

  await supabaseAdmin
    .from("user_plans")
    .update({ status: "REPLACED" })
    .eq("user_id", deposit.user_id)
    .eq("status", "ACTIVE");

  const { error: planError } = await supabaseAdmin.from("user_plans").insert({
    user_id: deposit.user_id,
    plan_id: plan.id,
    start_date: start,
    end_date: end,
    status: "ACTIVE",
  });
  if (planError) throw new Error(planError.message);

  await notify(
    deposit.user_id,
    "🎉 Plano aprovado!",
    `O seu plano ${plan.name} está ativo até ${end}. Já pode realizar as tarefas.`,
  );

  // Bónus automático de primeiro plano (apenas na primeira aprovação do utilizador)
  const { count: approvedBefore } = await supabaseAdmin
    .from("deposit_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", deposit.user_id)
    .eq("status", "APPROVED")
    .neq("id", deposit.id);
  if ((approvedBefore ?? 0) === 0) {
    const { data: alreadyPaid } = await supabaseAdmin
      .from("ledger_transactions")
      .select("id")
      .eq("user_id", deposit.user_id)
      .eq("type", "FIRST_PLAN_BONUS")
      .limit(1)
      .maybeSingle();
    if (!alreadyPaid) {
      await ledger(
        deposit.user_id,
        "FIRST_PLAN_BONUS",
        FIRST_PLAN_BONUS,
        `FIRST-PLAN-${deposit.id}`,
        `Bónus de primeiro plano — +${FIRST_PLAN_BONUS} MZN`,
      );
      await notify(
        deposit.user_id,
        "🎁 Bónus de primeiro plano",
        `Parabéns! Recebeu ${FIRST_PLAN_BONUS} MZN de bónus por ativar o seu primeiro plano. O valor já está no seu saldo.`,
      );
    }
  }

  await payReferralReward(deposit.user_id, Number(plan.price));
  await logAdmin(adminId, "APPROVE_DEPOSIT", deposit.user_id, Number(deposit.amount), null, "APPROVED");
  return { ok: true as const };
}

async function payReferralReward(userId: string, planPrice: number) {
  const { data: referral } = await supabaseAdmin
    .from("referrals")
    .select("*")
    .eq("referred_id", userId)
    .eq("rewarded", false)
    .maybeSingle();
  if (!referral) return;

  const { count } = await supabaseAdmin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referral.referrer_id)
    .eq("rewarded", true);

  const level = levelFor(count ?? 0);
  const reward = Math.round(planPrice * level.pct * 100) / 100;

  const { data: updated } = await supabaseAdmin
    .from("referrals")
    .update({ rewarded: true, reward_amount: reward })
    .eq("id", referral.id)
    .eq("rewarded", false)
    .select("id")
    .maybeSingle();
  if (!updated) return;

  await ledger(referral.referrer_id, "REFERRAL_REWARD", reward, `REF-${referral.id}`, `Bónus de indicação (Nível ${level.level})`);
  await notify(referral.referrer_id, "🎁 Bónus de indicação", `Recebeu ${reward} MZN pela sua indicação.`);
}

export async function reviewWithdrawal(adminId: string, withdrawalId: string, approve: boolean) {
  await assertAdmin(adminId);
  const { data: pending } = await supabaseAdmin
    .from("withdrawals")
    .select("*")
    .eq("id", withdrawalId)
    .eq("status", "PENDING")
    .maybeSingle();
  if (!pending) throw new Error("Pedido já foi processado.");

  if (approve) {
    await ledger(pending.user_id, "WITHDRAWAL", -Number(pending.amount), pending.reference, `Saque aprovado ${pending.reference}`);
  }

  const { data: updated } = await supabaseAdmin
    .from("withdrawals")
    .update({
      status: approve ? "APPROVED" : "REJECTED",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq("id", withdrawalId)
    .eq("status", "PENDING")
    .select("id")
    .maybeSingle();
  if (!updated) throw new Error("Pedido já foi processado.");

  await notify(
    pending.user_id,
    approve ? "💸 Saque aprovado" : "❌ Saque rejeitado",
    `Referência ${pending.reference} — ${Number(pending.amount)} MZN`,
  );
  await logAdmin(
    adminId,
    approve ? "APPROVE_WITHDRAWAL" : "REJECT_WITHDRAWAL",
    pending.user_id,
    Number(pending.amount),
    null,
    approve ? "APPROVED" : "REJECTED",
  );
  return { ok: true as const };
}

export async function reviewAffiliate(adminId: string, submissionId: string, approve: boolean) {
  await assertAdmin(adminId);
  const { data: updated } = await supabaseAdmin
    .from("affiliate_submissions")
    .update({
      status: approve ? "APPROVED" : "REJECTED",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq("id", submissionId)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();
  if (!updated) throw new Error("Pedido já foi processado.");

  if (approve) {
    const reward = AFFILIATE_REWARDS[updated.type] ?? 0;
    await ledger(updated.user_id, "AFFILIATE_REWARD", reward, `AFF-${updated.id}`, `Recompensa de afiliado (${updated.type})`);
    await notify(updated.user_id, "🤝 Afiliado aprovado", `Recebeu ${reward} MZN pela sua publicação.`);
  } else {
    await notify(updated.user_id, "❌ Afiliado rejeitado", "O conteúdo submetido não foi aceite.");
  }
  await logAdmin(
    adminId,
    approve ? "APPROVE_AFFILIATE" : "REJECT_AFFILIATE",
    updated.user_id,
    Number(updated.reward),
    null,
    approve ? "APPROVED" : "REJECTED",
  );
  return { ok: true as const };
}

export async function adjustBalance(adminId: string, userId: string, amount: number, reason: string) {
  await assertAdmin(adminId);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Informe um valor diferente de zero.");
  if (!reason.trim()) throw new Error("Informe o motivo.");
  await ledger(
    userId,
    amount > 0 ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
    amount,
    `ADM-${Date.now()}`,
    `Ajuste administrativo: ${reason.trim()}`,
  );
  await notify(
    userId,
    amount > 0 ? "📈 Saldo creditado" : "📉 Saldo ajustado",
    `${amount > 0 ? "+" : ""}${amount} MZN — ${reason.trim()}`,
  );
  await logAdmin(adminId, "ADJUST_BALANCE", userId, amount, reason.trim(), "OK");
  return { ok: true as const };
}

export async function setBlocked(adminId: string, userId: string, blocked: boolean) {
  await assertAdmin(adminId);
  const { error } = await supabaseAdmin.from("profiles").update({ blocked }).eq("id", userId);
  if (error) throw new Error(error.message);
  await notify(
    userId,
    blocked ? "🚫 Conta bloqueada" : "🔓 Conta desbloqueada",
    blocked ? "A sua conta foi bloqueada. Contacte o suporte." : "A sua conta foi reativada.",
  );
  await logAdmin(adminId, blocked ? "BLOCK_USER" : "UNBLOCK_USER", userId, null, null, "OK");
  return { ok: true as const };
}

export async function updateUserProfile(
  adminId: string,
  userId: string,
  fields: { full_name: string; phone: string; wallet_number: string; province: string; district: string },
) {
  await assertAdmin(adminId);
  const { error } = await supabaseAdmin.from("profiles").update(fields).eq("id", userId);
  if (error) throw new Error(error.message);
  await logAdmin(adminId, "UPDATE_PROFILE", userId, null, null, "OK");
  return { ok: true as const };
}

export async function broadcast(adminId: string, title: string, body: string, onlyBlocked: boolean) {
  await assertAdmin(adminId);
  if (!title.trim()) throw new Error("Escreva um título.");
  let query = supabaseAdmin.from("profiles").select("id");
  if (onlyBlocked) query = query.eq("blocked", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((p) => ({ user_id: p.id, title: title.trim(), body: body.trim() }));
  if (rows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("notifications").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }
  await logAdmin(adminId, "BROADCAST", null, null, title.trim(), `${rows.length} utilizadores`);
  return { sent: rows.length };
}

export async function saveSettings(adminId: string, values: Record<string, string>) {
  await assertAdmin(adminId);
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value.trim(),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
  await logAdmin(adminId, "UPDATE_SETTINGS", null, null, Object.keys(values).join(","), "OK");
  return { ok: true as const };
}

export async function setTicketStatus(adminId: string, ticketId: string, status: string) {
  await assertAdmin(adminId);
  const { error } = await supabaseAdmin
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) throw new Error(error.message);
  await logAdmin(adminId, "TICKET_STATUS", null, null, status, ticketId);
  return { ok: true as const };
}

export async function proofUrl(adminId: string, path: string) {
  await assertAdmin(adminId);
  const { data, error } = await supabaseAdmin.storage.from("proofs").createSignedUrl(path, 600);
  if (error) throw new Error(error.message);
  return { url: data.signedUrl };
}

export async function requestPasswordReset(identifier: string) {
  const raw = identifier.trim();
  const isEmail = raw.includes("@");
  let query = supabaseAdmin.from("profiles").select("email, phone");

  if (isEmail) {
    query = query.ilike("email", raw);
  } else {
    // Normalize phone: keep digits only, drop 258 country prefix
    const digits = raw.replace(/\D/g, "").replace(/^258/, "");
    query = query.or(
      `phone.eq.${digits},phone.eq.258${digits},phone.eq.+258${digits},phone.eq.+258 ${digits},phone.ilike.%${digits}`,
    );
  }

  const { data: rows } = await query.limit(1);
  const profile = rows?.[0];
  if (!profile?.email) throw new Error("Utilizador não encontrado.");


  // Supabase auth reset password works by email. 
  // For phone-only users, we might need a different provider or OTP, 
  // but the prompt mentions "enviaremos um código automaticamente ao email".
  // So we always send to the profile's email.
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${process.env['VITE_APP_URL'] || 'http://localhost:8080'}/auth?mode=reset-password`,
  });

  if (error) throw new Error("Erro ao enviar código de recuperação.");
  return { ok: true, method: isEmail ? "EMAIL" : "SMS" };
}

export async function resetPassword(password: string) {
  // This is actually handled by Supabase directly on the client if redirected, 
  // but we keep the wrapper if needed for custom logic.
  const { error } = await supabaseAdmin.auth.updateUser({
    password: password,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminChangeUserPassword(
  adminId: string,
  userId: string,
  newPassword: string,
) {
  await assertAdmin(adminId);

  const cleanUserId = userId.trim();
  const password = newPassword.trim();

  if (!cleanUserId) {
    throw new Error("Utilizador inválido.");
  }

  if (!password) {
    throw new Error("Informe a nova palavra-passe.");
  }

  if (password.length < 8) {
    throw new Error("A palavra-passe deve ter pelo menos 8 caracteres.");
  }

  if (password.length > 72) {
    throw new Error("A palavra-passe é demasiado longa.");
  }

  // Confirmamos que o utilizador existe no perfil da plataforma.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, phone, public_id")
    .eq("id", cleanUserId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("Utilizador não encontrado.");
  }

  // A alteração da palavra-passe é feita exclusivamente no servidor.
  const { error: authError } =
    await supabaseAdmin.auth.admin.updateUserById(cleanUserId, {
      password,
    });

  if (authError) {
    throw new Error(
      authError.message || "Não foi possível alterar a palavra-passe.",
    );
  }

  // Registamos a alteração no histórico administrativo.
  await logAdmin(
    adminId,
    "ADMIN_CHANGE_PASSWORD",
    cleanUserId,
    null,
    "Palavra-passe alterada pelo administrador.",
    "OK",
  );

  // Notificação para o utilizador.
  await notify(
    cleanUserId,
    "🔐 Palavra-passe alterada",
    "A sua palavra-passe foi alterada pelo administrador. Se não solicitou esta alteração, contacte o suporte.",
  );

  return {
    ok: true as const,
    userId: cleanUserId,
    name: profile.full_name,
    publicId: profile.public_id,
  };
}

/* ------------------------------ Planos (admin) ----------------------------- */

export async function updatePlan(
  adminId: string,
  planId: number,
  fields: { name: string; price: number; daily_task_count: number; daily_income: number; duration_days: number; active: boolean },
) {
  await assertAdmin(adminId);
  const name = fields.name.trim();
  if (!name) throw new Error("Informe o nome do plano.");
  const nums = [fields.price, fields.daily_task_count, fields.daily_income, fields.duration_days];
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) throw new Error("Valores inválidos: não são permitidos negativos.");
  if (fields.daily_task_count <= 0 || fields.duration_days <= 0) throw new Error("Tarefas por dia e duração devem ser maiores que zero.");

  const { data: before } = await supabaseAdmin.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!before) throw new Error("Plano não encontrado.");

  const { data, error } = await supabaseAdmin
    .from("plans")
    .update({
      name,
      price: fields.price,
      daily_task_count: fields.daily_task_count,
      daily_income: fields.daily_income,
      duration_days: fields.duration_days,
      active: fields.active,
    })
    .eq("id", planId)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Já existe um plano com esse nome.");
    throw new Error(error.message);
  }
  await logAdmin(
    adminId,
    "UPDATE_PLAN",
    null,
    Number(data.price),
    `Plano #${planId} (${before.name} → ${data.name}) preço ${before.price}→${data.price}, diário ${before.daily_income}→${data.daily_income}, dias ${before.duration_days}→${data.duration_days}, ativo ${before.active}→${data.active}`,
    "OK",
  );
  return data;
}

/* --------------------------- Recarga secreta --------------------------- */

function randomPromoCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `RI-${body.slice(0, 5)}-${body.slice(5)}`;
}

export async function createPromoCode(adminId: string, input: { bonus?: number; maxUses?: number; validityMinutes?: number }) {
  await assertAdmin(adminId);
  const bonus = Number(input.bonus ?? PROMO_DEFAULT_BONUS);
  const maxUses = Math.floor(Number(input.maxUses ?? 1));
  const validityMinutes = Math.floor(Number(input.validityMinutes ?? 60));
  if (!Number.isFinite(bonus) || bonus <= 0) throw new Error("O bónus deve ser maior que zero.");
  if (!Number.isFinite(maxUses) || maxUses <= 0) throw new Error("A quantidade de utilizações deve ser maior que zero.");
  if (!Number.isFinite(validityMinutes) || validityMinutes <= 0 || validityMinutes > 60 * 24 * 30)
    throw new Error("Validade inválida.");

  const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomPromoCode();
    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .insert({ code, bonus, max_uses: maxUses, expires_at: expiresAt, created_by: adminId })
      .select("*")
      .single();
    if (!error) {
      await logAdmin(adminId, "CREATE_PROMO_CODE", null, bonus, `Código ${code} · ${maxUses} usos · expira ${expiresAt}`, data.id);
      return data;
    }
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Não foi possível gerar um código único. Tente novamente.");
}

export async function setPromoCodeActive(adminId: string, codeId: string, active: boolean) {
  await assertAdmin(adminId);
  const { data, error } = await supabaseAdmin
    .from("promo_codes")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", codeId)
    .select("code")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Código não encontrado.");
  await logAdmin(adminId, active ? "ACTIVATE_PROMO_CODE" : "DEACTIVATE_PROMO_CODE", null, null, `Código ${data.code}`, codeId);
  return { ok: true as const };
}

export async function redeemPromoCode(
  userClient: SupabaseClient<Database>,
  userId: string,
  code: string,
  ipHash: string | null,
) {
  await assertNotBlocked(userId);
  const clean = code.trim().toUpperCase();
  if (!clean) throw new Error("Introduza o código.");

  // A função SQL é transacional e valida expiração/duplicação no servidor usando auth.uid() do token do utilizador.
  const { data, error } = await userClient.rpc("redeem_promo_code", ipHash ? { _code: clean, _ip_hash: ipHash } : { _code: clean });
  if (error) throw new Error(error.message || "Não foi possível resgatar o código.");
  return data as { balance: number; bonus: number };
}

// ===== PARTILHA E GANHA =====
export const SHARE_REWARD_AMOUNT = 40;
export const SHARE_REWARD_VALIDITY_MS = 3 * 60 * 60 * 1000;

export async function grantShareReward(adminId: string, publicId: string) {
  await assertAdmin(adminId);
  const clean = publicId.trim().toUpperCase();
  if (!clean) throw new Error("Introduza o ID do utilizador.");

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, public_id, blocked")
    .eq("public_id", clean)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("ID não encontrado. Verifique o ID do utilizador.");
  if (profile.blocked) throw new Error("Este utilizador está bloqueado.");

  // Dia calculado no servidor (fuso de Maputo) — nunca pelo dispositivo.
  const rewardDate = todayMaputo();
  const expiresAt = new Date(Date.now() + SHARE_REWARD_VALIDITY_MS).toISOString();

  const { data: reward, error: insErr } = await supabaseAdmin
    .from("share_rewards")
    .insert({
      user_id: profile.id,
      amount: SHARE_REWARD_AMOUNT,
      reward_date: rewardDate,
      expires_at: expiresAt,
      granted_by: adminId,
    })
    .select("id, expires_at")
    .single();
  if (insErr) {
    if (insErr.code === "23505") throw new Error(`O ID ${clean} já foi usado hoje. Cada ID só pode ser usado 1 vez por dia.`);
    throw new Error(insErr.message);
  }

  await notify(
    profile.id,
    "PARTILHA E GANHA",
    `Tem ${SHARE_REWARD_AMOUNT} MZN para reivindicar! Clique em "Reivindicar" nas Notificações dentro de 3 horas. Após esse prazo o bónus expira.`,
  );
  await logAdmin(adminId, "SHARE_REWARD", profile.id, SHARE_REWARD_AMOUNT, `ID ${clean}`, reward.id);
  return { ok: true as const, name: profile.full_name, publicId: clean, expiresAt: reward.expires_at };
}

export async function claimShareReward(userClient: SupabaseClient<Database>, userId: string, rewardId: string) {
  await assertNotBlocked(userId);
  const { data, error } = await userClient.rpc("claim_share_reward", { _reward_id: rewardId });
  if (error) throw new Error(error.message || "Não foi possível reivindicar o bónus.");
  return data as { balance: number; amount: number };
}

/* ---------------------------- Roleta da sorte ---------------------------- */

export const ROULETTE_COST = 5

export const ROULETTE_SEGMENTS = [
  2,
  5,
  10,
  20,
  30,
  50,
  100,
  150,
]

export const ROULETTE_SCRIPTED = [
  2,
  2,
  2,
  2,
  2,
  2,
  5,
]

const ROULETTE_CYCLE_SIZE = 5000
let rouletteGlobalCounter = 0

function roulettePrizeFor(globalSpinIndex: number): number {
  // Primeiras 7 jogadas de cada ciclo global de 5000
  if (globalSpinIndex <= ROULETTE_SCRIPTED.length) {
    return ROULETTE_SCRIPTED[globalSpinIndex - 1]!
  }

  // Da jogada 8 até à jogada 5000
  return 2
}

export async function spinRoulette(userId: string) {
  const profile = await assertNotBlocked(userId)

  if (Number(profile.balance) < ROULETTE_COST) {
    throw new Error(
      `Saldo insuficiente. Precisa de ${ROULETTE_COST} MZN para girar.`
    )
  }

  rouletteGlobalCounter += 1

  const globalSpinIndex =
    ((rouletteGlobalCounter - 1) % ROULETTE_CYCLE_SIZE) + 1

  await ledger(
    userId,
    "GAME_SPIN",
    -ROULETTE_COST,
    `SPIN-${userId}-${globalSpinIndex}`,
    "Roleta da sorte - giro"
  )

  const prize = roulettePrizeFor(globalSpinIndex)

  const multiplier = prize >= 150 ? 2 : 1

  const segmentValue = prize / multiplier

  const segmentIndex = Math.max(
    0,
    ROULETTE_SEGMENTS.indexOf(segmentValue)
  )

  await supabaseAdmin
    .from("roulette_spins")
    .insert({
      user_id: userId,
      cost: ROULETTE_COST,
      prize,
      spin_index: globalSpinIndex,
    })

  let balance =
    Number(profile.balance) - ROULETTE_COST

  if (prize > 0) {
    await ledger(
      userId,
      "GAME_WIN",
      prize,
      `WIN-${userId}-${globalSpinIndex}`,
      `Roleta da sorte - ganhou ${prize} MZN`
    )

    balance += prize
  }

  return {
    prize,
    segmentIndex,
    multiplier,
    spinIndex: globalSpinIndex,
    balance,
  }
}

export async function rouletteFeed() {
  const { data: spins } = await supabaseAdmin
    .from("roulette_spins")
    .select("id, user_id, prize, created_at")
    .gt("prize", 0)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = spins ?? [];
  if (rows.length === 0) return [] as { id: string; publicId: string; prize: number; createdAt: string }[];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, public_id")
    .in("id", Array.from(new Set(rows.map((r) => r.user_id))));
  const map = new Map((profiles ?? []).map((p) => [p.id, p.public_id]));
  return rows.map((r) => ({
    id: r.id,
    publicId: map.get(r.user_id) ?? "RI-*****",
    prize: Number(r.prize),
    createdAt: r.created_at,
  }));
}

// ============================================================
// USDT TRC20
// ============================================================

const USDT_TRC20_CONTRACT =
  "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const TRONGRID_BASE_URL =
  "https://api.trongrid.io";

type UsdtSettings = {
  network: string;
  symbol: string;
  deposit_address: string;
  withdrawal_enabled: boolean;
  deposit_enabled: boolean;
  usdt_mzn_rate: number;
  min_deposit_usdt: number;
  min_withdrawal_usdt: number;
};

function normalizeTronAddress(value: string) {
  return String(value ?? "").trim();
}

function isValidTronAddress(value: string) {
  const address = normalizeTronAddress(value);

  // Endereços TRON em formato Base58 normalmente começam com T
  // e possuem 34 caracteres.
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
}

async function getUsdtSettingsInternal(): Promise<UsdtSettings> {
  const { data, error } = await supabaseAdmin
    .from("usdt_settings")
    .select(
      "network,symbol,deposit_address,withdrawal_enabled,deposit_enabled,usdt_mzn_rate,min_deposit_usdt,min_withdrawal_usdt",
    )
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível carregar as configurações USDT: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "Configuração USDT não encontrada.",
    );
  }

  return {
    network: String(data.network ?? "TRC20"),
    symbol: String(data.symbol ?? "USDT"),
    deposit_address: String(data.deposit_address ?? ""),
    withdrawal_enabled: Boolean(data.withdrawal_enabled),
    deposit_enabled: Boolean(data.deposit_enabled),
    usdt_mzn_rate: Number(data.usdt_mzn_rate ?? 0),
    min_deposit_usdt: Number(data.min_deposit_usdt ?? 1),
    min_withdrawal_usdt: Number(data.min_withdrawal_usdt ?? 1),
  };
}

export async function getUsdtSettings(userId: string) {
  await assertNotBlocked(userId);

  const settings = await getUsdtSettingsInternal();

  return {
    network: settings.network,
    symbol: settings.symbol,
    depositAddress: settings.deposit_address,
    depositEnabled: settings.deposit_enabled,
    withdrawalEnabled: settings.withdrawal_enabled,
    usdtMznRate: settings.usdt_mzn_rate,
    minDepositUsdt: settings.min_deposit_usdt,
    minWithdrawalUsdt: settings.min_withdrawal_usdt,
  };
}

async function getTrc20Transfers(
  address: string,
  txid?: string,
) {
  const apiKey =
    process.env.TRON_PRO_API_KEY?.trim() || "";

  const params = new URLSearchParams();

  params.set("only_confirmed", "true");
  params.set("limit", "200");
  params.set(
    "contract_address",
    USDT_TRC20_CONTRACT,
  );
  params.set("only_to", "true");

  if (txid) {
    // O endpoint é consultado pelo histórico do endereço.
    // O TXID será comparado localmente para evitar aceitar
    // uma transferência diferente.
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey) {
    headers["TRON-PRO-API-KEY"] = apiKey;
  }

  const response = await fetch(
    `${TRONGRID_BASE_URL}/v1/accounts/${encodeURIComponent(
      address,
    )}/transactions/trc20?${params.toString()}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Erro ao consultar a rede TRON: HTTP ${response.status}`,
    );
  }

  const json = await response.json();

  return Array.isArray(json?.data)
    ? json.data
    : [];
}

function parseUsdtAmount(rawValue: unknown) {
  const value = Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  /*
   * USDT TRC20 usa normalmente 6 casas decimais.
   * O TronGrid pode devolver o valor já formatado,
   * por isso primeiro tratamos o valor recebido como decimal.
   */
  return value;
}

export async function createUsdtDeposit(
  userId: string,
  txid: string,
) {
  await assertNotBlocked(userId);

  const cleanTxid = String(txid ?? "").trim();

  if (!cleanTxid) {
    throw new Error(
      "Informe o TXID da transferência USDT.",
    );
  }

  if (cleanTxid.length < 20) {
    throw new Error(
      "O TXID informado não parece ser válido.",
    );
  }

  const settings = await getUsdtSettingsInternal();

  if (!settings.deposit_enabled) {
    throw new Error(
      "Os depósitos USDT TRC20 estão temporariamente desativados.",
    );
  }

  if (settings.network !== "TRC20") {
    throw new Error(
      "A configuração atual de pagamentos não está definida como TRC20.",
    );
  }

  if (settings.symbol !== "USDT") {
    throw new Error(
      "A configuração atual de pagamentos não está definida como USDT.",
    );
  }

  if (!settings.deposit_address) {
    throw new Error(
      "A carteira de recebimento USDT ainda não foi configurada.",
    );
  }

  if (!isValidTronAddress(settings.deposit_address)) {
    throw new Error(
      "A carteira de recebimento USDT não possui um endereço TRON válido.",
    );
  }

  if (
    !Number.isFinite(settings.usdt_mzn_rate) ||
    settings.usdt_mzn_rate <= 0
  ) {
    throw new Error(
      "A taxa USDT/MZN ainda não foi configurada.",
    );
  }

  // Impede reutilização do mesmo TXID.
  const { data: existingTx, error: existingError } =
    await supabaseAdmin
      .from("usdt_deposits")
      .select("id,status,user_id")
      .eq("txid", cleanTxid)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `Erro ao verificar TXID: ${existingError.message}`,
    );
  }

  if (existingTx) {
    throw new Error(
      "Este TXID já foi utilizado ou já está em processamento.",
    );
  }

  const transfers = await getTrc20Transfers(
    settings.deposit_address,
    cleanTxid,
  );

  const transfer = transfers.find(
    (item: any) =>
      String(item?.transaction_id ?? "") === cleanTxid &&
      String(item?.to ?? "").trim() ===
        settings.deposit_address,
  );

  if (!transfer) {
    throw new Error(
      "Não encontramos uma transferência USDT TRC20 confirmada para este TXID e esta carteira.",
    );
  }

  const tokenAddress = String(
    transfer?.token_info?.address ??
      transfer?.contract_address ??
      "",
  ).trim();

  if (
    tokenAddress &&
    tokenAddress !== USDT_TRC20_CONTRACT
  ) {
    throw new Error(
      "A transação encontrada não corresponde ao contrato USDT TRC20 esperado.",
    );
  }

  const amountUsdt = parseUsdtAmount(
    transfer?.value,
  );

  if (
    !Number.isFinite(amountUsdt) ||
    amountUsdt <= 0
  ) {
    throw new Error(
      "Não foi possível determinar o valor USDT da transferência.",
    );
  }

  if (
    amountUsdt < settings.min_deposit_usdt
  ) {
    throw new Error(
      `O depósito mínimo é ${settings.min_deposit_usdt} USDT.`,
    );
  }

  const amountMzn = Number(
    (amountUsdt * settings.usdt_mzn_rate).toFixed(2),
  );

  if (
    !Number.isFinite(amountMzn) ||
    amountMzn <= 0
  ) {
    throw new Error(
      "Não foi possível calcular o valor em MZN.",
    );
  }

  const senderAddress =
    String(transfer?.from ?? "").trim() || null;

  const recipientAddress =
    String(transfer?.to ?? "").trim() || null;

  const confirmations = Number(
    transfer?.block_timestamp ? 1 : 0,
  );

  const { data: inserted, error: insertError } =
    await supabaseAdmin
      .from("usdt_deposits")
      .insert({
        user_id: userId,
        network: "TRC20",
        token: "USDT",
        deposit_address:
          settings.deposit_address,
        txid: cleanTxid,
        sender_address: senderAddress,
        recipient_address: recipientAddress,
        amount_usdt: amountUsdt,
        exchange_rate: settings.usdt_mzn_rate,
        amount_mzn: amountMzn,
        confirmations,
        status: "CONFIRMED",
        confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

  if (insertError) {
    if (
      insertError.code === "23505"
    ) {
      throw new Error(
        "Este TXID já foi registado por outra operação.",
      );
    }

    throw new Error(
      `Não foi possível registar o depósito USDT: ${insertError.message}`,
    );
  }

  // Crédito através do mesmo ledger utilizado pelo restante sistema.
  await ledger(
    userId,
    "USDT_DEPOSIT",
    amountMzn,
    `USDT-${inserted.id}`,
    `Depósito USDT TRC20 — ${amountUsdt} USDT`,
  );

  const ledgerReference =
    `USDT-${inserted.id}`;

  const { error: updateError } =
    await supabaseAdmin
      .from("usdt_deposits")
      .update({
        status: "CREDITED",
        ledger_reference: ledgerReference,
        credited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id);

  if (updateError) {
    throw new Error(
      `O depósito foi registado, mas não foi possível finalizar o estado: ${updateError.message}`,
    );
  }

  await supabaseAdmin
    .from("usdt_events")
    .insert({
      event_type: "DEPOSIT_CREDITED",
      user_id: userId,
      deposit_id: inserted.id,
      txid: cleanTxid,
      amount_usdt: amountUsdt,
      amount_mzn: amountMzn,
      message:
        `Depósito USDT creditado: ${amountUsdt} USDT → ${amountMzn} MZN`,
    });

  return {
    success: true,
    depositId: inserted.id,
    txid: cleanTxid,
    amountUsdt,
    amountMzn,
    exchangeRate: settings.usdt_mzn_rate,
  };
}

export async function requestUsdtWithdrawal(
  userId: string,
  amountMzn: number,
  destinationAddress: string,
) {
  await assertNotBlocked(userId);

  const settings = await getUsdtSettingsInternal();

  if (!settings.withdrawal_enabled) {
    throw new Error(
      "Os saques USDT TRC20 estão temporariamente desativados.",
    );
  }

  if (settings.network !== "TRC20") {
    throw new Error(
      "A rede de saque não está configurada como TRC20.",
    );
  }

  if (settings.symbol !== "USDT") {
    throw new Error(
      "O ativo de saque não está configurado como USDT.",
    );
  }

  const rate = Number(settings.usdt_mzn_rate);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      "A taxa USDT/MZN ainda não foi configurada.",
    );
  }

  const address = normalizeTronAddress(destinationAddress);

  if (!isValidTronAddress(address)) {
    throw new Error(
      "Informe um endereço TRON/TRC20 válido.",
    );
  }

  const amount = Number(amountMzn);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Informe um valor válido em MZN.",
    );
  }

  const amountUsdt = Number(
    (amount / rate).toFixed(6),
  );

  if (
    amountUsdt < Number(settings.min_withdrawal_usdt)
  ) {
    throw new Error(
      `O saque mínimo é ${settings.min_withdrawal_usdt} USDT.`,
    );
  }

  /*
   * Verifica se o utilizador possui um plano ativo.
   */
  const activePlan = await getActivePlan(userId);

  if (!activePlan) {
    throw new Error(
      "É necessário ter um plano ativo para solicitar um saque.",
    );
  }

  /*
   * Verifica se já existe outro saque USDT em processamento.
   */
  const { data: pendingUsdt, error: pendingUsdtError } =
    await supabaseAdmin
      .from("usdt_withdrawals")
      .select("id")
      .eq("user_id", userId)
      .in("status", [
        "PENDING",
        "APPROVED",
        "PROCESSING",
      ])
      .limit(1);

  if (pendingUsdtError) {
    throw new Error(
      `Não foi possível verificar saques USDT pendentes: ${pendingUsdtError.message}`,
    );
  }

  if (pendingUsdt && pendingUsdt.length > 0) {
    throw new Error(
      "Você já possui um saque USDT em processamento.",
    );
  }

  /*
   * Impede que o utilizador tenha simultaneamente
   * um saque MZN pendente e um saque USDT.
   */
  const { data: pendingMzn, error: pendingMznError } =
    await supabaseAdmin
      .from("withdrawals")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .limit(1);

  if (pendingMznError) {
    throw new Error(
      `Não foi possível verificar saques MZN pendentes: ${pendingMznError.message}`,
    );
  }

  if (pendingMzn && pendingMzn.length > 0) {
    throw new Error(
      "Você já possui um saque MZN em processamento.",
    );
  }

  /*
   * Criamos uma referência única para a reserva.
   */
  const reservationReference =
    `USDT-WITHDRAW-${crypto.randomUUID()}`;

  /*
   * PRIMEIRO reservamos o saldo.
   *
   * O valor é debitado do saldo principal através
   * do mesmo ledger utilizado pelo restante da aplicação.
   */
  await ledger(
    userId,
    "USDT_WITHDRAWAL_RESERVE",
    -amount,
    reservationReference,
    `Reserva de saque USDT TRC20 — ${amountUsdt} USDT`,
  );

  try {
    /*
     * Criamos o pedido depois de reservar o saldo.
     */
    const { data: withdrawal, error: insertError } =
      await supabaseAdmin
        .from("usdt_withdrawals")
        .insert({
          user_id: userId,
          network: "TRC20",
          token: "USDT",
          destination_address: address,
          amount_mzn: amount,
          exchange_rate: rate,
          amount_usdt: amountUsdt,
          fee_mzn: 0,
          net_amount_mzn: amount,
          status: "PENDING",
        })
        .select("id")
        .single();

    if (insertError) {
      throw new Error(
        `Não foi possível criar o saque USDT: ${insertError.message}`,
      );
    }

    /*
     * Registamos o evento.
     */
    const { error: eventError } =
      await supabaseAdmin
        .from("usdt_events")
        .insert({
          event_type: "WITHDRAWAL_REQUESTED",
          user_id: userId,
          withdrawal_id: withdrawal.id,
          amount_usdt: amountUsdt,
          amount_mzn: amount,
          message:
            `Pedido de saque USDT TRC20: ${amountUsdt} USDT`,
        });

    if (eventError) {
      console.error(
        "Erro ao registar evento USDT:",
        eventError.message,
      );
    }

    return {
      success: true,
      withdrawalId: withdrawal.id,
      amountMzn: amount,
      amountUsdt,
      exchangeRate: rate,
      destinationAddress: address,
      status: "PENDING",
    };
  } catch (error) {
    /*
     * Se a criação do pedido falhar depois da reserva,
     * devolvemos o saldo ao utilizador.
     */
    await ledger(
      userId,
      "USDT_WITHDRAWAL_REFUND",
      amount,
      reservationReference,
      "Devolução da reserva de saque USDT",
    );

    throw error;
  }
}

// ============================================================
// BINANCE USDT TRC20
// ============================================================

type BinanceSettings = {
  enabled: boolean;
  automatic_withdrawals: boolean;
  asset: string;
  network: string;
  api_configured: boolean;
};

async function getBinanceSettingsInternal(): Promise<BinanceSettings> {
  const { data, error } = await supabaseAdmin
    .from("binance_settings")
    .select(
      "enabled,automatic_withdrawals,asset,network,api_configured",
    )
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível carregar as configurações Binance: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "Configuração Binance não encontrada.",
    );
  }

  return {
    enabled: Boolean(data.enabled),
    automatic_withdrawals: Boolean(
      data.automatic_withdrawals,
    ),
    asset: String(data.asset ?? "USDT"),
    network: String(data.network ?? "TRC20"),
    api_configured: Boolean(data.api_configured),
  };
}


/**
 * Retorna o estado da integração Binance.
 *
 * Esta função NÃO envia dinheiro.
 */
export async function getBinanceSettings(
  userId: string,
) {
  await assertNotBlocked(userId);

  const settings =
    await getBinanceSettingsInternal();

  return {
    enabled: settings.enabled,
    automaticWithdrawals:
      settings.automatic_withdrawals,
    asset: settings.asset,
    network: settings.network,
    apiConfigured:
      settings.api_configured,
  };
}


/**
 * Verifica se a integração está pronta para
 * processar um saque automático.
 *
 * Esta função apenas verifica configuração.
 * Não envia USDT.
 */
async function assertBinanceWithdrawalReady() {
  const settings =
    await getBinanceSettingsInternal();

  if (!settings.enabled) {
    throw new Error(
      "A integração Binance está desativada.",
    );
  }

  if (!settings.automatic_withdrawals) {
    throw new Error(
      "Os saques automáticos Binance estão desativados.",
    );
  }

  if (settings.asset !== "USDT") {
    throw new Error(
      "O ativo Binance deve ser USDT.",
    );
  }

  if (settings.network !== "TRC20") {
    throw new Error(
      "A rede Binance deve ser TRC20.",
    );
  }

  /*
   * A API ainda não está ligada nesta etapa.
   *
   * Não usamos API Key nem Secret aqui.
   */
  if (!settings.api_configured) {
    throw new Error(
      "A integração Binance ainda não foi configurada.",
    );
  }

  return settings;
}
