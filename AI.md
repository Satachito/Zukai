# Zukai AI contract — `.zu` and live editing

Implementation-accurate contract for agents (Cursor, MCP, scripts) working on Zukai.

| Document | Role |
|----------|------|
| **This file (AI.md)** | AI contract, MCP / `window.ZU` operations |
| **[Web/SCHEMA.md](Web/SCHEMA.md)** | `.zu` schema detail (link `corner`, anchors, examples) |
| **[USAGE.md](USAGE.md)** | Dev server, Phase 2/3/4, MCP setup |

**Early-development policy:** no legacy field normalization or compatibility shims. Invalid JSON fails at load or validation so drift is visible.

---

## Root object (`.zu` file)

```json
{
	"model": {
		"nodes": [ … ],
		"links": [ … ]
	}
}
```

| Field | Description |
|-------|-------------|
| **`model.nodes`** | Node array (draw order ≈ z-order; later entries on top) |
| **`model.links`** | Link array |

Coordinate system: origin top-left, **Y axis downward**.

`.zu` holds diagram content only. Canvas size is derived on load from the node
bounding box (empty diagram → 4096×4096). At runtime the `<canvas>` element is
the source of truth; live MCP/API responses may include current canvas dimensions
separately from the file format.

---

## Node `[ ID, shape, paint ]`

| index | Name | Content |
|-------|------|---------|
| `0` | **`ID`** | Unique string. Links reference nodes by ID |
| `1` | **`shape`** | Geometry + label (table below) |
| `2` | **`paint`** | Canvas 2D style (optional `{}`) |

### `shape`

| Field | Required | Description |
|-------|----------|-------------|
| **`type`** | ✓ | `"rect"` \| `"ellipse"` \| `"rhombus"` \| `"SVG"` \| `"PNG"` |
| **`cX`, `cY`** | ✓ | Center (numbers). **Not** `cx`/`cy` |
| **`rH`, `rV`** | ✓ | Half-width / half-height. Size ≈ `2×|rH|` × `2×|rV|` |
| **`radii`** | — | Corner radius. **`rect` only** — silently ignored on every other type (the shape editor offers the field regardless) |
| **`html`** | — | Label HTML (live `foreignObject`, unsanitized). Export sanitizes. Field name is `html`, **not** `innerHTML` |
| **`style`** | — | Label CSS fragments (`;prop : value`, newline-separated) |
| **`SVG`** | when type=SVG | **base64** of the SVG source (decoded at draw time). Not raw `<svg>` markup |
| **`PNG`** | when type=PNG | PNG base64 |

`SVG` / `PNG` nodes are outlined as their bounding box (like `rect`) for link
attachment and hit-testing.

Geometry: `x = cX − rH`, `y = cY − rV`, `width = 2×rH`, `height = 2×rV`.

### `paint` (nodes and links)

Applied when drawing: `fill`, `stroke`, `lineWidth`, `lineCap`, `lineJoin`, `miterLimit`, `lineDash`, `lineDashOffset`. Omitted / empty keys are simply not applied (no `fill` → `none`).

`miterLimit` only has a visible effect where `lineJoin` is `miter` (the default join for node shapes; links default to `round`).

---

## Link `[ [ fromID, toID ], attributes, paint ]`

| index | Name | Content |
|-------|------|---------|
| `0` | **Endpoints** | `[ fromID, toID ]` strings |
| `1` | **`attributes`** | Arrowheads, anchors, routing (below) |
| `2` | **`paint`** | Line style |

**Do not use** legacy `[ A, B, direction, paint ]` or `direction: "<>"`.

### `attributes`

| Key | Values | Description |
|-----|--------|-------------|
| **`headF`, `headT`** | `false` / omit / style name | Arrow at from / to end. Styles: `triangle`, `open`, `hollow`, `diamond`, `diamondHollow`, `circle`, `circleHollow` |
| **`anchorF`, `anchorT`** | `T` `B` `L` `R` `TL` `TR` `BL` `BR` / omit | Attachment point. Omit = outline hit toward the other node's center |
| **`corner`** | undefined(default direct line) / `sharp` / `arc` / `curve` | Set only for orthogonal routing; see SCHEMA.md |

Routing always produces one or two bend points, so `curve` draws a quadratic
(one bend) or cubic (two) Bézier.

`Link()` overwrites the `attributes` / `paint` of an existing `[ from, to ]`
pair instead of adding a second link, so re-adding the same pair edits it.
`validate` reports duplicates if a file contains them.

---

## Authoring rules (files and agents)

1. **Prefer `rect` / `ellipse` / `rhombus`.** New base64 icons only when explicitly requested.
2. **Never rewrite existing `SVG` / `PNG` payload.** Move/resize via `cX`/`cY`/`rH`/`rV` and stable `ID` only.
3. **Keep node IDs stable.** Every link must reference existing IDs.
4. **Band layouts** (VPN, Internet, …): changing `rV` often requires updating **`cY` and nodes below** to stay flush with neighbours.
5. **`updateNode` / `updateLink`:** omitted `area` / `paint` / `ends` keep the current values. When you *do* pass `area` or `paint`, that object replaces the whole field (not a deep merge of e.g. only `fill`).

