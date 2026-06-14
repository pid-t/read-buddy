import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v078-to-v079"

describe("v078-to-v079 migration", () => {
  it("projects the config to translation-only branches", () => {
    const migrated = migrate({
      language: { sourceCode: "auto", targetCode: "eng", level: "intermediate" },
      providersConfig: [{ id: "microsoft-translate-default" }],
      translate: { providerId: "microsoft-translate-default" },
      languageDetection: { mode: "basic" },
      videoSubtitles: { providerId: "microsoft-translate-default" },
      siteControl: { mode: "blacklist", patterns: [] },
      tts: { defaultVoice: "en-US-GuyNeural" },
      floatingButton: { enabled: true },
      selectionToolbar: { enabled: true },
      sideContent: { width: 400 },
      betaExperience: { enabled: false },
      contextMenu: { enabled: true },
      inputTranslation: { enabled: true },
    })

    expect(migrated).toEqual({
      language: { sourceCode: "auto", targetCode: "eng", level: "intermediate" },
      providersConfig: [{ id: "microsoft-translate-default" }],
      translate: { providerId: "microsoft-translate-default" },
      languageDetection: { mode: "basic" },
      videoSubtitles: { providerId: "microsoft-translate-default" },
      siteControl: { mode: "blacklist", patterns: [] },
    })
  })
})
