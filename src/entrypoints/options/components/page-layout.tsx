import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react"
import Container from "@/components/container"
import { Button } from "@/components/ui/base-ui/button"
import { useSidebar } from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

function MobileSidebarButton() {
  const { toggleSidebar } = useSidebar()
  const label = i18n.t("options.sidebar.toggle")

  return (
    <Button
      aria-label={label}
      title={label}
      variant="ghost"
      size="icon-lg"
      className="size-10 rounded-md text-muted-foreground hover:text-foreground active:scale-95 md:hidden"
      onClick={toggleSidebar}
    >
      <IconLayoutSidebarLeftExpand />
      <span className="sr-only">{label}</span>
    </Button>
  )
}

export function PageLayout({ title, children, className, innerClassName, separated = true }: { title: React.ReactNode, children: React.ReactNode, className?: string, innerClassName?: string, separated?: boolean }) {
  return (
    <div className={cn("w-full pb-8", className)}>
      <div className="border-b">
        <Container>
          <header className="flex h-14 shrink-0 items-center gap-2">
            <MobileSidebarButton />
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          </header>
        </Container>
      </div>
      <Container className={cn("@container", separated && "*:border-b [&>*:last-child]:border-b-0", innerClassName)}>
        {children}
      </Container>
    </div>
  )
}
