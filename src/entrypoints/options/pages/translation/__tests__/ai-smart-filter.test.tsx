// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { TranslateRange } from "../translate-range"

const storageState = vi.hoisted(() => ({ value: null as Config | null }))

const messages = vi.hoisted((): Record<string, string> => ({
  "options.translation.translateRange.title": "翻译范围",
  "options.translation.translateRange.description": "选择要翻译的内容，可搭配 AI 过滤。",
  "options.translation.translateRange.label": "翻译内容",
  "options.translation.translateRange.range.main": "跳过常见导航区域",
  "options.translation.translateRange.range.all": "整页内容",
  "options.translation.translateRange.rangeDescription.main": "根据网页结构跳过页头、页脚和导航，文章内部的相关内容仍会保留。",
  "options.translation.translateRange.rangeDescription.all": "包含正文、导航、页头和页脚等可翻译内容。",
  "options.translation.translateRange.summary.main": "当前：按网页结构跳过常见导航区域。",
  "options.translation.translateRange.summary.all": "当前：翻译整页内容。",
  "options.translation.smartFilter.description": "使用网页翻译模型，在同一次请求中跳过菜单和按钮，保留正文、评论。",
  "options.translation.smartFilter.enable": "AI 过滤菜单和按钮",
  "options.translation.smartFilter.status.noProvider": "AI 过滤需要网页翻译使用已启用的 AI 模型。",
  "options.translation.smartFilter.summary.main": "当前：跳过常见导航，并启用 AI 过滤。",
  "options.translation.smartFilter.summary.all": "当前：整页翻译，AI 过滤菜单和按钮。",
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => messages[key] ?? key,
  },
}))

vi.mock("@/utils/atoms/storage-adapter", () => ({
  storageAdapter: {
    get: vi.fn(async (_key: string, fallback: Config) => storageState.value ?? fallback),
    set: vi.fn(async (_key: string, value: Config) => {
      storageState.value = value
    }),
    setMeta: vi.fn(async () => {}),
    watch: vi.fn(() => () => {}),
  },
}))

function renderTranslateRange(initialConfig: Config = DEFAULT_CONFIG) {
  storageState.value = structuredClone(initialConfig)
  const store = createStore()
  store.set(configAtom, structuredClone(initialConfig))

  render(
    <Provider store={store}>
      <TranslateRange />
    </Provider>,
  )

  return store
}

function createConfig({
  enableAI = false,
  providerId = DEFAULT_CONFIG.translate.providerId,
}: {
  enableAI?: boolean
  providerId?: string
} = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    translate: {
      ...DEFAULT_CONFIG.translate,
      providerId,
      page: {
        ...DEFAULT_CONFIG.translate.page,
        smartFilter: { enableAI },
      },
    },
  }
}

describe("aI filtering settings", () => {
  it("saves the switch while following the page translation provider", async () => {
    const store = renderTranslateRange(createConfig())
    const enableSwitch = screen.getByRole("switch", { name: "AI 过滤菜单和按钮" })

    expect(enableSwitch).toBeEnabled()
    fireEvent.click(enableSwitch)

    await waitFor(() => {
      expect(store.get(configAtom).translate.page.smartFilter).toEqual({ enableAI: true })
      expect(storageState.value?.translate.page.smartFilter.enableAI).toBe(true)
      expect(enableSwitch).toHaveAttribute("aria-checked", "true")
    })
    expect(screen.queryByLabelText("筛选超时（秒）")).not.toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: "使用网页翻译模型" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "过滤模型" })).not.toBeInTheDocument()
  })

  it("disables filtering for a non-LLM page provider without clearing the saved switch", () => {
    const config = createConfig({ enableAI: true, providerId: "google-translate-default" })
    renderTranslateRange(config)
    const enableSwitch = screen.getByRole("switch", { name: "AI 过滤菜单和按钮" })

    expect(enableSwitch).toHaveAttribute("aria-disabled", "true")
    expect(enableSwitch).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("status")).toHaveTextContent("AI 过滤需要网页翻译使用已启用的 AI 模型。")
    expect(screen.getByRole("status")).toHaveTextContent(messages["options.translation.translateRange.summary.all"])
  })

  it("keeps filtering available again after switching back to an enabled LLM", () => {
    const config = createConfig({ enableAI: true, providerId: "google-translate-default" })
    renderTranslateRange(config)
    cleanup()
    renderTranslateRange(createConfig({ enableAI: true }))
    const enableSwitch = screen.getByRole("switch", { name: "AI 过滤菜单和按钮" })

    expect(enableSwitch).not.toHaveAttribute("aria-disabled", "true")
    expect(enableSwitch).toHaveAttribute("aria-checked", "true")
    expect(screen.queryByText(messages["options.translation.smartFilter.status.noProvider"])).not.toBeInTheDocument()
  })
})
