import { describe, expect, it } from "vitest"
import { EXTENSION_PERMISSIONS } from "../manifest"

describe("extension manifest permissions", () => {
  it("requests only permissions used by the extension", () => {
    expect(EXTENSION_PERMISSIONS).toEqual([
      "storage",
      "tabs",
      "cookies",
      "webNavigation",
      "contextMenus",
    ])
  })
})
