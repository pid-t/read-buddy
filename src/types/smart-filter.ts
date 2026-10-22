/** Bumped when the inline filtering rules or prompt contract change. */
export const INLINE_SMART_FILTER_STRATEGY_VERSION = 1

/** Serialized structure of one translation unit. DOM nodes stay in the content script. */
export interface InlineSmartFilterAncestorHint {
  tag: string
  role: string | null
  classes?: string[]
}

export interface InlineSmartFilterUnitHint {
  tag: string
  role: string | null
  ancestors: InlineSmartFilterAncestorHint[]
}

/** Optional marker attached only by automatic page translation. */
export interface InlineSmartFilterRequestContext {
  strategyVersion: number
  hint: InlineSmartFilterUnitHint
}
