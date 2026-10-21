export const MAX_REGION_COUNT = 32
export const MAX_REGION_TEXT_LENGTH = 160
export const MAX_HEADING_LENGTH = 80
export const MAX_TOTAL_INPUT_LENGTH = 12_000

/** A serializable region description sent to the model. */
export interface SmartRegion {
  id: string
  parentId: string | null
  tag: string
  role: string | null
  heading: string | null
  text: string
}

/** Region data sent to the model, plus the local only node mapping. */
export interface SmartRegionCollection {
  regions: SmartRegion[]
  nodeById: ReadonlyMap<string, HTMLElement>
}

export interface SmartRegionCollectionOptions {
  /** Return false to keep an element out of the sample while still walking its descendants. */
  shouldCollect?: (element: HTMLElement) => boolean
}

/** Validated model result. An empty list means translate everything. */
export interface SmartFilterResult {
  skipIds: string[]
}

/** Skip queries used by page traversal and text extraction. */
export interface SmartFilterDecision {
  skipIds: readonly string[]
  isNodeSkipped: (node: Node) => boolean
  containsSkippedNode: (container: Node) => boolean
}
