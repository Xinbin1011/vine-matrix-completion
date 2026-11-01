"""Local, bounded adapter over the existing vine_completion research package.

No server, network, files, generated source matrix or user data persistence here.
The caller sends only the partially observed correlation matrix and choices.
"""

from __future__ import annotations

from pathlib import Path
import sys

import networkx as nx
import numpy as np


PROJECT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT / "vine-matrix-completion" / "src"))
from vine_completion.completion import (  # noqa: E402
    MissingPartialCorrelations, _normalize_partials, complete_matrix,
)
from vine_completion.graphs import matrix_to_graph  # noqa: E402
from vine_completion.matrix import require_positive_definite, to_correlation  # noqa: E402
from vine_completion.partials import (  # noqa: E402
    conditional_moments, correlation_from_partial, edge_key, partial_corr,
)
from vine_completion.vines import build_vine  # noqa: E402


TOL = 1e-10
CERTIFICATE_TOL = 1e-8


class UnsupportedCompletion(ValueError):
    """A requested policy is outside the underlying solver's stated scope."""


def _json_safe(value):
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, np.ndarray)):
        return [_json_safe(item) for item in value]
    if isinstance(value, np.generic):
        return _json_safe(value.item())
    if isinstance(value, float) and not np.isfinite(value):
        return None
    return value


def _settings(payload):
    if not isinstance(payload, dict):
        raise ValueError("Send a JSON object containing the matrix and calculation settings.")
    unknown = set(payload) - {"matrix", "method", "strategy", "order", "partials", "action"}
    if unknown:
        raise ValueError("Unsupported payload fields: " + ", ".join(sorted(unknown)))
    matrix = payload.get("matrix")
    if not isinstance(matrix, list) or not 3 <= len(matrix) <= 7:
        raise ValueError("Supply a square correlation matrix with 3 to 7 variables.")
    if any(not isinstance(row, list) or len(row) != len(matrix) for row in matrix):
        raise ValueError("Every matrix row must have the same length as the dimension.")
    if any(value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)))
           for row in matrix for value in row):
        raise ValueError("Matrix entries must be finite numbers or null for missing values.")
    if any(value is not None and not np.isfinite(value) for row in matrix for value in row):
        raise ValueError("Use null for missing entries; NaN and infinity are not JSON inputs.")
    method = payload.get("method", "max_entropy")
    strategy = payload.get("strategy", "greedy")
    action = payload.get("action", "complete")
    if method not in {"max_entropy", "vine"}:
        raise ValueError("method must be 'max_entropy' or 'vine'.")
    if strategy not in {"greedy", "c-vine", "d-vine"}:
        raise ValueError("strategy must be 'greedy', 'c-vine' or 'd-vine'.")
    if action not in {"plan", "complete"}:
        raise ValueError("action must be 'plan' or 'complete'.")
    order = payload.get("order", list(range(1, len(matrix) + 1)))
    if not isinstance(order, list) or len(order) != len(matrix) or any(type(v) is not int for v in order):
        raise ValueError("order must list each integer variable label exactly once.")
    if set(order) != set(range(1, len(matrix) + 1)):
        raise ValueError("order must be a permutation of the 1-based variable labels.")
    partials = payload.get("partials", [])
    if not isinstance(partials, list) or any(not isinstance(item, dict) for item in partials):
        raise ValueError("partials must be an array of conditioned/conditioning/value records.")
    for item in partials:
        if set(item) - {"conditioned", "conditioning", "value"} or not {"conditioned", "value"} <= set(item):
            raise ValueError("Each partial needs conditioned, optional conditioning, and value fields only.")
        if not isinstance(item["conditioned"], list) or not isinstance(item.get("conditioning", []), list):
            raise ValueError("Partial conditioned and conditioning labels must be arrays.")
        if isinstance(item["value"], bool) or not isinstance(item["value"], (int, float)):
            raise ValueError("A supplied partial correlation must be a finite number in (-1, 1).")
    return matrix, method, strategy, action, order, partials


