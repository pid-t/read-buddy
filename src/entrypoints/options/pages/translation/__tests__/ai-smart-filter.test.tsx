// @vitest-environment jsdom
import type { ChangeEvent } from "react"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
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
  "options.translation.smartFilter.description": "在所选内容中跳过菜单和按钮，保留正文、评论。",
  "options.translation.smartFilter.enable": "AI 过滤菜单和按钮",
  "options.translation.smartFilter.timeoutSeconds": "筛选超时（秒）",
  "options.translation.smartFilter.timeoutDescription": "超时后按所选范围继续翻译。",
  "options.translation.smartFilter.followProvider": "使用网页翻译模型",
  "options.translation.smartFilter.followProviderDescription": "关闭后可单独选择过滤模型。",
  "options.translation.smartFilter.provider": "过滤模型",
  "options.translation.smartFilter.providerPlaceholder": "选择已启用的 AI 模型",
  "options.translation.smartFilter.costDescription": "发送少量页面内容给 AI，可能产生费用。",
  "options.translation.smartFilter.behaviorTitle": "工作方式",
  "options.translation.smartFilter.behaviorDescription": "模型不可用、调用失败或超时时，按翻译内容继续翻译。",
  "options.translation.smartFilter.status.noProvider": "AI 过滤暂不可用，请选择已启用的 AI 模型。",
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

vi.mock("@/components/llm-providers/provider-selector", () => ({
  default: ({
    providers,
    value,
    onChange,
    ariaLabel,
    disabled,
  }: {
    providers: ProviderConfig[]
    value: string
    onChange: (providerId: string) => void
    ariaLabel?: string
    disabled?: boolean
  }) => (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
    >
      {providers.map(provider => (
        <option key={provider.id} value={provider.id}>{provider.name}</option>
      ))}
    </select>
  ),
}))

function renderTranslateRange(initialConfig: Config = DEFAULT_CONFIG) {
  storageState.value = structuredClone(initialConfig)
  const store = createStore()
  store.set(configAtom, structuredClone(initialConfig))

  render(
    <Provider store={store}>
      <TooltipProvider>
        <TranslateRange />
      </TooltipProvider>
    </Provider>,
  )

  return store
}

function createConfig({
  enableAI = false,
  range = DEFAULT_CONFIG.translate.page.range,
  smartFilterProviderId = null,
  timeoutSeconds = DEFAULT_CONFIG.translate.page.smartFilter.timeoutSeconds,
  providersConfig = DEFAULT_CONFIG.providersConfig,
}: {
  enableAI?: boolean
  range?: Config["translate"]["page"]["range"]
  smartFilterProviderId?: string | null
  timeoutSeconds?: number
  providersConfig?: Config["providersConfig"]
} = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    providersConfig,
    translate: {
      ...DEFAULT_CONFIG.translate,
      page: {
        ...DEFAULT_CONFIG.translate.page,
        range,
        smartFilter: {
          enableAI,
          providerId: smartFilterProviderId,
          timeoutSeconds,
        },
      },
    },
  }
}

