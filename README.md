# FORMA — Adaptive Accessibility Architecture Magazine - Prototype

> An intelligent, behavior-driven web magazine that automatically adapts its interface to match the reader's cognitive and visual needs in real time.

![FORMA Preview](https://picsum.photos/seed/arch_cover/1200/400)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Accessibility Modes](#accessibility-modes)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Tech Stack](#tech-stack)
- [Design Decisions](#design-decisions)
- [Future Improvements](#future-improvements)

---

## Overview

FORMA is a website prototype that demonstrates **AI-powered adaptive accessibility**. Instead of requiring users to manually find and configure accessibility settings, the interface silently observes three behavioral signals — scroll speed, click frequency, and idle time — and uses a machine learning classifier to suggest the most appropriate reading mode automatically.

The project was built as an exploration of how digital editorial interfaces can become genuinely inclusive without adding friction to the reading experience.

---

## Features

### Adaptive Intelligence
- **Automatic Mode Detection** — a K-Nearest Neighbors model running on a local Flask server classifies user behavior every 15 seconds and suggests an appropriate accessibility mode via a non-intrusive toast notification.
- **Behavioral Radar** — a real-time canvas radar chart visualizes three behavioral axes (scroll speed, click count, elapsed time) and updates with every interaction.
- **Cognitive Load Gauge** — a semicircular SVG gauge in the bottom-right corner estimates reading effort on a 0–10 scale using a weighted formula.
- **Score Decay** — scroll and click counters automatically decrease over time so past behavior does not permanently skew the classification.

### Accessibility Modes
- **Normal** — the default editorial experience.
- **Dyslexia** — enlarged spacing, wider line height, a floating reading guide that follows the cursor, and syllable-mode typography.
- **Low Vision** — maximum contrast, enlarged text, simplified decorative elements, and highlighted links.
- **Focus / Concentration** — removes decorative images, pauses animations, and adds a reading progress bar at the top of the page.

### Manual Controls
- **Slide-in Mode Panel** — a persistent tab on the left edge opens a drawer with one-click mode buttons and an AUTO/MAN detection toggle.
- **Mode Cards** — a dedicated accessibility section on the page with descriptive mode cards and live status indicators.
- **Preference Persistence** — the selected mode is saved to `localStorage` and restored on the next visit (except Focus mode, which always resets).

### Editorial UI
- **Custom Cursor** — a dot + animated ring cursor with inertia and scale-on-hover effects.
- **A/B Comparison Overlay** — a split-screen view that loads the current page in two iframes side by side: Normal vs any chosen accessibility mode.
- **Section Progress Bars** — thin underline bars on each nav link fill in real time as the user scrolls through that section.
- **Scroll-Reveal Animations** — sections and article cards fade in from below using `IntersectionObserver` with staggered delays.
- **News Ticker** — a continuously scrolling headline strip.
- **Session Log + CSV Export** — every mode change is recorded with a timestamp and trigger type (`auto` / `manual`), and can be exported as a CSV file.

### Annotation Layer
- Users can activate an annotation mode and click any paragraph, heading, or blockquote to attach a personal note or academic reference.
- Notes are saved to `localStorage` and restored on every visit, marked with a ✎ badge.

---

## How It Works

```
User behavior on the page
        │
        ▼
┌───────────────────────┐
│  JavaScript Engine    │  Tracks scroll speed, click count, and idle time
│  (script.js)          │  Updates radar, gauge, and metrics in real time
└──────────┬────────────┘
           │  POST /analyze every 15 seconds
           ▼
┌───────────────────────┐
│  Flask API            │  Receives behavior data as JSON
│  (app.py)             │  Runs KNN classifier (k=3)
└──────────┬────────────┘
           │  Returns { "suggested_mode": "dyslexia" | "focus" | "normal" }
           ▼
┌───────────────────────┐
│  Toast Notification   │  User chooses to activate or dismiss
│  (script.js)          │  Mode applies with a visual flash transition
└───────────────────────┘
```

The three behavioral signals map to modes as follows:

| Signal             | Dyslexia          | Focus              | Normal       |
|--------------------|-------------------|--------------------|--------------|
| Scroll speed       | Low               | High               | Low–medium   |
| Click count        | Low               | High               | Low–medium   |
| Idle time (s)      | Very high (70+)   | Low                | 5–30 s       |

---

## Accessibility Modes

### 01 — Dyslexia
Triggered by long idle times that suggest the user is re-reading or struggling with text flow.

- Increased letter spacing and line height
- Larger base font size
- A horizontal reading guide (semi-transparent band) that follows the cursor
- `syllable-mode` class applied for potential font injection (e.g., OpenDyslexic)

### 02 — Low Vision
Auto-activated on screens narrower than 500px; otherwise user-selectable.

- High-contrast color scheme
- Large text rendering
- All links highlighted with a yellow underline for discoverability
- Simplified decorative elements

### 03 — Focus / Concentration
Triggered by rapid scrolling and frequent clicking, suggesting the user is overloaded or skimming.

- Decorative images and sidebars hidden
- Ticker animation paused
- A thin green reading progress bar fixed at the top of the viewport
- Removes visual clutter to allow deep reading

---

## Project Structure

```
forma/
├── index.html        # Main page — full editorial layout with accessibility section
├── style.css         # All styles — base, mode variants, components, animations
├── script.js         # Accessibility engine — behavior detection, mode switching, UI logic
├── app.py            # Flask API — KNN classifier that analyzes behavior and suggests modes
└── README.md         # This file
```

---

## Getting Started

### Prerequisites

- Python 3.8+
- pip
- A modern browser (Chrome, Firefox, Safari, Edge)

### 1. Install Python dependencies

```bash
pip install flask flask-cors scikit-learn
```

### 2. Start the backend server

```bash
python app.py
```

The server will start at `http://localhost:5000`. You should see:

```
* Running on http://127.0.0.1:5000
```

### 3. Open the frontend

Open `index.html` directly in your browser, or serve it with any static file server:

```bash
# Using Python's built-in server
python -m http.server 8080
# Then visit http://localhost:8080
```

> **Note:** The frontend connects to the backend at `http://localhost:5000/analyze`. Both must be running simultaneously for automatic mode detection to work. The interface is fully functional without the backend — only auto-detection is disabled.

---

## API Reference

### `GET /`

Health check endpoint.

**Response:**
```json
{ "status": "success", "message": "Server running." }
```

---

### `POST /analyze`

Classifies user behavior and returns a suggested accessibility mode.

**Request body:**
```json
{
  "speed": 12,
  "clicks": 8,
  "idle": 5
}
```

| Field    | Type | Description                                                        |
|----------|------|--------------------------------------------------------------------|
| `speed`  | int  | Number of fast scroll events detected in the past interval (0–30)  |
| `clicks` | int  | Number of clicks outside the accessibility panel (0–60)            |
| `idle`   | int  | Seconds since the user last scrolled or clicked                    |

**Response:**
```json
{
  "status": "success",
  "suggested_mode": "focus"
}
```

Possible `suggested_mode` values: `"normal"`, `"dyslexia"`, `"focus"`

---

## Tech Stack

| Layer      | Technology                              | Purpose                                    |
|------------|-----------------------------------------|--------------------------------------------|
| Frontend   | HTML5, CSS3, Vanilla JavaScript         | Editorial layout, accessibility engine     |
| ML Backend | Python, Flask, scikit-learn             | Behavior classification (KNN, k=3)         |
| Fonts      | Google Fonts (Cormorant Garamond, Bebas Neue, Karla) | Editorial typography            |
| Images     | picsum.photos                           | Placeholder editorial imagery              |
| Storage    | Browser `localStorage`                 | Mode persistence and annotations           |

No JavaScript frameworks or build tools are required — the frontend runs entirely in vanilla JS.

---

## Design Decisions

**Why K-Nearest Neighbors?**
KNN is interpretable, requires no training time after fitting, and works well on small, well-separated clusters. The three behavioral profiles (normal, dyslexia, focus) are distinct enough in the feature space that KNN with k=3 achieves reliable classification without overfitting.

**Why not apply modes automatically?**
Immediately switching the interface without consent is disruptive and potentially disorienting. The toast suggestion pattern respects user agency — the system *offers*, the user *decides*. A 20-second cooldown after each suggestion prevents notification fatigue.

**Why is idle time the key differentiator for dyslexia?**
Scroll speed and click count alone cannot distinguish a slow reader from an inattentive one. True idle time — the time since the last interaction, not the total session time — is a much stronger signal for re-reading behavior.

**Why does Focus mode not persist across reloads?**
Focus mode is context-dependent (the user wants minimal distractions *now*, not always). Restoring it on reload could feel like an unwanted imposition on a fresh visit.

---

## Future Improvements

- [ ] **Richer training data** — collect real user sessions to replace the hand-crafted training samples with statistically grounded clusters.
- [ ] **Low Vision auto-detection** — add font scaling detection (e.g., browser zoom level > 125%) as a trigger.
- [ ] **Backend model persistence** — save and reload the trained model with `joblib` instead of re-fitting on every server start.
- [ ] **OpenDyslexic font injection** — automatically load and apply the OpenDyslexic font in Dyslexia mode.
- [ ] **Keyboard shortcut support** — allow users to switch modes without using the mouse (e.g., `Alt+1` through `Alt+4`).
- [ ] **ARIA live regions** — announce mode changes to screen readers via `aria-live` attributes.
- [ ] **Multi-language support** — make the UI language configurable (currently French).
- [ ] **Annotation sync** — replace `localStorage` annotations with a server-side store so notes persist across devices.

---

## License

This project is a design and research prototype. Content (article text, author names, editorial copy) is fictional and for demonstration purposes only. Images are sourced from [picsum.photos](https://picsum.photos) and are subject to their respective licenses.

---

*FORMA — Revue d'Architecture et de Design Urbain · Mai 2026*
