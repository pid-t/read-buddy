import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v081-to-v082"

describe("v081-to-v082 migration", () => {
  it("removes siteControl field", () => {
    const oldConfig = {
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: ["example.com"],
        whitelistPatterns: [],
      },
      otherField: "value",
    }

    const result = migrate(oldConfig)

    expect(result).toEqual({ otherField: "value" })
    expect(result).not.toHaveProperty("siteControl")
  })

  it("keeps config without siteControl unchanged", () => {
    const oldConfig = { otherField: "value" }
    const result = migrate(oldConfig)
    expect(result).toEqual(oldConfig)
  })
})
