// @vitest-environment jsdom
import type { ChangeEvent } from "react"
import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { makeProviderUnavailableAtom } from "@/utils/atoms/provider"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DefaultProviderConfig } from "../default-provider-config"

const storageState = vi.hoisted(() => ({ value: null as Config | null }))

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

describe("default provider config", () => {
  beforeEach(() => {
    storageState.value = null
  })

  it("shows enabled compatible providers and updates the feature default", async () => {
    const initialConfig: Config = {
      ...DEFAULT_CONFIG,
      providersConfig: DEFAULT_CONFIG.providersConfig.map(provider =>
        provider.id === "openai-default" ? { ...provider, enabled: false } : provider,
      ),
      translate: {
        ...DEFAULT_CONFIG.translate,
        providerId: "microsoft-translate-default",
      },
    }
    const store = createStore()
    storageState.value = structuredClone(initialConfig)
    store.set(configAtom, initialConfig)

    render(
      <Provider store={store}>
        <DefaultProviderConfig featureKey="translate" />
      </Provider>,
    )

    const selector = screen.getByRole("combobox", { name: "options.defaultProvider.title" })
    expect(screen.queryByRole("option", { name: "OpenAI" })).not.toBeInTheDocument()

    fireEvent.change(selector, { target: { value: "google-translate-default" } })

    expect(store.get(configAtom).translate.providerId).toBe("google-translate-default")
    await vi.waitFor(() => {
      expect(storageState.value?.translate.providerId).toBe("google-translate-default")
    })
  })

  it("disables a provider and reassigns linked features in one write", async () => {
    const initialConfig: Config = {
      ...DEFAULT_CONFIG,
      translate: {
        ...DEFAULT_CONFIG.translate,
        providerId: "openai-default",
      },
      selectionTranslation: {
        ...DEFAULT_CONFIG.selectionTranslation,
        providerId: "openai-default",
      },
      languageDetection: {
        mode: "llm",
        providerId: "openai-default",
      },
    }
    const store = createStore()
    storageState.value = structuredClone(initialConfig)
    store.set(configAtom, initialConfig)

    const result = await store.set(makeProviderUnavailableAtom, {
      providerId: "openai-default",
      operation: "disable",
    })

    expect(result.status).toBe("ready")
    expect(store.get(configAtom).providersConfig.find(provider => provider.id === "openai-default")?.enabled).toBe(false)
    expect(store.get(configAtom).translate.providerId).toBe("microsoft-translate-default")
    expect(store.get(configAtom).selectionTranslation.providerId).toBe("microsoft-translate-default")
    expect(store.get(configAtom).languageDetection).toEqual({
      mode: "llm",
      providerId: "google-default",
    })
    expect(storageState.value).toEqual(store.get(configAtom))
  })
})
