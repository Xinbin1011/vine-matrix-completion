---
name: complete-matrix
description: Complete correlation or covariance matrices with this repository's Python tools, inspect or change partial correlation vine trees, and collect user edge values. Use for matrix-completion sessions in this project.
---

# Complete a matrix interactively

Use the deterministic `vine_completion` package for calculations. Read the
repository README for input fields and `docs/mathematics.md` when explaining
theorem conditions, entropy claims, or a failed reconstruction.

## Start or resume

- Reuse the current problem and choices during follow-up turns. Ask only for
  missing matrix information or consequential choices that cannot be inferred.
- Accept a pasted matrix, JSON, or header-free CSV. Confirm whether the input is
  correlation or covariance when unclear. Require symmetric missing entries and
  observed diagonals; do not infer observations. Labels are 1-based row numbers.
- Save a working problem under `inputs/` and outputs under `results/`. Keep
  supplied matrices out of commits unless the user asks to share them.
- Use a project virtual environment. Install with `python -m pip install -e .`
  if needed. For diagrams use `python -m pip install -e ".[plot]"`.

## Plan, choose, and complete

Run `python -m vine_completion plan inputs/problem.json` first. Explain the
scale, chordality result, proposed trees, and free edges in ordinary language.
Use maximum entropy by default without asking for routine zero values.

- `method: "max_entropy"` computes the chordal maximum-log-determinant matrix
  and expresses it on the chosen vine. This default does not rely on an
  unverified greedy m-saturation assumption. A strategy change alone changes
  the representation, not the unique optimum.
- `method: "vine"` uses explicit edge assumptions. Set it when the user asks
  to supply partial correlations or explore a tree-based completion. Strategies
  are `greedy`, `c-vine`, `d-vine`, and `custom`; `order` controls C/D vines.
  A custom `trees` array supplies every spanning tree. Run a new plan whenever
  the structure changes; existing supplied edges may no longer exist.
- For requested manual entry, set `missing: "error"` and collect the free edges
  listed by the plan (one at a time or together, according to user preference).
  Values are partial correlations in (-1,1), not probabilities. Store them as
  `{"conditioned":[1,3],"conditioning":[2],"value":0.4}` in `partials`.
  A missing first-tree edge takes an ordinary correlation because its
  conditioning set is empty. Do not invent values when user input is required.
- Otherwise use `missing: "zero"` for free edges in vine mode, explaining this
  as an assumption. On an arbitrary vine, zero defaults do not prove maximum
  entropy. Non-chordal input is unsupported by the default solver; offer vine
  exploration or additional supplied entries without promising optimality.

Run `python -m vine_completion complete inputs/problem.json --output results/completed.json --csv results/completed.csv`.
Optionally add `--plot results/trees.png`. An error is a failed attempt, not a
completed result. Preserve fixed observations; do not clip values, triangulate
silently, or replace invalid partial calculations with zero. Explain conflicting
constraints and let the user revise values, structure, or policy.

## Explain and iterate

Show the completed matrix on its original scale, the newly filled entries,
the partial correlations used, and positive-definiteness/maximum-entropy
diagnostics. Link saved artifacts. For comparisons, retain both results and
compare log determinants and changed entries on the same scale. Use
`diagnostics.max_entropy_certified` for a numerical claim about the original
observed constraints; it does not certify an additional nonlinear partial-
constraint optimization problem.

Use dot notation for partial correlation (`rho_{13·2}`), vertical bars for
conditioning, `C` for a copula CDF, `c` for a density, and `C^P` for a partial
copula. A partial correlation vine does not choose copula families. The
established Gaussian input .5, .5, partial .4 yields ordinary correlation .55;
with the same observations, maximum entropy instead yields .25.
