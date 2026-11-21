import Script from "next/script";

/**
 * Cloudflare Web Analytics – брои посещенията без бисквитки и без лични данни.
 * Включва се само ако в Netlify е зададен NEXT_PUBLIC_CF_BEACON_TOKEN.
 */
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return null;
  return (
    <Script
      defer
      strategy="afterInteractive"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
