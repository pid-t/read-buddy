import readBuddyLogo from "@/assets/icons/read-buddy.png"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"
import { version } from "../../../../package.json"
import { SettingsNav } from "./settings-nav"

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[state=expanded]:px-5 group-data-[state=expanded]:pt-4 transition-all">
        <a href="https://github.com/pid-t/read-buddy" className="flex items-center gap-2">
          <img src={readBuddyLogo} alt="Logo" className="h-8 w-8 shrink-0" />
          <span className="text-md font-bold overflow-hidden truncate">{i18n.t("name")}</span>
          <span className="text-xs text-muted-foreground overflow-hidden truncate">
            {`v${version}`}
          </span>
        </a>
      </SidebarHeader>
      <SidebarContent className="group-data-[state=expanded]:px-2 transition-all">
        <SettingsNav />
      </SidebarContent>
      <SidebarFooter className="mt-auto border-t border-sidebar-border/70 p-2 group-data-[state=collapsed]:items-center">
        <SidebarTrigger
          aria-label={i18n.t("options.sidebar.toggle")}
          title={i18n.t("options.sidebar.toggle")}
          className="h-10 w-full justify-start gap-2 rounded-md px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-95 group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:p-0"
        >
          <span className="truncate group-data-[state=collapsed]:sr-only">
            {i18n.t("options.sidebar.toggle")}
          </span>
        </SidebarTrigger>
      </SidebarFooter>
    </Sidebar>
  )
}
