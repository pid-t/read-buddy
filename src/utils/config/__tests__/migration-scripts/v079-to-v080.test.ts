import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v079-to-v080"

describe("v079-to-v080 migration", () => {
  it("removes the legacy Hacker News auto-translate pattern", () => {
    const migrated = migrate({
      translate: {
        page: {
          autoTranslatePatterns: [
            "spanish-news.com",
            "news.ycombinator.com",
            "elmundo.es",
          ],
        },
      },
    })

    expect(migrated.translate.page.autoTranslatePatterns).toEqual([
      "spanish-news.com",
      "elmundo.es",
    ])
  })

  it("preserves configs without auto-translate patterns", () => {
    const oldConfig = {
      translate: {
        page: {
          autoTranslateLanguages: ["eng"],
        },
      },
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })
})
