// Кратки версии на правилата и поверителността (пълните текстове – Етап 7).

const RULES = {
  bg: [
    "Сайтът е за спотъри на 14 и повече години.",
    "Регистрацията е с постоянен имейл или Google. Временни имейли не се приемат. Непотвърдени профили се трият след 7 дни.",
    "Качвай само свои снимки. Всяка снимка минава през админа преди да се покаже.",
    "Без обиди и спам. Нарушенията водят до предупреждение, бан за 7 дни или завинаги.",
    "Титуляр може да бъде само активна кола. Първият, който я вземе, е собственик; другите стават ортаци само с покана.",
    "Можеш да изтриеш профила си по всяко време от Настройки. Снимките остават с автор „Бивш спотър“.",
    "Въпроси и сигнали: busspotburgas@gmail.com.",
  ],
  en: [
    "The site is for spotters aged 14 and over.",
    "Sign up with a permanent email or Google. Temporary emails are not allowed. Unconfirmed profiles are deleted after 7 days.",
    "Upload only your own photos. Every photo is approved by the admin before it appears.",
    "No insults or spam. Violations lead to a warning, a 7-day ban or a permanent ban.",
    "Only active vehicles can be owned. The first to take one is the owner; others become co-owners only by invitation.",
    "You can delete your profile at any time in Settings. Photos stay with the author \"Former spotter\".",
    "Questions and reports: busspotburgas@gmail.com.",
  ],
};

const PRIVACY = {
  bg: [
    "Данните се пазят в Supabase в Европейския съюз (Франкфурт).",
    "Пазим: имейл (никога не се показва), показвано име, снимка на профила, TikTok по желание, титуляри.",
    "Паролите са криптирани (bcrypt) и никой, включително админът, не може да ги види.",
    "Използваме само бисквитка за вход. Без рекламни бисквитки и без проследяване.",
    "От снимките се махат GPS данните, а лицата се замазват.",
    "От Настройки можеш да изтеглиш всичките си данни или да изтриеш профила си.",
    "Контакт: busspotburgas@gmail.com.",
  ],
  en: [
    "Data is stored in Supabase in the European Union (Frankfurt).",
    "We store: email (never shown), display name, profile photo, optional TikTok, owned buses.",
    "Passwords are hashed (bcrypt) and nobody, including the admin, can see them.",
    "We use only a login cookie. No advertising cookies and no tracking.",
    "GPS data is removed from photos and faces are blurred.",
    "In Settings you can download all your data or delete your profile.",
    "Contact: busspotburgas@gmail.com.",
  ],
};

export function LegalPage({ kind, lang, title, draft }: { kind: "rules" | "privacy"; lang: "bg" | "en"; title: string; draft: string }) {
  const items = (kind === "rules" ? RULES : PRIVACY)[lang];
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{draft}</p>
      <ol className="mt-6 list-decimal space-y-3 rounded-card border border-line bg-surface p-6 pl-10 shadow-card">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
        {kind === "privacy" && (
          <li>
            {lang === "bg"
              ? "Регистрацията и входът са защитени от Cloudflare Turnstile (невидима проверка „не съм робот“). За нея важи "
              : "Sign-up and login are protected by Cloudflare Turnstile (an invisible \"not a robot\" check). It is covered by the "}
            <a
              href="https://www.cloudflare.com/turnstile-privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sea-600 underline"
            >
              {lang === "bg" ? "Допълнението за поверителност на Cloudflare Turnstile" : "Cloudflare Turnstile Privacy Addendum"}
            </a>
            .
          </li>
        )}
      </ol>
    </div>
  );
}
