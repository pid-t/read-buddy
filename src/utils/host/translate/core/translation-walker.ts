import type { SmartFilterPageState } from "../../smart-filter/page-state"
import type { Config } from "@/types/config/config"
import {
  BLOCK_ATTRIBUTE,
  CONTENT_WRAPPER_CLASS,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { isBlockTransNode, isHTMLElement, isTextNode, isTransNode } from "../../dom/filter"
import { translateNodes } from "./translation-modes"

export async function translateWalkedElement(
  element: HTMLElement,
  walkId: string,
  config: Config,
  toggle: boolean = false,
  smartFilter?: SmartFilterPageState,
): Promise<void> {
  if (!element.isConnected)
    return

  if (smartFilter?.isNodeSkipped(element))
    return

  if (!toggle && element.querySelector(`.${CONTENT_WRAPPER_CLASS}`))
    return

  // if the walkId is not the same, return
  if (element.getAttribute(WALKED_ATTRIBUTE) !== walkId)
    return

  const promises: Promise<void>[] = []

  if (element.hasAttribute(PARAGRAPH_ATTRIBUTE)) {
    let hasBlockNodeChild = false

    for (const child of element.childNodes) {
      if (isHTMLElement(child) && child.hasAttribute(BLOCK_ATTRIBUTE)) {
        hasBlockNodeChild = true
        break
      }
    }

    const computedStyle = window.getComputedStyle(element)
    const isFlexParent = computedStyle.display.includes("flex")

    if (!hasBlockNodeChild) {
      promises.push(translateNodes([element], walkId, toggle, config, false, smartFilter))
    }
    else {
      // prevent children change during iteration
      const children = [...element.childNodes]
      let consecutiveInlineNodes: ChildNode[] = []
      for (const child of children) {
        if (smartFilter?.isNodeSkipped(child)) {
          if (consecutiveInlineNodes.length) {
            promises.push(translateNodes(consecutiveInlineNodes, walkId, toggle, config, !isFlexParent, smartFilter))
            consecutiveInlineNodes = []
          }
          continue
        }

        if (isTransNode(child) && isBlockTransNode(child) && !isTextNode(child)) {
          // force the children to be block translation style unless the parent is a flex parent
          promises.push(translateNodes(consecutiveInlineNodes, walkId, toggle, config, !isFlexParent, smartFilter))
          consecutiveInlineNodes = []
          promises.push(translateWalkedElement(child, walkId, config, toggle, smartFilter))
        }
        else {
          consecutiveInlineNodes.push(child)
        }
      }

      if (consecutiveInlineNodes.length) {
        promises.push(translateNodes(consecutiveInlineNodes, walkId, toggle, config, !isFlexParent, smartFilter))
        consecutiveInlineNodes = []
      }
    }
  }
  else {
    for (const child of element.childNodes) {
      if (isHTMLElement(child) && !smartFilter?.isNodeSkipped(child)) {
        promises.push(translateWalkedElement(child, walkId, config, toggle, smartFilter))
      }
    }
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child) && !smartFilter?.isNodeSkipped(child)) {
          promises.push(translateWalkedElement(child, walkId, config, toggle, smartFilter))
        }
      }
    }
  }
  // This simultaneously ensures that when concurrent translation
  // and external await call this function, all translations are completed
  await Promise.all(promises)
}
