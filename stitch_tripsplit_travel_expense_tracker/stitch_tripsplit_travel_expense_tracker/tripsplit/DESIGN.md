---
name: TripSplit
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4850'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#00685d'
  on-tertiary: '#ffffff'
  tertiary-container: '#008376'
  on-tertiary-container: '#f4fffb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#71f8e4'
  tertiary-fixed-dim: '#4fdbc8'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005048'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.025em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-numeric-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.02em
  label-numeric-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
---

## Brand & Style

This design system establishes an airy, reliable, and approachable visual language for group travel expense tracking and settlement. Positioned at the intersection of travel anticipation and fintech utility, the UI removes the awkwardness and friction of post-trip money sharing through lucid organization and refreshing clarity.

### Aesthetics & Tone
- **Movement:** Modern Fintech-Travel Hybrid — combining clean functional utility with the optimism of exploration.
- **Atmosphere:** Sunlit, airy, and structured. Surfaces feel lightweight like digital tickets, with subtle teal-sky gradient washes and well-balanced negative space.
- **Personality:** Warm, transparent, and effortlessly organized. No bureaucratic financial clutter; instead, intuitive breakdown cards, immediate feedback, and clear participant ledgers.
- **Target Audience:** Digital-native travelers, university peers, and collaborative groups managing shared itineraries and split bills across multi-day trips.

## Colors

The palette leverages crisp sea-and-sky hues underpinned by solid dark slate typography to deliver both emotional lightness and sharp financial legibility.

### Palette Architecture
- **Primary (`#0284C7` - Sky Blue 600):** Anchors main actions, selected trip navigation, active tabs, and forward progress indicators.
- **Secondary (`#0D9488` - Teal 600):** Governs financial resolution states, successful settlement milestones, and positive balance credits.
- **Tertiary (`#14B8A6` - Mint Teal 500):** Accents badges, live tags, trip status flags, and contextual calculation highlights.
- **Neutral Primary (`#0F172A` - Slate 900):** Dedicated to high-contrast figures, total amounts (₩), and critical headings.
- **Neutral Secondary (`#334155` - Slate 700):** Subtitles, meta-information, and secondary participant records.
- **Neutral Muted (`#64748B` - Slate 500):** Placeholder captions, timestamp indicators, and helper text.
- **Canvas & Surfaces:**
  - Base Background: `#F8FAFC` (Slate 50) with subtle ambient undertones of `#F0FDFA` (Mint 50) on summary panels.
  - Surface Card: Pure White (`#FFFFFF`).
  - Subtle Borders: `#E2E8F0` (Slate 200) and `#F1F5F9` (Slate 100).
- **Functional Semantics:**
  - Unsettled / Debt Alert: `#F43F5E` (Rose 500)
  - Balanced / Fully Settled: `#10B981` (Emerald 500)
  - Pending Calculation: `#F59E0B` (Amber 500)

## Typography

Typography prioritizes high-legibility Korean reading habits while ensuring numeric clarity for currencies.

### Implementation Guidelines
- **Primary Engine:** Use `Inter` paired directly with system `Pretendard` or `Apple SD Gothic Neo` in CSS stacks for Korean character glyphs (`font-family: 'Inter', 'Pretendard', -apple-system, sans-serif`).
- **Tabular Numerals:** For currency values, totals, and settlement equations, apply `font-feature-settings: "tnum" 1` to ensure vertical alignment of digits across lists.
- **Hierarchy Rules:** 
  - Monetary values must use bold weights (`font-weight: 600` or `700`) paired with secondary labels in Slate 500 for the currency affix (`원`).
  - Mobile scales down major titles by 4px-10px to accommodate narrower viewports while maintaining compact multi-column splits.

## Layout & Spacing

A responsive fluid grid optimized for focused single-column mobile views and multi-pane desktop trip dashboards.

### Grid & Canvas Structure
- **Mobile (< 640px):** Single-column layout. Margin set to `1rem` (`16px`), gutter set to `1rem`. Floating Action Bar fixed to the bottom viewport.
- **Tablet (640px - 1024px):** 8-column layout. Margin set to `1.5rem` (`24px`).
- **Desktop (≥ 1024px):** Max container width bounded at `1120px` to maintain an intimate dashboard feel. Divided into a 12-column grid or an asymmetrical 4:8 split (Left: Trip Overview & Members, Right: Expense Feed & Settlement Ledger).
- **Rhythm:** Internal card paddings follow `1.25rem` (`20px`) for mobile and `1.5rem` (`24px`) for desktop. Item row gaps within expense listings maintain a dense `0.5rem` to `0.75rem` gap to support continuous scannability.

