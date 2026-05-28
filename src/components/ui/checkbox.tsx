import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "grid place-content-center peer h-4 w-4 shrink-0 rounded-[5px] border border-input bg-background/40 ring-offset-background transition-[background-color,border-color,box-shadow] duration-150 ease-out-quart hover:border-primary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:shadow-[0_0_12px_-2px_hsl(142_71%_45%/0.45)]",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("grid place-content-center text-current data-[state=checked]:animate-in data-[state=checked]:zoom-in-50 data-[state=checked]:duration-150")}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
