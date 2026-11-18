// Общо за браузъра и сървъра (без тайни).
import { supabaseUrl } from "./supabase/env";

export const PHOTO_KINDS = ["exterior", "interior", "cab", "depot"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const REJECT_REASONS = ["blurry", "wrong_number", "duplicate", "not_own", "other"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const PHOTO_FILES = ["original", "display", "thumb"] as const;
export const FILE_LIMITS: Record<(typeof PHOTO_FILES)[number], number> = {
  original: 1_400_000,
  display: 900_000,
  thumb: 200_000,
};

export const LINE_RE = /^[0-9A-Za-zА-Яа-я\- ]{1,12}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PhotoRow = {
  id: string;
  vehicle_id: number;
  user_id: string | null;
  author_name: string | null;
  status: "pending" | "approved" | "rejected";
  kind: PhotoKind;
  line: string;
  place: string;
  ad: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  reject_reason: RejectReason | null;
  reject_note: string | null;
  edited_by_admin: boolean;
  is_night: boolean;
  is_rain: boolean;
  vehicles?: { fleet_number: string; model_id: string } | null;
};

export const PHOTO_COLS =
  "id,vehicle_id,user_id,author_name,status,kind,line,place,ad,description,width,height,created_at,reject_reason,reject_note,edited_by_admin,is_night,is_rain,vehicles(fleet_number,model_id)";

/** Адреси на одобрените (публични) файлове. */
export const publicPhotoUrl = (id: string, file: "display" | "thumb") =>
  `${supabaseUrl}/storage/v1/object/public/photos-public/${id}/${file}`;
