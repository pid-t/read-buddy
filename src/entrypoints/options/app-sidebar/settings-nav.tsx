import { Icon } from "@iconify/react"
import { Link, useLocation } from "react-router"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"

export function SettingsNav() {
  const { pathname } = useLocation()
  const generalTitle = i18n.t("options.general.title")
  const apiProvidersTitle = i18n.t("options.apiProviders.title")
  const translationTitle = i18n.t("options.translation.title")
  const videoSubtitlesTitle = i18n.t("options.videoSubtitles.title")
  const systemTitle = i18n.t("options.system.title")

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.settings")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/" />} isActive={pathname === "/"} tooltip={generalTitle}>
              <Icon icon="tabler:adjustments-horizontal" />
              <span>{generalTitle}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/api-providers" />} isActive={pathname === "/api-providers"} tooltip={apiProvidersTitle}>
              <Icon icon="tabler:api" />
              <span>{apiProvidersTitle}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/translation" />} isActive={pathname === "/translation"} tooltip={translationTitle}>
              <Icon icon="ri:translate" />
              <span>{translationTitle}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/video-subtitles" />} isActive={pathname === "/video-subtitles"} tooltip={videoSubtitlesTitle}>
              <Icon icon="tabler:subtitles" />
              <span>{videoSubtitlesTitle}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/config" />} isActive={pathname === "/config"} tooltip={systemTitle}>
              <Icon icon="tabler:settings" />
              <span>{systemTitle}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
