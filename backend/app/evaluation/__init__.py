"""
Module d'évaluation de la qualité des composants IA de FairHire.

Contient :
- metrics.py      : métriques routées par champ (fuzzy, token F1, bipartite matching…)
- evaluator.py    : orchestrateur de benchmark (parse → score → agrège)
- service.py      : interface FastAPI-friendly, exécution async en thread
- datasets/       : jeux de données annotés manuellement pour les benchmarks
"""
