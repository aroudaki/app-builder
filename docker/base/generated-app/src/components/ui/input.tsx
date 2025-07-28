import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * INPUT COMPONENT
 * 
 * CODER AGENT INSTRUCTIONS:
 * - This is a pre-built Input component for forms
 * - Import: import { Input } from '@/components/ui/input'
 * - Usage: <Input type="text" placeholder="Enter text..." value={value} onChange={(e) => setValue(e.target.value)} />
 * 
 * Supported types:
 * - text (default)
 * - email
 * - password
 * - number
 * - search
 * - url
 * - tel
 * 
 * Examples:
 * - <Input placeholder="Your name" />
 * - <Input type="email" placeholder="your@email.com" />
 * - <Input type="password" placeholder="Password" />
 * - <Input type="number" placeholder="Age" min={0} max={120} />
 */

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
