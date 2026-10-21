import type { SmartRegion, SmartRegionCollection, SmartRegionCollectionOptions } from "./types"
import type { Config } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { FORCE_BLOCK_TAGS } from "@/utils/constants/dom-rules"
import {
  isDontWalkIntoAndDontTranslateAsChildElement,
  isEditable,
  isHTMLElement,
  isShallowBlockHTMLElement,
  isTextNode,
  isTranslatedContentNode,
  isTranslatedWrapperNode,
} from "../dom/filter"
import { MAX_HEADING_LENGTH, MAX_REGION_COUNT, MAX_REGION_TEXT_LENGTH, MAX_TOTAL_INPUT_LENGTH } from "./types"

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6"
const SAMPLE_LENGTH_FACTOR = 2
const FORM_VALUE_TAGS = new Set(["INPUT", "OPTION", "SELECT", "TEXTAREA"])

interface RegionQueueItem {
  element: HTMLElement
  parentId: string | null
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function isEditableForSampling(element: HTMLElement): boolean {
  let current: HTMLElement | null = element
  while (current) {
    if (isEditable(current))
      return true
    if (current.hasAttribute("contenteditable") && current.getAttribute("contenteditable") !== "false")
      return true
    current = current.parentElement
  }
  return false
}

function isIgnoredForSampling(element: HTMLElement, config: Config): boolean {
  return FORM_VALUE_TAGS.has(element.tagName)
    || isTranslatedWrapperNode(element)
    || isTranslatedContentNode(element)
    || isEditableForSampling(element)
    || isDontWalkIntoAndDontTranslateAsChildElement(element, config)
}

function getComposedParent(node: Node): Node | null {
  if (node.parentNode)
    return node.parentNode
  const root = node.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

/**
 * Check the node and its ancestors (including open shadow hosts) before
 * sampling. This prevents headings inside hidden or translated containers from
 * leaking into the region data.
 */
function isAllowedForSampling(node: HTMLElement, config: Config): boolean {
  let current: Node | null = node
  while (current) {
    if (isHTMLElement(current) && isIgnoredForSampling(current, config))
      return false
    current = getComposedParent(current)
  }
  return true
}

/**
 * Collect visible text from a subtree, skipping hidden, editable, form and
 * extension translated content. Open shadow roots are included.
 */
function sampleVisibleText(node: Node, config: Config, maxLength: number): string {
  const chunks: string[] = []
  let rawLength = 0
  const rawLimit = maxLength * SAMPLE_LENGTH_FACTOR

  const visit = (current: Node): void => {
    if (rawLength >= rawLimit)
      return
    if (isTextNode(current)) {
      const text = current.textContent ?? ""
      chunks.push(text)
      rawLength += text.length
      return
    }
    if (!isHTMLElement(current))
      return
    if (isIgnoredForSampling(current, config))
      return

    if (current.shadowRoot) {
      for (const child of current.shadowRoot.childNodes)
        visit(child)
    }
    for (const child of current.childNodes)
      visit(child)
  }

  visit(node)
  return normalizeText(chunks.join("")).slice(0, maxLength)
}

function findAllowedHeading(root: HTMLElement, config: Config): HTMLElement | null {
  if (root.matches(HEADING_SELECTOR) && isAllowedForSampling(root, config))
    return root

  for (const heading of root.querySelectorAll(HEADING_SELECTOR)) {
    if (isHTMLElement(heading) && isAllowedForSampling(heading, config))
      return heading
  }

  return null
}

function findNearbyHeading(element: HTMLElement, config: Config): string | null {
  const directHeading = findAllowedHeading(element, config)

  if (directHeading) {
    const text = sampleVisibleText(directHeading, config, MAX_HEADING_LENGTH)
    if (text)
      return text
  }

  let current: HTMLElement | null = element
  let depth = 0
  while (current && depth < 4) {
    if (current.matches(HEADING_SELECTOR) && isAllowedForSampling(current, config)) {
      const text = sampleVisibleText(current, config, MAX_HEADING_LENGTH)
      if (text)
        return text
    }

    for (let sibling = current.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (!isHTMLElement(sibling))
        continue
      const heading = findAllowedHeading(sibling, config)
      if (!heading)
        continue
      const text = sampleVisibleText(heading, config, MAX_HEADING_LENGTH)
      if (text)
        return text
    }

    current = current.parentElement
    depth++
  }

  return null
}

function isRegionCandidate(element: HTMLElement): boolean {
  return FORCE_BLOCK_TAGS.has(element.tagName) || isShallowBlockHTMLElement(element)
}

/**
 * Collect up to MAX_REGION_COUNT block regions in breadth first order. The
 * provided root is only used as context and is not emitted as a region.
 */
export function collectSmartRegions(
  root: Document | HTMLElement | ShadowRoot = document,
  config: Config = DEFAULT_CONFIG,
  options: SmartRegionCollectionOptions = {},
): SmartRegionCollection {
  const regions: SmartRegion[] = []
  const nodeById = new Map<string, HTMLElement>()
  const queue: RegionQueueItem[] = []
  let totalInputLength = 0

  const context = root instanceof Document ? root.body : root
  if (!context)
    return { regions, nodeById }

  const contextElement = context instanceof ShadowRoot ? context.host : context
  if (!isHTMLElement(contextElement) || !isAllowedForSampling(contextElement, config))
    return { regions, nodeById }

  const enqueueChildren = (parent: ParentNode, parentId: string | null): void => {
    if (isHTMLElement(parent) && parent.shadowRoot && !isIgnoredForSampling(parent, config)) {
      for (const child of parent.shadowRoot.children) {
        if (isHTMLElement(child) && !isIgnoredForSampling(child, config))
          queue.push({ element: child, parentId })
      }
    }
    for (const child of parent.children) {
      if (isHTMLElement(child) && !isIgnoredForSampling(child, config))
        queue.push({ element: child, parentId })
    }
  }

  enqueueChildren(context, null)

  let queueIndex = 0
  while (queueIndex < queue.length && regions.length < MAX_REGION_COUNT) {
    const { element, parentId } = queue[queueIndex++]

    const text = isRegionCandidate(element) && (options.shouldCollect?.(element) ?? true)
      ? sampleVisibleText(element, config, MAX_REGION_TEXT_LENGTH)
      : ""

    let childParentId = parentId
    if (text) {
      const region: SmartRegion = {
        id: `r${regions.length + 1}`,
        parentId,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role")?.trim() || null,
        heading: findNearbyHeading(element, config),
        text,
      }
      const inputLength = JSON.stringify(region).length
      if (totalInputLength + inputLength <= MAX_TOTAL_INPUT_LENGTH) {
        regions.push(region)
        nodeById.set(region.id, element)
        totalInputLength += inputLength
        childParentId = region.id
      }
    }

    enqueueChildren(element, childParentId)
  }

  return { regions, nodeById }
}
