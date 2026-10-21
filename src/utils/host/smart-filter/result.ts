import type { SmartFilterResult } from "./types"
import { z } from "zod"

export const smartFilterResultSchema = z.object({
  skipIds: z.array(z.string()),
})

/**
 * Validate a model result against the current batch. Missing, malformed or
 * unknown values fall back to translating everything. Duplicate ids are merged.
 */
export function parseSmartFilterResult(
  input: unknown,
  regionIds: ReadonlySet<string>,
): SmartFilterResult {
  if (input === null || input === undefined)
    return { skipIds: [] }

  const parsed = smartFilterResultSchema.safeParse(input)
  if (!parsed.success)
    return { skipIds: [] }

  const skipIds: string[] = []
  const seen = new Set<string>()

  for (const id of parsed.data.skipIds) {
    if (seen.has(id))
      continue
    if (!regionIds.has(id))
      return { skipIds: [] }
    seen.add(id)
    skipIds.push(id)
  }

  return { skipIds }
}
