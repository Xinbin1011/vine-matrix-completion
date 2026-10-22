# Matrix completion project

For interactive matrix-completion requests, use the repository skill
`.agents/skills/complete-matrix/SKILL.md` and execute the Python tools to obtain
numerical results. Install with `python -m pip install -e ".[dev]"`; run
`python -m pytest` after numerical changes. Keep modules free of plotting,
file-writing, and execution side effects on import. Plotting is optional.

Preserve supplied observations. Check positive definiteness and the free-entry
precision certificate before claiming a maximum entropy result. Do not assume
a greedy vine is m-saturated. The default chordal solver and explicit vine
assumptions are distinct policies; document changes to either.

Keep private inputs and generated outputs in ignored `inputs/` and `results/`
directories. Public examples are in `examples/`.

## Project notation

- Partial correlation: `\rho_{13\cdot2}`, correlation of linear regression residuals.
- Conditional correlation: `\operatorname{Corr}(X_1,X_3\mid X_2=z)`.
- Conditional copula: `C_{13\mid2}(a,b\mid u_2)`; a,b are conditional percentiles.
- Partial copula: `C^P_{13\cdot2}(a,b)`, averaging conditional copulas through
  conditional probability integral transforms.
- Uppercase `C` denotes a cumulative probability; lowercase `c` a density.
- Use a dot for partial correlation, a vertical bar for conditioning, and
  superscript P for a partial copula. Avoid semicolons in these expressions.
- `C_{13\mid2}` without a conditioning value still denotes a conditional copula
  or family, not a partial copula. A correlation parameter is not a probability.
- State whether a matrix is ordinary Pearson correlation, covariance, or
  explicitly assumed latent Gaussian correlation. A partial-correlation vine
  alone does not specify copulas or non-Gaussian conditional dependence.

Established Gaussian example: ordinary latent correlations
`\rho_{12}=\rho_{23}=0.5` and partial `\rho_{13\cdot2}=0.4` imply
`\rho_{13}=0.55`. Under the Gaussian model the shared conditional copula has
parameter 0.4 and equals the partial copula; this is not a general definition.
`C_{13\mid2}(0.5,0.5\mid0.8)` is about 0.3155, the probability of being below
both conditional medians at `U_2=0.8`. Its parameter stays 0.4.
