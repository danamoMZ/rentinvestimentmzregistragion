export const MZN = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MZN`;
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const todayMaputo = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Maputo" }).format(new Date());

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  ACTIVE: "Ativo",
  COMPLETED: "Concluído",
  EXPIRED: "Expirado",
  REPLACED: "Substituído",
  OPEN: "Aberto",
  IN_PROGRESS: "Em curso",
  CLOSED: "Fechado",
};

export const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-warning/15 text-warning-foreground border-warning/40",
  OPEN: "bg-warning/15 text-warning-foreground border-warning/40",
  IN_PROGRESS: "bg-primary/10 text-primary border-primary/30",
  APPROVED: "bg-success/15 text-success border-success/40",
  ACTIVE: "bg-success/15 text-success border-success/40",
  COMPLETED: "bg-success/15 text-success border-success/40",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/30",
  EXPIRED: "bg-muted text-muted-foreground border-border",
  REPLACED: "bg-muted text-muted-foreground border-border",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

export const SUPPORT_FIELDS = [
  { key: "support_whatsapp_group", label: "Grupo do WhatsApp", placeholder: "https://chat.whatsapp.com/..." },
  { key: "support_telegram_group", label: "Grupo do Telegram", placeholder: "https://t.me/..." },
  { key: "support_technical", label: "Suporte técnico", placeholder: "https://wa.me/258... ou +258 84 000 0000" },
  { key: "support_help", label: "Suporte ajuda", placeholder: "https://wa.me/258... ou +258 84 000 0000" },
  { key: "support_financial", label: "Suporte financeiro", placeholder: "https://wa.me/258... ou +258 84 000 0000" },
] as const;

export const PAYMENT_FIELDS = [
  { key: "payment_mpesa", label: "Número M-Pesa", placeholder: "841783243" },
  { key: "payment_mpesa_holder", label: "Titular M-Pesa", placeholder: "Nome do titular" },
  { key: "payment_emola", label: "Número e-Mola", placeholder: "868657696" },
  { key: "payment_emola_holder", label: "Titular e-Mola", placeholder: "Nome do titular" },
  { key: "payment_p20", label: "Carteira P20", placeholder: "Número ou endereço P20" },
  { key: "payment_bnb", label: "Carteira BNB", placeholder: "Endereço BNB" },
  { key: "payment_usdt_trc20", label: "Endereço USDT TRC20", placeholder: "Endereço TRC20" },
  { key: "payment_usdt_qr_url", label: "QR Code USDT (URL)", placeholder: "https://.../qr-usdt.png" },
  { key: "payment_bnb_qr_url", label: "QR Code BNB (URL)", placeholder: "https://.../qr-bnb.png" },
] as const;

export const RECHARGE_QUICK_AMOUNT_DEFAULTS = [900, 3000, 10200, 30000, 200000, 500000, 1000000, 2000000, 5000000] as const;

export const PLAN_IMAGE_FIELDS = Array.from({ length: 11 }, (_, index) => ({
  key: `plan_${index + 1}_image_url`,
  label: `Imagem do VIP ${index + 1}`,
  placeholder: "https://.../imagem.jpg ou /caminho/da/imagem",
}));

export const RECHARGE_SETTINGS_FIELDS = [
  { key: "recharge_min_amount", label: "Valor mínimo de recarga (MZN)", placeholder: "200" },
  { key: "recharge_quick_amounts", label: "Valores rápidos (separados por vírgula)", placeholder: "900,3000,10200,30000,200000,500000,1000000,2000000,5000000" },
  { key: "welcome_title", label: "Título do anúncio de boas-vindas", placeholder: "Bem-vindo à BLUE ORIGIN" },
  { key: "welcome_message", label: "Mensagem personalizada de boas-vindas", placeholder: "Mensagem da BLUE ORIGIN..." },
] as const;

export const TASK_MEDIA_FIELDS = Array.from({ length: 5 }, (_, index) => ({
  index: index + 1,
  imageKey: `task_${index + 1}_image_url`,
  videoKey: `task_${index + 1}_video_url`,
  imageLabel: `Imagem da tarefa ${index + 1}`,
  videoLabel: `Vídeo da tarefa ${index + 1}`,
}));

export const toHref = (value: string) => {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[+\d][\d\s()-]{6,}$/.test(v)) return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
  return v;
};
