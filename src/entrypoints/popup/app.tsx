import { Icon } from "@iconify/react"
import readBuddyLogo from "@/assets/icons/read-buddy.png"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"
import { version } from "../../../package.json"
import LanguageOptionsSelector from "./components/language-options-selector"
import TranslateButton from "./components/translate-button"
import TranslateProviderField from "./components/translate-provider-field"
import TranslationModeSelector from "./components/translation-mode-selector"

function App() {
  return (
    <>
      <div className="bg-background flex flex-col gap-4 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="flex min-w-0 items-center gap-2">
            <img src={readBuddyLogo} alt="" className="size-5 shrink-0" />
            <span className="truncate">{i18n.t("name")}</span>
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {version}
          </span>
        </div>
        <LanguageOptionsSelector />
        <TranslateProviderField />
        <div className="grid w-full grid-cols-[48px_minmax(0,1fr)] gap-3">
          <TranslationModeSelector />
          <TranslateButton className="min-w-0" />
        </div>
      </div>
      <div className="flex items-center justify-between bg-muted px-2 py-1">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            void openOptionsPage()
          }}
        >
          <Icon icon="tabler:settings" className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">
            {i18n.t("popup.options")}
          </span>
        </button>
      </div>
    </>
  )
}

export default App
