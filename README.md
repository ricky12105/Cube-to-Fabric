# Cube-to-Fabric architecture options

A working-session pack for migrating a large SSAS cube to a Microsoft Fabric
semantic model while keeping Snowflake on AWS as the system of record.

The design prioritizes staying on F64: serve the complete required history at a
summarized grain, with policy-level detail available on demand. Scaling is the
last resort. This workspace contains architecture deliverables, **not a
deployable application or an implemented migration**.

## Start here

Browse the [published GitHub Pages site](https://ricky12105.github.io/Cube-to-Fabric/).

| Deliverable | What it contains |
|---|---|
| [Diagram gallery](architecture-options/diagrams.html) | Browser-friendly architecture diagrams in presentation order, including semantic-model insets and the decision path. |
| [Editable Excalidraw board](architecture-options/all-options.excalidraw) | All six frames together for editing and presenting. |
| [One-page comparison PDF](architecture-options/comparison.pdf) | A3 landscape comparison, recommendation, public list prices, acceptance criteria and open questions. |
| [Comparison HTML](architecture-options/comparison.html) | Browser version of the comparison, with print styling. |
| [Evidence and test plan](architecture-options/evidence-and-test-plan.md) | Microsoft Learn citations, verified limits, grain calculations, relationship and Excel considerations, ingestion alternatives, assumptions and a proposed one-week validation plan. |
| [Public list-price records](architecture-options/public-list-prices.json) | Azure MCP public retail-price fields and derived F64/F128/F256 costs for East US and South Central US. |

## Architecture options

The gallery presents **1a, 1b, current state, 2, 3, then the decision path**.
Both Option 1 diagrams include an inset showing the facts, shared dimensions,
storage modes and relationship boundaries.

| Option | Purpose | Editable diagram | Preview |
|---|---|---|---|
| **1a - Lead** | Direct Lake summaries on F64, Import dimensions and DirectQuery policy detail in Snowflake; avoids another persisted detail estate. | [Excalidraw](architecture-options/01a-f64-snowflake-detail.excalidraw) | [SVG](architecture-options/01a-f64-snowflake-detail.svg) |
| **1b - Variant** | The same summary model, but detail is copied to OneLake and queried through its SQL analytics endpoint. | [Excalidraw](architecture-options/01b-f64-onelake-detail.excalidraw) | [SVG](architecture-options/01b-f64-onelake-detail.svg) |
| **0 - Current state** | Reported pipeline-copy and full-detail Direct Lake design, highlighting ingestion reliability and row-limit concerns. | [Excalidraw](architecture-options/00-current-state.excalidraw) | [SVG](architecture-options/00-current-state.svg) |
| **2 - F64 alternative** | Import aggregation tables over DirectQuery detail, with Dual dimensions and automatic aggregation routing. | [Excalidraw](architecture-options/02-f64-import-aggregations.excalidraw) | [SVG](architecture-options/02-f64-import-aggregations.svg) |
| **3 - Last resort** | A larger capacity for the unchanged policy-grain Direct Lake fact, considered only after the F64 model-change options fail their tests. | [Excalidraw](architecture-options/03-scale-fallback.excalidraw) | [SVG](architecture-options/03-scale-fallback.svg) |
| **Decision path** | The gates for testing Option 1, then Option 2, before considering Option 3. | [Excalidraw](architecture-options/04-decision-path.excalidraw) | [SVG](architecture-options/04-decision-path.svg) |

## Recommendation and validation

Start by testing **Option 1a**, not by increasing capacity. Its feasibility still
depends on the required summary grain, limited relationships to DirectQuery
detail, Excel compatibility, memory, concurrency and refresh performance.
Option 2 is the alternative when transparent routing is more important and its
memory, refresh and security requirements can be met.

The [evidence appendix](architecture-options/evidence-and-test-plan.md) explains
the trade-offs, including the SSO restriction on Import aggregations and why
F128 does not cover a 4-billion-row Direct Lake table.

## Viewing and editing

- Open the HTML files directly in a browser; no package installation, build or
  local server is required. On narrow screens, scroll individual diagrams
  horizontally or use their full-size SVG links.
- Open the PDF for the single-page comparison, or print the comparison HTML
  using its A3 landscape layout. Printing the diagram gallery uses one complete
  diagram per A3 landscape page.
- Open the combined board or an individual `.excalidraw` file in an approved
  Excalidraw editor. SVG files provide browser-friendly previews.
- The editable diagrams, SVG previews, comparison HTML and PDF are separate
  saved artifacts. Regenerate diagram formats together using the renderer
  below. Changes to the comparison HTML still require a separate PDF export.

### Regenerating and checking diagrams

The [diagram renderer](scripts/render-diagrams.cjs) contains the six diagram
definitions and uses Node.js built-ins only; no package installation is needed.
It generates the individual SVG/Excalidraw files, combined board and gallery.
For repeatable published updates, change those definitions; regeneration
overwrites manual changes to the exported SVG and Excalidraw files.

```powershell
node .\scripts\render-diagrams.cjs
node .\scripts\render-diagrams.cjs --check
```

The check verifies lane alignment, native shape bindings and endpoint gaps,
connector/node crossings and generated-file consistency. Also inspect every SVG
in a browser after editing text, because font metrics and text/connector
overlaps need rendered checks. The decision path uses decision-stage headings,
not the source/landing/storage lanes of the architecture options.

## GitHub Pages

The [site entry point](index.html) redirects to the diagram gallery. The
[`.nojekyll` marker](.nojekyll) allows GitHub Pages to serve the files as a
static site without Jekyll processing.

**The repository and site are public.** The published address is
<https://ricky12105.github.io/Cube-to-Fabric/>.

GitHub Pages is configured under **Settings > Pages > Deploy from a branch**,
using **main** and **/ (root)**. Subsequent pushes to `main` publish site updates;
allow the Pages build and deployment to finish before checking changes.

All committed files are publicly accessible. Do not add customer data,
credentials or confidential working notes.

## Evidence, assumptions and scope

- Product evidence and public pricing were checked on **12 November 2026**.
  Recheck limits, feature availability and prices before reusing the pack.
- Prices are **USD public list prices**, not negotiated quotes or total costs.
  Monthly PAYG calculations assume 730 hours; reservation monthly equivalents
  are comparison calculations, not a payment schedule.
- Current capacity, Direct Lake type/fallback, complete 15-year coverage, the
  meaning of the 4-billion-row projection, required grain and Excel usage remain
  unconfirmed. Illustrative row counts and performance targets are not measured
  customer results.
- No customer tenant or data was inspected, and no Azure or Fabric resources
  were changed. The test plan is proposed, not executed.
- Any assistant-led hands-on proof requires explicit approval and must use the
  user's own sandbox with synthetic data.
- Excalidraw MCP tools were unavailable during creation; the diagrams were
  generated locally as native editable files and SVG previews.
