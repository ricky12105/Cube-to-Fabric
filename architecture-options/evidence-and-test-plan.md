# F64-first semantic model architecture: evidence and working-session appendix

**Checked:** 12 November 2026. **Scope:** public product documentation and public list prices only. No customer tenant, data, workbooks, capacities, or resources were inspected. No Azure/Fabric resources were created or changed. All hands-on work below is proposed, not executed.

Start with the [diagram gallery](diagrams.html), [editable Excalidraw board](all-options.excalidraw), and [one-page landscape comparison](comparison.html). The Excalidraw MCP was not exposed by tool discovery in this session; native editable Excalidraw files and local SVG renderings are supplied instead. The board contains six frames, in the requested production order: 1a, 1b, current, 2, 3, decision path. Both Option 1 frames include a semantic-model inset.

## Recommendation

**Lead with Option 1a on the existing F64, subject to confirmation of its assignment and the tests below.** Preserve Snowflake as the policy-detail system of record. Publish narrow, conformed summaries covering the complete required history to OneLake; query them using Direct Lake **on OneLake**. Use small **Import dimensions**, and a separate **DirectQuery policy fact in Snowflake**. This changes grain instead of buying around the full-detail row limit and avoids a second persisted detail estate.

This is a feasibility recommendation, **not confirmation that an unmeasured model fits F64**. DirectQuery bypasses the Direct Lake table row guard, but not query memory, intermediate-result, source-compute, network, concurrency, or Fabric CU constraints. Monthly summaries are the leading candidate; use daily summaries only if confirmed analysis requires them.

**Option 1b** is the same semantic design with detail copied into OneLake and queried explicitly through its SQL analytics endpoint. It avoids cross-cloud SQL execution but keeps duplication and copy reliability concerns, and moves SQL detail compute onto F64. Prefer it only if measured latency, connectivity, or governance justifies that trade-off.

**Option 2** keeps F64 and can provide a more cube-like summary/detail experience: Import aggregation tables over DirectQuery detail with same-source Dual dimensions and engine-managed aggregation rewrites. Prefer it if transparent routing materially improves Excel usability and its memory, refresh, aggregation-hit, and security tests pass. Import aggregation tables are **ignored for SSO-enabled sources**; mandated source SSO can disqualify this option without a separately approved identity/security design. [S4]

**Option 3 is last resort, not an equal starting choice.** A 4B-row Direct Lake fact needs at least F256 by the documented row guard; F128 stops at 3B. Scaling does not supply the modelling guidance requested, cure copy stalls, or restore unsupported Excel MDX features. [S1]

## 1. Reverification of the eight product facts

| # | Learn result | Design consequence |
|---|---|---|
| 1 | **Confirmed:** F64 1,500M rows/table; F128 3,000M; F256 6,000M. [S1] | A full 4B Direct Lake table cannot run on F64 or F128. These are Direct Lake table guards, not a 1.5B limit on a DirectQuery source. |
| 2 | **Confirmed, with lifecycle detail:** over guardrails, OneLake refresh fails and the model cannot be queried until compliant; SQL refresh succeeds with warning and queries fall back to DirectQuery **if enabled**. [S1, S2] | Confirm the current type and fallback setting before interpreting the error. Explicit DQ detail in Option 1 is not automatic SQL fallback. |
| 3 | **Confirmed with caveat:** F64 permits 5,000 Parquet files **and 5,000 row groups** per table. Reported 158 files is below the file guard, but says nothing definitive about row groups. [S1] | OPTIMIZE/VACUUM can improve file/group layout and query performance; neither reduces actual business rows to solve a true total-row excess. A generic guardrail troubleshooting suggestion to optimize is not a row-limit remedy. [S2, S8] |
| 4 | **Confirmed:** user-defined aggregations: **No** for both Direct Lake types. Import aggregates on DirectQuery detail are supported. [S1, S4] | DL summaries need explicit measure/table selection; no claim that Manage aggregations will automatically route a DL aggregate to DQ detail. |
| 5 | **Confirmed:** Direct Lake + DirectQuery in one model requires **Direct Lake on OneLake**, combined with XMLA tools. DL + Import can be combined in web modeling. All three are supported by the OneLake composite capabilities. [S1, S3, S5, S6] | Assemble Option 1 through XMLA-compatible tooling. Web modeling can edit semantic metadata of DL+DQ composites but does not offer refresh/table-change options for that combination. Plan XMLA processing and supported credential/connection operations explicitly. |
| 6 | **Confirmed:** a non-materialized SQL view is not a Direct Lake on OneLake table source; DL on SQL queries to a view fall back to DQ. MLV results persist as ordinary Delta tables. [S1, S5, S9] | Use physical summary Delta tables, not a SQL `GROUP BY` view masquerading as DL storage. Spark-written Delta is the baseline; optional MLV availability is discussed separately below. |
| 7 | **Confirmed, wording matters:** F64 max memory is 25 GB/model. In DL, this is the upper amount of data paged in, not a requirement to keep all OneLake data resident and not the row guard. Paging churn can slow queries. [S1, S7] | Reducing 150 columns and high-cardinality attributes helps memory and transcoding, not rows/table. The 105 GB compressed Delta footprint does not establish a VertiPaq model size. |
| 8 | **Confirmed with an important improvement:** session-scoped MDX statements are unsupported; query-scoped `WITH` is supported. DL-table user-defined hierarchies are unsupported; **Import-table hierarchies are supported even with DL tables present**. [S1] | Put user-facing hierarchies on Import dimensions, but still test actual Excel workbooks. Do not promise like-for-like SSAS behavior. |

