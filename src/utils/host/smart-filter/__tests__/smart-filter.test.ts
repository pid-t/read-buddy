// @vitest-environment jsdom
import type { SmartRegionCollection } from "../types"
import { beforeEach, describe, expect, it } from "vitest"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { collectSmartRegions } from "../collect"
import { createSmartFilterPageState } from "../page-state"
import { createSmartFilterDecision } from "../query"
import { parseSmartFilterResult } from "../result"
import { MAX_REGION_COUNT, MAX_REGION_TEXT_LENGTH, MAX_TOTAL_INPUT_LENGTH } from "../types"

function regionIdOf(collection: SmartRegionCollection, node: HTMLElement): string {
  for (const [id, mappedNode] of collection.nodeById) {
    if (mappedNode === node)
      return id
  }
  throw new Error("node was not collected as a region")
}

function regionOf(collection: SmartRegionCollection, node: HTMLElement) {
  const id = regionIdOf(collection, node)
  const region = collection.regions.find(item => item.id === id)
  if (!region)
    throw new Error("region data is missing")
  return region
}

function attachShadowNav(host: HTMLElement) {
  const shadowRoot = host.attachShadow({ mode: "open" })
  shadowRoot.innerHTML = `
    <section id="shadow-nav">
      <a id="shadow-link" href="#shadow">Shadow nav</a>
    </section>
  `
  return {
    shadowRoot,
    section: shadowRoot.querySelector<HTMLElement>("#shadow-nav")!,
    link: shadowRoot.querySelector<HTMLElement>("#shadow-link")!,
  }
}

