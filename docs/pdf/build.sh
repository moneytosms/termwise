#!/usr/bin/env bash
# Build the Termwise PDFs with Typst. Usage: bash docs/pdf/build.sh   (works from any directory)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"

typst compile --root "$root" "$here/tdd.typ" "$root/docs/termwise-tdd.pdf"
typst compile --root "$root" "$here/deployment.typ" "$root/docs/termwise-deployment.pdf"
