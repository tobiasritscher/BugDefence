# Design: Audio (Musik & Soundeffekte) für Bug Defence

**Datum:** 2026-06-03
**Status:** Genehmigt (Brainstorming abgeschlossen)

## Ziel

Dem Tower-Defence-Spiel **Bug Defence** Hintergrundmusik und Soundeffekte
hinzufügen — passend zum Hacker-/Terminal-Stil, ohne den Zero-Build-Charakter
(eine HTML, kein Bundler, statisches Deployment auf Cloudflare Pages) zu brechen.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| SFX | Prozedural per Web Audio API synthetisiert — keine SFX-Dateien |
| Musik | 3 vom Nutzer gelieferte MP3s in `music/`, **Shuffle-Loop** |
| Fallback | Fehlt/lädt die Musik nicht, läuft das Spiel still weiter (kein Fehler) |
| Steuerung | Fester Button **oben rechts auf allen Screens**: Mute-Toggle + 2 Slider (Musik / SFX) |
| Persistenz | `muted`, `musicVol`, `sfxVol` in `localStorage` |
| UI-Klick | Dezenter Tick-Sound auf UI-Buttons |
| Autoplay | Audio startet erst bei erster Nutzer-Interaktion (Browser-Policy) |

## Architektur

Neues, in sich geschlossenes Modul **`js/audio.js`** (globales `AUDIO`), analog
zu den bestehenden Modulen (`GAME`, `UI`, `ART`, `RENDER`, `TWEAKS`). Es kapselt
den gesamten Audio-Zustand und kennt die Spiellogik nur über deren Events.

```
AudioContext
  master (GainNode)
    ├─ musicGain (GainNode) ← <audio loop> via MediaElementAudioSourceNode
    └─ sfxGain   (GainNode) ← kurzlebige Oszillator-/Noise-Voices
```

### Öffentliche API (`AUDIO`)
- `init()` — beim Boot aus `main.js`; baut Graph, lädt `localStorage`, registriert
  Event-Abos und den Erste-Interaktion-Unlock; injiziert den Steuer-Button.
- `play(name, opts?)` — spielt einen synthetisierten SFX (mit Voice-Limiting).
- `unlock()` — resumed den `AudioContext` und startet die Musik (idempotent).
- `setMuted(bool)` / `setMusicVol(0..1)` / `setSfxVol(0..1)` — Steuerung + Persistenz.

### Musik-Wiedergabe
- Ein `<audio>`-Element, geroutet über `MediaElementAudioSourceNode → musicGain`.
- Beim ersten Unlock wird die Track-Reihenfolge der 3 Dateien zufällig gemischt
  (Fisher-Yates). `ended`-Event → nächster Track; nach dem letzten zurück zum
  ersten (Endlos-Loop über die gemischte Liste).
- Dateipfade werden **URL-kodiert** referenziert (Leerzeichen/Umlaute), kein
  Umbenennen nötig. Tracks (relativ zum Repo-Root):
  - `music/Hacker-Tower-Defense-Hintergrundmusik.mp3`
  - `music/Hacker-Tower-Defense-Hintergrundmusik-2.mp3`
  - `music/Musik für Hacker-Tower-Defense.mp3`
- Fehler (`error`-Event / 404) werden abgefangen: betroffener Track wird
  übersprungen; schlägt alles fehl, bleibt es still — Gameplay/SFX unberührt.

### SFX-Synthese
Zwei kleine Helfer bilden alle Sounds:
- `tone(freq, dur, {type, attack, decay, vol, slideTo})` — Oszillator + Gain-Hüllkurve, optionaler Pitch-Slide.
- `noise(dur, {vol, filterFreq})` — kurzer Rauschimpuls (gefiltert) für Treffer/Explosionen.

Sounds sind kleine Kompositionen daraus. **Voice-Limiting:** Obergrenze
gleichzeitiger SFX-Voices (z. B. 12) **und** Mindestabstand pro Sound-Typ
(z. B. ~40 ms bei Schuss-Sounds), damit viele feuernde Türme nicht in eine
MG-Salve ausarten.

## Engine-Anbindung (`js/engine.js`)

