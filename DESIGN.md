# Design System — MindCanvas

## Theme

Dark-only application. No light theme support.

## Colors

Defined in `frontend/src/index.css` via Tailwind v4 `@theme`:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-brand` | `#3b82f6` (blue-600) | Primary buttons, selected edges, focus rings |
| `--color-brand-hover` | `#2563eb` (blue-700) | Hover state on primary actions |
| `--color-bg` | `#030712` (gray-950) | Page background |
| `--color-bg-card` | `#111827` (gray-900) | Card/modal background |
| `--color-bg-surface` | `#1f2937` (gray-800) | Secondary surfaces, inputs |
| `--color-bg-input` | `#1f2937` (gray-800) | Form inputs |
| `--color-bg-hover` | `#374151` (gray-700) | Hover state on surface elements |
| `--color-border` | `#374151` (gray-700) | Card borders, dividers |
| `--color-border-hover` | `#4b5563` (gray-600) | Hover state on borders |
| `--color-text-primary` | `#f9fafb` (gray-50) | Headings, body text |
| `--color-text-secondary` | `#9ca3af` (gray-400) | Labels, muted text |
| `--color-text-muted` | `#6b7280` (gray-500) | Timestamps, tertiary text |
| `--color-danger` | `#dc2626` (red-600) | Error actions |
| `--color-danger-hover` | `#b91c1c` (red-700) | Error hover |

## Typography

- Font family: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`)
- No custom font files loaded
- Sizes: `text-3xl` (page titles), `text-2xl` (login title), `text-xl` (section headers), `text-lg` (card titles), `text-sm` (body text, buttons, inputs), `text-xs` (error badges, dropdown items)

## Spacing

- Page padding: `p-4 sm:p-8`
- Card padding: `p-4` (cards), `p-3` (node internals)
- Section gap: `gap-2`, `gap-3`, `gap-4`
- Modal: `w-96` (create), `w-80` (confirm)

## Border Radius

- `--radius-sm`: `4px` — small buttons, tags
- `--radius-md`: `8px` — inputs, buttons, cards
- `--radius-lg`: `12px` — modals, large containers

## Components

### Buttons
- Primary: `bg-brand hover:bg-brand-hover text-text-primary rounded-md px-4 py-2 text-sm`
- Secondary: `bg-bg-input hover:bg-bg-hover text-text-primary rounded-md px-4 py-2 text-sm`
- Icon-only: `p-2.5` (minimum 44px touch target)

### Cards
- `bg-bg-card border border-border rounded-lg shadow-xl`
- Selected state: `border-brand` instead of `border-border`

### Inputs
- `bg-bg-input text-text-primary border border-border rounded-md px-3 py-2 text-sm`
- Focus: `focus:border-brand` + global `:focus-visible` outline

### Modals
- Backdrop: `fixed inset-0 z-50 bg-black/60`
- Card: `bg-bg-card border border-border rounded-lg p-6`
- ARIA: `role="dialog" aria-modal="true"`

### Empty State
- Icon in circle: `w-16 h-16 rounded-full bg-bg-surface flex items-center justify-center mb-4`
- Title: `text-lg font-medium text-text-secondary mb-2`
- Description: `text-text-muted text-sm max-w-xs`

### Loading State
- Spinner: `w-8 h-8 border-2 border-border border-t-brand rounded-full animate-spin`

### Error Banner
- `bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-md px-3 py-2`

## Accessibility

- `:focus-visible` shows 2px brand outline (keyboard users)
- `:focus:not(:focus-visible)` removes outline (mouse/touch users)
- All interactive elements have `aria-label`
- All modals have `role="dialog" aria-modal="true"`
- Toolbars have `role="toolbar"`

## Responsive

- Breakpoint: `sm:` (640px)
- Below `sm`: stacked layouts, hidden text labels (icons only)
- Node width: `min(400px, 90vw)` — adapts to small screens
