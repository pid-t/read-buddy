import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { applyI18nLocale } from "@/utils/i18n"
import { subtitlesUiLocaleVersionAtom } from "../atoms"

export function I18nLocaleSync() {
  const uiLocale = useAtomValue(configFieldsAtomMap.uiLocale)
  const bumpLocaleVersion = useSetAtom(subtitlesUiLocaleVersionAtom)

  useEffect(() => {
    let cancelled = false

    void applyI18nLocale(uiLocale).then(() => {
      if (!cancelled) {
        bumpLocaleVersion(version => version + 1)
      }
    })

    return () => {
      cancelled = true
    }
  }, [bumpLocaleVersion, uiLocale])

  return null
}
