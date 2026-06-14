import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  createExtensionClientEnvSchema,
  LOCAL_EXTENSION_ENV_DEFAULTS,
  PRODUCTION_EXTENSION_ENV_DEFAULTS,
  resolveExtensionEnv,
} from "../shared"

function parseResolvedExtensionEnv(
  rawEnv: Record<string, string | boolean | undefined>,
  isProd = false,
  skipRequiredProductionEnv = false,
) {
  return z.object(createExtensionClientEnvSchema(isProd, skipRequiredProductionEnv)).parse(resolveExtensionEnv(rawEnv))
}

describe("extension env resolution", () => {
  it("uses production defaults when local packages are disabled", () => {
    expect(resolveExtensionEnv({})).toEqual(PRODUCTION_EXTENSION_ENV_DEFAULTS)
    expect(resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: "false",
    })).toMatchObject({
      ...PRODUCTION_EXTENSION_ENV_DEFAULTS,
      WXT_USE_LOCAL_PACKAGES: "false",
    })
  })

  it("uses localhost defaults when local packages are enabled", () => {
    expect(resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: "true",
    })).toMatchObject({
      ...LOCAL_EXTENSION_ENV_DEFAULTS,
      WXT_USE_LOCAL_PACKAGES: "true",
    })
  })

  it("lets explicit env vars override the selected defaults", () => {
    expect(resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: "true",
      WXT_API_URL: "https://preview-api.readfrog.app",
      WXT_AUTH_COOKIE_DOMAINS: "preview.readfrog.app",
    })).toMatchObject({
      ...LOCAL_EXTENSION_ENV_DEFAULTS,
      WXT_USE_LOCAL_PACKAGES: "true",
      WXT_API_URL: "https://preview-api.readfrog.app",
      WXT_AUTH_COOKIE_DOMAINS: "preview.readfrog.app",
    })
  })

  it("passes through unrelated env vars untouched", () => {
    expect(resolveExtensionEnv({
      WXT_EXTRA_FLAG: "enabled",
    })).toMatchObject({
      ...PRODUCTION_EXTENSION_ENV_DEFAULTS,
      WXT_EXTRA_FLAG: "enabled",
    })
  })
})

describe("extension env parsing", () => {
  it("accepts canonical urls, origins, and cookie domains", () => {
    expect(parseResolvedExtensionEnv({
      WXT_WEBSITE_URL: "https://www.readfrog.app",
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app,https://www.readfrog.app",
      WXT_AUTH_COOKIE_DOMAINS: "readfrog.app,localhost",
    })).toEqual({
      WXT_API_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_API_URL,
      WXT_WEBSITE_URL: "https://www.readfrog.app",
      WXT_OFFICIAL_SITE_ORIGINS: ["https://readfrog.app", "https://www.readfrog.app"],
      WXT_AUTH_COOKIE_DOMAINS: ["readfrog.app", "localhost"],
    })
  })

  it("rejects urls with trailing slashes", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_API_URL: "https://api.readfrog.app/",
    })).toThrowError("must not end with a trailing slash")
  })

  it("rejects origin entries that include a trailing slash or path", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app/,https://www.readfrog.app",
    })).toThrowError("must be an origin without a trailing slash or path")

    expect(() => parseResolvedExtensionEnv({
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app/docs",
    })).toThrowError("must be an origin without a trailing slash or path")
  })

  it("rejects cookie domains with leading dots", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_AUTH_COOKIE_DOMAINS: ".readfrog.app,localhost",
    })).toThrowError("must not start with '.'")
  })

  it("rejects comma-separated entries with spaces", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app, https://www.readfrog.app",
    })).toThrowError("must not include leading or trailing whitespace")
  })

  it("accepts resolved defaults when PROD is true", () => {
    expect(parseResolvedExtensionEnv({}, true)).toEqual({
      WXT_API_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_API_URL,
      WXT_WEBSITE_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_WEBSITE_URL,
      WXT_OFFICIAL_SITE_ORIGINS: ["https://readfrog.app", "https://www.readfrog.app"],
      WXT_AUTH_COOKIE_DOMAINS: ["readfrog.app"],
    })
  })

  it("keeps skipRequiredProductionEnv compatible with production parsing", () => {
    expect(parseResolvedExtensionEnv({
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app,https://www.readfrog.app",
    }, true, true)).toEqual({
      WXT_API_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_API_URL,
      WXT_WEBSITE_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_WEBSITE_URL,
      WXT_OFFICIAL_SITE_ORIGINS: ["https://readfrog.app", "https://www.readfrog.app"],
      WXT_AUTH_COOKIE_DOMAINS: ["readfrog.app"],
    })
  })

  it("parses WXT_USE_LOCAL_PACKAGES strictly with zod stringbool", () => {
    expect(resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: true,
    })).toMatchObject({
      ...LOCAL_EXTENSION_ENV_DEFAULTS,
      WXT_USE_LOCAL_PACKAGES: true,
    })

    expect(() => resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: "yes",
    })).toThrowError()
  })
})
