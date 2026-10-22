"""Completion policies, explicit edge assumptions, and numerical certificates."""

from dataclasses import dataclass

import networkx as nx
import numpy as np

from .graphs import chordal_max_entropy, matrix_to_graph
from .matrix import require_positive_definite, to_correlation
from .partials import correlation_from_partial, edge_key, partial_corr
from .vines import build_vine


class MissingPartialCorrelations(ValueError):
    def __init__(self, edges):
        self.edges = edges
        super().__init__("Supply partial correlations for: " + ", ".join(edges))


@dataclass
class CompletionResult:
    correlation: np.ndarray
    matrix: np.ndarray
    kind: str
    method: str
    vine: object
    edges: list
    diagnostics: dict

    def to_dict(self):
        return {
            "kind": self.kind, "method": self.method, "strategy": self.vine.strategy,
            "correlation": self.correlation.tolist(), "matrix": self.matrix.tolist(),
            "edges": self.edges, "diagnostics": self.diagnostics,
        }


def _normalize_partials(partials, vine):
    """Use explicit records rather than ambiguous correlation/partial maps."""
    selected = {edge_key(d["conditioned"], d["conditioning"]) for _, d in vine.edges()}
    result = {}
    for item in partials or []:
        pair, cond = item["conditioned"], item.get("conditioning", [])
        if len(pair) != 2 or len(set([*pair, *cond])) != len(pair) + len(cond):
            raise ValueError("Each partial needs two distinct conditioned variables disjoint from conditioning")
        if any(type(v) is not int for v in [*pair, *cond]):
            raise ValueError("Partial correlation labels must be integers")
        key = edge_key(pair, cond)
        if key not in selected:
            raise ValueError(f"Partial {key} is not an edge of the selected vine; change the strategy/order/trees")
        if key in result:
            raise ValueError(f"Duplicate partial correlation: {key}")
        value = float(item["value"])
        if not np.isfinite(value) or abs(value) >= 1:
            raise ValueError(f"Partial correlation {key} must lie strictly between -1 and 1")
        result[key] = value
    return result


def complete_matrix(matrix, *, kind="correlation", method="max_entropy", strategy="greedy",
                    order=None, custom_trees=None, partials=None, missing="zero", tol=1e-10):
    """Complete fixed ordinary correlations/covariances without editing observations.

    ``max_entropy`` is an exact chordal solution, then expressed on the chosen
    vine. ``vine`` reconstructs a matrix level by level using user parameters
    (or explicit zero defaults). Zero-filling an arbitrary vine is not assumed
    to maximize entropy. All results must pass positive-definiteness checks.
    """
    if method not in {"max_entropy", "vine"}:
        raise ValueError("method must be max_entropy or vine")
    if missing not in {"zero", "error"}:
        raise ValueError("missing must be zero or error")
    r, std = to_correlation(matrix, kind, tol)
    vine = build_vine(r, strategy, order, custom_trees)
    supplied = _normalize_partials(partials, vine)
    if method == "max_entropy" and supplied:
        raise ValueError("Choose method='vine' to impose edge partial correlations")
    observed = np.isfinite(r)
    sources = {}
    if method == "max_entropy":
        completed = chordal_max_entropy(r, tol)
    else:
        if missing == "error":
            required = [edge_key(d["conditioned"], d["conditioning"])
                        for _, d in vine.edges()
                        if not observed[d["conditioned"][0] - 1, d["conditioned"][1] - 1]
                        and edge_key(d["conditioned"], d["conditioning"]) not in supplied]
            if required:
                raise MissingPartialCorrelations(required)
        completed = r.copy()
        for _, data in vine.edges():
            x, y = data["conditioned"]
            s = data["conditioning"]
            key = edge_key((x, y), s)
            if observed[x - 1, y - 1]:
                actual = partial_corr(completed, x, y, s, tol)
                if key in supplied and not np.isclose(actual, supplied[key], atol=tol, rtol=0):
                    raise ValueError(f"Partial {key} conflicts with fixed observed entries (implied value {actual:.8g})")
                sources[key] = "observed"
            else:
                value = supplied.get(key, 0.0)
                solved = correlation_from_partial(completed, x, y, s, value, tol)
                completed[x - 1, y - 1] = completed[y - 1, x - 1] = solved
                sources[key] = "supplied" if key in supplied else "default_zero"
    minimum = require_positive_definite(completed, tol, "Completed correlation matrix")
    observed_error = float(np.max(np.abs(completed[observed] - r[observed])))
    if observed_error > tol * 10:
        raise ValueError("Completion changed observed correlations")
    precision = np.linalg.solve(completed, np.eye(len(r)))
    free = ~observed
    residual = float(np.max(np.abs(precision[free]))) if free.any() else 0.0
    # d log(det R)/d R_ij = 2 (R^-1)_ij for a free symmetric off-diagonal.
    # Strict concavity makes a feasible stationary solution the unique maximum.
    certified = bool(residual <= max(1e-8, tol * 100))
    if method == "max_entropy" and not certified:
        raise ValueError("Numerical maximum entropy certificate failed; conditioning may be poor")
    rows = []
    for level, data in vine.edges():
        x, y = data["conditioned"]
        s = data["conditioning"]
        key = edge_key((x, y), s)
        value = partial_corr(completed, x, y, s, tol)
        data["weight"] = value
        rows.append({
            "tree": level, "key": key, "conditioned": [x, y], "conditioning": list(s),
            "partial_correlation": value, "ordinary_correlation": float(completed[x - 1, y - 1]),
            "source": sources.get(key, "observed" if observed[x - 1, y - 1] else "computed_max_entropy"),
        })
    restored = completed * np.outer(std, std)
    original = np.array(matrix, dtype=float)
    # Retain the user's actual observed numbers, including covariance units.
    restored[observed] = original[observed]
    diagnostics = {
        "positive_definite": True, "minimum_eigenvalue_correlation": minimum,
        "log_determinant_correlation": float(np.linalg.slogdet(completed)[1]),
        "log_determinant_matrix": float(np.linalg.slogdet(restored)[1]),
        "maximum_observed_error_correlation": observed_error,
        "observed_graph_chordal": bool(nx.is_chordal(matrix_to_graph(r))),
        "free_precision_max_abs": residual, "max_entropy_certified": certified,
        "certificate_tolerance": max(1e-8, tol * 100),
        "missing_pairs_completed": int(np.count_nonzero(np.triu(free, 1))),
        "entropy_interpretation": "Gaussian differential entropy with fixed variances",
    }
    return CompletionResult(completed, restored, kind, method, vine, rows, diagnostics)
