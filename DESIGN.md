---
version: alpha
name: domain-manage-console
description: "A dark-only operations console for personal domains, services, and servers. Near-black canvas (#0A0A0B), a three-step surface ladder for the app shell, hairline borders instead of shadows, and a single indigo-violet accent (#6C5CE7) reserved for selection, focus, and the one primary action per view. Dense 13–14px Inter UI with tabular JetBrains Mono for domains, IPs, and ports. The layout is a fixed application shell — sidebar, topbar, content — never a scrolling marketing page: no hero, no section bands, no decorative imagery. Asset identity is carried by icon tiles, brand-color stripes, and monogram fallbacks so similar-looking domains stay distinguishable."

colors:
  primary: "#6C5CE7"
  primary-hover: "#5A4BD4"
  primary-text: "#9B8DFF"
  primary-soft: "rgba(108,92,231,0.16)"
  on-primary: "#FFFFFF"
  ink: "#F5F6F7"
  ink-muted: "#C6C9D0"
  ink-subtle: "#8B8F99"
  ink-faint: "#5C6069"
  canvas: "#0A0A0B"
  surface-1: "#101013"
  surface-2: "#16161A"
  surface-3: "#1C1C22"
  hairline: "rgba(255,255,255,0.08)"
  hairline-strong: "rgba(255,255,255,0.16)"
  success: "#56D364"
  success-soft: "rgba(86,211,100,0.12)"
  warning: "#E3B341"
  warning-soft: "rgba(227,179,65,0.12)"
  danger: "#FF8A80"
  danger-soft: "rgba(255,138,128,0.12)"
  overlay: "rgba(0,0,0,0.6)"

typography:
  page-title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.2px
  section-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.1px
  card-title:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.2px
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  button:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  eyebrow:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.6px
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 12.5px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
    fontFeature: '"tnum"'
  mono-strong:
    fontFamily: JetBrains Mono
    fontSize: 13.5px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
    fontFeature: '"tnum"'

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 12px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px

components:
  sidebar:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    width: 232px
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 0px 10px
    height: 32px
  sidebar-item-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    height: 32px
  topbar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    height: 48px
  page-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.page-title}"
    padding: 24px 0px 16px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0px 12px
    height: 32px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 32px
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0px 12px
    height: 32px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0px 10px
    height: 32px
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 0px 12px
    height: 32px
  button-disabled:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 32px
  text-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 0px 10px
    height: 32px
  text-input-focused:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 32px
  search-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 0px 10px
    height: 32px
  command-palette:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 4px
  command-palette-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 0px 10px
    height: 36px
  command-palette-row-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: 36px
  data-table-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.eyebrow}"
    height: 36px
  data-table-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    height: 44px
  data-table-row-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
  asset-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 16px
  asset-icon:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: 40px
  asset-monogram:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.mono-strong}"
    rounded: "{rounded.md}"
    size: 40px
  tag-chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 0px 8px
    height: 22px
  tag-chip-accent:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    height: 22px
  status-badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 0px 8px
    height: 22px
  status-dot-success:
    backgroundColor: "{colors.success}"
    rounded: "{rounded.pill}"
    size: 8px
  status-dot-warning:
    backgroundColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    size: 8px
  status-dot-danger:
    backgroundColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    size: 8px
  status-dot-idle:
    backgroundColor: "{colors.ink-faint}"
    rounded: "{rounded.pill}"
    size: 8px
  segmented-control:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 2px
    height: 28px
  segmented-item-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    height: 24px
  modal:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 24px
  modal-scrim:
    backgroundColor: "{colors.overlay}"
  divider:
    backgroundColor: "{colors.hairline}"
    height: 1px
  divider-strong:
    backgroundColor: "{colors.hairline-strong}"
    height: 1px
  link-inline:
    textColor: "{colors.primary-text}"
    typography: "{typography.body}"
  status-chip-success:
    backgroundColor: "{colors.success-soft}"
    rounded: "{rounded.pill}"
    padding: 0px 8px
    height: 22px
  status-chip-warning:
    backgroundColor: "{colors.warning-soft}"
    rounded: "{rounded.pill}"
    padding: 0px 8px
    height: 22px
  status-chip-danger:
    backgroundColor: "{colors.danger-soft}"
    rounded: "{rounded.pill}"
    padding: 0px 8px
    height: 22px
  drawer:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    width: 360px
  toast:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  tooltip:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 4px 8px
  kbd:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 0px 6px
    height: 20px
  empty-state:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    padding: 48px
  meter:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.pill}"
    height: 4px
  meter-fill:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    height: 4px
  meter-fill-warning:
    backgroundColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    height: 4px
  meter-fill-danger:
    backgroundColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    height: 4px
  login-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 28px
    width: 360px
  login-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: 36px
  skeleton:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.sm}"
    height: 12px
