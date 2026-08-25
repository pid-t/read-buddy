import { describe, expect, it } from "vitest"
import { CONFIG_SCHEMA_VERSION } from "@/utils/constants/config"
import { ConfigVersionTooNewError } from "../errors"
import { migrateConfig } from "../migration"
import { migrate as migrateV002ToV003 } from "../migration-scripts/v002-to-v003"

describe("migrateConfig", () => {
  it("should throw ConfigVersionTooNewError when schema version is newer than current", async () => {
    const futureVersion = CONFIG_SCHEMA_VERSION + 1
    const config = {}

    await expect(migrateConfig(config, futureVersion))
      .rejects
      .toThrow(ConfigVersionTooNewError)
  })

  it("adds missing free providers without changing existing provider entries or order", () => {
    const existingGoogle = {
      id: "custom-google",
      name: "My Google",
      enabled: false,
      provider: "google-translate",
    }
    const existingLLM = {
      id: "my-provider",
      name: "My Provider",
      enabled: true,
      provider: "openai",
      model: {
        model: "gpt-5-mini",
        isCustomModel: false,
        customModel: null,
      },
    }

    const migrated = migrateV002ToV003({ providersConfig: [existingGoogle, existingLLM] })

    expect(migrated.providersConfig).toEqual([
      existingGoogle,
      existingLLM,
      expect.objectContaining({ id: "microsoft-translate-default", provider: "microsoft-translate" }),
    ])
  })

  it("is idempotent when both free providers already exist", () => {
    const existingProviders = [
      {
        id: "google-translate-default",
        name: "Google Translate",
        enabled: false,
        provider: "google-translate",
      },
      {
        id: "microsoft-translate-default",
        name: "Microsoft Translator",
        enabled: false,
        provider: "microsoft-translate",
      },
    ]

    const once = migrateV002ToV003({ providersConfig: existingProviders })
    const twice = migrateV002ToV003(once)

    expect(twice).toEqual(once)
    expect(twice.providersConfig).toHaveLength(2)
  })
})