No fetched Learn page reversed the eight principal facts. Important qualifications are the separate row-group guard, the DL memory paging interpretation, supported Import hierarchies, and the SSO restriction on Option 2. A separate availability update matters: **core materialized lake views are explicitly GA in the September 2026 Learn release notes**, while specific authoring/refresh subfeatures remain preview. [S24]

## 2. Option 1 design in depth

### Grain and row-count arithmetic

**Illustrative cardinalities, not customer observations:** 50 state groups x 20 product groups x 10 coverage groups x 4 channels x 5 business segments = **200,000 combinations per time period**. These are placeholders for business-approved dimensions, not a proposed mandate to remove needed attributes. Policy ID, transaction ID, address, and other near-row-unique attributes stay off the summary.

Assume all combinations are populated in every period. This is a conservative full-Cartesian count **under those assumed cardinalities**; SCD versions, extra dimensions, multiple valuation bases, or a finer true grain can invalidate it. Measure the actual grouped cardinality before committing.

| Candidate | Arithmetic for 15 years | Rows | F64 headroom to 1.5B | Assessment |
|---|---|---:|---:|---|
| Annual | 15 x 200,000 | 3,000,000 | 1,497M / 99.8% | Fits easily, but may be too coarse. |
| Monthly, lead | (15 x 12) x 200,000 | **36,000,000** | **1,464M / 97.6%** | Strong margin; 2x combinations gives 72M, still 95.2% margin. |
| Daily | ceil(15 x 365.25) x 200,000 = 5,479 x 200,000 | **1,095,800,000** | **404.2M / 26.95%** | Fits the row guard only; about 36.9% combination growth reaches the cap. A 20% increase yields 1,314.96M and fails the proposed 20% spare-row target. |

Use the exact calendar for the retained date range; 5,479 days is an arithmetic approximation. A proposed planning ceiling of **1.2B rows per DL table** reserves 20% of the F64 row guard. At 180 months that permits 6.667M combinations/month; at 5,479 days, about 219,018/day. These are engineering targets, **not additional product limits**.

The monthly example is 41.7x below the row guard, but does **not** establish enough memory or CPU headroom. It is the same 36M summary estimate whether the policy fact has 1.5B or 4B rows, **only if history span, grouped dimensions and occupancy remain as assumed**.

Store additive components such as earned premium and incurred loss at a clearly agreed accounting/valuation basis; calculate ratios from their sums. Do not sum monthly or coverage-level distinct policy counts across periods/coverage. Exact distinct counts, balances, snapshots, effective-dated measures, and other nonadditive cube calculations need a correct grain-specific design or DQ measures; measure the proportion of important queries that consequently reach detail.

### Shared dimensions and relationship behavior

Use conformed **Month**, State, Product, Coverage, Channel and Segment keys, with one unique row on the dimension side and single-direction 1:* filtering to each fact. For a monthly summary, the policy fact also needs the same MonthKey. Keep policy-only attributes and a policy-event Date dimension separate from the shared monthly hierarchy. A daily summary instead shares a proper Date dimension with detail.

- **Import dimension -> DL summary:** regular 1:* relationship. Current Learn explicitly says Import and DL tables share a source group, and DL+Import composites support regular relationships. [S3, S6]
- **Import dimension -> DQ policy fact:** limited, cross-source-group relationship. Setting cardinality to 1:* does not make it regular. A Snowflake DQ fact is remote; so is a DQ fact queried through a OneLake SQL endpoint. Sharing physical lake files with a DL table does **not** eliminate the storage-engine/source-group boundary. [S3]
- **DL dimensions instead:** regular to the DL summary, but still limited to DQ detail. They avoid a separate Import refresh and can page columns; they do not recover Excel hierarchies defined on DL tables. For small business dimensions, Import is therefore the better lead choice, provided measured cache size and daily refresh are small. [S1, S3, S6]
- Limited joins can need filter-value lists/multiple source queries and become expensive as key cardinality grows. Learn recommends special attention as cardinality increases; use low-cardinality integer keys, inspect native queries, and test high-cardinality policy filters explicitly. They are **not guaranteed slow**, but cannot be treated as free joins. [S3]
- Limited relationships use query-time joins, lack the same blank-row/table-expansion behavior as regular relationships, and have RLS/RELATED restrictions. Validate unmatched keys and security rather than simply copying the old cube relationships. [S14]

