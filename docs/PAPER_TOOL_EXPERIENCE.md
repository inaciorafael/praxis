# Paper tool experience

The docked rail remains the entry point. The top context bar is the common place
for quick settings before creation and after selecting an element. Controls are
shown by capability, not just by the active toolbar button:

| Tool / selection | Quick settings |
| --- | --- |
| Select, lasso, camera | Gesture guidance; properties after selection |
| Pencil, graphite, pen, fountain pen, ink | Instrument, ink presets, custom ink, width, opacity |
| Line and arrow | Ink, width, stroke material, opacity |
| Rectangle, ellipse, triangle, hexagon, frame | Stroke settings, fill color, transparent fill, fill pattern, opacity |
| Text | Font, four size presets, custom size, alignment, text color, background shape, opacity |
| Note | Text, stroke and fill settings |
| Shape with text | Shape properties plus typography and vertical alignment |
| Image | Opacity and selection actions |
| Legacy web reference | Static placeholder only; may be selected or removed |
| Eraser | Three sizes and explanation of stroke erasing |

More settings opens below the measured context-bar height, on the same side for
tools and elements. The existing rich-text mini menu takes over while typing,
including notation controls. There is no competing context bar during editing.

Selecting a new tool clears the old element selection, closes transient panels
and retains creation defaults. Font size and text color configured before drawing
are applied to the new rich-text document. Color pickers commit on change rather
than every input event. Transparent fill uses the explicit `transparent` value;
`null` retains the existing restore-default contract. Frames no longer enter text
editing automatically after drawing.

Layer settings follow the progressive disclosure described in the
[Concepts layers manual](https://concepts.app/en/manual/layers): a short list,
visibility beside each layer, and actions only after tapping the active layer or
its options button. Rename, lock, ordering, safe empty-layer removal and opacity
remain available. Escape, changing layers and outside input dismiss options.
The panel fits its contents up to a bounded scrolling height.

Opening a rail menu dismisses layers and settings. Opening layers dismisses
settings. Changing tools or starting a canvas gesture dismisses both. The compact
layer launcher remains docked above undo/redo.

Regression coverage includes a tool-by-tool context matrix, creation and history
for every geometric tool and all five writing instruments, stale-selection
clearing, text creation defaults, transparent fill with undo, legacy reference
removal with undo, and layer options, naming, locking, visibility and ordering.

Web embedding was discontinued. Insert contains images and frames only. Legacy
`iframe` records remain accepted by the data contract to avoid breaking existing
Papers; they render a static reference and never load remote content. The live
frame component, URL dialog, URL editing and insertion tools were removed.


## Context ribbon review — October 2026

The existing lateral atelier remains docked. A compact heading offers the tool
name, Keep tool and auxiliary settings. The row beneath uses the same controls
before creation and after selection, divided into Drawing, Fill, Text and Arrange.
Only applicable groups appear; changing tools or selection chooses its first
applicable group. This avoids a tall toolbar containing unrelated controls.

Drawing includes five visible thickness samples and the exact width selector.
Fill has a small color palette, a custom color, transparent fill and the existing
patterns. Hatch parameters appear only with an active, nontransparent fill.
Text retains the four font size presets, custom size and alignments. Arrange
collects grouping, library, rotation, duplicate and delete operations.
The rich editor still owns formatting while text is being edited.

Each of the five writing instruments remembers explicitly chosen ink, thickness
and opacity during the mounted Paper session. Selecting an existing item does
not overwrite those saved instrument preferences. No extra persistence or driver
settings were introduced.

Rail menus open beside their invoking group, close on choosing, Escape, tool
changes or outside input, and Escape restores focus to their trigger.
Outside dismissal for rail menus and layer options runs in capture phase so
other controls cannot accidentally keep those panels open by stopping bubbling.

Reference: Microsoft OneNote's Draw tab groups selection, ink, erasing and shapes,
with color/size settings close to the writing instrument:
https://support.microsoft.com/en-us/onenote/onenote-help-and-learning/learn-more-about-drawing-tools
https://techcommunity.microsoft.com/blog/microsoft365insiderblog/new-draw-tab-and-ink-tools-in-onenote-on-windows/4215558/


## Favorite pens and navigation

The writing shelf saves up to six unique instrument/color/width/opacity combinations.
Favorites are device preferences in AppConfig, shared by Papers, without document content.
Saving/removal uses the app service/store boundary; failed writes preserve the previous list.
The minimap uses lightweight element silhouettes and a viewport outline, with click and arrow-key navigation.
Navigation records the previous camera for an explicit return; it never enters content undo/redo or vault autosave.
