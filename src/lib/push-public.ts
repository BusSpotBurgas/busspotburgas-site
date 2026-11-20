// Публичният ключ за push известия (VAPID) – по замисъл е публичен.
// Тайната половина е само в .env.local и в Netlify (VAPID_PRIVATE_KEY).
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "BCaWZmulovsQFi-00hSXz2Ny0Mz4gZuWa22_g9gxzb7eUs1xZUfVtstYVBnuf2nS1D3-mZtEqWELkmnhLRVrF5E";
