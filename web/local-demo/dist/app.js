(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { scenario: "five", view: "completed", scale: "correlation", result: null };
  const matrixNumber = (x) => (Math.abs(x) >= 1000 ? x.toExponential(2) : (Math.abs(x) < 0.00005 ? 0 : x).toFixed(4)).replace("-", "−");
  const scientific = (x) => x === 0 ? "0" : x.toExponential(1).replace("e-", "e−");
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rho = (pair, cond = []) => `ρ<sub>${pair.join("")}${cond.length ? "·" + cond.join(",") : ""}</sub>`;

  function settings() {
    return state.scenario === "five" ? {
      variance: $("variance").valueAsNumber,
      covariance: $("covariance").valueAsNumber,
      keepHistoricalZero: $("keep-zero").checked,
    } : {mode: $("policy").value, partial: Number($("partial").value)};
  }

  function selectScenario(name) {
    state.scenario = name;
    state.view = "completed";
    if (name === "three") state.scale = "correlation";
    $("five-controls").hidden = name !== "five";
    $("three-controls").hidden = name !== "three";
    $("scale").value = state.scale;
    $("scale").disabled = name === "three";
    document.querySelectorAll("[data-scenario]").forEach((button) => {
      button.setAttribute("aria-selected", String(button.dataset.scenario === name));
      button.tabIndex = button.dataset.scenario === name ? 0 : -1;
    });
    $("workspace").setAttribute("aria-labelledby", `tab-${name}`);
    render();
  }

  function reset() {
    $("variance").value = "46";
    $("covariance").value = "-15";
    $("keep-zero").checked = false;
    $("policy").value = "maxdet";
    $("partial").value = "0.4";
    state.scale = "correlation";
    state.view = "completed";
    $("scale").value = state.scale;
    $("show-inferred").checked = true;
    render();
  }

  function render() {
    const options = settings();
    const explicit = state.scenario === "three" && options.mode === "partial";
    $("partial").disabled = !explicit;
    $("partial-output").value = (explicit ? options.partial : 0).toFixed(2);
    $("partial-hint").textContent = explicit
      ? "Move the slider to choose a residual correlation. The ordinary correlation and validation update together."
      : "Maximum determinant chooses zero. Select the other policy to set a different assumption.";
    $("view-completed").classList.toggle("selected", state.view === "completed");
    $("view-input").classList.toggle("selected", state.view === "input");
    $("view-completed").setAttribute("aria-pressed", String(state.view === "completed"));
    $("view-input").setAttribute("aria-pressed", String(state.view === "input"));
    $("result-eyebrow").textContent = state.scenario === "five" ? "Five-risk example" : "Three-risk assumption experiment";
    $("result-title").textContent = `${state.view === "input" ? "Supplied" : "Completed"} ${state.scale === "covariance" ? "covariance" : "correlation"} matrix`;
    state.result = null;
    try {
      if (!globalThis.VineDemo) throw new Error("The calculation engine did not load. Keep engine.js beside index.html, then reload.");
      const result = state.scenario === "five" ? VineDemo.fiveRisk(options) : VineDemo.threeRisk(options);
      state.result = result;
      $("error").hidden = true;
      $("visuals").hidden = false;
      $("partial-details").hidden = false;
      $("export").disabled = false;
      $("status").className = "status" + (result.diagnostics.maxDetCertified ? "" : " assumed");
      $("status").textContent = result.diagnostics.maxDetCertified ? "Valid · max determinant certified" : "Valid · explicit partial assumption";
      renderMatrix(result);
      renderGraph(result);
      renderDiagnostics(result);
      renderSummary(result, options);
      renderPartials(result);
    } catch (error) {
      $("error").hidden = false;
      $("error-detail").textContent = error.message;
      $("visuals").hidden = true;
      $("matrix-container").replaceChildren();
      $("network").replaceChildren();
      $("partial-details").hidden = true;
      $("partials-table").replaceChildren();
      $("export").disabled = true;
      $("status").className = "status invalid";
      $("status").textContent = "Input rejected · no certificate";
      $("diagnostics").innerHTML = ["Minimum eigenvalue of R", "Supplied-entry error", "log det(R)", "Free precision residual"].map((label) => `<div class="metric"><span>${label}</span><strong>—</strong><small>No accepted result</small></div>`).join("");
      $("result-summary").innerHTML = "<strong>The supplied assumptions failed the numerical checks.</strong> This screen does not replace them with different values or reuse an earlier certificate.";
    }
  }

  function renderMatrix(result) {
    const inputCorrelation = result.input.map((row, i) => row.map((value, j) => value === null ? null : i === j ? 1 : value / Math.sqrt(result.input[i][i]) / Math.sqrt(result.input[j][j])));
    const matrix = state.view === "input"
      ? (state.scale === "covariance" ? result.input : inputCorrelation)
      : (state.scale === "covariance" ? result.matrix : result.correlation);
    const type = state.scale === "covariance" ? "Covariance in original input units" : "Ordinary Pearson correlation (not latent Gaussian by default)";
    let html = `<table class="matrix"><caption>${type}</caption><thead><tr><th scope="col"><span aria-label="Risk">Risk</span></th>${matrix.map((_, i) => `<th scope="col">R${i+1}</th>`).join("")}</tr></thead><tbody>`;
    matrix.forEach((row, i) => {
      html += `<tr><th scope="row">R${i+1}</th>`;
      row.forEach((value, j) => {
        const source = value === null ? "missing" : i === j ? "diagonal" : result.observed[i][j] ? "supplied" : "inferred";
        const description = `Risks ${i+1} and ${j+1}: ${value === null ? "unknown entry" : `${source}, ${state.scale}, ${value.toPrecision(8)}`}`;
        html += `<td class="${source}" tabindex="0" title="${escape(description)}" aria-label="${escape(description)}" data-detail="${escape(description)}">${value === null ? "?" : matrixNumber(value)}${source === "inferred" ? '<sup aria-hidden="true">*</sup>' : ""}</td>`;
      });
      html += "</tr>";
    });
    $("matrix-container").innerHTML = html + "</tbody></table>";
    $("cell-detail").textContent = "Focus a matrix entry to inspect its source. * Inferred under the selected policy.";
    $("matrix-container").querySelectorAll("td").forEach((cell) => {
      const show = () => { $("cell-detail").textContent = cell.dataset.detail; };
      cell.addEventListener("focus", show);
      cell.addEventListener("mouseenter", show);
    });
  }

  function renderGraph(result) {
    const svg = $("network");
    const n = result.correlation.length;
    const points = n === 5 ? [[74,70],[253,65],[270,220],[150,155],[55,250]] : [[65,215],[165,65],[265,215]];
    const showCompleted = state.view === "completed" && $("show-inferred").checked;
    let content = `<title>${showCompleted ? "Completed" : "Supplied"} relationship graph for ${n} generic risk quantities</title>`;
    for (let i = 0; i < n; i++) {
      for (let j = i+1; j < n; j++) {
        const observed = result.observed[i][j];
        if (!observed && !showCompleted) continue;
        const r = result.correlation[i][j];
        const [x1,y1] = points[i], [x2,y2] = points[j];
        const kind = observed ? "supplied" : "inferred";
        content += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${observed ? "edge-observed" : "edge-inferred"}${r < 0 ? " edge-negative" : ""}" stroke-width="${1 + Math.abs(r)*2.3}" opacity="${observed ? .8 : .65}"><title>Risks ${i+1} and ${j+1}: ${kind} correlation ${r.toFixed(6)}</title></line>`;
      }
    }
    points.forEach(([x,y], i) => { content += `<circle class="network-node" cx="${x}" cy="${y}" r="23"/><text class="network-text" x="${x}" y="${y}">R${i+1}</text>`; });
    content += '<text x="12" y="296" fill="#78866e" font-size="9">Orange: negative · Green: positive · Width: |correlation|</text>';
    svg.innerHTML = content;
  }

  function renderDiagnostics(result) {
    const d = result.diagnostics;
    const metrics = [
      ["Minimum eigenvalue of R", d.minEigenvalue.toFixed(6), "Positive definite if > 1e−10"],
      ["Supplied-entry error in R", scientific(d.observedError), "Supplied inputs retained exactly"],
      ["log det(R)", d.logDeterminant.toFixed(6), "Compare only under the same constraints"],
      ["Free precision residual", scientific(d.freePrecisionResidual), d.maxDetCertified ? "≤ 1e−8 · max determinant certified" : "> 1e−8 · different partial assumption"],
    ];
    $("diagnostics").innerHTML = metrics.map(([label,value,note]) => `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`).join("");
  }

  function renderSummary(result, options) {
    if (state.scenario === "five") {
      const m = result.matrix[0][2];
      $("result-summary").innerHTML = `<strong>${result.freePairs.length} missing pairs completed.</strong> The inferred risk 2–5 correlation is <strong>${matrixNumber(result.correlation[1][4])}</strong> (covariance <strong>${matrixNumber(result.matrix[1][4])}</strong>). ${options.keepHistoricalZero ? "The historical 1–3 zero stays fixed." : `Risk 1–3 covariance is <strong>${matrixNumber(m)}</strong>.`} Every supplied value stays fixed. This result ${options.variance === 46 && options.covariance === -15 && !options.keepHistoricalZero ? "reproduces the notebook’s baseline" : "uses your current assumptions"}.`;
    } else {
      const explicit = options.mode === "partial";
      $("result-summary").innerHTML = `<strong>${rho([1,3])} = ${matrixNumber(result.correlation[0][2])}.</strong> ${explicit ? `Your residual-correlation assumption is ${rho([1,3],[2])} = ${Number(options.partial).toFixed(2)}. ${result.diagnostics.maxDetCertified ? "At zero it coincides with maximum determinant." : "The matrix is valid, but this does not maximise determinant under the original two fixed correlations."}` : `Maximum determinant chooses ${rho([1,3],[2])} = 0, giving the ordinary correlation 0.25. Try 0.4 to obtain 0.55 instead.`}`;
    }
  }

  function renderPartials(result) {
    $("vine-explanation").textContent = state.scenario === "five"
      ? "The completed matrix is expressed on the original notebook’s selected vine. Its weights are recomputed from this result; they are not a claim that an arbitrary greedy vine guarantees maximum determinant. Tree 1 uses ordinary correlations. Higher trees use partial correlations (dot notation)."
      : "The first tree contains the two supplied ordinary correlations. The higher-tree edge is the partial correlation between risks 1 and 3 after removing the linear effect of risk 2.";
    const levels = state.scenario === "five" ? [1,1,1,1,2,2,2,3,3,4] : [1,1,2];
    $("partials-table").innerHTML = '<table class="partials"><thead><tr><th>Tree</th><th>Correlation / partial correlation</th><th>Value</th><th>Interpretation</th></tr></thead><tbody>' + result.partials.map((edge,i) => `<tr><td>T${levels[i]}</td><td>${rho(edge.pair, edge.conditioning)}</td><td>${Math.abs(edge.value) < 1e-10 ? "0.000000" : edge.value.toFixed(6)}</td><td>${edge.conditioning.length ? "Linear residual correlation" : "Ordinary correlation"}</td></tr>`).join("") + '</tbody></table>';
  }

  document.querySelectorAll("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => selectScenario(button.dataset.scenario));
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        selectScenario(state.scenario === "five" ? "three" : "five");
        $(`tab-${state.scenario}`).focus();
      }
    });
  });
  ["variance", "covariance", "keep-zero", "policy", "partial"].forEach((id) => $(id).addEventListener("input", render));
  $("reset").addEventListener("click", reset);
  $("scale").addEventListener("change", () => { state.scale = $("scale").value; render(); });
  $("view-completed").addEventListener("click", () => { state.view = "completed"; render(); });
  $("view-input").addEventListener("click", () => { state.view = "input"; render(); });
  $("show-inferred").addEventListener("change", () => { if (state.result) renderGraph(state.result); });
  $("stronger").addEventListener("click", () => { $("variance").value = 46; $("covariance").value = -30; $("keep-zero").checked = false; render(); });
  $("invalid").addEventListener("click", () => { $("variance").value = 10; $("covariance").value = -35; render(); });
  $("partial-example").addEventListener("click", () => { $("policy").value = "partial"; $("partial").value = 0.4; render(); });
  $("export").addEventListener("click", () => {
    if (!state.result) return;
    const output = {description: "Illustrative research scenario; not an empirically calibrated insurance model.",
      scenario: state.scenario, settings: settings(),
      matrixScale: "Ordinary Pearson correlation; covariance retained in original units for five-risk example.",
      result: state.result, source: "Max Xu research notebook / vine-matrix-completion package", 
      limitations: "Supported fixed graph patterns only. No non-Gaussian copula, capital or tail-dependence inference."};
    const url = URL.createObjectURL(new Blob([JSON.stringify(output,null,2)], {type:"application/json"}));
    const link = document.createElement("a");
    link.href = url; link.download = `vine-matrix-${state.scenario}-scenario.json`;
    link.click(); URL.revokeObjectURL(url);
  });
  render();
})();
