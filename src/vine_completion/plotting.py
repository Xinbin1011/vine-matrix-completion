"""Optional plotting; importing the numerical package never opens a window."""

from pathlib import Path

import networkx as nx

from .partials import edge_key


def plot_vine(vine, path):
    import matplotlib.pyplot as plt

    count = len(vine.trees)
    fig, axes = plt.subplots(count, 1, figsize=(10, 4 * count), squeeze=False)
    for level, tree in enumerate(vine.trees, 1):
        ax = axes[level - 1, 0]
        pos = nx.spring_layout(tree, seed=7, weight=None)
        labels = {node: ",".join(map(str, sorted(data["variables"]))) for node, data in tree.nodes(data=True)}
        nx.draw(tree, pos, ax=ax, labels=labels, with_labels=True,
                node_color="lightblue", node_size=1100, font_size=9)
        edges = {}
        for u, v, data in tree.edges(data=True):
            text = edge_key(data["conditioned"], data["conditioning"])
            if "weight" in data:
                text += f" = {data['weight']:.4f}"
            edges[(u, v)] = text
        nx.draw_networkx_edge_labels(tree, pos, ax=ax, edge_labels=edges, font_size=8)
        ax.set_title(f"Tree {level}: partial correlations (dot notation)")
    fig.tight_layout()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=150)
    plt.close(fig)
