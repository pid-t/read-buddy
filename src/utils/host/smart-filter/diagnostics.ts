/* eslint-disable no-console */

/**
 * Diagnostics for the AI smart filter. Enabled only by the dedicated
 * `WXT_SMART_FILTER_DEBUG=true` build flag so normal builds stay silent.
 */
const enabled = import.meta.env.WXT_SMART_FILTER_DEBUG === "true"

/** Log structured smart filter diagnostics without page text or secrets. */
export function logSmartFilterDiagnostic(event: string, data: Record<string, unknown>): void {
  if (!enabled)
    return
  console.info(`[smart-filter][${event}]`, data)
}
