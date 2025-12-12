# CHE Design System - Implementation Guide

**Version:** 1.0
**Target Audience:** External developers integrating CHE design into other systems
**Companion Document:** CHE_STYLE_GUIDE.md

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Setup & Installation](#setup--installation)
3. [Core CSS Integration](#core-css-integration)
4. [Component Implementation](#component-implementation)
5. [Dynamic Styling Patterns](#dynamic-styling-patterns)
6. [Framework Integration](#framework-integration)
7. [Testing & Validation](#testing--validation)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 5-Minute Integration

**Step 1:** Add fonts to your HTML `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600&family=Outfit:wght@600&display=swap" rel="stylesheet">
```

**Step 2:** Copy the CSS custom properties to your root stylesheet:

```css
@import url('che-variables.css');  /* See CSS Variables section */
```

**Step 3:** Use the pre-built classes:

```html
<!-- Primary CTA Button -->
<button class="btn-continue">Continue</button>

<!-- Text Input -->
<input type="text" class="input-field" placeholder="Enter value">

<!-- Status Chip -->
<span class="status-chip status-chip--enrolled">Enrolled</span>
```

---

## Setup & Installation

### File Structure

Create the following structure in your project:

```
your-project/
├── assets/
│   └── styles/
│       ├── che-variables.css      # CSS custom properties
│       ├── che-base.css           # Base styles & resets
│       ├── che-typography.css     # Font definitions
│       ├── che-components.css     # Component styles
│       ├── che-animations.css     # Keyframe animations
│       └── che-utilities.css      # Helper classes
└── index.html                     # Your main HTML
```

### Installation Methods

#### Method 1: Direct CSS Import (Recommended for static sites)

Create individual CSS files and import them in order:

```css
/* In your main.css */
@import url('./assets/styles/che-variables.css');
@import url('./assets/styles/che-base.css');
@import url('./assets/styles/che-typography.css');
@import url('./assets/styles/che-animations.css');
@import url('./assets/styles/che-components.css');
@import url('./assets/styles/che-utilities.css');
```

#### Method 2: Single Concatenated File

Combine all CHE CSS into one file:

```bash
# Using command line (Unix/Mac)
cat che-variables.css che-base.css che-typography.css \
    che-animations.css che-components.css che-utilities.css \
    > che-design-system.css
```

Then import:

```html
<link rel="stylesheet" href="./assets/styles/che-design-system.css">
```

#### Method 3: Framework Integration (React, Vue, etc.)

For modern frameworks with CSS-in-JS or module support:

```javascript
// In your main app file
import './assets/styles/che-design-system.css';

// Or if using CSS modules
import styles from './assets/styles/che-components.module.css';
```

---

## Core CSS Integration

### 1. CSS Custom Properties (che-variables.css)

**File: `che-variables.css`**

This file contains all color tokens, spacing, and theme variables.

```css
/* CHE Design System - CSS Variables */
:root {
  /* === NEUTRALS (LIGHT MODE) === */
  --bg-warm-light: #F6F6F3;
  --bg-light: oklch(1 0 89.88);
  --bg-mid: oklch(0.9578 0.0054 95.1);
  --bg-dark: oklch(0.92 0 89.88);
  --text-main: oklch(0.3923 0.0534 182.54);
  --text-muted: color-mix(in oklch, var(--text-main) 55%, white 45%);

  /* === BRAND & SEMANTIC COLORS === */
  --brand: #3E716A;
  --brand-mid: #6B9A94;
  --cta-blue: #3566A8;
  --success: oklch(0.5957 0.0992 179.01);
  --warn: #E85A33;
  --error: oklch(0.5693 0.2122 24);

  /* === SURFACES & BORDERS === */
  --surface-1: oklch(0.9578 0.0054 95.1);
  --surface-2: oklch(1 0 89.88);
  --border: oklch(0.8706 0.0172 88.01);
  --highlight: rgba(255,255,255,0.85);
  --shadow-strong: rgba(0,0,0,0.3);
  --shadow-soft: rgba(0,0,0,0.18);

  /* === DERIVED TONES === */
  --brand-700: color-mix(in oklch, var(--brand) 85%, black 15%);
  --brand-900: color-mix(in oklch, var(--brand) 70%, black 30%);
  --brand-50: color-mix(in oklch, var(--brand) 12%, white 88%);
  --warn-50: color-mix(in oklch, var(--warn) 12%, white 88%);
  --success-50: color-mix(in oklch, var(--success) 12%, white 88%);
  --error-50: color-mix(in oklch, var(--error) 12%, white 88%);
  --row-success: color-mix(in oklch, var(--success) 6%, white 94%);
  --border-dark: color-mix(in oklch, var(--border) 70%, black 30%);
}

/* === DARK MODE OVERRIDES === */
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

**Browser Compatibility Note:**

The `color-mix()` function requires modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+). For older browser support, use fallback solid colors:

```css
/* Legacy fallback */
:root {
  --brand-50: #E8F0EF; /* Fallback for color-mix() */
}

/* Modern browsers with support */
@supports (color: color-mix(in oklch, white, black)) {
  :root {
    --brand-50: color-mix(in oklch, var(--brand) 12%, white 88%);
  }
}
```

---

### 2. Base Styles (che-base.css)

**File: `che-base.css`**

Sets up the foundational page styles.

```css
/* CHE Design System - Base Styles */

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background: var(--bg-warm-light);
  color: var(--text-main);
  font-family: 'Epilogue', -apple-system, BlinkMacSystemFont, 'Segoe UI',
               'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans',
               'Droid Sans', 'Helvetica Neue', sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

/* Remove default margins */
h1, h2, h3, h4, h5, h6, p, ul, ol {
  margin: 0;
}

/* Remove default list styles */
ul, ol {
  padding: 0;
  list-style: none;
}

/* Button reset */
button {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

/* Input reset */
input, textarea, select {
  margin: 0;
  font: inherit;
  color: inherit;
}

/* Link reset */
a {
  color: inherit;
  text-decoration: none;
}
```

---

### 3. Typography (che-typography.css)

**File: `che-typography.css`**

```css
/* CHE Design System - Typography */

/* === HEADINGS === */
h1, h2 {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI',
               'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans',
               'Droid Sans', 'Helvetica Neue', sans-serif;
  font-weight: 600;
  color: var(--text-main);
  letter-spacing: -0.02em;
}

h3, h4, h5, h6 {
  font-family: 'Epilogue', -apple-system, BlinkMacSystemFont, 'Segoe UI',
               'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans',
               'Droid Sans', 'Helvetica Neue', sans-serif;
  font-weight: 600;
  color: var(--text-main);
}

/* === BODY TEXT === */
p, span, div, li, td, th, label, input, textarea, select, button {
  font-family: 'Epilogue', -apple-system, BlinkMacSystemFont, 'Segoe UI',
               'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans',
               'Droid Sans', 'Helvetica Neue', sans-serif;
}

/* === FONT WEIGHTS === */
.font-regular { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }

/* === BUTTON TEXT === */
button,
.btn-continue,
.btn-back,
.btn-action-blue,
.btn-action-gray,
.btn-final {
  font-weight: 500;
}

/* === BADGE & LABEL TEXT === */
.status-chip,
label,
.text-sm.font-medium {
  font-weight: 500;
}
```

---

### 4. Animations (che-animations.css)

**File: `che-animations.css`**

```css
/* CHE Design System - Animations */

/* === TOAST SLIDE-IN === */
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

/* === POPOVER FADE-IN === */
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

/* === BACKDROP FADE === */
@keyframes fadeInBackdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-backdrop-fade-in {
  animation: fadeInBackdrop 0.2s ease-out forwards;
}

/* === SLIDE-UP (MODALS) === */
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

/* === DROPDOWN SLIDE-DOWN === */
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

/* === CHECKBOX ANIMATIONS === */
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

@keyframes checkboxFadeOut {
  from {
    opacity: 1;
    transform: rotate(45deg) scale(1);
  }
  to {
    opacity: 0;
    transform: rotate(45deg) scale(0.3);
  }
}

/* === RADIO ANIMATIONS === */
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

@keyframes radioFadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.3);
  }
}
```

---

### 5. Components (che-components.css)

**File: `che-components.css`**

This is a large file containing all component styles. Here's the complete implementation:

```css
/* CHE Design System - Components */

/* ==================== BUTTONS ==================== */

/* Continue Button - Primary CTA */
.btn-continue {
  padding: 0.5rem 1.5rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: #ffffff;
  background: var(--cta-blue);
  border: 1px solid var(--cta-blue);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22), 0 2px 4px var(--shadow-soft);
  transition: all 200ms ease;
  cursor: pointer;
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

.btn-continue:focus {
  outline: none;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22),
              0 2px 4px var(--shadow-soft),
              0 0 0 2px var(--cta-blue);
}

.btn-continue:disabled {
  opacity: 0.5;
  filter: brightness(0.9);
  cursor: not-allowed;
  transform: none !important;
}

/* Back Button - Secondary Navigation */
.btn-back {
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: var(--text-main);
  background: transparent;
  border: none;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-back:hover {
  background: var(--bg-mid);
  color: var(--text-main);
}

.btn-back:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--brand);
}

/* Action Button - Blue Variant */
.btn-action-blue {
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: #ffffff;
  background: var(--cta-blue);
  border: 1px solid var(--cta-blue);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22), 0 2px 4px var(--shadow-soft);
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-action-blue:hover:not(:disabled) {
  background: color-mix(in oklch, var(--cta-blue) 85%, black 15%);
  border-color: color-mix(in oklch, var(--cta-blue) 85%, black 15%);
  box-shadow: 0 3px 9px var(--shadow-strong);
  transform: translateY(-0.85px);
}

.btn-action-blue:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px var(--shadow-soft);
}

.btn-action-blue:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Action Button - Inverted Blue Variant */
.btn-action-blue-inverted {
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: var(--cta-blue);
  background: var(--bg-light);
  border: 1px solid var(--cta-blue);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22), 0 2px 4px var(--shadow-soft);
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-action-blue-inverted:hover:not(:disabled) {
  background: var(--bg-light);
  border-color: color-mix(in oklch, var(--cta-blue) 85%, black 15%);
  color: color-mix(in oklch, var(--cta-blue) 85%, black 15%);
  filter: brightness(0.95);
}

/* Action Button - Gray Variant */
.btn-action-gray {
  padding: 0.5rem 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  color: var(--text-main);
  background: var(--bg-light);
  border: 1px solid var(--border);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.22), 0 2px 4px var(--shadow-soft);
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-action-gray:hover:not(:disabled) {
  background: var(--bg-mid);
  border-color: var(--border);
}

/* Final Button - Large Submit CTA */
.btn-final {
  padding: 0.875rem 2.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  border-radius: 0.5rem;
  color: #ffffff;
  background: var(--cta-blue);
  border: 2px solid var(--cta-blue);
  min-width: 280px;
  box-shadow: 0 4px 12px rgba(53, 102, 168, 0.25),
              inset 0 1px 1px rgba(255, 255, 255, 0.22);
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-final:hover:not(:disabled) {
  background: color-mix(in oklch, var(--cta-blue) 80%, black 20%);
  border-color: color-mix(in oklch, var(--cta-blue) 80%, black 20%);
  box-shadow: 0 6px 16px rgba(53, 102, 168, 0.35),
              inset 0 1px 1px rgba(255, 255, 255, 0.26);
  transform: translateY(-1px);
}

.btn-final:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(53, 102, 168, 0.3),
              inset 0 1px 1px rgba(255, 255, 255, 0.22);
}

.btn-final:disabled {
  opacity: 0.5;
  filter: brightness(0.9);
  cursor: not-allowed;
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

/* ==================== FORM INPUTS ==================== */

.input-field {
  width: 100%;
  padding: 0.5rem 0.75rem;
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
  box-shadow: inset 0 1px 2px var(--highlight),
              0 0 0 2px color-mix(in oklch, var(--brand) 60%, white 40%);
}

.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-mid);
}

