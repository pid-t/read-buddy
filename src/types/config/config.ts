import { langCodeISO6393Schema, langLevel } from "@read-frog/definitions"

import { z } from "zod"
import { FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { languageDetectionConfigSchema } from "./language-detection"
import { isLLMProvider, NON_API_TRANSLATE_PROVIDERS_MAP, providersConfigSchema } from "./provider"
import { videoSubtitlesSchema } from "./subtitles"
import { translateConfigSchema } from "./translate"
// Language schema
const languageSchema = z.object({
  sourceCode: langCodeISO6393Schema.or(z.literal("auto")),
  targetCode: langCodeISO6393Schema,
  level: langLevel,
})

// site control schema
const siteControlSchema = z.object({
  mode: z.enum(["blacklist", "whitelist"]),
  blacklistPatterns: z.array(z.string()),
  whitelistPatterns: z.array(z.string()),
})

// Complete config schema
export const configSchema = z.object({
  language: languageSchema,
  providersConfig: providersConfigSchema,
  translate: translateConfigSchema,
  languageDetection: languageDetectionConfigSchema,
  videoSubtitles: videoSubtitlesSchema,
  siteControl: siteControlSchema,
}).superRefine((data, ctx) => {
  const providerIdsSet = new Set(data.providersConfig.map(p => p.id))

  for (const def of Object.values(FEATURE_PROVIDER_DEFS)) {
    const providerId = def.getProviderId(data)

    const validIds = new Set(providerIdsSet)
    for (const [type, name] of Object.entries(NON_API_TRANSLATE_PROVIDERS_MAP)) {
      if (def.isProvider(type))
        validIds.add(name)
    }

    if (!validIds.has(providerId)) {
      ctx.addIssue({
        code: "invalid_value",
        values: [...validIds],
        message: `Invalid provider id "${providerId}".`,
        path: [...def.configPath],
      })
      continue
    }

    const provider = data.providersConfig.find(p => p.id === providerId)
    if (provider && !def.isProvider(provider.provider)) {
      ctx.addIssue({
        code: "invalid_value",
        values: [...validIds],
        message: `Provider "${providerId}" is not a valid provider for this feature.`,
        path: [...def.configPath],
      })
    }

    if (provider && !provider.enabled) {
      ctx.addIssue({
        code: "custom",
        message: `Provider "${providerId}" must be enabled for this feature.`,
        path: [...def.configPath],
      })
    }
  }

  // Validate languageDetection: when mode is "llm", providerId must be a valid enabled LLM provider
  if (data.languageDetection.mode === "llm") {
    const ldProviderId = data.languageDetection.providerId
    if (!ldProviderId) {
      ctx.addIssue({
        code: "custom",
        message: `Language detection mode is "llm" but no providerId is configured.`,
        path: ["languageDetection", "providerId"],
      })
    }
    else {
      const ldProvider = data.providersConfig.find(p => p.id === ldProviderId)
      if (!ldProvider) {
        ctx.addIssue({
          code: "custom",
          message: `Language detection provider "${ldProviderId}" not found in providersConfig.`,
          path: ["languageDetection", "providerId"],
        })
      }
      else {
        if (!isLLMProvider(ldProvider.provider)) {
          ctx.addIssue({
            code: "custom",
            message: `Language detection provider "${ldProviderId}" is not an LLM provider.`,
            path: ["languageDetection", "providerId"],
          })
        }
        if (!ldProvider.enabled) {
          ctx.addIssue({
            code: "custom",
            message: `Language detection provider "${ldProviderId}" must be enabled.`,
            path: ["languageDetection", "providerId"],
          })
        }
      }
    }
  }
})

export type Config = z.infer<typeof configSchema>
