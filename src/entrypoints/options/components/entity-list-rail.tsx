import { cn } from "@/utils/styles/utils"

interface EntityListRailProps {
  children: React.ReactNode
  className?: string
  containerClassName?: string
}

export function EntityListRail({ children, className, containerClassName }: EntityListRailProps) {
  return (
    <div className={cn("overflow-y-auto", className, containerClassName)}>
      {children}
    </div>
  )
}
