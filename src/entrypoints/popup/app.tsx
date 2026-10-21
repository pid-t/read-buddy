import { Icon } from "@iconify/react"
import readBuddyLogo from "@/assets/icons/read-buddy.png"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"
import { version } from "../../../package.json"
import LanguageOptionsSelector from "./components/language-options-selector"
import TranslateButton from "./components/translate-button"
import TranslateProviderField from "./components/translate-provider-field"
import TranslationModeSelector from "./components/translation-mode-selector"
import "./popup.css"

function App() {
  return (
    <div className="popup-surface">
      <div className="bg-background flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between text-[14px] font-medium">
          <span className="flex min-w-0 items-center gap-2">
            <img src={readBuddyLogo} alt="" className="size-5 shrink-0" />
            <span className="truncate">{i18n.t("name")}</span>
          </span>
          <span className="text-[11px] font-normal text-foreground/60">
            {version}
          </span>
        </div>
        <LanguageOptionsSelector />
        <TranslateProviderField />
        <div className="grid w-full grid-cols-[36px_minmax(0,1fr)] items-center gap-2 [&>button]:h-9 [&>button]:rounded-lg [&>button]:text-[13px] [&>button]:motion-reduce:transition-none [&>button:first-child]:w-9">
          <TranslationModeSelector />
          <TranslateButton className="min-w-0" />
        </div>
      </div>
      <div className="popup-footer flex items-center border-t border-border/60 px-3 py-1">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1.5 text-foreground/70 outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          onClick={() => {
            void openOptionsPage()
          }}
        >
          <Icon icon="tabler:settings" className="size-4" strokeWidth={1.6} />
          <span className="text-[12px] font-medium leading-4">
            {i18n.t("popup.options")}
          </span>
        </button>
      </div>
    </div>
  )
}

export default App
