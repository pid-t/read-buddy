import { cn } from "@/utils/styles/utils"

export function ConfigCard(
  { id, title, description, children, className, titleClassName }:
  { id?: string, title: React.ReactNode, description: React.ReactNode, children: React.ReactNode, className?: string, titleClassName?: string },
) {
  return (
    <section id={id} className={cn("py-6 grid gap-6 lg:grid-cols-[280px_1fr] lg:gap-x-8", className)}>
      <div className="min-w-0">
        <h3 className={cn("text-base font-semibold mb-1 text-balance text-foreground", titleClassName)}>{title}</h3>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="min-w-0 max-w-2xl">
        {children}
      </div>
    </section>
  )
}
