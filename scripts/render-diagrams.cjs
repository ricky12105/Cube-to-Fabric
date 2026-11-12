const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const output = path.join(__dirname, '..', 'architecture-options');
const colors = {
  dl: ['#0078D4', '#CFE4FA'],
  imp: ['#5C2D91', '#E8DAEF'],
  dq: ['#F7630C', '#FFF4CE'],
  neutral: ['#495057', '#F3F2F1'],
  issue: ['#D13438', '#FDE7E9'],
};
const columns = [40, 400, 760, 1120, 1480];
const laneNames = ['SOURCE', 'LANDING / PUBLICATION', 'STORAGE / CACHE', 'SEMANTIC MODEL', 'CONSUMERS'];
const pages = [];
let current;

function element(key, type, x, y, width, height, extra = {}) {
  const e = {
    id: `${current.slug}-${key}`, type, x, y, width, height, angle: 0,
    strokeColor: '#495057', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100,
    groupIds: [], frameId: current.frame, seed: current.elements.length + 1,
    version: 1, versionNonce: current.elements.length + 1, isDeleted: false,
    boundElements: null, updated: 1, link: null, locked: false, ...extra,
  };
  current.elements.push(e);
  return e;
}

function text(key, x, y, width, value, size = 18, extra = {}) {
  return element(key, 'text', x, y, width, size * 2.5 * value.split('\n').length, {
    strokeColor: '#000000', fontSize: size, fontFamily: 2, text: value,
    originalText: value, textAlign: 'left', verticalAlign: 'top',
    containerId: null, lineHeight: 1.3, autoResize: false,
    customData: { role: 'note' }, ...extra,
  });
}

function box(key, x, y, width, height, value, mode = 'neutral', extra = {}) {
  const { lane, role = 'node', muted = false, ...style } = extra;
  const [strokeColor, backgroundColor] = colors[mode];
  const b = element(key, 'rectangle', x, y, width, height, {
    strokeColor: muted ? '#6F8DA9' : strokeColor,
    backgroundColor: muted ? '#EEF3F8' : backgroundColor,
    roundness: { type: 3 }, customData: { role, mode, lane }, ...style,
  });
  const labelHeight = value.split('\n').length * 23.4;
  const t = text(`${key}-label`, x + 16, y + (height - labelHeight) / 2,
    width - 32, value, 18, {
      height: labelHeight, containerId: b.id, textAlign: 'center',
      verticalAlign: 'middle', customData: { role: 'bound-label' },
    });
  b.boundElements = [{ type: 'text', id: t.id }];
  return b;
}

function connector(key, from, to, points, mode = 'neutral', options = {}) {
  const [x, y] = points[0];
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const e = element(key, 'arrow', x, y, Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys), {
      points: points.map(p => [p[0] - x, p[1] - y]),
      strokeColor: colors[mode][0],
      strokeStyle: options.dashed ? 'dashed' : 'solid',
      startBinding: { elementId: from.id, focus: 0, gap: 8 },
      endBinding: { elementId: to.id, focus: 0, gap: 8 },
      startArrowhead: options.bidir ? 'arrow' : null,
      endArrowhead: 'arrow', elbowed: false,
      customData: { role: 'connector', mode },
    });
  for (const node of [from, to]) {
    node.boundElements.push({ type: 'arrow', id: e.id });
  }
  return e;
}

function across(key, from, to, mode = 'neutral', options = {}) {
  assert.equal(from.y + from.height / 2, to.y + to.height / 2);
  return connector(key, from, to, [
    [from.x + from.width + 8, from.y + from.height / 2],
    [to.x - 8, to.y + to.height / 2],
  ], mode, options);
}

function start(slug, title, subtitle, height = 1060, decision = false) {
  current = { slug, title, subtitle, width: 1840, height, elements: [], frame: null };
  current.frame = element('frame', 'frame', 0, 0, 1840, height,
    { name: title, frameId: null, customData: { role: 'frame' } }).id;
  text('title', 40, 20, 1760, title, 30, { customData: { role: 'title' } });
  text('subtitle', 40, 78, 1760, subtitle, 18);
  const headers = decision
    ? ['REQUIREMENT', 'TRY OPTION 1 - F64', 'TRY OPTION 2 - F64', 'CAPACITY GATE', 'OPTION 3 - LAST RESORT']
    : laneNames;
  columns.forEach((x, i) => {
    box(`lane-${i}`, x, 135, 300, 52, headers[i], 'neutral',
      { lane: i, role: 'lane-header', backgroundColor: 'transparent', strokeColor: '#CBD5E1' });
  });
  pages.push(current);
}

