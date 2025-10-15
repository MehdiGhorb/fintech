# 🎨 UI/UX Design Guide

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Navigation Bar                          │
│  FinTech        [Markets] [News]                            │
├────────────────────────────────────┬────────────────────────┤
│                                    │                         │
│                                    │   🤖 AI Assistant      │
│     Main Content Area              │   ┌──────────────┐    │
│     (Markets/News/Charts)          │   │  💬 Chat     │    │
│                                    │   │  Messages    │    │
│                                    │   │              │    │
│                                    │   │              │    │
│                                    │   └──────────────┘    │
│                                    │   Quick Actions        │
│                                    │   [Ask Question...]    │
│                                    │   [Send]               │
│                                    │   ⚠️ Disclaimer       │
└────────────────────────────────────┴────────────────────────┘
```

## Color Scheme

### Primary Colors
- **Background**: `#0a0a0a` (Deep Black)
- **Surface**: `#1a1a1a` (Dark Gray)
- **Border**: `#333333` (Medium Gray)

### Accent Colors
- **Blue** (Markets): `#3b82f6` - Primary action color
- **Purple** (News): `#a855f7` - Secondary highlight
- **Green** (Positive): `#4ade80` - Price increases
- **Red** (Negative): `#f87171` - Price decreases
- **Yellow** (Warning): `#fbbf24` - Disclaimers

### Text Colors
- **Primary Text**: `#ededed` (Light Gray)
- **Secondary Text**: `#9ca3af` (Medium Gray)
- **Muted Text**: `#6b7280` (Dark Gray)

## Component Styling

### Assistant Panel
- **Width**: 384px (w-96) on desktop
- **Width**: 100% on mobile
- **Position**: Fixed right, top 64px (below nav)
- **Background**: `rgba(17, 24, 39, 0.95)` with backdrop blur
- **Border**: 1px solid `#374151`

### Chat Messages
- **User Messages**: 
  - Background: `#3b82f6` (Blue)
  - Text: White
  - Max width: 85%
  - Aligned: Right
  - Border radius: 16px

- **AI Messages**:
  - Background: `#1f2937` (Dark Gray)
  - Text: `#f3f4f6` (Light Gray)
  - Max width: 85%
  - Aligned: Left
  - Border radius: 16px

### Buttons
- **Primary** (Send):
  - Background: `#3b82f6`
  - Hover: `#2563eb`
  - Padding: 12px 16px
  - Border radius: 8px

- **Secondary** (Quick Actions):
  - Background: `#1f2937`
  - Hover: `#374151`
  - Padding: 8px 12px
  - Border radius: 8px
  - Font size: 12px

### Input Field
- Background: `#111827`
- Border: `#4b5563`
- Focus border: `#3b82f6`
- Padding: 8px 12px
- Border radius: 8px
- Font size: 14px

## Spacing Guidelines

### Panel Spacing
- Header padding: 16px
- Content padding: 16px
- Message gap: 12px
- Button gap: 8px

### Main Content
- Container max-width: 1280px
- Horizontal padding: 16px
- Vertical padding: 32px
- Right padding (desktop): 384px (for assistant panel)

## Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### Font Sizes
- **Hero Title**: 48px (3xl), bold
- **Page Title**: 36px (2xl), bold
- **Section Header**: 24px (xl), bold
- **Card Title**: 18px (lg), semibold
- **Body Text**: 14px (sm), regular
- **Small Text**: 12px (xs), regular
- **Tiny Text**: 10px, regular

## Interactive States

### Hover Effects
- Cards: Border color changes, subtle shadow
- Buttons: Background darkens slightly
- Links: Text color changes

### Active States
- Navigation: Background tint, accent color text
- Inputs: Border changes to accent color

### Loading States
- Skeleton screens: Pulsing gray backgrounds
- Spinners: Rotating loader icon

## Responsive Breakpoints

```css
/* Mobile First */
default: < 640px (full width)

/* Tablet */
md: >= 768px (grid columns increase)

/* Desktop */
lg: >= 1024px (assistant panel appears)

/* Large Desktop */
xl: >= 1280px (max container width)
```

## Animation Guidelines

### Transitions
- Duration: 200-300ms
- Easing: ease-in-out
- Properties: color, background, border, transform

### Keyframes
- Fade in: opacity 0 → 1
- Slide up: translateY(10px) → 0
- Pulse: scale(1) → scale(1.05) → scale(1)

## Accessibility

### Contrast Ratios
- Text on background: >= 7:1 (AAA)
- Interactive elements: >= 4.5:1 (AA)

### Focus States
- Visible outline on keyboard navigation
- Color: Accent blue
- Width: 2px
- Offset: 2px

## Best Practices

1. **Whitespace**: Use generous padding and margins
2. **Consistency**: Same spacing/sizing patterns throughout
3. **Hierarchy**: Clear visual hierarchy with size and weight
4. **Feedback**: Immediate visual feedback on interactions
5. **Performance**: Smooth 60fps animations
6. **Mobile**: Touch-friendly targets (min 44x44px)

## Code Examples

### Button Component
```tsx
<button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
  Click me
</button>
```

### Card Component
```tsx
<div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all">
  Content
</div>
```

### Input Component
```tsx
<input 
  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
/>
```

---

**Keep it clean, keep it simple, keep it professional! 🎨**
