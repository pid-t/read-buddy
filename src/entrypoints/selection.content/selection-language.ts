import type { LangCodeISO6393 } from "@read-frog/definitions"
import { detectLanguageWithSource } from "@/utils/content/language"

export const SELECTION_LANGUAGE_SAMPLE_LIMIT = 512

export function createSelectionLanguageSample(text: string, maxLength = SELECTION_LANGUAGE_SAMPLE_LIMIT): string {
  const codePoints = Array.from(text)
  if (codePoints.length <= maxLength)
    return codePoints.join("")

  return codePoints.slice(0, 384).concat(codePoints.slice(-128)).join("")
}

export function areSelectionLanguagesEquivalent(
  detectedCode: LangCodeISO6393 | "und",
  targetCode: LangCodeISO6393,
): boolean {
  if (detectedCode === targetCode)
    return true

  return (detectedCode === "cmn" || detectedCode === "cmn-Hant")
    && (targetCode === "cmn" || targetCode === "cmn-Hant")
}

export function shouldShowSelectionTranslateButton(
  detectedCode: LangCodeISO6393 | "und",
  targetCode: LangCodeISO6393,
): boolean {
  return !areSelectionLanguagesEquivalent(detectedCode, targetCode)
}

export async function detectSelectionLanguage(text: string) {
  return detectLanguageWithSource(createSelectionLanguageSample(text), {
    enableLLM: false,
  })
}
