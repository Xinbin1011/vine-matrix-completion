"""Machine-readable commands for Codex and direct terminal use."""

import argparse
import json
import sys

import networkx as nx
import numpy as np

from .completion import MissingPartialCorrelations, complete_matrix
from .graphs import matrix_to_graph
from .io import read_problem, write_csv, write_json
from .matrix import to_correlation
from .vines import build_vine


def main(argv=None):
    parser = argparse.ArgumentParser(description="Complete correlation/covariance matrices using partial correlation vines")
    parser.add_argument("command", choices=["plan", "complete"])
    parser.add_argument("input", help="JSON problem or header-free CSV matrix")
    parser.add_argument("--kind", choices=["correlation", "covariance"])
    parser.add_argument("--method", choices=["max_entropy", "vine"])
    parser.add_argument("--strategy", choices=["greedy", "c-vine", "d-vine", "custom"])
    parser.add_argument("--order", help="Comma-separated 1-based variable order, e.g. 2,1,3,4,5")
    parser.add_argument("--missing", choices=["zero", "error"])
    parser.add_argument("--output", help="Save a JSON plan/result")
    parser.add_argument("--csv", help="Save the completed matrix on the original input scale")
    parser.add_argument("--plot", help="Save a vine diagram (requires pip install '.[plot]')")
    args = parser.parse_args(argv)
    try:
        problem = read_problem(args.input)
        for name in ["kind", "method", "strategy", "missing"]:
            if getattr(args, name) is not None:
                problem[name] = getattr(args, name)
        if args.order is not None:
            problem["order"] = [int(v.strip()) for v in args.order.split(",")]
        if "trees" in problem:
            problem["custom_trees"] = problem.pop("trees")
        if args.command == "plan":
            r, _ = to_correlation(problem["matrix"], problem.get("kind", "correlation"), problem.get("tol", 1e-10))
            vine = build_vine(r, problem.get("strategy", "greedy"), problem.get("order"), problem.get("custom_trees"))
            rows = vine.describe(r)
            data = {
                "kind": problem.get("kind", "correlation"), "strategy": vine.strategy,
                "method": problem.get("method", "max_entropy"),
                "dimension": len(r), "observed_graph_chordal": nx.is_chordal(matrix_to_graph(r)),
                "edges": rows,
                "free_edges_for_vine_method": [row["key"] for row in rows if not row["observed_pair"]],
                "observed_blocks_complete_in_selected_vine": all(
                    row["partial_from_observations"] is not None for row in rows if row["observed_pair"]),
            }
        else:
            result = complete_matrix(**problem)
            data, vine = result.to_dict(), result.vine
            if args.csv:
                write_csv(args.csv, result.matrix)
        if args.plot:
            from .plotting import plot_vine
            plot_vine(vine, args.plot)
        if args.output:
            write_json(args.output, data)
        print(json.dumps(data, indent=2, allow_nan=False))
        return 0
    except (ValueError, KeyError, TypeError, OSError, ImportError, np.linalg.LinAlgError) as error:
        detail = {"error": str(error), "type": type(error).__name__}
        if isinstance(error, MissingPartialCorrelations):
            detail["required_edges"] = error.edges
        print(json.dumps(detail, allow_nan=False), file=sys.stderr)
        return 2
