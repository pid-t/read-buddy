import type { APICallError } from "ai"
import type { TransNode } from "@/types/dom"
import * as React from "react"
import textSmallCSS from "@/assets/styles/text-small.css?inline"
import themeCSS from "@/assets/styles/theme.css?inline"
import { TranslationError } from "@/components/translation/error"
import { createReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { BLOCK_CONTENT_CLASS, INLINE_CONTENT_CLASS, NOTRANSLATE_CLASS, TRANSLATION_ERROR_CONTAINER_CLASS } from "../../../constants/dom-labels"
import { isBlockTransNode, isCustomForceBlockTranslation, isHTMLElement, isInlineTransNode } from "../../dom/filter"
import { getContainingShadowRoot, getOwnerDocument } from "../../dom/node"
import { ensurePresetStyles } from "./style-injector"
import { isForceInlineTranslation } from "./translation-utils"

const LOADING_SEPARATOR_ATTRIBUTE = "data-read-frog-loading-separator"
const LIGHT_SKELETON_BACKGROUND = "#e4e4e4"
const LIGHT_SKELETON_SHINE = "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.95) 50%, transparent 100%)"
const DARK_SKELETON_BACKGROUND = "#242424"
const DARK_SKELETON_SHINE = "linear-gradient(90deg, transparent 0%, rgba(95, 95, 95, 0.95) 50%, transparent 100%)"
type RgbColor = [number, number, number]
type RgbaColor = [number, number, number, number]
const colorContextByDocument = new WeakMap<Document, CanvasRenderingContext2D | null>()

function parseRgbChannel(channel: string): number | null {
  const value = channel.endsWith("%")
    ? Number(channel.slice(0, -1)) * 2.55
    : Number(channel)
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.min(255, Math.max(0, value))
}

function parseRgbAlpha(alpha: string | undefined): number | null {
  if (alpha === undefined) {
    return 1
  }
  const value = alpha.endsWith("%")
    ? Number(alpha.slice(0, -1)) / 100
    : Number(alpha)
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.min(1, Math.max(0, value))
}

function parseRgbColor(color: string): RgbaColor | null {
  const match = color.trim().match(/^rgba?\((.*?)\)$/i)
  if (!match) {
    return null
  }

  const channels = match[1].split(/[,\s/]+/).filter(Boolean)
  if (channels.length < 3 || channels.length > 4) {
    return null
  }

  const red = parseRgbChannel(channels[0])
  const green = parseRgbChannel(channels[1])
  const blue = parseRgbChannel(channels[2])
  const alpha = parseRgbAlpha(channels[3])
  if (red === null || green === null || blue === null || alpha === null) {
    return null
  }

  return [red, green, blue, alpha]
}

function getColorContext(ownerDoc: Document): CanvasRenderingContext2D | null {
  if (colorContextByDocument.has(ownerDoc)) {
    return colorContextByDocument.get(ownerDoc) ?? null
  }

  let context: CanvasRenderingContext2D | null = null
  try {
    const canvas = ownerDoc.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    context = canvas.getContext("2d")
  }
  catch {
    context = null
  }
  colorContextByDocument.set(ownerDoc, context)
  return context
}

function parseCssColorWithCanvas(ownerDoc: Document, color: string): RgbaColor | null {
  const context = getColorContext(ownerDoc)
  if (!context) {
    return null
  }

  try {
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = "rgba(0, 0, 0, 0)"
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const pixel = context.getImageData(0, 0, 1, 1).data
    if (pixel.length < 4) {
      return null
    }
    return [pixel[0], pixel[1], pixel[2], pixel[3] / 255]
  }
  catch {
    return null
  }
}

function relativeLuminance([red, green, blue]: RgbColor): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function compositeBackgroundColor(background: RgbColor, foreground: RgbaColor): RgbColor {
  const [red, green, blue, alpha] = foreground
  return [
    red * alpha + background[0] * (1 - alpha),
    green * alpha + background[1] * (1 - alpha),
    blue * alpha + background[2] * (1 - alpha),
  ]
}

function getComposedParent(node: Node): Node | null {
  if ("assignedSlot" in node) {
    const assignedSlot = (node as Node & { assignedSlot?: HTMLSlotElement | null }).assignedSlot
    if (assignedSlot) {
      return assignedSlot
    }
  }

  if (node.parentElement) {
    return node.parentElement
  }

  const root = node.getRootNode()
  if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && "host" in root) {
    const host = (root as ShadowRoot).host
    return host.nodeType === Node.ELEMENT_NODE ? host : null
  }

  return null
}

