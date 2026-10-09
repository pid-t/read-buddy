import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import UiLocaleConfig from "./ui-locale-config"

export function GeneralPage() {
  return (
    <PageLayout title={i18n.t("options.general.title")}>
      <UiLocaleConfig />
    </PageLayout>
  )
}