def _input_diagnostics(r, graph):
    chordal = bool(nx.is_chordal(graph))
    cliques = []
    for labels in sorted(tuple(sorted(c)) for c in nx.find_cliques(graph)):
        indices = np.array(labels) - 1
        minimum = float(np.linalg.eigvalsh(r[np.ix_(indices, indices)]).min())
        cliques.append({"labels": list(labels), "minEigenvalue": minimum,
                        "positiveDefinite": minimum > TOL})
    all_pd = all(item["positiveDefinite"] for item in cliques)
    fully_observed = bool(np.isfinite(r).all())
    smallest = min(item["minEigenvalue"] for item in cliques)
    if smallest < -TOL:
        status = "infeasible_non_psd_specified_block"
        explanation = "A specified principal block is indefinite, so no positive semidefinite completion exists."
    elif smallest <= 0:
        status = "no_strict_pd_completion_at_numerical_precision"
        explanation = ("A specified principal block is singular or numerically nonpositive. "
                       "This workflow requires strict positive definiteness; it does not solve singular PSD cases.")
    elif not all_pd:
        status = "numerically_unresolved_near_singular"
        explanation = "A specified block is positive but below the chosen numerical tolerance; no infeasibility proof is claimed."
    elif chordal:
        status = "strict_pd_completion_exists"
        explanation = "The observed graph is chordal and its specified maximal cliques are positive definite."
    else:
        status = "not_established_nonchordal"
        explanation = ("Positive definite specified cliques are necessary but do not establish global feasibility "
                       "for this nonchordal graph. A failed vine attempt is not an infeasibility proof.")
    return {
        "structurallyValid": True, "dimension": len(r), "scale": "ordinary Pearson correlation",
        "observedGraphChordal": chordal, "cliques": cliques,
        "allSpecifiedCliquesPD": all_pd, "fullyObserved": fully_observed,
        "observedPairs": int(np.count_nonzero(np.triu(np.isfinite(r), 1))),
        "missingPairs": int(np.count_nonzero(np.triu(~np.isfinite(r), 1))),
        "tolerance": TOL,
        "globalFeasibility": {"status": status, "explanation": explanation},
        "caveats": [
            "No Gaussian distribution, copula family or insurance calibration is inferred from this matrix.",
            "Maximum-determinant certification concerns the original observed entries, not additional partial constraints.",
        ],
    }


def _plan(vine, r, method, action, order):
    rows = vine.describe(r)
    by_key = {row["key"]: row for row in rows}
    trees = []
    for level, tree in enumerate(vine.trees, 1):
        node_id = lambda node: f"t{level}n{node}"
        trees.append({
            "level": level,
            "nodes": [{"id": node_id(node), "variables": sorted(data["variables"])}
                      for node, data in tree.nodes(data=True)],
            "edges": [{"u": node_id(u), "v": node_id(v),
                       "conditioned": list(data["conditioned"]), "conditioning": list(data["conditioning"]),
                       "key": edge_key(data["conditioned"], data["conditioning"]),
                       "partial_from_observations": by_key[edge_key(data["conditioned"], data["conditioning"])]["partial_from_observations"],
                       "observed_pair": by_key[edge_key(data["conditioned"], data["conditioning"])]["observed_pair"]}
                      for u, v, data in tree.edges(data=True)],
        })
    free_edges = [row for row in rows if not row["observed_pair"]]
    return {
        "method": method, "strategy": vine.strategy, "action": action, "order": order,
        "edges": rows, "trees": trees, "freeEdges": free_edges,
        "freeEdgeKeys": [row["key"] for row in free_edges],
        "requiresExplicitFreeValues": method == "vine",
        "observedBlocksCompleteInSelectedVine": all(
            row["partial_from_observations"] is not None for row in rows if row["observed_pair"]),
        "warnings": [],
    }


