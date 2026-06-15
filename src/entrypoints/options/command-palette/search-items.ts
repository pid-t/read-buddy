import type { GeneratedI18nStructure } from "#i18n"

type I18nKey = keyof GeneratedI18nStructure

export interface SearchItem {
  sectionId: string
  route: string
  titleKey: string
  descriptionKey?: string
  pageKey: string
}

type SearchItemDefinition = Omit<SearchItem, "titleKey" | "descriptionKey" | "pageKey"> & {
  titleKey: I18nKey
  descriptionKey?: I18nKey
  pageKey: I18nKey
}

const CONFIG_SEARCH_ITEMS = [
  {
    sectionId: "reset-config",
    route: "/config",
    titleKey: "options.config.resetConfig.title",
    descriptionKey: "options.config.resetConfig.description",
    pageKey: "options.config.title",
  },
] satisfies SearchItemDefinition[]

export const SEARCH_ITEMS: SearchItem[] = [
  // General page
  {
    sectionId: "ui-locale",
    route: "/",
    titleKey: "options.general.uiLocale.title" as I18nKey,
    descriptionKey: "options.general.uiLocale.description" as I18nKey,
    pageKey: "options.general.title",
  },
  {
    sectionId: "feature-providers",
    route: "/",
    titleKey: "options.general.featureProviders.title",
    descriptionKey: "options.general.featureProviders.description",
    pageKey: "options.general.title",
  },
  {
    sectionId: "site-control-mode",
    route: "/",
    titleKey: "options.siteControl.mode.title",
    descriptionKey: "options.siteControl.mode.description",
    pageKey: "options.general.title",
  },

  // API Providers page
  {
    sectionId: "api-providers",
    route: "/api-providers",
    titleKey: "options.apiProviders.title",
    descriptionKey: "options.apiProviders.description",
    pageKey: "options.apiProviders.title",
  },

  // Translation page
  {
    sectionId: "translation-mode",
    route: "/translation",
    titleKey: "options.translation.translationMode.title",
    descriptionKey: "options.translation.translationMode.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "translate-range",
    route: "/translation",
    titleKey: "options.translation.translateRange.title",
    descriptionKey: "options.translation.translateRange.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "page-translation-shortcut",
    route: "/translation",
    titleKey: "options.translation.pageTranslationShortcut.title",
    descriptionKey: "options.translation.pageTranslationShortcut.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "node-translation-hotkey",
    route: "/translation",
    titleKey: "options.translation.nodeTranslationHotkey.title",
    descriptionKey: "options.translation.nodeTranslationHotkey.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "custom-translation-style",
    route: "/translation",
    titleKey: "options.translation.translationStyle.title",
    descriptionKey: "options.translation.translationStyle.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "ai-content-aware",
    route: "/translation",
    titleKey: "options.translation.aiContentAware.title",
    descriptionKey: "options.translation.aiContentAware.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "personalized-prompts",
    route: "/translation",
    titleKey: "options.translation.personalizedPrompts.title",
    descriptionKey: "options.translation.personalizedPrompts.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "auto-translate-website",
    route: "/translation",
    titleKey: "options.translation.autoTranslateWebsite.title",
    descriptionKey: "options.translation.autoTranslateWebsite.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "never-auto-translate-website",
    route: "/translation",
    titleKey: "options.translation.neverAutoTranslateWebsite.title",
    descriptionKey: "options.translation.neverAutoTranslateWebsite.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "auto-translate-languages",
    route: "/translation",
    titleKey: "options.translation.autoTranslateLanguages.title",
    descriptionKey: "options.translation.autoTranslateLanguages.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "skip-languages",
    route: "/translation",
    titleKey: "options.translation.skipLanguages.title",
    descriptionKey: "options.translation.skipLanguages.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "request-rate",
    route: "/translation",
    titleKey: "options.translation.requestQueueConfig.title",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "request-batch",
    route: "/translation",
    titleKey: "options.translation.batchQueueConfig.title",
    descriptionKey: "options.translation.batchQueueConfig.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "preload-config",
    route: "/translation",
    titleKey: "options.translation.preloadConfig.title",
    descriptionKey: "options.translation.preloadConfig.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "small-paragraph-filter",
    route: "/translation",
    titleKey: "options.translation.smallParagraphFilter.title",
    descriptionKey: "options.translation.smallParagraphFilter.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "clear-cache",
    route: "/translation",
    titleKey: "options.general.clearCache.title",
    descriptionKey: "options.general.clearCache.description",
    pageKey: "options.translation.title",
  },

  // Video Subtitles page
  {
    sectionId: "subtitles-config",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.title",
    descriptionKey: "options.videoSubtitles.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-style",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.style.title",
    descriptionKey: "options.videoSubtitles.style.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-custom-prompts",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.customPrompts.title",
    descriptionKey: "options.videoSubtitles.customPrompts.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-request-rate",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.requestQueueConfig.title",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-request-batch",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.batchQueueConfig.title",
    descriptionKey: "options.videoSubtitles.batchQueueConfig.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "clear-ai-segmentation-cache",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.aiSegmentation.clearCacheDialog.title",
    descriptionKey: "options.videoSubtitles.aiSegmentation.clearCacheDialog.description",
    pageKey: "options.videoSubtitles.title",
  },

  // Config page
  ...CONFIG_SEARCH_ITEMS,
] satisfies SearchItemDefinition[]
