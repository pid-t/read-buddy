// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import {
  subtitlesSettingsPanelOpenAtom,
  subtitlesSettingsPanelViewAtom,
  subtitlesStore,
  subtitlesVisibleAtom,
} from "../../atoms"
import { SubtitlesTranslateButton } from "../subtitles-translate-button"

describe("subtitles translate button", () => {
  beforeEach(() => {
    subtitlesStore.set(subtitlesSettingsPanelOpenAtom, false)
    subtitlesStore.set(subtitlesSettingsPanelViewAtom, "main")
    subtitlesStore.set(subtitlesVisibleAtom, false)
  })

  it("disables native image dragging so pointer movement cannot cancel the menu click", () => {
    render(<SubtitlesTranslateButton />)

    const logo = screen.getByRole<HTMLImageElement>("img", { name: "Subtitle Toggle" })

    // Browsers start a drag instead of dispatching click when a draggable image moves.
    expect(logo.draggable).toBe(false)

    fireEvent.click(logo)

    expect(subtitlesStore.get(subtitlesSettingsPanelOpenAtom)).toBe(true)
    expect(screen.getByRole("button", { name: "Subtitle Translation Panel" })).toHaveAttribute("aria-pressed", "true")
  })

  it("returns to the main menu when opening and toggles closed on the next click", () => {
    subtitlesStore.set(subtitlesSettingsPanelViewAtom, "style")
    render(<SubtitlesTranslateButton />)

    const button = screen.getByRole("button", { name: "Subtitle Translation Panel" })
    fireEvent.click(button)

    expect(subtitlesStore.get(subtitlesSettingsPanelViewAtom)).toBe("main")
    expect(button).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(button)

    expect(subtitlesStore.get(subtitlesSettingsPanelOpenAtom)).toBe(false)
    expect(button).toHaveAttribute("aria-pressed", "false")
  })
})
