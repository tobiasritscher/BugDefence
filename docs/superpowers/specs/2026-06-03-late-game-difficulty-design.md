# Design: Late-game difficulty pass

**Datum:** 2026-06-03 · **Status:** Genehmigt

## Ziel
Spiel ist auch im finalen RELEASE trivial (100% Uptime, Brett vollgestellt). Late-Game (ab ~Sprint 6) soll **deutlich fordernd** werden; frühe Sprints (≤5) bleiben unverändert als Lernkurve. Erster Tuning-Pass, danach Playtest + Nachjustieren.

## Änderungen (3 Hebel, alle ≤ Sprint 5 unverändert)

1. **Steilerer HP-Ramp spät** — `js/engine.js` `hpMult()`. Späten Surge `late²·0.040` mit `late = Math.max(0, S.sprint − 5)` anhängen:
   `DIFFICULTY * (1 + S.sprint*0.014 + S.sprint*S.sprint*0.016 + late*late*0.040)`
   Finale: ×3.09 → ~×4.5.

2. **Mehr Bugs spät** — `js/config.js` `waveCountMult(idx)`: Faktor `0.08` → `0.12`.
   `1 + Math.max(0, idx - 5) * 0.12` · Finale ×1.48 → ×1.72.

3. **Tankigere Bosse spät** — `js/engine.js` `spawnEnemy`, Boss-Zweig: Sprint-Faktor `0.04` → `0.06`.
   `def.hp * (def.boss ? (1 + (DIFFICULTY - 1) + S.sprint * 0.06) : m)`.

## Bewusst nicht geändert
Start-Commits, Rewards, Sprint-Boni, Gegner-Speed. Höhere Bug-Masse erzeugt Leaks von selbst. Ökonomie-Trim ist optionaler 2.-Runde-Hebel.

## Verifikation
`node --check` auf beide Dateien. Inhaltlich: manueller Playtest des finalen Sprints — Finale muss bei suboptimalem Spiel Uptime kosten, bei gutem Spiel knapp gewinnbar bleiben. Zahlen sind zum Nachjustieren gedacht.
