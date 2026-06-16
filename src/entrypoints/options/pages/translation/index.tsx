import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { SettingsGroup } from "../../components/settings-group"
import { AIContentAware } from "./ai-content-aware"
import { AutoTranslateLanguages } from "./auto-translate-languages"
import { AutoTranslateWebsitePatterns } from "./auto-translate-website-patterns"
import { ClearCacheConfig } from "./clear-cache-config"
import { CustomTranslationStyle } from "./custom-translation-style"
import LanguageDetectionConfig from "./language-detection-config"
import { NeverAutoTranslateWebsitePatterns } from "./never-auto-translate-website-patterns"
import { NodeTranslationHotkey } from "./node-translation-hotkey"
import { PageTranslationShortcut } from "./page-translation-shortcut"
import { PersonalizedPrompts } from "./personalized-prompt"
import { PreloadConfig } from "./preload-config"
import { RequestBatch } from "./request-batch"
import { RequestRate } from "./request-rate"
import { SkipLanguages } from "./skip-languages"
import { SmallParagraphFilter } from "./small-paragraph-filter"
import { TranslateRange } from "./translate-range"
import { TranslationMode } from "./translation-mode"

export function TranslationPage() {
  return (
    <PageLayout title={i18n.t("options.translation.title")} separated={false}>
      <div className="space-y-10">
        <SettingsGroup title={i18n.t("options.translation.groups.behavior")}>
          <TranslationMode />
          <TranslateRange />
          <PageTranslationShortcut />
          <NodeTranslationHotkey />
        </SettingsGroup>

        <SettingsGroup title={i18n.t("options.translation.groups.displayAndQuality")}>
          <CustomTranslationStyle />
          <AIContentAware />
          <PersonalizedPrompts />
        </SettingsGroup>

        <SettingsGroup title={i18n.t("options.translation.groups.automationAndRules")}>
          <LanguageDetectionConfig />
          <AutoTranslateWebsitePatterns />
          <NeverAutoTranslateWebsitePatterns />
          <AutoTranslateLanguages />
          <SkipLanguages />
        </SettingsGroup>

        <SettingsGroup title={i18n.t("options.translation.groups.performanceAndCache")}>
          <RequestRate />
          <RequestBatch />
          <PreloadConfig />
          <SmallParagraphFilter />
          <ClearCacheConfig />
        </SettingsGroup>
      </div>
    </PageLayout>
  )
}
