# Hold to shape

While drawing with a writing instrument, keep the pointer pressed and still for 650 ms
at the end of a recognizable stroke. Lines, ellipses/circles, rectangles (including
rotated rectangles) and approximately isosceles triangles become native editable elements.
The existing color, material, opacity, width and layer are retained. Shapes start transparent.

The top context bar exposes Hold to shape, enabled for the current editor session.
It can be disabled when handwriting. Releasing before the hold keeps the original stroke.
Moving more than 8 screen pixels after the preview restores the exact freehand element;
Escape/pointer cancellation discards the whole gesture. Conversion and creation share one
history transaction and the existing autosave contract.

Recognition is pure local geometry with no dependency, network call or polling.
Only one timeout exists for an active drawing gesture. Sub-3-pixel jitter does not reset it.
It is cleared on release, cancellation and unmount. Recognition samples at most 257 points
and rejects small screen-space gestures, unclosed loops and low-confidence candidates.
It is not handwriting recognition, arbitrary polygon recognition or an image classifier.
Ambiguous marks remain freehand.

Validation covers shape families, rotated rectangles, noisy ellipses, negative line
coordinates, arcs/scribbles/writing rejection, zoom, large inputs, hold/release timing,
continued drawing, disabling, cancellation and a single undo/redo transaction.
