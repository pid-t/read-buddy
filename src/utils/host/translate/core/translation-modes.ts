import type { Config } from "@/types/config/config"
import type { TranslationMode } from "@/types/config/translate"
import type { TransNode } from "@/types/dom"
import type { InlineSmartFilterRequestContext, InlineSmartFilterUnitHint } from "@/types/smart-filter"
import { INLINE_SMART_FILTER_STRATEGY_VERSION } from "@/types/smart-filter"
import {
  CONTENT_WRAPPER_CLASS,
  NOTRANSLATE_CLASS,
  TRANSLATION_MODE_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { batchDOMOperation, flushBatchedOperations } from "../../dom/batch-dom"
import { isBlockTransNode, isHTMLElement, isTextNode, isTransNode } from "../../dom/filter"
import { unwrapDeepestOnlyHTMLChild } from "../../dom/find"
import { getOwnerDocument } from "../../dom/node"
import { extractTextContent } from "../../dom/traversal"
import { removeTranslatedWrapperWithRestore } from "../dom/translation-cleanup"
import { insertTranslatedNodeIntoWrapper } from "../dom/translation-insertion"
import { findPreviousTranslatedWrapperInside } from "../dom/translation-wrapper"
import { shouldFilterSmallParagraph } from "../filter-small-paragraph"
import { prepareTranslationText } from "../text-preparation"
import { translateTextForPage } from "../translate-variants"
import { setTranslationDirAndLang } from "../translation-attributes"
import { createSpinnerInside, getTranslatedTextAndRemoveSpinner } from "../ui/spinner"
import { isNumericContent } from "../ui/translation-utils"
import { originalContentMap, translatingNodes } from "./translation-state"

interface WrapperPlacement {
  backgroundReferenceNode: TransNode
  insert: () => void
}

function createWrapperPlacement(
  targetNode: TransNode,
  transNodeCount: number,
  translatedWrapperNode: HTMLElement,
): WrapperPlacement {
  const insertAsSibling = isTextNode(targetNode) || transNodeCount > 1
  const backgroundReferenceNode
    = insertAsSibling && isHTMLElement(targetNode)
      ? targetNode.parentElement ?? targetNode
      : targetNode

  return {
    backgroundReferenceNode,
    insert: () => {
      if (insertAsSibling) {
        targetNode.parentNode?.insertBefore(
          translatedWrapperNode,
          targetNode.nextSibling,
        )
      }
      else {
        targetNode.appendChild(translatedWrapperNode)
      }
    },
  }
}

function getDisplayTranslation(sourceText: string, translatedText: string | undefined) {
  if (translatedText === undefined) {
    return undefined
  }

  return prepareTranslationText(sourceText) === prepareTranslationText(translatedText)
    ? ""
    : translatedText
}

const INLINE_SMART_FILTER_ANCESTOR_DEPTH = 3
const INLINE_SMART_FILTER_MAX_CLASSES = 5
const INLINE_SMART_FILTER_MAX_ATTRIBUTE_LENGTH = 120
const INLINE_SMART_FILTER_INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable]",
  "[role='button']",
  "[role='link']",
  "[role='textbox']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='combobox']",
  "[role='menuitem']",
].join(",")

function truncateInlineHintValue(value: string | null | undefined): string | null {
  if (!value)
    return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, INLINE_SMART_FILTER_MAX_ATTRIBUTE_LENGTH) : null
}

function getInlineHintClasses(element: HTMLElement): string[] | undefined {
  const classes = [...element.classList]
    .filter(name => name !== CONTENT_WRAPPER_CLASS && name !== NOTRANSLATE_CLASS && !name.startsWith("read-frog"))
    .slice(0, INLINE_SMART_FILTER_MAX_CLASSES)
    .map(name => name.slice(0, INLINE_SMART_FILTER_MAX_ATTRIBUTE_LENGTH))
  return classes.length > 0 ? classes : undefined
}

function getInlineHintElement(node: Node): HTMLElement | null {
  return isHTMLElement(node) ? node : node.parentElement
}

