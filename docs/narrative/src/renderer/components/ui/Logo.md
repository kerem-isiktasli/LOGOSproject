# Logo Component

> **Last Updated**: 2026-01-04
> **Code Location**: `src/renderer/components/ui/Logo.tsx`
> **Status**: Active

---

## Context & Purpose

### Why This Component Exists

The Logo component serves as the visual identity anchor for LOGOS, the language learning application. But unlike typical logos that are static image assets, this one is a **programmatic SVG** that embodies the application's core philosophy: language as an interconnected network of knowledge.

The logo contains two deeply meaningful visual metaphors:

1. **The Network Graph Motif**: Five nodes connected by lines represent vocabulary items linked through relationships (collocations, morphological families, semantic clusters). This directly mirrors what learners see in the NetworkGraph analytics component when exploring their vocabulary. The logo is a miniature preview of the learning experience itself.

2. **The Lambda Symbol**: The Greek letter lambda appears prominently at the center, symbolizing the intersection of linguistics (lambda is commonly used in linguistic notation for logical forms and lambda calculus underlies computational linguistics) and the formal logic that powers LOGOS's algorithms (IRT, FSRS, PMI).

**Business Need**: LOGOS competes in a market saturated with language apps that use generic book/globe/speech-bubble imagery. The network-lambda logo immediately signals: "This is different. This is about understanding language as a connected system, not just memorizing flashcards." It creates brand recognition that reflects product philosophy.

**When Used**:
- In the application's title bar and navigation sidebar
- On the splash/loading screen during application startup
- In marketing materials and documentation headers
- As the application icon (exported at appropriate sizes)
- In about/credits screens within the application

---

## The Design Philosophy: Visual Algebra

### Why SVG Over Image Asset?

The logo is implemented as inline SVG within a React component rather than an imported image file (PNG, JPG, WebP). This architectural decision enables:

1. **Dynamic Sizing**: A single component scales from 24px (small badge) to 120px (splash screen) without pixelation or multiple asset files.

2. **Gradient Control**: The indigo-to-purple background gradient and emerald node gradients are defined as SVG gradients, allowing future theming possibilities (dark mode variants, seasonal colors) without asset replacement.

3. **Perfect Sharpness**: SVG renders at native resolution on all displays, from 1080p monitors to 4K Retina screens. No blurriness, no 2x/3x asset management.

4. **Bundle Efficiency**: The SVG markup is approximately 2KB, smaller than even an optimized PNG at similar quality.

5. **Accessibility**: As a React component, the logo can accept ARIA attributes and participate in the component lifecycle.

### The Network Graph as Brand Promise

The five nodes arranged in a pentagon-like pattern (two at top, two at middle, one at bottom) with eight connecting lines form a simplified graph structure. This is intentional brand alignment:

- The **NetworkGraph** component in analytics shows actual vocabulary networks
- The **logo's network motif** previews this capability at a glance
- Users subconsciously associate the brand with "connected learning"

The nodes use an emerald gradient (from teal to green), colors associated with growth, learning, and progress. The background uses indigo-to-purple, colors associated with wisdom, depth, and intellectual endeavor.

### The Lambda as Intellectual Signature

The centered lambda symbol serves multiple symbolic purposes:

1. **Linguistic Notation**: Lambda calculus is foundational to formal semantics in linguistics
2. **Functional Programming**: Reflects the TypeScript/React functional architecture of LOGOS
3. **Greek Heritage**: Connects to the classical tradition of systematic knowledge (the "logos" concept itself is Greek)
4. **Visual Anchor**: Provides a recognizable letter form amid the abstract node pattern

---

## Microscale: Direct Relationships

### Dependencies (What This Component Needs)

**`react`**: React Framework
- Standard React import for functional component and JSX support
- Uses `React.FC` type annotation for props typing

**No External UI Dependencies**: The Logo component is a leaf node in the dependency tree. It imports nothing from the design system (`GlassCard`, `GlassButton`, etc.) because it IS part of the foundational design system layer.

**CSS-in-JS via Inline Styles**: The optional "LOGOS" text uses inline style objects for gradient text effect, avoiding external CSS dependencies.

### Dependents (What Needs This Component)

**`src/renderer/components/layout/Sidebar.tsx`**: Navigation Sidebar (Potential)
- Currently displays "LOGOS" as text in the sidebar header
- Could import Logo component for visual consistency
- The sidebar shows brand text; the Logo component provides brand symbol

**`src/renderer/components/layout/AppShell.tsx`**: Application Shell (Potential)
- May integrate Logo in title bar or header region
- Could use `showText={true}` variant for branded header

**Future Dependents**:
- Splash screen / loading screen during application boot
- About dialog showing version and credits
- Export watermarks (if LOGOS ever exports learning reports)
- Favicon generation pipeline (if automated from SVG source)

### Data Flow

```
LogoProps { size?, showText?, className? }
        |
        v
[Logo Component]
        |
        +-- sizeMap lookup --> pixelSize (number)
        |
        +-- SVG generation --> Visual output (network + lambda)
        |
        +-- Conditional text --> "LOGOS" span (if showText)
        |
        v
Visual Output: Inline-flex container with SVG logo + optional text
```

