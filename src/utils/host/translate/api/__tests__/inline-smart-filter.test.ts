import type { LLMProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { InlineSmartFilterResultError, parseInlineSmartFilterResult } from "../inline-smart-filter"

const providerConfig: LLMProviderConfig = {
  id: "openai-default",
  name: "OpenAI",
  provider: "openai",
  enabled: true,
  apiKey: "sk-test",
  model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
}

function parse(input: unknown, ids = ["u1", "u2"]) {
  return parseInlineSmartFilterResult(input, ids, providerConfig)
}

describe("parseInlineSmartFilterResult", () => {
  it("pairs out-of-order results by id and keeps skip as an empty string", () => {
    expect(parse({
      items: [
        { id: "u2", action: "translate", text: "阅读给了我们思考的空间。" },
        { id: "u1", action: "skip", text: "" },
      ],
    })).toEqual(["", "阅读给了我们思考的空间。"])
  })

  it.each([
    ["unknown id", { items: [
      { id: "u1", action: "skip", text: "" },
      { id: "u2", action: "translate", text: "B" },
      { id: "u3", action: "translate", text: "C" },
    ] }],
    ["duplicate id", { items: [
      { id: "u1", action: "skip", text: "" },
      { id: "u1", action: "translate", text: "A" },
      { id: "u2", action: "translate", text: "B" },
    ] }],
    ["missing id", { items: [
      { id: "u1", action: "translate", text: "A" },
    ] }],
    ["text on a skip", { items: [
      { id: "u1", action: "skip", text: "A" },
      { id: "u2", action: "translate", text: "B" },
    ] }],
    ["empty translation", { items: [
      { id: "u1", action: "translate", text: "  " },
      { id: "u2", action: "translate", text: "B" },
    ] }],
    ["malformed object", { items: [{ id: "u1", action: "keep", text: "A" }] }],
  ])("rejects %s", (_label, input) => {
    expect(() => parse(input)).toThrow(InlineSmartFilterResultError)
  })
})
