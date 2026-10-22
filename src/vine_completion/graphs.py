"""Observed graphs, chordality, and the exact chordal max-determinant solution."""

from itertools import combinations

import networkx as nx
import numpy as np

from .matrix import require_positive_definite


def matrix_to_graph(correlation):
    """Observed graph with consistent 1-based node and edge labels."""
    r = np.asarray(correlation, dtype=float)
    graph = nx.Graph()
    graph.add_nodes_from(range(1, len(r) + 1))
    for i, j in combinations(range(len(r)), 2):
        if np.isfinite(r[i, j]):
            graph.add_edge(i + 1, j + 1, weight=float(r[i, j]))
    return graph


def chordal_max_entropy(correlation, tol=1e-10):
    """Compute the unique chordal maximum-log-determinant completion.

    Assemble the precision matrix from maximal-clique inverses minus separator
    inverses along a clique forest. Disconnected components are independent.
    This avoids assuming a greedy vine is m-saturated.
    """
    r = np.asarray(correlation, dtype=float)
    graph = matrix_to_graph(r)
    if not nx.is_chordal(graph):
        raise ValueError(
            "Default max_entropy requires a chordal observed graph. "
            "Use method='vine' to explore explicit edge assumptions, or supply "
            "additional observed entries. No automatic triangulation is applied."
        )
    cliques = sorted((tuple(sorted(c)) for c in nx.find_cliques(graph)))
    clique_graph = nx.Graph()
    clique_graph.add_nodes_from(range(len(cliques)))
    for i, j in combinations(range(len(cliques)), 2):
        overlap = tuple(sorted(set(cliques[i]) & set(cliques[j])))
        if overlap:
            clique_graph.add_edge(i, j, weight=len(overlap), separator=overlap)
    forest = nx.maximum_spanning_tree(clique_graph)
    precision = np.zeros_like(r)

    def add_inverse(labels, sign):
        indices = [v - 1 for v in labels]
        block = r[np.ix_(indices, indices)]
        require_positive_definite(block, tol, f"Observed clique/separator {labels}")
        precision[np.ix_(indices, indices)] += sign * np.linalg.solve(block, np.eye(len(indices)))

    for clique in cliques:
        add_inverse(clique, 1)
    for _, _, data in forest.edges(data=True):
        add_inverse(data["separator"], -1)
    completed = np.linalg.solve(precision, np.eye(len(r)))
    completed = (completed + completed.T) / 2
    require_positive_definite(completed, tol, "Maximum entropy completion")
    observed = np.isfinite(r)
    if not np.allclose(completed[observed], r[observed], atol=tol * 10, rtol=0):
        raise ValueError("Numerical completion did not preserve all observed values")
    completed[observed] = r[observed]
    return completed
