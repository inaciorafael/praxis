# Personal library

Select elements and choose Save to library in the top context bar, or open Library
in the left rail. Give the selection a name inside the docked panel. The library
supports search, on-demand previews, rename, insertion and explicit removal.

Items live in optional paperLibrary inside the encrypted vault, shared across its
Papers. Names and drawings are never written to localStorage or machine settings.
Opening legacy vaults does not migrate or write them. Library mutations use the
existing vault mutation, conflict detection and safety-copy boundary. Revisions
protect rename/removal; add IDs make identical retries idempotent.

Each item stores a detached snapshot. External arrow anchors are flattened to their
visible endpoints; internal links remain. Task cards become independent notes and
never create task links. Insertion assigns fresh element/group IDs and the active
layer, centers the copy in the viewport, and records one normal board undo action.
All inserted elements are grouped together and can be ungrouped for editing.

List commands return names/counts/revisions; geometry loads only for the selected
preview or insertion. Limits: 100 items, 500 elements and 2 MiB per item, 20 MiB total.
The existing board validator checks geometry, ink, images, text and internal links.
Removing a library entry never removes copies already inserted in Papers.

Tool review: common selection actions, grouping, arrangement, rotation, auto text
width, stroke patterns and hatch angle/gap are available in the top bar. Empty
shapes expose text controls. Advanced panels share a docked inspector treatment,
close when drawing starts or tools change, and are mutually exclusive with the library.
Recognized straight lines no longer acquire a fill rejected by the backend.

Validation: pure copy/remapping tests, component loading/error/lock tests, Canvas
insertion undo/redo and direct border editing, Rust idempotency/revisions/no-op reads,
and rejection without changing the original document.
