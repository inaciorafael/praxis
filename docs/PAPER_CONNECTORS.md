# Paper connectors

Arrows support straight (the legacy default), elbow and cubic curve routes.
Choose the path in the top context bar before drawing or after selecting a single arrow.
A selected arrow exposes a connection label (up to 80 characters); Enter or blur commits it.
Double-clicking an arrow focuses the same label field.

Connected shapes retain exact edge anchors and recalculate when moved, resized or rotated.
Elbow/curve port orientation is derived from shape centers and carried with the transient endpoints,
so large shapes cannot flip the path axis after clipping to their edges.
Routes are automatic between the two endpoints. They do not route around unrelated obstacles
or provide draggable intermediate bends in this version.

connector-path.ts supplies the route used by RoughJS, the transparent hit area,
freehand selection and fitting/export bounds. The cubic is drawn exactly; region selection
uses a bounded 25-point projection. Labels use explicit light/dark paper colors and remain
horizontal, centered on the route. They are included in exports and library thumbnails.

The optional TypeScript connectorStyle corresponds to a defaulted Rust enum.
Missing fields deserialize as straight, without migrating or writing existing Papers during reads.
The existing element text field stores the label. Changes use the existing history transaction
and autosave path; camera operations do not alter the geometry.

Validation covers quadrant/zero-length geometry, port orientation, shape movement,
label export bounds, component undo/redo and Rust legacy/serialization contracts.
