import type { ReactNode } from "react";
import { BusSilhouette } from "./BusSilhouette";

/** Страници за вход/регистрация: картина отляво + форма. */
export function AuthShell({ title, lead, children, footer }: { title: string; lead?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:py-12 lg:grid-cols-2 lg:items-center">
      <div aria-hidden="true" className="relative hidden aspect-[4/5] overflow-hidden rounded-[28px] bg-gradient-to-br from-sea-500 to-sea-800 lg:block">
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-sea-900/40" />
        {/* „Път“ + два автобуса в светли морски тонове, за да се виждат прозорците */}
        <div className="absolute inset-x-0 bottom-20 h-px bg-white/25" />
        <div className="absolute inset-x-8 bottom-[5.1rem]">
          <BusSilhouette kind="18m" color="#ADD8F0" className="w-full" />
        </div>
        <div className="absolute right-8 top-1/3 w-1/2 opacity-40">
          <BusSilhouette kind="trolley" color="#74BBE3" className="w-full" />
        </div>
        <p className="absolute left-8 top-8 font-display text-2xl font-extrabold leading-tight text-white">
          busspot<br />burgas
        </p>
      </div>
      <div className="mx-auto w-full max-w-md">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        {lead && <p className="mt-2 text-muted">{lead}</p>}
        <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
