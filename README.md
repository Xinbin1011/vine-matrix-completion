# GIRO 2026 · Matrix completion with partial correlation vines

**Team members: Tim Harrison, Paul Hewson and Xinbin Xu.**

Complete an incomplete correlation or covariance matrix while preserving the
supplied entries. Inspect the observed graph, vine, partial-correlation
assumptions, numerical reconstruction and validity checks.

| Resource | Use |
| --- | --- |
| [Interactive demo](https://xinbin1011.github.io/vine-matrix-completion/) | Change inputs and inspect the calculation in your browser. Works when the project PC is switched off. |
| [Read the conference notebook](https://xinbin1011.github.io/vine-matrix-completion/notebook.html) · [notebook source](notebooks/GIRO_2026_matrix_completion.ipynb) | Reproduce the GIRO example using the Python package. |
| [D10 slides](docs/resources/GIRO_2026_D10_slides.pdf) | The two-slide matrix-completion section selected for this package. |
| [Local Python demo](https://xinbin1011.github.io/vine-matrix-completion/resources/local-python-demo.zip) | Download, extract and follow START_HERE.txt for the local-server alternative. |

The website loads Python, NumPy and NetworkX into a browser worker through
Pyodide. Its first load needs an internet connection and downloads the runtime;
calculations then use the same package source as the notebook and local Python
version. Input matrices stay in the browser. No model API or API key is used.

The default demo uses rounded GIRO inputs; the original full-precision notebook
example is labelled separately. The notebook, source package and D10 slides
describe matrix completion, not an empirically calibrated insurance model.

## Use the package in a notebook

After installing this repository, import the functions instead of copying them:

```python
from vine_completion import complete_matrix

result = complete_matrix(matrix, kind="covariance", method="max_entropy")
result.matrix         # completed covariance matrix
result.diagnostics   # numerical checks
```

See [the conference notebook](notebooks/GIRO_2026_matrix_completion.ipynb) for
the supplied entries, explicit vine assumptions and a complete worked result.
The underlying method is from published theory; browser presentation and
additional validation used Codex assistance.

## Versions and preservation

The [previous repository version](https://github.com/Xinbin1011/vine-matrix-completion/tree/831dbe006b2f5b9cce7fff55bbe2baee7a4a1175)
remains available in Git history. Original research notebooks, the prior demo
and slide revisions were also preserved in a dated local archive before this
update. [Resource provenance](docs/resources/versions.json) records the baseline
hashes. D10 is included unchanged; the full team deck and Overleaf project are
maintained separately.

## Build and run the browser site locally

```text
python tools/build_giro_site.py
python -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:8000/`. This exercises the browser solver, without a Python
calculation endpoint. `web/local-demo` is the reviewed source snapshot used to
build the site; the separately maintained working UI is not overwritten.

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

Copyright (c) 2026 Xinbin Xu. Released under the [MIT licence](LICENSE).
