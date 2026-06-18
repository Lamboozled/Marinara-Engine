// ──────────────────────────────────────────────
// Custom Emoji tab — the EmojiPicker's "Custom" panel (Conversation mode).
// Lists global custom emojis (click → insert :name:), uploads new ones, and
// (in edit mode) renames/deletes them. Rendered into EmojiPicker via its
// optional `customTab` slot so the picker itself stays generic.
// ──────────────────────────────────────────────
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  useCustomEmojis,
  useUploadCustomEmoji,
  useRenameCustomEmoji,
  useDeleteCustomEmoji,
} from "../../hooks/use-custom-emojis";
import { readImageDimensions, validateDimensionsForKind, slugifyCustomName } from "../../lib/custom-emoji";
import { showPromptDialog, showConfirmDialog } from "../../lib/app-dialogs";
import { cn } from "../../lib/utils";

export function CustomEmojiTab({ onInsert }: { onInsert: (token: string) => void }) {
  const { data: emojis } = useCustomEmojis();
  const upload = useUploadCustomEmoji();
  const rename = useRenameCustomEmoji();
  const remove = useDeleteCustomEmoji();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = emojis ?? [];

  const handleFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setError(null);

      const objectUrl = URL.createObjectURL(file);
      try {
        const { width, height } = await readImageDimensions(objectUrl);
        const valid = validateDimensionsForKind(width, height, "emoji");
        if (!valid.ok) {
          setError(valid.reason);
          return;
        }
        const suggested = slugifyCustomName(file.name.replace(/\.[^.]+$/, ""));
        const raw = await showPromptDialog({
          title: "Name this emoji",
          message: "Use it in messages as :name: — lowercase letters, numbers, and underscores.",
          defaultValue: suggested,
          placeholder: "e.g. kekw",
          confirmLabel: "Add",
        });
        if (raw == null) return;
        const name = slugifyCustomName(raw);
        if (!name) {
          setError("Enter a valid name (letters, numbers, or underscores).");
          return;
        }
        await upload.mutateAsync({ file, name, width, height });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add emoji.");
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [upload],
  );

  const handleRename = useCallback(
    async (id: string, current: string) => {
      const raw = await showPromptDialog({
        title: "Rename emoji",
        message: "New name (used as :name:).",
        defaultValue: current,
        confirmLabel: "Rename",
      });
      if (raw == null) return;
      const name = slugifyCustomName(raw);
      if (!name || name === current) return;
      rename.mutate({ id, name });
    },
    [rename],
  );

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (
        await showConfirmDialog({
          title: "Delete emoji",
          message: `Delete :${name}:? Messages that already used it will show the text instead.`,
          confirmLabel: "Delete",
          tone: "destructive",
        })
      ) {
        remove.mutate(id);
      }
    },
    [remove],
  );

  return (
    <div className="px-1">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1 text-xs text-foreground/70 ring-1 ring-foreground/10 transition-colors hover:bg-foreground/10 hover:text-foreground/90"
        >
          <ImagePlus size="0.875rem" /> Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors",
              editing
                ? "bg-foreground/10 text-foreground/80 ring-1 ring-foreground/15"
                : "text-foreground/45 hover:bg-foreground/10 hover:text-foreground/70",
            )}
          >
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {error && <p className="mb-2 px-1 text-[0.6875rem] text-red-400">{error}</p>}

      {list.length === 0 ? (
        <p className="px-1 py-6 text-center text-[0.6875rem] text-foreground/45">
          No custom emojis yet. Upload one (max 256×256) to use it as <span className="font-mono">:name:</span>.
        </p>
      ) : (
        <div className="grid grid-cols-6 gap-1">
          {list.map((emoji) => (
            <div key={emoji.id} className="group relative">
              <button
                type="button"
                onClick={() => (editing ? void handleRename(emoji.id, emoji.name) : onInsert(`:${emoji.name}:`))}
                title={editing ? `Rename :${emoji.name}:` : `:${emoji.name}:`}
                className="flex aspect-square w-full items-center justify-center rounded-md p-1 transition-transform hover:scale-110 hover:bg-foreground/10 active:scale-100"
              >
                <img src={emoji.url} alt={`:${emoji.name}:`} className="max-h-9 max-w-full object-contain" />
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => void handleDelete(emoji.id, emoji.name)}
                  title={`Delete :${emoji.name}:`}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--destructive)] text-white shadow ring-1 ring-black/10 transition-transform hover:scale-110"
                >
                  <Trash2 size="0.625rem" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
