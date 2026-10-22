"""Regular vine construction with explicit proximity and spanning-tree checks."""

from dataclasses import dataclass
from itertools import combinations

import networkx as nx
import numpy as np

from .partials import edge_key, partial_corr


@dataclass
class Vine:
    trees: list
    strategy: str

    def edges(self):
        for level, tree in enumerate(self.trees, 1):
            for _, _, data in tree.edges(data=True):
                yield level, data

    def describe(self, correlation):
        rows = []
        for level, data in self.edges():
            x, y = data["conditioned"]
            s = data["conditioning"]
            block = [x - 1, y - 1, *(v - 1 for v in s)]
            determined = bool(np.isfinite(correlation[np.ix_(block, block)]).all())
            rows.append({
                "tree": level, "key": edge_key((x, y), s),
                "conditioned": [x, y], "conditioning": list(s),
                "observed_pair": bool(np.isfinite(correlation[x - 1, y - 1])),
                "partial_from_observations": partial_corr(correlation, x, y, s) if determined else None,
            })
        return rows


def _add_edge(graph, u, v):
    a = graph.nodes[u]["variables"]
    b = graph.nodes[v]["variables"]
    conditioned = tuple(sorted(a ^ b))
    conditioning = tuple(sorted(a & b))
    if len(conditioned) != 2:
        raise ValueError("Invalid vine candidate: expected two conditioned variables")
    graph.add_edge(u, v, conditioned=conditioned, conditioning=conditioning)


def _next_candidates(tree):
    candidate = nx.Graph()
    edges = sorted(tuple(sorted(e)) for e in tree.edges())
    for index, (u, v) in enumerate(edges):
        candidate.add_node(index, variables=tree.nodes[u]["variables"] | tree.nodes[v]["variables"],
                           previous_edge=(u, v))
    for i, j in combinations(candidate.nodes, 2):
        a = candidate.nodes[i]["previous_edge"]
        b = candidate.nodes[j]["previous_edge"]
        if len(set(a) & set(b)) == 1:
            _add_edge(candidate, i, j)
    return candidate


def build_vine(correlation, strategy="greedy", order=None, custom_trees=None):
    """Build all n-1 trees; unobserved first-tree pairs remain candidates.

    Greedy prioritizes partials determined by observed blocks, then absolute
    strength, with stable tie-breaking. C/D vines use an explicit variable order.
    A custom tree is a list of {conditioned: [x,y], conditioning: [...]} edges.
    """
    r = np.asarray(correlation, dtype=float)
    n = len(r)
    if strategy not in {"greedy", "c-vine", "d-vine", "custom"}:
        raise ValueError("strategy must be greedy, c-vine, d-vine, or custom")
    order = list(range(1, n + 1)) if order is None else list(order)
    if (len(order) != n or any(type(v) is not int for v in order)
            or set(order) != set(range(1, n + 1))):
        raise ValueError("order must be a permutation of the 1-based variable labels")
    if strategy == "custom" and (custom_trees is None or len(custom_trees) != n - 1):
        raise ValueError("custom_trees must supply every one of the n-1 vine trees")
    candidate = nx.Graph()
    candidate.add_nodes_from((v, {"variables": frozenset([v])}) for v in range(1, n + 1))
    for u, v in combinations(candidate.nodes, 2):
        _add_edge(candidate, u, v)
    trees = []
    seen = set()
    for level in range(1, n):
        if strategy == "greedy":
            ranked = []
            for u, v, data in candidate.edges(data=True):
                x, y = data["conditioned"]
                s = data["conditioning"]
                indices = [x - 1, y - 1, *(z - 1 for z in s)]
                known = bool(np.isfinite(r[np.ix_(indices, indices)]).all())
                weight = abs(partial_corr(r, x, y, s)) if known else 0.0
                ranked.append((not known, -weight, edge_key((x, y), s), u, v))
            tree = nx.create_empty_copy(candidate)
            components = nx.utils.UnionFind(candidate.nodes)
            for _, _, _, u, v in sorted(ranked):
                if components[u] != components[v]:
                    tree.add_edge(u, v, **candidate[u][v])
                    components.union(u, v)
        else:
            if strategy == "custom":
                expected = []
                for spec in custom_trees[level - 1]:
                    pair, cond = spec["conditioned"], spec.get("conditioning", [])
                    if (len(pair) != 2 or len(cond) != level - 1
                            or len(set([*pair, *cond])) != level + 1
                            or any(type(z) is not int or z not in order for z in [*pair, *cond])):
                        raise ValueError(f"Invalid edge specification in tree {level}")
                    expected.append(edge_key(pair, cond))
            elif strategy == "c-vine":
                expected = [edge_key((order[level - 1], v), order[:level - 1]) for v in order[level:]]
            else:
                expected = [edge_key((order[i], order[i + level]), order[i + 1:i + level])
                            for i in range(n - level)]
            if len(expected) != len(set(expected)):
                raise ValueError(f"Duplicate edge in tree {level}")
            tree = nx.create_empty_copy(candidate)
            for u, v, data in candidate.edges(data=True):
                if edge_key(data["conditioned"], data["conditioning"]) in expected:
                    tree.add_edge(u, v, **data)
            if tree.number_of_edges() != len(expected):
                raise ValueError(f"Tree {level} contains unavailable edges or violates vine proximity")
        if tree.number_of_nodes() != n - level + 1 or not nx.is_tree(tree):
            raise ValueError(f"Tree {level} must be a connected spanning tree satisfying proximity")
        for _, _, data in tree.edges(data=True):
            pair = data["conditioned"]
            if pair in seen:
                raise ValueError("A conditioned pair appears more than once")
            seen.add(pair)
        trees.append(tree)
        if level < n - 1:
            candidate = _next_candidates(tree)
    return Vine(trees, strategy)
