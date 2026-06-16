import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { ProvidersConfig } from "./providers-config"

export function ApiProvidersPage() {
  return (
    <PageLayout title={i18n.t("options.apiProviders.title")} separated={false}>
      <div id="api-providers" className="space-y-6">
        <p className="text-sm text-muted-foreground">{i18n.t("options.apiProviders.description")}</p>
        <ProvidersConfig />
      </div>
    </PageLayout>
  )
}