The component has no state, no side effects, and no data fetching. It is a pure transformation from props to JSX.

---

## Macroscale: System Integration

### Architectural Layer

Logo sits at the **Foundation Layer** of the LOGOS component hierarchy:

```
Layer 5: Application Shell (AppShell, routing)
Layer 4: Pages/Views (DashboardPage, SessionPage)
Layer 3: Feature Components (ProgressDashboard, SessionView)
Layer 2: Layout Components (Sidebar, Header)
Layer 1: Design System Primitives (GlassCard, GlassButton, GlassBadge)
Layer 0: Brand Assets (Logo, icons, color tokens) <-- YOU ARE HERE
```

Logo is literally at the foundation. It depends on nothing except React itself and provides the visual identity that permeates all layers above it.

### Brand Consistency Through Component Reuse

By encapsulating the logo as a component rather than an image asset, LOGOS ensures:

1. **Single Source of Truth**: One component definition, used everywhere
2. **Consistent Sizing**: The predefined size map (`sm`, `md`, `lg`, `xl`) ensures logos across the app are proportionally harmonious
3. **Easy Updates**: Changing the logo design means changing one file, not hunting down scattered image references
4. **Theme Integration**: Future dark mode or high-contrast themes can adjust logo colors programmatically

### Connection to Visual Language

The Logo's color palette intentionally echoes colors used elsewhere in LOGOS:

| Logo Element | Color | Reuse Elsewhere |
|--------------|-------|-----------------|
| Background gradient start | Indigo #6366f1 | Primary action buttons, links |
| Background gradient end | Purple #8b5cf6 | Accent highlights, mastery stage 4 |
| Node gradient start | Teal #34d399 | Success states, proficient mastery |
| Node gradient end | Emerald #10b981 | Progress indicators, green mastery |
| Lambda symbol | White #ffffff | Text on dark backgrounds |

This creates visual cohesion: the logo feels like it "belongs" to the application.

### What Breaks Without Logo

If this component failed or was removed:

1. **No Brand Visual**: Application loses its visual identity anchor
2. **Sidebar falls back to text**: Works but loses visual appeal
3. **Marketing collateral**: Would need manual logo recreation
4. **User trust**: Unbranded or broken-branded apps feel less professional

Logo is not functionally critical (the app runs without it), but it is essential for professional presentation and brand recognition.

---

## Technical Concepts (Plain English)

### Inline SVG Component

**Technical**: An SVG (Scalable Vector Graphics) element embedded directly in JSX, rendered as part of the React component tree rather than loaded as an external asset via `<img src="...">`.

**Plain English**: Instead of showing a picture file, the logo is drawn with code instructions: "draw a circle here, draw a line there, fill with this gradient." This means it can resize perfectly without becoming blurry, like how a recipe can make a cake of any size while a photograph of a cake is stuck at its original size.

**Why We Use It**: Enables dynamic sizing, gradient control, and eliminates asset management complexity.

### Linear Gradient (SVG)

**Technical**: An SVG `<linearGradient>` element that defines a color transition along a straight line, referenced by ID in fill attributes.

**Plain English**: Like a sunset where the sky gradually changes from orange to purple. In the logo, the background smoothly shifts from indigo (top-left) to purple (bottom-right), and the nodes shift from teal to emerald. This creates visual depth that a flat color cannot achieve.

**Why We Use It**: Adds visual sophistication and depth to the logo without complexity.

### Size Map Pattern

**Technical**: A TypeScript object mapping semantic size names (`'sm' | 'md' | 'lg' | 'xl'`) to numeric pixel values, providing a constrained API for size selection.

**Plain English**: Instead of letting users specify "42 pixels" (which might look awkward), the component offers four curated sizes like T-shirt sizes: small, medium, large, extra-large. This ensures logos always look intentional, never accidentally squished or stretched.

**Why We Use It**: Enforces design consistency; prevents arbitrary sizing that might clash with layout.

### Gradient Text (CSS)

**Technical**: Using `background: linear-gradient(...)` combined with `background-clip: text` and `color: transparent` to create text that appears filled with a gradient rather than a solid color.

**Plain English**: Normally, text is a single color. The gradient text trick paints the letters with a color-shifting background, then makes the actual text color invisible so only the gradient shows through. It is like using a stencil to spray-paint gradient colors in letter shapes.

**Why We Use It**: The "LOGOS" text beside the icon uses the same indigo-to-purple gradient as the logo background, creating visual harmony.

### ViewBox (SVG)

**Technical**: The `viewBox="0 0 120 120"` attribute defines a coordinate system for the SVG content, enabling resolution-independent scaling.

**Plain English**: The viewBox is like saying "pretend this canvas is 120 units by 120 units, and draw everything using those units." Then, whether the actual display is 24 pixels or 240 pixels, the drawing scales proportionally. It is like architectural blueprints that show measurements in feet, regardless of how big the paper is.

**Why We Use It**: Enables the same SVG code to render at any size (`sm` through `xl`) without redrawing.

---

## Design Decisions & Rationale

