import type { TestSeriesObject } from "./types"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

/**
 * v001 is the initial (and only) shipped schema. Because ReadBuddy has not
 * shipped a public release yet, there is no legacy config to migrate — this
 * example simply mirrors the current DEFAULT_CONFIG so the migration test
 * harness has a valid baseline.
 *
 * When the schema changes next, bump CONFIG_SCHEMA_VERSION to 2, add
 * `migration-scripts/v001-to-v002.ts` and `example/v002.ts`, and the
 * auto-discovery tests will pick them up.
 */
export const testSeries: TestSeriesObject = {
  default: {
    description: "Initial shipped schema (mirrors DEFAULT_CONFIG)",
    config: DEFAULT_CONFIG,
  },
}
