# Design System Strategy: The Sovereign Ledger

## 1. Overview & Creative North Star
The visual identity of this platform is defined by the **"Sovereign Ledger"**—a creative North Star that blends the authoritative weight of high-end investigative journalism with the ethereal transparency of modern glassmorphism. 

We are moving away from the "standard dashboard" aesthetic. Instead, we treat political data as a premium editorial experience. By utilizing intentional asymmetry, expansive negative space, and a sophisticated layering of surfaces, we create an environment where transparency isn't just a function, but a visual feeling. Every element must feel curated, stable, and deeply intentional.

## 2. Color & Surface Philosophy
The palette is grounded in a sophisticated, authoritative blue, contrasted against a high-clarity neutral base. This evokes a sense of trust, depth, and civic duty.

### The "No-Line" Rule
To achieve a premium editorial feel, **1px solid borders are strictly prohibited for sectioning.** Physical boundaries must be defined through tonal shifts. 
- Use `surface-container-low` (#1D2A35) as a background for sections that sit atop the primary `surface` (#14191E).
- Content groupings are defined by whitespace and background shifts, not strokes.

### Surface Hierarchy & Nesting
Think of the UI as a series of stacked sheets of fine, heavy-stock paper.
- **Level 0 (Base):** `surface` (#14191E) - The global canvas.
- **Level 1 (Section):** `surface-container-low` (#1D2A35) - For grouping related data modules.
- **Level 2 (Active Element):** `surface-container-lowest` (#0A0D11) - Reserved for interactive cards or primary content pieces to provide a "lifted" feel.

### Glassmorphism & Signature Textures
For floating navigation bars, modal overlays, or sticky headers, apply the **Signature Glass** treatment: 
- `background: rgba(10, 13, 17, 0.95)`
- `backdrop-filter: blur(10px)`
- This creates "breathable" depth, allowing the rich data below to peek through while maintaining focus.

### Political Party Utility
Party colors must be used as **accents only** (status indicators, small iconography, or subtle 4px vertical "ledger lines" on the left of cards). Never use these as full-bleed backgrounds for text-heavy areas.
- **TDP:** #fce903 | **YSRCP:** #00249c | **JSP:** #e63946 | **BJP:** #f97316 | **INC:** #0ea5e9

## 3. Typography: Editorial Authority
The interplay between a classic serif and a geometric sans-serif is the cornerstone of the brand’s "Trust but Verify" personality.

- **Display & Headlines (Newsreader):** Use for hero messaging, candidate names, and major statistics. The high-contrast serif evokes the prestige of a broadsheet newspaper.
- **Body & UI (Plus Jakarta Sans):** Use for all functional text, data labels, and descriptive paragraphs. Its geometric clarity ensures legibility at small scales.

| Token | Family | Size | Intent |
| :--- | :--- | :--- | :--- |
| `display-lg` | Newsreader | 3.5rem | High-impact hero stats |
| `headline-md` | Newsreader | 1.75rem | Section headers / Candidate Names |
| `title-md` | Plus Jakarta Sans | 1.125rem | Sub-headers / Card titles |
| `body-md` | Plus Jakarta Sans | 0.875rem | Primary reading text |
| `label-sm` | Plus Jakarta Sans | 0.6875rem | Micro-data / Metadata |

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering**, not structural shadows.

- **The Layering Principle:** To "elevate" a card, place a `surface-container-lowest` (#0A0D11) object on a `surface-container-low` (#1D2A35) background. The contrast is the elevation.
- **Ambient Shadows:** Only for floating elements (modals/popovers). Use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(25, 28, 27, 0.04)`.
- **The "Ghost Border":** If accessibility requires a container edge, use the `outline-variant` token (#626C78) at **15% opacity**. It should be felt, not seen.

## 5. Components & Interaction

### Buttons
- **Primary:** `primary` (#355872) background with `on-primary` text. Use `rounded-xl` (1.5rem) as the updated `roundedness` is 3 (maximum, pill-shaped).
- **Secondary:** `surface-container-high` (#2B3A48) background. No border.
- **Micro-animation:** On hover, buttons should subtly scale by 2% (`scale-102`) and shift background color by one tier (e.g., from `primary` to `primary_container`).

### Cards (The "Ledger" Card)
- **Constraint:** No borders, no heavy shadows.
- **Structure:** Use `spacing-5` (1.7rem) for internal padding.
- **Visual Marker:** A vertical 4px bar on the left edge using the party-specific color or `primary` blue to denote category.

### Input Fields
- Avoid boxed inputs. Use a "Minimal Ledger" style: a `surface-container-low` background with `rounded-sm` (0.25rem) corner and a subtle 1px bottom stroke using `outline-variant`.
- Focus state: Transition the bottom stroke to `primary` (#355872) with a soft 4px outer glow.

### Candidate Profiles (Special Component)
- Utilize **Asymmetric Grids**. Place the candidate image (rounded-xl) slightly off-center, overlapping a `primary-container` colored decorative element. This breaks the "template" feel and creates a custom, editorial portrait look.

## 6. Do's and Don'ts

### Do:
- **Use Large Spacing:** Use `spacing-10` (3.5rem) or `spacing-16` (5.5rem) between major sections to let the data breathe.
- **Intentional Asymmetry:** Align text-heavy columns to the left while keeping high-impact stats or images slightly offset to the right.
- **Subtle Motion:** Use `ease-in-out` transitions (200ms) for all hover states and page entries.

### Don't:
- **Don't use 100% Black:** Always use `on-surface` (#DCE4EC) for text to maintain a softer, premium contrast.
- **Don't use Standard Shadows:** Avoid the default "CSS drop shadow" look; if it looks like a shadow, it’s too dark.
- **Don't use Dividers:** Do not use `hr` tags or divider lines to separate list items. Use `spacing-3` (1rem) and subtle `surface-variant` background shifts instead.

---
*Director's Note: Every pixel must serve the truth. If a design element feels like "decoration" rather than "clarification," remove it.*