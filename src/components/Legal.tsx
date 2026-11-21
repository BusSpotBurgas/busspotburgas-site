// Правила за ползване и Политика за поверителност – пълни текстове на BG и EN.
// При промяна: обнови UPDATED и кажи на спотърите (известие/новина).

const UPDATED = { bg: "21 ноември 2026 г.", en: "21 November 2026" };
const EMAIL = "busspotburgas@gmail.com";

type Section = { h: string; p: string[] };

const RULES: Record<"bg" | "en", Section[]> = {
  bg: [
    {
      h: "1. За сайта",
      p: [
        "busspotburgas е безплатен общностен сайт за любители на градския транспорт в Бургас (спотъри). Сайтът е неофициален и не е свързан с „Бургасбус“ ЕООД или с Община Бургас.",
        "Сайтът няма реклами и не продава нищо. Като се регистрираш, приемаш тези правила и Политиката за поверителност.",
      ],
    },
    {
      h: "2. Кой може да има профил",
      p: [
        "Профил може да има всеки, навършил 14 години. Разглеждането на сайта е свободно и без профил.",
        "Регистрацията е с постоянен имейл или с Google. Временни имейли не се приемат. Профил, чийто имейл не е потвърден до 7 дни, се изтрива автоматично.",
        "Един човек – един профил. Не използвай чуждо име или име, което обижда или подвежда.",
        "Пазиш паролата си в тайна. Отговаряш за всичко, което се прави от твоя профил.",
      ],
    },
    {
      h: "3. Снимки и видео",
      p: [
        "Качвай само снимки, които ти си направил. Авторските права остават твои.",
        "С качването даваш на сайта безплатно право да показва снимката в сайта – смалена, изрязана 16:9 и с воден знак с твоето име. Ако отметнеш „Споделям правата със сайта“, снимката може да се показва и в профилите на сайта в социалните мрежи, винаги с посочен автор.",
        "Всяка снимка се преглежда от админа преди да се покаже. Админът може да откаже, да поправи данни (номер, линия, място) или да свали снимка.",
        "Лицата на хората се замазват автоматично при качване, но провери дали всичко е замазано. Не качвай снимки, на които се виждат лични данни на хора.",
        "Снимай безопасно: не пречи на шофьорите и пътниците, не излизай на пътното платно, не влизай в депа и забранени зони без разрешение.",
        "При спор за авторство („Това е моя снимка“) админът решава според доказателствата.",
      ],
    },
    {
      h: "4. Титуляри и ортаци",
      p: [
        "Титуляр може да бъде само активна кола. Първият, който я вземе, е собственик. Другите стават ортаци само с покана от собственика.",
        "Ако собственикът напусне, ортаците гласуват за нов. Админът може да реши спор или да махне титуляр при нарушение.",
      ],
    },
    {
      h: "5. Коментари, оценки и описания",
      p: [
        "Пиши учтиво. Забранени са обиди, заплахи, език на омразата, спам, реклама и лични данни на други хора.",
        "Коментарите и описанията могат да минат през одобрение. Има ограничение за броя коментари на час.",
        "Ако видиш нередност, използвай бутона „Докладвай“ или пиши на " + EMAIL + ".",
      ],
    },
    {
      h: "6. Точки и класации",
      p: [
        "Точките, ранговете и значките са за забавление и нямат парична стойност.",
        "Забранено е трупане на точки с фалшиви профили, чужди снимки или други трикове. Админът може да отнеме точки и награди при измама.",
      ],
    },
    {
      h: "7. Нарушения",
      p: [
        "При нарушение админът може да изтрие съдържанието и да даде предупреждение, бан за 7 дни или постоянен бан – според тежестта.",
        "Ако смяташ, че решението е грешно, пиши на " + EMAIL + ".",
      ],
    },
    {
      h: "8. Линии и разписания",
      p: [
        "Разписанията са само за информация. Взети са от данните на „Бургасбус“ (чрез livetransport.eu) и може да не са точни при празници, ремонти и промени. За официална информация виж сайта на „Бургасбус“.",
      ],
    },
    {
      h: "9. Отговорност",
      p: [
        "Сайтът се предоставя „такъв, какъвто е“, без гаранция, че винаги ще работи без прекъсване или грешки. Всеки отговаря за съдържанието, което качва.",
      ],
    },
    {
      h: "10. Изтриване на профила",
      p: [
        "Можеш да изтриеш профила си по всяко време от Настройки. Тогава се изтриват имейлът, профилът, титулярите, харесванията и известията ти. Одобрените ти снимки остават в сайта с автор „Бивш спотър“. Ако искаш да се свалят и те, пиши на " + EMAIL + ".",
      ],
    },
    {
      h: "11. Промени",
      p: [
        "Правилата може да се променят. При важни промени ще бъдеш уведомен в сайта. Ако продължиш да ползваш сайта, приемаш новите правила.",
      ],
    },
    { h: "12. Контакт", p: ["Въпроси, сигнали и молби: " + EMAIL + "."] },
  ],
  en: [
    {
      h: "1. About the site",
      p: [
        "busspotburgas is a free community site for public transport fans in Burgas (spotters). It is unofficial and not affiliated with Burgasbus Ltd. or Burgas Municipality.",
        "The site has no ads and sells nothing. By signing up you accept these Terms and the Privacy Policy.",
      ],
    },
    {
      h: "2. Who can have a profile",
      p: [
        "Anyone aged 14 or over can have a profile. Browsing is free and needs no profile.",
        "Sign up with a permanent email or with Google. Temporary emails are not allowed. Profiles with an unconfirmed email are deleted automatically after 7 days.",
        "One person – one profile. Do not use someone else's name or a name that is offensive or misleading.",
        "Keep your password secret. You are responsible for everything done from your profile.",
      ],
    },
    {
      h: "3. Photos and videos",
      p: [
        "Upload only photos you took yourself. You keep the copyright.",
        "By uploading you give the site a free right to show the photo on the site – resized, cropped to 16:9 and watermarked with your name. If you tick \"I share the rights with the site\", the photo may also appear on the site's social media accounts, always credited to you.",
        "Every photo is reviewed by the admin before it appears. The admin may reject it, correct details (number, line, place) or remove it.",
        "Faces are blurred automatically on upload, but please check that everything is blurred. Do not upload photos showing other people's personal data.",
        "Shoot safely: do not disturb drivers or passengers, do not step onto the road, do not enter depots or restricted areas without permission.",
        "In an authorship dispute (\"This is my photo\") the admin decides based on the evidence.",
      ],
    },
    {
      h: "4. Owners and co-owners",
      p: [
        "Only active vehicles can be owned. The first person to take one is the owner. Others become co-owners only by the owner's invitation.",
        "If the owner leaves, the co-owners vote for a new one. The admin may settle disputes or remove an owner for a violation.",
      ],
    },
    {
      h: "5. Comments, ratings and descriptions",
      p: [
        "Be polite. Insults, threats, hate speech, spam, advertising and other people's personal data are not allowed.",
        "Comments and descriptions may need approval. There is a limit on comments per hour.",
        "If you see something wrong, use the \"Report\" button or write to " + EMAIL + ".",
      ],
    },
    {
      h: "6. Points and rankings",
      p: [
        "Points, ranks and badges are for fun and have no monetary value.",
        "Collecting points with fake profiles, other people's photos or other tricks is forbidden. The admin may remove points and awards for cheating.",
      ],
    },
    {
      h: "7. Violations",
      p: [
        "For a violation the admin may delete the content and give a warning, a 7-day ban or a permanent ban, depending on how serious it is.",
        "If you think a decision is wrong, write to " + EMAIL + ".",
      ],
    },
    {
      h: "8. Lines and timetables",
      p: [
        "Timetables are for information only. They come from Burgasbus data (via livetransport.eu) and may be inaccurate on holidays, during roadworks or after changes. For official information see the Burgasbus website.",
      ],
    },
    {
      h: "9. Liability",
      p: [
        "The site is provided \"as is\", with no guarantee that it will always work without interruptions or errors. Everyone is responsible for the content they upload.",
      ],
    },
    {
      h: "10. Deleting your profile",
      p: [
        "You can delete your profile at any time in Settings. Your email, profile, owned buses, likes and notifications are then deleted. Your approved photos stay on the site credited to \"Former spotter\". If you want them removed too, write to " + EMAIL + ".",
      ],
    },
    {
      h: "11. Changes",
      p: [
        "These Terms may change. You will be notified on the site about important changes. If you keep using the site, you accept the new Terms.",
      ],
    },
    { h: "12. Contact", p: ["Questions, reports and requests: " + EMAIL + "."] },
  ],
};

