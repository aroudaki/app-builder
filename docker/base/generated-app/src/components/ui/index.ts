/**
 * UI COMPONENTS OVERVIEW
 *
 * CODER AGENT INSTRUCTIONS:
 * This directory contains pre-built, reusable UI components.
 * All components are styled with Tailwind CSS and follow modern React patterns.
 *
 * AVAILABLE COMPONENTS:
 *
 * 1. Button (button.tsx)
 *    - Import: import { Button } from '@/components/ui/button'
 *    - Variants: default, destructive, outline, secondary, ghost, link
 *    - Sizes: default, sm, lg, icon
 *    - Example: <Button variant="outline" size="lg">Click me</Button>
 *
 * 2. Card (card.tsx)
 *    - Import: import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
 *    - Use for structured content containers
 *    - Example: <Card><CardHeader><CardTitle>Title</CardTitle></CardHeader><CardContent>Content</CardContent></Card>
 *
 * 3. Input (input.tsx)
 *    - Import: import { Input } from '@/components/ui/input'
 *    - Types: text, email, password, number, search, url, tel
 *    - Example: <Input type="email" placeholder="Enter email" value={email} onChange={(e) => setEmail(e.target.value)} />
 *
 * USAGE TIPS:
 * - All components accept standard HTML attributes
 * - Use className prop to add custom Tailwind classes
 * - Components are accessible and keyboard-friendly
 * - All components are TypeScript-ready with proper type definitions
 *
 * CREATING NEW COMPONENTS:
 * - Follow the same pattern as existing components
 * - Use React.forwardRef for proper ref handling
 * - Include helpful comments for the coder agent
 * - Use Tailwind CSS for styling
 * - Make components reusable and flexible
 */

// This file is for documentation only - import components directly from their files
