// Shared theme and document template for the Termwise PDFs.
#import "@preview/cmarker:0.1.6"

#let accent = rgb("#1b5e6b")
#let accent-soft = rgb("#e7f0f2")
#let ink = rgb("#14181c")
#let muted = rgb("#5b616d")
#let rule-col = rgb("#d9dee3")
#let tint = rgb("#f3f5f7")

#let sans = ("Noto Sans",)
#let serif = ("Libertinus Serif",)
#let mono = ("JetBrains Mono",)

#let urls = (
  repo: "https://github.com/moneytosms/termwise",
  live: "https://termwise-s1vj.onrender.com",
  site: "https://moneytosms.github.io/termwise/",
)

#let cover(title, subtitle) = {
  set page(margin: (x: 28mm, y: 30mm), header: none, footer: none)
  v(38mm)
  rect(width: 18mm, height: 3pt, fill: accent)
  v(8mm)
  text(font: sans, size: 11pt, tracking: 2pt, fill: accent, weight: "medium")[TERMWISE]
  v(4mm)
  text(font: sans, size: 30pt, weight: "bold", fill: ink)[#title]
  v(4mm)
  text(font: sans, size: 13pt, fill: muted)[#subtitle]
  v(1fr)
  set text(font: sans, size: 9pt, fill: muted)
  grid(
    columns: (28mm, 1fr),
    row-gutter: 7pt,
    text(fill: ink, weight: "medium")[Repository], link(urls.repo),
    text(fill: ink, weight: "medium")[Live app], link(urls.live),
    text(fill: ink, weight: "medium")[Project site], link(urls.site),
    text(fill: ink, weight: "medium")[Date], [November 2026],
  )
  pagebreak()
}

#let callout(body) = block(
  width: 100%,
  inset: (left: 11pt, y: 7pt, right: 8pt),
  stroke: (left: 2.5pt + accent),
  fill: accent-soft,
  radius: (right: 3pt),
  breakable: false,
  body,
)

#let figure-box(body, caption: none) = block(
  width: 100%,
  breakable: false,
  inset: (x: 8pt, y: 10pt),
  stroke: 0.5pt + rule-col,
  radius: 4pt,
  {
    align(center, body)
    if caption != none {
      v(4pt)
      align(center, text(font: sans, size: 8pt, fill: muted, caption))
    }
  },
)

#let template(title, body) = {
  set document(title: title, author: "Termwise")
  set page(
    paper: "a4",
    margin: (x: 24mm, top: 28mm, bottom: 26mm),
    header: context {
      if here().page() > 1 {
        let all = query(heading.where(level: 2))
        let pg = here().page()
        let on = all.filter(h => h.location().page() == pg)
        let before = all.filter(h => h.location().page() < pg)
        let cur = if on.len() > 0 { on.first() } else if before.len() > 0 { before.last() } else { none }
        set text(font: sans, size: 8pt, fill: muted)
        grid(
          columns: (1fr, 1fr),
          [#title],
          align(right, if cur != none { cur.body } else { [] }),
        )
        v(-4pt)
        line(length: 100%, stroke: 0.5pt + rule-col)
      }
    },
    footer: context {
      if here().page() > 1 {
        set text(font: sans, size: 8pt, fill: muted)
        align(center)[#here().page() / #counter(page).final().first()]
      }
    },
  )
  set text(font: serif, size: 10.5pt, fill: ink, lang: "en")
  set par(leading: 0.68em, justify: false, spacing: 1em)
  show link: set text(fill: accent)
  show link: it => underline(offset: 1.5pt, stroke: 0.4pt + accent.lighten(40%), it)

  show heading: set text(font: sans, fill: ink)
  show heading.where(level: 2): it => {
    v(1.4em, weak: true)
    block(sticky: true, below: 0.8em, {
      rect(width: 10mm, height: 2pt, fill: accent)
      v(5pt)
      text(size: 16pt, weight: "bold", it.body)
    })
  }
  show heading.where(level: 3): it => block(
    sticky: true, above: 1.4em, below: 0.7em,
    text(size: 11.5pt, weight: "bold", fill: accent, it.body),
  )
  show heading.where(level: 4): it => block(
    sticky: true, above: 1.1em, below: 0.5em,
    text(size: 10.5pt, weight: "bold", it.body),
  )

  show raw: set text(font: mono, size: 8.2pt)
  show raw.where(block: false): it => box(
    fill: tint, inset: (x: 2.5pt), outset: (y: 2.5pt), radius: 2pt, it,
  )
  show raw.where(block: true): it => block(
    width: 100%, fill: tint, inset: (x: 10pt, y: 8pt), radius: 4pt,
    stroke: 0.5pt + rule-col, breakable: true, it,
  )

  set list(indent: 4pt, body-indent: 6pt, marker: text(fill: accent)[•])
  set enum(indent: 4pt, body-indent: 6pt)
  show list: set block(spacing: 0.9em)
  show enum: set block(spacing: 0.9em)

  set table(
    stroke: (x, y) => (bottom: 0.5pt + rule-col),
    inset: (x: 6pt, y: 5pt),
    fill: (x, y) => if y == 0 { accent } else if calc.odd(y) { tint } else { none },
    align: left + top,
  )
  show table: set text(font: sans, size: 8.3pt)
  show table: set raw(theme: none)
  show table: it => { show raw: set text(size: 7pt); it }
  show table.cell.where(y: 0): set text(fill: white, weight: "bold")
  show table: it => block(width: 100%, breakable: true, it)

  body
}

// Render markdown with cmarker.
#let md(src) = cmarker.render(src, smart-punctuation: false)

// Render a markdown part. Each "**Takeaway: ...**" paragraph becomes a callout;
// `after-first` (content) is placed right after the first takeaway.
#let render(part, after-first: none) = {
  let chunks = part.split("\n**Takeaway")
  md(chunks.first())
  let n = 0
  for c0 in chunks.slice(1) {
    let c = "**Takeaway" + c0
    let cut = c.position("\n\n")
    let head = if cut == none { c } else { c.slice(0, cut) }
    let rest = if cut == none { "" } else { c.slice(cut) }
    callout(md(head))
    n += 1
    if n == 1 and after-first != none { after-first }
    md(rest)
  }
}

// Text of `src` between the first `a` and the next `b` (exclusive of both).
#let between(src, a, b) = {
  let i = src.position(a)
  let rest = src.slice(i + a.len())
  rest.slice(0, rest.position(b))
}
