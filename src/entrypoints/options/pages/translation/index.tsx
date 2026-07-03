import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { AIContentAware } from "./ai-content-aware"
import { CustomTranslationStyle } from "./custom-translation-style"
import LanguageDetectionConfig from "./language-detection-config"
import { NodeTranslationHotkey } from "./node-translation-hotkey"
import { PageTranslationShortcut } from "./page-translation-shortcut"
import { PersonalizedPrompts } from "./personalized-prompt"
import { PreloadConfig } from "./preload-config"
import { RequestBatch } from "./request-batch"
import { RequestRate } from "./request-rate"
import { SmallParagraphFilter } from "./small-paragraph-filter"
import { TranslateRange } from "./translate-range"
import { TranslationMode } from "./translation-mode"

export function TranslationPage() {
  return (
    <PageLayout title={i18n.t("options.translation.title")}>
      <TranslationMode />
      <TranslateRange />
      <PageTranslationShortcut />
      <NodeTranslationHotkey />
      <CustomTranslationStyle />
      <AIContentAware />
      <PersonalizedPrompts />
      <LanguageDetectionConfig />
      <RequestRate />
      <RequestBatch />
      <PreloadConfig />
      <SmallParagraphFilter />
    </PageLayout>
  )
}
