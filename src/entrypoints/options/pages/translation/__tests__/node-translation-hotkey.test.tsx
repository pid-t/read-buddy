// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { NodeTranslationHotkey } from "../node-translation-hotkey"

const messages = vi.hoisted((): Record<string, string> => ({
  "options.translation.nodeTranslationHotkey.title": "鼠标悬停翻译",
  "options.translation.nodeTranslationHotkey.description": "自定义悬停翻译的修饰键，或使用鼠标长按翻译段落",
  "options.translation.nodeTranslationHotkey.enable": "启用鼠标悬停翻译",
  "options.translation.nodeTranslationHotkey.shortcut": "快捷键",
  "hotkey.control": "Ctrl",
  "hotkey.alt": "Alt",
  "hotkey.shift": "Shift",
  "hotkey.backtick": "`",
  "hotkey.clickAndHold": "鼠标长按",
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => messages[key] ?? key,
  },
}))

function renderNodeTranslationHotkey(enabled = false) {
  const store = createStore()
  store.set(configAtom, {
    ...DEFAULT_CONFIG,
    translate: {
      ...DEFAULT_CONFIG.translate,
      node: {
        ...DEFAULT_CONFIG.translate.node,
        enabled,
      },
    },
  })

  render(
    <Provider store={store}>
      <TooltipProvider>
        <NodeTranslationHotkey />
      </TooltipProvider>
    </Provider>,
  )

  return { store }
}

describe("node translation hotkey", () => {
  it("renders the localized title and two labeled settings rows", () => {
    renderNodeTranslationHotkey()

    expect(screen.getByRole("heading", { name: "鼠标悬停翻译" })).toBeInTheDocument()
    const fieldGroup = document.querySelector<HTMLElement>("[data-slot=\"field-group\"]")
    expect(fieldGroup).not.toBeNull()
    if (!fieldGroup)
      return

    const fields = Array.from(fieldGroup.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.slot === "field",
    )
    expect(fields).toHaveLength(2)

    const enableField = fields[0]
    const shortcutField = fields[1]
    if (!enableField || !shortcutField)
      return

    const toggle = within(enableField).getByRole("switch", { name: "启用鼠标悬停翻译" })
    const shortcut = within(shortcutField).getByRole("combobox", { name: "快捷键" })
    expect(toggle).toBeInTheDocument()
    expect(shortcut).toBeInTheDocument()

    const toggleLabel = within(enableField).getByText("启用鼠标悬停翻译").closest("label")
    expect(toggleLabel).toHaveAttribute("for", "node-translation-hotkey-toggle")
    expect(toggle).toHaveAttribute(
      "aria-labelledby",
      toggleLabel?.id,
    )

    const shortcutLabel = within(shortcutField).getByText("快捷键").closest("label")
    expect(shortcutLabel).toHaveAttribute("for", "node-translation-hotkey-select")
    expect(shortcut).toHaveAttribute(
      "id",
      "node-translation-hotkey-select",
    )
  })

  it("disables the shortcut selector until hover translation is enabled", async () => {
    const { store } = renderNodeTranslationHotkey()
    const toggle = screen.getByRole("switch", { name: "启用鼠标悬停翻译" })
    const shortcut = screen.getByRole("combobox", { name: "快捷键" })

    expect(shortcut).toBeDisabled()
    expect(toggle).toHaveAttribute("aria-checked", "false")

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(store.get(configAtom).translate.node.enabled).toBe(true)
      expect(toggle).toHaveAttribute("aria-checked", "true")
      expect(shortcut).toBeEnabled()
    })

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(store.get(configAtom).translate.node.enabled).toBe(false)
      expect(toggle).toHaveAttribute("aria-checked", "false")
      expect(shortcut).toBeDisabled()
    })
  })
})
