import { i18n } from "@/utils/i18n"
import { DefaultProviderConfig } from "../../components/default-provider-config"
import { PageLayout } from "../../components/page-layout"
import { SubtitlesConfig } from "./subtitles-config"
import { SubtitlesCustomPrompts } from "./subtitles-custom-prompts"
import { SubtitlesRequestBatch } from "./subtitles-request-batch"
import { SubtitlesRequestRate } from "./subtitles-request-rate"
import { SubtitlesStyleSettings } from "./subtitles-style-settings"

export function VideoSubtitlesPage() {
  return (
    <PageLayout title={i18n.t("options.videoSubtitles.title")}>
      <DefaultProviderConfig featureKey="videoSubtitles" />
      <SubtitlesConfig />
      <SubtitlesStyleSettings />
      <SubtitlesCustomPrompts />
      <SubtitlesRequestRate />
      <SubtitlesRequestBatch />
    </PageLayout>
  )
}
