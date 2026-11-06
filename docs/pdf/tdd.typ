#import "lib.typ": *
#import "diagrams.typ"

#show: template.with("Termwise: Technical Design Document")
#cover([Technical Design Document], [One college record, from admission to graduation.])

#outline(title: [Contents], depth: 2, indent: 0pt)
#pagebreak()

#let full = read("../tdd.md")

// The title and link block are on the cover and the md contents list is replaced by the outline.
#let body = {
  let a = full.position("## At a glance")
  let b = full.position("## Contents")
  let c = full.position("## How to read this")
  full.slice(a, b) + full.slice(c)
}

// Split around the two diagram spots (fenced blocks) without editing the md.
#let fence = "```"
#let mermaid-start = body.position(fence + "mermaid")
#let mermaid-end = mermaid-start + body.slice(mermaid-start).position("\n" + fence + "\n") + 5
#let ascii-start = body.position(fence + "\ncampus")
#let ascii-end = ascii-start + body.slice(ascii-start).position("\n" + fence + "\n") + 5

#let part-a = body.slice(0, mermaid-start)
#let part-b = body.slice(mermaid-end, ascii-start)
#let part-c = body.slice(ascii-end)

#render(part-a)
#render(part-b, after-first: figure-box(diagrams.architecture, caption: [Figure 1. Architecture: one Next.js app, one Postgres database, two database roles.]))

// Part C continues after the data model figure; the takeaway before it is the end of part B.
#figure-box(diagrams.data-model, caption: [Figure 2. Data model: a student exists once and everything hangs off that row.])
#v(0.6em)
#let split-at = part-c.position("### 4.2 Marks and moderation")
#render(part-c.slice(0, split-at))
#figure-box(diagrams.sync-flow, caption: [Figure 3. Offline attendance: from a tap with no network to a per-item outcome on the server.])
#v(0.6em)
#render(part-c.slice(split-at))