Do not relate the facts directly or introduce bidirectional filters as a shortcut. Keep high-cardinality PolicyKey off summary relationship paths. If limited joins make the required investigative UX fail, test Option 2's same-source Dual pattern, or a separately scoped detail experience, before buying capacity.

### Explicit routing and Excel

Provide clearly named, explicitly authored **Summary Earned Premium**, **Summary Incurred Loss**, **Summary Loss Ratio**, and **Policy Detail ...** measures. Summary measures reference only the aggregate table; policy measures reference only the DQ fact. Hide raw fact columns and discourage implicit measures.

In Power BI, a dedicated policy-investigation/drillthrough page passes approved shared-dimension filters, then requires a selective policy/date context before displaying detail. In Excel, the same pivot field list exposes the named summary measures. Users open a separate **policy pivot/workbook tab** and select policy measures with selective filters; a Power BI report drillthrough button is not a native Excel pivot interaction. Excel double-click/Show Details and detail-row expressions are a **compatibility test**, not a promised replacement for the SSAS action.

If a daily or Policy ID field is used with a monthly summary measure, don't silently repeat the monthly value for every detail member. Hide incompatible fields in the summary experience and define explicit unsupported-context behavior, with a visible status measure/message and a blank summary value. Include filters, not just row-axis scope, in these tests. A manually authored context-switching measure is possible, but is custom logic with correctness obligations, **not** user-defined aggregation routing.

Import dimension hierarchies improve browsing, but models containing DL still do not support session-scoped MDX named sets/calculated members/default members. Test existing MDX, custom sets, subtotals, slicers, grand totals, hierarchy expansion, show-details, RLS and workbook refresh with the actual supported Excel build. [S1]

### Load, consistency and copies

**1a preferred:** dbt produces the approved source aggregate and stable dimension snapshot; a small daily publication copies changed summary periods/dimensions to OneLake. Commit complete Delta outputs, refresh Import dimensions, then reframe DL through the supported processing path. No full-detail Fabric copy is necessary. A pipeline can still carry the small publication; this **reduces exposure**, it does not claim to fix a broken pipeline. Use idempotent runs, explicit failure notification, a run manifest, reconciliation and a published data-as-of watermark.

Snowflake DQ sees live source state unless constrained. Freeze detail to the summary's approved batch/as-of boundary, or label/accept a documented freshness difference. Do not assume the semantic model can atomically snapshot two different engines. Late-arriving changes and historical corrections must republish affected periods, not just append today's rows.

**1b:** copy detail -> verify completion and SQL endpoint visibility -> build summary Delta tables using scheduled Spark SQL -> validate totals/dimensions -> refresh/reframe. An MLV is optional; do not assume all `GROUP BY`/aggregate changes incrementally refresh. Validate the chosen SQL, CDF prerequisites, refresh strategy and preview subfeatures before substituting it. Detail queries use the SQL endpoint in **DirectQuery mode**, not DL SQL fallback.

**Persisted logical estates, excluding HA/backups:** 1a has one detail estate in Snowflake plus a Snowflake/dbt summary if materialized, a OneLake summary, and an Import dimension cache. 1b has **two detail estates**, Snowflake and OneLake, plus summaries and dimension cache. DL also uses transient in-memory pages. The term "no second detail estate" does not mean zero duplicate data or zero cache.

### The F64 feasibility envelope

1. **Rows:** check every DL aggregate/dimension against 1.5B and 5,000 files/row groups. The DQ fact may contain 4B at its source without becoming a 4B DL table. [S1]
2. **Model memory:** F64's upper bound is 25 GB; operational memory is included and practical size can be lower. Set a proposed acceptance target of **<=20 GB peak model memory**, including DL working pages, Import dimensions, DQ intermediates, refresh and query structures. An illustrative allocation is 12 GB DL working set + 2 GB Import dimensions + 6 GB operational headroom; this is a budget, **not a prediction**. Prove it under overlap of refresh and queries. [S1, S7]
3. **DQ execution:** Snowflake performs the remote SQL in 1a, but F64 still translates/orchestrates queries and processes returned data and cross-source joins. In 1b, SQL endpoint compute is also on the Fabric capacity. Source/egress costs are additional.
4. **Other documented guards:** F64 max query memory 10 GB, 50 concurrent DQ connections/model, and default/max DQ parallelism 4-8. These are ceilings, **not a concurrency SLA**. DirectQuery has a default 1M intermediate-result limit, adjustable on Premium, and a service query timeout of four minutes; design selective investigations rather than relying on raising limits. [S7, S10]
5. **CU load:** summary DL queries, Import refresh, publication/Spark work and DQ handling share capacity. Do not infer sufficient CU throughput from a row-count calculation. Account for other workloads and both cold- and warm-cache behavior.