function primary(key, lane, value, mode = 'neutral', extra = {}) {
  return box(key, columns[lane], 210, 300, 220, value, mode, { lane, role: 'primary', ...extra });
}

function modelBoundary() {
  element('model-boundary', 'rectangle', 1106, 196, 328, 538, {
    strokeColor: '#94A3B8', backgroundColor: 'transparent', strokeStyle: 'dashed',
    roundness: { type: 3 }, customData: { role: 'container' },
  });
}

function legend(y, decision = false) {
  const labels = [
    ['dl', 'Direct Lake'], ['imp', 'Import / Dual'], ['dq', 'DirectQuery'],
    ['neutral', 'Source / processing / gates'], ['issue', 'Reported issue / guard'],
  ];
  [40, 330, 650, 950, 1390].forEach((x, i) => {
    const [mode, label] = labels[i];
    element(`legend-chip-${i}`, 'rectangle', x, y, 22, 22, {
      strokeColor: colors[mode][0], backgroundColor: colors[mode][1],
      roundness: { type: 3 },
      customData: { role: 'legend-chip' },
    });
    text(`legend-text-${i}`, x + 34, y - 1, 380, label, 16);
  });
  text('legend-flow', 40, y + 40, 1760, decision
    ? 'Decision arrows: PASS stops on F64; FAIL advances to the next test. Scale only when both F64 patterns fail for a capacity-solvable reason.'
    : 'Architecture arrows: solid = publication / summary path; dashed double arrows = on-demand queries and results. Inset lines show relationships.', 16);
  text('legend-assumptions', 40, y + 70, 1760,
    '* Reported / illustrative counts and 15-year coverage need confirmation. Assigned SKU and proposed memory targets are not measured here.', 16);
}

function inset(detail) {
  text('inset-title', 40, 865, 1760,
    'Semantic model inset - one model, shared dimensions, separate facts', 23);
  const dims = box('dimensions', 60, 1030, 500, 180,
    'Shared dimensions - Import\nMonth / State / Product\nCoverage / Channel / Segment\nUnique integer keys; 1-side\nExcel hierarchies supported', 'imp');
  const agg = box('aggregate-fact', 900, 960, 880, 150,
    'Aggregate fact - Direct Lake on OneLake\n180 months x 200,000 combinations = 36M rows*\n15-year monthly summary on F64*\nExplicit Summary measures', 'dl');
  const policy = box('policy-fact', 900, 1190, 880, 150,
    `Policy fact - DirectQuery to ${detail}\nPolicy rows: 1.5B now -> 4B projected; 15y assumed*\nSelective investigation using explicit Policy measures\nDirectQuery source rows are not Direct Lake table rows`, 'dq');
  connector('regular-relationship', dims, agg,
    [[568, 1075], [730, 1075], [730, 1035], [892, 1035]], 'dl');
  connector('limited-relationship', dims, policy,
    [[568, 1165], [700, 1165], [700, 1265], [892, 1265]], 'dq', { dashed: true });
  text('regular-label', 590, 965, 290, '1:* REGULAR\nSame source group', 17);
  text('limited-label', 590, 1300, 290, '1:* LIMITED\nCross-source group', 17);
  text('inset-notes', 60, 1380, 1720,
    'Single-direction dimension filters; no fact-to-fact relationship. Policy-only fields do not filter the monthly summary.\nNo automatic DL aggregation routing. Excel: Summary pivot first; a separate, filtered Policy pivot for investigations.', 17);
  legend(1490);
}

start('01a-f64-snowflake-detail',
  'Option 1a - Lead: F64 summary model; detail stays in Snowflake',
  'Direct Lake on OneLake + Import + DirectQuery, assembled with XMLA. No second Fabric copy of policy detail.', 1660);
