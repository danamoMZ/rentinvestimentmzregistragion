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
  { key: "payment_emola", label: "Número e-Mola", placeholder: "865982221" },
  { key: "payment_holder", label: "Nome do titular", placeholder: "CARLITOS OSSUFO" },
] as const;

export const PAYMENT_FIELDS = [
  { key: "payment_emola", label: "Número Mpesa", placeholder: "865982221" },
  { key: "payment_holder", label: "Nome do titular", placeholder: "CARLITOS OSSUFO" },
] as const;

export const toHref = (value: string) => {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[+\d][\d\s()-]{6,}$/.test(v)) return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
  return v;
};
