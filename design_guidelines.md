# Design Guidelines: Painting Business SaaS Platform

## Design Approach

**Selected Approach:** Design System Hybrid (Linear + Material Design + Notion)

**Justification:** This productivity-focused, data-dense business application requires exceptional usability and information hierarchy. Drawing from Linear's precision and clarity, Material Design's component patterns for data display, and Notion's intuitive organization, we'll create a professional tool that feels both powerful and approachable.

**Core Design Principles:**
- **Clarity First:** Every element serves a clear purpose with obvious hierarchy
- **Information Density:** Efficient use of space without overwhelming users
- **Progressive Disclosure:** Show complexity only when needed
- **Responsive Hierarchy:** Adapt layouts seamlessly from desktop to mobile

---

## Typography System

**Font Families:**
- Primary: Inter (via Google Fonts) - for UI, labels, body text
- Monospace: JetBrains Mono - for measurements, calculations, technical data

**Type Scale:**
```
Hero/Page Titles: text-4xl font-bold (36px)
Section Headers: text-2xl font-semibold (24px)
Card Titles: text-xl font-semibold (20px)
Subsection Headers: text-lg font-medium (18px)
Body Text: text-base (16px)
Secondary Text: text-sm (14px)
Caption/Meta: text-xs (12px)
Measurements/Data: font-mono text-sm
```

**Font Weights:**
- Regular (400): Body text, descriptions
- Medium (500): Subheadings, labels, navigation
- Semibold (600): Card titles, section headers
- Bold (700): Page titles, primary CTAs

---

## Layout System

**Tailwind Spacing Primitives:** Use units of **2, 4, 6, 8, 12, 16, 20** for consistent rhythm

**Common Spacing Patterns:**
- Component padding: p-4 to p-6
- Card padding: p-6
- Section spacing: mb-8 to mb-12
- Grid gaps: gap-4 to gap-6
- Page margins: px-4 md:px-6 lg:px-8
- Vertical sections: py-8 to py-12

**Layout Grid:**
```
Dashboard Layout: Sidebar (w-64) + Main Content (flex-1)
Content Max Width: max-w-7xl mx-auto
Card Grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
Form Layouts: max-w-2xl for optimal reading/input width
```

**Responsive Breakpoints:**
- Mobile: Base styles (single column)
- Tablet: md: (640px) - 2 columns where appropriate
- Desktop: lg: (1024px) - 3+ columns, full sidebar
- Wide: xl: (1280px) - Maximum content width

---

## Component Library

### Navigation & Shell

**Top Navigation Bar:**
- Fixed height: h-16
- Contains: Logo, org switcher dropdown, primary nav links, user profile menu
- Layout: Flex justify-between items-center px-6
- Border: border-b

**Sidebar (Desktop):**
- Fixed width: w-64
- Sections: Main navigation, projects quick access, bottom utility links
- Each nav item: px-4 py-2 rounded-lg hover state
- Active indicator: Border-l-4 with accent treatment
- Collapsible on tablet: transforms to hamburger menu

**Mobile Header:**
- Hamburger menu icon (top-left)
- Logo (center)
- User avatar (top-right)
- Slide-in drawer navigation

### Dashboard Components

**Stats Cards:**
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Card structure: p-6 rounded-lg border
- Contains: Icon (top-left), label (text-sm), value (text-3xl font-bold), trend indicator
- Height: Consistent min-h-32

**Project Cards:**
- Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Structure: Image/visual header (h-48), content section (p-6)
- Content: Project name (text-xl font-semibold), client name (text-sm), status badge, metadata row, action buttons
- Border-l-4 for status color coding (without specifying colors)

**Quick Actions Panel:**
- Floating button group or prominent card
- Contains: "New Project", "New Quote", "Schedule Job"
- Button hierarchy: Primary + Secondary actions

### Forms & Inputs

**Form Structure:**
- Label-above pattern: mb-2 text-sm font-medium
- Input spacing: space-y-6 for form fields
- Field groups: border rounded-lg p-6 for related inputs
- Helper text: text-xs mt-1

**Input Fields:**
- Consistent height: h-10 to h-11
- Padding: px-3 py-2
- Border: rounded-md border
- Focus treatment: Ring effect