modelBoundary();
const aSource = primary('source', 0,
  'Snowflake on AWS\nSystem of record; dbt summary\nPolicy rows: 1.5B -> 4B*\nAll 15 years assumed*\nSource compute: Snowflake');
const aLoad = primary('publication', 1,
  'Daily summary publication\nChanged months + dimensions\n36M-row initial summary*\nNo policy-detail backfill\nFabric jobs: F64');
const aStore = primary('summary-storage', 2,
  'OneLake Delta summary\n15y at monthly grain*\n180 x 200,000 = 36M*\n1.464B row headroom*\nNo second detail estate', 'dl');
const aModel = primary('summary-model', 3,
  'F64 model - summary fact\nDirect Lake on OneLake\nShared Import dimensions\nExplicit Summary measures\nTarget peak <=20 GB*\n25 GB/model upper bound', 'dl');
const aConsumers = primary('consumers', 4,
  'Power BI + Excel\nSummary measures / pivots\nImport dimension hierarchies\nAll 15y at summary grain*\nSSAS parity must be tested');
across('source-to-publication', aSource, aLoad);
across('publication-to-storage', aLoad, aStore);
across('storage-to-summary', aStore, aModel, 'dl');
across('summary-to-consumers', aModel, aConsumers, 'dl');
box('no-detail-copy', 400, 470, 660, 90,
  'No detail landing or detail copy in Fabric\nFiltered policy queries execute in Snowflake', 'neutral', { role: 'callout' });
const aPolicy = box('detail-model', 1120, 530, 300, 190,
  'Same model - policy fact\nDirectQuery to Snowflake\nFiltered Policy measures\nNo DL row guard on DQ', 'dq');
connector('detail-source-path', aSource, aPolicy,
  [[190, 438], [190, 625], [1112, 625]], 'dq', { dashed: true, bidir: true });
text('detail-source-label', 400, 580, 660, 'On demand: SQL to source; results to model', 17);
connector('detail-consumer-path', aPolicy, aConsumers,
  [[1428, 625], [1630, 625], [1630, 438]], 'dq', { dashed: true, bidir: true });
text('detail-consumer-label', 1480, 660, 300, 'Policy pivot / investigation', 17);
text('first-test', 40, 770, 1760,
  'FIRST TEST: XMLA model + Import dimensions + Snowflake DirectQuery; verify limited-relationship filters and Excel pivots.\nMeasure cold/warm summaries, selective policy queries, peak memory and F64 CU load before declaring a fit.', 18);
inset('Snowflake');

start('01b-f64-onelake-detail',
  'Option 1b - F64 summary model; copied detail in OneLake',
  'One XMLA composite model: Direct Lake on OneLake summaries plus explicit DirectQuery through the SQL analytics endpoint.', 1660);
modelBoundary();
const bSource = primary('source', 0,
  'Snowflake on AWS\nSystem of record\nPolicy rows: 1.5B -> 4B*\nAll 15 years assumed*\nSource compute: Snowflake');
const bLoad = primary('publication', 1,
  'Initial detail backfill\nThen daily incremental copy\n~30M new rows / month*\nDetail + dimension updates\nFabric jobs: F64');
const bStore = primary('detail-storage', 2,
  'OneLake Delta detail\n1.5B -> 4B rows* / 15y*\nSecond detail estate\nSQL analytics endpoint\nDQ compute shares F64', 'dq');
const bModel = primary('detail-model', 3,
  'F64 model - policy fact\nDQ via SQL endpoint\nShared Import dimensions\nFiltered Policy measures\n25 GB/model upper bound', 'dq');
const bConsumers = primary('consumers', 4,
  'Power BI + Excel\nSummary / Policy measures\nAll 15y available*\nSeparate filtered Policy pivot\nNo auto aggregate routing');
across('source-to-copy', bSource, bLoad);
across('copy-to-detail', bLoad, bStore);
across('detail-to-model', bStore, bModel, 'dq', { dashed: true, bidir: true });
across('policy-to-consumers', bModel, bConsumers, 'dq', { dashed: true, bidir: true });
const bAgg = box('summary-storage', 760, 530, 300, 190,
  'Physical Delta summary\n15y monthly: 36M rows*\nSpark or SQL MLV (core GA)\nPreview features not required\nBuild compute: F64', 'dl');
