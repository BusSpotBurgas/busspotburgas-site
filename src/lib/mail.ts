import "server-only";

import nodemailer from "nodemailer";

// Имейли от Gmail акаунта на сайта (парола за приложение в GMAIL_APP_PASSWORD – само в Netlify/.env.local).
const USER = process.env.GMAIL_USER ?? "busspotburgas@gmail.com";
const PASS = process.env.GMAIL_APP_PASSWORD ?? "";
export const SITE = process.env.URL ?? "https://busspotburgas.netlify.app";

export const mailEnabled = Boolean(PASS);

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: USER, pass: PASS },
  });
  return transport;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Писмо в дизайна на сайта. Текстовете се екранират (без HTML от потребители). */
export function layout(opts: { title: string; lines: string[]; button?: { label: string; href: string }; image?: string; footer: string }) {
  const body = opts.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#33424F">${esc(l)}</p>`).join("");
  const img = opts.image
    ? `<p style="margin:0 0 16px"><img src="${esc(opts.image)}" width="464" alt="" style="width:100%;max-width:464px;border-radius:12px;display:block"></p>`
    : "";
  const btn = opts.button
    ? `<p style="margin:18px 0 6px"><a href="${esc(opts.button.href)}" style="display:inline-block;background:#0B6FA4;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(opts.button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F6F9FB;font-family:Arial,Helvetica,sans-serif;color:#0F1B26">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #E3EAF0;border-radius:16px;overflow:hidden">
<tr><td style="background:#0B6FA4;padding:18px 28px"><img src="${SITE}/icons/icon-192.png" width="36" height="36" alt="" style="vertical-align:middle;border-radius:9px"><span style="vertical-align:middle;margin-left:10px;font-size:19px;font-weight:800;color:#fff">busspotburgas</span></td></tr>
<tr><td style="padding:26px 28px"><h1 style="margin:0 0 14px;font-size:21px">${esc(opts.title)}</h1>${img}${body}${btn}</td></tr>
<tr><td style="padding:14px 28px;background:#F6F9FB;font-size:12px;line-height:1.5;color:#5B6B78">${esc(opts.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!mailEnabled || !to) return false;
  try {
    await getTransport().sendMail({ from: `"busspotburgas" <${USER}>`, to, subject, html, text });
    return true;
  } catch (e) {
    console.error("mail:", e);
    return false;
  }
}
