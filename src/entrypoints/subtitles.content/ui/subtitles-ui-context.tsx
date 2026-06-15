import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import type { UniversalVideoAdapter } from "@/entrypoints/subtitles.content/universal-adapter"
import type { Config } from "@/types/config/config"
import { Provider as JotaiProvider } from "jotai"
import { createContext, use, useEffect } from "react"
import { configAtom } from "@/utils/atoms/config"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { subtitlesStore } from "../atoms"

interface SubtitlesUIContextValue {
  toggleSubtitles: (enabled: boolean) => void
  downloadSourceSubtitles: () => Promise<void>
  downloadTranslatedSubtitles: () => Promise<void>
  controlsConfig?: ControlsConfig
  embedded?: boolean
}

export const SubtitlesUIContext = createContext<SubtitlesUIContextValue | null>(null)

export function useSubtitlesUI() {
  const ui = use(SubtitlesUIContext)
  if (!ui) {
    throw new Error("useSubtitlesUI must be used within SubtitlesUIContext")
  }
  return ui
}

export type SubtitlesProvidersAdapter = Pick<
  UniversalVideoAdapter,
  "downloadSourceSubtitles" | "downloadTranslatedSubtitles" | "embedded" | "getControlsConfig" | "toggleSubtitlesManually"
>

export function SubtitlesProviders({
  adapter,
  children,
  initialConfig,
}: {
  adapter: SubtitlesProvidersAdapter
  children: React.ReactNode
  initialConfig?: Config
}) {
  if (initialConfig) {
    subtitlesStore.set(configAtom, initialConfig)
  }

  useEffect(() => {
    if (initialConfig) {
      return
    }

    let cancelled = false
    void getLocalConfig().then((config) => {
      if (!cancelled) {
        subtitlesStore.set(configAtom, config ?? DEFAULT_CONFIG)
      }
    })

    return () => {
      cancelled = true
    }
  }, [initialConfig])

  return (
    <JotaiProvider store={subtitlesStore}>
      <SubtitlesUIContext
        value={{
          toggleSubtitles: adapter.toggleSubtitlesManually,
          downloadSourceSubtitles: adapter.downloadSourceSubtitles,
          downloadTranslatedSubtitles: adapter.downloadTranslatedSubtitles,
          controlsConfig: adapter.getControlsConfig(),
          embedded: adapter.embedded,
        }}
      >
        {children}
      </SubtitlesUIContext>
    </JotaiProvider>
  )
}
