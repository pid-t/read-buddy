import type { SmartFilterDecision, SmartRegionCollection } from "./types"
import { isHTMLElement } from "../dom/filter"
import { parseSmartFilterResult } from "./result"

function getComposedParent(node: Node): Node | null {
  if (node.parentNode)
    return node.parentNode
  const root = node.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

function hasNodeOrAncestorInSet(node: Node, nodes: ReadonlySet<HTMLElement>): boolean {
  let current: Node | null = node
  while (current) {
    if (isHTMLElement(current) && nodes.has(current))
      return true
    current = getComposedParent(current)
  }
  return false
}

export function isComposedDescendant(node: Node, ancestor: Node): boolean {
  let current = getComposedParent(node)
  while (current) {
    if (current === ancestor)
      return true
    current = getComposedParent(current)
  }
  return false
}

export interface NodeSetQuery {
  hasNodeOrAncestor: (node: Node) => boolean
  containsNode: (container: Node) => boolean
}

/** Build composable-tree queries for a set of nodes, including shadow hosts. */
export function createNodeSetQuery(nodes: Iterable<HTMLElement>): NodeSetQuery {
  const nodeSet = new Set(nodes)

  return {
    hasNodeOrAncestor: node => hasNodeOrAncestorInSet(node, nodeSet),
    containsNode: (container) => {
      if (isHTMLElement(container) && nodeSet.has(container))
        return true
      for (const node of nodeSet) {
        if (isComposedDescendant(node, container))
          return true
      }
      return false
    },
  }
}

/**
 * Build skip queries from a model result. Only ids returned by the model can
 * create skips; sampling metadata never does.
 */
export function createSmartFilterDecision(
  collection: SmartRegionCollection,
  modelResult?: unknown,
): SmartFilterDecision {
  const regionIds = new Set(collection.regions.map(region => region.id))
  const { skipIds } = parseSmartFilterResult(modelResult, regionIds)

  const skippedNodes = new Set<HTMLElement>()
  for (const id of skipIds) {
    const node = collection.nodeById.get(id)
    if (node)
      skippedNodes.add(node)
  }

  const skippedQuery = createNodeSetQuery(skippedNodes)

  return {
    skipIds,
    isNodeSkipped: skippedQuery.hasNodeOrAncestor,
    containsSkippedNode: skippedQuery.containsNode,
  }
}