describe("smart filter sampling", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("samples visible regions within limits and excludes private content", () => {
    const longText = "a".repeat(400)
    document.body.innerHTML = `
      <header><nav><a href="#home">Home</a></nav></header>
      <main id="main" role="main">
        <article>
          <h1>Article title</h1>
          <p id="long-text">${longText}</p>
          <div hidden>hidden secret</div>
          <div style="display: none">css hidden secret</div>
          <textarea>form secret</textarea>
          <select><option>form option</option></select>
          <div contenteditable="true">editable secret</div>
          <div class="${CONTENT_WRAPPER_CLASS}">translated secret</div>
        </article>
      </main>
      <div id="shadow-host"></div>
      ${Array.from({ length: 36 }, (_, index) => `<section>filler ${index}</section>`).join("")}
    `

    const shadowHost = document.getElementById("shadow-host")!
    const shadowRoot = shadowHost.attachShadow({ mode: "open" })
    shadowRoot.innerHTML = `<p>shadow visible text</p>`

    const collection = collectSmartRegions()
    const main = document.getElementById("main")!
    const mainRegion = regionOf(collection, main)

    expect(mainRegion.tag).toBe("main")
    expect(mainRegion.role).toBe("main")
    expect(mainRegion.heading).toBe("Article title")
    expect(mainRegion.text.length).toBe(MAX_REGION_TEXT_LENGTH)
    expect(regionOf(collection, shadowHost).text).toContain("shadow visible text")

    const sampledText = collection.regions.map(region => region.text).join(" ")
    expect(sampledText).not.toContain("hidden secret")
    expect(sampledText).not.toContain("css hidden secret")
    expect(sampledText).not.toContain("form secret")
    expect(sampledText).not.toContain("form option")
    expect(sampledText).not.toContain("editable secret")
    expect(sampledText).not.toContain("translated secret")

    expect(collection.regions.length).toBe(MAX_REGION_COUNT)
    expect(collection.nodeById.size).toBe(collection.regions.length)
    expect(collection.regions.every(region => region.text.length <= MAX_REGION_TEXT_LENGTH)).toBe(true)
    expect(JSON.stringify(collection.regions).length).toBeLessThanOrEqual(MAX_TOTAL_INPUT_LENGTH)
    expect(JSON.parse(JSON.stringify(collection.regions))).toEqual(collection.regions)
  })

  it("applies the collection range before the region count limit", () => {
    document.body.innerHTML = Array.from(
      { length: 40 },
      (_, index) => `<section id="region-${index}">Region ${index}</section>`,
    ).join("")

    const visibleRegionIds = new Set(["region-0", "region-1", "region-2"])
    const collection = collectSmartRegions(document.body, undefined, {
      shouldCollect: element => visibleRegionIds.has(element.id),
    })

    expect(collection.regions).toHaveLength(3)
    expect(collection.regions.map(region => region.text)).toEqual([
      "Region 0",
      "Region 1",
      "Region 2",
    ])
  })

  it("applies simulated skips to nodes and containers, including shadow roots", () => {
    document.body.innerHTML = `
      <header id="site-header">
        <nav id="site-nav"><a id="nav-link" href="#home">Home</a></nav>
      </header>
      <main id="content">
        <article id="post"><p id="post-text">Readable body text</p></article>
      </main>
      <div id="shadow-host"></div>
    `

    const header = document.getElementById("site-header")!
    const nav = document.getElementById("site-nav")!
    const navLink = document.getElementById("nav-link")!
    const post = document.getElementById("post")!
    const postText = document.getElementById("post-text")!
    const shadowHost = document.getElementById("shadow-host")!
    const shadow = attachShadowNav(shadowHost)

    const collection = collectSmartRegions()

    const untouched = createSmartFilterDecision(collection)
    expect(untouched.skipIds).toEqual([])
    expect(untouched.isNodeSkipped(nav)).toBe(false)
    expect(untouched.isNodeSkipped(postText.firstChild!)).toBe(false)
    expect(untouched.containsSkippedNode(header)).toBe(false)

    const navDecision = createSmartFilterDecision(collection, { skipIds: [regionIdOf(collection, nav)] })
    expect(navDecision.isNodeSkipped(nav)).toBe(true)
    expect(navDecision.isNodeSkipped(navLink.firstChild!)).toBe(true)
    expect(navDecision.isNodeSkipped(header)).toBe(false)
    expect(navDecision.isNodeSkipped(postText.firstChild!)).toBe(false)
    expect(navDecision.containsSkippedNode(header)).toBe(true)
    expect(navDecision.containsSkippedNode(nav)).toBe(true)
    expect(navDecision.containsSkippedNode(post)).toBe(false)
    expect(navDecision.containsSkippedNode(document.body)).toBe(true)

    const shadowDecision = createSmartFilterDecision(collection, {
      skipIds: [regionIdOf(collection, shadow.section)],
    })
    expect(shadowDecision.isNodeSkipped(shadow.link.firstChild!)).toBe(true)
    expect(shadowDecision.isNodeSkipped(shadowHost)).toBe(false)
    expect(shadowDecision.containsSkippedNode(shadowHost)).toBe(true)
    expect(shadowDecision.containsSkippedNode(document.body)).toBe(true)

    const hostDecision = createSmartFilterDecision(collection, {
      skipIds: [regionIdOf(collection, shadowHost)],
    })
    expect(hostDecision.isNodeSkipped(shadow.link.firstChild!)).toBe(true)
  })

  it("queries pending nodes across open shadow roots", () => {
    document.body.innerHTML = "<div id=\"shadow-host\"></div>"
    const shadowHost = document.getElementById("shadow-host")!
    const shadowRoot = shadowHost.attachShadow({ mode: "open" })
    shadowRoot.innerHTML = "<section id=\"pending-region\"><a href=\"#home\">Shadow nav</a></section>"
    const pendingRegion = shadowRoot.querySelector<HTMLElement>("#pending-region")!
    const link = shadowRoot.querySelector("a")!

    const state = createSmartFilterPageState({ pendingNodes: [pendingRegion] })

    expect(state.isNodePending(link.firstChild!)).toBe(true)
    expect(state.isNodePending(shadowHost)).toBe(false)
    expect(state.containsPendingNode(shadowHost)).toBe(true)
    expect(state.isNodeSkipped(link)).toBe(false)
  })

  it("merges duplicate ids and falls back to translating everything on bad results", () => {
    document.body.innerHTML = `
      <nav id="nav"><a href="#home">Home</a></nav>
      <main><p>Body</p></main>
    `

    const nav = document.getElementById("nav")!
    const collection = collectSmartRegions()
    const regionIds = new Set(collection.regions.map(region => region.id))
    const navId = regionIdOf(collection, nav)

    expect(parseSmartFilterResult({ skipIds: [navId, navId] }, regionIds)).toEqual({ skipIds: [navId] })
    expect(createSmartFilterDecision(collection, { skipIds: [navId, navId] }).isNodeSkipped(nav)).toBe(true)

    expect(parseSmartFilterResult({ skipIds: [navId, "r999"] }, regionIds)).toEqual({ skipIds: [] })
    expect(parseSmartFilterResult({ skipIds: "r1" }, regionIds)).toEqual({ skipIds: [] })
    expect(parseSmartFilterResult({ skipIds: [1] }, regionIds)).toEqual({ skipIds: [] })
    expect(parseSmartFilterResult({}, regionIds)).toEqual({ skipIds: [] })
    expect(parseSmartFilterResult(null, regionIds)).toEqual({ skipIds: [] })
    expect(parseSmartFilterResult({ skipIds: [] }, regionIds)).toEqual({ skipIds: [] })

    const fallback = createSmartFilterDecision(collection, { skipIds: [navId, "r999"] })
    expect(fallback.skipIds).toEqual([])
    expect(fallback.isNodeSkipped(nav)).toBe(false)
  })

  it("does not sample headings inside hidden or translated containers", () => {
    document.body.innerHTML = `
      <div id="hidden-container" hidden>
        <h2>Hidden container title</h2>
        <section id="hidden-section"><p>Hidden body</p></section>
      </div>
      <section id="near-hidden">
        <p>Visible body near hidden container</p>
      </section>
      <section id="wrapped-heading-region">
        <div class="${CONTENT_WRAPPER_CLASS}"><h2>Translated wrapper title</h2></div>
        <p>Visible body near translated wrapper</p>
      </section>
      <div id="translated-wrapper" class="${CONTENT_WRAPPER_CLASS}">
        <section id="wrapped-section"><p>Translated body</p></section>
      </div>
    `

    const collection = collectSmartRegions()
    const serialized = JSON.stringify(collection.regions)

    expect(serialized).not.toContain("Hidden container title")
    expect(serialized).not.toContain("Translated wrapper title")
    expect(serialized).toContain("Visible body near hidden container")
    expect(serialized).toContain("Visible body near translated wrapper")

    expect(collectSmartRegions(document.getElementById("hidden-section")!).regions).toEqual([])
    expect(collectSmartRegions(document.getElementById("wrapped-section")!).regions).toEqual([])
  })
})