## 3. Option 2 design

Preferred source is the **same Snowflake database** for DQ detail, source aggregate and conformed dimensions. Use Import aggregate tables, **Dual** dimensions and a DQ fact. Map GroupBy keys and supported Sum/Count/Count-table-rows operations with Desktop **Manage aggregations**. Ratios should reuse additive components; exact distinct counts and unsupported expressions need specific mapping/design and hit/miss tests.

Queries reference the logical detail fields/measures; the Import aggregate is hidden. Supported queries rewrite to the aggregate; requests outside coverage go to DQ. With same-source Dual dimensions, aggregate queries use cached dimensions; detail queries push joins/grouping to the source with regular relationships. This is not equivalent to adding arbitrary Import-only dimensions from another source and expecting regular joins. [S4]

Refresh path: dbt/source aggregate completion -> scheduled incremental Import refresh of affected periods and Dual caches -> reconciliation/watermark publication. It can bypass the Fabric pipeline copy altogether. Keep cached and live data consistent; the engine does not automatically make detail match a stale aggregate snapshot. [S4]

Memory is conditional, not established by 36M rows: if a benchmark measures **1.5 GB** for narrow aggregate cache and **1 GB** dimensions, the 2.5 GB resident cache plus a simplistic 2x refresh allowance and 4 GB query overhead is **9 GB**. This is illustrative; refresh can exceed twice the model size, and source-driver/partition processing matters. Test actual **<=20 GB peak** target and the 25 GB upper bound. [S7, S12] Incremental refresh improves changed-data processing; it is not compression magic.

Use model-level security that filters both aggregate and detail. Learn says SSO-enabled sources cause Import aggregation tables to be ignored; **do not disable SSO merely to make a performance demo pass**. Have the identity owner approve a permitted credential/RLS design first, or mark Option 2 ineligible. [S4] Excel can use the same measures at either grain when the engine rewrite works, but this remains a workbook compatibility exercise, not guaranteed SSAS parity.

Prefer Option 2 over 1 when automatic routing is required, Import aggregates are small enough, their refresh fits the window, security allows aggregate use, and measured Excel/cache-hit tests outperform explicit Option 1 experiences.

## 4. F64 row headroom and the fallback gate

| Pattern | At 1.5B policy rows | At 4B policy rows |
|---|---|---|
| Current full-detail DL on F64 | 0 rows spare at exactly 1.5B; approximate reported count may differ | Exceeds cap by 2.5B |
| 1a / 1b, 36M monthly DL summary | 1.464B spare on aggregate table | Same, conditional on unchanged summary assumptions; detail is DQ |
| 2, Import aggregate + DQ | DL row guard not applicable; memory gate | Same; memory/refresh/query gates, not DL rows |
| 3, F128 full-detail DL | 1.5B spare / 50% | **Fails by 1B** |
| 3, F256 full-detail DL | 4.5B spare / 75% | 2B spare / 33.3% |

Fallback needs evidence from **both** F64 patterns after a bounded tuning pass:

- Option 1 cannot preserve the required summary grain within row/memory guards, or critical limited-relationship/Excel/summary/detail tests fail.
- Option 2 cannot fit all required cached history plus peak refresh/query memory, cannot get the required important-query aggregation hits, or fails approved security/workbook requirements.
- The failing requirement has a credible capacity-solvable cause. Unsupported MDX, mandatory SSO behavior, AWS network latency, faulty RLS and stuck pipeline operations are **not** evidence that an F256 fixes it.
- If those gates are met, propose an **approved synthetic sandbox** comparison on the existing F64 and larger-capacity configuration. Do not assume the reported existing F256s are still present, accessible, spare, or free of other workloads.

Full-detail F256 still needs a working-set/throughput benchmark against its 100 GB upper memory allowance. F128 has 50 GB, but its 3B row guard makes it ineligible at 4B regardless of memory. [S1, S7]

## 5. Plain Import with incremental refresh: conditional, not the lead

**Not ruled out by the Direct Lake row guard:** Import is a different storage mode. It is nevertheless **not established to fit F64** for a 150-column 1.5B-4B-row fact and all required history.

Incremental refresh reduces reprocessed data, not the resident footprint of all retained Import partitions. Column trimming, integer keys, removal of near-unique descriptions and correct partition processing may make a radically narrower full-detail model feasible, but measure its encoded VertiPaq footprint and peak processing memory. The reported 105 GB Delta size proves neither success nor failure. Respect the 25 GB upper model allocation and reserve room for refresh and query structures. [S7, S12, S13]

For orientation only, linear extrapolation of the reported storage figure would be 105 x 4 / 1.5 = **280 GB of Delta**, not a VertiPaq estimate. Do not use this as a memory conversion.

