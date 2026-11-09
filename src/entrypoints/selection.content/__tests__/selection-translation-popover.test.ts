/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest"
import { handleSelectionTranslationRetryClick } from "../components/selection-translation-popover"

describe("selection translation popover", () => {
  it("ignores untrusted clicks", () => {
    const onRetry = vi.fn()
    const event = { nativeEvent: { isTrusted: false } } as never

    handleSelectionTranslationRetryClick(event, onRetry)

    expect(onRetry).not.toHaveBeenCalled()
  })

  it("forwards trusted clicks to retry", () => {
    const onRetry = vi.fn()
    const event = { nativeEvent: { isTrusted: true } } as never

    handleSelectionTranslationRetryClick(event, onRetry)

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(event)
  })
})
