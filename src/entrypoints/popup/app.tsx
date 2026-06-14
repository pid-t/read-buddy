import { Icon } from "@iconify/react"
import { i18n } from "#imports"
import { openOptionsPage } from "@/utils/navigation"
import { version } from "../../../package.json"
import LanguageOptionsSelector from "./components/language-options-selector"
import TranslateButton from "./components/translate-button"
import TranslateProviderField from "./components/translate-provider-field"
import TranslationModeSelector from "./components/translation-mode-selector"

function App() {
  return (
    <>
      <div className="bg-background flex flex-col gap-4 px-6 pt-5 pb-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>{i18n.t("name")}</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {version}
          </span>
        </div>
        <LanguageOptionsSelector />
        <TranslateProviderField />
        <div className="flex w-full items-center gap-2">
          <TranslationModeSelector />
          <TranslateButton className="min-w-0 flex-1" />
        </div>
      </div>
      <div className="flex items-center justify-between bg-neutral-200 px-2 py-1 dark:bg-neutral-800">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
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
