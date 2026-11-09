// @vitest-environment jsdom
import type { MockInstance } from "vitest"
import type { CaptionTrack } from "../fetchers/youtube/types"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { injectPlayerApi } from "@/entrypoints/interceptor.content/inject-player-api"
import * as configStorage from "@/utils/config/storage"
import { YoutubeSubtitlesFetcher } from "../fetchers/youtube"

vi.mock("@/entrypoints/interceptor.content/timedtext-observer", () => ({
  setupTimedtextObserver: vi.fn(),
  getCachedTimedtextUrl: vi.fn(() => null),
  waitForTimedtextUrl: vi.fn(async () => null),
}))

describe("youtube subtitle track selection through the player bridge", () => {
  const videoId = "bBsNFZ1-HUs"
  const getAudioTrack = vi.fn()
  const getOption = vi.fn()
  let fetcher: YoutubeSubtitlesFetcher
  let fetchSpy: MockInstance<typeof fetch>
  let tracklist: {
    captionTracks: CaptionTrack[]
    audioTracks: { audioTrackId: string, defaultCaptionTrackIndex?: number | null }[]
    defaultAudioTrackIndex?: number
  }

  beforeAll(() => {
    Object.defineProperty(window, "location", {
      value: { search: `?v=${videoId}`, origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" },
      writable: true,
    })
    injectPlayerApi()
  })

  beforeEach(() => {
    vi.useFakeTimers()
    const languages = ["ar", "pl", "de", "ru", "fr", "ko", "nl", "ml", "bn", "pa", "pt", "ja", "te", "ta", "uk", "es", "iw", "it", "hi", "id", "en"]
    tracklist = {
      captionTracks: languages.map(languageCode => ({
        baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&kind=asr&lang=${languageCode}`,
        languageCode,
        kind: "asr",
        vssId: `a.${languageCode}`,
        name: { simpleText: languageCode },
      })),
      audioTracks: [
        { audioTrackId: "fr.10", defaultCaptionTrackIndex: 4 },
        { audioTrackId: "en-US.4", defaultCaptionTrackIndex: 20 },
      ],
      defaultAudioTrackIndex: 1,
    }
    getAudioTrack.mockReturnValue({
      id: "251;opaque-audio-format-id",
      getLanguageInfo: () => ({ id: "en-US.4" }),
      captionTracks: [],
    })
    getOption.mockReturnValue({}) // YouTube returns an empty track when native captions are off.
    document.body.innerHTML = "<div class=\"html5-video-player\"><button class=\"ytp-subtitles-button\" aria-pressed=\"false\"></button></div>"
    Object.assign(document.querySelector(".html5-video-player")!, {
      getPlayerResponse: () => ({
        videoDetails: { videoId },
        captions: { playerCaptionsTracklistRenderer: tracklist },
      }),
      getAudioTrack,
      getOption,
      getPlayerState: () => 1,
    })
    vi.spyOn(window, "postMessage").mockImplementation((data) => {
      window.dispatchEvent(new MessageEvent("message", { data, origin: window.location.origin }))
    })
    vi.spyOn(configStorage, "getLocalConfig").mockResolvedValue(null)
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({
      events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "Test subtitles." }] }],
    })))
    fetcher = new YoutubeSubtitlesFetcher()
  })

  afterEach(() => {
    fetcher.cleanup()
    document.body.innerHTML = ""
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function expectFetchedLanguage(language: string) {
    await expect(fetcher.fetch()).resolves.toEqual([{ text: "Test subtitles.", start: 0, end: 1000 }])
    const url = new URL(String(fetchSpy.mock.calls.at(-1)?.[0]))
    expect(url.searchParams.get("lang")).toBe(language)
    expect(fetcher.getSourceLanguage()).toBe(language)
  }

  it("uses the default English subtitles with native captions off and Arabic listed first", async () => {
    await expectFetchedLanguage("en")
    expect(document.querySelector(".ytp-subtitles-button")).toHaveAttribute("aria-pressed", "false")
  })

  it("prefers the current audio track's default captions over the default audio track", async () => {
    getAudioTrack.mockReturnValue({
      id: "251;opaque-french-format-id",
      getLanguageInfo: () => ({ id: "fr.10" }),
    })
    await expectFetchedLanguage("fr")
  })

  it("matches a current audio track exposing its language id directly", async () => {
    getAudioTrack.mockReturnValue({ id: "fr.10" })
    await expectFetchedLanguage("fr")
  })

  it("uses the default audio track when the current audio track cannot be matched", async () => {
    getAudioTrack.mockReturnValue(undefined)
    tracklist.defaultAudioTrackIndex = 0
    await expectFetchedLanguage("fr")
  })

  it.each([-1, 99, null, undefined])("falls back to the default audio track for current caption index %s", async (index) => {
    getAudioTrack.mockReturnValue({ getLanguageInfo: () => ({ id: "fr.10" }) })
    tracklist.audioTracks[0].defaultCaptionTrackIndex = index
    await expectFetchedLanguage("en")
  })

  it("accepts caption index zero for the current audio track", async () => {
    tracklist.audioTracks[1].defaultCaptionTrackIndex = 0
    await expectFetchedLanguage("ar")
  })

  it("keeps a manually selected non-English subtitle track ahead of both defaults", async () => {
    getOption.mockReturnValue({ languageCode: "ar", vss_id: "a.ar" })
    await expectFetchedLanguage("ar")
  })

  it("keeps manual language selection when YouTube supplies no track id", async () => {
    getOption.mockReturnValue({ languageCode: "fr" })
    await expectFetchedLanguage("fr")
  })

  it("keeps the selected track id when the default track shares its language", async () => {
    tracklist.captionTracks.push({
      baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`,
      languageCode: "en",
      vssId: ".en",
    })
    tracklist.audioTracks[1].defaultCaptionTrackIndex = 21
    getOption.mockReturnValue({ languageCode: "en", vss_id: "a.en" })
    await expectFetchedLanguage("en")
    expect(new URL(String(fetchSpy.mock.calls[0][0])).searchParams.get("kind")).toBe("asr")
  })

  it("fetches the manually selected track after caching the default subtitles", async () => {
    await expectFetchedLanguage("en")
    getOption.mockReturnValue({ languageCode: "fr", vss_id: "a.fr" })
    await expectFetchedLanguage("fr")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("keeps the existing fallback when audio track defaults are unavailable", async () => {
    tracklist.audioTracks = []
    tracklist.defaultAudioTrackIndex = undefined
    await expectFetchedLanguage("ar")
  })
})
