# Vine matrix completion

Complete a partially specified correlation or covariance matrix, inspect its
partial correlation vine, and explore alternative trees and edge assumptions
with Codex.

Based on **Xinbin (Max) Xu's `5x5 Matrix Completion.py`**. The numerical functions
are organized into importable modules, with a command-line interface and a
repository-local Codex skill. Your own Codex runs the Python tools and explains
the results. The package makes no model API calls and needs no separate API key.

## Start with Codex

1. Clone this repository and open its folder as a project in Codex.
2. Ask:

   > Use $complete-matrix to complete examples/five_by_five.json. Show the trees,
   > use maximum entropy by default, and explain the missing entries.

3. Continue in the same conversation:

   > Try a D-vine with order 5,1,2,4,3. Show which partial correlations are free.

   > Switch to vine completion and ask me for each free edge value.

   > Set the partial correlation for variables 1 and 3 after removing variable 2
   > to 0.4. Keep the observed correlations fixed.

The last request needs a vine containing that particular edge; Codex checks the
plan first. For a worked three-variable example, use
[`examples/gaussian_partial.json`](examples/gaussian_partial.json).

Codex discovers the skill in `.agents/skills/complete-matrix/`. If it does not
appear, reopen the project/restart Codex. See the
[official skill documentation](https://learn.chatgpt.com/docs/build-skills).
The repository must be available in a Python-capable Codex environment; pasting
its GitHub URL into a chat alone does not install or execute the package.

## Install and run directly

Requires Python 3.10 or later. From the repository folder:

```bash
python -m venv .venv
```

Activate `.venv` (`.venv\Scripts\Activate.ps1` in PowerShell,
`source .venv/bin/activate` on macOS/Linux), then:

```bash
python -m pip install -e ".[dev]"
python -m vine_completion plan examples/five_by_five.json
python -m vine_completion complete examples/five_by_five.json --output results/default.json --csv results/completed.csv
python -m vine_completion complete examples/gaussian_partial.json
python -m pytest
```

`vine-complete` is also installed as a short command. Both commands emit strict
JSON and return exit code 2 for invalid inputs, conflicting constraints, or
missing edge values. Plan output shows the free edges before completion.

For diagrams, install `python -m pip install -e ".[plot]"`, then add
`--plot results/trees.png` to a plan/complete command. Plotting is optional and
never opens a window automatically.

## Two completion policies

| Policy | Behavior |
| --- | --- |
| `max_entropy` (default) | Exact maximum-log-determinant completion for a chordal observed graph with positive definite specified cliques. Uses clique/separator precision assembly and verifies the result numerically. |
| `vine` | Reconstructs correlations in tree order from explicit partial correlations. Unspecified free edges default to zero, or use `missing: "error"` to require values from the user. |

The default follows the maximum determinant objective of the original notebook.
With fixed variances this also maximizes **Gaussian differential entropy**.
The theorem discussed in that notebook requires a chordal graph and an
m-saturated incomplete vine. A greedy tree selection alone does not establish
those conditions. The default therefore computes the chordal solution directly
and then expresses it on the selected vine. Changing that representation leaves
the unique optimum unchanged; free partials need not all be zero in an arbitrary
representation.

In `vine` mode, tree choices and edge values can change the completed matrix.
Zeros on an arbitrary vine are modeling assumptions. The report labels maximum
entropy only when the completed matrix passes a numerical precision-matrix
certificate. That certificate concerns the original observed-entry constraints;
it does not test entropy optimality under additional user partial constraints.

The default rejects non-chordal input with a clear explanation. You can explore
it with `--method vine`; some edge assumptions are incompatible with the fixed
entries and will be rejected. This version does not implement general
non-chordal log-determinant optimization or singular PSD completions.

## Input

JSON is recommended. Use `null` for missing entries on both sides of the
diagonal. Variable labels are **1-based**, in row order.

```json
{
  "kind": "correlation",
  "matrix": [[1, 0.5, null], [0.5, 1, 0.5], [null, 0.5, 1]],
  "method": "vine",
  "strategy": "d-vine",
  "order": [1, 2, 3],
  "missing": "error",
  "partials": [
    {"conditioned": [1, 3], "conditioning": [2], "value": 0.4}
  ]
}
```

This specifies partial correlation `rho_{13·2} = 0.4`; the completed ordinary
correlation is `rho_{13} = 0.55`. A correlation parameter is not a probability.

Optional fields: `kind` (`correlation` or `covariance`), `method`, `strategy`,
`order`, `partials`, `missing` (`zero` or `error`), `trees`, and numerical `tol`
(default `1e-10`). The declared matrix scale is ordinary Pearson correlation;
it is latent Gaussian correlation only when that assumption is explicitly made.
Covariance inputs are standardized internally and restored to their original
units in `matrix` and CSV output. `correlation` always contains the standardized
result. Small asymmetries within `tol` are averaged during validation.

You can also provide a bare JSON matrix or a header-free numeric CSV. CSV uses
blank cells, `NA`, `NaN`, or `null` for missing entries; select `--kind covariance`
when appropriate. Use `inputs/` and `results/` for your own data and outputs;
both directories are ignored by Git.

## Tree strategies

- `greedy`: prioritize observed, computable edges, then largest absolute partial
  correlations, with deterministic tie-breaking. Default.
- `c-vine`: successive root variables follow `order` (natural row order if omitted).
- `d-vine`: the first tree is the path specified by `order`.
- `custom`: supply every tree explicitly in JSON. All trees must be connected,
  acyclic, and satisfy the regular-vine proximity condition.

For example, a custom three-variable vine is:

```json
{
  "matrix": [[1, 0.5, null], [0.5, 1, 0.5], [null, 0.5, 1]],
  "strategy": "custom",
  "trees": [
    [{"conditioned": [1, 2]}, {"conditioned": [2, 3]}],
    [{"conditioned": [1, 3], "conditioning": [2]}]
  ]
}
```

CLI flags override matching fields in the input file:

```bash
python -m vine_completion plan examples/five_by_five.json --strategy d-vine --order 5,1,2,4,3
python -m vine_completion complete examples/five_by_five.json --method vine --missing error
```

## Python API and module map

```python
import numpy as np
from vine_completion import complete_matrix, partial_corr

r = np.array([[1, .5, np.nan], [.5, 1, .5], [np.nan, .5, 1]])
default = complete_matrix(r)  # rho_13 = 0.25
alternative = complete_matrix(
    r, method="vine", strategy="d-vine", order=[1, 2, 3],
    partials=[{"conditioned": [1, 3], "conditioning": [2], "value": .4}],
)
assert np.isclose(alternative.correlation[0, 2], .55)
print(default.diagnostics)
```

| Module | Purpose |
| --- | --- |
| `matrix.py` | Validate matrices and convert covariance/correlation scales |
| `partials.py` | Compute partial correlations and reverse them into ordinary correlations |
| `graphs.py` | Build observed graphs and solve chordal maximum entropy completion |
| `vines.py` | Build and validate greedy/C/D/custom regular vines |
| `completion.py` | Apply policies, preserve observations, and verify results |
| `io.py`, `cli.py` | JSON/CSV files and terminal/Codex interface |
| `plotting.py` | Optional saved tree diagrams |

The original research script and notebooks remain in the author's working
folder. This repository contains the extracted implementation and the public
worked examples. See [the mathematical notes](docs/mathematics.md) for the
inverse formula, validation checks, and original-function mapping.

## Reference

D. Kurowicka and R. M. Cooke (2006), *Completion problem with partial correlation
vines*, Linear Algebra and its Applications 418, 188–200.
[DOI](https://doi.org/10.1016/j.laa.2006.01.031) ·
[TU Delft record](https://research.tudelft.nl/en/publications/completion-problem-with-partial-correlation-vines/).
The original notebook's “2025” citation has been corrected to the publication
year in this repository.

## Licence

Copyright (c) 2026 Xinbin (Max) Xu. Released under the [MIT licence](LICENSE).
