# Matrix-completion explorer — local review

The current application is the general explorer in `dist/index.html`, served by
`serve.py`. It retains the original visual style and follows the GIRO process
presentation, pages 3–7. The earlier two-scenario preview has been superseded.

## Open the working preview

Double-click **Open Matrix Explorer.cmd** in this folder. It opens your browser
and starts the local Python server hidden if necessary. If the explorer is
already running, it reuses it instead of starting another server. No Codex
session needs to remain open. Run the launcher again after a computer restart
or if the server has stopped; it does not run automatically at Windows startup.

While the local server is running: <http://127.0.0.1:8766>.
This address works only on this computer. Nothing has been publicly deployed.
Opening `index.html` directly is insufficient: the explorer uses the existing
Python package through a localhost-only endpoint.

From the Vine Copulas project root in PowerShell:

```powershell
& '.\vine-matrix-completion\.venv\Scripts\python.exe' -B '.\employer-demo\serve.py'
```

Stop the server with Ctrl+C. It binds only to `127.0.0.1`, serves `dist/`, and
accepts small, same-origin calculation requests. It does not write input data,
make external requests or use a model API. The project environment already has
NumPy and NetworkX; no dependencies were installed for this demonstration.

The Ctrl+C instruction applies to the foreground command above. Launcher-started
servers are detached and hidden; their startup/error logs and last-launch record
are in `runtime/`. If port 8766 belongs to another application, the launcher
reports the conflict without stopping or replacing that application. The
one-click Windows launcher expects the existing project virtual environment.

## Suggested five-minute exploration

1. In **Input & graph**, choose the GIRO example or supply a 3–7 variable
   matrix. Edit or hide correlations. The pair-count and feasibility banner appears
   on this page. Choose **Next: Expand vine** to confirm.
2. In **Expand vine**, choose Greedy, C-vine or D-vine and, for C/D, a variable
   order. Follow the plain, unboxed guide with its bold labels to inspect the trees,
   then choose **Next: Assign partials**.
   The **Construction rules [2]** link opens the end note covering the first tree,
   higher-tree edge-to-node inheritance, spanning-tree counts, proximity and
   Kurowicka/Cooke Definitions 3.1–3.2. **Back** returns to Step 2.
   For a custom structure, use **Manual connections** / **Edit connections**.
   Start from the automatic vine, click an edge to remove it, then select nodes
   and allowed-target buttons to reconnect. Cycle and proximity warnings guide
   edits; incomplete drafts block **Next**. Use **Undo** or **Reset connections**
   as needed. Changed structure clears affected higher trees and resets affected
   partial judgements while retaining unchanged earlier judgements. Matrix entries
   stay fixed. Structural diagram labels are conditioned/conditioning sets; assign
   values in Step 3.
3. In **Assign partials**, select **Set partial correlations** and review or edit
   every free value, or select **Maximum determinant** for a supported chordal
   graph. Visible zeros are assumptions. Choose **Start reconstruction**.
4. In **Reconstruct**, the sidebar **Calculation** view starts with **Simple
   equations** and also offers **Matrix derivation**. Both show the same accepted
   result, with all workings together. Matrix details are open by default in matrix
   view. The prominent current-step card identifies the active workflow stage.
5. In **Result & compare**, inspect diagnostics, optionally reveal a generated
   reference, and download the scenario.
6. **Back** retains choices. Changing earlier input, structure or partials clears
   dependent results. Trying to skip a required confirmation or continue with
   invalid or unapplied choices shows a warning.
7. For generated inputs, the seed repeats the matrix. After changing generation
   settings, choose **Generate matrix**. Hide correlations symmetrically; the
   separate random-selection seed repeats a selection on the same starting input.
   Hidden reference values are not sent to the solver, and completion need not
   recover them.
