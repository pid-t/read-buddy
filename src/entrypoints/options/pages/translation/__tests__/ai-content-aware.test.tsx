// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { AIContentAware } from "../ai-content-aware"

const messages = vi.hoisted((): Record<string, string> => ({
  "options.translation.aiContentAware.title": "AI 智能上下文翻译",
  "options.translation.aiContentAware.description": "通过向 AI 提供网页上下文来提高翻译质量",
  "options.translation.aiContentAware.enable": "启用 AI 智能上下文翻译",
  "options.translation.aiContentAware.enableDescription": "AI 使用网页摘要来提高翻译准确性。需要 LLM 翻译提供商。",
  "options.translation.aiContentAware.status.disabled": "AI 智能上下文翻译已关闭",
  "options.translation.aiContentAware.status.enabled": "AI 智能上下文翻译已启用",
  "options.translation.aiContentAware.status.noProvider": "请先选择 LLM Provider",
}))

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, substitutions?: Array<string | number>) => {
      let message = messages[key] ?? key
      for (const [index, substitution] of substitutions?.entries() ?? []) {
        message = message.replaceAll(`$${index + 1}`, String(substitution))
      }
      return message
    },
  },
}))

describe("ai content-aware translation", () => {
  function renderAIContentAware({
    enabled = false,
    providerId = "deepseek-default",
    providersConfig = DEFAULT_CONFIG.providersConfig,
  }: {
    enabled?: boolean
    providerId?: string
    providersConfig?: typeof DEFAULT_CONFIG.providersConfig
  } = {}) {
    const store = createStore()
    store.set(configAtom, {
      ...DEFAULT_CONFIG,
      providersConfig,
      translate: {
        ...DEFAULT_CONFIG.translate,
        enableAIContentAware: enabled,
        providerId,
      },
    })

    render(
      <Provider store={store}>
        <TooltipProvider>
          <AIContentAware />
        </TooltipProvider>
      </Provider>,
    )

    return store
  }

  const disabledLLMProviders = DEFAULT_CONFIG.providersConfig.map(provider => provider.id === "deepseek-default"
    ? { ...provider, enabled: false }
    : provider)

  it.each([
    ["feature off and missing provider", false, "missing-provider", "AI 智能上下文翻译已关闭", "bg-gray-400", DEFAULT_CONFIG.providersConfig],
    ["enabled with an enabled LLM provider", true, "deepseek-default", "AI 智能上下文翻译已启用", "bg-green-500", DEFAULT_CONFIG.providersConfig],
    ["enabled with a disabled LLM provider", true, "deepseek-default", "请先选择 LLM Provider", "bg-orange-400", disabledLLMProviders],
    ["enabled with an enabled non-LLM provider", true, "google-translate-default", "请先选择 LLM Provider", "bg-orange-400", DEFAULT_CONFIG.providersConfig],
  ] as const)("shows the %s status", (_name, enabled, providerId, text, color, providersConfig) => {
    renderAIContentAware({ enabled, providerId, providersConfig })

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveAttribute("aria-atomic", "true")
    expect(status).toHaveTextContent(text)
    expect(status.querySelector("[aria-hidden=\"true\"]")).toHaveClass(color)
  })

  it("keeps the controlled switch and config state in sync", async () => {
    const store = renderAIContentAware()

    const toggle = screen.getByRole("switch", { name: "启用 AI 智能上下文翻译" })
    expect(toggle).toHaveAttribute("aria-label", "启用 AI 智能上下文翻译")
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("status")).toHaveTextContent("AI 智能上下文翻译已关闭")

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(store.get(configAtom).translate.enableAIContentAware).toBe(true)
      expect(toggle).toHaveAttribute("aria-checked", "true")
      expect(screen.getByRole("status")).toHaveTextContent("AI 智能上下文翻译已启用")
    })
  })
})