.input-field::placeholder {
  opacity: 0.7;
}

.input-field--error {
  border-color: var(--error);
}

.input-field--error:focus {
  border-color: var(--error);
  box-shadow: inset 0 1px 2px var(--highlight),
              0 0 0 2px color-mix(in oklch, var(--error) 40%, white 60%);
}

/* ==================== CHECKBOXES & RADIOS ==================== */

.tt-checkbox,
.tt-radio {
  -webkit-appearance: none;
  appearance: none;
  width: 1.375rem;
  height: 1.375rem;
  display: inline-grid;
  place-content: center;
  flex-shrink: 0;
  background: var(--bg-light);
  border: 2px solid var(--border);
  box-shadow: inset 0 1px 2px var(--highlight);
  transition: transform 200ms ease;
  vertical-align: middle;
  cursor: pointer;
}

.tt-checkbox {
  border-radius: 0.375rem;
}

.tt-radio {
  border-radius: 9999px;
}

.tt-checkbox:hover:not(:disabled),
.tt-radio:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: inset 0 1px 2px var(--highlight), 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.tt-checkbox:focus-visible,
.tt-radio:focus-visible {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--brand) 60%, white 40%);
}

.tt-checkbox:disabled,
.tt-radio:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tt-checkbox:checked,
.tt-radio:checked {
  background: var(--bg-light);
  border-color: var(--text-main);
  box-shadow: inset 0 1px 2px var(--highlight);
}

