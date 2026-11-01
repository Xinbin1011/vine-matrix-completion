"""Build the public browser demo from the separately owned local UI.

No numerical reimplementation: the archive includes the current Python package
and the same bounded adapter used by the localhost service.
"""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

REPO = Path(__file__).resolve().parents[1]
PROJECT = REPO.parent
SITE = REPO / "docs"
LOCAL = REPO / "web/local-demo"
SITE.mkdir(exist_ok=True)
(SITE / "resources").mkdir(exist_ok=True)

for name in ("styles.css", "explorer.css", "inputs.js"):
    shutil.copy2(LOCAL / "dist" / name, SITE / name)
for name in ("solver-worker.mjs", "solver-client.js"):
    shutil.copy2(REPO / "web" / name, SITE / name)

js = (LOCAL / "dist/explorer.js").read_text(encoding="utf-8")
old = "async function request(action){const response=await fetch('/api/analyse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(action))});const output=await response.json();return output;}"
new = "async function request(action){return window.matrixSolver.request(payload(action));}"
if old not in js:
    raise RuntimeError("Local request adapter changed; review the integration before rebuilding.")
js = js.replace(old, new)
js = js.replace("The local Python solver could not be reached. Run employer-demo/serve.py and open its localhost URL. ",
                "The browser solver could not load. Keep this page open during its first download, then retry or reload. ")
js = js.replace("Local solver unavailable", "Browser solver unavailable").replace("Local calculation failed:", "Browser calculation failed:")
(SITE / "explorer.js").write_text(js, encoding="utf-8")

page = (LOCAL / "dist/index.html").read_text(encoding="utf-8")
page = page.replace('<script defer src="inputs.js"></script>', '<script defer src="inputs.js"></script>\n  <script defer src="solver-client.js"></script>')
page = page.replace('href="research/notebook.ipynb"', 'href="resources/GIRO_2026_matrix_completion.ipynb"')
page = page.replace('href="research/case-study.md"', 'href="resources/technical-summary.md"')
page = page.replace('href="research/validation.json"', 'href="resources/numerical-validation.json"')
page = page.replace('Local Python package', 'Loading browser solver…')
page = page.replace('Computed by the existing Python package on this computer. Only the incomplete matrix and chosen assumptions are sent to the local solver.',
                    'Calculated in your browser using the Python package. Your matrix is not sent to a server.')
page = page.replace('Local Python calculation. Only the incomplete matrix and chosen assumptions are sent to the solver on this computer.',
                    'Calculated in your browser using the Python package. Your matrix is not sent to a server.')
if 'Local Python calculation' in page or 'sent to the local solver' in page:
    raise RuntimeError('Local-only runtime wording remains in the public page; review the build mapping.')
page = page.replace('Local preview · Python calculations on this computer · No external data sent',
                    'Browser calculations · Your matrix stays in this browser')
page = page.replace('This explorer covers the matrix-completion part of the team’s work for GIRO 2026.',
                    'This explorer covers the matrix-completion part of the team’s work for GIRO 2026. The first visit downloads the browser Python runtime; later calculations run locally in your browser.')
page = page.replace('<div class="resource-links">', '<div class="resource-links"><a href="notebook.html">Read the notebook ↗</a><a href="resources/GIRO_2026_D10_slides.pdf">D10 slides ↗</a>')
(SITE / "index.html").write_text(page, encoding="utf-8")
(SITE / ".nojekyll").write_text("", encoding="utf-8")

sources = list((REPO / "src/vine_completion").glob("*.py"))
with zipfile.ZipFile(SITE / "solver-python.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    archive.write(LOCAL / "backend.py", "employer-demo/backend.py")
    for path in sources:
        archive.write(path, "vine-matrix-completion/src/vine_completion/" + path.name)

summary = (LOCAL / "CASE_STUDY.md").read_text(encoding="utf-8")
summary = summary.replace('../5x5%20Matrix%20Completion.ipynb', 'GIRO_2026_matrix_completion.ipynb')
summary = summary.replace('[GIRO process slides](../Vine_Copulas__GIRO_2026.pdf)',
                          '[GIRO 2026 slides (D10)](GIRO_2026_D10_slides.pdf)')
summary = summary.replace('The local browser preview uses the Python package.',
                          'The public browser demo and local Python alternative use the same Python package.')
summary = summary.replace('the unchanged research [notebook]', 'the conference [notebook]')
summary = summary.replace('Validation and this unpublished local presentation use Codex assistance.',
                          'Browser presentation and additional validation used Codex assistance.')
(SITE / "resources/technical-summary.md").write_text(summary, encoding="utf-8")
shutil.copy2(LOCAL / "validation/general-backend-validation.json", SITE / "resources/numerical-validation.json")
notebook = REPO / "notebooks/GIRO_2026_matrix_completion.ipynb"
if notebook.exists():
    shutil.copy2(notebook, SITE / "resources" / notebook.name)

# A separate local-Python option for a conference laptop or another computer.
with zipfile.ZipFile(SITE / "resources/local-python-demo.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for path in LOCAL.rglob("*"):
        if path.is_file():
            relative = path.relative_to(LOCAL)
            if notebook.exists() and relative.as_posix() == "dist/research/notebook.ipynb":
                archive.write(notebook, "employer-demo/" + relative.as_posix())
            else:
                archive.write(path, "employer-demo/" + relative.as_posix())
    for path in sources:
        archive.write(path, "vine-matrix-completion/src/vine_completion/" + path.name)
    archive.write(REPO / "LICENSE", "vine-matrix-completion/LICENSE")
    if notebook.exists() and not (LOCAL / "dist/research/notebook.ipynb").exists():
        archive.write(notebook, "employer-demo/dist/research/notebook.ipynb")
    archive.writestr("START_HERE.txt", "GIRO 2026 local Python explorer\nTeam members: Tim Harrison, Paul Hewson and Xinbin Xu.\n\nInstall Python 3.10+, NumPy and NetworkX. From this extracted folder run:\npython -m pip install numpy networkx\npython employer-demo/serve.py\nThen open http://127.0.0.1:8766/\nThe server binds only to this computer. No browser Python download is needed.\nThe public browser version is https://xinbin1011.github.io/vine-matrix-completion/\n")

manifest = {"runtime": "Pyodide 314.0.7", "backend_sha256": hashlib.sha256((LOCAL / "backend.py").read_bytes()).hexdigest(),
            "package_sources": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
            "ui_sources": {name: hashlib.sha256((LOCAL / "dist" / name).read_bytes()).hexdigest()
                           for name in ("index.html", "explorer.js", "explorer.css", "styles.css", "inputs.js")}}
(SITE / "resources/build-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"site": str(SITE), "backend_sha256": manifest["backend_sha256"], "python_files": len(sources)}))
