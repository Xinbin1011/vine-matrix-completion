"""Validate inputs and handle covariance/correlation scales explicitly."""

import numpy as np


def validate_matrix(matrix, kind="correlation", tol=1e-10):
    """Return an independent float array; NaN marks symmetric missing entries.

    Only strictly positive definite completions are supported. Small numerical
    asymmetries below ``tol`` are averaged; larger ones are rejected.
    """
    if kind not in {"correlation", "covariance"}:
        raise ValueError("kind must be 'correlation' or 'covariance'")
    if not np.isfinite(tol) or tol <= 0:
        raise ValueError("tol must be positive and finite")
    a = np.array(matrix, dtype=float, copy=True)
    if a.ndim != 2 or a.shape[0] != a.shape[1] or a.shape[0] < 2:
        raise ValueError("Supply a square matrix with at least two variables")
    if np.isinf(a).any():
        raise ValueError("Infinite values are invalid; use null/NaN for missing entries")
    if not np.array_equal(np.isnan(a), np.isnan(a.T)):
        raise ValueError("Missing entries must be symmetric")
    if not np.allclose(a, a.T, atol=tol, rtol=0, equal_nan=True):
        raise ValueError("Matrix must be symmetric")
    if not np.isfinite(np.diag(a)).all() or np.any(np.diag(a) <= 0):
        raise ValueError("Every diagonal entry must be finite and strictly positive")
    if kind == "correlation" and not np.allclose(np.diag(a), 1, atol=tol, rtol=0):
        raise ValueError("Correlation matrix diagonal must be 1; select covariance if needed")
    a = (a + a.T) / 2
    if kind == "correlation":
        np.fill_diagonal(a, 1.0)
    scale = np.sqrt(np.diag(a))
    r = a / np.outer(scale, scale)
    observed_off_diagonal = np.isfinite(r) & ~np.eye(len(r), dtype=bool)
    if np.any(np.abs(r[observed_off_diagonal]) >= 1):
        raise ValueError("Observed correlations must lie strictly between -1 and 1")
    return a


def to_correlation(matrix, kind="correlation", tol=1e-10):
    """Return (correlation, standard deviations) without changing the input."""
    a = validate_matrix(matrix, kind, tol)
    std = np.sqrt(np.diag(a))
    correlation = a / np.outer(std, std)
    np.fill_diagonal(correlation, 1.0)
    return correlation, std


def require_positive_definite(matrix, tol=1e-10, context="Matrix"):
    if not np.isfinite(matrix).all():
        raise ValueError(f"{context} still contains missing or nonfinite entries")
    minimum = float(np.linalg.eigvalsh(matrix).min())
    if minimum <= tol:
        raise ValueError(
            f"{context} is singular, indefinite, or too close to singular "
            f"at the selected tolerance (minimum eigenvalue {minimum:.6g})"
        )
    return minimum
