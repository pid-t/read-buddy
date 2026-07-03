import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { AutoTranslateLanguages } from "./auto-translate-languages"
import { AutoTranslateWebsitePatterns } from "./auto-translate-website-patterns"
import { NeverAutoTranslateWebsitePatterns } from "./never-auto-translate-website-patterns"
import { SkipLanguages } from "./skip-languages"

export function SiteRulesPage() {
  return (
    <PageLayout title={i18n.t("options.siteRules.title")}>
      <AutoTranslateWebsitePatterns />
      <NeverAutoTranslateWebsitePatterns />
      <AutoTranslateLanguages />
      <SkipLanguages />
    </PageLayout>
  )
}
