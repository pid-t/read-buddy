import type { SmartRegion } from "@/utils/host/smart-filter/types"

export interface SmartFilterClassifyRequest {
  requestId: string
  regions: SmartRegion[]
  /** Absolute deadline in epoch milliseconds, including network and model time. */
  deadline: number
}

export type SmartFilterClassifyStatus = "success" | "error" | "timeout" | "cancel"

export interface SmartFilterClassifyResponse {
  skipIds: string[]
  /** Diagnostic outcome of the background classification. */
  status?: SmartFilterClassifyStatus
  /** Stable diagnostic code for a failed classification. */
  errorCode?: string
}

export interface SmartFilterCancelRequest {
  requestId: string
}
