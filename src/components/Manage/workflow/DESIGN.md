---
name: Gator Workflow Map
description: A readable workflow map with one focused place to edit each block.
colors:
  primary: "var(--accent-peach, #ffb8c9)"
  canvas: "#141519"
  paper: "#eeeae4"
  paper-selected: "#fff8ef"
  ink: "#24242a"
  paper-action: "#764b42"
  paper-muted: "#62616a"
  panel-text: "#f5f2f2"
typography:
  map-title:
    fontFamily: "var(--font-body), system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
  map-summary:
    fontFamily: "var(--font-body), system-ui, sans-serif"
    fontSize: "0.78rem"
    lineHeight: 1.55
  map-number:
    fontFamily: "var(--font-body), system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.06em"
  control:
    fontFamily: "var(--font-body), system-ui, sans-serif"
    fontSize: "0.8rem"
  inspector-body:
    fontFamily: "var(--font-body), system-ui, sans-serif"
    fontSize: "0.8rem"
    lineHeight: 1.6
rounded:
  control: "0.65rem"
  action: "0.75rem"
  map-card: "0.45rem 1.15rem 1.15rem 1.15rem"
  sheet: "1.2rem 1.2rem 0 0"
spacing:
  compact: "0.5rem"
  field: "0.75rem"
  card: "1rem"
  inspector: "1.25rem"
components:
  map-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.map-card}"
  map-card-selected:
    backgroundColor: "{colors.paper-selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.map-card}"
  toolbar-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#282120"
    padding: "0.45rem 0.7rem"
    rounded: "0.55rem"
    typography: "{typography.control}"
  action:
    padding: "0.55rem 0.9rem"
    rounded: "{rounded.action}"
    textColor: "var(--gs-text, #f5f2f2)"
  data-choice:
    textColor: "#5e5c65"
    padding: "0.2rem 0.4rem"
    rounded: "0.35rem"
---

# Design System: Gator Workflow Map

## Overview

**Creative North Star: "Map and focus"**

This is the design contract for the workflow component, not a replacement for the Gator dashboard identity. It records the current implementation in `workspace.css` and `workflow-canvas.tsx`, with the underlying controls and canvas behavior supplied by `workflow.css`. Shared colors, fonts, and pickers continue to come from Gator.

Warm numbered cards make the automation readable against a quiet dark working surface. The map explains what happens. Selecting a block opens its detailed settings in one adjacent panel, keeping configuration out of the overview. The saved graph, branches, editable positions, and typed connections remain the document.

**Key Characteristics:**

- Compact numbered cards with actual configuration summaries.
- Run order visible by default; detailed data connections available on demand.
- One focused settings panel or block library at a time.
- Familiar Gator pickers and explicit save, check, and enabled states.
- The same editing model on mobile, with tools in bottom sheets.

## Colors

The editor combines Gator's existing accent with paper-colored graph cards and dark working surfaces.

### Primary

- **Gator accent:** The inherited `--accent-peach` color marks the Add block action, active editor tab, and selected toolbar controls. Keep the live dashboard token rather than substituting the older fallback value found in legacy CSS.
- **Paper action ink:** The darker warm action color makes Edit block and Add next action legible on light graph cards.

### Neutral

- **Canvas:** A solid dark plane leaves the connections and block positions easy to read.
- **Paper / selected paper:** The repeated card surfaces; selection changes both the surface and its border treatment.
- **Ink / muted paper text:** Titles use strong ink, while summaries use a quieter readable tone.
- **Panel text:** Pale text belongs on the dark settings and tool surfaces.

**The Surface Pairing Rule.** Use the paper text colors on graph cards and the panel text colors on dark tools; neither text family is interchangeable across surfaces.

## Typography

Map labels and controls inherit Gator's body font through `--font-body`. The workflow does not load a separate brand typeface. Semantic headings continue to inherit the dashboard's heading treatment. Small block references retain the existing monospace stack.

The hierarchy is compact: a prominent tabular number, a bold block title, then a short summary. Numbering gives each card a stable visual place in the current map; it does not replace the connections as the explanation of execution order.

### Hierarchy

- **Map number:** Larger than the title, tightly tracked, with tabular numerals.
- **Map title:** Bold and short, identifying the actual block.
- **Map summary:** Regular text with room for message excerpts and wrapped values.
- **Controls:** Compact labels paired with icons where helpful.
- **Inspector body:** Slightly more breathing room for explanations and configuration.

