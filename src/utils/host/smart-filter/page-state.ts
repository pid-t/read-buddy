import type { SmartFilterDecision } from "./types"
import { createNodeSetQuery } from "./query"

export interface SmartFilterPageState {
  isNodeSkipped: (node: Node) => boolean
  containsSkippedNode: (container: Node) => boolean
  isNodePending: (node: Node) => boolean
  containsPendingNode: (container: Node) => boolean
}

/**
 * Combine this page session's skip decision with the nodes still waiting for
 * classification. Pending queries cover ancestors, descendants and open shadow
 * hosts through the same composed-tree helpers as skip queries.
 */
export function createSmartFilterPageState(options: {
  decision?: SmartFilterDecision | null
  pendingNodes?: Iterable<HTMLElement>
} = {}): SmartFilterPageState {
  const pendingQuery = createNodeSetQuery(options.pendingNodes ?? [])
  const decision = options.decision ?? null

  return {
    isNodeSkipped: node => decision?.isNodeSkipped(node) ?? false,
    containsSkippedNode: container => decision?.containsSkippedNode(container) ?? false,
    isNodePending: pendingQuery.hasNodeOrAncestor,
    containsPendingNode: pendingQuery.containsNode,
  }
}
