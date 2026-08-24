import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MediaImage } from "@/components/media-image";
import { uploadMedia } from "@/lib/media";
import { saveProfileMedia } from "@/lib/social.functions";

export function ProfileMediaEditor({
  name,
  avatar,
  cover,
  editable,
}: {
  name: string;
  avatar: string | null;
  cover: string | null;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveProfileMedia);
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"cover" | "avatar" | null>(null);

  async function handle(kind: "cover" | "avatar", file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    try {
      const path = await uploadMedia(file, kind);
      await save({ data: kind === "cover" ? { coverUrl: path } : { avatarUrl: path } });
      await queryClient.invalidateQueries();
      toast.success(kind === "cover" ? "Cover updated" : "Picture updated");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-border sm:h-56">
        <MediaImage value={cover} alt={`${name} cover`} className="h-full w-full" fallback={name} />
        {editable ? (
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold shadow-sm"
          >
            {busy === "cover" ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            Cover
          </button>
        ) : null}
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handle("cover", e.target.files?.[0])}
        />
      </div>

      <div className="-mt-12 ml-6 inline-block">
        <div className="relative">
          <div className="size-24 overflow-hidden rounded-2xl border-4 border-background">
            <MediaImage value={avatar} alt={name} className="h-full w-full" fallback={name} />
          </div>
          {editable ? (
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              aria-label="Change picture"
              className="absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-sm"
            >
              {busy === "avatar" ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
          ) : null}
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handle("avatar", e.target.files?.[0])}
          />
        </div>
      </div>
    </div>
  );
}