const bSummary = box('summary-model', 1120, 530, 300, 190,
  'Same model - summary fact\nDirect Lake on OneLake\nExplicit Summary measures\nTarget peak <=20 GB*\n1.464B row headroom*', 'dl');
connector('build-summary', bStore, bAgg, [[910, 438], [910, 522]], 'dl');
text('build-label', 935, 465, 125, 'Build Delta', 17);
across('summary-to-model', bAgg, bSummary, 'dl');
connector('summary-to-consumers', bSummary, bConsumers,
  [[1428, 625], [1630, 625], [1630, 438]], 'dl');
text('summary-consumer-label', 1480, 660, 300, 'Summary measures / pivots', 17);
text('first-test', 40, 770, 1760,
  'FIRST TEST: copy completion -> SQL visibility -> aggregate build -> Import dimension refresh -> reframe.\nRun detail SQL and summary queries during refresh: copy reliability, SQL/Spark contention and memory remain test gates.', 18);
inset('SQL endpoint');

start('00-current-state',
  'Option 0 - Current state: reported issues and Direct Lake guardrails',
  'Reported pilot design, not inspected. Confirm assigned SKU, Direct Lake type, fallback setting and exact row count.');
const zSource = primary('source', 0,
  'Snowflake on AWS\nSystem of record\n~1.5B -> ~4B detail*\n15y coverage unconfirmed*\nSource compute: Snowflake');
const zLoad = primary('publication', 1,
  'Pipeline copy - F64?*\nDaily incremental load*\nReported variable delay:\nminutes to hours*\n~30M new rows / month*', 'issue');
const zStore = primary('detail-storage', 2,
  'OneLake Delta fact\n~1.5B rows; 150 columns*\n~105 GB compressed*\n158 files reported*\n15y coverage unconfirmed*');
const zModel = primary('detail-model', 3,
  'Direct Lake model - F64?*\n1.5B rows/table maximum\nAt ~1.5B: ~zero margin\nAt 4B: 2.5B over limit\nDL type / fallback unknown', 'issue');
const zConsumers = primary('consumers', 4,
  'Power BI + Excel\nReported row-limit error*\nExcel usage unconfirmed*\nSSAS cube replacement\nParity not yet tested');
across('source-to-copy', zSource, zLoad);
across('copy-to-storage', zLoad, zStore, 'issue');
across('storage-to-model', zStore, zModel, 'issue');
across('model-to-consumers', zModel, zConsumers);
box('copy-risk', 40, 510, 840, 170,
  'VERIFY 1: reported copy / freshness delays\nInspect extraction, orchestration, network and capacity evidence.\nThe row-limit message does not diagnose a stuck copy.\nNo tenant logs or current configuration were inspected.', 'issue', { role: 'callout' });
box('row-risk', 940, 510, 840, 170,
  'VERIFY 2: row guard and storage layout\nIf >1.5B on F64: OneLake fails; SQL falls back only if enabled.\n158 files is below 5,000; row-group count still needs checking.\nOPTIMIZE / VACUUM cannot remove a true total-row excess.', 'issue', { role: 'callout' });
text('first-test', 40, 770, 1760,
  'FIRST TEST: capture the exact error; count rows, files and row groups; confirm SKU, Direct Lake type and fallback.\nKeep ingestion reliability and semantic-model guardrails as separate diagnostic tracks.', 18);
legend(920);

start('02-f64-import-aggregations',
  'Option 2 - F64 alternative: Import aggregates + automatic detail routing',
  'Desktop Manage aggregations: Import aggregates over DirectQuery detail, with same-source Dual dimensions.');
modelBoundary();
const tSource = primary('source', 0,
  'Snowflake on AWS\nPolicy fact: 1.5B -> 4B*\nAll 15y assumed*\nSource dbt summary: 36M*\nSame-source dimensions\nSource compute: Snowflake');
const tLoad = primary('publication', 1,
  'Scheduled Import refresh\nAggregate + Dual dim cache\nSource query folding\nIncremental if configured\nNo OneLake detail copy\nRefresh compute: F64');
