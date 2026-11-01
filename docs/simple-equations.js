/* An explanatory calculation only. The accepted completion stays with Python. */
(function (root) {
  'use strict';

  function solve(matrix, right) {
    const n = right.length;
    const rows = matrix.map((row, i) => [...row, right[i]]);
    const scale = Math.max(1, ...matrix.flat().map(Math.abs));
    for (let column = 0; column < n; column++) {
      let pivot = column;
      for (let row = column + 1; row < n; row++) {
        if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
      }
      if (Math.abs(rows[pivot][column]) <= Number.EPSILON * scale * n * 16) {
        throw new Error('The small equation system is too close to singular to explain reliably.');
      }
      [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
      for (let row = column + 1; row < n; row++) {
        const factor = rows[row][column] / rows[column][column];
        for (let j = column; j <= n; j++) rows[row][j] -= factor * rows[column][j];
      }
    }
    const weights = Array(n).fill(0);
    for (let row = n - 1; row >= 0; row--) {
      const remaining = rows[row][n] - rows[row].slice(row + 1, n)
        .reduce((sum, value, j) => sum + value * weights[row + 1 + j], 0);
      weights[row] = remaining / rows[row][row];
    }
    if (!weights.every(Number.isFinite)) throw new Error('The equation coefficients are not finite.');
    return weights;
  }

  function deriveChordalSteps(input, trace, accepted, tolerance = 1e-8) {
    const forest = trace.find(entry => entry.stage === 'clique_forest');
    if (!forest || !Array.isArray(forest.forestEdges)) {
      throw new Error('A verified chordal clique/separator trace is required.');
    }
    const n = input.length;
    if (!accepted || accepted.length !== n || accepted.some(row => row.length !== n || !row.every(Number.isFinite))) {
      throw new Error('An accepted finite completion is required.');
    }
    const cliques = forest.cliques;
    if (!Array.isArray(cliques) || !cliques.length || cliques.some(clique =>
      !clique.length || new Set(clique).size !== clique.length || clique.some(v => !Number.isInteger(v) || v < 1 || v > n))) {
      throw new Error('The clique labels are incomplete.');
    }
    if (cliques.some(clique => clique.some(a => clique.some(b => !Number.isFinite(input[a - 1][b - 1]))))) {
      throw new Error('A complete block contains an unknown input.');
    }
    input.forEach((row, i) => row.forEach((value, j) => {
      if (i < j && value !== null && !cliques.some(clique => clique.includes(i + 1) && clique.includes(j + 1))) {
        throw new Error('The clique trace omits a supplied correlation.');
      }
    }));
    const neighbours = cliques.map(() => []);
    forest.forestEdges.forEach(edge => {
      const [a, b] = edge.cliques;
      if (a === b || !neighbours[a] || !neighbours[b]) throw new Error('The clique forest is invalid.');
      const intersection = cliques[a].filter(v => cliques[b].includes(v)).sort((x, y) => x - y);
      const separator = [...edge.separator].sort((x, y) => x - y);
      if (!intersection.length || JSON.stringify(intersection) !== JSON.stringify(separator)) {
        throw new Error('A clique separator is inconsistent.');
      }
      neighbours[a].push({index: b, separator});
      neighbours[b].push({index: a, separator});
    });
    neighbours.forEach(list => list.sort((a, b) => b.separator.length - a.separator.length || a.index - b.index));

    const matrix = input.map(row => [...row]);
    const steps = [], visited = new Set(), finished = new Set();
    function addPair(x, y, separator) {
      const pair = [Math.min(x, y), Math.max(x, y)];
      if (matrix[pair[0] - 1][pair[1] - 1] !== null) return;
      const system = separator.map(a => separator.map(b => matrix[a - 1][b - 1]));
      const right = separator.map(a => matrix[a - 1][pair[0] - 1]);
      const terms = separator.map(a => matrix[a - 1][pair[1] - 1]);
      if (![...system.flat(), ...right, ...terms].every(Number.isFinite)) {
        throw new Error('An earlier correlation is missing from the equation sequence.');
      }
      const weights = separator.length ? solve(system, right) : [];
      const value = weights.reduce((sum, weight, i) => sum + weight * terms[i], 0);
      const difference = Math.abs(value - accepted[pair[0] - 1][pair[1] - 1]);
      if (!Number.isFinite(value) || difference > tolerance) {
        throw new Error('A simple-equation result does not agree with the accepted completion.');
      }
      steps.push({pair, separator: [...separator], system, right, terms, weights, value, difference,
        rightKnown: separator.map(a => input[a - 1][pair[0] - 1] !== null),
        termsKnown: separator.map(a => input[a - 1][pair[1] - 1] !== null)});
      matrix[pair[0] - 1][pair[1] - 1] = matrix[pair[1] - 1][pair[0] - 1] = value;
    }

    const roots = cliques.map((_, i) => i).sort((a, b) => cliques[b].length - cliques[a].length || a - b);
    roots.forEach(rootIndex => {
      if (visited.has(rootIndex)) return;
      const component = new Set(), queue = [{index: rootIndex, parent: -1, separator: []}];
      while (queue.length) {
        const current = queue.shift();
        if (visited.has(current.index)) throw new Error('The clique connections contain a cycle.');
        visited.add(current.index);
        const clique = cliques[current.index];
        const overlap = clique.filter(v => component.has(v)).sort((a, b) => a - b);
        if (JSON.stringify(overlap) !== JSON.stringify(current.separator)) {
          throw new Error('The clique sequence does not satisfy the separator connection rule.');
        }
        const introduced = clique.filter(v => !component.has(v));
        if (introduced.some(v => finished.has(v))) throw new Error('Separate clique groups share a variable.');
        introduced.forEach(x => {
          [...component].filter(y => !current.separator.includes(y)).sort((a, b) => a - b)
            .forEach(y => addPair(x, y, current.separator));
          [...finished].sort((a, b) => a - b).forEach(y => addPair(x, y, []));
        });
        introduced.forEach(v => component.add(v));
        neighbours[current.index].filter(next => next.index !== current.parent)
          .forEach(next => queue.push({...next, parent: current.index}));
      }
      component.forEach(v => finished.add(v));
    });
    if (finished.size !== n || matrix.some(row => !row.every(Number.isFinite))) {
      throw new Error('The simple sequence did not complete every missing correlation.');
    }
    const maximumDifference = Math.max(...matrix.flatMap((row, i) => row.map((v, j) => Math.abs(v - accepted[i][j]))));
    if (maximumDifference > tolerance) throw new Error('The completed matrices do not agree.');
    return {steps, matrix, maximumDifference};
  }

  function verifiedVineSteps(input, trace, accepted, tolerance = 1e-8) {
    const missing = new Set();
    input.forEach((row, i) => row.forEach((v, j) => {if (i < j && v === null) missing.add(`${i + 1},${j + 1}`);}));
    let maximumDifference = 0;
    const steps = trace.filter(e => e.stage === 'vine_edge' && e.source === 'supplied').map(e => {
      const key = [...e.pair].sort((a, b) => a - b).join(',');
      if (!missing.delete(key) || e.failed || ![e.base, e.partialValue, e.multiplier].every(Number.isFinite)) {
        throw new Error('A missing-pair equation is incomplete.');
      }
      const value = e.base + e.partialValue * e.multiplier;
      const difference = Math.abs(value - accepted[e.pair[0] - 1][e.pair[1] - 1]);
      if (!Number.isFinite(difference) || difference > tolerance) {
        throw new Error('A partial-correlation equation does not agree with the accepted completion.');
      }
      maximumDifference = Math.max(maximumDifference, difference);
      return {...e, value, difference};
    });
    if (missing.size) throw new Error('Not every missing correlation has a checked equation.');
    return {steps, maximumDifference};
  }

  const api = Object.freeze({deriveChordalSteps, verifiedVineSteps});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VineCalculations = api;
})(typeof window === 'object' ? window : globalThis);
