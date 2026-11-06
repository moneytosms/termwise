// Diagrams drawn with fletcher. Each is scaled down to the text width if needed.
#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import "lib.typ": accent, accent-soft, ink, muted, sans, mono, tint, rule-col

#let fit(body) = context layout(size => {
  let m = measure(body)
  let k = if m.width > size.width { size.width / m.width * 100% } else { 100% }
  scale(k, reflow: true, body)
})

#let app(pos, body, name: none, strong: false) = node(
  pos, align(center, body), name: name,
  fill: if strong { accent } else { accent-soft },
  stroke: 0.9pt + accent, corner-radius: 4pt,
)
#let store(pos, body, name: none) = node(
  pos, align(center, body), name: name,
  fill: white, stroke: 0.9pt + accent, corner-radius: 9pt,
)
#let ext(pos, body, name: none) = node(
  pos, align(center, body), name: name,
  fill: tint, stroke: 0.8pt + muted, corner-radius: 4pt,
)
#let tag(body) = text(size: 6.8pt, font: mono, fill: muted, body)

// 1. Architecture (section 2)
#let architecture = fit({
  set text(font: sans, size: 8pt, fill: ink)
  diagram(
    spacing: (34mm, 13mm),
    node-inset: 7pt,
    edge-stroke: 0.9pt + accent,
    mark-scale: 80%,
    app((0, 1), [*Phone or browser*\ service worker +\ IndexedDB outbox], name: <p>),
    app((1, 1), text(fill: white)[*Next.js 16 app*\ server components,\ server actions,\ route handlers], name: <n>, strong: true),
    store((2, 0), [*Postgres 18*\ app role:\ read/write], name: <db>),
    store((2, 1), [*Postgres views*\ assistant role: read-only,\ self-filtering], name: <v>),
    ext((2, 2), [*LLM (Gemini or Groq)*\ capped per day, optional], name: <l>),
    ext((1, 2), [*GitHub Actions*\ daily schedule], name: <g>),
    edge(<p>, <n>, "->", shift: 3pt),
    edge(<p>, <n>, "->", shift: -3pt, label: tag[/api/today, /api/sync], label-side: right, label-sep: 3pt),
    edge(<n>, <db>, "->"),
    edge(<n>, <v>, "->"),
    edge(<n>, <l>, "->"),
    edge(<g>, <n>, "->", label: tag[POST /api/cron/daily\ (shared secret)], label-side: left, label-sep: 3pt),
  )
})

// 2. Data model (section 3)
#let data-model = fit({
  set text(font: sans, size: 7.4pt, fill: ink)
  let e(pos, name, body, key: false) = node(
    pos, name: name,
    fill: if key { accent } else { white },
    stroke: 0.8pt + accent, corner-radius: 3pt, inset: 4pt,
    text(font: mono, size: 7pt, fill: if key { white } else { ink })[#body],
  )
  let group(a, b, name) = node(
    enclose: (a, b), name: name, inset: 7pt, corner-radius: 5pt,
    stroke: (paint: accent, thickness: 0.6pt, dash: "dashed"), fill: accent-soft.lighten(55%),
  )
  diagram(
    spacing: (5mm, 9mm),
    edge-stroke: 0.8pt + accent,
    mark-scale: 70%,
    // spine
    e((0, 0), <campus>, [campus], key: true),
    e((1, 0), <department>, [department]),
    e((2, 0), <programme>, [programme]),
    e((3, 0), <batch>, [batch]),
    e((4, 0), <timetable>, [timetable_slot]),
    edge(<campus>, <department>, "-"),
    edge(<department>, <programme>, "-"),
    edge(<programme>, <batch>, "-"),
    edge(<batch>, <timetable>, "-"),
    // campus children
    e((0, 1), <staff>, [staff]),
    e((1, 1), <user>, [user]),
    e((0, 2), <leave>, [staff_leave]),
    e((1, 2), <cal>, [calendar_day]),
    e((0, 3), <snap>, [report_snapshot]),
    e((1, 3), <audit>, [audit_log\ job_run]),
    e((0, 4), <scheme>, [scholarship_scheme]),
    e((1, 4), <award>, [scholarship_award]),
    group((0, 1), (1, 4), <ga>),
    edge(<campus>, <ga>, "-", label: tag[campus_id], label-side: left),
    edge(<staff>, <user>, "-"),
    edge(<staff>, <leave>, "-"),
    edge(<scheme>, <award>, "-"),
    // programme children
    e((2, 2), <reqdoc>, [required_document]),
    e((2, 3), <feestruct>, [fee_structure]),
    e((2, 4), <applicant>, [applicant]),
    e((2, 5), <appdoc>, [applicant_document]),
    group((2, 2), (2, 5), <gb>),
    edge(<programme>, <gb>, "-", label: tag[programme_id], label-side: left),
    edge(<applicant>, <appdoc>, "-"),
    // student and children
    e((3, 1), <student>, [student], key: true),
    edge(<batch>, <student>, "-"),
    e((4, 1), <entry>, [attendance_entry]),
    e((5, 1), <session>, [attendance_session]),
    e((4, 2), <mark>, [mark]),
    e((5, 2), <comp>, [mark_component]),
    e((4, 3), <subject>, [subject]),
    e((4, 4), <inst>, [fee_instalment]),
    e((5, 4), <pay>, [fee_payment]),
    e((4, 5), <result>, [result\ (subject, student)]),
    e((4, 6), <risk>, [risk_flag]),
    e((5, 6), <riskkids>, [mentor_task\ message\ sync_conflict]),
    edge(<entry>, <session>, "-"),
    edge(<mark>, <comp>, "-"),
    edge(<comp>, <subject>, "-"),
    edge(<inst>, <pay>, "-"),
    edge(<risk>, <riskkids>, "-"),
    edge(<student>, (3.5, 1), "-"),
    edge((3.5, 1), (3.5, 6), "-"),
    ..(1, 2, 3, 4, 5, 6).map(y => edge((3.5, y), (4, y), "-")),
    edge(<applicant>, <student>, "--", label: tag[student_id once confirmed], label-side: right, label-fill: true, label-sep: 2pt),
  )
})

