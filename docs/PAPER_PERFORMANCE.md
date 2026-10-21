# Paper performance

## Measured comparison

The opt-in benchmark mounts the real BoardCanvas with 200 synthetic elements:
60 hatched shapes, 70 strokes (10,500 points), 40 rich-text elements and 30 anchored
arrows. It processes eight pointer moves followed by eight camera moves, and
stores 40 history entries. No user documents are loaded.

| CPU work / operation | Before | After |
| --- | ---: | ---: |
| Eight drag updates | 1,581 ms | 558 ms |
| RoughJS calls during drag | 417 | 8 |
| Rich-text layout calls during drag | 40 | 0 |
| Eight camera updates | 527 ms | 45 ms |
| RoughJS calls during camera movement | 0 | 0 |
| Forty history pushes | 146 ms | 132 ms |
| History size calculations | 820 | 40 |

Raw results: [before](../tests/perf/paper-before.json) and
[after](../tests/perf/paper-after.json). These are single-run CPU measurements in
Vitest/jsdom on this machine, not GPU rendering or desktop FPS measurements.
Wall-clock timings vary; operation counts are the stronger regression signal.
History calculation counts improved substantially, while its elapsed-time change
is small enough that it should not be treated as a proven latency gain.

## Changes and limits

- Movement retains live element identities and updates only selected positions
  from the gesture's original coordinates. Undo/cancel still use isolated snapshots.
- BoardSceneContent isolates SVG content from camera and toolbar updates. Camera
  panning changes its parent transform without rebuilding the content tree.
- RoughJS receives local visual geometry. Moving, rotating, changing opacity or
  editing a label does not regenerate a shape's ink. Geometry, ink, fill and
  material changes continue to invalidate the paths.
- Handwriting hit paths use local coordinates in a separate computed component.
  Camera and element translations do not rebuild long point strings. Zoom still
  updates hit-target width.
- Anchored arrows use a scene-local ID map rather than repeated linear searches.
  Unchanged endpoint tuples retain their identities, so only changed arrows need
  new paths. Exact coordinate comparison preserves small edits.
- Group rotation/resizing copies only affected members, retaining the complete
  source scene for anchored connector geometry.
- History entries store their measured byte size. Push/undo/redo retain the same
  entry and byte limits, eviction order, copy isolation and redo invalidation.
- Camera gestures do not eagerly deep-copy the whole board. Vector writing does
  not perform legacy raster-brush viewport tests.

Additional retained memory is bounded by the current scene's ID index, arrow
endpoint tuples and one byte-count number per history entry. These are discarded
with the editor/history. There are no global path caches, added dependencies,
animation loops, workers, or changes to persisted document formats.

All elements remain in the SVG, including offscreen content; export, presentation,
selection, layers and search do not depend on a culled scene. No handwriting points
or pressure samples are discarded. Large DOMs can still consume browser painting
time; this work reduces redundant CPU work rather than replacing SVG rendering.

## Re-run

```powershell
$env:VITE_PAPER_PERF='1'
$env:VITE_PAPER_PERF_LABEL='after'
rtk npm run test:unit -- tests/perf/paper.perf.test.ts
```

The benchmark is skipped during the normal regression suite. It contains no timing
thresholds and writes only its synthetic measurement JSON. Functional regressions
cover path equivalence, transforms, indexed attachment geometry, history budgets,
offscreen content, pan/zoom, drawing, rich text, grouping, locking and presentation.
