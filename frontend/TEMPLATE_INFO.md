# Template Architecture

## Overview
This is a **modern** React + TypeScript + Vite template with pre-built **shadcn/ui components** that works out-of-the-box without any backend configuration.

## Features
- ✅ **Zero Configuration** - Works immediately after build
- ✅ **Pre-built UI Components** - shadcn/ui components ready to use
- ✅ **No Dependencies** on external services
- ✅ **localStorage** for data persistence
- ✅ **Tailwind CSS** for styling with CSS variables
- ✅ **Toast Notifications** with Sonner
- ✅ **Path Aliases** - Use `@/` for imports

## UI Component System

### Available Components (in `@/components/ui`)
```tsx
// Form Elements
Button, Input, Textarea, Label, Checkbox, Switch, Select

// Layout
Card, Tabs, Accordion, Separator, ScrollArea

// Feedback
Badge, Progress, Skeleton, toast (sonner)

// Overlays
Dialog, AlertDialog, Popover, Tooltip, DropdownMenu

// Data Display
Avatar
```

### Usage Examples
```tsx
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

// Button variants
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

// Toast notifications
toast.success("Saved!")
toast.error("Error occurred")
```

### Utility Function
```tsx
import { cn } from "@/lib/utils"

// Merge classes conditionally
<div className={cn("base-class", isActive && "active-class")} />
```

## File Structure
```
src/
├── components/
│   └── ui/             # Pre-built shadcn/ui components
├── lib/
│   └── utils.ts        # cn() utility function
├── pages/
│   └── HomePage.tsx    # Main page (replace with your app)
├── hooks/              # Custom React hooks
├── services/           # API services
├── App.tsx             # Main app component with routing
├── main.tsx            # App entry point with providers
└── index.css           # CSS variables for theming
```

## For AI Assistants

### CRITICAL: Use Pre-built Components

❌ NEVER write raw Tailwind for common UI:
```tsx
<button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">
  Click
</button>
```

✅ ALWAYS use pre-built components:
```tsx
import { Button } from "@/components/ui/button"
<Button>Click</Button>
```

### Important Guidelines
1. **ALWAYS import from `@/components/ui`** for buttons, inputs, cards, dialogs, etc.
2. **Use `toast()` from sonner** for notifications
3. **Use `cn()` from `@/lib/utils`** for conditional styling
4. **Replace HomePage.tsx** with the user's requested application
5. Keep components small and focused
6. Use localStorage for data persistence unless backend is needed

### Component Priority
When building UI, use these pre-built components:
- **Forms**: `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Switch`
- **Buttons**: `Button` with variants (default, secondary, destructive, outline, ghost)
- **Cards**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- **Dialogs**: `Dialog`, `AlertDialog`
- **Navigation**: `Tabs`, `DropdownMenu`
- **Feedback**: `Progress`, `Skeleton`, `Badge`, `toast()`

## Build and Deployment

```bash
# Development
npm install
npm run dev

# Production Build
npm run build

# Serve Build
npx http-server dist
```

The built application works immediately without any backend setup.