Mobile inspector inputs and picker triggers use a 16px text size. Do not shrink input text to fit more settings onto a phone.

## Layout

The editor fills the viewport. Its header and Editor / History / Settings navigation remain outside the moving graph. A compact toolbar sits over the canvas; zoom and fit controls stay near the working surface.

On desktop, the map occupies the flexible column. Opening settings or the block library adds a 23rem right column. These panels are mutually exclusive. The overview cards contain a name, number, configuration summary, and direct editing affordance; the inspector owns the form fields.

At 760px and below, the inspector and library become full-width bottom sheets within the editor. They are limited to the available editor height, with a maximum of 72dvh, leaving part of the graph visible. Settings scroll within the sheet, and its footer accounts for the device safe area. The toolbar wraps and the wire legend is omitted at this width.

The surrounding workflow index uses four template columns, two below 1100px, and one below 600px. This index layout is separate from the editor plane.

**The One Focus Rule.** Open one settings panel or one block library; do not stack both over the map.

## Elevation & Depth

Depth comes primarily from the contrast between the dark plane and light cards. Cards have a shallow resting shadow. A selected card adds a warm outline and halo. The toolbar is solid and has no shadow in the current workspace. Mobile sheets cast a stronger upward shadow because they overlap the canvas.

Dragging follows pointer movement directly. Control state changes use short existing transitions; the workspace disables transitions and animation for reduced-motion preferences. Do not introduce animated layout movement that makes a newly selected field harder to reach.

## Shapes

Graph cards have a distinctive smaller upper-left corner, with the other corners more generously rounded. Reuse that silhouette for workflow blocks only. Controls retain Gator's softer small-radius vocabulary. Bottom sheets have rounded top corners and square bottom edges so they sit against the viewport boundary.

The selected block remains the same size and shape. Its surface, border, and halo communicate selection without shifting neighboring content.

## Components

### Workflow map cards

Cards show intent before configuration: the event or action label, a number, a concise summary, and Edit block. Flow connections are visible initially. Show data reveals the detailed inputs and outputs without changing the graph. Data outputs have readable labels and types, not only small connection dots.

### Focused inspector

The panel repeats the selected block's name, explains its purpose, and shows relevant validation issues above its fields. Done closes the panel. Delete block is a separate action in the footer. Closing the panel does not discard the workflow.

### Inputs and pickers

Reuse the existing `SelectField`, `ChannelPicker`, and `RolePicker` components from the dashboard. Named data choices let a user choose an earlier block's output or enter a fixed value. Message inputs support multiple lines. Read-only fields and callbacks remain disabled together.

**The Named Data Rule.** Explain a connection with the producing block and output name. A type color or a wire alone is not enough to tell the user what value they are using.

### Block library

The library has search, categories, a visible close control, and optional input/output details. Choosing a connection narrows the library to compatible blocks. Availability reflects the connected integrations and supported runtime capabilities. Keep explanatory text next to choices rather than relying on color to communicate availability.

### Navigation and state

Editor, History, and Settings use the existing tab strip with an accent underline for the active tab. Paused/enabled state and saved/unsaved feedback are separate. Check reports validation without performing the workflow's actions. Unsaved navigation offers explicit choices to keep editing, discard, or save a paused draft.

The inspector shows the current step number and the connected previous/next steps. Users can continue editing along the route or insert an action before its destination without returning to the map. The insertion library previews the two existing neighbors around a new-step placeholder and offers common compatible actions. Removing a simple linear step reconnects its neighbors; removing a branch never silently chooses a surviving path. Undo restores the complete edit.

## Do's and Don'ts

### Do:

- **Do** keep the map readable before revealing detailed data wiring.
- **Do** summarize actual configured values on the card and edit them in the focused inspector.
- **Do** use Gator's existing picker components for choices, channels, and roles.
- **Do** pair color with labels for data types, errors, and workflow state.
- **Do** preserve direct manipulation, keyboard focus, reduced-motion behavior, and mobile sheet access.

### Don't:

- **Don't** turn this component contract into a global Gator brand redesign.
- **Don't** copy a reference product's visual identity or replace the existing graph with a decorative mockup.
- **Don't** put every field and every data connection into the default overview.
- **Don't** use native select menus in place of the project's existing pickers.
- **Don't** record obsolete overridden styles or low-contrast states as intentional design rules.