8. The page offers **Download notebook** and [GitHub](https://github.com/Xinbin1011/vine-matrix-completion) beside **Open explorer**.


The shared key explains notation, proximity, `?` and “later”. Notes and references
are detached from the worksheet in the final page section, with numbered links
and working backlinks. They explain maximum determinant and where it applies.
Graph edge coefficients display approximate two-decimal values; calculation
inputs retain their full precision. Graph set notation uses semicolons for
conditioning; equation notation uses a dot for partial correlation.

The demo-wide data colours have the same meaning in matrices, graphs, partial
inputs, traces, results and static worked examples: black for known values,
including quantities calculable from supplied inputs; GIRO orange (`#e66914`)
for unresolved values; and blue (`#0057b8`) for applied judgements and resulting
estimates. Estimates remain distinct from known inputs.
The legend uses small 9px coloured squares with plain labels below the
relevant matrix, graph or tree. Result legends include known and estimated
entries.

In the simple maximum-determinant view, shared-variable/separator equations
solve one missing pair at a time, and each result is checked against the
existing solver. The explicit-vine view uses the existing reverse-partial
equations. No backend or package change was needed.

## Mathematical scope

Matrices are ordinary Pearson correlation matrices. The UI uses dot notation
for partial correlations, translating the presentation's vertical-bar shorthand.
Neither the matrix nor the vine determines marginal distributions or a copula.

Maximum determinant uses the package's exact chordal clique/separator precision
calculation. Its actual intermediate sums and inversion are displayed. Changing
the vine representation alone leaves the unique optimum unchanged. General
nonchordal maximum-determinant optimisation and singular PSD solutions are not
implemented. A nonchordal rejection is an unsupported policy, not an infeasibility
proof. Random masking of a generated PD matrix still has a feasible completion,
even if the default chordal solver cannot compute it.

Explicit vine mode uses the chosen free partials and reconstructs in tree order.
Zeros are not a universal validity or maximum-determinant guarantee. Incompatible
choices are rejected without modifying supplied values or changing the method.
Certificates concern the original supplied entries, not optimisation under
additional partial constraints. Gaussian entropy needs a Gaussian model and
fixed variances. There is no empirical insurance, capital or tail-dependence
validation.

The slide preset uses the **rounded page 3 inputs**, giving R13 ≈ −0.460023,
R25 = 0.219164, R35 ≈ 0.172049 and R45 = −0.115566; minimum eigenvalue ≈
0.066817176 and log determinant ≈ −2.641548775. This differs slightly from the
full-precision notebook preset. Slide 5's printed −0.115 for R45 does not match
rounding the page 3 inputs; the application calculates from its actual inputs.

## Verification and evidence

- `validation/general-backend-validation.json`: 214 checks across dimensions
  3–7, arbitrary symmetric masks, all three strategies, orders, incompatible
  constraints and invalid inputs. The existing 214 regression checks passed. The adapter's traces agree with the unchanged
  package and fresh diagnostics. The source-recovery check is an oracle-assisted
  formula round trip, not statistical recovery evidence.
- `validation/custom-vine-checks.json`: 90 edited vines across dimensions 3–7;
  90 cycle and 99 proximity warnings; 10 invalid API cases; 78 maximum-
  determinant comparisons with difference 0; and 12 unsupported nonchordal
  cases preserved. Oracle-source round-trip checks are not statistical recovery.
- `validation/simple-equations-checks.json`: 158 equation checks across
  dimensions 3–7, separator sizes up to 5, and disconnected groups; includes five
  rejection checks, with maximum difference 9.06e-13 against the existing solver.
- `validation/explorer-ui-checks.json`: browser interaction evidence, including
  partial 0.4 → blank/1.2 rejection → corrected 0.2, malformed manual input,
  unsupported nonchordal input, symmetric editing, seeded generation/masking,
  held-out comparison, and strategy/order controls.
- `validation/explorer-desktop-input.jpg`, `explorer-desktop-vines.jpg`, and
  `explorer-desktop-reconstruction.jpg`: current process screenshots.
- `CASE_STUDY.md`: GIRO 2026 technical summary and worked example.
- `dist/research/notebook.ipynb`: validated notebook working copy. The original
  research notebook and outputs remain unchanged in the parent project.

Run the current numerical comparison from the project root:

```powershell
& '.\vine-matrix-completion\.venv\Scripts\python.exe' -B '.\employer-demo\validation\general_backend_validation.py'
```

`backend.py` imports `../vine-matrix-completion/src`. Keep that sibling source
folder when moving the demonstration. The source ZIP contains both the explorer
and this package source, with its existing licence. A recipient needs Python
3.10+ with NumPy and NetworkX, then runs `employer-demo/serve.py`. Sharing or
public deployment remains a separate decision; this work has done neither.