// 3. Offline attendance sync (section 4.1)
#let sync-flow = fit({
  set text(font: sans, size: 8.2pt, fill: ink)
  let lanes = ([Teacher], [Outbox\ (IndexedDB)], [Service worker], [Server\ /api/sync], [Office admin])
  let msg(a, b, y, body, dashed: false) = edge(
    (a, y), (b, y), if dashed { "-->" } else { "->" },
    label: body, label-side: center, label-fill: true, label-sep: 0pt,
  )
  let note(x, y, body) = node((x, y), align(center, body), fill: tint, stroke: 0.6pt + muted, corner-radius: 3pt, inset: 5pt)
  diagram(
    spacing: (12mm, 11mm),
    node-inset: 6pt,
    edge-stroke: 0.9pt + accent,
    mark-scale: 80%,
    ..lanes.enumerate().map(((i, l)) => node((i, 0), align(center, strong(l)), fill: accent-soft, stroke: 0.9pt + accent, corner-radius: 4pt, inset: 6pt)),
    ..range(5).map(i => edge((i, 0.45), (i, 9.4), "--", stroke: 0.5pt + rule-col)),
    msg(0, 1, 1, [Mark class, tap Save\ (no network)]),
    note(1, 2, [Queued with teacher id.\ Home shows "queued"]),
    msg(2, 1, 3, [Online, app opens or\ Background Sync: flush]),
    msg(1, 3, 4, [POST /api/sync\ with client timestamp]),
    note(3, 5, [Correct edit time using phone vs\ server clock gap]),
    msg(3, 1, 6, [Per item: saved, stale,\ conflict or rejected], dashed: true),
    msg(3, 4, 7, [Conflict: another teacher already\ saved this class, queue it]),
    note(1, 8, [Rejected: stays on phone until\ the right teacher signs in]),
    note(4, 9, [Office admin resolves\ the conflict queue]),
  )
})

// 4. Local setup (deployment guide)
#let local-setup = fit({
  set text(font: sans, size: 8pt, fill: ink)
  diagram(
    spacing: (8mm, 8mm),
    node-inset: 7pt,
    edge-stroke: 0.9pt + accent,
    mark-scale: 80%,
    store((0, 0), [*Postgres 18*\ docker compose db\ localhost:54329], name: <db>),
    app((1, 0), [*pnpm db:migrate*\ tables, views,\ read-only role], name: <m>),
    app((2, 0), [*pnpm db:seed*\ synthetic data,\ demo logins], name: <s>),
    app((3, 0), text(fill: white)[*pnpm dev*\ Next.js app\ localhost:3000], name: <a>, strong: true),
    ext((4, 0), [*Playwright*\ pnpm build, then\ E2E=1 pnpm e2e\ (app on :3100)], name: <pw>),
    edge(<db>, <m>, "->"),
    edge(<m>, <s>, "->"),
    edge(<s>, <a>, "->"),
    edge(<a>, <pw>, "->"),
  )
})
