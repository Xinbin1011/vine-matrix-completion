# Mathematics and implementation choices

## Scales and notation

`R` is an ordinary Pearson correlation matrix. For covariance input `M`, let
`D = diag(sqrt(diag(M)))`; compute `R = D^{-1} M D^{-1}` and restore `M = D R D`.
Latent Gaussian correlation is a modeling choice, not inferred from the input.

Write partial correlations as `rho_{xy·S}`. They describe correlations of linear
regression residuals. Conditional correlations are a different concept, written
`Corr(X_x, X_y | X_S=z)`. A partial correlation vine alone specifies neither
margins nor copula families. Conditional copulas `C_{13|2}(a,b|u_2)`, partial
copulas `C^P_{13·2}(a,b)`, CDFs `C`, and densities `c` retain distinct meanings.

## Reversing a partial correlation

For a conditioning set `S`, define:

```text
b    = R_xS solve(R_SS, R_Sy)
v_x  = 1 - R_xS solve(R_SS, R_Sx)
v_y  = 1 - R_yS solve(R_SS, R_Sy)
R_xy = b + rho_{xy·S} sqrt(v_x v_y)
```

For empty `S`, `b=0` and `v_x=v_y=1`. The code rejects unavailable lower-order
entries, singular conditioning blocks, and nonpositive residual variances.
The original zero-partial formula is recovered when `rho_{xy·S}=0`.

In the established Gaussian example, `R_12=R_23=0.5` and
`rho_{13·2}=0.4`, so `R_13=0.25+0.4*0.75=0.55`. The maximum determinant
completion with only those two ordinary correlations fixed instead uses
`rho_{13·2}=0`, giving `R_13=0.25`.

## Default maximum entropy computation

The notebook quotes Theorem 4.2 of Kurowicka and Cooke (2006): chordal partially
positive definite input can be represented by an m-saturated incomplete partial
correlation vine, and zero values on its unspecified edges produce the maximum
determinant completion. The implementation does not assert that an arbitrary
greedy/C/D/custom vine is such a representation.

For the chordal default, construct a maximum-weight clique forest, with edge
weights equal to intersection sizes. If `C` runs over maximal cliques and `S`
over separators on forest edges (including repeated separators), form

```text
K = sum_C embed_C(inverse(R_CC)) - sum_S embed_S(inverse(R_SS))
R_completed = inverse(K)
```

Every specified maximal clique must be positive definite. Isolated variables
are singleton cliques; disconnected components get zero cross-correlations.
Dense NumPy linear algebra is used, so this is intended for small to medium
research matrices rather than very large sparse systems.

## Checks and limits

Every completion must be finite, symmetric, positive definite at the selected
tolerance, and preserve specified entries. Its log determinant and smallest
eigenvalue are reported. A free-entry certificate checks
`max(abs(inverse(R)[missing entries])) <= max(1e-8, 100*tol)`.
Because log determinant is strictly concave on the positive definite cone and
the observed-entry constraints are affine, a feasible stationary matrix is the
unique optimum. This is a floating-point certificate, not a symbolic proof or
a guarantee at arbitrarily poor conditioning.

For fixed variances and a multivariate Gaussian distribution, maximizing log
determinant maximizes differential entropy. The code does not infer a Gaussian
distribution or non-Gaussian conditional copulas from a correlation matrix.
The certificate is always relative to the original observed entries. A supplied
nonzero partial may deliberately make it false without invalidating completion.

The default chordal solver is independent of the selected vine. In explicit
vine mode, zero defaults on earlier edges can make later observed correlations
incompatible. The code then raises an error; it never edits observations,
clips partials into range, or substitutes zero for an invalid calculation.
Choosing another tree/order or different free values can help. No claim is
made that a failed attempt proves that the original matrix is incompletable.

## Mapping from the original script

| Original function | Package equivalent |
| --- | --- |
| `is_semi_pos_def` | `matrix.require_positive_definite` plus result diagnostics; stricter because this workflow requires PD |
| `matrixToGraph` | `graphs.matrix_to_graph`, consistent 1-based labels |
| `plotGraph` and inline plotting | `plotting.plot_vine`, optional and file-based |
| `recursive_partial_corr`, `partial_corr` | `partials.partial_corr`, equivalent regression-block calculation with explicit errors |
| `extract_vine_parameters` | `vines._add_edge`, variable-set difference/intersection |
| `build_next_vine_layer` | `vines._next_candidates` and `build_vine` |
| `removeCycle` | Deterministic spanning-tree selection inside `build_vine`, including unavailable first-tree candidates |
| `fill_from_zero_partial_corr_edges` | `complete_matrix(method="vine")`, extended to nonzero partials |
| `print_vine_edges` | JSON edge reports from the CLI and `CompletionResult.to_dict()` |

Primary reference: [Kurowicka and Cooke, 2006](https://doi.org/10.1016/j.laa.2006.01.031).
