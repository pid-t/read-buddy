import type { MouseEventHandler } from "react"
import { browser } from "#imports"
import readBuddyIcon from "@/assets/icons/read-buddy.png?url&no-inline"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"

const readBuddyIconUrl = new URL(readBuddyIcon, browser.runtime.getURL("/")).href

interface SelectionTranslateButtonProps {
  left: number
  top: number
  disabled?: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
}

export function isTrustedSelectionTranslateClick(event: { nativeEvent: { isTrusted: boolean } }): boolean {
  return event.nativeEvent.isTrusted === true
}

export function handleSelectionTranslateClick(
  event: Parameters<MouseEventHandler<HTMLButtonElement>>[0],
  onClick: MouseEventHandler<HTMLButtonElement>,
): void {
  if (isTrustedSelectionTranslateClick(event))
    onClick(event)
}

export function SelectionTranslateButton({ left, top, disabled = false, onClick }: SelectionTranslateButtonProps) {
  const label = i18n.t("selectionTranslation.action.translate")

  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={event => event.preventDefault()}
      onClick={event => handleSelectionTranslateClick(event, onClick)}
      data-read-frog-selection-button="true"
      className="pointer-events-auto fixed z-[2147483647] rounded-full border-transparent bg-white p-0 shadow-[0_2px_8px_rgba(0,0,0,0.24),0_0_0_1px_rgba(0,0,0,0.10)] transition-transform after:absolute after:inset-[-6px] after:content-[''] hover:scale-105 hover:bg-white active:scale-95 dark:border-transparent dark:bg-white dark:hover:bg-white motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
      style={{ left, top }}
    >
      <img src={readBuddyIconUrl} alt="" aria-hidden="true" width={20} height={20} className="size-5 rounded-sm" />
    </Button>
  )
}
