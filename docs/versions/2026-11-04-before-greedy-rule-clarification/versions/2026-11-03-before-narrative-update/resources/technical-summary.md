# GIRO 2026 — correlation-matrix completion

Vine Copulas Working Party. Team members: Tim Harrison, Paul Hewson and Xinbin Xu. This explorer covers the matrix-completion part of the team's work.

Generate a seeded, positive definite 3–7 variable correlation matrix, or paste and edit your own. Hide pairs manually or randomly, then follow the observed graph, vine, partial-correlation assignments and reconstructed matrix. Choose the completion policy, vine strategy, order and free partial correlations. Supplied zeros remain observations; edits to known entries change the constraints.

The public browser demo and local Python alternative use the same Python package. A generated reference is withheld from the solver and used only for optional comparison. Agreement with it is an experiment, not guaranteed recovery or calibrated truth.

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

Theory: Kurowicka and Cooke (2006). Computational sources: the conference [notebook](GIRO_2026_matrix_completion.ipynb), [GIRO 2026 slides (D10)](GIRO_2026_D10_slides.pdf) and [extracted package](https://github.com/Xinbin1011/vine-matrix-completion). Browser presentation and additional validation used Codex assistance.

## Technical summary

The demonstration separates observed correlations from added completion assumptions. A vine provides a sequence of partial-correlation assignments and numerical reconstruction steps. The completed matrix is checked for positive definiteness and preservation of the supplied entries.

In the three-variable example, \(\rho_{12}=\rho_{23}=0.5\) and the chosen partial correlation \(\rho_{13\cdot2}=0.4\) imply \(\rho_{13}=0.55\). Maximum determinant under only the two observed correlations instead gives \(\rho_{13}=0.25\). The distinction is the additional assumption.

A completed correlation matrix does not identify margins or a copula family. Business implications require the wider dependence model.


Latest slides (1 November 2026): [D17 graph slides · 1 Nov 2026](GIRO_2026_Matrix_Completion_Graph_D17_2026-11-01.pdf) · [D17 matrix slides · 1 Nov 2026](GIRO_2026_Matrix_Completion_Matrix_D17_2026-11-01.pdf). The [earlier D10 slides](GIRO_2026_D10_slides.pdf) remain available.
