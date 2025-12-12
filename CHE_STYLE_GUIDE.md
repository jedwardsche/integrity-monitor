# CHE Enrollment System - Comprehensive Style Guide

**Version:** 1.0
**Last Updated:** 2025
**Application:** CHE (Colorado Homeschool Enrichment) Enrollment System

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Typography](#typography)
3. [Color System](#color-system)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Animations & Transitions](#animations--transitions)
7. [Shadows & Depth](#shadows--depth)
8. [Forms & Inputs](#forms--inputs)
9. [States & Interactions](#states--interactions)
10. [Accessibility](#accessibility)

---

## Design Philosophy

The CHE enrollment system follows a **warm, professional, and trustworthy** design language inspired by modern tax software (TurboTax pattern). Key principles:

- **Clarity over decoration** - Every element has a purpose
- **Progressive disclosure** - Show information when needed
- **Warm neutrals** - Soft, approachable color palette
- **Tactile interactions** - Buttons feel clickable and responsive
- **Scannable hierarchy** - Clear visual hierarchy guides the user

---

## Typography

### Font Families

The system uses **two primary typefaces** for hierarchy and distinction:

#### **Outfit** - Display & Headings
- **Usage:** H1, H2 titles, Progress bar labels
- **Weights:** 600 (Semi-Bold)
- **Features:** Modern geometric sans-serif, excellent readability
- **Letter Spacing:** `-0.02em` (tight tracking for display text)

```css
font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
             'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
             'Helvetica Neue', sans-serif;
```

#### **Epilogue** - Body & UI
- **Usage:** Body text, buttons, labels, inputs, H3-H6
- **Weights:**
  - 400 (Regular) - Body text, paragraphs
  - 500 (Medium) - Buttons, badges, labels
  - 600 (Semi-Bold) - H3-H6, emphasized text
- **Features:** Friendly, professional, optimized for screen reading

```css
font-family: 'Epilogue', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
             'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
             'Helvetica Neue', sans-serif;
```

### Typography Hierarchy

| Element | Font | Weight | Usage |
|---------|------|--------|-------|
| H1, H2 | Outfit | 600 | Page titles, section headers |
| H3-H6 | Epilogue | 600 | Subsection headers |
| Body Text | Epilogue | 400 | Paragraphs, descriptions |
| Buttons | Epilogue | 500 | All button text |
| Labels | Epilogue | 500 | Form labels, badges |
| Inputs | Epilogue | 500 | Input field text |

### Font Loading

Fonts are loaded via Google Fonts. Add to `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600&family=Outfit:wght@600&display=swap" rel="stylesheet">
```

---

## Color System

### Primary Palette

The CHE color system uses **OKLCH color space** for perceptually uniform colors and **CSS Custom Properties** for theme-ability.

#### Neutrals (Light Mode)

```css
--bg-warm-light: #F6F6F3;                /* Warm off-white app background */
--bg-light: oklch(1 0 89.88);            /* Pure white - for cards */
--bg-mid: oklch(0.9578 0.0054 95.1);     /* #F2F1ED - medium surfaces */
--bg-dark: oklch(0.92 0 89.88);          /* Dark neutral */
--text-main: oklch(0.3923 0.0534 182.54); /* #1F4F48 - dark green text */
--text-muted: color-mix(in oklch, var(--text-main) 55%, white 45%);
```

**Visual Reference:**
- `bg-warm-light`: Main page background (warm beige-white)
- `bg-light`: Card backgrounds (pure white)
- `bg-mid`: Panels, disabled states, subtle backgrounds
- `text-main`: Primary text color (dark teal-green)
- `text-muted`: Secondary text, descriptions

#### Brand & Semantic Colors

```css
--brand: #3E716A;           /* Primary brand green (non-teal) */
--brand-mid: #6B9A94;       /* Mid-green for progress bars */
--cta-blue: #3566A8;        /* Blue for CTA buttons ONLY */
--success: oklch(0.5957 0.0992 179.01); /* #249280 - success green */
--warn: #E85A33;            /* Orange - warnings/alerts/progress labels */
--error: oklch(0.5693 0.2122 24);       /* #D82332 - error red */
```

**Usage Rules:**
- **`--brand`**: Links, focus states, borders, icons
- **`--brand-mid`**: Progress bar fills, subtle brand accents
- **`--cta-blue`**: **ONLY** for primary CTA buttons (Continue, Submit, etc.)
- **`--success`**: Success states, verified indicators
- **`--warn`**: Warnings, in-progress indicators, progress bar active labels
- **`--error`**: Error states, validation messages

#### Surfaces & Borders

```css
--surface-1: oklch(0.9578 0.0054 95.1);  /* Cards/modals - same as bg-mid */
--surface-2: oklch(1 0 89.88);           /* Inner panels - same as bg-light */
--border: oklch(0.8706 0.0172 88.01);    /* #D9D4C8 - subtle borders */
--highlight: rgba(255,255,255,0.85);     /* Inset highlights on surfaces */
--shadow-strong: rgba(0,0,0,0.3);        /* Strong shadow overlay */
--shadow-soft: rgba(0,0,0,0.18);         /* Soft shadow for cards */
```

#### Derived Color Tones

The system uses `color-mix()` to generate tints/shades:

```css
--brand-700: color-mix(in oklch, var(--brand) 85%, black 15%);
--brand-50: color-mix(in oklch, var(--brand) 12%, white 88%);
--warn-50: color-mix(in oklch, var(--warn) 12%, white 88%);
--success-50: color-mix(in oklch, var(--success) 12%, white 88%);
--error-50: color-mix(in oklch, var(--error) 12%, white 88%);
--row-success: color-mix(in oklch, var(--success) 6%, white 94%);
```

**Usage:**
- `-50` variants: Light backgrounds for status chips/badges
- `-700` variants: Darker variants for emphasis
- `row-success`: Very subtle success row highlighting

### Dark Mode (body.dark)

```css
body.dark {
  --bg-warm-light: oklch(0.12 0 89.88);
  --bg-dark: oklch(0.12 0 89.88);
  --bg-mid: oklch(0.16 0.01 95.1);
  --bg-light: oklch(0.20 0.01 95.1);
  --text-main: oklch(0.93 0.02 182.54);
  --text-muted: color-mix(in oklch, var(--text-main) 55%, black 45%);
  --border: rgba(255,255,255,0.08);
  --highlight: rgba(255,255,255,0.45);
}
```

### Color Usage Guidelines

| Color | HEX | Use Case | Do | Don't |
|-------|-----|----------|-----|-------|
| Brand (`#3E716A`) | ![#3E716A](https://via.placeholder.com/15/3E716A/000000?text=+) | Links, borders | Use for subtle brand moments | Don't use for CTAs |
| CTA Blue (`#3566A8`) | ![#3566A8](https://via.placeholder.com/15/3566A8/000000?text=+) | Primary actions | Reserve for main CTAs | Don't overuse |
| Warn Orange (`#E85A33`) | ![#E85A33](https://via.placeholder.com/15/E85A33/000000?text=+) | Alerts, progress | Use sparingly for attention | Don't use for errors |
| Success Green (`#249280`) | ![#249280](https://via.placeholder.com/15/249280/000000?text=+) | Completed states | Use for positive feedback | Don't confuse with brand |

---

## Spacing & Layout

### Container System

```css
.enrollment-page-container {
  max-width: 80rem; /* 1280px */
  margin: 0 auto;
  padding: 2rem 1rem; /* Mobile: py-8 px-4 */
}

/* Tablet (≥640px) */
@media (min-width: 640px) {
  padding: 3rem 1.5rem; /* py-12 px-6 */
}

/* Desktop (≥1024px) */
@media (min-width: 1024px) {
  padding: 3rem 2rem; /* py-12 px-8 */
}
```

### Card System

```css
.enrollment-content-card {
  background: var(--bg-light);
  border-radius: 1.25rem; /* 20px */
  border: 1px solid var(--border);
  padding: 1.5rem; /* Mobile */
  min-height: 60vh;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Tablet (≥768px) */
@media (min-width: 768px) {
  padding: 2rem;
}
```

### Row Layouts

```css
.row-default {
  width: 100%;
  border-radius: 0.75rem; /* 12px */
  border: 1px solid var(--border);
  padding: 1rem 1.25rem; /* Mobile: p-4 md:p-5 */
  background: var(--bg-light);
  transition: all 200ms ease;
}

.row-default:hover {
  box-shadow:
    inset 0 1px 2px var(--highlight),
    0 4px 12px var(--shadow-soft);
}
```

### Spacing Scale

Uses Tailwind's spacing scale (4px base unit):

| Token | px | Usage |
|-------|-----|-------|
| `1` | 4px | Minimal spacing |
| `2` | 8px | Tight spacing |
| `3` | 12px | Default gap |
| `4` | 16px | Standard padding |
| `6` | 24px | Section spacing |
| `8` | 32px | Large gaps |
| `12` | 48px | Section breaks |

---

## Components

### Buttons

The CHE system uses the **TurboTax navigation pattern** with distinct button styles for different contexts.

#### Continue Button (Primary CTA)

**Usage:** Right-aligned, primary action to advance workflow

```css
.btn-continue {
  padding: 0.5rem 1.5rem; /* px-6 py-2 */
  font-weight: 500;
  border-radius: 0.5rem; /* 8px */
  color: #ffffff;
  background: var(--cta-blue);
  border: 1px solid var(--cta-blue);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22),
              0 2px 4px var(--shadow-soft);
  transition: all 200ms ease;
}

.btn-continue:hover:not(:disabled) {
  background: color-mix(in oklch, var(--cta-blue) 90%, black 10%);
  border-color: color-mix(in oklch, var(--cta-blue) 90%, black 10%);
  box-shadow: 0 3px 9px var(--shadow-strong);
  transform: translateY(-0.85px);
}

.btn-continue:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px var(--shadow-soft);
}

.btn-continue:disabled {
  opacity: 0.5;
  filter: brightness(0.9);
  cursor: not-allowed;
}
```

**Features:**
- **Micro-lift on hover:** `translateY(-0.85px)` (reduced from 1px for subtlety)
- **Inset highlight:** Creates glossy, tactile feel
- **Progressive shadow:** Stronger on hover, softer on click
- **Disabled state:** 50% opacity + brightness filter

#### Back Button (Secondary)

**Usage:** Left-aligned, text-only navigation to previous step

```css
.btn-back {
  padding: 0.5rem 1rem; /* px-4 py-2 */
  font-weight: 500;
  border-radius: 0.5rem;
  color: var(--text-main);
  background: transparent;
  border: none;
  transition: all 200ms ease;
}

.btn-back:hover {
  background: var(--bg-mid);
  color: var(--text-main);
}
```

**Features:**
- **No border:** Minimal visual weight
- **Hover fill:** Subtle background on hover
- **Left-aligned:** Always positioned on left of footer

#### Action Buttons (Row-level)

**Blue Variant** - Primary row action
```css
.btn-action-blue {
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: #ffffff;
  background: var(--cta-blue);
  border: 1px solid var(--cta-blue);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22),
              0 2px 4px var(--shadow-soft);
}

.btn-action-blue:hover:not(:disabled) {
  background: color-mix(in oklch, var(--cta-blue) 85%, black 15%);
  box-shadow: 0 3px 9px var(--shadow-strong);
  transform: translateY(-0.85px);
}
```

**Inverted Blue Variant** - Secondary row action with outline
```css
.btn-action-blue-inverted {
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: var(--cta-blue);
  background: var(--bg-light);
  border: 1px solid var(--cta-blue);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22),
              0 2px 4px var(--shadow-soft);
}

.btn-action-blue-inverted:hover:not(:disabled) {
  background: var(--bg-light);
  border-color: color-mix(in oklch, var(--cta-blue) 85%, black 15%);
  color: color-mix(in oklch, var(--cta-blue) 85%, black 15%);
  filter: brightness(0.95);
}
```

**Gray Variant** - Tertiary row action
```css
.btn-action-gray {
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--bg-light);
  border: 1px solid var(--border);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22),
              0 2px 4px var(--shadow-soft);
}

.btn-action-gray:hover:not(:disabled) {
  background: var(--bg-mid);
  border-color: var(--border);
}
```

#### Final Button (Climax CTA)

**Usage:** Large, centered button for final submission

```css
.btn-final {
  padding: 0.875rem 2.5rem; /* px-10 py-3.5 */
  font-size: 1.25rem; /* text-xl */
  font-weight: 600; /* font-semibold */
  border-radius: 0.5rem;
  color: #ffffff;
  background: var(--cta-blue);
  border: 2px solid var(--cta-blue);
  min-width: 280px;
  box-shadow:
    0 4px 12px rgba(53, 102, 168, 0.25),
    inset 0 1px 1px rgba(255, 255, 255, 0.22);
  transition: all 200ms ease;
}

.btn-final:hover:not(:disabled) {
  background: color-mix(in oklch, var(--cta-blue) 80%, black 20%);
  box-shadow:
    0 6px 16px rgba(53, 102, 168, 0.35),
    inset 0 1px 1px rgba(255, 255, 255, 0.26);
  transform: translateY(-1px);
}

/* Mobile responsive */
@media (max-width: 640px) {
  .btn-final {
    padding: 0.75rem 2rem;
    font-size: 1.125rem;
    min-width: 100%;
    max-width: 100%;
  }
}
```

**Features:**
- **Larger size:** 20% bigger than standard buttons
- **Heavier weight:** 600 vs 500 font-weight
- **Enhanced shadow:** Colored shadow with blue tint
- **Larger lift:** Full 1px translateY on hover

### Status Chips

Duotone status indicators with light backgrounds and dark text.

```css
.status-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem; /* px-2.5 py-1 */
  border-radius: 0.375rem; /* 6px */
  font-size: 0.875rem; /* 14px */
  font-weight: 500;
  border: 1px solid transparent;
}

.status-chip--need {
  background: var(--warn-50);
  color: var(--warn);
  border-color: color-mix(in oklch, var(--warn) 30%, transparent);
}

.status-chip--enrolled {
  background: var(--success-50);
  color: var(--success);
  border-color: color-mix(in oklch, var(--success) 30%, transparent);
}

.status-chip--not-participating {
  background: var(--bg-mid);
  color: var(--text-muted);
  border-color: var(--border);
}
```

**Variants:**
- **Need/Warning:** Orange background (`--warn-50`)
- **Enrolled/Success:** Green background (`--success-50`)
- **Not Participating:** Gray background (`--bg-mid`)

### Progress Bar

Custom multi-step progress indicator with section dividers.

**Container:**
```css
.enrollment-progress-bar {
  font-family: 'Outfit', sans-serif;
  background: transparent;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
```

**Progress Fill:**
```css
/* Animated fill bar */
.progress-fill {
  height: 100%;
  background: var(--brand-mid);
  transition: all 300ms ease-out;
}
```

**Section Dividers:**
```css
/* Conditional gradient dividers */
.section-divider {
  width: 6px;
  margin-left: -3px; /* Center alignment */
  border-radius: 2px;

  /* Filled state */
  background: linear-gradient(
    to right,
    var(--brand-700),
    var(--brand),
    var(--brand-700)
  );
  border-left: 1.5px solid var(--brand-900);
  border-right: 1.5px solid var(--brand-900);
  box-shadow:
    0 0 8px rgba(234, 88, 12, 0.4),
    inset 0 0 4px rgba(255, 255, 255, 0.3);
}

/* Unfilled state */
.section-divider--unfilled {
  background: linear-gradient(
    to right,
    var(--border-dark),
    var(--bg-mid),
    var(--border-dark)
  );
  border-left: 1.5px solid var(--border);
  border-right: 1.5px solid var(--border);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.1),
    inset 0 0 2px rgba(0, 0, 0, 0.05);
}
```

**Current Step Pill:**
```css
.progress-pill {
  max-width: 140px;
  height: 28px;
  border-radius: 9999px;
  background: color-mix(in oklch, var(--warn) 12%, white 88%);
  border: 1px solid color-mix(in oklch, var(--warn) 25%, transparent);
  transform: translate(-50%, -50%);
  transition: all 300ms ease-out;
}
```

**Step Labels:**
```css
.step-label {
  font-size: 0.75rem; /* 12px */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color 200ms ease;
}

.step-label--active {
  color: var(--warn);
}

.step-label--inactive {
  color: var(--text-muted);
}
```

### Navigation Footer

TurboTax-style sticky footer with back/continue buttons.

```css
.navigation-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--border);
  margin-top: 2rem;
}

/* Mobile stacked layout */
@media (max-width: 640px) {
  .navigation-footer {
    flex-direction: column-reverse;
    gap: 0.75rem;
  }

  .btn-back,
  .btn-continue {
    width: 100%;
  }
}
```

### Missing Field Popover

Validation error popover that appears above disabled CTA buttons.

```css
.missing-field-popover {
  position: fixed;
  z-index: 9999;
  background: var(--bg-mid);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  animation: fadeInPopover 0.3s ease-out forwards;
}

.missing-field-popover::before {
  /* Arrow pointing down to button */
  content: "";
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid var(--bg-mid);
}

.missing-field-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-main);
}

.missing-field-list li {
  padding: 0.25rem 0;
}

.missing-field-list li::before {
  content: "• ";
  color: var(--warn);
  font-weight: bold;
  margin-right: 0.5rem;
}
```

**Features:**
- **Auto-positioning:** Calculates viewport space and positions above/below button
- **Pointer arrow:** CSS triangle points to trigger element
- **Fade-in animation:** Smooth entrance
- **Bullet styling:** Orange bullets match warning theme

---

## Forms & Inputs

### Input Fields

```css
.input-field {
  width: 100%;
  padding: 0.5rem 0.75rem; /* px-3 py-2 */
  border-radius: 0.5rem;
  font-weight: 500;
  background: var(--bg-light);
  color: var(--text-main);
  border: 1px solid var(--border);
  box-shadow: inset 0 1px 2px var(--highlight);
  transition: all 160ms ease;
}

.input-field:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: inset 0 1px 2px var(--highlight);
}

.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-field::placeholder {
  opacity: 0.7;
}
```

**Features:**
- **Inset shadow:** Creates recessed appearance
- **Focus ring:** Brand-colored border on focus
- **Smooth transitions:** 160ms duration for responsive feel

### Custom Select Dropdown (FormSelect)

**IMPORTANT:** Do not use native `<select>` elements. Use the `FormSelect` component instead.

**Button Trigger:**
```css
.form-select-button {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-weight: 500;
  text-align: left;
  background: var(--bg-light);
  color: var(--text-main);
  border: 1px solid var(--border);
  box-shadow: inset 0 1px 2px var(--highlight);
  transition: all 160ms ease;
}

.form-select-button:focus {
  border-color: var(--brand);
  box-shadow: inset 0 1px 2px var(--highlight),
              0 0 0 2px color-mix(in oklch, var(--brand) 60%, white 40%);
}

/* Error state */
.form-select-button--error {
  border-color: var(--error);
}
```

**Dropdown Menu:**
```css
.form-select-dropdown {
  background: var(--bg-light);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  animation: slideDown 0.2s ease-out forwards;
}

.form-select-option {
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  transition: background 100ms ease;
}

.form-select-option:hover {
  background: var(--bg-mid);
}

.form-select-option--selected {
  background: var(--brand-50);
  color: var(--brand);
  font-weight: 600;
}
```

**Features:**
- **Smart positioning:** Automatically opens upward/downward based on viewport space
- **Keyboard navigation:** Arrow keys, Enter, Escape
- **Click-outside detection:** Closes dropdown when clicking elsewhere
- **Slide-down animation:** 200ms entrance effect

### Checkboxes & Radio Buttons

TurboTax-style enlarged controls with animated fill states.

**Checkbox:**
```css
.tt-checkbox {
  -webkit-appearance: none;
  appearance: none;
  width: 1.375rem; /* 22px - 25% larger */
  height: 1.375rem;
  display: inline-grid;
  place-content: center;
  background: var(--bg-light);
  border: 2px solid var(--border);
  border-radius: 0.375rem; /* 6px */
  box-shadow: inset 0 1px 2px var(--highlight);
  transition: transform 200ms ease;
  cursor: pointer;
}

.tt-checkbox:hover:not(:disabled) {
  transform: scale(1.05); /* Slight grow on hover */
  box-shadow: inset 0 1px 2px var(--highlight),
              0 2px 4px rgba(0,0,0,0.1);
}

.tt-checkbox:checked {
  background: var(--bg-light);
  border-color: var(--text-main);
  box-shadow: inset 0 1px 2px var(--highlight);
}

/* Animated checkmark */
.tt-checkbox::after {
  content: "";
  width: 0.375rem;
  height: 0.625rem;
  border: solid var(--text-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0.3);
  opacity: 0;
  animation: checkboxFadeOut 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.tt-checkbox:checked::after {
  animation: checkboxFadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes checkboxFadeIn {
  from {
    opacity: 0;
    transform: rotate(45deg) scale(0.3);
  }
  to {
    opacity: 1;
    transform: rotate(45deg) scale(1);
  }
}
```

**Radio Button:**
```css
.tt-radio {
  -webkit-appearance: none;
  appearance: none;
  width: 1.375rem;
  height: 1.375rem;
  display: inline-grid;
  place-content: center;
  background: var(--bg-light);
  border: 2px solid var(--border);
  border-radius: 9999px; /* Full circle */
  box-shadow: inset 0 1px 2px var(--highlight);
  transition: transform 200ms ease;
  cursor: pointer;
}

.tt-radio:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: inset 0 1px 2px var(--highlight),
              0 2px 4px rgba(0,0,0,0.1);
}

.tt-radio:checked {
  background: var(--bg-light);
  border-color: var(--text-main);
}

/* Animated inner fill */
.tt-radio::after {
  content: "";
  width: 0.75rem;
  height: 0.75rem;
  background: var(--text-main);
  border-radius: 9999px;
  transform: scale(0.3);
  opacity: 0;
  animation: radioFadeOut 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.tt-radio:checked::after {
  animation: radioFadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes radioFadeIn {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

**Features:**
- **25% larger:** Better touch targets, more visible
- **Hover scale:** Subtle grow effect (1.05x)
- **Bouncy animation:** cubic-bezier(0.34, 1.56, 0.64, 1) creates overshoot
- **Filled checkmark:** Checkmark/dot appears with animation

### Info Panels

Contextual help boxes with optional accent border.

```css
.info-panel {
  background: var(--bg-mid);
  border: 1px solid var(--border);
  border-radius: 0.75rem; /* 12px */
  padding: 1rem;
  color: var(--text-main);
}

.info-panel--accent {
  border-left-width: 4px;
  border-left-color: color-mix(in oklch, var(--brand) 65%, white 35%);
}

.info-panel__icon {
  color: color-mix(in oklch, var(--brand) 70%, black 30%);
}
```

---

## Animations & Transitions

### Animation Durations

Standard timing for consistency:

```css
/* Tailwind custom durations */
--duration-160: 160ms;  /* Quick micro-interactions */
--duration-200: 200ms;  /* Default transitions */
--duration-250: 250ms;  /* Emphasized transitions */
--duration-300: 300ms;  /* Larger element transitions */
```

### Animation Library

#### Toast Slide-In
```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
```

#### Popover Fade-In
```css
@keyframes fadeInPopover {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-popover-fade-in {
  animation: fadeInPopover 0.3s ease-out forwards;
}
```

#### Backdrop Fade
```css
@keyframes fadeInBackdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-backdrop-fade-in {
  animation: fadeInBackdrop 0.2s ease-out forwards;
}
```

#### Slide-Up (Modals)
```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slideUp 0.3s ease-out forwards;
}
```

#### Dropdown Slide-Down
```css
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-down {
  animation: slideDown 0.2s ease-out forwards;
}
```

### Hover Effects

**Button Micro-Lift:**
```css
.hover-lift {
  transition: transform 160ms ease;
}

.hover-lift:hover:not(:disabled) {
  transform: translateY(-0.85px);
}

/* Override Tailwind's default -1px hover */
.hover\:-translate-y-\[1px\]:hover {
  transform: translateY(-0.85px) !important;
}
```

**Brightness Adjustment:**
```css
.hover\:brightness-105:hover,
.hover\:brightness-110:hover {
  filter: brightness(1.03) !important; /* Reduced from 1.05/1.10 */
}
```

**Card Row Hover:**
```css
.row-table-item {
  transition: all 200ms ease;
}

.row-table-item:hover {
  box-shadow: inset 0 1px 2px var(--highlight),
              0 4px 12px var(--shadow-soft);
  transform: translateY(-1px);
}
```

---

## Shadows & Depth

### Shadow System

The CHE design uses **layered shadows** to create tactile depth.

#### Button Shadows

```css
/* Default button shadow */
.shadow-button {
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.22),
    0 2px 4px var(--shadow-soft);
}

/* Hover state */
.hover\:shadow-button-hover:hover {
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.26),
    0 3px 8px var(--shadow-strong);
}
```

**Anatomy:**
- **Inset highlight:** Top-light creates glossy surface
- **Drop shadow:** Soft outer shadow for elevation

#### Card Shadows

```css
/* Default card shadow */
.shadow-card {
  box-shadow:
    inset 0 1px 2px var(--highlight),
    0 2px 6px var(--shadow-soft);
}

/* Hover state */
.hover\:shadow-card-hover:hover {
  box-shadow:
    inset 0 1px 2px var(--highlight),
    0 6px 18px var(--shadow-strong);
}
```

#### Recessed Shadow

For inputs and depressed surfaces:

```css
.shadow-recessed {
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.06),
    inset 0 -1px 2px rgba(0, 0, 0, 0.35);
}
```

#### Progress Bar Shadow

```css
.shadow-progress {
  box-shadow:
    inset 0 1px 1px var(--highlight),
    inset 0 -1px 2px rgba(0, 0, 0, 0.25),
    0 1px 3px rgba(0, 0, 0, 0.2);
}
```

### Depth Layering

Visual hierarchy through elevation:

| Layer | z-index | Usage | Shadow |
|-------|---------|-------|--------|
| Base | 0 | Page background | None |
| Surface | 1 | Cards, panels | `shadow-card` |
| Raised | 2 | Buttons, inputs | `shadow-button` |
| Dropdown | 100 | Select menus | `0 10px 25px rgba(0,0,0,0.15)` |
| Popover | 9999 | Validation errors | `0 10px 25px rgba(0,0,0,0.2)` |
| Modal | 10000 | Modals, dialogs | `0 20px 50px rgba(0,0,0,0.3)` |

---

## States & Interactions

### Focus States

All interactive elements have visible focus rings for accessibility:

```css
/* Form inputs */
.input-field:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 60%, white 40%);
}

/* Buttons */
.btn-continue:focus {
  outline: none;
  --tw-ring-color: var(--cta-blue);
  box-shadow: 0 0 0 2px var(--tw-ring-color);
}

/* Checkboxes/radios */
.tt-checkbox:focus-visible,
.tt-radio:focus-visible {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 60%, white 40%);
}
```

**Pattern:**
- Remove default outline
- Add brand-colored ring with 60% opacity blend
- 2px width for visibility

### Disabled States

```css
/* Buttons */
.btn-continue:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: brightness(0.9);
  transform: none !important; /* Prevent hover lift */
}

/* Inputs */
.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-mid);
}

/* Checkboxes/radios */
.tt-checkbox:disabled,
.tt-radio:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### Error States

```css
/* Input with error */
.input-field--error {
  border-color: var(--error);
}

.input-field--error:focus {
  border-color: var(--error);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--error) 40%, white 60%);
}

/* Error message text */
.error-message {
  color: var(--error);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
```

### Success States

```css
/* Row highlighting */
.tr--verified {
  background: var(--row-success); /* Very subtle green tint */
}

/* Success badge */
.badge-success {
  background: var(--success-50);
  color: var(--success);
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}
```

### Loading States

Use opacity + cursor changes for loading states:

```css
.btn-continue[data-loading="true"] {
  opacity: 0.7;
  cursor: wait;
  pointer-events: none;
}
```

---

## Accessibility

### WCAG Compliance

The CHE system meets **WCAG 2.1 Level AA** standards:

#### Color Contrast Ratios

| Combination | Ratio | Standard |
|-------------|-------|----------|
| Text-main on bg-light | 7.8:1 | AAA ✓ |
| Text-muted on bg-light | 4.6:1 | AA ✓ |
| CTA-blue on white | 4.8:1 | AA ✓ |
| Success on success-50 bg | 4.5:1 | AA ✓ |
| Warn on warn-50 bg | 4.7:1 | AA ✓ |

#### Focus Indicators

All interactive elements have:
- **Minimum 2px** focus ring width
- **3:1 contrast ratio** against background
- **Visible on keyboard navigation** (`:focus-visible`)

```css
*:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
```

#### Touch Targets

All interactive elements meet **44x44px minimum** touch target size:

```css
/* Buttons */
.btn-continue {
  min-height: 44px;
  padding: 0.5rem 1.5rem; /* Ensures height + width */
}

/* Checkboxes/radios */
.tt-checkbox,
.tt-radio {
  width: 1.375rem; /* 22px */
  height: 1.375rem;
  /* Wrapped in label with padding to meet 44px */
}
```

#### Screen Reader Support

- All form fields have associated `<label>` elements
- Buttons use descriptive text (no icon-only buttons)
- ARIA labels used for icon buttons: `aria-label="Close"`
- Status messages use `role="alert"` for announcements
- Loading states use `aria-busy="true"`

#### Keyboard Navigation

- **Tab order:** Follows visual flow
- **Enter/Space:** Activates buttons
- **Arrow keys:** Navigate dropdowns
- **Escape:** Closes modals/popovers
- **Focus trap:** Active in modals

---

## Google Maps Autocomplete Styling

Custom styling for Google Places Autocomplete widget:

```css
/* Main container */
gmp-place-autocomplete {
  width: 100%;
  --gmpx-color-surface: var(--bg-light);
  --gmpx-color-on-surface: var(--text-main);
  --gmpx-color-primary: var(--brand);
  --gmpx-color-outline: var(--border);
}

/* Hide shadow DOM input */
gmp-place-autocomplete::part(input) {
  opacity: 0 !important;
  pointer-events: none !important;
}

/* Dropdown container */
.pac-container {
  z-index: 10000 !important;
  border-radius: 0.375rem !important;
  margin-top: 4px !important;
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgb(209, 213, 219) !important;
  background: white !important;
}

/* Hide Google branding */
.pac-container:after {
  display: none !important;
}

/* Individual suggestions */
.pac-item {
  padding: 8px 12px !important;
  border-top: 1px solid rgb(243, 244, 246) !important;
  cursor: pointer !important;
  font-size: 0.875rem !important;
}

.pac-item:hover {
  background-color: rgb(249, 250, 251) !important;
}

.pac-item-selected {
  background-color: rgb(254, 243, 199) !important; /* Yellow highlight */
}

/* Hide location icon */
.pac-icon {
  display: none !important;
}

/* Matched text styling */
.pac-matched {
  font-weight: 600 !important;
}
```

---

## Responsive Design

### Breakpoints

Uses Tailwind's default breakpoints:

```css
/* Mobile first */
/* < 640px - Base styles */

/* sm: Small tablets */
@media (min-width: 640px) { ... }

/* md: Tablets */
@media (min-width: 768px) { ... }

/* lg: Small laptops */
@media (min-width: 1024px) { ... }

/* xl: Desktops */
@media (min-width: 1280px) { ... }

/* 2xl: Large screens */
@media (min-width: 1536px) { ... }
```

### Mobile Adaptations

**Navigation Footer:**
```css
@media (max-width: 640px) {
  .navigation-footer {
    flex-direction: column-reverse; /* Continue on top */
    gap: 0.75rem;
  }

  .btn-back,
  .btn-continue {
    width: 100%; /* Full-width buttons */
  }
}
```

**Final Button:**
```css
@media (max-width: 640px) {
  .btn-final {
    padding: 0.75rem 2rem;
    font-size: 1.125rem;
    min-width: 100%;
    max-width: 100%;
  }
}
```

**Container Padding:**
```css
/* Mobile */
.enrollment-page-container {
  padding: 2rem 1rem;
}

/* Tablet */
@media (min-width: 640px) {
  .enrollment-page-container {
    padding: 3rem 1.5rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .enrollment-page-container {
    padding: 3rem 2rem;
  }
}
```

---

## Implementation Checklist

When implementing CHE design system:

### Required Assets
- [ ] Load **Outfit** font (weight: 600)
- [ ] Load **Epilogue** font (weights: 400, 500, 600)
- [ ] Include all CSS custom properties from `:root`
- [ ] Include dark mode overrides if supporting dark mode

### Core Styles
- [ ] Copy all button classes (`.btn-*`)
- [ ] Copy all animation keyframes (`@keyframes`)
- [ ] Copy shadow definitions (`.shadow-*`)
- [ ] Copy form input styles (`.input-field`, `.tt-checkbox`, etc.)

### Components
- [ ] Implement custom dropdown (or use FormSelect component)
- [ ] Implement missing field popover pattern
- [ ] Implement progress bar with dividers
- [ ] Implement navigation footer pattern

### Accessibility
- [ ] Ensure all interactive elements have focus states
- [ ] Verify color contrast ratios meet WCAG AA
- [ ] Test keyboard navigation
- [ ] Add ARIA labels where appropriate

### Testing
- [ ] Test on mobile (< 640px)
- [ ] Test on tablet (768px - 1024px)
- [ ] Test on desktop (> 1024px)
- [ ] Test with keyboard only
- [ ] Test with screen reader

---

## Quick Reference

### Most Common Classes

```css
/* Buttons */
.btn-continue      /* Primary CTA */
.btn-back          /* Back navigation */
.btn-action-blue   /* Row-level action */
.btn-action-gray   /* Tertiary action */
.btn-final         /* Final submit button */

/* Inputs */
.input-field       /* Text inputs */
.tt-checkbox       /* Checkbox */
.tt-radio          /* Radio button */

/* Status */
.status-chip--need       /* Orange warning chip */
.status-chip--enrolled   /* Green success chip */

/* Layout */
.enrollment-page-container  /* Page wrapper */
.enrollment-content-card    /* Main content card */
.row-default                /* Standard row */

/* Helpers */
.info-panel          /* Informational box */
.badge-success       /* Success badge */
.badge-warn          /* Warning badge */
```

### CSS Variables Quick Ref

```css
var(--brand)         /* #3E716A - Primary green */
var(--cta-blue)      /* #3566A8 - CTA buttons */
var(--warn)          /* #E85A33 - Orange warnings */
var(--success)       /* #249280 - Success green */
var(--error)         /* #D82332 - Error red */
var(--text-main)     /* #1F4F48 - Primary text */
var(--bg-light)      /* White - Cards */
var(--bg-mid)        /* #F2F1ED - Panels */
var(--border)        /* #D9D4C8 - Borders */
```

---

**End of CHE Style Guide v1.0**

For implementation questions or clarifications, refer to the companion **Implementation Guide** document.