### Why Five Nodes in This Arrangement?

The node positions (two at top, two at middle-sides, one at bottom center) create a visually balanced pentagon-like shape:

```
       (40,35)       (80,35)
           \    /
            \  /
     (35,60)--X--(85,60)
              |
          (60,85)
```

**Rationale**:
1. **Symmetry**: Bilateral symmetry (left-right mirror) creates visual stability
2. **Hierarchy**: Bottom-center node is largest (radius 10 vs 6-8), suggesting a "root" or "foundation" concept
3. **Connectivity**: Eight edges create dense but readable network impression
4. **Negative Space**: Enough gaps between nodes for the lambda to sit centered without collision

### Why Lambda Positioned at Center-Bottom?

The lambda sits at y=72 (in a 120-unit viewBox), placing it in the lower-center area:

**Rationale**:
1. **Visual Weight**: Lambda balances the network nodes clustered above
2. **Readability**: Text benefits from uncluttered surrounding space
3. **Metaphor**: Lambda "supports" the network above, like logic supporting language

### Why These Specific Gradient Colors?

**Background (Indigo to Purple)**:
- Indigo (#6366f1) and Purple (#8b5cf6) are adjacent on the color wheel, creating smooth transition
- These colors convey intellect, creativity, and depth
- They match LOGOS's primary brand palette used in buttons and links

**Nodes (Teal to Emerald)**:
- Green family colors suggest growth, learning, and progress
- High contrast against purple/indigo background ensures nodes "pop"
- Match the success/mastery colors used in the mastery visualization system

### Why Semi-Transparent White Edges?

Network connections use `strokeOpacity="0.4"`:

**Rationale**:
1. **Subtlety**: Edges should suggest connection without overwhelming nodes
2. **Depth**: Partial transparency creates layered, sophisticated look
3. **Focus**: User attention goes to nodes (colored) not edges (faded)

### Why Configurable Text Display?

The `showText` prop defaults to `false`:

**Rationale**:
- In sidebar header, space may be limited; icon-only is appropriate
- In splash screen or marketing, icon + "LOGOS" text provides full brand presentation
- Flexibility accommodates different usage contexts without separate components

---

## Component Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Predefined size selection |
| `showText` | `boolean` | `false` | Whether to display "LOGOS" text beside icon |
| `className` | `string` | `''` | Additional CSS classes for the container |

### Size Map Values

| Size | Pixel Value | Typical Use Case |
|------|-------------|------------------|
| `sm` | 24px | Inline badges, compact headers |
| `md` | 40px | Default; navigation headers, cards |
| `lg` | 64px | About dialogs, section headers |
| `xl` | 120px | Splash screens, marketing materials |

---

## Accessibility Considerations

### Current State

The SVG does not include ARIA attributes or `<title>`/`<desc>` elements. For decorative use (alongside "LOGOS" text), this is acceptable.

### Recommended Enhancements

For standalone logo usage (without text), consider adding:

```jsx
<svg role="img" aria-label="LOGOS logo">
  <title>LOGOS</title>
  <desc>Network graph with lambda symbol representing language learning</desc>
  ...
</svg>
```

This would make the logo accessible to screen readers when used as the sole brand indicator.

---

## Connection to Larger LOGOS Vision

### The Logo as Microcosm

The Logo component is a visual distillation of LOGOS's entire philosophy:

| Logo Element | LOGOS Feature | Shared Meaning |
|--------------|---------------|----------------|
| Network nodes | NetworkGraph analytics | Vocabulary as connected knowledge |
| Node connections | PMI relationships | Statistical co-occurrence made visible |
| Lambda symbol | IRT/FSRS algorithms | Mathematical models behind learning |
| Gradient depth | Mastery progression | Growth from novice (subtle) to mastery (vivid) |
| Emerald nodes | Mastery colors | Green = growth, proficiency |
| Purple background | Primary brand | Intellectual depth, wisdom |

When users see the logo, they are seeing a symbolic representation of what they will experience: exploring connected vocabulary through mathematically-driven, visually-rich learning.

---

## Change History

### 2026-01-04 - Initial Implementation
- **What Changed**: Created Logo component with SVG-based rendering, network graph motif, lambda symbol, gradient styling, configurable sizes, and optional text display
- **Why**: LOGOS needed a distinctive visual identity that reflects its core philosophy of networked language learning and algorithmic foundations
- **Impact**: Provides consistent brand asset across application; enables size-flexible logo usage; establishes visual language that echoes throughout the UI

---

## Future Enhancements

### Planned
- **Animated Variant**: Subtle node pulse or connection shimmer for loading states
- **Dark Mode Variant**: Adjusted gradients optimized for dark backgrounds
- **Favicon Export**: Automated pipeline to generate .ico/.png favicons from SVG source

### Potential
- **Interactive Version**: Click/hover effects for marketing landing pages
- **Seasonal Themes**: Holiday or milestone-based color variations
- **Accessibility Attributes**: Full ARIA labeling for standalone usage

---

*This documentation mirrors: `src/renderer/components/ui/Logo.tsx`*
*Shadow Map methodology: Narrative explanation of intent, not code description*
