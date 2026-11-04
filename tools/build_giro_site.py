"""Build the public browser demo from the separately owned local UI.

No numerical reimplementation: the archive includes the current Python package
and the same bounded adapter used by the localhost service.
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import zipfile

REPO = Path(__file__).resolve().parents[1]
PROJECT = REPO.parent
SITE = REPO / "docs"
LOCAL = REPO / "web/local-demo"
SITE.mkdir(exist_ok=True)
(SITE / "resources").mkdir(exist_ok=True)

UI_ASSETS = ("styles.css", "explorer.css", "inputs.js", "simple-equations.js", "vine-editor.js")
SLIDES = (
    ("GIRO_2026_Matrix_Completion_D35_2026-11-04.pdf", "D35 slides · 4 Nov 2026"),
    ("GIRO_2026_Matrix_Completion_D35_with_construction_2026-11-04.pdf", "D35 with construction · 4 Nov 2026"),
    ("GIRO_2026_Matrix_Completion_D35_reveal_2026-11-04.pdf", "D35 reveal · 4 Nov 2026"),
)
EARLIER_SLIDES = (
    ("GIRO_2026_Matrix_Completion_Graph_D17_2026-11-01.pdf", "D17 graph slides (earlier) · 1 Nov 2026"),
    ("GIRO_2026_Matrix_Completion_Matrix_D17_2026-11-01.pdf", "D17 matrix slides (earlier) · 1 Nov 2026"),
)
PREVIOUS_DEMO = "versions/2026-11-04-before-greedy-rule-clarification/"

for name in UI_ASSETS:
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
page = page.replace('Calculated by the Python solver on this computer.',
                    'Calculated in your browser using Python.')
page = page.replace('Computed by the existing Python package on this computer. Only the incomplete matrix and chosen assumptions are sent to the local solver.',
                    'Calculated in your browser using the Python package. Your matrix is not sent to a server.')
page = page.replace('Local Python calculation. Only the incomplete matrix and chosen assumptions are sent to the solver on this computer.',
                    'Calculated in your browser using the Python package. Your matrix is not sent to a server.')
page = page.replace('Local preview · Python calculations on this computer · No external data sent',
                    'Browser calculations · Your matrix stays in this browser')
if any(text in page for text in ('Local Python calculation', 'sent to the local solver', 'on this computer')):
    raise RuntimeError('Local-only runtime wording remains in the public page; review the build mapping.')
page = page.replace('This explorer covers the matrix-completion part of the team’s work for GIRO 2026.',
                    'This explorer covers the matrix-completion part of the team’s work for GIRO 2026. The first visit downloads the browser Python runtime; later calculations run locally in your browser.')
resource_links = '<a href="notebook.html">Read the notebook ↗</a>'
for filename, label in SLIDES + EARLIER_SLIDES:
    if not (SITE / "resources" / filename).is_file():
        raise RuntimeError(f"Missing reviewed slide resource: {filename}")
    resource_links += f'<a href="resources/{filename}">{label} ↗</a>'
resource_links += '<a href="resources/GIRO_2026_D10_slides.pdf">D10 slides (earlier) ↗</a>'
resource_links += f'<a href="{PREVIOUS_DEMO}">Previous demo · before 4 Nov clarification ↗</a>'
page = page.replace('<div class="resource-links">', '<div class="resource-links">' + resource_links)
# The HTML, client, worker and Python archive must move to the same release.
# Propagate a content version to the worker and archive to avoid a stale adapter.
version_inputs = [LOCAL / "backend.py", LOCAL / "dist/explorer.js"]
version_inputs += [LOCAL / "dist" / name for name in UI_ASSETS]
version_inputs += [REPO / "web" / name for name in ("solver-client.js", "solver-worker.mjs")]
version_inputs += sorted((REPO / "src/vine_completion").glob("*.py"))
asset_version = hashlib.sha256(b"".join(p.read_bytes() for p in version_inputs)).hexdigest()[:16]
page = re.sub(r'((?:src|href)=")([\w.-]+\.(?:js|css))(?:\?[^\"]*)?(\")',
              lambda match: f'{match[1]}{match[2]}?v={asset_version}{match[3]}', page)
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
summary += "\n\nCurrent and earlier slides (4 November 2026): " + " · ".join(
    f"[{label}]({filename})" for filename, label in SLIDES + EARLIER_SLIDES
) + ". The [earlier D10 slides](GIRO_2026_D10_slides.pdf) remain available.\n"
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
            if "__pycache__" in relative.parts or path.suffix in {".pyc", ".pyo"}:
                continue
            if notebook.exists() and relative.as_posix() == "dist/research/notebook.ipynb":
                archive.write(notebook, "employer-demo/" + relative.as_posix())
            else:
                archive.write(path, "employer-demo/" + relative.as_posix())
    for path in sources:
        archive.write(path, "vine-matrix-completion/src/vine_completion/" + path.name)
    archive.write(REPO / "LICENSE", "vine-matrix-completion/LICENSE")
    # Keep the downloadable worked notebook runnable from a normal notebooks folder.
    # These are the same repository inputs used by its setup and optional example.
    notebook_resources = [
        "pyproject.toml", "README.md", "examples/five_by_five.json",
        "notebooks/GIRO_2026_matrix_completion.ipynb",
        "notebooks/GIRO_2026_matrix_completion_v1.ipynb",
        "docs/resources/GIRO_2026_D10_slides.pdf",
        "docs/resources/technical-summary.md",
        "docs/resources/completion-workflow.png",
        "docs/resources/missing-correlation-dependencies.png",
    ]
    notebook_resources += ["docs/resources/" + filename for filename, _ in SLIDES + EARLIER_SLIDES]
    for relative in notebook_resources:
        archive.write(REPO / relative, "vine-matrix-completion/" + relative)
    if notebook.exists() and not (LOCAL / "dist/research/notebook.ipynb").exists():
        archive.write(notebook, "employer-demo/dist/research/notebook.ipynb")
    start_here = "GIRO 2026 local Python explorer\nTeam members: Tim Harrison, Paul Hewson and Xinbin Xu.\n\nInstall Python 3.10+, NumPy and NetworkX. From this extracted folder run:\npython -m pip install numpy networkx\npython employer-demo/serve.py\nThen open http://127.0.0.1:8766/\nThe server binds only to this computer. No browser Python download is needed.\nThe public browser version is https://xinbin1011.github.io/vine-matrix-completion/\n"
    # Appending matches the preserved base instructions and keeps both uses explicit.
    notebook_instructions = (
        "\nWorked notebook:\n"
        "Open vine-matrix-completion/notebooks/GIRO_2026_matrix_completion.ipynb in Jupyter.\n"
        'From vine-matrix-completion run: python -m pip install -e ".[plot]"\n'
        "Its example data, current D35 slides, earlier D17 graph/matrix slides and D10 slides are included. The older notebook is saved alongside it.\n"
        "For the full repository and developer resources use https://github.com/Xinbin1011/vine-matrix-completion\n"
    )
    archive.writestr("START_HERE.txt", start_here + notebook_instructions)

manifest = {"runtime": "Pyodide 314.0.7", "asset_version": asset_version,
            "release_date": "2026-11-04", "previous_demo": PREVIOUS_DEMO,
            "backend_sha256": hashlib.sha256((LOCAL / "backend.py").read_bytes()).hexdigest(),
            "package_sources": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
            "ui_sources": {name: hashlib.sha256((LOCAL / "dist" / name).read_bytes()).hexdigest()
                           for name in ("index.html", "explorer.js", *UI_ASSETS)}}
(SITE / "resources/build-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"site": str(SITE), "backend_sha256": manifest["backend_sha256"], "python_files": len(sources)}))