def _trace_vine(r, vine, supplied, trace):
    observed = np.isfinite(r)
    missing = [edge_key(data["conditioned"], data["conditioning"])
               for _, data in vine.edges()
               if not observed[data["conditioned"][0] - 1, data["conditioned"][1] - 1]
               and edge_key(data["conditioned"], data["conditioning"]) not in supplied]
    if missing:
        trace.append({"stage": "partial_values_required", "keys": missing,
                      "message": "Every free vine edge needs an explicit value; no zeros are inserted by the backend."})
        raise MissingPartialCorrelations(missing)
    completed = r.copy()
    for level, data in vine.edges():
        x, y = data["conditioned"]
        conditioning = list(data["conditioning"])
        key = edge_key((x, y), conditioning)
        before = completed.copy()
        step = {"stage": "vine_edge", "level": level, "key": key,
                "pair": [x, y], "conditioned": [x, y], "conditioning": conditioning,
                "source": "observed" if observed[x - 1, y - 1] else "supplied",
                "before": before}
        try:
            base, vx, vy = conditional_moments(completed, x, y, conditioning, TOL)
            if observed[x - 1, y - 1]:
                value = partial_corr(completed, x, y, conditioning, TOL)
                if key in supplied and not np.isclose(value, supplied[key], atol=TOL, rtol=0):
                    raise ValueError(f"Partial {key} conflicts with fixed observations (implied value {value:.8g}).")
                ordinary = float(completed[x - 1, y - 1])
            else:
                value = supplied[key]
                ordinary = correlation_from_partial(completed, x, y, conditioning, value, TOL)
                completed[x - 1, y - 1] = completed[y - 1, x - 1] = ordinary
            step.update({"partialValue": value, "base": base,
                         "residualVariances": {"x": vx, "y": vy},
                         "multiplier": float(np.sqrt(vx * vy)),
                         "ordinaryCorrelation": ordinary, "after": completed.copy(),
                         "formula": "R_xy = base + partialValue * sqrt(residual_x * residual_y)"})
            trace.append(step)
        except (ValueError, np.linalg.LinAlgError) as error:
            step.update({"failed": True, "message": str(error), "after": completed.copy()})
            trace.append(step)
            raise
    return completed


def _trace_chordal(r, graph, trace):
    cliques = sorted(tuple(sorted(c)) for c in nx.find_cliques(graph))
    clique_graph = nx.Graph()
    clique_graph.add_nodes_from(range(len(cliques)))
    for i in range(len(cliques)):
        for j in range(i + 1, len(cliques)):
            separator = tuple(sorted(set(cliques[i]) & set(cliques[j])))
            if separator:
                clique_graph.add_edge(i, j, weight=len(separator), separator=separator)
    forest = nx.maximum_spanning_tree(clique_graph)
    separators = [data["separator"] for _, _, data in forest.edges(data=True)]
    trace.append({"stage": "clique_forest", "cliques": cliques, "separators": separators,
                  "forestEdges": [{"cliques": [i, j], "separator": data["separator"]}
                                  for i, j, data in forest.edges(data=True)],
                  "message": "K = sum of embedded clique inverses minus embedded separator inverses. "
                             "This calculation is independent of the displayed vine."})
    precision = np.zeros_like(r)
    for stage, groups, sign in [("clique_contribution", cliques, 1), ("separator_contribution", separators, -1)]:
        for labels in groups:
            indices = [label - 1 for label in labels]
            block = r[np.ix_(indices, indices)]
            require_positive_definite(block, TOL, f"Specified block {labels}")
            inverse = np.linalg.solve(block, np.eye(len(indices)))
            contribution = np.zeros_like(r)
            contribution[np.ix_(indices, indices)] = sign * inverse
            precision += contribution
            trace.append({"stage": stage, "labels": labels, "sign": sign,
                          "block": block, "inverse": inverse, "contribution": contribution,
                          "precisionAfter": precision.copy()})
    completed = np.linalg.solve(precision, np.eye(len(r)))
    completed = (completed + completed.T) / 2
    observed = np.isfinite(r)
    require_positive_definite(completed, TOL, "Traced maximum-determinant matrix")
    if not np.allclose(completed[observed], r[observed], atol=TOL * 10, rtol=0):
        raise ValueError("Traced chordal calculation failed to preserve observations.")
    completed[observed] = r[observed]
    trace.append({"stage": "precision_inverse", "precision": precision, "after": completed.copy(),
                  "message": "Invert assembled K and restore supplied correlations within numerical tolerance."})
    return completed


