import "@/utils/zod-config"
import { defineContentScript } from "#imports"
import { getLocalConfig } from "@/utils/config/storage"
import { applyI18nLocale } from "@/utils/i18n"

declare global {
  interface Window {
    __READ_FROG_SUBTITLES_INJECTED__?: boolean
  }
}

export default defineContentScript({
  matches: ["*://*.youtube.com/*", "*://*.youtube-nocookie.com/*"],
  allFrames: true,
  cssInjectionMode: "manifest",
  async main(ctx) {
    if (window.__READ_FROG_SUBTITLES_INJECTED__)
      return
    window.__READ_FROG_SUBTITLES_INJECTED__ = true

    const config = await getLocalConfig()
    await applyI18nLocale(config?.uiLocale)
    if (!config?.videoSubtitles?.enabled) {
      window.__READ_FROG_SUBTITLES_INJECTED__ = false
      return
    }

    ctx.onInvalidated(() => {
      window.__READ_FROG_SUBTITLES_INJECTED__ = false
    })

    const { bootstrapSubtitlesRuntime } = await import("./runtime")
    await bootstrapSubtitlesRuntime(config)
  },
})