const PRIVACY: Record<"bg" | "en", Section[]> = {
  bg: [
    {
      h: "1. Кой отговаря за данните",
      p: [
        "Данните се обработват от администратора на сайта busspotburgas. За всичко, свързано с личните ти данни, пиши на " + EMAIL + ".",
      ],
    },
    {
      h: "2. Какви данни пазим",
      p: [
        "Акаунт: имейл, парола (само криптирана – bcrypt, никой не може да я види), при вход с Google – идентификатор от Google; дата на регистрация и последен вход; за админа – код за двуфакторен вход.",
        "Профил: показвано име, снимка на профила и корица, TikTok (по желание), език, отметката „Навършил съм 14 години“, настройки за имейли, титуляри.",
        "Съдържание: снимките ти (с линия, място, реклама, описание, дата на снимане от файла), видео връзки, коментари, оценки, харесвания, описания на коли, сигнали.",
        "Игра и известия: точки, значки, гласове, покани за ортаци, известия, устройства за push известия (адрес от браузъра).",
        "Технически: бисквитка за вход; IP адрес и данни за браузъра в техническите логове на хостинга и базата (за сигурност).",
      ],
    },
    {
      h: "3. Защо ги ползваме",
      p: [
        "За да работи сайтът, който си поискал – профил, качване, титуляри, точки и известия (изпълнение на договор).",
        "За сигурност – защита от ботове, злоупотреби и измами (законен интерес).",
        "За анонимна статистика на посещенията без бисквитки (законен интерес).",
        "Push известията и част от имейлите са по избор – можеш да ги спреш по всяко време от Настройки (съгласие).",
      ],
    },
    {
      h: "4. Кое е публично",
      p: [
        "Публично се виждат: показваното име, снимката на профила и корицата, TikTok, титулярите, точките, ранга, значките, одобрените снимки и видеа, коментарите и оценките ти.",
        "Имейлът ти никога не се показва. Оригиналът на снимката и датата на снимане виждат само ти и админът.",
      ],
    },
    {
      h: "5. Снимките",
      p: [
        "Преди качване, още в телефона или компютъра ти, от снимката се махат GPS координатите и другите данни от файла (EXIF), а лицата се замазват. Пазим само датата на снимане.",
        "За разпознаването на лица браузърът ти изтегля модел от jsDelivr и Google (адресите им виждат твоя IP адрес). Самата снимка не се праща никъде, освен в сайта.",
      ],
    },
    {
      h: "6. Кой още обработва данните",
      p: [
        "Supabase – база, вход и снимки; сървърите са в Европейския съюз (Франкфурт).",
        "Netlify – хостинг на сайта (САЩ); данните се пренасят при стандартните договорни клаузи на ЕС.",
        "Google – вход с Google и изпращане на имейли през Gmail.",
        "Cloudflare – невидимата проверка „не съм робот“ (Turnstile) и анонимната статистика (Web Analytics, без бисквитки).",
        "Услугите за push известия на браузъра ти (Google, Apple, Mozilla, Microsoft) – само ако разрешиш известия.",
        "Не продаваме и не даваме данни за реклама. Няма рекламни бисквитки и проследяване.",
      ],
    },
    {
      h: "7. Колко дълго пазим",
      p: [
        "Профилът – докато не го изтриеш. Непотвърден профил – 7 дни.",
        "Отказани снимки – 30 дни. Известия – 90 дни.",
        "След изтриване на профила одобрените снимки остават с автор „Бивш спотър“, освен ако не поискаш да се свалят.",
        "Седмичен архив на базата (за възстановяване при авария) се пази в частно хранилище и се подменя с по-нов.",
      ],
    },
    {
      h: "8. Бисквитки",
      p: [
        "Ползваме само необходимата бисквитка за вход. Cloudflare Turnstile може да постави своя техническа бисквитка при проверката. Статистиката е без бисквитки. Затова няма банер за бисквитки.",
        "Сайтът пази копие на страниците в браузъра (service worker), за да работи и без интернет.",
      ],
    },
    {
      h: "9. Твоите права",
      p: [
        "Имаш право на достъп, поправка, изтриване, ограничаване, преносимост и възражение.",
        "От Настройки можеш сам да изтеглиш всичките си данни („Изтегли моите данни“), да промениш профила си и да го изтриеш. За всичко друго пиши на " + EMAIL + " – отговаряме до 30 дни.",
        "Имаш право на жалба до Комисията за защита на личните данни (www.cpdp.bg).",
      ],
    },
    {
      h: "10. Деца",
      p: ["Профил може да има само човек на 14 или повече години. Ако разберем, че профил е на по-малко дете, го изтриваме."],
    },
    {
      h: "11. Сигурност",
      p: [
        "Връзката е винаги криптирана (HTTPS). Всяка таблица в базата е защитена с правила за достъп. Админът влиза с парола и код от приложение (2FA).",
      ],
    },
    {
      h: "12. Промени",
      p: ["При важни промени в тази политика ще бъдеш уведомен в сайта."],
    },
  ],
  en: [
    {
      h: "1. Who is responsible",
      p: ["Your data is processed by the administrator of busspotburgas. For anything about your personal data, write to " + EMAIL + "."],
    },
    {
      h: "2. What we store",
      p: [
        "Account: email, password (hashed only – bcrypt, nobody can see it), a Google identifier if you sign in with Google; sign-up and last sign-in dates; for the admin – a two-factor login code.",
        "Profile: display name, profile photo and cover, TikTok (optional), language, the \"I am 14 or older\" confirmation, email settings, owned buses.",
        "Content: your photos (with line, place, ad, description, date taken from the file), video links, comments, ratings, likes, vehicle descriptions, reports.",
        "Game and notifications: points, badges, votes, co-owner invitations, notifications, push devices (an address from your browser).",
        "Technical: a login cookie; IP address and browser data in the technical logs of the hosting and database (for security).",
      ],
    },
    {
      h: "3. Why we use it",
      p: [
        "To run the site you asked for – profile, uploads, owned buses, points and notifications (performance of a contract).",
        "For security – protection against bots, abuse and cheating (legitimate interest).",
        "For anonymous, cookie-free visit statistics (legitimate interest).",
        "Push notifications and some emails are optional – you can turn them off at any time in Settings (consent).",
      ],
    },
    {
      h: "4. What is public",
      p: [
        "Publicly visible: your display name, profile photo and cover, TikTok, owned buses, points, rank, badges, approved photos and videos, comments and ratings.",
        "Your email is never shown. Only you and the admin can see the original photo and the date it was taken.",
      ],
    },
    {
      h: "5. Photos",
      p: [
        "Before upload, on your own phone or computer, GPS coordinates and other file data (EXIF) are removed and faces are blurred. We keep only the date taken.",
        "For face detection your browser downloads a model from jsDelivr and Google (they see your IP address). The photo itself is sent nowhere except to the site.",
      ],
    },
    {
      h: "6. Who else processes data",
      p: [
        "Supabase – database, login and photos; servers in the European Union (Frankfurt).",
        "Netlify – website hosting (USA); data is transferred under the EU Standard Contractual Clauses.",
        "Google – sign-in with Google and sending emails via Gmail.",
        "Cloudflare – the invisible \"not a robot\" check (Turnstile) and anonymous statistics (Web Analytics, no cookies).",
        "Your browser's push services (Google, Apple, Mozilla, Microsoft) – only if you allow notifications.",
        "We do not sell data or share it for advertising. There are no advertising cookies and no tracking.",
      ],
    },
    {
      h: "7. How long we keep it",
      p: [
        "Your profile – until you delete it. An unconfirmed profile – 7 days.",
        "Rejected photos – 30 days. Notifications – 90 days.",
        "After you delete your profile, approved photos stay credited to \"Former spotter\" unless you ask for them to be removed.",
        "A weekly database backup (for disaster recovery) is kept in a private repository and replaced by newer ones.",
      ],
    },
    {
      h: "8. Cookies",
      p: [
        "We use only the necessary login cookie. Cloudflare Turnstile may set its own technical cookie during the check. Statistics are cookie-free. That is why there is no cookie banner.",
        "The site keeps a copy of pages in your browser (service worker) so it also works offline.",
      ],
    },
    {
      h: "9. Your rights",
      p: [
        "You have the right of access, rectification, erasure, restriction, portability and objection.",
        "In Settings you can download all your data yourself (\"Download my data\"), edit your profile and delete it. For anything else write to " + EMAIL + " – we reply within 30 days.",
        "You have the right to complain to the Bulgarian Commission for Personal Data Protection (www.cpdp.bg).",
      ],
    },
    {
      h: "10. Children",
      p: ["Only people aged 14 or over may have a profile. If we learn that a profile belongs to a younger child, we delete it."],
    },
    {
      h: "11. Security",
      p: ["The connection is always encrypted (HTTPS). Every database table is protected by access rules. The admin signs in with a password and an app code (2FA)."],
    },
    {
      h: "12. Changes",
      p: ["You will be notified on the site about important changes to this policy."],
    },
  ],
};

export function LegalPage({ kind, lang, title, updatedLabel }: { kind: "rules" | "privacy"; lang: "bg" | "en"; title: string; updatedLabel: string }) {
  const sections = (kind === "rules" ? RULES : PRIVACY)[lang];
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        {updatedLabel}: {UPDATED[lang]}
      </p>
      <div className="mt-6 space-y-6 rounded-card border border-line bg-surface p-6 shadow-card">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-lg font-bold">{s.h}</h2>
            <div className="mt-2 space-y-2 text-[15px] leading-relaxed">
              {s.p.map((x) => (
                <p key={x}>{x}</p>
              ))}
            </div>
          </section>
        ))}
        {kind === "privacy" && (
          <p className="text-sm text-muted">
            {lang === "bg" ? "За Cloudflare Turnstile важи и " : "Cloudflare Turnstile is also covered by the "}
            <a href="https://www.cloudflare.com/turnstile-privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-sea-600 underline">
              {lang === "bg" ? "Допълнението за поверителност на Cloudflare Turnstile" : "Cloudflare Turnstile Privacy Addendum"}
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
