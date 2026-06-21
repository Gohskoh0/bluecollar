import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { resolveStorageUrl, toStorageRef } from "@/lib/storage-media";

interface Props {
  userId: string;
  kind: "avatar" | "cover";
  onUploaded: (url: string) => void;
  className?: string;
  label?: string;
}

export function PhotoUploader({ userId, kind, onUploaded, className = "", label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const mediaRef = toStorageRef("profiles", path);
    const update = kind === "avatar" ? { avatar_url: mediaRef } : { cover_url: mediaRef };
    const { error: upErr } = await supabase.from("profiles").update(update).eq("id", userId);
    setBusy(false);
    if (upErr) return toast.error(upErr.message);
    toast.success("Photo updated");
    onUploaded((await resolveStorageUrl("profiles", mediaRef)) ?? mediaRef);
  }

  const iconOnly = label === "";
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <Button
        size={iconOnly ? "icon" : "sm"}
        variant="secondary"
        className={`${iconOnly ? "h-8 w-8 rounded-full p-0" : "gap-2"} shadow-md ${className}`}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={kind === "avatar" ? "Edit photo" : "Edit cover"}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {!iconOnly && (label ?? (kind === "avatar" ? "Edit photo" : "Edit cover"))}
      </Button>
    </>
  );
}
