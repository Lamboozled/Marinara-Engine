import { AsyncLocalStorage } from "node:async_hooks";

export type GenerationFallbackCategory = "main" | "agents" | "illustrator" | "video";

export type GenerationFallbackNotice = {
  category: GenerationFallbackCategory;
  connectionId: string;
  connectionName: string;
  model: string;
};

export type GenerationFallbackNotifier = (notice: GenerationFallbackNotice) => void;

export const GENERATION_FALLBACK_HEADER = "X-Marinara-Fallback-Used";

const fallbackNotifierContext = new AsyncLocalStorage<GenerationFallbackNotifier>();

export function runWithGenerationFallbackNotifier<T>(notifier: GenerationFallbackNotifier, callback: () => T): T {
  return fallbackNotifierContext.run(notifier, callback);
}

export function notifyGenerationFallback(notice: GenerationFallbackNotice): void {
  fallbackNotifierContext.getStore()?.(notice);
}

export function encodeGenerationFallbackNotice(notice: GenerationFallbackNotice): string {
  return encodeURIComponent(JSON.stringify(notice));
}
