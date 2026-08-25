/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"
import { Popover, PopoverTrigger } from "@/components/ui/base-ui/popover"
import {
  handleSelectionTranslationRetryClick,
  SelectionTranslationPopover,
} from "../components/selection-translation-popover"

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

  it("uses comfortable symmetric spacing and justifies translated text", async () => {
    render(
      createElement(
        Popover,
        { open: true },
        createElement(PopoverTrigger, {
          render: createElement("button", { type: "button" }, "translate"),
        }),
        createElement(SelectionTranslationPopover, {
          state: "success",
          translation: "translated result",
          container: document.body,
          onRetry: vi.fn(),
          onClose: vi.fn(),
        }),
      ),
    )

    const translation = await screen.findByText("translated result")
    const dialog = screen.getByRole("dialog")

    expect(dialog).toHaveClass("p-4")
    expect(translation).toHaveClass("pt-5")
    expect(translation).toHaveClass("text-justify", "[text-justify:inter-character]")
    expect(translation).not.toHaveClass("pr-8")
  })
})
