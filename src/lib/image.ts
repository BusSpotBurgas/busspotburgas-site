"use client";

// Обработка на снимката в браузъра – безплатно и без да пращаме оригинала никъде.
// Прекодирането през <canvas> маха ВСИЧКИ метаданни (GPS, модел на телефона и т.н.).

export type Box = { x: number; y: number; w: number; h: number };
export type Area = { x: number; y: number; width: number; height: number };

export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ORIGINAL_EDGE = 2048; // за автора (без воден знак)
export const DISPLAY_EDGE = 1600; // за всички (с воден знак)
export const THUMB = { w: 800, h: 450 }; // 16:9 за галерията

/** Датата на снимане от EXIF (пази се само за админа). */
export async function readTakenAt(file: File): Promise<string | null> {
  try {
    const exifr = (await import("exifr")).default;
    const data = await exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
    const d: Date | undefined = data?.DateTimeOriginal ?? data?.CreateDate;
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

/** Отваря снимката (правилно завъртяна) и я смалява до ORIGINAL_EDGE. */
export async function loadScaled(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, ORIGINAL_EDGE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

// ── Лица ─────────────────────────────────────────────────────────
// MediaPipe се зарежда от публичен CDN (не харчи трафика на Netlify) и само при нужда.
const MP_VERSION = "1.2.3";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

type Detector = { detect: (img: HTMLCanvasElement) => { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number } }[] } };
let detectorPromise: Promise<Detector> | null = null;

function getDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM);
    return (await FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.45,
    })) as unknown as Detector;
  })();
  return detectorPromise;
}

/**
 * Търси лица на парчета (моделът е за близки лица, а в автобусните снимки лицата са малки).
 * Връща правоъгълници в координатите на снимката.
 */
export async function detectFaces(src: HTMLCanvasElement): Promise<Box[]> {
  const det = await getDetector();
  const boxes: Box[] = [];
  const tile = 640;
  const step = 480;
  const tc = document.createElement("canvas");
  tc.width = tc.height = tile;
  const tctx = tc.getContext("2d")!;
  const run = (sx: number, sy: number, sw: number, sh: number) => {
    tctx.clearRect(0, 0, tile, tile);
    tctx.drawImage(src, sx, sy, sw, sh, 0, 0, tile, tile);
    for (const d of det.detect(tc).detections) {
      const b = d.boundingBox;
      if (!b) continue;
      const kx = sw / tile;
      const ky = sh / tile;
      boxes.push({ x: sx + b.originX * kx, y: sy + b.originY * ky, w: b.width * kx, h: b.height * ky });
    }
  };
  // 1) цялата снимка  2) парчета 640×640 с припокриване
  run(0, 0, src.width, src.height);
  for (let y = 0; y < src.height; y += step) {
    for (let x = 0; x < src.width; x += step) {
      run(Math.min(x, Math.max(0, src.width - tile)), Math.min(y, Math.max(0, src.height - tile)), Math.min(tile, src.width), Math.min(tile, src.height));
    }
  }
  return mergeBoxes(boxes.map((b) => pad(b, 0.25, src)));
}

function pad(b: Box, p: number, c: { width: number; height: number }): Box {
  const x = Math.max(0, b.x - b.w * p);
  const y = Math.max(0, b.y - b.h * p);
  return { x, y, w: Math.min(c.width - x, b.w * (1 + 2 * p)), h: Math.min(c.height - y, b.h * (1 + 2 * p)) };
}

function mergeBoxes(list: Box[]): Box[] {
  const out: Box[] = [];
  for (const b of list) {
    const hit = out.find((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    if (hit) {
      const x = Math.min(hit.x, b.x);
      const y = Math.min(hit.y, b.y);
      hit.w = Math.max(hit.x + hit.w, b.x + b.w) - x;
      hit.h = Math.max(hit.y + hit.h, b.y + b.h) - y;
      hit.x = x;
      hit.y = y;
    } else out.push({ ...b });
  }
  return out;
}

/** Силно замазване (пикселизация + размиване) – не може да се „върне“. */
export function blurBoxes(c: HTMLCanvasElement, boxes: Box[]) {
  const ctx = c.getContext("2d")!;
  for (const b of boxes) {
    const w = Math.max(1, Math.round(b.w));
    const h = Math.max(1, Math.round(b.h));
    const small = document.createElement("canvas");
    small.width = Math.max(1, Math.round(w / 12));
    small.height = Math.max(1, Math.round(h / 12));
    small.getContext("2d")!.drawImage(c, b.x, b.y, w, h, 0, 0, small.width, small.height);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(b.x + w / 2, b.y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.filter = `blur(${Math.max(4, Math.round(w / 10))}px)`;
    ctx.drawImage(small, b.x, b.y, w, h);
    ctx.restore();
  }
}

/** Копие, смалено до maxEdge. */
export function resized(src: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const s = Math.min(1, maxEdge / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Воден знак долу вдясно – само името на спотъра. */
export function watermark(c: HTMLCanvasElement, name: string) {
  const ctx = c.getContext("2d")!;
  const size = Math.max(14, Math.round(c.width / 55));
  ctx.save();
  ctx.font = `700 ${size}px Inter, "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const text = `© ${name} · busspotburgas`;
  const x = c.width - size;
  const y = c.height - size * 0.8;
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = size / 3;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** 16:9 изрязване за галерията. */
export function cropThumb(src: HTMLCanvasElement, a: Area): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = THUMB.w;
  c.height = THUMB.h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, a.x, a.y, a.width, a.height, 0, 0, THUMB.w, THUMB.h);
  return c;
}

/**
 * WebP под даден размер (намалява качеството, ако трябва).
 * Safari (iPhone) не записва WebP – тогава JPEG. И двата идват от canvas, т.е. без метаданни.
 */
export async function encode(c: HTMLCanvasElement, maxBytes: number, quality = 0.88): Promise<Blob> {
  let type = "image/webp";
  let q = quality;
  for (;;) {
    const blob = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), type, q)
    );
    if (blob.type !== type) {
      type = "image/jpeg"; // браузърът не поддържа WebP запис
      continue;
    }
    if (blob.size <= maxBytes || q <= 0.5) return blob;
    q -= 0.08;
  }
}

/** „Отпечатък“ на снимката (dHash, 64 бита) – за откриване на еднакви снимки. */
export function dhash(src: HTMLCanvasElement): string {
  const c = document.createElement("canvas");
  c.width = 9;
  c.height = 8;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, 9, 8);
  const d = ctx.getImageData(0, 0, 9, 8).data;
  const g = (x: number, y: number) => {
    const i = (y * 9 + x) * 4;
    return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  };
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += g(x, y) > g(x + 1, y) ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}