const tStore = primary('summary-storage', 2,
  "Model's VertiPaq cache\nImport aggregate: 36M*\nAll 15y at monthly grain*\nDual dimension cache\nTarget peak <=20 GB*\n25 GB/model upper bound", 'imp');
const tModel = primary('summary-model', 3,
  'F64 composite model\nHidden Import aggregate\nManage aggregations maps\nMeasures use detail table\nHit -> Import cache\nMiss -> DirectQuery', 'imp');
const tConsumers = primary('consumers', 4,
  'Power BI + Excel\nSame business measures\nCovered summary -> cache\nOther queries -> DirectQuery\nVerify Dual dim hierarchies\nMDX parity is not assured');
across('source-to-import', tSource, tLoad);
across('refresh-to-cache', tLoad, tStore, 'imp');
across('cache-to-model', tStore, tModel, 'imp');
across('summary-to-consumers', tModel, tConsumers, 'imp');
box('no-detail-copy', 400, 470, 660, 90,
  'Preferred: policy detail stays in Snowflake\nOneLake detail is a separate copied-data variant', 'neutral', { role: 'callout' });
const tPolicy = box('detail-model', 1120, 530, 300, 190,
  'Same model - policy fact\nDirectQuery to Snowflake\n1.5B -> 4B rows* / 15y*\nSame-source Dual dimensions\nRegular 1:* relationships', 'dq');
connector('detail-source-path', tSource, tPolicy,
  [[190, 438], [190, 625], [1112, 625]], 'dq', { dashed: true, bidir: true });
text('detail-source-label', 400, 580, 660, 'Cache miss: SQL to source; results to model', 17);
connector('detail-consumer-path', tPolicy, tConsumers,
  [[1428, 625], [1630, 625], [1630, 438]], 'dq', { dashed: true, bidir: true });
text('detail-consumer-label', 1480, 660, 300, 'Same measures; detail miss', 17);
text('first-test', 40, 770, 1760,
  'FIRST TEST: aggregate compression + peak incremental-refresh memory, then trace Excel summary hits and detail misses.\nSECURITY GATE: SSO-enabled sources ignore Import aggregates; approve identity and RLS before benchmarking.', 18);
legend(920);

start('03-scale-fallback',
  'Option 3 - LAST RESORT: scale only after F64 model-change tests fail',
  'No grain change. F128 cannot hold a 4B-row Direct Lake table; F256 fits by row count, not automatically by memory or throughput.');
const fSource = primary('source', 0,
  'Snowflake on AWS\nSystem of record\nPolicy rows: 1.5B -> 4B*\nAll 15 years assumed*\nSource compute: Snowflake');
const fLoad = primary('publication', 1,
  'Existing pipeline copy\nDaily increments*\nSame reliability exposure\nSame transfer / egress\nNo ingestion redesign');
const fStore = primary('detail-storage', 2,
  'OneLake Delta detail\n1.5B -> 4B rows* / 15y*\nFull second detail copy\nNo grain change\nStorage still required');
const fModel = primary('detail-model', 3,
  'Single Direct Lake fact\nF128: 3B max; 50 GB\n4B fails on F128\nF256: 6B max; 100 GB\n4B leaves 2B row margin', 'dl', { muted: true });
const fConsumers = primary('consumers', 4,
  'Power BI + Excel\nSame DL / MDX limits\nAll 15y at policy grain*\nScaling does not redesign\nor restore cube features');
across('source-to-copy', fSource, fLoad);
across('copy-to-storage', fLoad, fStore);
across('storage-to-model', fStore, fModel, 'dl');
across('model-to-consumers', fModel, fConsumers, 'dl');
box('fallback-gate', 400, 510, 1020, 170,
  'GATED FALLBACK - EVIDENCE REQUIRED\nOption 1: required grain, limited relationships or Excel tests still fail after tuning.\nOption 2: required cache / refresh cannot fit, or critical queries cannot hit aggregates.\nBoth must fail agreed criteria for a capacity-solvable reason; a stuck copy is not one.', 'neutral', { role: 'callout' });
text('first-test', 40, 770, 1760,
  'FIRST TEST: only after both F64 patterns fail, propose an approved synthetic sandbox benchmark on the larger SKU.\nNo scale-up or tenant inspection was performed; check working set, throughput and other workload occupancy.', 18);
