# Paper editor — Ateliê lateral

This design system applies only inside `.board-editor`. The app shell and Paper library retain their existing design.

- `paper-editor.css` defines `--pe-*` tokens using the app's current theme: opaque surface, ink, muted text, border, hover and selected states; 8px control radius, 12px popover radius, 112px tool rail (72px in narrow windows). The header, tool rail and context bar dock flush to the editor edges, without floating-panel gutters, rounded outer corners or shadows.
- `PaperToolRail` keeps selection, pan, pen, pencil, eraser, arrow, text and notes at stable positions. Shape and insertion menus open beside the rail and dismiss on selection, outside pointer input, tool change or Escape. Menus do not shift the rail.
- `PaperContextBar` exposes the active writing instrument, school pen colors and quick widths. A text selection shows font, the existing 14/22/36/48 presets, numeric sizing, alignment and text color. Fill controls are available only when the selection/tool supports them.
- Materials are grouped as pencil/graphite and pen/fountain/ink. Choosing another material for an explicitly selected stroke edits that stroke; otherwise it sets the next drawing tool. Existing undo boundaries remain in BoardCanvas.
- More settings opens the existing detailed tool or selection controls. Layer controls have a fixed left-side launcher and open without moving the tool rail. Layer and style panels are mutually exclusive.
- Whole Paper lock stays in the studio header; it does not mean sticky-tool mode. Presentation and distraction-free mode hide editor controls. Drawing continues to ignore selection resize/rotation handles.
- Tool targets are 40px high for a mouse and at least 44px for coarse pointers. Names remain visible; shortcuts appear in tooltips and remain available from the keyboard. Canvas fit reserves only the space needed for the docked rail and context bar without changing persisted element coordinates.

The canvas rendering, local persistence, grouping, layer ordering, RoughJS shapes, rich text, Rough Notation and presentation model are unchanged by the layout.