**Measurement Inputs:**
- Special styling: font-mono text for numerical values
- Unit display: Inline suffix (e.g., "12.5 ft")
- Grid layout for room dimensions: grid-cols-2 md:grid-cols-4 gap-4
- Labels: "Length", "Width", "Height", "Ceiling"

**Select Dropdowns:**
- Height matches text inputs: h-10
- Chevron icon: Right-aligned
- Multi-select: Checkbox list with search

### Data Display

**Tables:**
- Responsive: Hidden columns on mobile, card view fallback
- Header: bg treatment, font-medium, text-sm
- Rows: p-4 border-b
- Hover state: Entire row highlight
- Action column: Right-aligned icons

**Room/Measurement Display:**
- Card format with schematic icon/illustration placeholder
- Dimensions grid: 2x2 layout showing L x W x H
- Calculated area: Prominent display (text-2xl font-bold)
- Paint coverage estimate: Below area

**Quote Builder:**
- Multi-step interface with progress indicator
- Left panel: Line items list (scrollable)
- Right panel: Running total, tax, final amount
- Add item button: "+ Add Line Item" prominent but secondary
- Each line item: Editable inline or modal

### Scheduling Calendar

**Calendar View:**
- Week/Month toggle
- Grid layout with time slots
- Project cards: Draggable items (rounded, p-2, truncate text)
- Day headers: Sticky position
- Current time indicator: Visual line

**Crew Assignment:**
- Avatar + name display
- Drag-and-drop zones for unassigned/assigned
- Color-coded assignments (no specific colors)

### Client Portal (Public-facing)

**Portal Layout:**
- Cleaner, simpler than admin interface
- Top bar: Company logo, project name
- Content: Centered max-w-4xl
- Less chrome, more focus on content

**Quote Viewer:**
- Hero-like header with project summary
- Itemized breakdown: Table format
- Visual separation between sections
- Prominent total
- Download PDF button: Sticky bottom on mobile

### Modals & Overlays

**Modal Structure:**
- Max width: max-w-2xl for forms, max-w-4xl for complex content
- Padding: p-6
- Header: pb-4 border-b (Title + Close button)
- Content: py-6
- Footer: pt-4 border-t (Actions right-aligned)

**Confirmation Dialogs:**
- Smaller: max-w-md
- Icon at top (warning/info)
- Title, description, actions

**Slide-over Panels:**
- For quick edits/details
- Fixed width: w-96 on desktop
- Full width on mobile

### Buttons & Actions

**Primary Buttons:**
- Height: h-10 to h-11
- Padding: px-6
- Rounded: rounded-md
- Font: font-medium

**Secondary Buttons:**
- Same size as primary
- Border variant

**Icon Buttons:**
- Square: w-10 h-10
- Rounded: rounded-md
- Icons from Heroicons

**Button Groups:**
- Space-x-3 between actions
- Primary action rightmost

### Badges & Status

**Status Badges:**
- Inline-flex items-center
- Padding: px-2.5 py-0.5
- Rounded: rounded-full
- Font: text-xs font-medium
- Dot indicator: w-1.5 h-1.5 rounded-full mr-1.5

**Feature Locks (Entitlements):**
- Locked features: Opacity-50 with lock icon overlay
- Tooltip on hover explaining plan requirement
- Upgrade CTA: Small badge "Pro Feature"

### Empty States

**No Data Illustrations:**
- Centered: flex flex-col items-center justify-center
- Icon placeholder: w-24 h-24 mx-auto mb-4
- Heading: text-lg font-medium
- Description: text-sm max-w-sm text-center
- CTA button below

---

## Animations

Use sparingly and purposefully:
- Transitions: transition-colors duration-150 for hover states
- Modal entrance: Fade + slight scale (duration-200)
- Drawer slide: translate-x with duration-300
- No scroll animations
- No complex page transitions

---

## Icons

**Library:** Heroicons (via CDN)
- Outline style for navigation, general UI
- Solid style for filled states, emphasis
- Consistent sizing: w-5 h-5 for inline, w-6 h-6 for standalone

---

## Images

**Usage Areas:**
- Project cards: Featured image or placeholder (h-48 object-cover)
- Client portal header: Optional project photo
- Empty states: Illustration placeholders
- User avatars: Circular w-10 h-10

No large hero images - this is a productivity tool focused on data and workflows rather than marketing.