Das vorhandene `emit`/`on`-System speichert aktuell nur **einen** Callback pro
Event (`cb[name] = fn`). Da `UI` bereits `onSprintComplete`/`onGameOver`/`hit`
abonniert und `AUDIO` dieselben Events braucht, wird `on`/`emit` auf **mehrere
Listener** umgestellt (Array statt Einzelwert) — kleine, abwärtskompatible Änderung.

Neue/genutzte Engine-Events (Engine kennt `AUDIO` **nicht**; `AUDIO` abonniert selbst):

| Event | Auslöser im Code | Sound |
|---|---|---|
| `fire` (arg: kind) | `fireTowers` — Projektil/Melee/gc/burn | typabhängiger Blip/Zap (gedrosselt) |
| `kill` (arg: enemy) | `kill(e)` | Pop; Boss größer |
| `shield` | `damage` bei Schildbruch | metallisches Ting |
| `place` | `place()` | Bestätigungs-Chunk |
| `upgrade` | `upgrade()` | aufsteigende Phrase |
| `sell` | `sell()` | absteigende Phrase |
| `cast` (arg: name) | `cast()` | spell-spezifisch (eisig/Explosion/blubbernd) |
| `sprintStart` | `runSprint()` | Alert |
| `hit` *(existiert)* | Leak in `moveEnemies` | Uptime-Warnton |
| `onSprintComplete` *(existiert)* | Sprint geräumt | 3-Ton-Jingle |
| `onGameOver` (arg: win) *(existiert)* | Sieg/Niederlage | Triumph- / Fail-Phrase |

## UI / Steuerung

`AUDIO` injiziert seinen **eigenen** Steuer-Button (keine Änderungen an `ui.js`
nötig): fixiert oben rechts (`position: fixed`), auf allen Screens sichtbar, im
Look der bestehenden `.ic-btn`. Klick öffnet ein kompaktes Popover mit
🔊/🔇-Mute-Toggle und zwei Range-Slidern (Musik / SFX). Styles dafür kommen in
`css/style.css` im vorhandenen Stil (CSS-Variablen, Farben).

UI-Klick-Sound: ein delegierter, gedrosselter `click`-Listener auf `button`-Elemente
spielt einen leisen Tick (innerhalb `audio.js`, damit `ui.js` unberührt bleibt).

## Erste-Interaktion-Unlock

Ein einmaliger globaler `pointerdown`/`keydown`-Listener ruft `AUDIO.unlock()`
(AudioContext resume + Musik-Shuffle-Start) und entfernt sich danach. Der erste
Menü-Klick („Defend production") erfüllt das automatisch.

## Betroffene Dateien

- **Neu:** `js/audio.js`
- **Geändert:** `Bug Defence.html` (Script-Tag für `audio.js` nach `ui.js`, vor `main.js`)
- **Geändert:** `js/engine.js` (Multi-Listener `on`/`emit` + ~8 `emit`-Aufrufe)
- **Geändert:** `js/main.js` (`AUDIO.init()` im `DOMContentLoaded`)
- **Geändert:** `css/style.css` (Button + Popover)
- **Geändert:** `README.md` (Hinweis auf `music/` & wie Tracks getauscht werden)
- **Vorhanden:** `music/*.mp3` (3 Tracks, bereits abgelegt)

## Test / Verifikation

Manuell im Browser (Spiel ist input-/canvas-getrieben, kein Test-Harness vorhanden):
1. Menü laden → erster Klick startet Musik (ein zufälliger Track).
2. Türme feuern → Schuss-SFX, keine MG-Salve bei vielen Türmen.
3. Kill / Schildbruch / Spells / Platzieren / Upgrade / Verkauf / Leak → je eigener Sound.
4. Sprint-Ende-Jingle, Sieg-/Niederlage-Sting.
5. Mute schaltet alles stumm; Slider regeln Musik & SFX getrennt; Werte überleben Reload (`localStorage`).
6. `music/` temporär leeren/umbenennen → Spiel läuft still ohne Fehler in der Konsole.

## Nicht im Scope (YAGNI)

- Track-Anzeige/Skip-Button, Crossfades zwischen Tracks.
- Audio-Sprites/Dateien für SFX.
- Räumliches/Panning-Audio, Ducking der Musik bei lauten SFX.