legend(920);

start('04-decision-path',
  'Decision path - change the model first; scale is a gated fallback',
  'Decision stages, not data-flow lanes: test Option 1, then Option 2, and consider scale only after both fail.', 1100, true);
const dRequirement = primary('requirement', 0,
  'Can the model change meet\nthe requirement on F64?\nConfirm grain, Excel usage,\nall 15y and performance\nbefore choosing a capacity');
const dOne = primary('option-one', 1,
  '1. Direct Lake summary\n+ DirectQuery policy detail\nLead: 1a Snowflake detail\n1b only if copy justified\nF64; explicit measures', 'dl');
const dTwo = primary('option-two', 2,
  '2. Import aggregates\n+ DirectQuery policy detail\nSame-source Dual dimensions\nAutomatic hit / miss routing\nF64; refresh / security gate', 'imp');
const dGate = primary('capacity-gate', 3,
  'Have BOTH F64 options\nfailed agreed tests after\ntuning, and can capacity\nfix the failing requirement?\nNo -> fix the root cause');
const dThree = primary('option-three', 4,
  '3. LAST RESORT\nBenchmark F256 for 4B\nF128 only up to 3B\nApproval still required\nDoes not redesign the model');
across('start-option-one', dRequirement, dOne);
across('one-fails', dOne, dTwo);
across('two-fails', dTwo, dGate);
across('gate-yes', dGate, dThree);
text('one-fail-label', 711, 280, 46, 'FAIL', 15);
text('two-fail-label', 1071, 280, 46, 'FAIL', 15);
text('gate-yes-label', 1432, 280, 46, 'YES', 15);
const dPassOne = box('one-passes', 400, 610, 300, 190,
  'PASS -> stay on F64\nAll 15y summary + detail*\n36M monthly example*\n1.464B row headroom*\nMemory + Excel tests pass', 'dl');
const dPassTwo = box('two-passes', 760, 610, 300, 190,
  'PASS -> stay on F64\nAll 15y summary + detail*\nVerify Excel aggregate hits\nMemory + refresh fit\nSnowflake: one detail estate', 'imp');
const dNo = box('gate-no', 1120, 610, 300, 190,
  'NO -> do not scale\nResolve source / network /\ncopy / security / MDX issue\nRevise or retest the design\nA bigger SKU is not a cure');
const dBenchmark = box('benchmark', 1480, 610, 300, 190,
  'Approved benchmark only\nValidate 100 GB upper bound\nand actual working set\nCheck throughput + cost\nKeep modelling work in scope');
for (const [key, from, to, mode] of [
  ['one-pass', dOne, dPassOne, 'dl'], ['two-pass', dTwo, dPassTwo, 'imp'],
  ['gate-no-path', dGate, dNo, 'neutral'], ['benchmark-path', dThree, dBenchmark, 'neutral'],
]) {
  connector(key, from, to, [[from.x + 150, 438], [from.x + 150, 602]], mode);
}
text('one-pass-label', 570, 510, 100, 'PASS', 16);
text('two-pass-label', 930, 510, 100, 'PASS', 16);
text('gate-no-caption', 1290, 510, 100, 'NO', 16);
text('benchmark-caption', 1650, 510, 120, 'TEST', 16);
text('decision-notes', 40, 850, 1760,
  'Do not interpret cross-cloud latency, a stuck copy, incorrect security or unsupported Excel MDX as evidence that scaling fixes the problem.\nUse the same agreed query corpus, retention rules and acceptance criteria for both F64 patterns; no measured customer outcome is implied.', 18);
legend(960, true);

