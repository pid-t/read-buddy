import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import FeatureProvidersConfig from "./feature-providers-config"
import SiteControlMode from "./site-control-mode"
import UiLocaleConfig from "./ui-locale-config"

export function GeneralPage() {
  return (
    <PageLayout title={i18n.t("options.general.title")}>
      <UiLocaleConfig />
      <FeatureProvidersConfig />
      <SiteControlMode />
    </PageLayout>
  )
}
