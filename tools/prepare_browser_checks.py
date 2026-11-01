"""Prepare cross-runtime cases from CPython, without modifying solver sources."""
from pathlib import Path
import json
import sys
import numpy as np

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO.parent / "employer-demo"))
from backend import analyse

cases = []
def add(name, matrix, method="max_entropy", strategy="greedy", order=None, partials=None, action="complete"):
    payload = dict(matrix=matrix, method=method, strategy=strategy,
                   order=order or list(range(1, len(matrix)+1)), partials=partials or [], action=action)
    cases.append(dict(name=name, payload=payload, expected=analyse(payload)))

slides = [[1,-.586,None,.309,-.374],[-.586,1,.540,-.785,None],
          [None,.540,1,-.059,None],[.309,-.785,-.059,1,None],[-.374,None,None,None,1]]
for strategy in ("greedy", "c-vine", "d-vine"):
    add("GIRO maxdet " + strategy, slides, strategy=strategy)
plan = analyse(dict(matrix=slides, method="vine", strategy="greedy", order=[1,2,3,4,5], partials=[], action="plan"))
partials = [dict(conditioned=e["conditioned"], conditioning=e["conditioning"], value=0)
            for e in plan["plan"]["freeEdges"]]
add("GIRO explicit zeros", slides, method="vine", partials=partials)
for n in range(3, 8):
    rng = np.random.default_rng(700+n)
    a = rng.normal(size=(n,n)); covariance = a@a.T + .5*np.eye(n)
    scale = np.sqrt(np.diag(covariance)); r = covariance/np.outer(scale,scale)
    r[np.diag_indices(n)] = 1
    # Keep a chain: chordal and feasible for all dimensions.
    matrix = [[float(r[i,j]) if i==j or abs(i-j)==1 else None for j in range(n)] for i in range(n)]
    for strategy in ("greedy", "c-vine", "d-vine"):
        add(f"{n} variables {strategy}", matrix, strategy=strategy, order=list(range(n,0,-1)))
three = [[1,.5,None],[.5,1,.5],[None,.5,1]]
for value in (.4, .2):
    add(f"three-variable partial {value}", three, method="vine", strategy="d-vine",
        partials=[dict(conditioned=[1,3], conditioning=[2], value=value)])
add("missing explicit partial", three, method="vine", strategy="d-vine")
add("infeasible principal block", [[1,.9,.9],[.9,1,-.9],[.9,-.9,1]])
add("nonchordal unsupported", [[1,.2,None,.2],[.2,1,.2,None],[None,.2,1,.2],[.2,None,.2,1]])
add("invalid asymmetric input", [[1,.2,None],[.3,1,.5],[None,.5,1]])
add("invalid partial", three, method="vine", strategy="d-vine", partials=[dict(conditioned=[1,3],conditioning=[2],value=1.2)])
(REPO / "web/browser-cases.json").write_text(json.dumps(cases, allow_nan=False), encoding="utf-8")
print(json.dumps({"cases":len(cases), "expected_success":sum(c['expected']['ok'] for c in cases)}))