function xml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svg(page) {
  const result = [`<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}" role="img" aria-labelledby="${page.slug}-title">`, '<defs>'];
  for (const [mode, [color]] of Object.entries(colors)) {
    result.push(`<marker id="${mode}-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L0,6 L8,3 z" fill="${color}"/></marker>`);
  }
  result.push('</defs>', '<rect width="100%" height="100%" fill="white"/>');
  for (const e of page.elements) {
    const role = e.customData?.role || '';
    const attrs = `id="${e.id}" data-role="${role}"`;
    if (e.type === 'rectangle') {
      result.push(`<rect ${attrs} x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="10" fill="${e.backgroundColor}" stroke="${e.strokeColor}" stroke-width="${e.strokeWidth}"${e.strokeStyle === 'dashed' ? ' stroke-dasharray="7 5"' : ''}/>`);
    } else if (e.type === 'arrow') {
      const points = e.points.map(p => [p[0] + e.x, p[1] + e.y]);
      const d = points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
      const marker = `${e.customData.mode}-arrow`;
      result.push(`<path ${attrs} data-start="${e.startBinding.elementId}" data-end="${e.endBinding.elementId}" d="${d}" fill="none" stroke="${e.strokeColor}" stroke-width="2"${e.strokeStyle === 'dashed' ? ' stroke-dasharray="8 5"' : ''}${e.startArrowhead ? ` marker-start="url(#${marker})"` : ''} marker-end="url(#${marker})"/>`);
    } else if (e.type === 'text') {
      const center = e.textAlign === 'center';
      const x = center ? e.x + e.width / 2 : e.x;
      result.push(`<text ${attrs}${e.containerId ? ` data-container="${e.containerId}"` : ''} x="${x}" y="${e.y + e.fontSize}" font-family="Arial, sans-serif" font-size="${e.fontSize}" fill="black" text-anchor="${center ? 'middle' : 'start'}">`);
      e.text.split('\n').forEach((line, i) => {
        result.push(`<tspan x="${x}" dy="${i ? Number((e.fontSize * 1.3).toFixed(2)) : 0}">${xml(line)}</tspan>`);
      });
      result.push('</text>');
    }
  }
  return result.concat('</svg>', '').join('\n');
}

function segmentCrossesRect(a, b, rect) {
  const left = rect.x + 1;
  const right = rect.x + rect.width - 1;
  const top = rect.y + 1;
  const bottom = rect.y + rect.height - 1;
  if (a[0] === b[0]) {
    return a[0] > left && a[0] < right && Math.max(a[1], b[1]) > top && Math.min(a[1], b[1]) < bottom;
  }
  assert.equal(a[1], b[1], 'Connectors must use orthogonal segments');
  return a[1] > top && a[1] < bottom && Math.max(a[0], b[0]) > left && Math.min(a[0], b[0]) < right;
}

function validate(page) {
  const byId = new Map(page.elements.map(e => [e.id, e]));
  assert.equal(byId.size, page.elements.length, `${page.slug}: duplicate IDs`);
  const obstacles = page.elements.filter(e => e.type === 'rectangle' && e.customData.role !== 'container');
  for (const e of page.elements) {
    assert(e.x >= 0 && e.y >= 0 && e.width >= 0 && e.height >= 0, e.id);
    if (e.type !== 'frame') assert.equal(e.frameId, page.frame, e.id);
    assert(e.x + e.width <= page.width && e.y + e.height <= page.height, `${e.id}: outside frame`);
    if (e.type === 'text') {
      assert.equal(e.strokeColor, '#000000');
      if (e.containerId) {
        const box = byId.get(e.containerId);
        assert(e.x >= box.x + 10 && e.x + e.width <= box.x + box.width - 10);
        assert(e.y >= box.y + 10 && e.y + e.height <= box.y + box.height - 10, `${e.id}: text height`);
      }
    }
    if (e.customData.role === 'primary') {
      const header = byId.get(`${page.slug}-lane-${e.customData.lane}`);
      assert.equal(e.x, header.x, `${e.id}: lane alignment`);
      assert.equal(e.width, header.width, `${e.id}: lane width`);
    }
    if (e.type === 'arrow') {
      assert(byId.has(e.startBinding.elementId) && byId.has(e.endBinding.elementId));
      const points = e.points.map(p => [p[0] + e.x, p[1] + e.y]);
      for (const [point, binding] of [
        [points[0], e.startBinding], [points.at(-1), e.endBinding],
      ]) {
        const node = byId.get(binding.elementId);
        const dx = Math.max(node.x - point[0], 0, point[0] - node.x - node.width);
        const dy = Math.max(node.y - point[1], 0, point[1] - node.y - node.height);
        assert.equal(Math.hypot(dx, dy), binding.gap, `${e.id}: detached endpoint`);
      }
      for (let i = 1; i < points.length; i++) {
        for (const rect of obstacles) {
          if (rect.id === e.startBinding.elementId || rect.id === e.endBinding.elementId) continue;
          assert(!segmentCrossesRect(points[i - 1], points[i], rect), `${e.id} crosses ${rect.id}`);
        }
      }
    }
  }
}

