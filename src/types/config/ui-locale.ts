import { z } from "zod"

export const UI_LOCALES = ["en", "es", "ja", "ko", "ru", "tr", "vi", "zh-CN", "zh-TW"] as const

export const uiLocaleSchema = z.enum(UI_LOCALES)

export type UiLocale = z.infer<typeof uiLocaleSchema>
