import { supabase } from "@/integrations/supabase/client";

export function toStorageRef(bucket: string, path: string) {
  return `${bucket}:${path}`;
}

function getStoragePath(bucket: string, value: string) {
  if (value.startsWith(`${bucket}:`)) return value.slice(bucket.length + 1);
  try {
    const url = new URL(value);
    const markers = [`/storage/v1/object/public/${bucket}/`, `/storage/v1/object/sign/${bucket}/`];
    const marker = markers.find((m) => url.pathname.includes(m));
    if (!marker) return null;
    return decodeURIComponent(url.pathname.split(marker)[1] ?? "");
  } catch {
    return value.includes("://") ? null : value;
  }
}

export async function resolveStorageUrl(bucket: string, value: string | null | undefined) {
  if (!value) return null;
  const path = getStoragePath(bucket, value);
  if (!path) return value;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  return error || !data?.signedUrl ? value : data.signedUrl;
}

export async function resolveProfileMedia<T extends { avatar_url?: string | null; cover_url?: string | null }>(profile: T) {
  const [avatar_url, cover_url] = await Promise.all([
    resolveStorageUrl("profiles", profile.avatar_url),
    resolveStorageUrl("profiles", profile.cover_url),
  ]);
  return { ...profile, avatar_url, cover_url };
}

export async function resolvePostMedia<T extends { image_url?: string | null }>(post: T) {
  const image_url = await resolveStorageUrl("post-media", post.image_url);
  return { ...post, image_url };
}

export function isVideoMedia(value: string) {
  const clean = value.split("?")[0]?.toLowerCase() ?? "";
  return /\.(mp4|webm|mov|m4v|ogg)$/.test(clean);
}