const files = new Map();
const combined = [];
let offsetY = 0;
for (const page of pages) {
  validate(page);
  const document = {
    type: 'excalidraw', version: 2, source: 'Cube-to-Fabric architecture renderer',
    elements: page.elements, appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {},
  };
  files.set(`${page.slug}.excalidraw`, JSON.stringify(document, null, 2) + '\n');
  files.set(`${page.slug}.svg`, svg(page));
  combined.push(...page.elements.map(e => ({ ...e, y: e.y + offsetY })));
  offsetY += page.height + 120;
}
files.set('all-options.excalidraw', JSON.stringify({
  type: 'excalidraw', version: 2, source: 'Cube-to-Fabric architecture renderer',
  elements: combined, appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {},
}, null, 2) + '\n');

files.set('diagrams.html', `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fabric semantic model - architecture options</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:#eef2f6;color:#111}
header,nav,section{max-width:1840px;margin:20px auto;padding:16px;background:white}
nav{display:flex;flex-wrap:wrap;gap:8px}nav a{padding:8px}p{line-height:1.5}h1{font-size:26px}
.diagram-scroll{overflow-x:auto;border:1px solid #d5dde5;border-radius:6px}
.diagram-scroll img{display:block;width:100%;min-width:1280px;height:auto}
section{scroll-margin-top:16px}a{color:#005a9e}a:focus-visible{outline:3px solid #0078d4;outline-offset:3px}
@media print{header,nav,.downloads{display:none}section{break-after:page;margin:0;padding:0}section:last-child{break-after:auto}.diagram-scroll{overflow:visible;border:0}.diagram-scroll img{min-width:0;width:100%;height:270mm;object-fit:contain;object-position:top left}body{background:white}@page{size:A3 landscape;margin:8mm}}
</style></head>
<body>
<header><h1>Fabric semantic-model architecture options</h1>
<p>F64-first design | Public documentation checked 12 November 2026 | Read-only architecture study; no customer environment inspected.<br>
Counts, complete 15-year coverage and memory targets remain assumptions or proposed criteria, not measured outcomes.</p>
<p><a href="all-options.excalidraw" download>Editable Excalidraw board</a> |
<a href="comparison.html">One-page comparison</a> | <a href="comparison.pdf">Comparison PDF</a> |
<a href="evidence-and-test-plan.md" download>Evidence and one-week test plan (Markdown)</a></p>
<p>Colour identifies semantic access mode. On narrow screens, scroll each diagram horizontally or open its full-size SVG.</p></header>
<nav aria-label="Architecture options">${pages.map(p => `<a href="#${p.slug}">${xml(p.title.split(' - ')[0])}</a>`).join('')}</nav>
<main>
${pages.map(p => `<section id="${p.slug}" aria-label="${xml(p.title)}"><div class="diagram-scroll" tabindex="0" role="region" aria-label="${xml(p.title)} - horizontally scrollable"><img src="${p.slug}.svg" alt="${xml(p.title)}"></div><p class="downloads"><a href="${p.slug}.excalidraw" download>Editable Excalidraw</a> | <a href="${p.slug}.svg">Full-size SVG</a></p></section>`).join('\n')}
</main></body></html>
`);

if (process.argv.includes('--check')) {
  for (const [name, content] of files) {
    assert.equal(fs.readFileSync(path.join(output, name), 'utf8').replace(/\r\n/g, '\n'), content,
      `${name}: regenerate with node scripts\\render-diagrams.cjs`);
  }
  console.log(`PASS: ${pages.length} aligned frames, bound connectors, no connector/node crossings; ${files.size} generated files match.`);
} else {
  for (const [name, content] of files) fs.writeFileSync(path.join(output, name), content);
  console.log(`Rendered ${pages.length} frames and ${files.size} synchronized SVG, Excalidraw and gallery files.`);
}