If tested, use source query folding, enable large-model storage format where required, and partition refresh through supported tooling. Confirm archive policy retains **every required historical period**; the standard incremental-refresh rolling window drops older partitions. Do not accidentally age out history just to pass a memory test. [S13] This route is ruled **in for a bounded compression proof**, but **out as an unverified default architecture** for the session.

## 6. Replacing the copy: availability, duplication and scope

### Snowflake database mirroring

Current Learn lists Snowflake among supported mirroring platforms **without a preview qualifier** and documents Snowflake in any cloud, which includes AWS. A focused search of core pages and Learn release notes did not locate a verbatim Snowflake-database-mirroring GA statement; do not infer a formal GA commitment from the missing label alone. This is a **conditional ingestion alternative**, not a drawn dependency of the recommended design. Snowflake **security-role mirroring is separately preview**, and is not assumed to transfer source security in this design. Snowflake read-only CDC being GA for Copy job is a different feature and is not evidence that database mirroring is GA. [S15, S16, S17, S24]

Mirroring replicates data into OneLake; it is **not** zero-copy access to native Snowflake detail. It could replace the copy leg in current state, 1b or 3, but preserves a second detail estate and does not change DL rows/table. Native managed-table support, schema/types, security, initial seeding, correction/deletion handling and measured lag need a source-specific test. Current limitations include 1,000 tables, unsupported external/transient/temporary/dynamic tables, no automatic transfer of Snowflake RLS/CLS, and 12-hour synchronization for views/materialized views. Do not confuse their cadence with native-table replication. [S17]

Learn documents no Snowflake-specific latency SLA in this evidence. Cross-cloud/region egress and latency remain; no promise that a different mechanism eliminates all long stalls.

F64 has **64 TB free mirrored-storage allowance** (1 TB/CU) for eligible mirroring storage, not general free OneLake storage. Replication background compute does not consume CUs, but queries and transformations do. A running capacity is needed; pause stops replication and incurs storage charges, and extended pauses can cause reseeding. Snowflake compute/egress still apply. These are public product behaviors, not observed customer billing. [S15, S17]

**First proposed test:** only after approval, synthetic managed tables and a synthetic initial backfill plus updates/deletes/restart test; compare lag, correctness, source cost and SQL visibility to the current copy. No such setup was run here.

### Shortcuts and external Iceberg/Delta

There is **no generic OneLake shortcut that queries native Snowflake database tables**. S3 shortcuts point at accessible object-storage data, not opaque Snowflake-managed table storage. Existing eligible Delta/Iceberg files can form a separate zero-copy-of-data-files route, subject to format, credentials, metadata virtualization, network/region, security and performance compatibility; query caching and egress can still exist. Learn explicitly includes **Amazon S3** as an existing Iceberg-table location for this route. This is separate from Snowflake-on-Azure writing directly into OneLake. [S18, S19, S25, S26]

Snowflake-on-**Azure** writing Iceberg directly into OneLake is a different documented integration; it must not be presented as a drop-in path for the stated Snowflake-on-**AWS** estate. AWS external Iceberg on S3 would require proving that the relevant data is actually stored in eligible open tables/files and that Fabric can consume those files/metadata. It is not simply a pipeline toggle.

**Rule out direct native-Snowflake shortcuts. Rule in documented external open-format shortcuts only conditionally** after table-format and feature-status confirmation. An AWS Iceberg-on-S3 route does not require migrating Snowflake to Azure or meeting the Azure-only write-path region constraint. Validate the documented virtualization restrictions, including unsupported Iceberg equality deletes, before treating it as equivalent to policy-detail replication. No shortcut/mirroring architecture is drawn as a production commitment without the missing availability and source-eligibility confirmations.

### MLV availability and preview boundary

**Core MLV is verified GA on Learn.** The September 2026 entry says **"Materialized lake views (Generally Available)"**. Its overview states that results persist as Delta tables. This is sufficient Learn evidence without relying on a separate blog or inferring status from a missing preview badge. [S9, S24]

Learn explicitly marks **PySpark MLV authoring**, **REFRESH_HINT for update/delete incremental behavior**, **event-triggered lineage refresh**, and the **Data Factory MLV refresh activity** as preview. These are **not required** by the recommended scheduled Spark-to-Delta baseline. Ordinary scheduled Spark jobs are not the same thing as preview PySpark MLV authoring. For optional SQL MLV adoption, check the selected aggregate's refresh behavior/CDF requirements and use time-based scheduling; not every change pattern is incrementally supported. MLVs do not directly query an arbitrary external Snowflake database. [S9, S20, S21, S24]

## 7. Public capacity list prices

**USD list prices, not a quote or customer agreement.** Azure MCP `pricing_get` retrieved the public `Fabric_Capacity_CU_Hour` meters for **East US** and **South Central US**, on 12 November 2026. Returned rates were identical:

