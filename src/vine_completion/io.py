"""Portable JSON/CSV input and strict JSON output."""

import csv
import json
from pathlib import Path

import numpy as np


def read_problem(path):
    """JSON is a problem object or bare matrix; CSV is a header-free matrix.

    JSON null and CSV blank/NA/NaN/null denote missing entries. In JSON a
    problem object can also carry method, strategy, order, trees and partials.
    """
    path = Path(path)
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = [[np.nan if cell.strip().lower() in {"", "na", "nan", "null"}
                     else float(cell) for cell in row] for row in csv.reader(handle) if row]
        return {"matrix": rows}
    with path.open(encoding="utf-8-sig") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return {"matrix": data}
    if not isinstance(data, dict) or "matrix" not in data:
        raise ValueError("JSON must contain a matrix array or an object with a 'matrix' field")
    supported = {"matrix", "kind", "method", "strategy", "order", "trees", "partials", "missing", "tol"}
    unknown = set(data) - supported
    if unknown:
        raise ValueError("Unknown problem fields: " + ", ".join(sorted(unknown)))
    return data


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def write_csv(path, matrix):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savetxt(path, matrix, delimiter=",", fmt="%.17g")
