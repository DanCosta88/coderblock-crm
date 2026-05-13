# React + TypeScript + Vite Template

A modern React application template with TypeScript, Vite, Tailwind CSS, and pre-built shadcn/ui components.

## Features

- ⚡ **Vite** for lightning-fast development
- 🔷 **TypeScript** for type safety
- 🎨 **Tailwind CSS** for styling
- 🧩 **shadcn/ui components** pre-installed
- 📱 **Responsive design** out of the box
- 🔥 **Hot Module Replacement** for instant feedback
- 🔔 **Toast notifications** with Sonner

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── ui/            # shadcn/ui components (pre-built)
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities (cn function)
│   ├── services/          # API services
│   ├── App.tsx            # Main application component
│   └── main.tsx           # Application entry point
├── public/                # Static assets
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

## UI Components

This template includes **shadcn/ui components** ready to use. Import them from `@/components/ui`:

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
// ... and more!
```

### Utility Function

Use `cn()` for conditional class merging:

```tsx
import { cn } from "@/lib/utils"

<Button className={cn("w-full", isActive && "bg-green-500")}>
  Submit
</Button>
```

### Toast Notifications

```tsx
import { toast } from "sonner"

toast.success("Saved successfully!")
toast.error("Something went wrong")
toast("Default notification")
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The development server will start at `http://localhost:3000`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Data Persistence

This template uses **localStorage** for data persistence by default. This is great for:

- Prototyping and testing
- Simple applications
- Offline-first apps
- No backend setup required

### Example: localStorage Counter

```tsx
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

function Counter() {
  const [count, setCount] = useState(() => {
    const saved = localStorage.getItem('count')
    return saved ? parseInt(saved, 10) : 0
  })

  useEffect(() => {
    localStorage.setItem('count', count.toString())
  }, [count])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Counter</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold mb-4">{count}</p>
        <Button onClick={() => setCount(c => c + 1)}>
          Increment
        </Button>
      </CardContent>
    </Card>
  )
}
```

## Styling

This template uses Tailwind CSS with CSS variables for theming. You can customize:

- `tailwind.config.js` - Theme configuration
- `src/index.css` - CSS variables for colors

### Design Tokens

```css
/* Light mode */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--primary: 222.2 47.4% 11.2%;
--secondary: 210 40% 96.1%;
--muted: 210 40% 96.1%;
--destructive: 0 84.2% 60.2%;

/* Dark mode */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

## Best Practices

1. **Use UI Components**: Always use pre-built components from `@/components/ui`
2. **Type Safety**: Use TypeScript interfaces for props
3. **State Management**: Use React hooks for local state
4. **Toast Notifications**: Use `toast()` from sonner for user feedback
5. **Conditional Styling**: Use `cn()` for dynamic classes

## License

MIT