- Consumption: **$0.18/CU-hour**.
- Reservation: **$938/CU for 1 year**; **$2,814/CU for 3 years**.
- The API's Consumption meter is labelled `Dataflows Standard Compute Capacity Usage CU`; reservation is `Fabric Capacity CU`. The Learn reservation article explicitly documents the former naming for Fabric reservation purchases and explains that F64 needs 64 reserved CUs. This alias is recorded rather than hidden. [S22]
- Reservation `unitOfMeasure` is returned as `1 Hour` even though `retailPrice` represents the reservation term purchase. Do not multiply $938 by 730. The Retail API Learn example likewise shows term reservation totals alongside that unit label. [S23]

| Region | SKU | PAYG/hour | PAYG/month, 730h assumption | 1y reservation total | 1y monthly equivalent | 3y reservation total | 3y monthly equivalent |
|---|---|---:|---:|---:|---:|---:|---:|
| East US | F64 | $11.52 | $8,409.60 | $60,032 | $5,002.67 | $180,096 | $5,002.67 |
| East US | F128 | $23.04 | $16,819.20 | $120,064 | $10,005.33 | $360,192 | $10,005.33 |
| East US | F256 | $46.08 | $33,638.40 | $240,128 | $20,010.67 | $720,384 | $20,010.67 |
| South Central US | F64 | $11.52 | $8,409.60 | $60,032 | $5,002.67 | $180,096 | $5,002.67 |
| South Central US | F128 | $23.04 | $16,819.20 | $120,064 | $10,005.33 | $360,192 | $10,005.33 |
| South Central US | F256 | $46.08 | $33,638.40 | $240,128 | $20,010.67 | $720,384 | $20,010.67 |

Arithmetic: `CUs x $0.18 x 730`, `CUs x $938 / 12`, and `CUs x $2,814 / 36`. The equal 1y/3y monthly equivalents reflect the returned records, not an assumption of additional 3y savings.

**Increase avoided versus F64:** F128 +$8,409.60 PAYG/month or +$5,002.67 reserved equivalent; F256 +$25,228.80 or +$15,008.00. Options 1 and 2 still consume the existing F64 and may incur different Snowflake compute, egress, storage and engineering costs; these figures are **not total-cost-of-ownership savings**. Existing reserved capacity may not produce an incremental cash saving. Reservations are commitments; monthly equivalents are comparison calculations, not a promised payment schedule. Storage, networking and other licenses are excluded. [S22]

Exact returned public rate fields and derived arithmetic are retained in [public-list-prices.json](public-list-prices.json). Effective rate starts were 2023-11-01 for PAYG/1y and 2026-04-01 for 3y, distinct from the retrieval date.

## 8. Proposed one-week customer validation plan

**Approval gate:** do not execute any test from this document automatically. A proof offered by the assistant would require explicit approval and run only in the user's own sandbox with synthetic data. The customer may independently run the same plan under its own governance. One week means a bounded proof, not an estimate for the production migration.

| Day | Steps and owner | Measurements / evidence |
|---|---|---|
| 1 | BI/capacity owner confirms actual SKU, DL type, fallback, exact error; data owner counts rows, files, row groups and grouped cardinalities. Business/Excel owner selects representative queries/workbooks and approves grain, history/security rules and concurrency. | Required dimensions, 15y coverage, 1.5B/4B meaning, source/capacity regions, baseline results and p50/p95. Record source as-of boundary. Include nonadditive/RLS cases, not only easy SUMs. |
| 2 | Data team/dbt designs synthetic or customer-governed daily/monthly aggregates. BI team creates 1a XMLA composite with Import dimensions + DQ fact and explicit measures. Separately test SQL DQ path if evaluating 1b. | True grouped rows, narrow-column encoding, DL file/group count, source SQL and key-list size, unmatched keys, security and totals. Catch unsupported deployment/credential behavior early. |
| 3 | Run summary and selective policy workloads cold/warm, then concurrency and overlapping refresh. Excel owner runs pivots, hierarchy expansion, slicers, named sets/custom MDX and show-details tests. | Query p50/p95/max, cache/transcoding, DQ SQL duration/bytes/egress, intermediate rows, model/query memory, Fabric capacity metrics, RLS isolation, workbook behavior. No unsupported Excel action may be silently substituted. |
| 4 | BI team tests Option 2 against the same source, grain and query corpus; maps aggregates and same-source Dual dimensions. Identity owner checks SSO/RLS eligibility before tracing hits. | Compressed Import size, initial/incremental refresh duration and peak memory, `Aggregate Table Rewrite Query` events, hit rate of **important** queries including Excel MDX, source queries on misses. [S4] |
| 5 | Data team exercises daily increments, late correction, delete/retry and interrupted-publication recovery; capacity owner repeats agreed peak with background workload overlap. Business/BI owners score both options. | Source-to-available elapsed time, commit/reframe/SQL visibility, exact reconciliation, explicit failure alerts, no partial batch exposure, performance distributions and headroom. Choose F64 winner or document exact failures and capacity-solvable fallback case. |

