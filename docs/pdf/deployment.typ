#import "lib.typ": *
#import "diagrams.typ"

#show: template.with("Termwise: Deployment Guide")
#cover([Deployment Guide], [Rebuild Termwise locally, verify it, and sign in with the demo accounts.])

#outline(title: [Contents], depth: 2, indent: 0pt)
#pagebreak()

#let body = {
  let full = read("../deployment.md")
  // Allow a line break after the "@" of demo emails so table cells never overflow.
  full.slice(full.position("You can rebuild")).replace("@termwise.demo", "@\u{200b}termwise.demo")
}

#let at = body.position("```bash\ngit clone")
#render(body.slice(0, at))
#figure-box(diagrams.local-setup, caption: [Figure 1. Local setup order: database, migrate, seed, app, then the browser tests.])
#v(0.6em)
#render(body.slice(at))
