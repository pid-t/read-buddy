// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react"
import { Provider as JotaiProvider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"
import { SubtitlesSettingsPanel } from ".."
import {
  subtitlesSettingsPanelOpenAtom,
  subtitlesStore,
  subtitlesUiLocaleVersionAtom,
} from "../../../atoms"
import { SubtitlesProviders, SubtitlesUIContext } from "../../subtitles-ui-context"

vi.mock("../components/download-source-subtitles", () => ({
  DownloadSourceSubtitles: () => null,
}))

vi.mock("../components/download-translated-subtitles", () => ({
  DownloadTranslatedSubtitles: () => null,
}))

vi.mock("../components/subtitles-toggle", () => ({
  SubtitlesToggle: () => null,
}))

describe("subtitlesSettingsPanel locale refresh", () => {
  it("uses the initial subtitles config before the first settings render", () => {
    const translate = vi.spyOn(i18n, "t").mockImplementation((key) => {
      if (key === "options.videoSubtitles.style.title")
        return subtitlesStore.get(configAtom).uiLocale === "en" ? "Subtitle style" : "字幕样式"

      return String(key)
    })

    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, true)
    subtitlesStore.set(subtitlesUiLocaleVersionAtom, 0)

    render(
      <SubtitlesProviders
        adapter={{
          downloadSourceSubtitles: vi.fn(),
          downloadTranslatedSubtitles: vi.fn(),
          embedded: false,
          getControlsConfig: vi.fn(),
          toggleSubtitlesManually: vi.fn(),
        }}
        initialConfig={{ ...DEFAULT_CONFIG, uiLocale: "en" }}
      >
        <SubtitlesSettingsPanel />
      </SubtitlesProviders>,
    )

    expect(screen.getByText("Subtitle style")).toBeInTheDocument()
    expect(subtitlesStore.get(configAtom).uiLocale).toBe("en")

    translate.mockRestore()
  })

  it("rerenders menu labels when the subtitles locale version changes", () => {
    let locale = "zh-CN"
    const translate = vi.spyOn(i18n, "t").mockImplementation((key) => {
      if (key === "options.videoSubtitles.style.title")
        return locale === "en" ? "Subtitle style" : "字幕样式"

      return String(key)
    })

    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, true)
    subtitlesStore.set(subtitlesUiLocaleVersionAtom, 0)

    render(
      <JotaiProvider store={subtitlesStore}>
        <SubtitlesUIContext
          value={{
            downloadSourceSubtitles: vi.fn(),
            downloadTranslatedSubtitles: vi.fn(),
            toggleSubtitles: vi.fn(),
          }}
        >
          <SubtitlesSettingsPanel />
        </SubtitlesUIContext>
      </JotaiProvider>,
    )

    expect(screen.getByText("字幕样式")).toBeInTheDocument()

    locale = "en"
    act(() => {
      subtitlesStore.set(subtitlesUiLocaleVersionAtom, 1)
    })

    expect(screen.getByText("Subtitle style")).toBeInTheDocument()
    expect(screen.queryByText("字幕样式")).not.toBeInTheDocument()

    translate.mockRestore()
  })
})