## Elevation & Depth

Visual hierarchy is built with clean surface containment rather than heavy drop shadows, reinforcing a light, breezy UI.

### Layering Rules
- **Base Canvas (Level 0):** `#F8FAFC` background. Completely flat.
- **Standard Card (Level 1):** Solid white (`#FFFFFF`) surface combined with a crisp 1px border (`#E2E8F0`) and an ambient, low-contrast shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Interactive / Hover Card (Level 2):** Subtle elevation increase with `0 6px 16px -2px rgba(2, 132, 199, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` and border shift to `#CBD5E1`.
- **Modals & Settlement Bottom-Sheets (Level 3):** Frosted ambient backdrop blur (`backdrop-filter: blur(12px)`) with pure white surface, bounded by `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`.
- **Floating Calculations Summary:** Top or bottom sticky summaries feature a translucent glass skin: `rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(8px)` and a top/bottom 1px boundary line in `#E2E8F0`.

## Shapes

The design uses generous, friendly curvature to communicate optimism and casual ease, while maintaining crisp geometric clarity in smaller interactive elements.

### Curvature Tokens
- **Cards & Summary Panels:** Use `rounded-2xl` (16px) or `rounded-3xl` (24px) for expansive hero cards and bottom sheets.
- **Buttons & Input Fields:** Use `rounded-xl` (12px) to provide a soft, tactile, touch-friendly presence.
- **Pills, Badges & Avatars:** Use full rounding (`rounded-full`) for participant avatars, settlement tags, and status chips.

## Components

### Buttons
- **Primary Action (지출 추가 / 정산하기):** Background `#0284C7`, text `#FFFFFF`, font weight 600, border radius `12px`, padding `12px 20px`. Hover state shifts to `#0369A1` with an inner subtle glow.
- **Secondary Action (영수증 업로드):** Background `#F0FDFA`, text `#0D9488`, border `1px solid #CCFBF1`. Hover transitions to `#CCFBF1`.
- **Ghost Action:** Background transparent, text `#64748B`, hover text `#0F172A`, hover background `#F1F5F9`.

### Chips & Badges
- **Trip Status Chip (여행 중 / 정산 완료):** Fully rounded (`rounded-full`), padding `4px 10px`. 
  - *Active Trip:* Pale sky tint (`bg-sky-50 text-sky-700 border border-sky-200`).
  - *Settled:* Mint teal tint (`bg-teal-50 text-teal-700 border border-teal-200`).
- **Category Badges (식비, 숙소, 교통, 액티비티):** Compact icon-text pairings with soft pastel fills, using 12px font and 6px gap.

### Expense List Item
- **Layout:** Horizontal split within a white card. Left side holds the category icon in a soft rounded squircle (`bg-slate-100 p-2.5 rounded-xl`) followed by the title and payer tag ("민수 결제"). Right side displays the bold tabular amount (`₩48,000`) and individual split portion (`인당 ₩12,000` in Slate 500).
- **Divider:** Subtle `border-b border-slate-100` between stacked items, removing borders on the final item.

### Input Fields & Controls
- **Inputs (금액, 항목명):** Height `48px`, background `#FFFFFF`, border `1.5px solid #E2E8F0`, border radius `12px`, padding `0 16px`. Active focus state features an explicit sky-blue ring (`outline: none; border-color: #0284C7; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15)`).
- **Amount Input Highlight:** Massive center-aligned or right-aligned input for rapid Korean won input with fixed trailing "원" unit.

### Checkboxes & Split Toggles
- **Participant Selector:** Individual toggle pills displaying participant avatar and name. Selected state: `bg-sky-50 border-sky-500 text-sky-900`. Unselected state: `bg-slate-50 border-slate-200 text-slate-400 opacity-60`.

### Settlement Calculation Card ("N빵 최적화 카드")
- Dedicated spotlight card with soft teal-to-sky gradient border or background wash (`bg-gradient-to-br from-sky-50/50 to-teal-50/50`).
- Contains a directed flow arrow indicator: `[보내는 사람] → [받는 사람] : ₩XX,XXX` with a high-contrast copy button for instant bank transfer account copying.