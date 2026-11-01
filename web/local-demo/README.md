# GIRO 2026 local Python explorer

Team members: Tim Harrison, Paul Hewson and Xinbin Xu.

This download runs the solver on your computer. The public browser version is https://xinbin1011.github.io/vine-matrix-completion/ and does not need the project PC online.

## Run

1. Extract the ZIP, keeping `employer-demo` beside `vine-matrix-completion`.
2. Install Python 3.10 or later, then install NumPy and NetworkX: `python -m pip install numpy networkx`.
3. From the extracted folder, run `python employer-demo/serve.py`.
4. Open http://127.0.0.1:8766/ in your browser. Stop the foreground server with Ctrl+C.

The local server binds only to 127.0.0.1. No model API or API key is used. This portable download does not require a pre-existing virtual environment or Windows launcher.

## Scope and resources

The explorer accepts 3–7-variable Pearson correlation matrices. It supports explicit vine partials and chordal maximum-determinant completion, with fresh checks for positive definiteness and preservation of supplied entries. General nonchordal optimisation and singular PSD completion are outside scope. Gaussian entropy additionally requires Gaussianity and fixed variances.

The public site links the conference notebook, D10 slides and Python package. The local notebook download is `employer-demo/dist/research/notebook.ipynb`. Numerical evidence is in `employer-demo/validation/general-backend-validation.json`.