function getComposedAncestorElements(ownerDoc: Document, referenceNode?: Element | Text): Element[] {
  const elements: Element[] = []
  const inspected = new Set<Node>()
  let currentNode: Node | null = referenceNode ?? null

  while (currentNode && !inspected.has(currentNode)) {
    inspected.add(currentNode)
    if (currentNode.nodeType === Node.ELEMENT_NODE) {
      elements.push(currentNode as Element)
    }
    currentNode = getComposedParent(currentNode)
  }

  for (const element of [ownerDoc.body, ownerDoc.documentElement]) {
    if (element && !elements.includes(element)) {
      elements.push(element)
    }
  }

  return elements
}

function getCanvasBackgroundColor(ownerDoc: Document): RgbColor {
  const view = ownerDoc.defaultView
  const documentElement = ownerDoc.documentElement
  const colorScheme = documentElement
    ? view?.getComputedStyle(documentElement).colorScheme?.trim().toLowerCase()
    : undefined

  if (!colorScheme || colorScheme === "normal") {
    return [255, 255, 255]
  }

  const schemes = colorScheme.split(/\s+/)
  if (schemes.includes("dark") && schemes.includes("light")) {
    return view?.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? [0, 0, 0]
      : [255, 255, 255]
  }
  if (schemes.includes("dark")) {
    return [0, 0, 0]
  }
  if (schemes.includes("light")) {
    return [255, 255, 255]
  }

  return [255, 255, 255]
}

function findBackgroundColor(ownerDoc: Document, referenceNode?: Element | Text): RgbColor {
  const view = ownerDoc.defaultView
  const elements = getComposedAncestorElements(ownerDoc, referenceNode)
  let background = getCanvasBackgroundColor(ownerDoc)

  for (let index = elements.length - 1; index >= 0; index--) {
    const color = view?.getComputedStyle(elements[index]).backgroundColor
    const rgba = color
      ? parseRgbColor(color) ?? parseCssColorWithCanvas(ownerDoc, color)
      : null
    if (rgba) {
      background = compositeBackgroundColor(background, rgba)
    }
  }

  return background
}

function isLikelyDarkPage(ownerDoc: Document, referenceNode?: Element | Text): boolean {
  return relativeLuminance(findBackgroundColor(ownerDoc, referenceNode)) < 0.18
}

/**
 * Create a lightweight loading skeleton without React/Shadow DOM overhead.
 * Uses Web Animations API instead of CSS keyframes to avoid extra DOM injection.
 */
