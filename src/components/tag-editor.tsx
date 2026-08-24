import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTag, listEntityTags, removeTag } from "@/lib/social.functions";

export function TagEditor({
  entityType,
  entityId,
  editable = true,
}: {
  entityType: "creator" | "brand" | "campaign";
  entityId: string;
  editable?: boolean;
}) {
  const queryClient = useQueryClient();
  const fetchTags = useServerFn(listEntityTags);
  const add = useServerFn(addTag);
  const remove = useServerFn(removeTag);
  const [label, setLabel] = useState("");

  const key = ["entity-tags", entityType, entityId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchTags({ data: { entityType, entityId } }),
    enabled: !!entityId,
  });

  const addMutation = useMutation({
    mutationFn: () => add({ data: { label, entityType, entityId } }),
    onSuccess: () => {
      setLabel("");
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("Tag added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (entityTagId: string) => remove({ data: { entityTagId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data ?? [];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom tags yet.</p>
        ) : (
          rows.map((row: any) => (
            <span
              key={row.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm"
              title={row.tag?.related?.length ? `Matches: ${row.tag.related.join(", ")}` : undefined}
            >
              {row.tag?.label}
              {editable ? (
                <button
                  type="button"
                  aria-label={`Remove ${row.tag?.label}`}
                  onClick={() => removeMutation.mutate(row.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </span>
          ))
        )}
      </div>

      {editable ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (label.trim()) addMutation.mutate();
          }}
        >
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Add a custom label or category…"
            maxLength={40}
          />
          <Button type="submit" variant="outline" disabled={addMutation.isPending || !label.trim()}>
            {addMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