/* Checkbox checkmark */
.tt-checkbox::after {
  content: "";
  width: 0.375rem;
  height: 0.625rem;
  border: solid var(--text-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0.3);
  display: block;
  margin-top: -0.125rem;
  opacity: 0;
  animation: checkboxFadeOut 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.tt-checkbox:checked::after {
  animation: checkboxFadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* Radio inner fill */
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

/* ==================== STATUS CHIPS ==================== */

.status-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
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

/* ==================== BADGES ==================== */

.badge-success {
  background: var(--success-50);
  color: var(--success);
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge-warn {
  background: var(--warn-50);
  color: var(--warn);
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge-error {
  background: var(--error-50);
  color: var(--error);
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

/* ==================== LAYOUT COMPONENTS ==================== */

.enrollment-page-container {
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}

@media (min-width: 640px) {
  .enrollment-page-container {
    padding: 3rem 1.5rem;
  }
}

@media (min-width: 1024px) {
  .enrollment-page-container {
    padding: 3rem 2rem;
  }
}

.enrollment-content-card {
  background: var(--bg-light);
  border-radius: 1.25rem;
  border: 1px solid var(--border);
  padding: 1.5rem;
  min-height: 60vh;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 2px 8px rgba(0, 0, 0, 0.08);
}

@media (min-width: 768px) {
  .enrollment-content-card {
    padding: 2rem;
  }
}

.row-default {
  width: 100%;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  padding: 1rem 1.25rem;
  background: var(--bg-light);
  transition: all 200ms ease;
}

.row-default:hover {
  box-shadow: inset 0 1px 2px var(--highlight), 0 4px 12px var(--shadow-soft);
}

.row-table-item {
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  transition: all 200ms ease;
}

.row-table-item:hover {
  box-shadow: inset 0 1px 2px var(--highlight), 0 4px 12px var(--shadow-soft);
  transform: translateY(-1px);
}

/* ==================== INFO PANELS ==================== */

.info-panel {
  background: var(--bg-mid);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
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

/* ==================== NAVIGATION FOOTER ==================== */

.navigation-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--border);
  margin-top: 2rem;
}

@media (max-width: 640px) {
  .navigation-footer {
    flex-direction: column-reverse;
    gap: 0.75rem;
  }

  .navigation-footer .btn-back,
  .navigation-footer .btn-continue {
    width: 100%;
  }
}
```

---

## Component Implementation

### Button Usage Examples

#### Primary CTA Button

```html
<button class="btn-continue" type="submit">
  Continue
</button>

<!-- Disabled state -->
<button class="btn-continue" type="submit" disabled>
  Continue
</button>
```

#### Navigation Footer Pattern

```html
<div class="navigation-footer">
  <button class="btn-back" type="button" onclick="goBack()">
    Back
  </button>
  <button class="btn-continue" type="submit">
    Continue
  </button>
</div>
```

### Form Input Implementation

```html
<!-- Text Input -->
<div>
  <label for="email">Email Address</label>
  <input
    type="email"
    id="email"
    class="input-field"
    placeholder="your@email.com"
    required
  >
</div>

<!-- Error State -->
<div>
  <label for="phone">Phone Number</label>
  <input
    type="tel"
    id="phone"
    class="input-field input-field--error"
    value="invalid"
    required
  >
  <span class="error-message">Please enter a valid phone number</span>
</div>
```

### Checkbox Implementation

```html
<label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
  <input type="checkbox" class="tt-checkbox" id="agree">
  <span>I agree to the terms and conditions</span>
</label>
```

### Radio Button Implementation

```html
<fieldset>
  <legend>Select payment method:</legend>

  <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.5rem;">
    <input type="radio" name="payment" value="card" class="tt-radio" checked>
    <span>Credit Card</span>
  </label>

  <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
    <input type="radio" name="payment" value="bank" class="tt-radio">
    <span>Bank Transfer</span>
  </label>
</fieldset>
```

### Status Chip Implementation

```html
<!-- Success/Enrolled Chip -->
<span class="status-chip status-chip--enrolled">Enrolled</span>

<!-- Warning/Need Chip -->
<span class="status-chip status-chip--need">Needs Review</span>

<!-- Neutral Chip -->
<span class="status-chip status-chip--not-participating">Not Participating</span>
```

---

## Dynamic Styling Patterns

### Progress Bar with Dividers

This is the most complex component. Here's a simplified implementation:

```html
<div class="progress-bar-container">
  <!-- Progress track -->
  <div class="progress-track">
    <!-- Fill bar (width controlled by JavaScript) -->
    <div class="progress-fill" style="width: 45%;"></div>

    <!-- Section dividers (positioned by JavaScript) -->
    <div class="section-divider section-divider--filled" style="left: 16.67%;"></div>
    <div class="section-divider section-divider--filled" style="left: 33.33%;"></div>
    <div class="section-divider" style="left: 50%;"></div>
    <div class="section-divider" style="left: 66.67%;"></div>
    <div class="section-divider" style="left: 83.33%;"></div>
  </div>

  <!-- Step labels -->
  <div class="step-labels">
    <span class="step-label step-label--active">Step 1</span>
    <span class="step-label step-label--active">Step 2</span>
    <span class="step-label">Step 3</span>
    <span class="step-label">Step 4</span>
    <span class="step-label">Step 5</span>
  </div>
</div>
```

**Required CSS (add to che-components.css):**

```css
.progress-bar-container {
  padding: 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.progress-track {
  position: relative;
  height: 4px;
  background: var(--bg-dark);
  border-radius: 9999px;
  margin-bottom: 0.75rem;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--brand-mid);
  border-radius: 9999px;
  transition: width 300ms ease-out;
}

.section-divider {
  position: absolute;
  top: 0;
  width: 6px;
  height: 100%;
  margin-left: -3px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--border-dark),
    var(--bg-mid),
    var(--border-dark)
  );
  border-left: 1.5px solid var(--border);
  border-right: 1.5px solid var(--border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1),
              inset 0 0 2px rgba(0, 0, 0, 0.05);
}

.section-divider--filled {
  background: linear-gradient(
    to right,
    var(--brand-700),
    var(--brand),
    var(--brand-700)
  );
  border-left: 1.5px solid var(--brand-900);
  border-right: 1.5px solid var(--brand-900);
  box-shadow: 0 0 8px rgba(234, 88, 12, 0.4),
              inset 0 0 4px rgba(255, 255, 255, 0.3);
}

.step-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-label {
  font-family: 'Outfit', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  transition: color 200ms ease;
}

.step-label--active {
  color: var(--warn);
}
```

**JavaScript for Dynamic Updates:**

```javascript
function updateProgress(percentage) {
  const fillBar = document.querySelector('.progress-fill');
  fillBar.style.width = percentage + '%';

  // Update dividers based on progress
  const dividers = document.querySelectorAll('.section-divider');
  const stepWidth = 100 / dividers.length;

  dividers.forEach((divider, index) => {
    const dividerPosition = (index + 1) * stepWidth;
    if (percentage >= dividerPosition) {
      divider.classList.add('section-divider--filled');
    } else {
      divider.classList.remove('section-divider--filled');
    }
  });
}

// Usage
updateProgress(45); // Set progress to 45%
```

### Missing Field Popover

```html
<!-- Button with popover trigger -->
<div style="position: relative;">
  <button
    class="btn-continue"
    disabled
    id="submit-btn"
    onmouseenter="showMissingFields()"
    onmouseleave="hideMissingFields()"
  >
    Continue
  </button>

  <!-- Popover (hidden by default) -->
  <div
    id="missing-fields-popover"
    class="missing-field-popover"
    style="display: none;"
  >
    <p style="font-weight: 600; margin-bottom: 0.5rem;">Please complete:</p>
    <ul class="missing-field-list">
      <li>Email address</li>
      <li>Phone number</li>
      <li>Billing address</li>
    </ul>
  </div>
</div>
```

**CSS (add to che-components.css):**

```css
.missing-field-popover {
  position: fixed;
  z-index: 9999;
  background: var(--bg-mid);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  min-width: 200px;
  max-width: 300px;
}

.missing-field-popover::before {
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

**JavaScript:**

```javascript
function showMissingFields() {
  const popover = document.getElementById('missing-fields-popover');
  const button = document.getElementById('submit-btn');

  // Calculate position above button
  const buttonRect = button.getBoundingClientRect();
  popover.style.display = 'block';

  // Position popover
  const popoverHeight = popover.offsetHeight;
  popover.style.top = (buttonRect.top - popoverHeight - 12) + 'px';
  popover.style.left = (buttonRect.left + buttonRect.width / 2) + 'px';
  popover.style.transform = 'translateX(-50%)';

  // Add animation class
  popover.classList.add('animate-popover-fade-in');
}

function hideMissingFields() {
  const popover = document.getElementById('missing-fields-popover');
  popover.style.display = 'none';
  popover.classList.remove('animate-popover-fade-in');
}
```

---

## Framework Integration

### React Integration

**1. Import CSS in your root component:**

```jsx
// src/index.js or src/App.js
import './assets/styles/che-design-system.css';
```

**2. Create reusable button components:**

```jsx
// components/Button.jsx
export function ContinueButton({ children, onClick, disabled, ...props }) {
  return (
    <button
      className="btn-continue"
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function BackButton({ children, onClick, ...props }) {
  return (
    <button
      className="btn-back"
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
```

**3. Usage:**

```jsx
import { ContinueButton, BackButton } from './components/Button';

function MyForm() {
  return (
    <div className="navigation-footer">
      <BackButton onClick={() => console.log('Back')}>
        Back
      </BackButton>
      <ContinueButton onClick={() => console.log('Continue')}>
        Continue
      </ContinueButton>
    </div>
  );
}
```

### Vue Integration

**1. Import in main.js:**

```javascript
// src/main.js
import './assets/styles/che-design-system.css';
```

**2. Create component:**

```vue
<!-- components/ContinueButton.vue -->
<template>
  <button
    class="btn-continue"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot></slot>
  </button>
</template>

<script>
export default {
  name: 'ContinueButton',
  props: {
    disabled: Boolean
  }
};
</script>
```

**3. Usage:**

```vue
<template>
  <div class="navigation-footer">
    <BackButton @click="goBack">Back</BackButton>
    <ContinueButton @click="submit">Continue</ContinueButton>
  </div>
</template>

<script>
import ContinueButton from './components/ContinueButton.vue';
import BackButton from './components/BackButton.vue';

export default {
  components: {
    ContinueButton,
    BackButton
  },
  methods: {
    goBack() {
      console.log('Going back');
    },
    submit() {
      console.log('Submitting');
    }
  }
};
</script>
```

### Vanilla JavaScript

For plain HTML/JavaScript projects:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CHE Design System Example</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600&family=Outfit:wght@600&display=swap" rel="stylesheet">

  <!-- CHE Design System -->
  <link rel="stylesheet" href="./assets/styles/che-design-system.css">
</head>
<body>

  <div class="enrollment-page-container">
    <div class="enrollment-content-card">
      <h1>Welcome to CHE Enrollment</h1>

      <form id="my-form">
        <!-- Form fields -->
        <div style="margin-bottom: 1rem;">
          <label for="name">Full Name</label>
          <input
            type="text"
            id="name"
            class="input-field"
            placeholder="Enter your name"
            required
          >
        </div>

        <!-- Navigation Footer -->
        <div class="navigation-footer">
          <button type="button" class="btn-back" onclick="history.back()">
            Back
          </button>
          <button type="submit" class="btn-continue">
            Continue
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    document.getElementById('my-form').addEventListener('submit', (e) => {
      e.preventDefault();
      alert('Form submitted!');
    });
  </script>
</body>
</html>
```

---

## Testing & Validation

### Visual Regression Testing

Test these key states for each component:

**Buttons:**
- ✅ Default state
- ✅ Hover state (`:hover`)
- ✅ Active/pressed state (`:active`)
- ✅ Focus state (`:focus`)
- ✅ Disabled state (`disabled`)

**Inputs:**
- ✅ Empty/default
- ✅ Filled with text
- ✅ Focus state
- ✅ Error state
- ✅ Disabled state
- ✅ Placeholder visibility

**Checkboxes/Radios:**
- ✅ Unchecked
- ✅ Checked (with animation)
- ✅ Hover
- ✅ Focus
- ✅ Disabled

### Browser Compatibility

Test on:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

**Known Issues:**

1. **`color-mix()` not supported in older browsers**
   - Fallback: Use solid hex colors
   - Example: `--brand-50: #E8F0EF;` instead of `color-mix()`

2. **OKLCH colors require modern browsers**
   - Fallback: Convert to hex or rgb
   - Example: `--text-main: #1F4F48;` instead of `oklch(...)`

### Accessibility Testing

Use these tools:

1. **axe DevTools** (Chrome extension)
   - Test for color contrast
   - Verify focus indicators
   - Check ARIA labels

2. **Keyboard Navigation Test:**
   ```
   Tab       → Move to next focusable element
   Shift+Tab → Move to previous element
   Enter     → Activate button/link
   Space     → Toggle checkbox/radio
   Escape    → Close modal/popover
   ```

3. **Screen Reader Test** (NVDA/JAWS/VoiceOver):
   - All form fields have labels
   - Buttons have descriptive text
   - Status messages are announced

### Performance Checks

Monitor these metrics:

- **CSS File Size:** Should be < 50KB minified
- **First Paint:** Check for font loading delays
- **Animation Jank:** Ensure 60fps on animations
- **Mobile Performance:** Test on mid-range devices

---

## Troubleshooting

### Common Issues

#### Issue: Buttons don't have rounded corners

**Cause:** Missing `border-radius` property or conflicting CSS reset.

**Fix:**
```css
/* Add to your global reset if needed */
button {
  border-radius: 0.5rem; /* Ensure this is applied */
}
```

#### Issue: Colors look different than expected

**Cause:** `color-mix()` or OKLCH not supported in browser.

**Fix:** Add fallback colors:
```css
:root {
  /* Fallback */
  --brand: #3E716A;

  /* Progressive enhancement */
  @supports (color: oklch(0.5 0.1 180)) {
    --brand: oklch(0.4 0.05 182.54);
  }
}
```

#### Issue: Fonts not loading

**Cause:** Google Fonts blocked or incorrect import.

**Fix:**
1. Verify fonts are loaded in `<head>`
2. Check browser network tab for 404 errors
3. Use local fonts as fallback:

```css
@font-face {
  font-family: 'Epilogue';
  src: url('./fonts/Epilogue-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
```

#### Issue: Checkbox/radio animations don't work

**Cause:** Missing animation keyframes or browser doesn't support `appearance: none`.

**Fix:**
1. Ensure animation keyframes are included
2. Add vendor prefixes:

```css
.tt-checkbox {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
```

#### Issue: Hover effects not working on mobile

**Cause:** Touch devices don't have hover states.

**Fix:** Add active state fallback:
```css
.btn-continue:hover:not(:disabled),
.btn-continue:active:not(:disabled) {
  /* Hover/touch styling */
}
```

#### Issue: Shadows look pixelated

**Cause:** Low browser rendering quality or missing anti-aliasing.

**Fix:** Add subtle blur and reduce opacity:
```css
/* Instead of: */
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);

/* Use: */
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
```

---

## Checklist: Pre-Launch Verification

Before deploying CHE design system to production:

### Files & Assets
- [ ] All CSS files are minified
- [ ] Fonts are loading correctly (check network tab)
- [ ] No 404 errors for CSS/font files
- [ ] Dark mode variables included (if applicable)

### Components
- [ ] All buttons render correctly
- [ ] Inputs have focus states
- [ ] Checkboxes/radios animate on check
- [ ] Status chips show correct colors
- [ ] Navigation footer is responsive

### Responsiveness
- [ ] Test on mobile (320px - 640px)
- [ ] Test on tablet (768px - 1024px)
- [ ] Test on desktop (1280px+)
- [ ] Navigation footer stacks on mobile

### Accessibility
- [ ] All colors pass WCAG AA contrast (4.5:1 minimum)
- [ ] Focus indicators visible on all interactive elements
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader tested (forms, buttons, status messages)

### Browser Compatibility
- [ ] Chrome/Edge (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Mobile Safari (iOS 14+)
- [ ] Chrome Mobile (Android 10+)

### Performance
- [ ] CSS file size < 50KB gzipped
- [ ] No layout shift on font load (use `font-display: swap`)
- [ ] Animations run at 60fps
- [ ] No JavaScript errors in console

---

## Quick Reference Commands

### Minify CSS (using CLI tools)

```bash
# Using cssnano (Node.js)
npx cssnano che-design-system.css che-design-system.min.css

# Using clean-css
npx clean-css-cli -o che-design-system.min.css che-design-system.css
```

### Combine Multiple CSS Files

```bash
# Unix/Linux/Mac
cat che-variables.css che-base.css che-typography.css \
    che-animations.css che-components.css che-utilities.css \
    > che-design-system.css

# Windows (PowerShell)
Get-Content che-variables.css,che-base.css,che-typography.css,che-animations.css,che-components.css,che-utilities.css | Set-Content che-design-system.css
```

### Check Color Contrast

Use online tools:
- **WebAIM Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **Colorable:** https://colorable.jxnblk.com/

---

## Support & Resources

### Documentation
- **Full Style Guide:** CHE_STYLE_GUIDE.md
- **Component Demos:** Include link to live demo site

### Tools
- **Browser DevTools:** Chrome, Firefox, Safari
- **Accessibility:** axe DevTools, WAVE, Lighthouse
- **Design:** Figma, Sketch (if designs available)

### Contact
For questions or issues with CHE design system implementation:
- Create an issue in project repository
- Email: [your-email@domain.com]
- Slack: #che-design-system

---

**End of CHE Implementation Guide v1.0**

This guide provides everything needed to integrate CHE design system into external projects. For design specifications and visual examples, refer to the companion **CHE_STYLE_GUIDE.md** document.
