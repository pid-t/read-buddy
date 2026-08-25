/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { describe, expect, it, vi } from "vitest"
import { Popover, PopoverTrigger } from "@/components/ui/base-ui/popover"
import {
  handleSelectionTranslateClick,
  isTrustedSelectionTranslateClick,
  SelectionTranslateButton,
} from "../components/selection-translate-button"

describe("selection translate button click trust", () => {
  it("renders the extension icon in a compact white control", () => {
    render(createElement(SelectionTranslateButton, { left: 8, top: 8, onClick: vi.fn() }))

    const button = screen.getByRole("button")
    const icon = button.querySelector("img")

    expect(button).toHaveClass("size-7", "bg-white", "rounded-full")
    expect(icon).toHaveAttribute("width", "20")
    expect(icon).toHaveAttribute("height", "20")
    expect(icon).toHaveAttribute("alt", "")
  })

  it("accepts browser-trusted user clicks", () => {
    expect(isTrustedSelectionTranslateClick({ nativeEvent: { isTrusted: true } })).toBe(true)
  })

  it("rejects script-generated clicks", () => {
    expect(isTrustedSelectionTranslateClick({ nativeEvent: { isTrusted: false } })).toBe(false)
  })

  it("forwards the original trusted mouse event to the callback", () => {
    const onClick = vi.fn()
    const event = { nativeEvent: { isTrusted: true } } as unknown as Parameters<typeof handleSelectionTranslateClick>[0]

    handleSelectionTranslateClick(event, onClick)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith(event)
  })

  it("keeps PopoverTrigger-composed untrusted clicks guarded", () => {
    const onClick = vi.fn()
    render(
      createElement(
        Popover,
        null,
        createElement(PopoverTrigger, {
          render: createElement(SelectionTranslateButton, { left: 8, top: 8, onClick }),
        }),
      ),
    )

    fireEvent.click(screen.getByRole("button"))

    expect(onClick).not.toHaveBeenCalled()
  })
})
