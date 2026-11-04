# GIRO 2026 · Matrix completion with partial correlation vines

**Team members: Tim Harrison, Paul Hewson and Xinbin Xu.**

Complete an incomplete correlation or covariance matrix while preserving the
supplied entries. The GIRO worked example follows one clear story:

- Problem: fill four missing ordinary Pearson correlations while keeping six supplied pairs fixed. A positive semidefinite (PSD) matrix alone does not justify the added modelling assumptions.
- How: choose maximum entropy as the completion principle and use a Gaussian model as the worked example. At fixed variances, maximising Gaussian entropy reduces to maximising det(R); a partial-correlation vine factorises that determinant.
- Result: in the compatible GIRO vine, six factors are fixed by supplied information and four free factors are maximised by zero partial correlations. Reconstruction fills all four gaps, preserves known inputs and gives a positive definite matrix. The vine exposes the connections, conditioning relationships and partial-correlation assumptions behind the model.

Want to help improve it? [Add the project to Codex and contribute](#add-this-project-to-codex-and-contribute).

| Resource | Use |
| --- | --- |
| [Interactive demo](https://xinbin1011.github.io/vine-matrix-completion/) | Change inputs and inspect the calculation in your browser. Works when the project PC is switched off. |
| [Read the conference notebook](https://xinbin1011.github.io/vine-matrix-completion/notebook.html) · [notebook source](notebooks/GIRO_2026_matrix_completion.ipynb) | Follow the workflow, function map and all four missing-correlation calculations using the Python package. |
| [Published D17 graph slides · 1 November 2026](docs/resources/GIRO_2026_Matrix_Completion_Graph_D17_2026-11-01.pdf) · [Published D17 matrix slides · 1 November 2026](docs/resources/GIRO_2026_Matrix_Completion_Matrix_D17_2026-11-01.pdf) | Published two-slide alternatives: graph or matrix presentation. |
| [D10 slides (earlier version)](docs/resources/GIRO_2026_D10_slides.pdf) | Preserved at the original address so existing links still work. |
| [Local Python demo](https://xinbin1011.github.io/vine-matrix-completion/resources/local-python-demo.zip) | Download, extract and follow START_HERE.txt for the local-server alternative. |
| [Previous release · 3 November 2026](https://xinbin1011.github.io/vine-matrix-completion/versions/2026-11-04-before-greedy-rule-clarification/) · [previous notebook](https://xinbin1011.github.io/vine-matrix-completion/versions/2026-11-04-before-greedy-rule-clarification/notebook.html) | Preserved before the greedy-rule clarification. |

The website loads Python, NumPy and NetworkX into a browser worker through
Pyodide. Its first load needs an internet connection and downloads the runtime;
calculations then use the same package source as the notebook and local Python
version. Input matrices stay in the browser. No model API or API key is used.

The default demo uses rounded GIRO inputs; the original full-precision notebook
example is labelled separately. The notebook, source package and slides
describe matrix completion, not an empirically calibrated insurance model.

## Modelling choices exposed by the vine

Judgement 1 selects a vine structure. The greedy rule is **known information first;
then strongest |ρ|**. At each tree, eligible edges computable from fully supplied
input blocks rank first, then absolute correlation strength, with deterministic
ties and cycle avoidance. This is a local choice given earlier trees, not a search
over complete vines. Spanning-tree and proximity rules govern validity; preserving
supplied ordinary correlations is a separate completion requirement.

Judgement 2 selects partial-correlation assumptions or a completion objective.
In this compatible example, the maximum-determinant solution has four zero free
partial correlations in the selected vine. This does not justify setting arbitrary
missing ordinary correlations or arbitrary vine partials to zero. A Gaussian
interpretation is an additional model assumption; the matrix alone does not select
a copula family.

For a complete partial-correlation vine, det(R) = ∏ₑ(1 − ρₑ²). In the compatible
GIRO representation, the known factors stay fixed, so the optimisation reduces to
four zero partial assignments. This simplification does not apply to arbitrary
zero-filling on other vines.

The vine exposes modelling choices: which variables connect, what is conditioned
on, and which partial correlations are supplied or assumed. The completion
principle and distributional assumptions are further model choices; expert
judgement is one input. A valid matrix need not be closest to the unknown truth.
See [Kurowicka and Cooke (2006), §4.2](https://doi.org/10.1016/j.laa.2006.01.031)
and the [determinant/entropy explanation](https://xinbin1011.github.io/vine-matrix-completion/#note-maxdet).

With more business information, underwriters can help articulate residual
dependence. That knowledge can inform revised partial-correlation assumptions,
which should be recorded and checked again. Algebraic validity and evidence for
the assumptions remain separate questions.

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
Its [workflow diagram](docs/resources/completion-workflow.png) and
[entry-dependency diagram](docs/resources/missing-correlation-dependencies.png)
show the two completion policies and the four reconstruction steps. The function
map explains inputs, outputs and roles; the supporting reference covers validation,
the chordal solver and result fields.
The underlying method is from published theory; browser presentation and
additional validation used Codex assistance.

## Versions and preservation

The [previous published demo before the 3 November narrative update](https://xinbin1011.github.io/vine-matrix-completion/versions/2026-11-03-before-narrative-update/)
retains its solver, notebook and dated D17 slide resources.

The [previous online demo](https://xinbin1011.github.io/vine-matrix-completion/versions/2026-11-01-before-ui-update/)
preserves the complete public site before the 1 November interface update,
including its browser solver and resource links. The current demo adds the staged
settings, simple equations/matrix calculation views, lower colour legends,
construction-rule notes and manual vine editor from the reviewed demo interface.

The [previous repository version](https://github.com/Xinbin1011/vine-matrix-completion/tree/831dbe006b2f5b9cce7fff55bbe2baee7a4a1175)
remains available in Git history. Original research notebooks, the prior demo
and slide revisions were also preserved in a dated local archive before this
update. [Resource provenance](docs/resources/versions.json) records the baseline
hashes. D10 is included unchanged; the full team deck and Overleaf project are
maintained separately.

The previous conference notebook is preserved as
[v1 web view](https://xinbin1011.github.io/vine-matrix-completion/notebook-v1.html)
and [v1 notebook source](notebooks/GIRO_2026_matrix_completion_v1.ipynb).

## Build and run the browser site locally

```text
python tools/build_giro_site.py
python -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open `http://127.0.0.1:8000/`. This exercises the browser solver, without a Python
calculation endpoint. `web/local-demo` is the reviewed source snapshot used to
build the site; the separately maintained working UI is not overwritten.

## Add this project to Codex and contribute

You need Git, Python 3.10 or later, and access to Codex. Contributions are submitted
as pull requests for review.

1. **Fork this repository** to your own GitHub account using
   [Fork](https://github.com/Xinbin1011/vine-matrix-completion/fork).
2. **Clone your fork and create a branch.** Replace `YOUR-USERNAME` below:

   ```bash
   git clone https://github.com/YOUR-USERNAME/vine-matrix-completion.git
   cd vine-matrix-completion
   git switch -c my-improvement
   ```

3. **Open the cloned folder in Codex.** In the desktop app, create or open a local
   project. Use its project menu → **Edit project → Add folder**, select the cloned
   `vine-matrix-completion` folder, and make it the **primary folder**. Start a new
   chat inside that project. In an IDE, open the cloned folder before starting
   Codex; with the CLI, run `codex` from that directory.
   See [OpenAI's project instructions](https://learn.chatgpt.com/docs/projects).
4. **Give Codex a specific contribution task.** For example:

   > Read AGENTS.md, README.md and the GIRO notebook. Set up a local Python virtual
   > environment and install this repository with the dev and plot extras.
   > Help me improve [describe one change]. Explain the approach, make the change,
   > preserve the supplied matrix entries and project notation, run the relevant
   > checks, and show me the diff.

   The setup command, after activating the environment, is
   `python -m pip install -e ".[dev,plot]"`.
   [Manual setup commands](#install-and-run-directly) are below.
5. **Check and review the change.** Run `python -m pytest` for numerical-code
   changes. For notebook changes, run the affected cells and inspect their outputs.
   For demo changes, check the affected browser workflow. Include the results in
   your pull request.
6. **Commit and push the branch to your fork**, using your Git tools or asking
   Codex to help. Open a pull request from that branch into
   **`Xinbin1011/vine-matrix-completion` → `main`**. Describe what changed, why, and
   how you checked it. A fork does not require write access to this repository.

Useful first contributions include clearer notebook explanations, new worked
examples, browser usability improvements and tests for a reported problem.

### Try the included matrix-completion skill

The repository includes `AGENTS.md` and `.agents/skills/complete-matrix/SKILL.md`.
Opening the cloned folder gives Codex the project instructions and repository
skill. Ask:

   > Use $complete-matrix to complete examples/five_by_five.json. Show the trees,
   > use maximum entropy by default, and explain the missing entries.

Continue in the same conversation:

   > Try a D-vine with order 5,1,2,4,3. Show which partial correlations are free.

   > Switch to vine completion and ask me for each free edge value.

   > Set the partial correlation for variables 1 and 3 after removing variable 2
   > to 0.4. Keep the observed correlations fixed.

The last request needs a vine containing that particular edge; Codex checks the
plan first. For a worked three-variable example, use
[`examples/gaussian_partial.json`](examples/gaussian_partial.json).

Codex discovers repository skills under `.agents/skills`. If the skill does not
appear, restart Codex. See the
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