**Proposed pass criteria, to agree rather than assert as product SLAs:**

- **Correctness/security:** 100% of approved test cases reconcile to source/cube semantics, including nonadditive measures, all historical periods, late corrections, totals and RLS. Zero unauthorized results.
- **History/grain:** complete required 15 years available at approved summary grain; complete policy detail reachable. No policy to discard old partitions/history merely to fit a limit.
- **Summary latency:** p95 <=3 seconds warm and <=8 seconds cold on the representative corpus.
- **Policy latency:** p95 <=15 seconds for agreed selective investigations. Define filters/result sizes first; no unbounded 4B-row extraction test disguised as drillthrough.
- **Excel:** every required existing workbook interaction passes or an explicitly approved redesign is documented. Session-scoped MDX incompatibility is a requirement failure, not a tuning issue. For Option 2, important summary pivots must demonstrably hit Import aggregates.
- **Freshness:** approved daily source batch to query availability <=60 minutes; track ingestion, SQL visibility, aggregate build, dimension refresh and reframe separately. Initial backfill has a separately agreed window.
- **Memory/rows:** peak per-model memory <=20 GB proposed target, never SKU/query guard failures; every DL table <=1.2B planning ceiling and within file/group guards. For Option 2, include refresh overlap, not just resting cache size.
- **Capacity/concurrency:** begin with 10 summary + 2 detail concurrent sessions, then repeat at the **confirmed actual peak**. Proposed steady-state utilization target <=70% with zero throttling/rejections/timeouts and no accumulating capacity debt across repeated daily cycles. Test other-workload contention; the first small concurrency run is not proof of production fit.
- **Option 2 cache coverage:** proposed >=95% of the approved common-summary workload hits aggregates, with **100% of designated critical summary queries** meeting the latency target. A global hit percentage must not hide a critical missed-rewrite query.

Use the existing Fabric Capacity Metrics app, semantic-model traces/DMVs, Power BI Performance Analyzer and Snowflake query history as appropriate. Record cold and warm runs separately and keep the same source snapshot/query corpus across options. Trace-driven hit/miss verification is documented on Learn. [S4, S8]

## 9. Assumptions and open questions

All of the following remain **unconfirmed**, not customer facts:

1. The pilot is still F64; the previously reported two F256 capacities still exist and are accessible/available. Current source and Fabric regions and other workload occupancy.
2. Which Direct Lake type is in use, the fallback setting, the exact error and actual row/group counts. The observed message alone does not establish its cause.
3. Complete 15-year history is mandatory, whether retention is rolling or permanently retained, and whether the 4B projection actually represents that history at the policy grain.
4. Reported approximate inputs: 1.5B current rows, 4B projected, 30M new/month, 150 columns, 105 GB compressed, 158 files, daily incremental load. They were supplied as notes and were not independently inspected.
5. Summary dimensions, date/valuation basis and daily/monthly grain; actual cardinalities/occupancy, SCD versioning and required nonadditive cube semantics.
6. Excel's share, exact client build, workbooks using session MDX, drillthrough behavior, policy-level frequency and peak concurrency.
7. Identity/network controls, SSO mandate, source Snowflake RLS/CLS, model RLS and whether a shared service identity is allowed.
8. Whether the reported copy stalls stem from source extraction, orchestration, gateway/network, capacity contention, SQL visibility or a separate failure. No architecture here claims an observed root cause.
9. Whether eligible externally stored Delta/Iceberg tables already exist on AWS, rather than only native Snowflake managed tables.
10. Proposed latency/freshness/headroom targets, cardinalities, memory budgets and effort sizes; all require agreement and measurement.

Arithmetic consistency check: 30M/month of net new rows would take `(4B - 1.5B) / 30M = 83.3 months` to reach 4B. Fifteen years at a constant 30M/month would be 5.4B, so neither rate proves the full-history row count; backfill, historical growth and grain may differ.

## 10. Claims not verified on Microsoft Learn

