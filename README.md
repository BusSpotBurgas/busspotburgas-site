# busspotburgas

Общностен сайт за спотърите на Бургасбус. Next.js на Netlify + Supabase (Франкфурт). Всичко е на безплатните планове.

## Какво има (Етап 1 – основа)

| Част | Къде |
| --- | --- |
| Страници BG/EN (`/bg`, `/en`) | `src/app/[lang]/` |
| Преводи | `src/dictionaries/bg.json`, `en.json` |
| Дизайн система (цветове, шрифтове) | `src/app/globals.css` |
| Силуети на моделите | `src/components/BusSilhouette.tsx` |
| База: таблици + RLS | `supabase/migrations/0001_init.sql` |
| Автопарк | `data/fleet.json` → `npm run db:sql` → `supabase/setup.sql` |
| PWA (инсталиране на телефона) | `src/app/manifest.ts`, `public/sw.js`, `public/icons/` |

## Ключове

Ключовете **никога** не влизат в git. Локално: копирай `.env.example` като `.env.local` и попълни. В Netlify: Site configuration → Environment variables.

## Обновяване на автопарка

1. Редактирай `data/fleet.json` (нов модел → добави го и в `data/models-meta.json`).
2. `npm run db:sql`
3. Отвори `supabase/seed.sql`, копирай всичко → Supabase → SQL Editor → Run.

## Локално

```bash
npm install
npm run dev
```
