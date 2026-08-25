import type { MigrationFunction } from "./types"

const FALLBACK_TARGET_CODE = "cmn"
const FALLBACK_PROVIDER_ID = "deepseek-default"

/** Add the selection translation settings while preserving all v1 values. */
export const migrate: MigrationFunction = (input) => {
  const config = (input && typeof input === "object" ? input : {}) as Record<string, any>
  const language = config.language as Record<string, any> | undefined
  const translate = config.translate as Record<string, any> | undefined

  return {
    ...config,
    selectionTranslation: config.selectionTranslation ?? {
      enabled: true,
      targetCode: language?.targetCode ?? FALLBACK_TARGET_CODE,
      providerId: translate?.providerId ?? FALLBACK_PROVIDER_ID,
    },
  }
}
