import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v080-to-v081"

describe("v080-to-v081 migration", () => {
  it("preserves existing configs", () => {
    const oldConfig = {
      language: {
        sourceCode: "auto",
        targetCode: "cmn",
        level: "intermediate",
      },
    }

    expect(migrate(oldConfig)).toBe(oldConfig)
  })
})
