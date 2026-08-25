export async function microsoftTranslate(source: string, fromLang: string, toLang: string): Promise<string>
export async function microsoftTranslate(source: string[], fromLang: string, toLang: string): Promise<string[]>
export async function microsoftTranslate(
  source: string | string[],
  fromLang: string,
  toLang: string,
): Promise<string | string[]> {
  const isSingle = typeof source === "string"
  const texts = isSingle ? [source] : source

  if (texts.length === 0) {
    return []
  }

  const effectiveFromLang = fromLang === "auto" ? "" : fromLang

  const resp = await fetch(
    `https://edge.microsoft.com/translate/translatetext?from=${encodeURIComponent(effectiveFromLang)}&to=${encodeURIComponent(toLang)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(texts),
    },
  ).catch((error) => {
    throw new Error(
      `Network error during Microsoft translation: ${error.message}`,
    )
  })

  if (!resp.ok) {
    const errorText = await resp
      .text()
      .catch(() => "Unable to read error response")
    throw new Error(
      `Microsoft translation request failed: ${resp.status} ${resp.statusText}${
        errorText ? ` - ${errorText}` : ""
      }`,
    )
  }

  try {
    const result = await resp.json()

    if (!Array.isArray(result) || result.length !== texts.length) {
      throw new Error(
        `Unexpected response format: expected ${texts.length} results, got ${Array.isArray(result) ? result.length : "non-array"}`,
      )
    }

    const translations = result.map((item: { translations?: { text?: string }[] }, index: number) => {
      const text = item?.translations?.[0]?.text
      if (text == null) {
        throw new Error(`Missing translation for item at index ${index}`)
      }
      return text
    })

    return isSingle ? translations[0] : translations
  }
  catch (error) {
    throw new Error(
      `Failed to parse Microsoft translation response: ${(error as Error).message}`,
    )
  }
}
