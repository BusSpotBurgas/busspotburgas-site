// Текст и връзка за всяко известие (камбанка + push), на BG/EN.

export type NotifData = {
  fleet?: string;
  photo?: string;
  author?: string;
  from?: string;
  winner?: string;
  accepted?: boolean;
  invite?: number;
  election?: number;
  count?: number;
};

type L = "bg" | "en";

const T: Record<string, (d: NotifData, l: L) => string> = {
  photo_approved: (d, l) => (l === "bg" ? `Снимката ти на ${d.fleet} е одобрена ✅` : `Your photo of ${d.fleet} is approved ✅`),
  photo_rejected: (d, l) => (l === "bg" ? `Снимката ти на ${d.fleet} не е одобрена` : `Your photo of ${d.fleet} was not approved`),
  photo_edited: (d, l) => (l === "bg" ? `Админът поправи снимката ти на ${d.fleet}` : `The admin corrected your photo of ${d.fleet}`),
  invite_received: (d, l) => (l === "bg" ? `${d.from} иска да стане ортак на ${d.fleet} 🤝` : `${d.from} wants to co-own ${d.fleet} 🤝`),
  invite_reminder: (d, l) => (l === "bg" ? `Напомняне: ${d.from} чака отговор за ${d.fleet}` : `Reminder: ${d.from} is waiting for an answer about ${d.fleet}`),
  invite_answered: (d, l) =>
    d.accepted
      ? l === "bg" ? `Вече си ортак на ${d.fleet} 🎉` : `You are now a co-owner of ${d.fleet} 🎉`
      : l === "bg" ? `Собственикът на ${d.fleet} отказа. Избери друга кола или „Нямам“.` : `The owner of ${d.fleet} declined. Pick another vehicle or "None".`,
  invite_expired: (d, l) =>
    l === "bg" ? `Няма отговор за ${d.fleet} 7 дни – поканата е отказана.` : `No answer about ${d.fleet} in 7 days – the request is declined.`,
  owner_vote: (d, l) => (l === "bg" ? `Собственикът на ${d.fleet} напусна – гласувай за нов` : `The owner of ${d.fleet} left – vote for a new one`),
  owner_elected: (d, l) => (l === "bg" ? `${d.winner} е новият собственик на ${d.fleet}` : `${d.winner} is the new owner of ${d.fleet}`),
  holder_new_photo: (d, l) => (l === "bg" ? `Нова снимка на твоя ${d.fleet} от ${d.author} 📸` : `New photo of your ${d.fleet} by ${d.author} 📸`),
  follow_photo: (d, l) => (l === "bg" ? `${d.author} качи снимка на ${d.fleet}` : `${d.author} uploaded a photo of ${d.fleet}`),
  admin_pending: (d, l) => (l === "bg" ? `Ново за одобрение (${d.count ?? 1})` : `New items to approve (${d.count ?? 1})`),
};

export function notifText(type: string, data: NotifData, lang: L): string {
  return T[type]?.(data, lang) ?? (lang === "bg" ? "Ново известие" : "New notification");
}

export function notifHref(type: string, data: NotifData, lang: L): string {
  if (type === "admin_pending") return `/${lang}/admin/queue`;
  if (type.startsWith("invite") || type.startsWith("owner_")) return `/${lang}/me#holders-activity`;
  if (type === "photo_rejected") return `/${lang}/me/photos`;
  if (data.photo) return `/${lang}/photo/${data.photo}`;
  if (data.fleet) return `/${lang}/bus/${data.fleet}`;
  return `/${lang}/notifications`;
}
