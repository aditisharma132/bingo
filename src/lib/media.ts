import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "media";

export async function uploadMedia(file: File, prefix: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sign in to upload images.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be under 5 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

export async function resolveMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("http") || value.startsWith("data:")) return value;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(value, 60 * 60);
  return data?.signedUrl ?? null;
}

export function useMediaUrl(value: string | null | undefined) {
  const query = useQuery({
    queryKey: ["media-url", value],
    queryFn: () => resolveMediaUrl(value),
    enabled: !!value,
    staleTime: 50 * 60 * 1000,
  });
  return query.data ?? null;
}
