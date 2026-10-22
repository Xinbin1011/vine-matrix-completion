import json
from pathlib import Path

import networkx as nx
import numpy as np
import pytest

from vine_completion import (
    MissingPartialCorrelations, build_vine, complete_matrix,
    correlation_from_partial, partial_corr, to_correlation,
)
from vine_completion.cli import main
from vine_completion.io import read_problem


EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def chain():
    return np.array([[1, .5, np.nan], [.5, 1, .5], [np.nan, .5, 1]])


def test_gaussian_reference_and_default_are_distinct():
    original = chain()
    default = complete_matrix(original)
    custom = complete_matrix(original, method="vine", strategy="d-vine",
                             partials=[{"conditioned": [1, 3], "conditioning": [2], "value": .4}])
    assert default.correlation[0, 2] == pytest.approx(.25)
    assert custom.correlation[0, 2] == pytest.approx(.55)
    assert partial_corr(custom.correlation, 1, 3, [2]) == pytest.approx(.4)
    assert default.diagnostics["max_entropy_certified"]
    assert not custom.diagnostics["max_entropy_certified"]
    assert default.diagnostics["log_determinant_correlation"] > custom.diagnostics["log_determinant_correlation"]
    assert np.isnan(original[0, 2])


def test_five_by_five_preserves_covariance_and_has_stationary_precision():
    problem = read_problem(EXAMPLES / "five_by_five.json")
    result = complete_matrix(**problem)
    original = np.array(problem["matrix"], dtype=float)
    observed = np.isfinite(original)
    np.testing.assert_array_equal(result.matrix[observed], original[observed])
    assert result.matrix[0, 2] == pytest.approx(-16.7779632721)
    assert result.matrix[1, 4] == pytest.approx(10.7142857143)
    assert result.diagnostics["minimum_eigenvalue_correlation"] == pytest.approx(.0670128560)
    assert result.diagnostics["free_precision_max_abs"] < 1e-10
    # Independent local perturbations of each free entry must reduce logdet.
    optimum = np.linalg.slogdet(result.correlation)[1]
    for i, j in zip(*np.where(np.triu(~observed, 1))):
        for change in [-.001, .001]:
            shifted = result.correlation.copy()
            shifted[i, j] += change
            shifted[j, i] += change
            assert np.linalg.slogdet(shifted)[1] < optimum


@pytest.mark.parametrize("strategy", ["greedy", "c-vine", "d-vine"])
def test_entropy_solution_independent_of_representation(strategy):
    problem = read_problem(EXAMPLES / "five_by_five.json")
    reference = complete_matrix(**problem)
    alternative = complete_matrix(**problem, strategy=strategy, order=[5, 1, 2, 4, 3])
    np.testing.assert_allclose(alternative.matrix, reference.matrix)
    assert [tree.number_of_edges() for tree in alternative.vine.trees] == [4, 3, 2, 1]
    assert all(nx.is_tree(tree) for tree in alternative.vine.trees)


@pytest.mark.parametrize("n", [2, 3, 4, 5, 7])
@pytest.mark.parametrize("strategy", ["greedy", "c-vine", "d-vine"])
def test_random_positive_definite_round_trip(n, strategy):
    # Derive every partial from an independent SPD matrix, then reconstruct it
    # from an entirely unspecified off-diagonal matrix on the chosen vine.
    rng = np.random.default_rng(100 + n)
    a = rng.normal(size=(n, n))
    covariance = a @ a.T + np.eye(n) * n
    r, _ = to_correlation(covariance, "covariance")
    incomplete = np.full((n, n), np.nan)
    np.fill_diagonal(incomplete, 1)
    order = list(map(int, rng.permutation(n) + 1))
    vine = build_vine(incomplete, strategy, order)
    partials = [{"conditioned": list(d["conditioned"]), "conditioning": list(d["conditioning"]),
                 "value": partial_corr(r, *d["conditioned"], d["conditioning"])}
                for _, d in vine.edges()]
    result = complete_matrix(incomplete, method="vine", strategy=strategy,
                             order=order, partials=partials, missing="error")
    np.testing.assert_allclose(result.correlation, r, atol=1e-12)
    # The determinant factorization is independent of the reconstruction formula.
    expected_logdet = sum(np.log1p(-item["value"] ** 2) for item in partials)
    assert result.diagnostics["log_determinant_correlation"] == pytest.approx(expected_logdet)
    custom_trees = [[{"conditioned": list(d["conditioned"]), "conditioning": list(d["conditioning"])}
                     for _, _, d in tree.edges(data=True)] for tree in vine.trees]
    custom = complete_matrix(incomplete, method="vine", strategy="custom",
                              custom_trees=custom_trees, partials=partials, missing="error")
    np.testing.assert_allclose(custom.correlation, r, atol=1e-12)


def test_disconnected_and_all_missing_graphs():
    r = np.array([[1, .2, np.nan, np.nan], [.2, 1, np.nan, np.nan],
                  [np.nan, np.nan, 1, -.4], [np.nan, np.nan, -.4, 1]])
    result = complete_matrix(r)
    np.testing.assert_allclose(result.correlation[:2, 2:], 0)
    all_missing = np.full((4, 4), np.nan)
    np.fill_diagonal(all_missing, 1)
    np.testing.assert_array_equal(complete_matrix(all_missing).correlation, np.eye(4))