/** Build the serializable DOM hint for one translation unit. */
function createInlineSmartFilterRequest(node: Node): InlineSmartFilterRequestContext | null {
  const element = getInlineHintElement(node)
  if (!element)
    return null

  const hint: InlineSmartFilterUnitHint = {
    tag: element.tagName.toLowerCase(),
    role: truncateInlineHintValue(element.getAttribute("role")),
    ancestors: [],
  }

  let ancestor = element.parentElement
  while (ancestor && hint.ancestors.length < INLINE_SMART_FILTER_ANCESTOR_DEPTH) {
    hint.ancestors.push({
      tag: ancestor.tagName.toLowerCase(),
      role: truncateInlineHintValue(ancestor.getAttribute("role")),
      classes: getInlineHintClasses(ancestor),
    })
    ancestor = ancestor.parentElement
  }

  return {
    strategyVersion: INLINE_SMART_FILTER_STRATEGY_VERSION,
    hint,
  }
}

/** Mixed units keep their original interactive nodes through bilingual display. */
function containsInteractiveContent(nodes: readonly ChildNode[]): boolean {
  return nodes.some((node) => {
    if (!isHTMLElement(node))
      return false
    return node.matches(INLINE_SMART_FILTER_INTERACTIVE_SELECTOR)
      || node.querySelector(INLINE_SMART_FILTER_INTERACTIVE_SELECTOR) !== null
  })
}

function getUnitSourceText(nodes: readonly ChildNode[], config: Config): string {
  return nodes.filter(isTransNode).map(node => extractTextContent(node, config)).join("").trim()
}

function isInsideTranslatedWrapper(node: Node): boolean {
  if (isHTMLElement(node)) {
    return node.classList.contains(CONTENT_WRAPPER_CLASS)
      || node.closest(`.${CONTENT_WRAPPER_CLASS}`) !== null
  }
  const parent = node.parentNode
  return parent !== null && isHTMLElement(parent) && parent.closest(`.${CONTENT_WRAPPER_CLASS}`) !== null
}

function collectUnitSourceNodes(node: Node, result: Node[]): void {
  if (isInsideTranslatedWrapper(node))
    return
  result.push(node)
  for (const child of node.childNodes)
    collectUnitSourceNodes(child, result)
}

interface InlineSourceBoundary {
  parent: Node
  nodes: Node[]
}

interface InlineSourceRoots {
  roots: Node[]
  checkLocalBoundary: boolean
}

interface InlineSourceSnapshot {
  roots: Node[]
  parents: Array<Node | null>
  nodes: Node[]
  boundary: InlineSourceBoundary | null
  text: string
}

function isSameNodeSequence(a: readonly Node[], b: readonly Node[]): boolean {
  return a.length === b.length && a.every((node, index) => node === b[index])
}

/**
 * The mixed-unit branch only owns its own nodes. Include adjacent Text nodes
 * across extension wrappers so a newly inserted sibling invalidates the result.
 */
function createInlineSiblingBoundary(roots: readonly Node[]): InlineSourceBoundary | null {
  const first = roots[0]
  const last = roots.at(-1)
  const parent = first?.parentNode
  if (!first || !last || !parent || !roots.every(root => root.parentNode === parent))
    return null

  const children = [...parent.childNodes]
  const firstIndex = children.indexOf(first as ChildNode)
  const lastIndex = children.indexOf(last as ChildNode)
  if (firstIndex < 0 || lastIndex < firstIndex)
    return null

  const nodes: Node[] = []
  for (let index = firstIndex - 1; index >= 0; index--) {
    const child = children[index]
    if (isInsideTranslatedWrapper(child))
      continue
    if (!isTextNode(child))
      break
    nodes.unshift(child)
  }
  for (let index = firstIndex; index <= lastIndex; index++) {
    const child = children[index]
    if (!isInsideTranslatedWrapper(child))
      nodes.push(child)
  }
  for (let index = lastIndex + 1; index < children.length; index++) {
    const child = children[index]
    if (isInsideTranslatedWrapper(child))
      continue
    if (!isTextNode(child))
      break
    nodes.push(child)
  }

  return { parent, nodes }
}

/**
 * Keep the snapshot inside this translation unit. A sibling block unit in the
 * same parent must be able to finish without invalidating this unit.
 */
function getInlineSourceRoots(nodes: readonly ChildNode[], container: Node | null): InlineSourceRoots {
  if (nodes.length === 1 && isHTMLElement(nodes[0]))
    return { roots: [nodes[0]], checkLocalBoundary: false }

  if (container) {
    const sourceChildren = [...container.childNodes].filter(node => !isInsideTranslatedWrapper(node))
    if (sourceChildren.length === nodes.length
      && sourceChildren.every((node, index) => node === nodes[index])) {
      return { roots: [container], checkLocalBoundary: false }
    }
  }

  return { roots: [...nodes], checkLocalBoundary: true }
}