describe("translation scope settings", () => {
  it.each([
    ["all", false],
    ["main", false],
    ["all", true],
    ["main", true],
  ] as const)("describes the combination of range %s and AI %s", (range, enableAI) => {
    renderTranslateRange(createConfig({ range, enableAI }))
    expect(screen.getByRole("status")).toHaveTextContent(messages[`options.translation.${enableAI ? "smartFilter" : "translateRange"}.summary.${range}`])
    expect(screen.getByText(messages[`options.translation.translateRange.rangeDescription.${range}`])).toBeVisible()
  })

  it("updates the scope description and summary while preserving the AI settings", async () => {
    const config = createConfig({ range: "all", enableAI: true, smartFilterProviderId: "deepseek-default" })
    const store = renderTranslateRange(config)
    fireEvent.click(screen.getByRole("combobox", { name: "翻译内容" }))
    const option = await screen.findByRole("option", { name: "跳过常见导航区域" })
    fireEvent.pointerDown(option, { pointerType: "mouse" })
    fireEvent.click(option)

    await waitFor(() => {
      expect(store.get(configAtom).translate.page.range).toBe("main")
      expect(storageState.value?.translate.page.range).toBe("main")
      expect(store.get(configAtom).translate.page.smartFilter).toEqual(config.translate.page.smartFilter)
      expect(screen.getByRole("status")).toHaveTextContent(messages["options.translation.smartFilter.summary.main"])
      expect(screen.getByText(messages["options.translation.translateRange.rangeDescription.main"])).toBeVisible()
    })
  })

  it("retains the selected model and base scope when AI is turned off and back on", async () => {
    const config = createConfig({ range: "main", enableAI: true, smartFilterProviderId: "deepseek-default" })
    const store = renderTranslateRange(config)
    const enableSwitch = screen.getByRole("switch", { name: "AI 过滤菜单和按钮" })
    fireEvent.click(enableSwitch)
    await waitFor(() => {
      expect(screen.queryByRole("combobox", { name: "过滤模型" })).not.toBeInTheDocument()
      expect(screen.getByRole("status")).toHaveTextContent(messages["options.translation.translateRange.summary.main"])
      expect(store.get(configAtom).translate.page.smartFilter.providerId).toBe("deepseek-default")
    })
    fireEvent.click(enableSwitch)
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "过滤模型" })).toHaveValue("deepseek-default")
      expect(store.get(configAtom).translate.page).toEqual(config.translate.page)
      expect(storageState.value?.translate.page).toEqual(config.translate.page)
    })
  })

  it("groups range and AI controls together and hides model settings while AI is off", () => {
    const store = renderTranslateRange()
    const enableSwitch = screen.getByRole("switch", { name: "AI 过滤菜单和按钮" })
    const rangeSelector = screen.getByRole("combobox", { name: "翻译内容" })

    expect(enableSwitch.closest("section")).toBe(rangeSelector.closest("section"))
    expect(screen.getAllByRole("heading")).toHaveLength(1)
    expect(enableSwitch).toHaveAttribute("aria-checked", "false")
    expect(screen.queryByRole("switch", { name: "使用网页翻译模型" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "过滤模型" })).not.toBeInTheDocument()
    expect(screen.queryByText(messages["options.translation.smartFilter.costDescription"])).not.toBeInTheDocument()
    expect(store.get(configAtom).translate.page.smartFilter.providerId).toBeNull()
    expect(screen.getByRole("status")).toHaveTextContent(messages[`options.translation.translateRange.summary.${DEFAULT_CONFIG.translate.page.range}`])
  })

  it("saves the switch and keeps following persisted as null", async () => {
    const store = renderTranslateRange()
    const enableSwitch = screen.getByRole("switch", { name: "AI 过滤菜单和按钮" })

    fireEvent.click(enableSwitch)

    await waitFor(() => {
      expect(store.get(configAtom).translate.page.smartFilter).toEqual({
        enableAI: true,
        providerId: null,
        timeoutSeconds: DEFAULT_CONFIG.translate.page.smartFilter.timeoutSeconds,
      })
      expect(storageState.value?.translate.page.smartFilter.enableAI).toBe(true)
      expect(storageState.value?.translate.page.smartFilter.providerId).toBeNull()
      expect(enableSwitch).toHaveAttribute("aria-checked", "true")
      expect(screen.getByRole("status")).toHaveTextContent(messages[`options.translation.smartFilter.summary.${DEFAULT_CONFIG.translate.page.range}`])
      expect(screen.getByRole("switch", { name: "使用网页翻译模型" })).toHaveAttribute("aria-checked", "true")
      expect(screen.getByText(messages["options.translation.smartFilter.costDescription"])).toBeVisible()
      expect(screen.getByText(DEFAULT_CONFIG.providersConfig.find(p => p.id === DEFAULT_CONFIG.translate.providerId)!.name)).toBeVisible()
    })
  })

  it("saves an edited integer timeout and rejects out-of-range values", async () => {
    const store = renderTranslateRange(createConfig({ enableAI: true, timeoutSeconds: 25 }))
    const input = screen.getByLabelText("筛选超时（秒）")
    expect(input).toHaveValue(25)

    fireEvent.change(input, { target: { value: "" } })
    expect((input as HTMLInputElement).value).toBe("")
    expect(store.get(configAtom).translate.page.smartFilter.timeoutSeconds).toBe(25)

    fireEvent.change(input, { target: { value: "35" } })
    fireEvent.blur(input)
    await waitFor(() => {
      expect(store.get(configAtom).translate.page.smartFilter.timeoutSeconds).toBe(35)
      expect(storageState.value?.translate.page.smartFilter.timeoutSeconds).toBe(35)
    })

    fireEvent.change(input, { target: { value: "121" } })
    fireEvent.blur(input)
    await waitFor(() => expect(input).toHaveValue(35))
    expect(store.get(configAtom).translate.page.smartFilter.timeoutSeconds).toBe(35)
  })

  it("switches between following and an explicit enabled LLM provider", async () => {
    const store = renderTranslateRange(createConfig({ enableAI: true }))
    const followSwitch = screen.getByRole("switch", { name: "使用网页翻译模型" })
    expect(screen.queryByRole("combobox", { name: "过滤模型" })).not.toBeInTheDocument()

    fireEvent.click(followSwitch)

    await waitFor(() => {
      expect(store.get(configAtom).translate.page.smartFilter.providerId).toBe("openai-default")
      expect(followSwitch).toHaveAttribute("aria-checked", "false")
      expect(screen.getByRole("combobox", { name: "过滤模型" })).toBeEnabled()
    })

    fireEvent.change(screen.getByRole("combobox", { name: "过滤模型" }), { target: { value: "deepseek-default" } })

    await waitFor(() => {
      expect(store.get(configAtom).translate.page.smartFilter.providerId).toBe("deepseek-default")
      expect(storageState.value?.translate.page.smartFilter.providerId).toBe("deepseek-default")
    })

    fireEvent.click(followSwitch)

    await waitFor(() => {
      expect(store.get(configAtom).translate.page.smartFilter.providerId).toBeNull()
      expect(storageState.value?.translate.page.smartFilter.providerId).toBeNull()
      expect(screen.queryByRole("combobox", { name: "过滤模型" })).not.toBeInTheDocument()
    })
  })

  it.each([
    ["an unknown provider", createConfig({ enableAI: true, smartFilterProviderId: "missing-provider" })],
    ["a disabled provider", createConfig({
      enableAI: true,
      smartFilterProviderId: "deepseek-default",
      providersConfig: DEFAULT_CONFIG.providersConfig.map(provider =>
        provider.id === "deepseek-default" ? { ...provider, enabled: false } : provider,
      ),
    })],
  ])("warns and falls back when enabled with %s", (_name, config) => {
    renderTranslateRange(config)

    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("AI 过滤暂不可用，请选择已启用的 AI 模型。")
    expect(status).toHaveTextContent(messages[`options.translation.translateRange.summary.${config.translate.page.range}`])
  })
})
