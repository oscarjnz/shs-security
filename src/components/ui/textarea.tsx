import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background/40 px-3 py-2 text-base outline-none ring-offset-background transition-[border-color,box-shadow,background-color] duration-150 ease-out-quart placeholder:text-muted-foreground hover:border-input/80 focus-visible:border-ring/70 focus-visible:bg-background/70 focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