---

## Overview

This is an **application shell, not a website**. There is no hero, no scroll narrative, no full-bleed section bands, no atmospheric gradient, and no marketing display type. The user is here to look something up and leave — every screen must answer a question in one glance.

The system is dark-only. The canvas is `{colors.canvas}` (#0A0A0B), a near-black with a faint neutral tint. On top sits a three-step surface ladder — `{colors.surface-1}` for the sidebar and cards, `{colors.surface-2}` for inputs, hovered rows, and chips, `{colors.surface-3}` for floating layers (command palette, modal, toast). Separation comes from 1px `{colors.hairline}` borders and the surface ladder, never from drop shadows or gradients.

Exactly **one chromatic accent** exists: indigo-violet `{colors.primary}` (#6C5CE7). It marks selection, focus, links, and at most one primary button per view. Everything else is monochrome gray plus a low-saturation semantic trio (`{colors.success}`, `{colors.warning}`, `{colors.danger}`) used almost exclusively as 8px dots and hairline accents — not as large fills, not as text color on body copy.

The shell: a fixed 232px `{component.sidebar}` on the left, a 48px `{component.topbar}` across the top, and a fluid content area that fills the rest. The page never scrolls as a whole; only the content column scrolls. Desktop density is high: 32px controls, 44px table rows, 13–14px type.

Identity is the product's job: a domain is never just a string. It renders as `{component.asset-icon}` (favicon, or `{component.asset-monogram}` fallback), a brand-color stripe, a bold name with a de-emphasized TLD, and mono `{typography.mono-data}` for IPs and ports.

**Key Characteristics:**
- Fixed app shell — sidebar + topbar + content; content scrolls, chrome never does.
- Dark-only; no light mode.
- Single indigo accent `{colors.primary}`, used scarcely.
- Three-step surface ladder + `{colors.hairline}` borders instead of shadows.
- 13–14px dense UI; `{typography.mono-data}` for every machine identifier.
- Asset icon tiles as the primary recognition anchor.
- Command palette (`{component.command-palette}`) as the primary global search.

## Colors

### Brand & Accent

- **Primary** (`{colors.primary}` #6C5CE7): selection, active nav, focus ring, inline links, and the single primary button per view. If two indigo elements compete in one viewport, one of them is wrong.
- **Primary Hover** (`{colors.primary-hover}` #5A4BD4): pressed/darker state for `{component.button-primary}`. On dark surfaces the hover state moves *down* in luminance, not up — this keeps white label contrast above 4.5:1.
- **Primary Text** (`{colors.primary-text}` #9B8DFF): the lightened accent for inline links (`{component.link-inline}`) and accent numerals on dark; `{colors.primary}` itself is too dark to read as body-size text on `{colors.canvas}`.
- **Primary Soft** (`{colors.primary-soft}` 16%): selection wash for `{component.command-palette-row-active}`, focus halos, and `{component.tag-chip-accent}`.
- **On Primary** (`{colors.on-primary}`): white label on `{component.button-primary}`.

### Surface

- **Canvas** (`{colors.canvas}` #0A0A0B): the app background and table background.
- **Surface 1** (`{colors.surface-1}`): sidebar, `{component.asset-card}`, settings panels.
- **Surface 2** (`{colors.surface-2}`): inputs, `{component.data-table-row-hover}`, chips, `{component.drawer}`, kbd caps.
- **Surface 3** (`{colors.surface-3}`): floating layers only — `{component.modal}`, `{component.command-palette}`, `{component.toast}`, `{component.tooltip}`.
- **Hairline** (`{colors.hairline}` 8% white): every border and divider, including `{component.divider}`. **Hairline Strong** (`{colors.hairline-strong}` 16% white) for input borders, danger button outline, and `{component.divider-strong}`.
- **Overlay** (`{colors.overlay}`): the 60% black scrim rendered by `{component.modal-scrim}` behind `{component.modal}` and `{component.command-palette}`.

### Text

- **Ink** (`{colors.ink}` #F5F6F7): primary text, values, active nav labels.
- **Ink Muted** (`{colors.ink-muted}` #C6C9D0): secondary text, descriptions, inactive nav labels, `{component.status-badge}` labels.
- **Ink Subtle** (`{colors.ink-subtle}` #8B8F99): metadata, table column headers, captions, TLD in a domain name.
- **Ink Faint** (`{colors.ink-faint}` #5C6069): disabled labels, `{component.status-dot-idle}`, decorative separators.

### Semantic

Semantic colors are **dots and rules first, text second, fills never**. Each has a 12% `-soft` companion used only inside small chips.

- **Success** (`{colors.success}`): resolved DNS, saved confirmation, `{component.status-dot-success}`.
- **Warning** (`{colors.warning}`): maintenance markers, `{component.status-dot-warning}`.
- **Danger** (`{colors.danger}`): disabled services, destructive actions, `{component.status-dot-danger}`, `{component.button-danger}`.
- **Success Soft / Warning Soft / Danger Soft** (`{colors.success-soft}`, `{colors.warning-soft}`, `{colors.danger-soft}`): optional chip washes where a dot alone is too quiet.

## Typography

### Font Family

- **Inter** — the entire UI, weights 400/500/600. No 700; weight 600 is the ceiling so dense text does not shout.
- **JetBrains Mono** — machine data only: domains, IP addresses, ports, container names, zone IDs, timestamps. `{typography.mono-data}` is tabular (`tnum`) so digits align in columns; `{typography.mono-strong}` is for the domain name in detail headers and monograms.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `{typography.page-title}` | 20px | 600 | 1.3 | Page header title only |
| `{typography.section-title}` | 16px | 600 | 1.4 | Detail section headings, modal titles |
| `{typography.card-title}` | 14px | 600 | 1.4 | Asset card title, list primary label |
| `{typography.body}` | 14px | 400 | 1.5 | Default body, inputs, command palette rows |
| `{typography.body-sm}` | 13px | 400 | 1.45 | Table cells, sidebar items, secondary copy |
| `{typography.label}` | 13px | 500 | 1.4 | Form labels, field values, nav emphasis |
| `{typography.button}` | 13px | 500 | 1.2 | All button labels |
| `{typography.caption}` | 12px | 400 | 1.4 | Metadata, timestamps, chip labels |
| `{typography.eyebrow}` | 11px | 600 | 1.2 | Table headers, uppercase, +0.6px tracking |
| `{typography.mono-data}` | 12.5px | 400 | 1.5 | IPs, ports, IDs, timestamps, tabular |
| `{typography.mono-strong}` | 13.5px | 500 | 1.4 | Domain in detail header, monogram glyphs |

### Principles

- **No display type.** The largest type in the product is 20px. A management console that needs 48px headlines is a marketing page in disguise.
- **Weight ceiling is 600.** Hierarchy comes from size, color (`{colors.ink}` → `{colors.ink-muted}` → `{colors.ink-subtle}`), and spacing.
- **Mono means machine.** If a human named it (service, alias, tag), it is Inter. If a machine assigned it (domain, IP, port, ID), it is JetBrains Mono.
- **Numbers always tabular.** `{typography.mono-data}` carries `tnum` so IPs, ports, and counts line up vertically.
- **Uppercase only for `{typography.eyebrow}`**, never for buttons or nav.

## Layout

### App Shell

```
┌──────────────────────────────────────────────────────────┐
│ topbar 48px: brand · search · sync · settings            │
├────────────┬─────────────────────────────────────────────┤
│ sidebar    │ content (scrolls)                           │
│ 232px      │  page-header: title + actions               │
│ fixed      │  toolbar: filter · search · count · toggle  │
│ nav +      │  table / cards / detail sections            │
│ status     │                                             │
└────────────┴─────────────────────────────────────────────┘
```

- `{component.sidebar}` is fixed, full height, `{colors.surface-1}` background, 1px right `{colors.hairline}`. Items are 32px tall (`{component.sidebar-item}`), active item uses `{component.sidebar-item-active}` — a `{colors.surface-2}` fill plus `{colors.ink}` label. No colored left bars, no pill shapes.
- `{component.topbar}` is 48px, `{colors.canvas}`, 1px bottom hairline, `position: sticky`. It carries the global `{component.search-input}`, the Cloudflare sync action, and settings.
- The content column is the only scroll container. Page heading uses `{component.page-header}`.
- Content max width is 1280px with `{spacing.lg}` 24px gutters; tables may run full width.

### Page Patterns

- **List page** (Domains, Services, Servers): `{component.page-header}` with the primary action on the right → toolbar row → table or `{component.asset-card}` grid. The toolbar holds search, tag filter, `{component.segmented-control}` view toggle, and result count.
- **Detail page**: back link in `{colors.ink-subtle}` at top → identity header (icon + name + mono domain) → stacked `{typography.section-title}` sections separated by `{colors.hairline}` rules → inline edit actions. No tabs unless there are 3+ distinct sections.
- **Settings**: a single narrow column (max 640px) of labeled fields inside `{colors.surface-1}` panels.
- **Overlay surfaces** are for create/edit forms and confirmations only; browsing details never happens in a `{component.modal}`.

### Density & Spacing

- Base unit 4px. Tokens: `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 48.
- Controls are 32px tall (button, input, select). Table rows are 44px; card grid gap `{spacing.sm}`.
- Section gaps inside detail pages: `{spacing.lg}`. Between major page blocks: `{spacing.xl}`.
- Card interior padding `{spacing.md}` 16px; modal padding `{spacing.lg}` 24px.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 | `{colors.canvas}`, no border | Page background, table background |
| 1 | `{colors.surface-1}` + 1px `{colors.hairline}` | Sidebar, asset cards, settings panels |
| 2 | `{colors.surface-2}` + 1px `{colors.hairline}` | Inputs, hovered rows, chips, drawer |
| 3 | `{colors.surface-3}` + 1px `{colors.hairline-strong}`, `0 16px 48px rgba(0,0,0,0.5)` | Command palette, modal, toast, tooltip |
| Focus | 2px `{colors.primary-soft}` halo + 1px `{colors.primary}` border | `{component.text-input-focused}`, focused buttons, active search |

Shadows exist **only on level 3 floating layers**. Cards, tables, and the shell use borders. There are no gradients anywhere in the product.

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | `{component.tag-chip}`, `{component.status-badge}`, `{component.kbd}` |
| `{rounded.sm}` | 6px | Sidebar items, command palette rows, skeleton bars |
| `{rounded.md}` | 8px | Buttons, inputs, `{component.asset-icon}`, segmented control |
| `{rounded.lg}` | 10px | `{component.asset-card}`, `{component.toast}` |
| `{rounded.xl}` | 12px | `{component.modal}`, `{component.command-palette}` |
| `{rounded.pill}` | 9999px | `{component.status-dot-success}` and siblings only |

No stadium-shaped buttons. No pill nav items. The only circles in the product are status dots and avatars.

## Components

### Navigation

- `{component.sidebar}` — fixed left rail; brand mark at top, nav list middle, environment/status footer at bottom (sync state dot). Width 232px.
- `{component.sidebar-item}` and `{component.sidebar-item-active}` — 32px rows with a 16px inline SVG icon (1.5px stroke, `{colors.ink-subtle}` at rest, `{colors.ink}` active) and a label. Counts render right-aligned in `{typography.mono-data}`.
- `{component.topbar}` — brand, `{component.search-input}` (which opens the command palette on focus), sync button, settings icon.

### Buttons

- `{component.button-primary}` — the single accent action per view. 32px, `{rounded.md}`, white label. Hover/pressed uses `{component.button-primary-hover}`.
- `{component.button-secondary}` — `{colors.surface-2}` fill, `{colors.ink}` label, 1px `{colors.hairline}` border. The default for "编辑", "关联", "上传".
- `{component.button-ghost}` — borderless `{colors.ink-muted}` label for icon-adjacent and tertiary actions; hover raises text to `{colors.ink}`.
- `{component.button-danger}` — transparent fill, `{colors.danger}` label, 1px `{colors.hairline-strong}` border. Destructive actions are outlined, never solid red, and always require a confirm step.
- `{component.button-disabled}` — `{colors.surface-2}` fill with `{colors.ink-faint}` label; also `not-allowed` cursor, never reduced opacity on the whole control.

### Inputs

- `{component.text-input}` 32px, `{colors.surface-2}`, 1px `{colors.hairline}`, `{typography.body}`. Focus state is `{component.text-input-focused}`: border becomes `{colors.primary}` plus the focus halo.
- `{component.search-input}` — same geometry, `{typography.body-sm}`, with a `{component.kbd}` hint (`⌘K` / `Ctrl K`) right-aligned.
- Labels sit above fields in `{typography.label}` + `{colors.ink-muted}`; help text below in `{typography.caption}` + `{colors.ink-subtle}`. Errors replace help text with `{colors.danger}` text plus a `{component.status-dot-danger}`.

### Command palette

- `{component.command-palette}` — `{colors.surface-3}` floating card, 12px radius, centered near the top of the viewport over `{colors.overlay}`. Input row on top, results below, footer hints in `{component.kbd}`.
- `{component.command-palette-row}` rows are 36px with a leading 16px asset icon and trailing type label in `{colors.ink-subtle}`.
- `{component.command-palette-row-active}` is the only place a `{colors.primary-soft}` wash appears at row scale. Keyboard selection must be visible at all times.

### Tables & lists

- `{component.data-table-header}` — 36px, `{typography.eyebrow}`, `{colors.ink-subtle}`, 1px bottom `{colors.hairline}`. Never sortable-looking unless sortable; sort arrows are 12px inline SVG.
- `{component.data-table-row}` — 44px, 1px bottom `{colors.hairline}`, `{typography.body-sm}`; the first cell carries the asset icon + name, machine values use `{typography.mono-data}`.
- `{component.data-table-row-hover}` — `{colors.surface-2}` fill; row actions (edit/delete) fade in on hover and are always reachable by keyboard focus.
- Card grids (`{component.asset-card}`) are the default on mobile and for domains; tables are the default on desktop for servers and services.

### Asset identity

- `{component.asset-icon}` — 40px rounded tile holding the favicon (or cover crop). Falls back to `{component.asset-monogram}`: first letter or two of the alias, `{typography.mono-strong}`, centered on `{colors.surface-2}`.
- Brand stripe: a 3px `{rounded.pill}` bar in the asset's extracted brand color, pinned to the top edge of `{component.asset-card}` — or a 3px left border on table rows. This is the fastest similarity-breaker and must never be omitted when a brand color exists.
- Domain rendering: alias in `{typography.card-title}` + `{colors.ink}`; the domain below in `{typography.mono-data}` + `{colors.ink-muted}` with the TLD span in `{colors.ink-subtle}`. When two domains are similar, the differing segment gets a `{colors.primary-soft}` background and `{colors.primary-text}` text.
- `{component.tag-chip}` for tags; `{component.tag-chip-accent}` only for the environment tag (`env:prod`). Cap visible tags at 3 plus a `+N`.

### Status

- `{component.status-badge}` — neutral chip (`{colors.surface-2}` + `{colors.ink-muted}`) with a leading dot. The dot alone carries color: `{component.status-dot-success}`, `{component.status-dot-warning}`, `{component.status-dot-danger}`, `{component.status-dot-idle}`. Never color the chip text; this keeps contrast safe and stops the UI from looking like a traffic light. When a dot alone is too quiet, `{component.status-chip-success}`, `{component.status-chip-warning}`, and `{component.status-chip-danger}` wash the chip with the 12% soft color while the label stays neutral.

### Overlays & feedback

- `{component.modal}` — create/edit forms and confirmations. `{colors.surface-3}`, `{rounded.xl}`, `{spacing.lg}` padding, title in `{typography.section-title}`, actions right-aligned with the primary action last.
- `{component.drawer}` — 360px right-side panel for quick edits and asset pickers on desktop; becomes a full-screen sheet below 768px.
- `{component.toast}` — bottom-right, `{colors.surface-3}`, with a 3px semantic left stripe (`{colors.success}`, `{colors.danger}`). Auto-dismiss 4s; never stack more than 3.
- `{component.tooltip}` — `{colors.surface-3}`, `{typography.caption}`, 200ms delay, for icon-only buttons and truncated values.
- `{component.empty-state}` — icon at 32px in `{colors.ink-faint}`, one `{typography.body}` sentence in `{colors.ink-muted}`, one `{component.button-secondary}` action. Empty states teach the next action; they never fill space with illustration.
- `{component.skeleton}` — 12px `{colors.surface-2}` bars, no shimmer animation. Loading is quiet.

### Auth screen

The login screen is the one surface without the app shell: no sidebar, no topbar, just `{component.login-card}` centered on `{colors.canvas}` (max width 360px, `{spacing.lg}` 24px page padding).- The card opens with the same brand lockup used in `{component.sidebar}` — 16px `{colors.primary}` square plus the wordmark — followed by a `{typography.page-title}` heading and one `{typography.caption}` sentence in `{colors.ink-subtle}`.
- Fields use `{component.login-input}` (36px — one step taller than in-app controls to accommodate touch and password managers); only one field in login mode, two in first-run setup mode.
- The submit is a full-width `{component.button-primary}`. Errors render in `{colors.danger}` at `{typography.caption}` above the button; never use toasts, shake animations, or red fills here.
- No marketing copy, no illustration, no "remember me", no username field — the product is single-user and the password is the only credential.
- The footer is a single `{colors.ink-faint}` mono line ("仅限本人使用"), outside the card.

### Server status

- The status line is 12px `{colors.ink-muted}` with a leading `{component.status-dot-success}` / `{component.status-dot-danger}` dot, showing load and uptime in `{typography.mono-data}`.
- `{component.meter}` is the 4px pill track; the fill is `{component.meter-fill}` at normal load, `{component.meter-fill-warning}` at ≥75%, and `{component.meter-fill-danger}` at ≥90%. Meters carry no text; the percentage sits right-aligned in `{typography.mono-data}`.
- Renewal chips reuse `{component.tag-chip}` with a semantic dot: `{component.status-dot-warning}` within 30 days, `{component.status-dot-danger}` within 7 days.
- These blocks live inside the `{component.asset-card}` meta area and are read-only telemetry from the Komari connector — never interactive.

## Do's and Don'ts

### Do

- Keep the shell fixed and scroll only the content column.
- Use `{colors.primary}` for exactly one primary action per view, plus selection/focus.
- Use the surface ladder and `{colors.hairline}` for depth; keep shadows for level-3 layers only.
- Render every machine identifier in `{typography.mono-data}` with `{colors.ink-muted}` or lighter.
- Give every asset an icon tile and, when available, a brand stripe.
- Use `{component.status-badge}` with a colored dot instead of colored text.
- Keep controls at 32px, rows at 44px, and body at 13–14px.
- Show keyboard shortcuts in `{component.kbd}` wherever the palette is mentioned.

### Don't

- Don't build a landing page: no hero, no scroll-narrative, no section bands, no 48px display type.
- Don't add a light mode; the console is dark-only.
- Don't use gradients, glow, glassmorphism, or colored shadows.
- Don't use solid red buttons or colored body text for status.
- Don't use pill-shaped buttons or pill nav items.
- Don't put more than one indigo CTA in a viewport.
- Don't hide critical actions behind hover only.
- Don't use opacity to disable controls; use `{component.button-disabled}` tokens.

## Responsive Behavior

| Name | Width | Key Changes |
|---|---|---|
| Desktop | ≥ 1280px | Full shell: 232px sidebar, tables default, detail as page |
| Laptop | 1024–1279px | Sidebar collapses to a 64px icon rail (labels in `{component.tooltip}`); content max width drops to fluid |
| Tablet | 768–1023px | Icon rail moves to a topbar menu; card grids 2-up |
| Mobile | < 768px | Bottom tab bar (总览/域名/服务/服务器); topbar holds brand + search; cards 1-up; `{component.drawer}` becomes full-screen; tables convert to `{component.asset-card}` lists |

- Touch targets: minimum 44px effective height on mobile; controls keep 32px visual height inside a 44px hit area.
- The command palette becomes a full-screen sheet below 768px.
- Tables never scroll horizontally: columns drop (servers table loses region, domains table loses registrar) before anything overflows.
- Long domains truncate from the left (`…` before the registrable name) so the unique part stays visible; full value lives in `{component.tooltip}`.

## Accessibility

- Body text (`{colors.ink}`, `{colors.ink-muted}`) on `{colors.canvas}`/`{colors.surface-1}` must hold ≥ 4.5:1; `{colors.ink-subtle}` is allowed only at `{typography.caption}` size or larger metadata.
- Focus is always visible: 2px `{colors.primary-soft}` halo with a 1px `{colors.primary}` border, applied via `:focus-visible`.
- Status color is never the only signal — every `{component.status-dot-*}` pairs with a text label.
- Respect `prefers-reduced-motion`: transitions drop to 0ms; the only motion in the product is 120–160ms ease-out on overlays and toggles.
- All interactive elements are reachable by keyboard; the command palette traps focus and restores it on close.

## Iteration Guide

1. Focus on one component at a time and reference it by its `components:` token name.
2. Before adding a screen, decide which shell region it lives in (sidebar, topbar, content, overlay) — never invent a new page structure.
3. Default to `{typography.body}` at `{colors.ink}`; reach for `{colors.ink-muted}` for secondary and `{colors.ink-subtle}` for metadata.
4. New colors require resigning the accent singleton rule; prefer the existing surface ladder.
5. Run `npx @google/design.md lint DESIGN.md` after edits — `broken-ref`, `contrast-ratio`, and `orphaned-tokens` warnings flag issues automatically.
6. Add variants as separate component entries (`-hover`, `-active`, `-disabled`), never as prose-only states.
7. When a screen starts to feel like a landing page, delete the decoration and check whether the shell was violated.

## Known Gaps

- Light mode is intentionally undocumented — the product is dark-only.
- Data-visualization colors (charts, sparklines) are reserved for the deferred monitoring milestone and are not part of this system yet.
- Print styles are out of scope.
- The favicon-to-brand-color extraction algorithm is an implementation detail; the system only specifies the stripe and monogram fallbacks.
- Motion beyond overlay transitions (e.g., drag interactions) is not specified.
