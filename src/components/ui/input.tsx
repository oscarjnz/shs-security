import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background/40 px-3 py-2 text-base outline-none ring-offset-background transition-[border-color,box-shadow,background-color] duration-150 ease-out-quart file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-input/80 focus-visible:border-ring/70 focus-visible:bg-background/70 focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
