import "@/utils/zod-config"
import type { Config } from "@/types/config/config"
import { Provider as JotaiProvider } from "jotai"
import { createRoot } from "react-dom/client"
import { createShadowRootUi, defineContentScript } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { NOTRANSLATE_CLASS, REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { applyI18nLocale } from "@/utils/i18n"
import { insertShadowRootUIWrapperInto } from "@/utils/shadow-root"
import { getLocalThemeMode } from "@/utils/theme"
import { SelectionApp } from "./app"
import "@/assets/styles/theme.css"

declare global {
  interface Window {
    __READ_FROG_SELECTION_INJECTED__?: boolean
  }
}

export default defineContentScript({
  matches: ["*://*/*", "file:///*"],
  allFrames: true,
  matchAboutBlank: true,
  cssInjectionMode: "ui",
  async main(ctx) {
    if (window.__READ_FROG_SELECTION_INJECTED__)
      return
    window.__READ_FROG_SELECTION_INJECTED__ = true

    const initialConfig = await getLocalConfig() ?? DEFAULT_CONFIG
    const themeMode = await getLocalThemeMode()
    await applyI18nLocale(initialConfig.uiLocale)

    const ui = await createShadowRootUi(ctx, {
      name: "read-frog-selection-translation",
      mode: "closed",
      position: "overlay",
      alignment: "top-left",
      anchor: "body",
      zIndex: 2147483647,
      isolateEvents: ["pointerdown", "pointerup", "click", "mousedown", "mouseup", "keydown", "keyup", "keypress"],
      onMount(uiContainer, _shadow, shadowHost) {
        shadowHost.classList.add(REACT_SHADOW_HOST_CLASS, NOTRANSLATE_CLASS)
        shadowHost.setAttribute("data-read-frog-selection-ui", "true")
        const wrapper = insertShadowRootUIWrapperInto(uiContainer)
        wrapper.setAttribute("data-read-frog-selection-wrapper", "true")
        const root = createRoot(wrapper)
        root.render(
          <JotaiProvider>
            <SelectionApp initialConfig={initialConfig as Config} themeMode={themeMode} container={wrapper} />
          </JotaiProvider>,
        )
        return { root }
      },
      onRemove(mounted) {
        mounted?.root.unmount()
        window.__READ_FROG_SELECTION_INJECTED__ = false
      },
    })

    ui.mount()
  },
})
