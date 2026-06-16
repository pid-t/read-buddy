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

function parseRgbColor(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!match)
    return null

  const alpha = match[4] === undefined ? 1 : Number(match[4])
  if (alpha === 0)
    return null

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isLikelyDarkPage(ownerDoc: Document): boolean {
  const view = ownerDoc.defaultView
  const elements = [ownerDoc.body, ownerDoc.documentElement].filter(Boolean)

  for (const element of elements) {
    const color = view?.getComputedStyle(element).backgroundColor
    const rgb = color ? parseRgbColor(color) : null
    if (rgb) {
      return relativeLuminance(rgb) < 0.18
    }
  }

  return view?.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
}

/**
 * Create a lightweight loading skeleton without React/Shadow DOM overhead.
 * Uses Web Animations API instead of CSS keyframes to avoid extra DOM injection.
 */
export function createLightweightSpinner(ownerDoc: Document): HTMLElement {
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
  const isDarkPage = isLikelyDarkPage(ownerDoc)
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

export function createSpinnerInside(
  translatedWrapperNode: HTMLElement,
  targetNode?: TransNode,
  forceBlockTranslation: boolean = false,
): HTMLElement {
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
  const root = getContainingShadowRoot(translatedWrapperNode) ?? ownerDoc
  ensurePresetStyles(root)
  const spinner = createLightweightSpinner(ownerDoc)

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