def test_complete_input_unchanged():
    r = np.array([[1, .2, .3], [.2, 1, -.1], [.3, -.1, 1]])
    np.testing.assert_array_equal(complete_matrix(r).correlation, r)


def test_nonchordal_default_rejected_but_explicit_vine_can_be_valid():
    r = np.array([[1, .1, np.nan, .1], [.1, 1, .1, np.nan],
                  [np.nan, .1, 1, .1], [.1, np.nan, .1, 1]])
    with pytest.raises(ValueError, match="chordal"):
        complete_matrix(r)
    result = complete_matrix(r, method="vine", strategy="d-vine")
    assert result.diagnostics["positive_definite"]
    assert not result.diagnostics["max_entropy_certified"]


def test_zero_vine_can_be_feasible_without_being_maximum_entropy():
    result = complete_matrix(chain(), method="vine", strategy="c-vine", order=[1, 2, 3])
    assert result.correlation[0, 2] == 0
    assert not result.diagnostics["max_entropy_certified"]


def test_manual_values_requested_and_conflicts_rejected():
    with pytest.raises(MissingPartialCorrelations) as caught:
        complete_matrix(chain(), method="vine", missing="error")
    assert caught.value.edges == ["1,3.2"]
    with pytest.raises(ValueError, match="conflicts"):
        complete_matrix(chain(), method="vine", partials=[{"conditioned": [1, 2], "value": .7}])
    with pytest.raises(ValueError, match="not an edge"):
        complete_matrix(chain(), method="vine", partials=[{"conditioned": [1, 3], "value": .2}])
    with pytest.raises(ValueError, match="method='vine'"):
        complete_matrix(chain(), partials=[{"conditioned": [1, 3], "conditioning": [2], "value": .2}])


@pytest.mark.parametrize("value", [-1, 1, np.nan, np.inf])
def test_invalid_partial_values(value):
    with pytest.raises(ValueError, match="between -1 and 1"):
        correlation_from_partial(chain(), 1, 3, [2], value)


@pytest.mark.parametrize("r,kind,match", [
    ([[1, .2], [.3, 1]], "correlation", "symmetric"),
    ([[1, None], [.3, 1]], "correlation", "symmetric"),
    ([[2, .2], [.2, 1]], "correlation", "diagonal"),
    ([[1, 1], [1, 1]], "correlation", "strictly"),
    ([[1, float("inf")], [float("inf"), 1]], "correlation", "Infinite"),
    ([[0, .1], [.1, 1]], "covariance", "diagonal"),
    ([[1, .9, -.9], [.9, 1, .9], [-.9, .9, 1]], "correlation", "outside|indefinite"),
    ([[1, 0, 0], [0, 1, 0]], "correlation", "square"),
])
def test_invalid_matrices(r, kind, match):
    with pytest.raises(ValueError, match=match):
        complete_matrix(r, kind=kind)


def test_invalid_custom_trees():
    trees = [[{"conditioned": [1, 2]}, {"conditioned": [2, 3]}],
             [{"conditioned": [1, 2], "conditioning": [3]}]]
    with pytest.raises(ValueError, match="proximity"):
        build_vine(chain(), "custom", custom_trees=trees)


def test_cli_plan_complete_csv_and_override(tmp_path, capsys):
    output, csv_path = tmp_path / "result.json", tmp_path / "result.csv"
    assert main(["plan", str(EXAMPLES / "five_by_five.json"), "--strategy", "d-vine",
                 "--order", "5,1,2,4,3"]) == 0
    plan = json.loads(capsys.readouterr().out)
    assert plan["dimension"] == 5
    assert len(plan["edges"]) == 10
    assert len(plan["free_edges_for_vine_method"]) == 4
    assert main(["complete", str(EXAMPLES / "gaussian_partial.json"),
                 "--output", str(output), "--csv", str(csv_path)]) == 0
    report = json.loads(output.read_text())
    restored = np.loadtxt(csv_path, delimiter=",")
    np.testing.assert_allclose(restored, report["matrix"])
    assert report["matrix"][0][2] == pytest.approx(.55)


def test_csv_missing_input_and_json_errors(tmp_path, capsys):
    source = tmp_path / "input.csv"
    source.write_text("1,.5,NA\n.5,1,.5\n, .5,1\n")
    assert main(["complete", str(source)]) == 0
    assert json.loads(capsys.readouterr().out)["matrix"][0][2] == pytest.approx(.25)
    assert main(["complete", str(source), "--method", "vine", "--missing", "error"]) == 2
    error = json.loads(capsys.readouterr().err)
    assert error["required_edges"] == ["1,3.2"]
    source = tmp_path / "input.json"
    source.write_text('{"matrix":[[1,0],[0,1]],"stategy":"d-vine"}')
    assert main(["complete", str(source)]) == 2
    assert "Unknown problem fields" in capsys.readouterr().err
