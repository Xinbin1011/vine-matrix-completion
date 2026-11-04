# GIRO 2026 — correlation-matrix completion

Vine Copulas Working Party. Team members: Tim Harrison, Paul Hewson and Xinbin Xu. This explorer covers the matrix-completion part of the team's work.

## Problem

Complete missing ordinary Pearson correlations while preserving supplied information. A PSD matrix alone does not justify the modelling assumptions used to fill the gaps.

## How

Judgement 1 chooses a valid partial-correlation vine. The chosen greedy heuristic prioritises edges computable from fully supplied input blocks, then absolute correlation strength at each tree, with deterministic ties and cycle avoidance. This is a local choice given earlier trees; spanning-tree and proximity rules govern mathematical validity. Preserving the supplied ordinary correlations is a separate completion requirement.

Choose maximum entropy as the completion principle. Gaussianity is the worked example: at fixed variances, maximising Gaussian entropy is equivalent to maximising det(R). A complete partial-correlation vine factorises the determinant as ∏ₑ(1 − ρₑ²). In the compatible GIRO vine, six factors are fixed by supplied information and four remain free; each free factor is maximised at zero. The optimisation therefore reduces to four zero partial assignments followed by reconstruction. This relies on the compatible representation; arbitrary zero-filling is not a general validity or optimality rule.

## Result

All four missing entries in the worked example are reconstructed, the supplied pairs remain fixed and the completed matrix is positive definite, hence PSD. The selected structure, partial assignments and numerical checks are recorded.

Vines expose modelling choices: the connections, conditioning relationships and partial-correlation assumptions. Together with the completion principle and distributional assumptions, these choices define the model and can be explained, tested and revised as information changes. Expert judgement is one input to modelling. A valid result need not be closest to the unknown truth.

The recorded choices, calculations and checks make this process reproducible.

## Use the explorer

Generate a seeded, positive definite 3–7 variable correlation matrix, or paste and edit your own. Hide pairs manually or randomly, then follow the observed graph, vine, partial-correlation assignments and reconstructed matrix. Choose the completion policy, vine strategy, order and free partial correlations. Supplied zeros remain observations; edits to known entries change the constraints.

The local browser preview uses the Python package. A generated reference is withheld from the solver and used only for optional comparison. Agreement with it is an experiment, not guaranteed recovery or calibrated truth.

## Optional 5×5 example

The notebook adds a risk with variance 46 and covariance −15 with risk 1, and reopens the historical zero between risks 1 and 3. Maximum determinant fills four covariances:

| Pair | Covariance |
| --- | ---: |
| 1, 3 | −16.777963 |
| 2, 5 | 10.714286 |
| 3, 5 | 7.190556 |
| 4, 5 | −4.285714 |

The correlation matrix is positive definite: minimum eigenvalue **0.0670128560**, log determinant **−2.6385192757**, observed-entry error **0**. Its free-entry precision residual is about **2.0 × 10⁻¹⁶**; agreement with the separate chordal solver is within **3.9 × 10⁻¹⁶**.

These numerical checks support this example. The package’s maximum-determinant solver requires a chordal graph; incompatible assumptions can be rejected. Arbitrary greedy vines do not establish the theorem's m-saturation conditions. Gaussian entropy requires Gaussianity and fixed variances. No empirical insurance or tail-dependence validation is claimed.

Theory: Kurowicka and Cooke (2006). Computational sources: the [conference notebook](https://xinbin1011.github.io/vine-matrix-completion/notebook.html), [earlier D10 slides](https://xinbin1011.github.io/vine-matrix-completion/resources/GIRO_2026_D10_slides.pdf) and [extracted package](https://github.com/Xinbin1011/vine-matrix-completion). Browser presentation and additional validation used Codex assistance.

## Technical summary

The demonstration separates observed correlations from added completion assumptions. A vine provides a sequence of partial-correlation assignments and numerical reconstruction steps. The completed matrix is checked for positive definiteness and preservation of the supplied entries.

In the three-variable example, \(\rho_{12}=\rho_{23}=0.5\) and the chosen partial correlation \(\rho_{13\cdot2}=0.4\) imply \(\rho_{13}=0.55\). Maximum determinant under only the two observed correlations instead gives \(\rho_{13}=0.25\). The distinction is the additional assumption.

A completed correlation matrix does not identify margins or a copula family. Business implications require the wider dependence model.

With more business information, underwriters can help articulate residual dependence and inform explicit partial-correlation assumptions. The assumptions still need evidence and the revised matrix must be checked. Numerical validity is not evidence that the assumptions fit an insurance portfolio.
