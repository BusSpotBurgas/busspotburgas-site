"use client";

import { useState } from "react";

type Props = {
  src: string;
  number: string;
  line: string;
  author: string;
  labels: { share: string; making: string; failed: string };
};

const W = 1080;
const H = 1920;
const SEA = "#0B6FA4";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Логото на сайта, нарисувано с canvas (същото като LogoMark). */
function drawLogo(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const k = s / 64;
  const box = (bx: number, by: number, w: number, h: number, r: number, fill: string) => {
    c.fillStyle = fill;
    roundRect(c, x + bx * k, y + by * k, w * k, h * k, r * k);
    c.fill();
  };
  box(0, 0, 64, 64, 15, SEA);
  box(14, 13, 36, 34, 7, "#fff");
  box(18, 18, 28, 13, 3, SEA);
  box(18, 36, 7, 4, 2, SEA);
  box(39, 36, 7, 4, 2, SEA);
  box(17, 47, 7, 6, 2, "#fff");
  box(40, 47, 7, 6, 2, "#fff");
}

async function makeStory({ src, number, line, author }: Omit<Props, "labels">) {
  const css = getComputedStyle(document.documentElement);
  const display = css.getPropertyValue("--font-unbounded").trim() || "sans-serif";
  const body = css.getPropertyValue("--font-inter").trim() || "sans-serif";
  await document.fonts.ready;
  const img = await loadImage(src);

  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;

  // Фон: размазана версия на снимката + тъмен градиент
  c.filter = "blur(40px) brightness(0.55)";
  const cover = Math.max(W / img.width, H / img.height);
  c.drawImage(img, (W - img.width * cover) / 2, (H - img.height * cover) / 2, img.width * cover, img.height * cover);
  c.filter = "none";
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(6,30,48,.55)");
  g.addColorStop(1, "rgba(6,30,48,.9)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // Снимката – в рамка с обли ъгли
  const pw = W - 96;
  const ph = Math.min(pw * (img.height / img.width), 1100);
  const px = 48;
  const py = (H - ph) / 2 - 80;
  c.save();
  c.shadowColor = "rgba(0,0,0,.45)";
  c.shadowBlur = 50;
  c.shadowOffsetY = 20;
  roundRect(c, px, py, pw, ph, 36);
  c.fillStyle = "#000";
  c.fill();
  c.restore();
  c.save();
  roundRect(c, px, py, pw, ph, 36);
  c.clip();
  const fit = Math.max(pw / img.width, ph / img.height);
  c.drawImage(img, px + (pw - img.width * fit) / 2, py + (ph - img.height * fit) / 2, img.width * fit, img.height * fit);
  c.restore();

  // Номерът – голям, в бяла табела
  c.font = `800 150px ${display}`;
  const nw = c.measureText(number).width;
  const tagW = nw + 120;
  const tagY = py + ph + 60;
  roundRect(c, (W - tagW) / 2, tagY, tagW, 210, 40);
  c.fillStyle = "#fff";
  c.fill();
  c.fillStyle = "#0F172A";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(number, W / 2, tagY + 112);

  // Линия и автор
  c.fillStyle = "rgba(255,255,255,.92)";
  c.font = `600 46px ${body}`;
  const meta = [line && `🚌 ${line}`, author && `📸 ${author}`].filter(Boolean).join("   ·   ");
  c.fillText(meta, W / 2, tagY + 300, W - 120);

  // Лого горе
  const ls = 110;
  c.font = `800 62px ${display}`;
  const t1 = "busspot";
  const t2 = "burgas";
  const tw = c.measureText(t1 + t2).width;
  const total = ls + 28 + tw;
  const lx = (W - total) / 2;
  drawLogo(c, lx, 150, ls);
  c.textAlign = "left";
  c.fillStyle = "#fff";
  c.fillText(t1, lx + ls + 28, 150 + ls / 2 + 4);
  c.fillStyle = "#5BC0EB";
  c.fillText(t2, lx + ls + 28 + c.measureText(t1).width, 150 + ls / 2 + 4);

  // Адрес долу
  c.textAlign = "center";
  c.fillStyle = "rgba(255,255,255,.7)";
  c.font = `600 40px ${body}`;
  c.fillText("busspotburgas.netlify.app", W / 2, H - 140);

  return new Promise<Blob>((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error("blob"))), "image/png"));
}

/** Бутон „Сподели“: прави картинка за TikTok/Instagram story (1080×1920). */
export function ShareStory({ labels, ...p }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function share() {
    setState("busy");
    try {
      const blob = await makeStory(p);
      const file = new File([blob], `busspotburgas-${p.number}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
      setState("idle");
    } catch (e) {
      console.error(e);
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={state === "busy"}
      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] px-4 py-2 text-sm font-semibold text-white shadow-card disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
      </svg>
      {state === "busy" ? labels.making : state === "error" ? labels.failed : labels.share}
    </button>
  );
}
