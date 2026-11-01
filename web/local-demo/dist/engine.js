/* Illustrative fixed-pattern matrix completion. No network, storage or dependencies. */
(function (root) {
  "use strict";

  const PD_TOLERANCE = 1e-10;
  const CERTIFICATE_TOLERANCE = 1e-8;
  const zeros = (n) => Array.from({ length: n }, () => Array(n).fill(0));
  const clone = (matrix) => matrix.map((row) => row.slice());

  function optionsObject(options) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      throw new Error("Supply the example settings as an object.");
    }
    return options;
  }

  function finiteNumber(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${name} must be a finite number.`);
    }
    return value;
  }

  // Jacobi rotations for the symmetric matrices of size at most five.
  // The stopping threshold is relative to matrix size and floating-point scale.
  function eigenvalues(matrix) {
    const a = clone(matrix);
    const n = a.length;
    for (let iteration = 0; iteration < 100 * n * n; iteration += 1) {
      let p = 0;
      let q = 0;
      let largest = 0;
      let scale = 1;
      for (let i = 0; i < n; i += 1) {
        scale = Math.max(scale, Math.abs(a[i][i]));
        for (let j = i + 1; j < n; j += 1) {
          if (Math.abs(a[i][j]) > largest) {
            largest = Math.abs(a[i][j]);
            p = i;
            q = j;
          }
        }
      }
      if (largest <= Number.EPSILON * scale * n) {
        return a.map((row, i) => row[i]).sort((x, y) => x - y);
      }
      const apq = a[p][q];
      const tau = (a[q][q] - a[p][p]) / (2 * apq);
      const t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.hypot(1, tau));
      const c = 1 / Math.hypot(1, t);
      const s = t * c;
      const app = a[p][p];
      const aqq = a[q][q];
      for (let k = 0; k < n; k += 1) {
        if (k === p || k === q) continue;
        const akp = a[k][p];
        const akq = a[k][q];
        a[k][p] = a[p][k] = c * akp - s * akq;
        a[k][q] = a[q][k] = s * akp + c * akq;
      }
      a[p][p] = app - t * apq;
      a[q][q] = aqq + t * apq;
      a[p][q] = a[q][p] = 0;
    }
    throw new Error("The small-matrix eigenvalue calculation did not converge.");
  }

  function cholesky(matrix, context) {
    const n = matrix.length;
    const l = zeros(n);
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j <= i; j += 1) {
        let value = matrix[i][j];
        for (let k = 0; k < j; k += 1) value -= l[i][k] * l[j][k];
        if (i === j) {
          if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`${context} is not positive definite at numerical precision.`);
          }
          l[i][j] = Math.sqrt(value);
        } else {
          l[i][j] = value / l[j][j];
        }
      }
    }
    return l;
  }

  function solveCholesky(l, vector) {
    const n = l.length;
    const y = Array(n).fill(0);
    const x = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      let value = vector[i];
      for (let k = 0; k < i; k += 1) value -= l[i][k] * y[k];
      y[i] = value / l[i][i];
    }
    for (let i = n - 1; i >= 0; i -= 1) {
      let value = y[i];
      for (let k = i + 1; k < n; k += 1) value -= l[k][i] * x[k];
      x[i] = value / l[i][i];
    }
    return x;
  }

  function inverseSPD(matrix, context) {
    const l = cholesky(matrix, context);
    const inverse = zeros(matrix.length);
    for (let j = 0; j < matrix.length; j += 1) {
      const unit = Array(matrix.length).fill(0);
      unit[j] = 1;
      const column = solveCholesky(l, unit);
      for (let i = 0; i < matrix.length; i += 1) inverse[i][j] = column[i];
    }
    for (let i = 0; i < matrix.length; i += 1) {
      for (let j = i + 1; j < matrix.length; j += 1) {
        inverse[i][j] = inverse[j][i] = (inverse[i][j] + inverse[j][i]) / 2;
      }
    }
    return inverse;
  }

  function requirePD(matrix, context) {
    const minimum = eigenvalues(matrix)[0];
    if (!Number.isFinite(minimum) || minimum <= PD_TOLERANCE) {
      throw new Error(`${context} is singular, indefinite or too close to singular ` +
        `(minimum correlation eigenvalue ${minimum.toPrecision(5)}; ` +
        `must exceed ${PD_TOLERANCE}).`);
    }
    return minimum;
  }

  function chordalCompletion(r, cliques, separators) {
    const precision = zeros(r.length);
    function addBlock(labels, sign) {
      const block = labels.map((i) => labels.map((j) => r[i][j]));
      requirePD(block, `Specified clique/separator ${labels.map((i) => i + 1).join(", ")}`);
      const inverse = inverseSPD(block, "Specified clique/separator");
      labels.forEach((i, x) => labels.forEach((j, y) => {
        precision[i][j] += sign * inverse[x][y];
      }));
    }
    cliques.forEach((labels) => addBlock(labels, 1));
    separators.forEach((labels) => addBlock(labels, -1));
    const completed = inverseSPD(precision, "Assembled precision matrix");
    // Check numerical preservation before restoring supplied numbers exactly.
    for (let i = 0; i < r.length; i += 1) {
      for (let j = 0; j < r.length; j += 1) {
        if (r[i][j] !== null) {
          if (Math.abs(completed[i][j] - r[i][j]) > 1e-9) {
            throw new Error("Numerical completion did not preserve the supplied correlations.");
          }
          completed[i][j] = r[i][j];
        }
      }
    }
    return completed;
  }

  function partialCorrelation(r, pair, conditioning) {
    const [x, y] = pair.map((label) => label - 1);
    const indices = conditioning.map((label) => label - 1);
    if (!indices.length) return r[x][y];
    const block = indices.map((i) => indices.map((j) => r[i][j]));
    const l = cholesky(block, "Partial-correlation conditioning block");
    const vx = indices.map((i) => r[i][x]);
    const vy = indices.map((i) => r[i][y]);
    const solvedX = solveCholesky(l, vx);
    const solvedY = solveCholesky(l, vy);
    const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
    const residualX = 1 - dot(vx, solvedX);
    const residualY = 1 - dot(vy, solvedY);
    if (Math.min(residualX, residualY) <= PD_TOLERANCE) {
      throw new Error("A partial correlation has a nonpositive or near-zero residual variance.");
    }
    const value = (r[x][y] - dot(vx, solvedY)) / Math.sqrt(residualX * residualY);
    if (!Number.isFinite(value) || Math.abs(value) >= 1) {
      throw new Error("A reconstructed partial correlation lies outside (-1, 1).");
    }
    return value;
  }

  function result(input, kind, r, method, partialSpecifications) {
    const n = input.length;
    const observed = input.map((row) => row.map((value) => value !== null));
    const std = input.map((row, i) => Math.sqrt(row[i]));
    const freePairs = [];
    let observedError = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (!Number.isFinite(r[i][j]) || Math.abs(r[i][j] - r[j][i]) > 1e-12) {
          throw new Error("The completed correlation matrix is non-finite or asymmetric.");
        }
        if (observed[i][j]) {
          const supplied = i === j ? 1 : input[i][j] / std[i] / std[j];
          observedError = Math.max(observedError, Math.abs(r[i][j] - supplied));
        } else if (i < j) freePairs.push([i + 1, j + 1]);
      }
    }
    if (observedError > 1e-10) throw new Error("The completion changed a supplied observation.");
    const minEigenvalue = requirePD(r, "Completed correlation matrix");
    const l = cholesky(r, "Completed correlation matrix");
    const logDeterminant = 2 * l.reduce((sum, row, i) => sum + Math.log(row[i]), 0);
    const precision = inverseSPD(r, "Completed correlation matrix");
    let freePrecisionResidual = 0;
    freePairs.forEach(([i, j]) => {
      freePrecisionResidual = Math.max(freePrecisionResidual, Math.abs(precision[i - 1][j - 1]));
    });
    const maxDetCertified = freePrecisionResidual <= CERTIFICATE_TOLERANCE;
    if (method === "maxdet" && !maxDetCertified) {
      throw new Error("The maximum-determinant numerical certificate failed; " +
        "choose settings farther from a singular boundary.");
    }
    const matrix = r.map((row, i) => row.map((value, j) => {
      const restored = observed[i][j] ? input[i][j] : value * std[i] * std[j];
      if (!Number.isFinite(restored)) throw new Error("The covariance scale exceeds numerical range.");
      return restored;
    }));
    return {
      input: clone(input), kind, correlation: clone(r), matrix, observed,
      diagnostics: { positiveDefinite: true, minEigenvalue, logDeterminant,
        observedError, freePrecisionResidual, maxDetCertified },
      partials: partialSpecifications.map(([pair, conditioning]) => ({
        pair: pair.slice(), conditioning: conditioning.slice(),
        value: partialCorrelation(r, pair, conditioning),
      })),
      method, freePairs,
    };
  }

  function fiveRisk(options = {}) {
    optionsObject(options);
    const variance = finiteNumber(options.variance === undefined ? 46 : options.variance, "Risk 5 variance");
    const covariance = finiteNumber(options.covariance === undefined ? -15 : options.covariance, "Covariance M15");
    const keepHistoricalZero = options.keepHistoricalZero === undefined ? false : options.keepHistoricalZero;
    if (typeof keepHistoricalZero !== "boolean") throw new Error("keepHistoricalZero must be true or false.");
    if (variance <= 0) throw new Error("Risk 5 variance must be strictly positive.");
    if (Math.abs(covariance / Math.sqrt(35) / Math.sqrt(variance)) >= 1) {
      throw new Error("Covariance M15 must satisfy |M15| < sqrt(35 × risk 5 variance).");
    }
    const input = [
      [35, -25, keepHistoricalZero ? 0 : null, 10, covariance],
      [-25, 52, 24, -31, null],
      [keepHistoricalZero ? 0 : null, 24, 38, -2, null],
      [10, -31, -2, 30, null],
      [covariance, null, null, null, variance],
    ];
    const std = input.map((row, i) => Math.sqrt(row[i]));
    const r = input.map((row, i) => row.map((value, j) =>
      value === null ? null : i === j ? 1 : value / std[i] / std[j]));
    const cliques = keepHistoricalZero ? [[0, 1, 2, 3], [0, 4]] : [[0, 1, 3], [1, 2, 3], [0, 4]];
    const separators = keepHistoricalZero ? [[0]] : [[1, 3], [0]];
    const completed = chordalCompletion(r, cliques, separators);
    const specifications = [
      [[1, 5], []], [[1, 2], []], [[2, 3], []], [[2, 4], []],
      [[2, 5], [1]], [[1, 4], [2]], [[3, 4], [2]],
      [[4, 5], [1, 2]], [[1, 3], [2, 4]], [[3, 5], [1, 2, 4]],
    ];
    return result(input, "covariance", completed, "maxdet", specifications);
  }

  function threeRisk(options = {}) {
    optionsObject(options);
    const mode = options.mode === undefined ? "maxdet" : options.mode;
    if (mode !== "maxdet" && mode !== "partial") throw new Error("Choose mode 'maxdet' or 'partial'.");
    const requested = finiteNumber(options.partial === undefined ? 0 : options.partial, "Partial correlation");
    if (mode === "partial" && Math.abs(requested) >= 1) {
      throw new Error("The partial correlation must lie strictly between -1 and 1.");
    }
    const partial = mode === "maxdet" ? 0 : requested;
    const input = [[1, 0.5, null], [0.5, 1, 0.5], [null, 0.5, 1]];
    const ordinary = 0.25 + 0.75 * partial;
    const completed = [[1, 0.5, ordinary], [0.5, 1, 0.5], [ordinary, 0.5, 1]];
    return result(input, "correlation", completed, mode, [
      [[1, 2], []], [[2, 3], []], [[1, 3], [2]],
    ]);
  }

  root.VineDemo = Object.freeze({ fiveRisk, threeRisk });
})(globalThis);