function createInlineSourceSnapshot(
  { roots, checkLocalBoundary }: InlineSourceRoots,
  nodes: readonly ChildNode[],
  config: Config,
): InlineSourceSnapshot | null {
  if (roots.length === 0 || roots.some(root => !root.isConnected))
    return null

  const sourceNodes: Node[] = []
  for (const root of roots)
    collectUnitSourceNodes(root, sourceNodes)
  return {
    roots,
    parents: roots.map(root => root.parentNode),
    nodes: sourceNodes,
    boundary: checkLocalBoundary ? createInlineSiblingBoundary(roots) : null,
    text: getUnitSourceText(nodes, config),
  }
}

/**
 * Drop a late result when the page session ended, the wrapper was replaced, or
 * the source unit changed while the request was in flight. The snapshot keeps
 * both effective text and the current source node set; extension wrappers and
 * their loading/error content are ignored.
 */
function canApplyInlineTranslation(
  nodes: readonly ChildNode[],
  snapshot: InlineSourceSnapshot | null,
  targetNode: TransNode,
  translatedWrapperNode: HTMLElement,
  walkId: string,
  config: Config,
): boolean {
  if (!snapshot
    || snapshot.roots.some((root, index) => !root.isConnected || root.parentNode !== snapshot.parents[index])
    || !targetNode.isConnected
    || !translatedWrapperNode.isConnected
    || translatedWrapperNode.getAttribute(WALKED_ATTRIBUTE) !== walkId) {
    return false
  }

  const currentNodes: Node[] = []
  for (const root of snapshot.roots)
    collectUnitSourceNodes(root, currentNodes)
  if (!isSameNodeSequence(currentNodes, snapshot.nodes))
    return false

  if (snapshot.boundary) {
    const currentBoundary = createInlineSiblingBoundary(snapshot.roots)
    if (!currentBoundary
      || currentBoundary.parent !== snapshot.boundary.parent
      || !isSameNodeSequence(currentBoundary.nodes, snapshot.boundary.nodes)) {
      return false
    }
  }

  return getUnitSourceText(nodes, config) === snapshot.text
}

export async function translateNodes(
  nodes: ChildNode[],
  walkId: string,
  toggle: boolean = false,
  config: Config,
  forceBlockTranslation: boolean = false,
  inlineSmartFilter: boolean = false,
): Promise<void> {
  const translationMode = config.translate.mode
  if (translationMode === "translationOnly") {
    await translateNodeTranslationOnlyMode(nodes, walkId, config, toggle, inlineSmartFilter)
  }
  else if (translationMode === "bilingual") {
    await translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation, inlineSmartFilter)
  }
}

export async function translateNodesBilingualMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  forceBlockTranslation: boolean = false,
  inlineSmartFilter: boolean = false,
): Promise<void> {
  const transNodes = nodes.filter((node): node is TransNode => isTransNode(node))
  if (transNodes.length === 0) {
    return
  }
  try {
    // prevent duplicate translation
    if (transNodes.every(node => translatingNodes.has(node))) {
      return
    }
    transNodes.forEach(node => translatingNodes.add(node))

    const lastNode = transNodes.at(-1)!
    const targetNode
      = transNodes.length === 1 && isBlockTransNode(lastNode) && isHTMLElement(lastNode)
        ? await unwrapDeepestOnlyHTMLChild(lastNode)
        : lastNode

    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(targetNode, walkId)
    if (existedTranslatedWrapper) {
      removeTranslatedWrapperWithRestore(existedTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        nodes.forEach(node => translatingNodes.delete(node))
        void translateNodesBilingualMode(nodes, walkId, config, toggle, forceBlockTranslation, inlineSmartFilter)
        return
      }
    }

    const textContent = transNodes.map(node => extractTextContent(node, config)).join("").trim()
    if (!textContent || isNumericContent(textContent))
      return

    if (await shouldFilterSmallParagraph(textContent, config))
      return

    const inlineContext = inlineSmartFilter ? createInlineSmartFilterRequest(targetNode) : null
    const translateText = inlineContext
      ? (text: string) => translateTextForPage(text, { inlineSmartFilter: inlineContext })
      : translateTextForPage
    const inlineSourceContainer = transNodes.length === 1 && isHTMLElement(transNodes[0])
      ? transNodes[0]
      : transNodes[0].parentNode
    const sourceSnapshot = inlineSmartFilter
      ? createInlineSourceSnapshot(
          getInlineSourceRoots(transNodes, inlineSourceContainer),
          transNodes,
          config,
        )
      : null

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement("span")
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "bilingual" satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    setTranslationDirAndLang(translatedWrapperNode, config)
    const placement = createWrapperPlacement(targetNode, transNodes.length, translatedWrapperNode)
    const spinner = createSpinnerInside(translatedWrapperNode, {
      targetNode,
      forceBlockTranslation,
      backgroundReferenceNode: placement.backgroundReferenceNode,
    })

    // Batch DOM insertion to reduce layout thrashing
    batchDOMOperation(placement.insert)

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode, translateText)

    const translatedText = getDisplayTranslation(textContent, realTranslatedText)

    if (!translatedText) {
      // Only remove wrapper if translation returned empty (not needed),
      // but keep it for error display (undefined)
      if (translatedText === "") {
        // Batch the remove operation to execute remove operation after insert operation
        batchDOMOperation(() => translatedWrapperNode.remove())
      }
      return
    }

    if (inlineSmartFilter) {
      flushBatchedOperations()
      if (!canApplyInlineTranslation(transNodes, sourceSnapshot, targetNode, translatedWrapperNode, walkId, config)) {
        batchDOMOperation(() => translatedWrapperNode.remove())
        return
      }
    }

    await insertTranslatedNodeIntoWrapper(
      translatedWrapperNode,
      targetNode,
      translatedText,
      config.translate.translationNodeStyle,
      forceBlockTranslation,
    )
  }
  finally {
    transNodes.forEach(node => translatingNodes.delete(node))
  }
}

