export const TRANSLATION_STATE_KEY_PREFIX = "session:translationState" as const

export function getTranslationStateKey(tabId: number): `session:translationState.${number}` {
  return `${TRANSLATION_STATE_KEY_PREFIX}.${tabId}` as const
}

export const DETECTED_CODE_STATE_KEY_PREFIX = "session:detectedCode" as const

export function getDetectedCodeStateKey(tabId: number): `session:detectedCode.${number}` {
  return `${DETECTED_CODE_STATE_KEY_PREFIX}.${tabId}` as const
}

export function getSmartFilterCacheKey(tabId: number): `session:smartFilterCache.${number}` {
  return `session:smartFilterCache.${tabId}` as const
}
