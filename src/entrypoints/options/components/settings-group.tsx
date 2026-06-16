import { cn } from "@/utils/styles/utils"

interface SettingsGroupProps {
  title: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-lg font-semibold tracking-tight text-balance text-foreground">
        {title}
      </h2>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        {children}
      </div>
    </div>
  )
}
