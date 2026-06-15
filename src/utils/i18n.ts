import type { GeneratedI18nStructure } from "#i18n"
import type { UiLocale } from "@/types/config/ui-locale"
import { browser, i18n as browserI18n } from "#imports"
import { UI_LOCALES } from "@/types/config/ui-locale"

interface MessageEntry { message?: string }
type LocaleMessages = Record<string, MessageEntry>

let activeMessages: LocaleMessages | null = null

function toChromeLocale(locale: UiLocale) {
  return locale.replace("-", "_")
}

function getMessageFromOverride(key: string, substitutions?: Array<string | number>) {
  const rawMessage = activeMessages?.[key.replaceAll(".", "_")]?.message
  if (!rawMessage)
    return null

  let message = rawMessage
  for (const [index, substitution] of substitutions?.entries() ?? []) {
    message = message.replaceAll(`$${index + 1}`, String(substitution))
  }
  return message
}

function getPluralMessage(message: string, count: number) {
  const plural = message.split(" | ")
  switch (plural.length) {
    case 1:
      return plural[0]
    case 2:
      return plural[count === 1 ? 0 : 1]
    case 3:
      return plural[count === 0 || count === 1 ? count : 2]
    default:
      return message
  }
}

export function getBrowserPreferredUiLocale(): UiLocale {
  const browserLocale = browser.i18n.getUILanguage()
  const normalizedLocale = browserLocale.replace("_", "-")
  const exactLocale = UI_LOCALES.find(locale => locale.toLowerCase() === normalizedLocale.toLowerCase())
  if (exactLocale)
    return exactLocale

  const languageLocale = UI_LOCALES.find(locale => locale.split("-")[0] === normalizedLocale.split("-")[0])
  return languageLocale ?? "en"
}

export async function applyI18nLocale(locale: UiLocale | undefined) {
  activeMessages = null

  if (!locale)
    return

  try {
    const messagesUrl = browser.runtime.getURL(`/_locales/${toChromeLocale(locale)}/messages.json` as Parameters<typeof browser.runtime.getURL>[0])
    const response = await fetch(messagesUrl)
    if (!response.ok) {
      throw new Error(`Failed to load locale messages: ${locale}`)
    }

    activeMessages = await response.json() as LocaleMessages
  }
  catch (error) {
    console.warn("[i18n] Failed to apply UI locale override; falling back to browser locale.", error)
    activeMessages = null
  }
}

export const i18n: { t: typeof browserI18n.t } = {
  t: ((key: keyof GeneratedI18nStructure, ...args: unknown[]): string => {
    let count: number | undefined
    let substitutions: Array<string | number> | undefined

    for (const arg of args) {
      if (typeof arg === "number") {
        count = arg
      }
      else if (Array.isArray(arg)) {
        substitutions = arg as Array<string | number>
      }
    }

    if (count !== undefined && !substitutions)
      substitutions = [count]

    const overrideMessage = getMessageFromOverride(String(key), substitutions)
    if (overrideMessage) {
      return count === undefined ? overrideMessage : getPluralMessage(overrideMessage, count)
    }

    return (browserI18n.t as (...args: unknown[]) => string)(key, ...args)
  }) as typeof browserI18n.t,
}
