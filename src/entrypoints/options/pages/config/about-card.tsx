import ReactMarkdown from "react-markdown"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

export function AboutCard() {
  const mission = i18n.t("options.config.about.mission")

  return (
    <ConfigCard
      id="about"
      title={i18n.t("options.config.about.title")}
      description={i18n.t("options.config.about.description")}
    >
      <div className="max-w-xl text-sm text-muted-foreground">
        <ReactMarkdown
          components={{
            p: "span",
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
                {children}
              </a>
            ),
          }}
        >
          {mission}
        </ReactMarkdown>
      </div>
    </ConfigCard>
  )
}
