import type { SelectionTranslationState } from "./selection-controller"
import type { Config } from "@/types/config/config"
import type { ThemeMode } from "@/types/config/theme"
import { useAtomValue } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { useEffect, useState } from "react"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Popover, PopoverTrigger } from "@/components/ui/base-ui/popover"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { baseThemeModeAtom } from "@/utils/atoms/theme"
import { SelectionTranslateButton } from "./components/selection-translate-button"
import { SelectionTranslationPopover } from "./components/selection-translation-popover"
import { SelectionController } from "./selection-controller"

function HydrateSelectionAtoms({
  initialConfig,
  themeMode,
  children,
}: {
  initialConfig: Config
  themeMode: ThemeMode
  children: React.ReactNode
}) {
  useHydrateAtoms([
    [configAtom, initialConfig],
    [baseThemeModeAtom, themeMode],
  ])
  return children
}

function SelectionAppContent({ container }: { container: HTMLElement }) {
  const config = useAtomValue(configAtom)
  const [state, setState] = useState<SelectionTranslationState>({ status: "idle" })
  const [controller] = useState(() => new SelectionController({ config, onStateChange: setState }))

  useEffect(() => {
    controller.start()
    return () => controller.stop()
  }, [controller])

  useEffect(() => {
    controller.updateConfig(config)
  }, [config, controller])

  const hasButton = state.status !== "idle" && state.status !== "detecting"
  const isPopoverOpen = state.status === "translating" || state.status === "success" || state.status === "error"

  if (!hasButton)
    return null

  const position = state.position
  const popoverState = state.status === "ready" ? null : state.status

  return (
    <Popover
      open={isPopoverOpen}
      onOpenChange={(open) => {
        if (!open)
          controller.dismiss()
      }}
    >
      <PopoverTrigger
        render={(
          <SelectionTranslateButton
            left={position.left}
            top={position.top}
            disabled={state.status === "translating"}
            onClick={() => void controller.translateCurrent()}
          />
        )}
      />
      {popoverState && (
        <SelectionTranslationPopover
          state={popoverState}
          translation={state.status === "success" ? state.translation : undefined}
          error={state.status === "error" ? state.error : undefined}
          container={container}
          onRetry={() => void controller.retry()}
          onClose={() => controller.dismiss()}
        />
      )}
    </Popover>
  )
}

export function SelectionApp({
  initialConfig,
  themeMode,
  container,
}: {
  initialConfig: Config
  themeMode: ThemeMode
  container: HTMLElement
}) {
  return (
    <HydrateSelectionAtoms initialConfig={initialConfig} themeMode={themeMode}>
      <ThemeProvider container={container}>
        <TooltipProvider>
          <SelectionAppContent container={container} />
        </TooltipProvider>
      </ThemeProvider>
    </HydrateSelectionAtoms>
  )
}