---

## Diagrams derived from source

`Samples/AWS.zu` / `GCP.zu` / `Azure.zu` / `MultiCloud.zu` each mirror a
`terraform validate`-clean configuration kept in a sibling directory
(`Samples/AWS/main.tf`, `Samples/MultiCloud/{main,gcp,aws}.tf`, …).

The two are linked only by convention: a node representing a resource uses its
**Terraform address as the node ID** (e.g. `aws_s3_bucket.assets`,
`google_cloud_run_v2_service.portal_api`); nodes with ordinary IDs are diagram
decoration. Supporting resources (subnets, listeners, IAM, …) exist in the HCL
without being drawn.

Nothing is stored in the `.zu` about the source and nothing keeps them in sync —
when you change one, update the other in the same edit.

---

## Validation (`validateModel` / `zu_validate`)

Same rules in `Web/ai-api.js` and `tools/zu-validate.mjs`:

- Node: `[ ID, shape, paint? ]`, non-empty unique `ID`, `type` set, finite `cX`/`cY`/`rH`/`rV`, width and height > 5px
- Link: `[ [ from, to ], attrs?, paint? ]`, endpoints exist, no self-links or duplicate pairs

---

## Programmatic API

### Browser — `window.ZU` (`Web/ai-api.js`)

Via `Application.js`: **one `apply([...])` call = one undo step**. If any op fails, the whole batch is rolled back (no partial apply). Individual ops called alone (e.g. `ZU.addNode`) remain one undo step each.

```js
ZU.getModel()           // clone of { nodes, links }
ZU.validate(model?)     // array of issue strings (empty = OK)
ZU.apply([ { op: '…', … }, … ])
ZU.autoLayout({ algorithm: 'grid', cols, gap, startX, startY })
ZU.setModel({ nodes, links })
ZU.canvasSize()         // [ width, height ]
ZU.draw()               // force a redraw
```

Every op is also exposed directly (`ZU.addNode({ … })`, `ZU.removeLink({ … })`, …).

**`apply` ops:**

| op | Main arguments |
|----|----------------|
| `addNode` | `id`, `area`, `paint?` |
| `updateNode` | `id`, `area?`, `paint?`, `newId?` — omit `area`/`paint` to keep current |
| `removeNode` | `id` |
| `restack` | `id`, `toFront?` |
| `addLink` | `from`, `to`, `ends?`, `paint?` |
| `updateLink` | `from`, `to`, `newFrom?`, `newTo?`, `ends?`, `paint?` — omit `ends`/`paint` to keep current |
| `removeLink` | `from`, `to` |
| `autoLayout` | grid options |
| `setCanvas` | `width`, `height` |

`area` = **`shape`** object above. `ends` = link **`attributes`**.

### MCP — `zukai` server (`tools/zu-mcp.mjs`)

| Tool | Purpose |
|------|---------|
| `zu_status` | Browser connection, `watchPath` |
| `zu_get_model` | Live `{ model, canvas: { width, height } }` |
| `zu_apply` | `{ ops: [ … ] }` — same ops as above |
| `zu_validate` | Validation |
| `zu_auto_layout` | Grid layout |
| `zu_load_file` / `zu_save_file` | Load into browser / save to disk (path under `Web/`) |
| `zu_read_file` | Read from disk (no browser) |

**Requires:** `npm run dev`, open browser tab, **`zukai` MCP enabled**. See [USAGE.md](USAGE.md).

### HTTP bridge (Phase 3)

Provided by `tools/zu-server.mjs`:

- `GET /__zu/status`
- `GET /__zu/model`
- `POST /__zu/rpc` — e.g. `{ "method": "apply", "params": { "ops": […] } }`

---

## Which path to use

| Goal | Path |
|------|------|
| Save `.zu` → browser updates | Phase 2 — `?zu=Samples/….zu` + file save |
| Change live diagram from chat | Phase 4 — MCP `zu_apply` |
| Script / curl | Phase 3 — `/__zu/rpc` |
| GitHub Pages only | Hand-edit `.zu` + **↑** upload |

Phase 4 changes stay **in memory** until `zu_save_file`.

---

## Related code

| File | Role |
|------|------|
| `Web/Application.js` | `Load`, `Node`, `EditNode`, `Link`, `SetModel`, undo |
| `Web/ai-api.js` | `window.ZU`, `validateModel`, `apply` |
| `Web/GeoZU.js` | Link routing, arrowheads, frame offsets |
| `Web/main-editor.js` | Drawing, context menus |
| `Web/ForeignLabel.js` | `html` labels |
| `tools/zu-server.mjs` | Static serve + live reload + RPC |
| `tools/zu-mcp.mjs` | Cursor MCP |
| `tools/zu-validate.mjs` | File / MCP validation |

---

## Obsolete (do not use)

Not supported by the current implementation — fix files manually if present:

- Root `{ nodes, links }` only (no `model` wrapper) — load expects `{ model }`
- Coordinates `cx`/`cy`, `innerHTML`, `div` node type
- Links `[ A, B, direction, paint ]`, `direction: "<>"` / `"<"` / `">"`
- `PATH` node type, `yellow` paint key (unused in drawing)