export function createLightweightSpinner(ownerDoc: Document, backgroundReferenceNode?: Element | Text): HTMLElement {
  const skeleton = ownerDoc.createElement("span")
  skeleton.className = "read-frog-loading-skeleton"
  skeleton.setAttribute("aria-hidden", "true")
  // Inline styles keep the loading state resilient against host page CSS overrides.
  skeleton.style.cssText = `
    display: inline-block !important;
    width: min(24em, 100%) !important;
    min-width: 8em !important;
    max-width: 100% !important;
    margin: 0.35em 0 !important;
    padding: 0 !important;
    vertical-align: middle !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
    flex-shrink: 1 !important;
    flex-grow: 0 !important;
    align-self: stretch !important;
    pointer-events: none !important;
  `

  const line = ownerDoc.createElement("span")
  line.className = "read-frog-loading-skeleton-line"
  const isDarkPage = isLikelyDarkPage(ownerDoc, backgroundReferenceNode)
  const skeletonBackground = isDarkPage ? DARK_SKELETON_BACKGROUND : LIGHT_SKELETON_BACKGROUND
  const skeletonShine = isDarkPage ? DARK_SKELETON_SHINE : LIGHT_SKELETON_SHINE
  line.style.cssText = `
    position: relative !important;
    display: block !important;
    overflow: hidden !important;
    width: 100% !important;
    height: 0.75em !important;
    min-height: 8px !important;
    max-height: 14px !important;
    margin: 0 !important;
    padding: 0 !important;
    border-radius: 3px !important;
    background: ${skeletonBackground} !important;
    box-sizing: border-box !important;
  `
  const shine = ownerDoc.createElement("span")
  shine.className = "read-frog-loading-skeleton-shine"
  shine.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    display: block !important;
    width: 45% !important;
    height: 100% !important;
    background-image: ${skeletonShine} !important;
    transform: translateX(-130%) !important;
    will-change: transform !important;
  `
  line.appendChild(shine)
  skeleton.appendChild(line)

  // Respect user's motion preferences.
  const prefersReducedMotion = ownerDoc.defaultView?.matchMedia
    ? ownerDoc.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false
  if (!prefersReducedMotion && shine.animate) {
    shine.animate(
      [
        { transform: "translateX(-130%)" },
        { transform: "translateX(280%)" },
      ],
      {
        duration: 850,
        iterations: Infinity,
        easing: "linear",
      },
    )
  }

  return skeleton
}

function markLoadingSeparator(translatedWrapperNode: HTMLElement, spinner: HTMLElement): void {
  const separator = spinner.previousElementSibling
  if (separator?.parentElement === translatedWrapperNode) {
    separator.setAttribute(LOADING_SEPARATOR_ATTRIBUTE, "")
  }
}

function removeLoadingIndicator(spinner: HTMLElement): void {
  const separator = spinner.previousElementSibling
  if (separator?.hasAttribute(LOADING_SEPARATOR_ATTRIBUTE)) {
    separator.remove()
  }
  spinner.remove()
}

function addInlineLoading(ownerDoc: Document, translatedWrapperNode: HTMLElement, spinner: HTMLElement): void {
  const spaceNode = ownerDoc.createElement("span")
  spaceNode.textContent = "  "
  translatedWrapperNode.appendChild(spaceNode)
  spinner.classList.add(NOTRANSLATE_CLASS, INLINE_CONTENT_CLASS)
}

function addBlockLoading(ownerDoc: Document, translatedWrapperNode: HTMLElement, spinner: HTMLElement): void {
  const brNode = ownerDoc.createElement("br")
  translatedWrapperNode.appendChild(brNode)
  spinner.classList.add(NOTRANSLATE_CLASS, BLOCK_CONTENT_CLASS)
}

function appendPositionedLoading(
  translatedWrapperNode: HTMLElement,
  targetNode: TransNode,
  spinner: HTMLElement,
  forceBlockTranslation: boolean,
): boolean {
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
  const forceInlineTranslation = isForceInlineTranslation(targetNode)
  const customForceBlock = isHTMLElement(targetNode) && isCustomForceBlockTranslation(targetNode)

  if (customForceBlock) {
    addBlockLoading(ownerDoc, translatedWrapperNode, spinner)
  }
  else if (forceInlineTranslation) {
    addInlineLoading(ownerDoc, translatedWrapperNode, spinner)
  }
  else if (forceBlockTranslation) {
    addBlockLoading(ownerDoc, translatedWrapperNode, spinner)
  }
  else if (isInlineTransNode(targetNode)) {
    addInlineLoading(ownerDoc, translatedWrapperNode, spinner)
  }
  else if (isBlockTransNode(targetNode)) {
    addBlockLoading(ownerDoc, translatedWrapperNode, spinner)
  }
  else {
    return false
  }

  translatedWrapperNode.appendChild(spinner)
  return true
}

interface CreateSpinnerInsideOptions {
  targetNode?: TransNode
  forceBlockTranslation?: boolean
  backgroundReferenceNode?: Element | Text
}

export function createSpinnerInside(
  translatedWrapperNode: HTMLElement,
  options: CreateSpinnerInsideOptions = {},
): HTMLElement {
  const {
    targetNode,
    forceBlockTranslation = false,
    backgroundReferenceNode,
  } = options
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
  const root = getContainingShadowRoot(translatedWrapperNode) ?? ownerDoc
  ensurePresetStyles(root)
  const spinner = createLightweightSpinner(ownerDoc, backgroundReferenceNode ?? targetNode ?? translatedWrapperNode)

  if (targetNode && appendPositionedLoading(translatedWrapperNode, targetNode, spinner, forceBlockTranslation)) {
    markLoadingSeparator(translatedWrapperNode, spinner)
  }
  else {
    translatedWrapperNode.appendChild(spinner)
  }

  return spinner
}

export async function getTranslatedTextAndRemoveSpinner(
  nodes: ChildNode[],
  textContent: string,
  spinner: HTMLElement,
  translatedWrapperNode: HTMLElement,
  translateText: (text: string) => Promise<string>,
): Promise<string | undefined> {
  let translatedText: string | undefined

  try {
    translatedText = await translateText(textContent)
  }
  catch (error) {
    const errorComponent = React.createElement(TranslationError, {
      nodes,
      error: error as APICallError,
    })

    const container = createReactShadowHost(
      errorComponent,
      {
        className: TRANSLATION_ERROR_CONTAINER_CLASS,
        position: "inline",
        inheritStyles: false,
        cssContent: [themeCSS, textSmallCSS],
        style: {
          verticalAlign: "middle",
        },
      },
    )

    translatedWrapperNode.appendChild(container)
  }
  finally {
    removeLoadingIndicator(spinner)
  }

  return translatedText
}
