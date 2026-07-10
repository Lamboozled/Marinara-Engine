import type { AgentPromptTemplateOption } from "../types/agent.js";

export const GAME_VIDEO_PROMPT_TEMPLATE_ID = "cinematic-scene-video";
export const GAME_ANIME_VIDEO_PROMPT_TEMPLATE_ID = "anime-game-video";

export const GAME_VIDEO_PROMPT_TEMPLATE_VARIABLES = [
  "sceneTitle",
  "narrationSummary",
  "illustrationPrompt",
  "charactersLine",
  "settingLine",
  "artStyleLine",
  "durationSeconds",
  "aspectRatio",
  "sourceIllustrationLine",
  "experienceStyleLine",
  "motionPlanLine",
  "continuityLine",
  "transitionLine",
] as const;

export const GAME_VIDEO_PROMPT_TEMPLATE = [
  "Create a ${durationSeconds}-second ${aspectRatio} animated game scene from the provided first-frame illustration.",
  "${sourceIllustrationLine}",
  "Scene: ${sceneTitle}",
  "Story beat: ${narrationSummary}",
  "Characters: ${charactersLine}",
  "Setting: ${settingLine}",
  "Art style: ${artStyleLine}",
  "Reference prompt excerpt: ${illustrationPrompt}",
  "Use the reference image as the visual anchor. Keep recognizable characters, setting, and mood while adding motion that feels natural for this moment.",
  "You may choose the most cinematic camera drift, focus shift, gestures, atmospheric movement, and ending pose that fit the scene.",
  "Avoid subtitles, captions, UI, logos, watermarks, unrelated new characters, distorted anatomy, and abrupt cuts.",
].join("\n");

export const GAME_ANIME_VIDEO_PROMPT_TEMPLATE = [
  "Animate the supplied first-frame image as one continuous ${durationSeconds}-second ${aspectRatio} anime shot.",
  "${sourceIllustrationLine}",
  "Scene: ${sceneTitle}",
  "Story beat: ${narrationSummary}",
  "Characters: ${charactersLine}",
  "Setting: ${settingLine}",
  "Art style: ${artStyleLine}",
  "First-frame prompt: ${illustrationPrompt}",
  "${motionPlanLine}",
  "${continuityLine}",
  "${transitionLine}",
  "Begin on the exact supplied composition. Follow the planned subject action before adding restrained camera or environmental motion, preserve screen direction and cause-before-effect continuity, and settle on the stated stable ending pose.",
  "Keep identities, faces, anatomy, outfits, equipment, injuries, props, setting geometry, lighting, and art style stable. Do not introduce unrelated characters or objects.",
  "Use provider-safe cinematic staging: imply graphic harm through framing, silhouette, occlusion, reaction, or aftermath rather than adding explicit anatomical detail. Do not add subtitles, captions, UI, logos, watermarks, text morphing, abrupt cuts, or identity drift.",
].join("\n");

export const GAME_VIDEO_BUILT_IN_PROMPT_TEMPLATES: AgentPromptTemplateOption[] = [
  {
    id: GAME_VIDEO_PROMPT_TEMPLATE_ID,
    name: "Cinematic Scene Video",
    description:
      "Default Game Mode video prompt for animating a saved scene or storyboard keyframe from its first-frame image.",
    promptTemplate: GAME_VIDEO_PROMPT_TEMPLATE,
  },
  {
    id: GAME_ANIME_VIDEO_PROMPT_TEMPLATE_ID,
    name: "Anime Game Video",
    description:
      "Storyboard-only anime motion preset with first-frame continuity, causal action, stable identities, and provider-safe staging.",
    promptTemplate: GAME_ANIME_VIDEO_PROMPT_TEMPLATE,
  },
];
