import { IconArrowLeft, IconArrowRight, IconLoader2 } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { browser } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { formatHotkeyParts } from "@/utils/os.ts"
import { isPageTranslationShortcutEmpty } from "@/utils/page-translation-shortcut"
import { cn } from "@/utils/styles/utils"
import { isPageTranslatedAtom } from "../atoms/auto-translate"
import { isIgnoreTabAtom } from "../atoms/ignore"

export default function TranslateButton({ className }: { className?: string }) {
  const [isPageTranslated, setIsPageTranslated] = useAtom(isPageTranslatedAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const translateConfig = useAtomValue(configFieldsAtomMap.translate)
  const [isPending, setIsPending] = useState(false)
  const inFlightRef = useRef(false)

  const toggleTranslation = async () => {
    if (isIgnoreTab || inFlightRef.current)
      return

    const previousEnabled = isPageTranslated
    const nextEnabled = !previousEnabled
    inFlightRef.current = true
    setIsPending(true)
    setIsPageTranslated(nextEnabled)

    try {
      const [currentTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      })
      if (typeof currentTab?.id !== "number")
        throw new Error("No active tab available")

      await sendMessage("tryToSetEnablePageTranslationByTabId", {
        tabId: currentTab.id,
        enabled: nextEnabled,
      })
    }
    catch {
      setIsPageTranslated(previousEnabled)
      toast.error(i18n.t("selectionTranslation.errors.generic"))
    }
    finally {
      inFlightRef.current = false
      setIsPending(false)
    }
  }

  const isDisabled = isIgnoreTab
  const shortcutParts = isPageTranslationShortcutEmpty(translateConfig.page.shortcut)
    ? []
    : formatHotkeyParts(translateConfig.page.shortcut)

  return (
    <Button
      onClick={toggleTranslation}
      disabled={isDisabled}
      aria-busy={isPending || undefined}
      aria-disabled={isPending || undefined}
      aria-pressed={isPageTranslated}
      data-translated={isPageTranslated}
      className={cn(
        "popup-translate-button min-w-0",
        className,
      )}
    >
      <span className="flex max-w-full min-w-0 items-center justify-center gap-2">
        {isPending
          ? <IconLoader2 className="popup-action-spinner size-4" aria-hidden="true" />
          : isPageTranslated
            ? <IconArrowLeft className="size-4" aria-hidden="true" />
            : <IconArrowRight className="size-4" aria-hidden="true" />}
        <span className="min-w-0 truncate">
          {isPageTranslated ? i18n.t("popup.showOriginal") : i18n.t("popup.translate")}
        </span>
        {!isPageTranslated && shortcutParts.length > 0 && (
          <KbdGroup className="shrink-0">
            {shortcutParts.map(part => (
              <Kbd
                key={part}
                className="bg-primary-foreground/20 text-primary-foreground"
              >
                {part}
              </Kbd>
            ))}
          </KbdGroup>
        )}
      </span>
    </Button>
  )
}
