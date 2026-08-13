// Regras de negócio executadas exclusivamente no servidor.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  if (amount < 100) throw new Error("O valor mínimo de saque é 100 MZN.");
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

  const fee = Math.round(amount * 0.03 * 100) / 100;
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
