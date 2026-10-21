// @vitest-environment jsdom
import type { ProviderConfig } from "@/types/config/provider"
import { render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { isEnabledLLMProviderConfig } from "@/types/config/provider"
import { DEFAULT_PROVIDER_CONFIG, DEFAULT_PROVIDER_CONFIG_LIST } from "@/utils/constants/providers"
import ProviderSelector from "../provider-selector"

vi.mock("@/utils/atoms/storage-adapter", () => ({
  storageAdapter: {
    get: vi.fn(async (_key: string, fallback: unknown) => fallback),
    set: vi.fn(async () => {}),
    setMeta: vi.fn(async () => {}),
    watch: vi.fn(() => () => {}),
  },
}))

const enabledLLMProviders = DEFAULT_PROVIDER_CONFIG_LIST.filter(isEnabledLLMProviderConfig)
const googleTranslateProviderId = DEFAULT_PROVIDER_CONFIG["google-translate"].id
const placeholder = "选择 LLM Provider"

function renderProviderSelector(providers: ProviderConfig[], value: string) {
  const store = createStore()

  render(
    <Provider store={store}>
      <ThemeProvider>
        <ProviderSelector
          providers={providers}
          value={value}
          onChange={() => {}}
          ariaLabel="分类模型"
          placeholder={placeholder}
        />
      </ThemeProvider>
    </Provider>,
  )
}

describe("provider selector", () => {
  it("renders the placeholder when the selected provider is not in the list", () => {
    expect(enabledLLMProviders.some(provider => provider.id === googleTranslateProviderId)).toBe(false)

    expect(() => renderProviderSelector(enabledLLMProviders, googleTranslateProviderId)).not.toThrow()

    const trigger = screen.getByRole("combobox", { name: "分类模型" })
    expect(trigger).toHaveTextContent(placeholder)
  })
})