def analyse(payload):
    """Return a JSON-safe plan/result/trace without altering files or inputs."""
    response = {"ok": False, "inputDiagnostics": {"structurallyValid": False},
                "graph": None, "plan": None, "result": None, "trace": [], "error": None}
    try:
        matrix, method, strategy, action, order, partials = _settings(payload)
        r, _ = to_correlation(matrix, "correlation", TOL)
        graph = matrix_to_graph(r)
        response["inputDiagnostics"] = _input_diagnostics(r, graph)
        response["graph"] = {"nodes": list(graph.nodes),
                             "edges": [{"pair": [u, v], "value": float(data["weight"])}
                                       for u, v, data in graph.edges(data=True)]}
        response["trace"].append({"stage": "input_validation", "dimension": len(r),
                                  "observedGraphChordal": response["inputDiagnostics"]["observedGraphChordal"],
                                  "allSpecifiedCliquesPD": response["inputDiagnostics"]["allSpecifiedCliquesPD"],
                                  "message": "Null marks an unknown entry. A supplied zero remains a fixed observed edge."})
        if not response["inputDiagnostics"]["allSpecifiedCliquesPD"]:
            raise ValueError(response["inputDiagnostics"]["globalFeasibility"]["explanation"])
        vine = build_vine(r, strategy, order)
        response["plan"] = _plan(vine, r, method, action, order)
        supplied = _normalize_partials(partials, vine)
        if method == "max_entropy" and supplied:
            raise ValueError("Use method='vine' to impose partial correlations; max_entropy accepts no extra partial constraints.")
        if method == "max_entropy" and not response["inputDiagnostics"]["observedGraphChordal"]:
            response["plan"]["warnings"].append(
                "The default maximum-determinant solver requires a chordal graph. The displayed vine does not remove that restriction.")
        response["trace"].append({"stage": "vine_plan", "strategy": strategy,
                                  "freeEdgeKeys": response["plan"]["freeEdgeKeys"],
                                  "message": "Vine edges satisfy the regular-vine proximity and spanning-tree checks."})
        if action == "plan":
            response["ok"] = True
            return _json_safe(response)
        if method == "max_entropy":
            if not response["inputDiagnostics"]["observedGraphChordal"]:
                raise UnsupportedCompletion("Maximum-determinant completion is unsupported for this nonchordal graph. "
                                            "A vine exploration can be requested explicitly; no method was substituted.")
            traced = _trace_chordal(r, graph, response["trace"])
        else:
            traced = _trace_vine(r, vine, supplied, response["trace"])
        result = complete_matrix(matrix, kind="correlation", method=method,
                                 strategy=strategy, order=order, partials=partials,
                                 missing="error", tol=TOL)
        trace_difference = float(np.max(np.abs(traced - result.correlation)))
        if trace_difference > TOL * 10:
            raise ValueError("The displayed calculation trace does not agree with the package result.")
        observed = np.isfinite(r)
        minimum = require_positive_definite(result.correlation, TOL, "Final correlation matrix")
        observed_error = float(np.max(np.abs(result.correlation[observed] - r[observed])))
        precision = np.linalg.solve(result.correlation, np.eye(len(r)))
        residual = float(np.max(np.abs(precision[~observed]))) if (~observed).any() else 0.0
        certificate = residual <= CERTIFICATE_TOL
        if observed_error > TOL * 10 or (method == "max_entropy" and not certificate):
            raise ValueError("The fresh observation or maximum-determinant checks failed.")
        response["trace"].append({"stage": "final_validation", "minimumEigenvalue": minimum,
                                  "observedError": observed_error, "freePrecisionResidual": residual,
                                  "maxDetCertified": certificate, "traceAgreementMaxAbs": trace_difference,
                                  "message": "Fresh positive-definiteness, observation and precision checks; "
                                             "certificate is relative to the original observed entries."})
        response["result"] = result.to_dict()
        if not response["inputDiagnostics"]["observedGraphChordal"]:
            response["inputDiagnostics"]["globalFeasibility"] = {
                "status": "strict_pd_completion_found",
                "explanation": "The completed matrix now supplies a checked positive definite feasible point. "
                               "This proves feasibility for these inputs, not maximum determinant unless its certificate passes.",
            }
        response["ok"] = True
    except (ValueError, KeyError, TypeError, np.linalg.LinAlgError) as error:
        response["error"] = {"message": str(error), "type": type(error).__name__}
        if isinstance(error, MissingPartialCorrelations):
            response["error"]["requiredEdges"] = error.edges
    return _json_safe(response)
