import type { TestSeriesObject } from "./types"

export const testSeries: TestSeriesObject = {
  "complex-config-from-v020": {
    description: "Adds opacity to selection toolbar; project to translation-only schema",
    config: {
      language: {
        sourceCode: "spa",
        targetCode: "eng",
        level: "advanced",
      },
      providersConfig: [
        {
          id: "microsoft-translate-default",
          enabled: true,
          name: "Microsoft Translator",
          provider: "microsoft-translate",
        },
        {
          id: "google-translate-default",
          enabled: true,
          name: "Google Translate",
          provider: "google-translate",
        },
        {
          id: "openai-default",
          enabled: true,
          name: "OpenAI",
          provider: "openai",
          apiKey: "sk-custom-prompt-key",
          baseURL: "https://api.openai.com/v1",
          model: {
            model: "gpt-4o-mini",
            isCustomModel: true,
            customModel: "translate-gpt-custom",
          },
        },
        {
          id: "deepseek-default",
          enabled: true,
          name: "DeepSeek",
          provider: "deepseek",
          apiKey: "ds-custom",
          baseURL: "https://api.custom.com/v1",
          model: {
            model: "deepseek-chat",
            isCustomModel: false,
            customModel: "",
          },
        },
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: undefined,
          baseURL: undefined,
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
        {
          id: "deeplx-default",
          enabled: true,
          name: "DeepLX",
          provider: "deeplx",
          apiKey: undefined,
          baseURL: "https://deeplx.vercel.app/translate",
        },
      ],
      translate: {
        providerId: "openai-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: [
            "spanish-news.com",
            "elmundo.es",
          ],
          neverAutoTranslatePatterns: [],
          autoTranslateLanguages: [],
          shortcut: "Alt+B",
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          enableTargetLanguageSkip: true,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: "123e4567-e89b-12d3-a456-426614174000",
          patterns: [
            {
              id: "123e4567-e89b-12d3-a456-426614174000",
              name: "Technical Translation",
              systemPrompt: "",
              prompt: "Technical translation from Spanish to {{targetLanguage}}. Preserve technical terms and accuracy:\n"
                + "{{input}}",
            },
          ],
        },
        requestQueueConfig: {
          capacity: 400,
          rate: 8,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "blur",
          isCustom: false,
          customCSS: null,
        },
      },
      languageDetection: {
        mode: "basic",
        providerId: "openai-default",
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "openai-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 400,
          rate: 8,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        position: {
          percent: 10,
          anchor: "bottom",
        },
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
    },
  },
  "config-with-llm-detection-enabled": {
    description: "Single provider, LLM detection mode; features get enabled toggles and speak added; project to translation-only schema",
    config: {
      language: {
        sourceCode: "jpn",
        targetCode: "eng",
        level: "beginner",
      },
      providersConfig: [
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: "goog-key",
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      ],
      translate: {
        providerId: "google-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: [],
          neverAutoTranslatePatterns: [],
          autoTranslateLanguages: [],
          shortcut: "Alt+B",
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          enableTargetLanguageSkip: true,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "default",
          isCustom: false,
          customCSS: null,
        },
      },
      languageDetection: {
        mode: "llm",
        providerId: "google-default",
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "google-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        position: {
          percent: 10,
          anchor: "bottom",
        },
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
    },
  },
  "prompt-token-migration-coverage": {
    description: "Covers legacy prompt token migration for translate, custom actions, and video subtitles; project to translation-only schema",
    config: {
      language: {
        sourceCode: "eng",
        targetCode: "cmn",
        level: "intermediate",
      },
      providersConfig: [
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: "goog-key",
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      ],
      translate: {
        providerId: "google-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: [],
          neverAutoTranslatePatterns: [],
          autoTranslateLanguages: [],
          shortcut: "Alt+B",
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          enableTargetLanguageSkip: true,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: "legacy-translate-prompt",
          patterns: [
            {
              id: "legacy-translate-prompt",
              name: "Legacy Translate Prompt",
              systemPrompt: "Translate into {{targetLanguage}} with title {{webTitle}} and summary {{webSummary}}.",
              prompt: "Title: {{webTitle}}\n"
                + "Summary: {{webSummary}}\n"
                + "Translate to {{targetLanguage}}:\n"
                + "{{input}}",
            },
          ],
        },
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "default",
          isCustom: false,
          customCSS: null,
        },
      },
      languageDetection: {
        mode: "basic",
        providerId: "google-default",
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "google-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: "legacy-subtitles-prompt",
          patterns: [
            {
              id: "legacy-subtitles-prompt",
              name: "Legacy Subtitles Prompt",
              systemPrompt: "Translate subtitles into {{targetLanguage}} with {{webTitle}} and {{videoSummary}} as context.",
              prompt: "Title: {{webTitle}}\n"
                + "Summary: {{videoSummary}}\n"
                + "Translate to {{targetLanguage}}:\n"
                + "{{input}}",
            },
          ],
        },
        position: {
          percent: 10,
          anchor: "bottom",
        },
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
    },
  },
  "default-dictionary-wording": {
    description: "Renames dictionary wording from context to paragraphs; project to translation-only schema",
    config: {
      language: {
        sourceCode: "eng",
        targetCode: "cmn",
        level: "intermediate",
      },
      providersConfig: [
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: "goog-key",
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      ],
      translate: {
        providerId: "google-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: [],
          neverAutoTranslatePatterns: [],
          autoTranslateLanguages: [],
          shortcut: "Alt+B",
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          enableTargetLanguageSkip: true,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "default",
          isCustom: false,
          customCSS: null,
        },
      },
      languageDetection: {
        mode: "basic",
        providerId: "google-default",
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "google-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        position: {
          percent: 10,
          anchor: "bottom",
        },
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
    },
  },
}
