---
name: yoyo-design
description: Author or re-author docs/DESIGN.md — design invariants plus a direction system proportional to the project's owned design surface — from the PRD, the repo, and a spec-style interview. Use when a project needs its design bar written, or for a direction-level change. Interactive — requires the user present; DESIGN.md is its entire write surface.
---

# Yoyo-loop designer

Run manually by the user, once per project — and re-run for direction-level
changes. The sole deliverable is authoring or re-authoring `docs/DESIGN.md`:
the design bar the rest of the loop consumes. /yoyo-spec gates UI milestones
on this file being authored, and /yoyo-review judges `[DESIGN]` findings
against it — a must-fix needs a named invariant to cite, so every invariant
written here must be citable: imperative, atomic, and checkable from a
screenshot or the diff. Vague rules produce unenforceable reviews.

DESIGN.md holds rules that stay true while the UI changes. It NEVER
describes the current UI — no screenshots, no "the header currently",
no component inventory of today's pages. A rule that would need editing
when a screen is redesigned is state, not design, and does not belong.

## 1. Research before asking

Read, in order, before the first question:

- `docs/PRD.md` in full — the product source of truth. Extract every
  design-binding decision it already makes (audience, platforms, brand
  constraints, RTL/locale requirements, host-site constraints, explicit
  non-goals).
- The repository: existing UI surfaces, `ui_paths` and theme constraints,
  current styling approach (tokens, CSS framework, component library), and
  the current `docs/DESIGN.md` — placeholder, or authored content being
  re-authored (never discard existing invariants silently; carry, revise,
  or retire each one explicitly with the user).

Never ask the user something the PRD or the repository already answers.
Interview only on taste and direction where the PRD is silent.

## 2. Claude Design as optional upstream

Ask whether the user has Claude Design output for this project — a design
kit, mockups, or a generated site. When they do, treat it as upstream raw
material: distill it into DESIGN.md tokens and invariants (exact values,
ratios, component language), crediting it as the source of direction. When
they do not, author from PRD + interview alone. The loop never depends on
Claude Design existing — it is an accelerant, not a dependency, and this
skill's output is identical in kind either way.

## 3. Interview in rounds — spec-style

Short rounds, 1–4 questions each, every question with concrete options and
the recommended option first. Only genuine direction forks. Techniques that
raise the answers above amateur level:

- **Adjectives become values.** "Clean", "premium", "playful" never enter
  the file. Push each one to something exact: a type-scale ratio, a spacing
  base, a named palette role with a hex anchor, a density budget, a corner
  radius. If the user answers in adjectives, propose the values those
  adjectives imply and confirm.
- **Offer named directions.** When direction is genuinely open, propose two
  or three coherent candidate directions — each with a one-line pitch, its
  signature moves, and when it fits — recommended one first, rather than
  asking twenty atomised questions. One deliberate, justified aesthetic
  risk per direction beats none.
- **Floors are not questions.** Accessibility and correctness floors go in
  as invariants without asking: readable contrast (WCAG AA) in every theme
  and state, honored `prefers-reduced-motion`, adequate hit targets,
  correct RTL via logical properties where the product has RTL locales,
  and a designed loading/error/empty state for every surface. The
  interview covers taste, not table stakes.
- **Anti-patterns are invariants too.** Named things this product must
  never look like (stock AI-slop tells, off-brand cliches, the host site's
  competitors) are as durable and citable as positive rules.

Apply the spec confidence test before writing: could two different
builders read this file and produce work the reviewer would judge the
same way?

## 4. Proportionality — decide the case and say so

The Direction system section's depth is proportional to how much design
surface the project actually owns, and the file must state which case
applies and why:

- **Widget-class** (unfiltered: UI living inside someone else's site) —
  the direction section is near-empty by design. The governing invariant
  is: **the host store's design IS the design** — the widget inherits and
  never alters it — plus footprint rules (shopper-visible footprint
  bounded, e.g. ≤ chips-level), RTL correctness, and state rules. Writing
  a type scale for a widget that must disappear into its host is wrong,
  not thorough.
- **Owned pages** (playground, briza: the project draws its own screens) —
  the direction system is real and load-bearing: type scale (a named ratio
  and its steps), spacing scale, color tokens with roles and hex anchors,
  motion budget (durations, easings, and what never animates), and a
  component language (what buttons, cards, forms, and emphasis look like,
  as rules and relationships rather than a component inventory). Prefer
  ratios and relationships over absolute values where possible — they
  survive a re-skin; a lone hex value does not.

A project can sit between cases (an owned page inside a constrained
brand); then the file states the split explicitly — which surfaces inherit
and which are owned.

## 5. Write the file

`docs/DESIGN.md` has exactly two content sections:

1. **Invariants** — always present. The reviewer-enforceable rules: floors,
   footprint/RTL/state rules, anti-patterns, and the direction-level rules
   promoted to always-true (e.g. "exactly one accent hue per view"). Each
   one imperative, atomic, and checkable — written to be cited by name in
   a `[DESIGN]` must-fix.
2. **Direction system** — proportional per section 4, with the applying
   case and its rationale stated at the top of the section.

The file also carries its own maintenance rule, written into it verbatim
in substance: a design-affecting PRD amendment updates DESIGN.md in the
same PR; re-running /yoyo-design is the authoring path for larger
direction changes — no other update path, no generation pipeline.

Show the user the complete draft in chat and get their go-ahead before
writing anything — their approval of this file is what activates the
design gate. Then write `docs/DESIGN.md`, commit it on a feature branch,
push, and open a PR for the user to merge. When the repository has the
repo-map drift guard (`scripts/repo-map.mjs` with a `--check` CI step),
run `node scripts/repo-map.mjs` after writing DESIGN.md and commit the
regenerated `docs/REPO-MAP.md` in the same PR — a new file changes the
tree, and the guard fails the PR otherwise.

## Hard rules

- `docs/DESIGN.md` (and the PR that ships it) is this skill's entire write
  surface: it never edits product code, never touches any other file,
  never applies `agent-ready`, and never merges. One mechanical carve-out:
  when the target repository has the repo-map drift guard
  (`scripts/repo-map.mjs` with a `--check` CI step), the skill regenerates
  `docs/REPO-MAP.md` in the same PR after writing DESIGN.md — a
  CI-mechanical regeneration by running the generator, never a hand edit,
  and never license to touch product code or any other file.
- Never invent product facts: direction comes from the PRD, the repo, the
  user's answers, and optional Claude Design output — cited, not guessed.
- Interactive only: never run unattended, and never write the file without
  the user's explicit go-ahead on the full draft.