- **Customer observations and assumptions:** every item in Section 9; Learn cannot verify a particular tenant or workload.
- **Actual F64 fit/performance:** no measured summary cardinality, compressed VertiPaq size, DQ cross-source join cost, peak memory, capacity load, refresh duration, Snowflake cost, or Excel compatibility. Proposed budgets/SLAs/effort are architecture estimates.
- **Exact Excel interaction equivalence:** especially Show Details/double-click, SSAS custom actions, particular MDX workbooks and hierarchy behavior in the complete three-mode model. General limits are verified; these client-specific outcomes are not.
- **Explicit Snowflake database mirroring GA declaration:** current Learn documents it without a preview qualifier, but the focused search did not locate an explicit GA statement. Non-Learn announcements are not substituted for the requested Learn verification. Mirroring is not required by the baseline design. **Core MLV GA was verified** in the September 2026 Learn release notes and is not an outstanding gap.
- **Snowflake-specific mirroring latency SLA:** not established. Do not use the generic mirroring examples or SQL Server's 15-second example as a Snowflake guarantee.
- **Raw price numbers:** obtained from the requested Azure MCP public retail-price service, not printed as numeric values on Learn. Learn verifies billing mechanics/units, while [public-list-prices.json](public-list-prices.json) records the returned rates.
- **No exact implementation of the synthetic composite was executed:** supported storage modes, tool boundary and source-group behavior are documented, but credentials, relationship/security topology and operations must still be validated in the proof.

## Sources

- **S1:** [Direct Lake overview: comparison, capacity requirements, limitations](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview).
- **S2:** [How Direct Lake works: framing, column loading, fallback](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-how-it-works).
- **S3:** [Composite models: tooling, source groups, relationship behavior](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-composite-models).
- **S4:** [User-defined aggregations: mappings, Dual, regular relationships, traces, synchronization and SSO](https://learn.microsoft.com/en-us/power-bi/transform-model/aggregations-advanced).
- **S5:** [Develop Direct Lake semantic models](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-develop).
- **S6:** [Direct Lake web modeling: Import combination and regular relationships](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-web-modeling).
- **S7:** [Capacity SKU limits: model/query memory and DQ connections/parallelism](https://learn.microsoft.com/en-us/fabric/enterprise/powerbi/service-premium-what-is).
- **S8:** [Understand Direct Lake query performance](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-understand-storage).
- **S9:** [Materialized lake views overview](https://learn.microsoft.com/en-us/fabric/data-engineering/materialized-lake-views/overview-materialized-lake-view).
- **S10:** [DirectQuery limitations, intermediate results and timeout](https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-directquery-about).
- **S11:** [Snowflake connector: GA and Import/DirectQuery support](https://learn.microsoft.com/en-us/power-query/connectors/snowflake).
- **S12:** [Refresh troubleshooting and memory-governed refresh](https://learn.microsoft.com/en-us/power-bi/connect-data/refresh-troubleshooting-refresh-scenarios).
- **S13:** [Incremental refresh and retention/rolling windows](https://learn.microsoft.com/en-us/power-bi/connect-data/incremental-refresh-overview).
- **S14:** [Model relationships: regular and limited evaluation](https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand).
- **S15:** [Mirroring overview: supported platforms, cost and pause behavior](https://learn.microsoft.com/en-us/fabric/mirroring/overview).
- **S16:** [Snowflake mirroring tutorial: any-cloud prerequisites](https://learn.microsoft.com/en-us/fabric/mirroring/snowflake-tutorial).
- **S17:** [Snowflake mirroring limitations](https://learn.microsoft.com/en-us/fabric/mirroring/snowflake-limitations).
- **S18:** [Lakehouse shortcuts: supported source types](https://learn.microsoft.com/en-us/fabric/data-engineering/lakehouse-shortcuts).
- **S19:** [Iceberg interoperability with Snowflake](https://learn.microsoft.com/en-us/fabric/onelake/onelake-iceberg-snowflake).
- **S20:** [Create MLVs: SQL and preview refresh hints](https://learn.microsoft.com/en-us/fabric/data-engineering/materialized-lake-views/create-materialized-lake-view).
- **S21:** [Schedule MLV lineage runs, including preview event triggers](https://learn.microsoft.com/en-us/fabric/data-engineering/materialized-lake-views/schedule-lineage-run).
- **S22:** [Fabric reservations: CU quantities, terms and billing alias](https://learn.microsoft.com/en-us/azure/cost-management-billing/reservations/fabric-capacity).
- **S23:** [Azure Retail Prices API: USD list prices, fields and reservation examples](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices).
- **S24:** [What's new in Fabric: September 2026 MLV GA and separately listed preview features](https://learn.microsoft.com/en-us/fabric/fundamentals/whats-new#generally-available-features).
- **S25:** [OneLake Iceberg tables: shortcuts to existing Iceberg tables including S3, virtualization restrictions](https://learn.microsoft.com/en-us/fabric/onelake/onelake-iceberg-tables#create-a-table-shortcut-to-an-iceberg-table).
- **S26:** [Amazon S3 shortcuts: read-only object access and permissions](https://learn.microsoft.com/en-us/fabric/onelake/create-s3-shortcut).
- **Public prices:** [Fabric pricing overview](https://azure.microsoft.com/en-us/pricing/details/microsoft-fabric/) and [Azure Retail Prices API](https://prices.azure.com/api/retail/prices); regional records retrieved via Azure MCP.
