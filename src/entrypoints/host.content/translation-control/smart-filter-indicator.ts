import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { i18n } from "@/utils/i18n"

const HOST_ATTRIBUTE = "data-read-frog-smart-filter-indicator"

export interface SmartFilterIndicatorActions {
  onSkip: () => void
  onCancel: () => void
}

export function mountSmartFilterIndicator({ onSkip, onCancel }: SmartFilterIndicatorActions): () => void {
  if (window !== window.top)
    return () => {}

  const host = document.createElement("div")
  host.className = NOTRANSLATE_CLASS
  host.setAttribute(HOST_ATTRIBUTE, "")
  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = `
    :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; color: #008573; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .edge { position: absolute; inset: 0; box-shadow: inset 0 0 18px 4px #12a594; opacity: .34; animation: breathe 3.6s ease-in-out infinite; transition: opacity 600ms ease; }
    .pill { box-sizing: border-box; position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: 300px; max-width: calc(100vw - 24px); height: 44px; padding: 0 10px 0 14px; display: flex; align-items: center; gap: 7px; border: 0; border-radius: 999px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.14); color: #171717; pointer-events: auto; opacity: 1; transition: opacity 150ms ease; }
    .label { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; font-size: 13px; font-weight: 550; }
    .elapsed { color: #737373; font-variant-numeric: tabular-nums; font-size: 12px; }
    button { min-height: 40px; border: 0; padding: 5px 7px; border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; }
    .skip-action { color: #008573; }
    button:hover { background: rgba(18,165,148,.1); }
    button:focus-visible { outline: 2px solid #12a594; outline-offset: 1px; }
    .close { width: 40px; height: 40px; display: grid; place-items: center; font-size: 18px; line-height: 1; }
    .bars { height: 16px; display: flex; align-items: center; gap: 2px; }
    .bars i { display: block; width: 3px; height: 12px; border-radius: 3px; background: #12a594; transform: scaleY(.45); transform-origin: center; animation: bars 1.5s ease-in-out infinite alternate; }
    .bars i:nth-child(2) { animation-delay: 250ms; }
    .bars i:nth-child(3) { animation-delay: 500ms; }
    @keyframes breathe { 0%,100% { opacity: .18; } 50% { opacity: .56; } }
    @keyframes bars { to { transform: scaleY(1); } }
    @media (prefers-reduced-motion: reduce) { .edge { opacity: .3; animation: none; transition-duration: 0ms; } .bars i { animation: none; transform: scaleY(.65); } .pill { transition-duration: 0ms; } }
  `
  const edge = document.createElement("div")
  edge.className = "edge"
  edge.setAttribute("aria-hidden", "true")
  const pill = document.createElement("div")
  pill.className = "pill"
  const bars = document.createElement("span")
  bars.className = "bars"
  bars.setAttribute("aria-hidden", "true")
  bars.innerHTML = "<i></i><i></i><i></i>"
  const label = document.createElement("span")
  label.className = "label"
  label.setAttribute("role", "status")
  label.setAttribute("aria-live", "polite")
  label.textContent = i18n.t("options.translation.smartFilter.waiting" as Parameters<typeof i18n.t>[0])
  const elapsed = document.createElement("span")
  elapsed.className = "elapsed"
  elapsed.setAttribute("aria-hidden", "true")
  elapsed.textContent = "0s"
  const skip = document.createElement("button")
  skip.type = "button"
  skip.className = "skip-action"
  skip.textContent = i18n.t("options.translation.smartFilter.translateNow")
  skip.addEventListener("click", onSkip)
  const close = document.createElement("button")
  close.type = "button"
  close.className = "close"
  close.textContent = "×"
  close.setAttribute("aria-label", i18n.t("options.translation.smartFilter.close" as Parameters<typeof i18n.t>[0]))
  close.addEventListener("click", onCancel)
  pill.append(bars, label, elapsed, skip, close)
  shadow.append(style, edge, pill)
  document.documentElement.append(host)

  let cleaned = false
  const startedAt = Date.now()
  const timer = setInterval(() => {
    elapsed.textContent = `${Math.floor((Date.now() - startedAt) / 1000)}s`
  }, 250)

  return () => {
    if (cleaned)
      return
    cleaned = true
    clearInterval(timer)
    pill.inert = true
    pill.style.pointerEvents = "none"
    pill.style.opacity = "0"
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) {
      edge.style.animation = "none"
      edge.style.opacity = "0"
      host.remove()
      return
    }
    edge.style.opacity = getComputedStyle(edge).opacity
    edge.style.animation = "none"
    void edge.offsetHeight
    requestAnimationFrame(() => {
      edge.style.opacity = "0"
    })
    window.setTimeout(() => host.remove(), 620)
  }
}
