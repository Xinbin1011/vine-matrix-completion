"""Partial correlations and their inverse; public variable labels start at 1."""

import numpy as np


def edge_key(conditioned, conditioning=()):
    """A dot denotes partial correlation: '1,3.2' means rho_{13 dot 2}."""
    x, y = sorted(conditioned)
    suffix = ",".join(map(str, sorted(conditioning)))
    return f"{x},{y}" + (f".{suffix}" if suffix else "")


def _indices(matrix, x, y, conditioning):
    labels = [x, y, *conditioning]
    if any(isinstance(v, bool) or not isinstance(v, (int, np.integer)) for v in labels):
        raise ValueError("Variable labels must be integers")
    if len(set(labels)) != len(labels) or any(v < 1 or v > len(matrix) for v in labels):
        raise ValueError("Use distinct 1-based variable labels within the matrix dimension")
    return x - 1, y - 1, [v - 1 for v in conditioning]


def conditional_moments(matrix, x, y, conditioning=(), tol=1e-10):
    """Return regression cross-term and the two residual variances.

    The input is an ordinary Pearson correlation matrix (or a latent Gaussian
    correlation matrix if that modeling assumption was explicitly chosen).
    """
    r = np.asarray(matrix, dtype=float)
    i, j, s = _indices(r, x, y, conditioning)
    if not s:
        return 0.0, 1.0, 1.0
    block = r[np.ix_(s, s)]
    vectors = r[np.ix_(s, [i, j])]
    if not np.isfinite(block).all() or not np.isfinite(vectors).all():
        raise ValueError(f"Lower-order entries needed for {edge_key((x, y), conditioning)} are missing")
    if np.linalg.eigvalsh(block).min() <= tol:
        raise ValueError("Conditioning submatrix is not positive definite at this tolerance")
    solved = np.linalg.solve(block, vectors)
    cross = float(vectors[:, 0] @ solved[:, 1])
    vx = float(1 - vectors[:, 0] @ solved[:, 0])
    vy = float(1 - vectors[:, 1] @ solved[:, 1])
    if min(vx, vy) <= tol:
        raise ValueError("Nonpositive or near-zero residual variance; supplied constraints are incompatible")
    return cross, vx, vy


def partial_corr(matrix, x, y, conditioning=(), tol=1e-10):
    """Compute rho_{xy dot S}; never turn missing/invalid information into zero."""
    r = np.asarray(matrix, dtype=float)
    i, j, _ = _indices(r, x, y, conditioning)
    if not np.isfinite(r[i, j]):
        raise ValueError(f"Ordinary correlation for variables {x}, {y} is missing")
    cross, vx, vy = conditional_moments(r, x, y, conditioning, tol)
    value = float((r[i, j] - cross) / np.sqrt(vx * vy))
    if not np.isfinite(value) or abs(value) >= 1:
        raise ValueError(f"Partial correlation {edge_key((x, y), conditioning)} is outside (-1, 1)")
    return value


def correlation_from_partial(matrix, x, y, conditioning, value, tol=1e-10):
    """Invert rho_{xy dot S}, including nonzero user-supplied partial values."""
    value = float(value)
    if not np.isfinite(value) or abs(value) >= 1:
        raise ValueError("Partial correlations must be finite and strictly between -1 and 1")
    cross, vx, vy = conditional_moments(matrix, x, y, conditioning, tol)
    return float(cross + value * np.sqrt(vx * vy))
