import type { Config } from "@/types/config/config"
import type { Point } from "@/types/dom"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { isHTMLElement } from "../dom/filter"
import { findNearestAncestorBlockNodeAt } from "../dom/find"
import { walkAndLabelElement } from "../dom/traversal"
import { translateWalkedElement } from "./core/translation-walker"
import { validateTranslationConfigAndToast } from "./translate-text"

// Re-export public APIs
export { translateNodes, translateNodesBilingualMode, translateNodeTranslationOnlyMode } from "./core/translation-modes"
export { translateWalkedElement } from "./core/translation-walker"
export { removeAllTranslatedWrapperNodes } from "./dom/translation-cleanup"

/**
 * Toggle translation for an already resolved block element.
 *
 * The hover trigger resolves a block at dwell start. Keeping this API
 * element-based prevents a later layout change from resolving a different
 * block from the original pointer coordinates.
 */
export async function removeOrShowNodeTranslationAtElement(node: HTMLElement, config: Config): Promise<boolean> {
  if (!validateTranslationConfigAndToast({
    providersConfig: config.providersConfig,
    translate: config.translate,
    language: config.language,
  })) {
    return false
  }

  const id = getRandomUUID()
  walkAndLabelElement(node, id, config)
  await translateWalkedElement(node, id, config, true)
  return true
}

// Coordinate-based compatibility API used by existing callers.
export async function removeOrShowNodeTranslation(point: Point, config: Config): Promise<boolean> {
  const node = findNearestAncestorBlockNodeAt(point)

  if (!node || !isHTMLElement(node))
    return false

  return removeOrShowNodeTranslationAtElement(node, config)
}
