// @vitest-environment jsdom

import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SubtitlesUIContext } from "../../subtitles-ui-context"
import { PanelShell } from "../panel-shell"

const mocks = vi.hoisted(() => ({
  controlsInfo: {
    controlsHeight: 59,
    controlsVisible: false,
  },
}))

vi.mock("../../use-controls-visible", () => ({
  useControlsInfo: () => mocks.controlsInfo,
}))

vi.mock("../components/use-subtitles-panel-dismiss", () => ({
  useSubtitlesPanelDismiss: vi.fn(),
}))

function TestPanel({ open }: { open: boolean }) {
  return (
    <SubtitlesUIContext
      value={{
        controlsConfig: {
          checkVisibility: vi.fn(),
          measureHeight: vi.fn(),
        },
        downloadSourceSubtitles: vi.fn(),
        downloadTranslatedSubtitles: vi.fn(),
        embedded: false,
        toggleSubtitles: vi.fn(),
      }}
    >
      <PanelShell open={open} onClose={vi.fn()}>
        Panel content
      </PanelShell>
    </SubtitlesUIContext>
  )
}

describe("panel shell", () => {
  beforeEach(() => {
    mocks.controlsInfo.controlsHeight = 59
    mocks.controlsInfo.controlsVisible = false
  })

  it("keeps the panel mounted and inert while closed", () => {
    const { container } = render(<TestPanel open={false} />)
    const panel = container.querySelector("[data-slot='subtitles-settings-panel']")
    const positioner = panel?.parentElement

    expect(panel).toHaveTextContent("Panel content")
    expect(positioner).toHaveAttribute("aria-hidden", "true")
    expect(positioner).toHaveAttribute("inert")
    expect(positioner).toHaveClass("invisible")
  })

  it("keeps its bottom offset stable when YouTube controls become visible", () => {
    const { container, rerender } = render(<TestPanel open />)
    const panel = container.querySelector("[data-slot='subtitles-settings-panel']")
    const positioner = panel?.parentElement

    expect(positioner).toHaveStyle({ bottom: "77px" })

    mocks.controlsInfo.controlsVisible = true
    rerender(<TestPanel open />)

    expect(positioner).toHaveStyle({ bottom: "77px" })
    expect(positioner).toHaveAttribute("aria-hidden", "false")
    expect(positioner).toHaveClass("visible")
  })
})
