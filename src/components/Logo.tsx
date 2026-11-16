/** Лого: автобус в синьо квадратче + дебел надпис. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#0B6FA4" />
      <rect x="14" y="13" width="36" height="34" rx="7" fill="#fff" />
      <rect x="18" y="18" width="28" height="13" rx="3" fill="#0B6FA4" />
      <rect x="18" y="36" width="7" height="4" rx="2" fill="#0B6FA4" />
      <rect x="39" y="36" width="7" height="4" rx="2" fill="#0B6FA4" />
      <rect x="17" y="47" width="7" height="6" rx="2" fill="#fff" />
      <rect x="40" y="47" width="7" height="6" rx="2" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-[15px] font-extrabold leading-none tracking-tight sm:text-base">
        busspot<span className="text-sea-500">burgas</span>
      </span>
    </span>
  );
}
