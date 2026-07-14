import { useState } from "react";
import { AlertCircle, Check, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import type {
  GenerateSpatialMapDraftResponse,
  SpatialContextDefinition,
  SpatialMapDraftSize,
  SpatialOwnerMode,
} from "@marinara-engine/shared";
import { useGenerateSpatialMapDraft } from "../../../hooks/use-spatial-context";
import { useUIStore } from "../../../stores/ui.store";
import { cn } from "../../../lib/utils";

interface SpatialMapAiBuilderProps {
  chatId: string;
  ownerMode: SpatialOwnerMode;
  open: boolean;
  hasLocations: boolean;
  dirty: boolean;
  onClose: () => void;
  onApply: (definition: SpatialContextDefinition) => void;
}

const SIZE_OPTIONS: Array<{
  value: SpatialMapDraftSize;
  label: string;
  description: string;
}> = [
  { value: "small", label: "Small", description: "About 8 places" },
  { value: "medium", label: "Medium", description: "About 16 places" },
  { value: "large", label: "Large", description: "About 28 places" },
];

function sourceCopy(ownerMode: SpatialOwnerMode): string {
  return ownerMode === "game"
    ? "Uses the game setup, world overview, and party characters. Turn history is not included."
    : "Uses the chat setup and character cards. Turn history is not included.";
}

export function SpatialMapAiBuilder({
  chatId,
  ownerMode,
  open,
  hasLocations,
  dirty,
  onClose,
  onApply,
}: SpatialMapAiBuilderProps) {
  const debugMode = useUIStore((state) => state.debugMode);
  const generateDraft = useGenerateSpatialMapDraft();
  const [size, setSize] = useState<SpatialMapDraftSize>("medium");
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState<GenerateSpatialMapDraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const generate = async () => {
    setError(null);
    try {
      const generated = await generateDraft.mutateAsync({
        chatId,
        size,
        instructions: instructions.trim() || undefined,
        debugMode,
      });
      setResult(generated);
    } catch (generationError) {
      setResult(null);
      setError(generationError instanceof Error ? generationError.message : "The map draft could not be generated.");
    }
  };
  const rootLocations = result?.definition.locations.filter((location) => location.parentId === null) ?? [];

  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto border-b border-[var(--marinara-editor-divider)] bg-[var(--marinara-editor-surface)]"
      aria-label="AI map builder"
    >
      <div className="flex items-start gap-3 border-b border-[var(--marinara-editor-divider)] px-4 py-3">
        <span className="mari-editor-icon-tile mt-0.5">
          <Sparkles size="1rem" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--marinara-editor-title)]">Draft the map with AI</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
            Describe the world in everyday language. The result stays local until you apply it, then Save confirms it.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close AI map builder" className="mari-editor-action">
          <X size="0.875rem" />
        </button>
      </div>

      <div className="grid min-h-0 gap-px bg-[var(--marinara-editor-divider)] lg:grid-cols-[minmax(20rem,0.9fr)_minmax(22rem,1.1fr)]">
        <div className="bg-[var(--marinara-editor-bg)] p-4">
          <label className="text-xs font-semibold text-[var(--marinara-editor-title)]" htmlFor="spatial-ai-request">
            What should this world include?
          </label>
          <textarea
            id="spatial-ai-request"
            value={instructions}
            disabled={generateDraft.isPending}
            onChange={(event) => {
              setInstructions(event.target.value);
              setResult(null);
              setError(null);
            }}
            maxLength={4_000}
            rows={4}
            placeholder="A misty coastal city with a harbor, market, haunted inn, lighthouse, and sewers beneath the old district."
            className="mt-2 w-full resize-y rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--marinara-chat-chrome-button-border-active)] focus:ring-2 focus:ring-[var(--marinara-chat-chrome-highlight-bg)] disabled:cursor-wait disabled:opacity-60"
          />
          <p className="mt-1 text-[0.625rem] leading-relaxed text-[var(--marinara-editor-muted)]">
            Optional. If left blank, Marinara builds from the existing setup.
          </p>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-[var(--marinara-editor-title)]">Map size</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={size === option.value}
                  disabled={generateDraft.isPending}
                  onClick={() => {
                    setSize(option.value);
                    setResult(null);
                    setError(null);
                  }}
                  className={cn(
                    "min-h-14 rounded-lg border px-2 py-2 text-left transition-colors duration-200 disabled:cursor-wait disabled:opacity-60",
                    size === option.value
                      ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] text-[var(--marinara-chat-chrome-button-text-active)]"
                      : "border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-editor-muted)]",
                  )}
                >
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[0.625rem]">{option.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <p className="mt-4 text-[0.625rem] leading-relaxed text-[var(--marinara-editor-muted)]">
            {sourceCopy(ownerMode)}
          </p>
          {(hasLocations || dirty) && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-300">
              <AlertCircle size="0.75rem" className="mt-0.5 shrink-0" />
              Applying the result replaces the current working map. Nothing changes on the server until Save.
            </p>
          )}
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generateDraft.isPending}
            className="mari-editor-action mari-editor-action--primary mt-4 inline-flex min-h-11 px-4 text-xs disabled:opacity-50"
          >
            {generateDraft.isPending ? (
              <>
                <LoaderCircle size="0.8125rem" className="animate-spin" /> Building map
              </>
            ) : result ? (
              <>
                <RefreshCw size="0.8125rem" /> Generate another
              </>
            ) : (
              <>
                <Sparkles size="0.8125rem" /> Generate draft
              </>
            )}
          </button>
        </div>

        <div className="flex min-h-56 flex-col bg-[var(--marinara-editor-bg)] p-4" aria-live="polite">
          <h3 className="text-xs font-semibold text-[var(--marinara-editor-title)]">Draft preview</h3>
          {generateDraft.isPending ? (
            <div className="mt-4 space-y-3" aria-label="Generating map draft">
              <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--marinara-editor-surface)]" />
              <div className="h-12 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
              <div className="h-12 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
              <div className="h-12 animate-pulse rounded-lg bg-[var(--marinara-editor-surface)]" />
            </div>
          ) : error ? (
            <div
              className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300"
              role="alert"
            >
              <p className="flex items-start gap-2">
                <AlertCircle size="0.8125rem" className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            </div>
          ) : result ? (
            <div className="mt-3 flex flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">
                  <Check size="0.6875rem" /> Validated
                </span>
                <span className="text-[var(--marinara-editor-muted)]">{result.generatedLocationCount} locations</span>
              </div>
              <div className="mt-3 divide-y divide-[var(--marinara-editor-divider)] border-y border-[var(--marinara-editor-divider)]">
                {rootLocations.slice(0, 5).map((location) => {
                  const childCount = result.definition.locations.filter(
                    (candidate) => candidate.parentId === location.id,
                  ).length;
                  return (
                    <div key={location.id} className="flex min-h-12 items-center gap-3 py-2">
                      <span className="text-lg" aria-hidden="true">
                        {location.icon || "⌖"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{location.name}</span>
                        <span className="block text-[0.625rem] capitalize text-[var(--marinara-editor-muted)]">
                          {location.kind} · {childCount} direct {childCount === 1 ? "place" : "places"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
                Apply the draft to inspect every description, private memory, link, layer, and map position before
                saving.
              </p>
              <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="mari-editor-action inline-flex min-h-11 px-3 text-xs"
                >
                  Keep current map
                </button>
                <button
                  type="button"
                  onClick={() => onApply(result.definition)}
                  className="mari-editor-action mari-editor-action--primary inline-flex min-h-11 px-4 text-xs"
                >
                  <Check size="0.8125rem" /> {hasLocations ? "Replace working draft" : "Use this draft"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
              <div className="max-w-xs">
                <Sparkles className="mx-auto text-[var(--marinara-editor-muted)]" size="1.25rem" />
                <p className="mt-3 text-sm font-medium text-[var(--marinara-editor-title)]">
                  Your generated hierarchy appears here
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--marinara-editor-muted)]">
                  It is validated before you can apply it.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
