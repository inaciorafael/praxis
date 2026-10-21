# Paper smart guides

Select an element or a group and drag it. Blue dashed lines suggest matching borders
and centers; purple dimension lines show equal gaps between neighbors or the same gap
as two adjacent objects. Labels use world-space drawing units, not physical measurement.

Smart guides start enabled, with Snap off. Both controls live in the selection context
bar. Snap aligns within 6 screen pixels; Alt temporarily bypasses it. Shift keeps the
existing axis constraint and prevents snapping on the locked axis. A grouped or multiple
selection moves as one bounding box, preserving all relative offsets.

The gesture snapshots reference geometry and sorts it once at pointerdown. Only nearby
visible objects are considered; hidden layers and the moved selection are excluded.
Locked visible objects remain valid references. Rotated items use world-space bounding
boxes. Ink strokes, arrows, lines, frames and legacy web references do not attract items.

The pure smart-guides solver scans the cached rectangles, without regenerating SVG
paths, rich text or RoughJS geometry. Reference construction is O(n log n) per drag;
the solver is O(n) per move in the number of nearby reference boxes. There are no timers,
polling, network calls, dependencies or persisted geometry changes for the guides.

The SVG overlay is pointer-transparent, has constant screen-space line/font sizes,
and is tagged data-editor-only so exports omit it. Release/cancellation removes it.
Snapped movement uses the existing single history transaction and save path. Preferences
last for the current editor session.

Tests cover center/border alignment, equal/repeated spacing on both axes, unrelated
rows, zoom-scaled tolerances, axis constraints, guide-only movement, Alt, disabling,
cancellation, group offsets and drag undo/redo.
