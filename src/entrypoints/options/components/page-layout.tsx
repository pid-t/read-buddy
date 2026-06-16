import Container from "@/components/container"
import { Separator } from "@/components/ui/base-ui/separator"
import { SidebarTrigger } from "@/components/ui/base-ui/sidebar"
import { cn } from "@/utils/styles/utils"

export function PageLayout({ title, children, className, innerClassName, separated = true }: { title: React.ReactNode, children: React.ReactNode, className?: string, innerClassName?: string, separated?: boolean }) {
  return (
    <div className={cn("w-full pb-8", className)}>
      <div className="border-b">
        <Container>
          <header className="flex h-14 shrink-0 items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mx-2 h-4" />
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
