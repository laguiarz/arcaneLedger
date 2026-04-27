---
name: Arcane Ledger
colors:
  surface: '#16130e'
  surface-dim: '#16130e'
  surface-bright: '#3d3933'
  surface-container-lowest: '#110e09'
  surface-container-low: '#1e1b16'
  surface-container: '#231f1a'
  surface-container-high: '#2d2924'
  surface-container-highest: '#38342e'
  on-surface: '#e9e1d8'
  on-surface-variant: '#d1c5b4'
  inverse-surface: '#e9e1d8'
  inverse-on-surface: '#34302a'
  outline: '#9a8f80'
  outline-variant: '#4e4639'
  surface-tint: '#e9c176'
  primary: '#e9c176'
  on-primary: '#412d00'
  primary-container: '#c5a059'
  on-primary-container: '#4e3700'
  inverse-primary: '#775a19'
  secondary: '#bac6ec'
  on-secondary: '#23304e'
  secondary-container: '#3a4666'
  on-secondary-container: '#a8b4da'
  tertiary: '#b0c6f9'
  on-tertiary: '#173059'
  tertiary-container: '#8fa5d6'
  on-tertiary-container: '#233a65'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdea5'
  primary-fixed-dim: '#e9c176'
  on-primary-fixed: '#261900'
  on-primary-fixed-variant: '#5d4201'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#bac6ec'
  on-secondary-fixed: '#0d1a38'
  on-secondary-fixed-variant: '#3a4666'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#b0c6f9'
  on-tertiary-fixed: '#001a41'
  on-tertiary-fixed-variant: '#304671'
  background: '#16130e'
  on-background: '#e9e1d8'
  surface-variant: '#38342e'
typography:
  display-lg:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  title-sm:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  container-padding: 32px
---

## Brand & Style

The design system is engineered for the modern digital wizard, blending the scholarly weight of a medieval grimoire with the mechanical precision of Victorian engineering. The aesthetic is "Mystic Steampunk"—a high-end, tactile experience that feels like a bespoke magical instrument.

The visual style leans heavily into **Skeuomorphic and Tactile** movements, utilizing physical metaphors such as weathered leather, cold stone, and etched brass. This is not a "flat" interface; it is a layered artifact. The emotional response should be one of quiet power and intellectual discovery, avoiding the neon "cyber" tropes in favor of warm metallic glows and deep, atmospheric shadows.

## Colors

The palette is anchored by the tension between cold, dark depths and warm, aged metallics. 

- **Primary (Aged Gold/Brass):** Used for interactive elements, highlights, and decorative filigree. It represents the "mechanical" side of the steampunk influence.
- **Secondary (Mystical Indigo):** A deep, saturated hue used for magical status effects, active states, and subtle glowing gradients. This provides the "arcane" contrast to the brass.
- **Surface (Leather/Stone):** A near-black, textured neutral that provides the canvas for the ledger.
- **Background:** A smooth, continuous gradient from deep charcoal to midnight blue. Avoid any visible banding or grid patterns; the background should feel like a vast, ink-filled void.

## Typography

This design system utilizes a dual-font strategy to balance thematic immersion with functional clarity.

- **Headlines (Newsreader):** This serif font provides the "literary" feel of a spellbook. Use it for titles, section headers, and flavor text. The use of italics for subheaders evokes handwritten annotations.
- **UI Elements (Manrope):** A clean, modern sans-serif ensures that complex data—such as spell slots, modifiers, and inventory counts—remains legible at a glance.
- **Contrast:** Headlines should often be rendered in the Primary Brass color or a high-contrast off-white, while UI labels should use the Secondary Indigo or muted greys.

## Layout & Spacing

This design system rejects rigid grids and tiles in favor of a **fluid, contextual layout**. Elements should feel "placed" rather than "slotted."

- **Layout Model:** Use a center-focused layout with generous margins. Content groups are defined by their surface containers (cards) rather than a background grid.
- **Rhythm:** Use an 8px base unit for most spacing, but allow for "loose" vertical rhythm (24px or 40px) between sections to create a sense of breath and importance, similar to the margins of an expensive book.
- **Alignment:** While the internal content of a card may be systematic, the cards themselves should have varied heights to avoid a tiled look.

## Elevation & Depth

Hierarchy is established through **Tonal Layering and Metallic Accents** rather than traditional drop shadows.

- **Surfaces:** Use a subtle inner-shadow on cards to make them appear inset into the leather background, or a very soft, indigo-tinted outer glow to make them appear "hovering" with magical energy.
- **Metallic Borders:** High-importance elements (like a "Cast Spell" button) should feature a 1px solid brass border with a linear gradient to simulate light reflecting off a metal edge.
- **Depth of Field:** Background elements should have a slight blur when modals are active, enhancing the "mystical" atmosphere.

## Shapes

The shape language is **Soft and Structural**. 

- **Corner Radius:** Avoid perfectly sharp edges. A subtle 4px (Soft) radius suggests hand-carved stone or worked leather.
- **Decorative Elements:** Use "notched" corners or brass-capped ends for progress bars and dividers to reinforce the steampunk machinery theme.
- **Interactive States:** Buttons should transition from a flat brass outline to a filled brass state with a soft indigo glow upon interaction.

## Components

- **Buttons:** Primary buttons are solid brass with dark text. Secondary buttons are "Ghost" style with a 1px brass border and an indigo glow on hover.
- **Cards (Spell Containers):** Dark leather surfaces (#1A1A1A) with a very subtle noise texture. Use a top-border of etched brass (2px) to denote rarity or spell level.
- **Input Fields:** Inset fields that look carved into the surface. Use the Primary Gold for the cursor and the active border.
- **Chips/Tags:** Use small, pill-shaped elements with a Secondary Indigo background and Primary Gold text for "Schools of Magic" or "Components."
- **Progress Bars (Mana/Health):** Use a custom "vial" or "gauge" style. The fill should be a gradient of Indigo (#2E3A59) with a bright highlight to simulate liquid.
- **Modals:** Overlays should use a heavy backdrop blur (20px) to maintain the "magical" atmosphere without losing focus on the task.