export async function translateNodeTranslationOnlyMode(
  nodes: ChildNode[],
  walkId: string,
  config: Config,
  toggle: boolean = false,
  inlineSmartFilter: boolean = false,
): Promise<void> {
  const isTransNodeAndNotTranslatedWrapper = (node: Node): node is TransNode => {
    if (isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS))
      return false
    return isTransNode(node)
  }

  const outerTransNodes = nodes.filter((node): node is TransNode => isTransNode(node))
  if (outerTransNodes.length === 0) {
    return
  }

  const outerParentElement = outerTransNodes[0].parentElement

  // Inline filtering runs at unit level. Keep mixed units interactive through
  // the existing bilingual display path instead of adding a sub-region protocol.
  if (inlineSmartFilter && containsInteractiveContent(outerTransNodes)) {
    await translateNodesBilingualMode(nodes, walkId, config, toggle, false, inlineSmartFilter)
    return
  }

  // snapshot the outer parent element, to prevent lose it if we go to deeper by unwrapDeepestOnlyHTMLChild
  // test case is:
  // <div data-testid="test-node">
  //   <span style={{ display: 'inline' }}>原文</span> // get the outer parent snapshot before go to inner element
  //   <br />
  //   <span style={{ display: 'inline' }}>原文</span>
  //   原文
  //   <br />
  //   <span style={{ display: 'inline' }}>原文</span>
  // </div>,
  // Only save originalContent when there's no existing translation wrapper
  // If wrapper exists, we're removing translation and should restore from saved content
  const hasExistingWrapper = outerParentElement?.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
  if (outerParentElement && !originalContentMap.has(outerParentElement) && !hasExistingWrapper) {
    originalContentMap.set(outerParentElement, outerParentElement.innerHTML)
  }

  let transNodes: TransNode[] = []
  let allChildNodes: ChildNode[] = []
  if (outerTransNodes.length === 1 && isHTMLElement(outerTransNodes[0])) {
    const unwrappedHTMLChild = await unwrapDeepestOnlyHTMLChild(outerTransNodes[0])
    allChildNodes = [...unwrappedHTMLChild.childNodes]
    transNodes = allChildNodes
      .filter(isTransNodeAndNotTranslatedWrapper)
  }
  else {
    transNodes = outerTransNodes
    allChildNodes = nodes
  }

  if (transNodes.length === 0) {
    return
  }

  try {
    if (nodes.every(node => translatingNodes.has(node))) {
      return
    }
    nodes.forEach(node => translatingNodes.add(node))

    const targetNode = transNodes.at(-1)!

    const parentNode = targetNode.parentElement
    if (!parentNode) {
      console.error("targetNode.parentElement is not HTMLElement", targetNode.parentElement)
      return
    }
    const existedTranslatedWrapper = findPreviousTranslatedWrapperInside(targetNode.parentElement, walkId)
    const existedTranslatedWrapperOutside = targetNode.parentElement.closest(`.${CONTENT_WRAPPER_CLASS}`)

    const finalTranslatedWrapper = existedTranslatedWrapperOutside ?? existedTranslatedWrapper
    if (finalTranslatedWrapper && isHTMLElement(finalTranslatedWrapper)) {
      removeTranslatedWrapperWithRestore(finalTranslatedWrapper)
      if (toggle) {
        return
      }
      else {
        // In translationOnly mode, removeTranslatedWrapperWithRestore uses innerHTML to restore content,
        // which destroys the original DOM nodes and creates new ones. The 'nodes' array still references
        // the old detached nodes, and targetNode can't reference to the new dom added by innerHTML anymore.
        // Therefore, by recursively calling translateNodeTranslationOnlyMode here with the
        // same nodes array, we ensure the translation uses the newly created DOM elements since the
        // function will re-query and find the correct parent and child nodes from the restored DOM.
        nodes.forEach(node => translatingNodes.delete(node))
        void translateNodeTranslationOnlyMode(nodes, walkId, config, toggle, inlineSmartFilter)
        return
      }
    }

    const innerTextContent = transNodes.map(node => extractTextContent(node, config)).join("")
    if (!innerTextContent.trim() || isNumericContent(innerTextContent))
      return

    if (await shouldFilterSmallParagraph(innerTextContent, config))
      return

    // Only save originalContent when there's no existing translation wrapper
    const hasExistingWrapperInParent = parentNode.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
    if (!originalContentMap.has(parentNode) && !hasExistingWrapperInParent) {
      originalContentMap.set(parentNode, parentNode.innerHTML)
    }

    const textContent = innerTextContent
    if (!textContent)
      return

    const inlineContext = inlineSmartFilter ? createInlineSmartFilterRequest(targetNode) : null
    const translateText = inlineContext
      ? (text: string) => translateTextForPage(text, { inlineSmartFilter: inlineContext })
      : translateTextForPage
    const sourceSnapshot = inlineSmartFilter
      ? createInlineSourceSnapshot(
          getInlineSourceRoots(transNodes, parentNode),
          transNodes,
          config,
        )
      : null

    const ownerDoc = getOwnerDocument(targetNode)
    const translatedWrapperNode = ownerDoc.createElement("span")
    translatedWrapperNode.className = `${NOTRANSLATE_CLASS} ${CONTENT_WRAPPER_CLASS}`
    translatedWrapperNode.setAttribute(TRANSLATION_MODE_ATTRIBUTE, "translationOnly" satisfies TranslationMode)
    translatedWrapperNode.setAttribute(WALKED_ATTRIBUTE, walkId)
    translatedWrapperNode.style.display = "contents"
    setTranslationDirAndLang(translatedWrapperNode, config)
    const placement = createWrapperPlacement(targetNode, transNodes.length, translatedWrapperNode)
    const spinner = createSpinnerInside(translatedWrapperNode, {
      targetNode,
      backgroundReferenceNode: placement.backgroundReferenceNode,
    })

    // Batch DOM insertion to reduce layout thrashing
    batchDOMOperation(placement.insert)

    const realTranslatedText = await getTranslatedTextAndRemoveSpinner(nodes, textContent, spinner, translatedWrapperNode, translateText)
    const translatedText = realTranslatedText ? getDisplayTranslation(textContent, realTranslatedText) : realTranslatedText

    if (!translatedText) {
      // Keep the wrapper when translation failed so the injected error UI remains visible.
      // Only remove the wrapper when translation returned an empty string.
      if (translatedText === "") {
        // Batch the remove operation to execute remove operation after insert operation
        batchDOMOperation(() => translatedWrapperNode.remove())
      }
      return
    }

    if (inlineSmartFilter) {
      flushBatchedOperations()
      if (!canApplyInlineTranslation(transNodes, sourceSnapshot, targetNode, translatedWrapperNode, walkId, config)) {
        batchDOMOperation(() => translatedWrapperNode.remove())
        return
      }
    }

    translatedWrapperNode.textContent = translatedText

    // Batch final DOM mutations to reduce layout thrashing
    batchDOMOperation(() => {
      // Insert translated content after the last node
      const lastChildNode = allChildNodes.at(-1)!
      lastChildNode.parentNode?.insertBefore(translatedWrapperNode, lastChildNode.nextSibling)

      // Remove all original nodes
      allChildNodes.forEach(childNode => childNode.remove())
    })
  }
  finally {
    nodes.forEach(node => translatingNodes.delete(node))
  }
}
