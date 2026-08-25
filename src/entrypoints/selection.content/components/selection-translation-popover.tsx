import type { MouseEventHandler } from "react"
import { IconAlertCircle, IconCheck, IconClipboard, IconLoader2, IconRefresh, IconX } from "@tabler/icons-react"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/base-ui/alert"
import { Button } from "@/components/ui/base-ui/button"
import { PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle } from "@/components/ui/base-ui/popover"
import { extractAISDKErrorMessage } from "@/utils/error/extract-message"
import { i18n } from "@/utils/i18n"
import { isTrustedSelectionTranslateClick } from "./selection-translate-button"

export function getSelectionTranslationErrorMessage(error: unknown): string {
  const message = extractAISDKErrorMessage(error)
  const lower = message.toLowerCase()
  if (lower.includes("api key") || lower.includes("apikey") || lower.includes("missing"))
    return i18n.t("selectionTranslation.errors.missingApiKey")
  if (lower.includes("timeout") || lower.includes("timed out"))
    return i18n.t("selectionTranslation.errors.timeout")
  if (lower.includes("429") || lower.includes("rate") || lower.includes("too many"))
    return i18n.t("selectionTranslation.errors.rateLimited")
  if (lower.includes("extension context") || lower.includes("context invalidated"))
    return i18n.t("selectionTranslation.errors.contextInvalidated")
  if (lower.includes("provider") && (lower.includes("disabled") || lower.includes("unavailable") || lower.includes("no provider")))
    return i18n.t("selectionTranslation.errors.unavailable")
  return i18n.t("selectionTranslation.errors.generic")
}

export function handleSelectionTranslationRetryClick(
  event: Parameters<MouseEventHandler<HTMLButtonElement>>[0],
  onRetry: MouseEventHandler<HTMLButtonElement>,
): void {
  if (isTrustedSelectionTranslateClick(event))
    onRetry(event)
}

interface SelectionTranslationPopoverProps {
  state: "translating" | "success" | "error"
  translation?: string
  error?: unknown
  container: HTMLElement
  onRetry: MouseEventHandler<HTMLButtonElement>
  onClose: () => void
}

export function SelectionTranslationPopover({
  state,
  translation,
  error,
  container,
  onRetry,
  onClose,
}: SelectionTranslationPopoverProps) {
  const [copied, setCopied] = useState(false)
  const isLoading = state === "translating"

  const copyTranslation = async () => {
    if (!translation)
      return
    try {
      await navigator.clipboard.writeText(translation)
      setCopied(true)
      window.setTimeout(setCopied, 1400, false)
    }
    catch {
      setCopied(false)
    }
  }

  return (
    <PopoverContent
      container={container}
      side="bottom"
      align="end"
      sideOffset={8}
      positionMethod="fixed"
      collisionAvoidance={{ side: "flip", align: "shift" }}
      collisionPadding={8}
      sticky
      role="dialog"
      aria-label={i18n.t("selectionTranslation.popover.title")}
      className="w-[min(420px,calc(100vw-16px))] max-h-[min(50vh,480px)] overflow-hidden p-3"
      data-read-frog-selection-popover="true"
    >
      <PopoverHeader className="flex-row items-center justify-between gap-2">
        <PopoverTitle>{i18n.t("selectionTranslation.popover.title")}</PopoverTitle>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={i18n.t("selectionTranslation.popover.close")}
          title={i18n.t("selectionTranslation.popover.close")}
          onClick={onClose}
        >
          <IconX />
        </Button>
      </PopoverHeader>

      {isLoading && (
        <PopoverDescription className="flex items-center gap-2 py-4">
          <IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" />
          {i18n.t("selectionTranslation.popover.loading")}
        </PopoverDescription>
      )}

      {state === "success" && (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="max-h-[min(40vh,360px)] overflow-y-auto whitespace-pre-wrap break-words py-1 text-sm">
            {translation}
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-2">
            <Button variant="outline" size="sm" onClick={() => void copyTranslation()}>
              {copied ? <IconCheck /> : <IconClipboard />}
              {copied ? i18n.t("selectionTranslation.popover.copied") : i18n.t("selectionTranslation.popover.copy")}
            </Button>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-3 py-2">
          <Alert variant="destructive">
            <IconAlertCircle />
            <AlertDescription>{getSelectionTranslationErrorMessage(error)}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            className="self-end"
            onClick={event => handleSelectionTranslationRetryClick(event, onRetry)}
          >
            <IconRefresh />
            {i18n.t("selectionTranslation.popover.retry")}
          </Button>
        </div>
      )}
    </PopoverContent>
  )
}
