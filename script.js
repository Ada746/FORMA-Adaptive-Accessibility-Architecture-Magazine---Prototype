/* ══════════════════════════════════════════════════════════════════
   script.js — FORMA Adaptive Accessibility Engine
   ══════════════════════════════════════════════════════════════════
   TABLE OF CONTENTS:
     1.  Global State
     2.  Custom Cursor
     3.  Mode Configuration
     4.  setMode / safeSetMode
     5.  updateUI
     6.  applyModeExtras + helpers (reading guide, font widget, etc.)
     7.  updateMetrics
     8.  Behavior Detectors (scroll, click, idle time)
     9.  Manual Panel (slide drawer)
     10. Dwell Heat Map (right-side minimap)
     11. Section Progress Bar in nav
     12. Behavioral Radar (canvas)
     13. Cognitive Load Gauge
     14. Session Log + CSV Export
     15. A/B Comparison Overlay
     16. Annotation Layer
     17. Scroll-Reveal (IntersectionObserver)
     18. Hamburger Menu (mobile)
     19. init() + Global Exposure
   ══════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════════
   1. GLOBAL STATE
   Variables shared across the entire accessibility engine.
   ══════════════════════════════════════════════════════════════════ */

let currentMode = "normal";
let fastScrollCount = 0;
let clickCount = 0;           // Clicks outside the accessibility section
let startTime = Date.now();   // Session start timestamp (ms)
let autoDetectEnabled = true;       // Whether automatic behavior detection is active
let modeChangeCooldown = false;     // Prevents mode changes from firing too rapidly
let lastScrollY = 0;          // Last recorded vertical scroll position
let lastScrollTime = Date.now();    // Timestamp of the last scroll event
let _currentTrigger = null;         // "auto" | "manual" — used in the session log


/* ══════════════════════════════════════════════════════════════════
   2. CUSTOM CURSOR
   Replaces the native browser cursor with a dot + animated follower ring.
   ══════════════════════════════════════════════════════════════════ */

const cursorDot = document.getElementById("cursor");
const cursorFollower = document.getElementById("cursorFollower");

let mouseX = -200, mouseY = -200;       // Current mouse position (off-screen by default)
let followerX = -200, followerY = -200; // Follower ring position (lags behind)

/* Move the small dot instantly on every mousemove */
document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (cursorDot) {
    cursorDot.style.left = e.clientX + "px";
    cursorDot.style.top = e.clientY + "px";
    cursorDot.classList.add("is-visible");
  }
  if (cursorFollower) {
    cursorFollower.classList.add("is-visible");
  }
});

/* Animate the follower ring with inertia using requestAnimationFrame */
(function animateFollower() {
  followerX += (mouseX - followerX) * 0.13;  // Lerp factor: 0.13 = smooth but responsive
  followerY += (mouseY - followerY) * 0.13;
  if (cursorFollower) {
    cursorFollower.style.left = followerX + "px";
    cursorFollower.style.top = followerY + "px";
  }
  requestAnimationFrame(animateFollower);
})();

/* Scale up cursor ring when hovering over interactive elements */
document.querySelectorAll("a, button, .art-card, .interview-card, .access-mode-card, .gal-item").forEach(el => {
  el.addEventListener("mouseenter", () => document.body.classList.add("cursor-hover"));
  el.addEventListener("mouseleave", () => document.body.classList.remove("cursor-hover"));
});


/* ══════════════════════════════════════════════════════════════════
   3. MODE CONFIGURATION
   Defines the UI properties for each accessibility mode.
   Each mode has a label, LED indicator class, FAB class, and status message.
   ══════════════════════════════════════════════════════════════════ */

const modeConfig = {
  normal: {
    label: "Normal",
    ledClass: "",
    fabClass: "",
    statusMsg: "Interface standard FORMA."
  },
  dyslexia: {
    label: "Dyslexie",
    ledClass: "led-dyslexia",
    fabClass: "fab-dyslexia",
    statusMsg: "Espacement élargi, lecture facilitée."
  },
  "low-vision": {
    label: "Basse Vision",
    ledClass: "led-low-vision",
    fabClass: "fab-low-vision",
    statusMsg: "Contraste maximal, grand texte."
  },
  focus: {
    label: "Concentration",
    ledClass: "led-focus",
    fabClass: "fab-focus",
    statusMsg: "Les distractions ont disparu. Lecture épurée."
  }
};


/* ══════════════════════════════════════════════════════════════════
   4. setMode / safeSetMode
   Core mode-switching logic.
   ══════════════════════════════════════════════════════════════════ */

function setMode(mode) {
  if (currentMode === mode) return; // Already in this mode — do nothing

  const prevMode = currentMode;

  /* Brief white flash effect on mode transition */
  document.body.classList.add("mode-flash");
  setTimeout(() => document.body.classList.remove("mode-flash"), 400);

  /* Swap the mode class on <body> so CSS can apply the right styles */
  document.body.classList.remove("mode-normal", "mode-dyslexia", "mode-low-vision", "mode-focus");
  document.body.classList.add("mode-" + mode);
  currentMode = mode;

  /* Persist the user's preference in localStorage (focus mode is not persisted — resets on reload) */
  try {
    if (mode === "focus") localStorage.removeItem("formaMode");
    else localStorage.setItem("formaMode", mode);
  } catch (e) { }

  /* 3-second anti-spam cooldown to prevent rapid consecutive mode changes */
  modeChangeCooldown = true;
  setTimeout(() => { modeChangeCooldown = false; }, 3000);

  updateUI(mode);
  applyModeExtras(mode);

  /* Log the mode change to the session journal */
  if (prevMode !== mode) {
    logEvent(mode, _currentTrigger || "manual");
    _currentTrigger = null;
  }
}

/**
 * Safe wrapper for setMode — used by the auto-detection engine.
 * Respects the cooldown and the user's auto-detect toggle preference.
 */
function safeSetMode(mode) {
  if (currentMode === mode) return;
  if (modeChangeCooldown) return;    // Still in cooldown from a previous switch
  if (!autoDetectEnabled) return;    // User disabled auto-detection
  _currentTrigger = "auto";
  setMode(mode);
}


/* ══════════════════════════════════════════════════════════════════
   5. updateUI
   Syncs all visual UI elements to reflect the currently active mode.
   Called every time the mode changes (both manual and automatic).
   ══════════════════════════════════════════════════════════════════ */

function updateUI(mode) {
  const cfg = modeConfig[mode] || modeConfig.normal;

  /* Accessibility mode cards — highlight the active one */
  document.querySelectorAll(".access-mode-card").forEach(card => {
    card.classList.toggle("is-active", card.id === "card-" + mode);
  });

  /* LED status indicator */
  const led = document.getElementById("statusLed");
  if (led) led.className = "status-led " + cfg.ledClass;

  /* Current mode label text */
  const modeLabel = document.getElementById("currentModeLabel");
  if (modeLabel) modeLabel.textContent = cfg.label;

  /* Status description message */
  const statusMsg = document.getElementById("statusMessage");
  if (statusMsg) statusMsg.textContent = cfg.statusMsg;

  /* FAB (Floating Action Button) — updates its color class and label */
  const fab = document.getElementById("fabAccess");
  if (fab) {
    fab.className = "fab-access " + cfg.fabClass;
    const fabLbl = document.getElementById("fabLabel");
    if (fabLbl) fabLbl.textContent = cfg.label;
  }

  /* Auto-detect badge — shows whether automatic detection is on or off */
  const badge = document.getElementById("autoDetectLabel");
  if (badge) {
    badge.innerHTML = autoDetectEnabled
      ? 'Détection automatique <strong>active</strong>'
      : 'Détection automatique <strong style="color:#ff6b6b">désactivée</strong>';
  }

  /* Manual panel buttons — highlight the active mode button */
  document.querySelectorAll(".manual-mode-btn").forEach(btn => {
    btn.classList.toggle("mmb-active", btn.dataset.mode === mode);
  });
}


/* ══════════════════════════════════════════════════════════════════
   6. MODE EXTRAS (applyModeExtras + helpers)
   Each mode activates/deactivates additional visual and behavioral features
   beyond simple CSS class swaps — e.g., injected DOM elements and listeners.
   ══════════════════════════════════════════════════════════════════ */

/* References to dynamically created elements */
let readingGuideEl = null;
let fontSizeWidget = null;
let progressBar = null;
let motionStyle = null;
let currentFontScale = 1;

function applyModeExtras(mode) {
  /* Clean up everything added by the previous mode before applying the new one */
  document.body.classList.remove("extra-dyslexia", "extra-low-vision", "extra-focus");
  removeReadingGuide();
  removeHighlightLinks();
  removeMotionPause();
  removeReadingProgress();
  document.body.classList.remove("syllable-mode");

  if (mode === "dyslexia") {
    addReadingGuide();   // Horizontal line that follows the cursor to help track reading position
    document.body.classList.add("syllable-mode", "extra-dyslexia");
  }

  if (mode === "low-vision") {
    addHighlightLinks(); // Visually underline all links in yellow for better discoverability
    document.body.classList.add("extra-low-vision");
  }

  if (mode === "focus") {
    addMotionPause();    // Pause non-essential CSS animations (e.g., ticker tape)
    addReadingProgress();// Add a thin reading progress bar fixed at the top of the viewport
    document.body.classList.add("extra-focus");
  }
}

/* ── Reading Guide (Dyslexia mode) ──────────────────────────────
   A semi-transparent horizontal band that follows the mouse vertically,
   helping users with dyslexia track which line they are reading. */
function addReadingGuide() {
  if (readingGuideEl) return; // Already active
  readingGuideEl = document.createElement("div");
  readingGuideEl.id = "readingGuide";
  readingGuideEl.style.cssText =
    "position:fixed;left:0;right:0;height:28px;" +
    "background:rgba(160,80,10,0.09);" +
    "border-top:1px solid rgba(160,80,10,0.3);" +
    "border-bottom:1px solid rgba(160,80,10,0.3);" +
    "pointer-events:none;z-index:8000;top:-100px;"; // Start off-screen until first mouse move
  document.body.appendChild(readingGuideEl);
  document.addEventListener("mousemove", _moveReadingGuide);
}
function _moveReadingGuide(e) {
  /* Center the guide band on the cursor's Y position */
  if (readingGuideEl) readingGuideEl.style.top = (e.clientY - 14) + "px";
}
function removeReadingGuide() {
  if (readingGuideEl) { readingGuideEl.remove(); readingGuideEl = null; }
  document.removeEventListener("mousemove", _moveReadingGuide);
}

/* ── Link Highlight (Low Vision mode) ───────────────────────────
   Adds a high-contrast visual marker to all anchor elements. */
function addHighlightLinks() {
  document.querySelectorAll("a").forEach(a => a.classList.add("lv-link-highlight"));
}
function removeHighlightLinks() {
  document.querySelectorAll(".lv-link-highlight").forEach(a => a.classList.remove("lv-link-highlight"));
}

/* ── Motion Pause (Focus mode) ──────────────────────────────────
   Injects a <style> tag that pauses the ticker animation and removes
   image transitions — reducing visual noise for distraction-free reading. */
function addMotionPause() {
  if (document.getElementById("motionPause")) return;
  motionStyle = document.createElement("style");
  motionStyle.id = "motionPause";
  motionStyle.textContent =
    "body.extra-focus .ticker-track{animation-play-state:paused!important;}" +
    "body.extra-focus img{transition:none!important;}";
  document.head.appendChild(motionStyle);
}
function removeMotionPause() {
  const s = document.getElementById("motionPause");
  if (s) s.remove();
  motionStyle = null;
}

/* ── Reading Progress Bar (Focus mode) ──────────────────────────
   A thin fixed bar at the top of the page that fills as the user scrolls,
   giving a visual sense of reading progress through the full document. */
function addReadingProgress() {
  if (document.getElementById("readingProgress")) return;
  progressBar = document.createElement("div");
  progressBar.id = "readingProgress";
  progressBar.style.cssText =
    "position:fixed;top:0;left:0;height:3px;" +
    "background:#2a6049;z-index:9999;width:0%;transition:width 0.15s;";
  document.body.appendChild(progressBar);
  window.addEventListener("scroll", _updateReadingProgress, { passive: true });
}
function _updateReadingProgress() {
  const bar = document.getElementById("readingProgress");
  if (!bar) return;
  const docH = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.width = docH > 0 ? (window.scrollY / docH * 100) + "%" : "0%";
}
function removeReadingProgress() {
  const bar = document.getElementById("readingProgress");
  if (bar) bar.remove();
  progressBar = null;
  window.removeEventListener("scroll", _updateReadingProgress);
}


/* ══════════════════════════════════════════════════════════════════
   7. updateMetrics
   Updates the numeric values and progress bar widths inside the status bar.
   Called periodically and on each click/scroll event.
   ══════════════════════════════════════════════════════════════════ */

function updateMetrics() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000); // Total session time in seconds

  /* Shorthand helpers */
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setW = (id, p) => { const el = document.getElementById(id); if (el) el.style.width = Math.min(p, 100) + "%"; };

  /* Update displayed values */
  set("valScroll", fastScrollCount);
  set("valClicks", clickCount);
  set("valTime", elapsed + "s");

  /* Update bar widths (normalized to max expected values for each metric) */
  setW("metricScroll", fastScrollCount / 18 * 100);   // Max: 18 fast scrolls
  setW("metricClicks", clickCount / 50 * 100);         // Max: 50 clicks
  setW("metricTime", elapsed / 180 * 100);              // Max: 180 seconds (3 minutes)

  /* Also update the session journal footer */
  const dur = document.getElementById("slDuration");
  if (dur) dur.textContent = elapsed + "s de session";
}


/* ══════════════════════════════════════════════════════════════════
   8. BEHAVIOR DETECTORS
   Three signals are tracked in real time:
     - fastScrollCount: rapid, high-distance scroll events
     - clickCount:      clicks outside the accessibility panel
     - trueIdleTime:    seconds since the user last interacted with the page
   These are sent to the Python backend every 15 seconds for classification.
   ══════════════════════════════════════════════════════════════════ */

let lastInteractionTime = Date.now(); // Tracks true idle time (reset on any interaction)

/* ── Fast scroll detector ────────────────────────────────────────
   Increments the fast scroll counter when the user scrolls quickly.
   Threshold: movement of >80px within a 120ms window. */
window.addEventListener("scroll", () => {
  const now = Date.now();
  const delta = now - lastScrollTime;          // Time since last scroll event
  const dist = Math.abs(window.scrollY - lastScrollY); // Distance scrolled

  if (delta < 120 && dist > 80) {
    fastScrollCount = Math.min(fastScrollCount + 1, 30); // Cap at 30
    drawRadar(fastScrollCount, clickCount, Math.floor((Date.now() - startTime) / 1000));
    updateCogLoad();
  }

  lastScrollTime = now;
  lastScrollY = window.scrollY;
  lastInteractionTime = now; // Reset idle timer on scroll

  /* Add a subtle drop shadow to the header when the user has scrolled down */
  const header = document.getElementById("header");
  if (header) header.style.boxShadow = window.scrollY > 50 ? "0 2px 20px rgba(0,0,0,0.08)" : "";

  updateSectionProgress();
}, { passive: true });


/* ── Click detector ──────────────────────────────────────────────
   Counts clicks outside the accessibility panel.
   Rapid clicking is a signal of user frustration or cognitive overload. */
document.addEventListener("click", (e) => {
  if (e.target.closest(".access-section") || e.target.closest("#manualModePanel")) return;

  clickCount = Math.min(clickCount + 1, 60); // Cap at 60
  drawRadar(fastScrollCount, clickCount, Math.floor((Date.now() - startTime) / 1000));
  updateCogLoad();
  updateMetrics();

  lastInteractionTime = Date.now(); // Reset idle timer on click
});


/* ── Score Decay ─────────────────────────────────────────────────
   Gradually reduces scroll and click counts over time.
   This ensures that old behavior doesn't permanently skew the classification.
   Decay rate: -1 per 3 seconds. */
setInterval(() => {
    if (fastScrollCount > 0) fastScrollCount--;
    if (clickCount > 0) clickCount--;
    updateMetrics();
}, 3000);


/* ── Behavior Polling + Backend Communication ────────────────────
   Every 15 seconds, the current behavior metrics are sent to the Python
   Flask backend (/analyze). The backend responds with a suggested mode,
   which may trigger a non-intrusive suggestion toast to the user. */
setInterval(() => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  /* True idle time = seconds since the user last interacted (scroll or click) */
  const trueIdleTime = Math.floor((Date.now() - lastInteractionTime) / 1000);

  updateMetrics();
  drawRadar(fastScrollCount, clickCount, elapsed);
  updateCogLoad();

  const behaviorData = {
      speed: fastScrollCount,
      clicks: clickCount,
      idle: trueIdleTime  // Sent to the backend as the key differentiator for dyslexia detection
  };

  if (autoDetectEnabled && !modeChangeCooldown) {
      fetch('http://localhost:5000/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(behaviorData)
      })
      .then(response => response.json())
      .then(data => {
          /* Only suggest if the mode is non-normal AND different from the current mode */
          if (data.suggested_mode && data.suggested_mode !== "normal" && data.suggested_mode !== currentMode) {
              suggestMode(data.suggested_mode); // Show a non-blocking toast suggestion

              /* 20-second cooldown after a suggestion to prevent toast spam */
              modeChangeCooldown = true;
              setTimeout(() => { modeChangeCooldown = false; }, 20000);

              /* Reset counters so the same behavior doesn't trigger another immediate suggestion */
              fastScrollCount = 0;
              clickCount = 0;
          }
      })
      .catch(error => { console.error("API Error:", error); });
  }
}, 15000); // Poll every 15 seconds


/* ══════════════════════════════════════════════════════════════════
   9. MANUAL PANEL (slide drawer)
   A slide-in panel on the left edge allowing users to manually
   switch modes and toggle auto-detection on/off.
   Built dynamically via JavaScript so it doesn't clutter the HTML.
   ══════════════════════════════════════════════════════════════════ */

function buildManualPanel() {
  /* ── Tab trigger on the left edge of the screen ── */
  const tab = document.createElement("button");
  tab.id = "mmpTab";
  tab.setAttribute("aria-label", "Ouvrir le panneau des modes");
  tab.innerHTML = `<span class="mmp-tab-icon">&#9776;</span><span class="mmp-tab-label">MODE</span>`;
  document.body.appendChild(tab);

  /* ── Slide drawer panel ── */
  const panel = document.createElement("div");
  panel.id = "manualModePanel";
  panel.setAttribute("aria-hidden", "true"); // Hidden by default for screen readers
  panel.innerHTML = `
    <div class="mmp-header">
      <span class="mmp-title">MODE MANUEL</span>
      <div class="mmp-auto-toggle" id="mmpAutoToggle" title="Basculer la détection automatique">
        <span id="mmpAutoLabel">AUTO</span>
        <div class="mmp-toggle-track" id="mmpTrack">
          <div class="mmp-toggle-thumb"></div>
        </div>
      </div>
    </div>
    <div class="mmp-buttons">
      <button class="manual-mode-btn mmb-active" data-mode="normal">
        <span class="mmb-icon">◎</span><span>Normal</span>
      </button>
      <button class="manual-mode-btn" data-mode="dyslexia">
        <span class="mmb-icon">≡</span><span>Dyslexie</span>
      </button>
      <button class="manual-mode-btn" data-mode="low-vision">
        <span class="mmb-icon">◉</span><span>Vision</span>
      </button>
      <button class="manual-mode-btn" data-mode="focus">
        <span class="mmb-icon">⊕</span><span>Focus</span>
      </button>
    </div>
    <button class="mmp-close" id="mmpClose" aria-label="Fermer le panneau">✕</button>
  `;
  document.body.appendChild(panel);

  /* Open/close helper functions */
  function openPanel() {
    panel.classList.add("mmp-open");
    panel.setAttribute("aria-hidden", "false");
    tab.classList.add("mmp-tab-hidden");
    document.body.classList.add("panel-open");
  }
  function closePanel() {
    panel.classList.remove("mmp-open");
    panel.setAttribute("aria-hidden", "true");
    tab.classList.remove("mmp-tab-hidden");
    document.body.classList.remove("panel-open");
  }

  /* Open on tab click */
  tab.addEventListener("click", openPanel);

  /* Close on ✕ button inside the panel */
  document.getElementById("mmpClose").addEventListener("click", closePanel);

  /* Close when clicking outside the panel (click-away to dismiss) */
  document.addEventListener("click", (e) => {
    if (
      panel.classList.contains("mmp-open") &&
      !panel.contains(e.target) &&
      e.target !== tab &&
      !tab.contains(e.target)
    ) {
      closePanel();
    }
  });

  /* Mode buttons — set a 5-second cooldown after manual selection */
  panel.querySelectorAll(".manual-mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      _currentTrigger = "manual";
      modeChangeCooldown = true; // 5-second cooldown after a manual selection
      setTimeout(() => { modeChangeCooldown = false; }, 5000);
      setMode(btn.dataset.mode);
    });
  });

  /* AUTO / MAN toggle switch — enables or disables behavior-based auto-detection */
  document.getElementById("mmpAutoToggle").addEventListener("click", () => {
    autoDetectEnabled = !autoDetectEnabled;
    const track = document.getElementById("mmpTrack");
    const lbl = document.getElementById("mmpAutoLabel");
    if (track) track.classList.toggle("track-off", !autoDetectEnabled);
    if (lbl) lbl.textContent = autoDetectEnabled ? "AUTO" : "MAN";
    updateUI(currentMode);
  });
}

/**
 * Helper exposed globally for onclick attributes in the HTML.
 * Sets a mode with "manual" trigger and a 5-second cooldown.
 */
function manualSetMode(mode) {
  _currentTrigger = "manual";
  modeChangeCooldown = true;
  setTimeout(() => { modeChangeCooldown = false; }, 5000);
  setMode(mode);
}


  /* Viewport thumb position for the minimap */
  const docH = document.documentElement.scrollHeight;
  const winH = window.innerHeight;
  const mapH = 200;
  const thumb = document.getElementById("dhThumb");
  if (thumb) {
    const thumbH = Math.max(10, (winH / docH) * mapH); // Thumb height proportional to viewport/document ratio
    const thumbT = (window.scrollY / docH) * mapH;     // Thumb position proportional to scroll position
    thumb.style.height = thumbH + "px";
    thumb.style.top = thumbT + "px";
  }


/* ══════════════════════════════════════════════════════════════════
   11. SECTION PROGRESS BARS (in the navigation header)
   Each nav link has a thin underline bar that fills as the user
   scrolls through the corresponding section.
   ══════════════════════════════════════════════════════════════════ */

const sectionProgressMap = {
  featured:   document.getElementById("np-featured"),
  gallery:    document.getElementById("np-gallery"),
  interviews: document.getElementById("np-interviews"),
  opinion:    document.getElementById("np-opinion"),
};

function updateSectionProgress() {
  Object.keys(sectionProgressMap).forEach(id => {
    const bar = sectionProgressMap[id];
    const sec = document.getElementById(id);
    if (!bar || !sec) return;
    const rect = sec.getBoundingClientRect();
    const winH = window.innerHeight;
    if (rect.bottom < 0) { bar.style.width = "100%"; return; } // Section fully scrolled past
    if (rect.top > winH) { bar.style.width = "0%"; return; }   // Section not yet reached
    /* Calculate how much of the section has entered and passed through the viewport */
    const pct = Math.max(0, Math.min(1, (winH - rect.top) / (rect.height + winH)));
    bar.style.width = Math.round(pct * 100) + "%";
  });
}


/* ══════════════════════════════════════════════════════════════════
   12. BEHAVIORAL RADAR (canvas)
   Draws a triangular polygon on 3 axes: Scroll / Clicks / Time.
   The shape and color change based on the detected behavioral profile.
   ══════════════════════════════════════════════════════════════════ */

const radarProfiles = [
  { name: "Comportement neutre", color: "#c8321a" }, // No clear pattern
  { name: "Lecteur lent / attentif", color: "#60a5fa" }, // Long idle time, low scroll
  { name: "Lecteur rapide / actif", color: "#7cde9a" }, // High scroll or click activity
  { name: "Session courte", color: "#facc15" }, // Very short session with some activity
];

function drawRadar(scrollVal, clickVal, timeVal) {
  const canvas = document.getElementById("radarCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 28; // Radar circle radius with padding

  ctx.clearRect(0, 0, W, H);

  /* Normalize all three values to 0–1 range */
  const s = Math.min(scrollVal / 18, 1);   // Scroll: max 18 fast scroll events
  const c = Math.min(clickVal / 50, 1);    // Clicks: max 50 clicks
  const t = Math.min(timeVal / 180, 1);    // Time: max 180 seconds

  /* Draw concentric grid rings at 25%, 50%, 75%, and 100% */
  [0.25, 0.5, 0.75, 1].forEach(ring => {
    ctx.beginPath();
    ctx.arc(cx, cy, R * ring, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  /* Draw 3 axis lines at 0°, 120°, and 240° (equilateral triangle) */
  const angles = [
    -Math.PI / 2,                       // Top (Scroll axis)
    -Math.PI / 2 + (2 * Math.PI / 3),  // Bottom-right (Clicks axis)
    -Math.PI / 2 + (4 * Math.PI / 3)   // Bottom-left (Time axis)
  ];
  angles.forEach(a => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  /* Determine behavioral profile from the normalized values */
  let profile = 0; // Default: neutral
  if (t > 0.4 && s < 0.3)              profile = 1; // Slow/attentive reader
  else if (s > 0.5 || c > 0.5)        profile = 2; // Rapid/active reader
  else if (t < 0.1 && (s > 0.2 || c > 0.2)) profile = 3; // Short session

  const col = radarProfiles[profile].color;
  const vals = [s, c, t];

  /* Draw the filled data polygon */
  ctx.beginPath();
  vals.forEach((v, i) => {
    const a = angles[i];
    const x = cx + Math.cos(a) * R * v;
    const y = cy + Math.sin(a) * R * v;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = col + "28"; // Semi-transparent fill (hex alpha)
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();

  /* Draw dots at the three polygon vertices */
  vals.forEach((v, i) => {
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angles[i]) * R * v, cy + Math.sin(angles[i]) * R * v, 4, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  });

  /* Update the profile name and legend color dot below the radar */
  const nameEl = document.getElementById("fpProfileName");
  const dotEl = document.getElementById("fpLegDot");
  if (nameEl) nameEl.textContent = radarProfiles[profile].name;
  if (dotEl) dotEl.style.background = col;
}


/* ══════════════════════════════════════════════════════════════════
   13. COGNITIVE LOAD GAUGE
   A semicircular gauge in the bottom-right corner that estimates
   reading cognitive effort on a 0–10 scale.
   Formula: 45% scroll + 35% clicks + 20% time.
   ══════════════════════════════════════════════════════════════════ */

function updateCogLoad() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const sNorm = Math.min(fastScrollCount / 10, 1); // Maxes out at 10 rapid scrolls
  const cNorm = Math.min(clickCount / 15, 1);      // Maxes out at 15 clicks
  const tNorm = Math.min(elapsed / 60, 1);          // Maxes out at 60 seconds
  const score = Math.round((sNorm * 0.45 + cNorm * 0.35 + tNorm * 0.20) * 10);

  const scoreEl = document.getElementById("cgScore");
  const arcEl = document.getElementById("cgArc");
  const lblEl = document.getElementById("cgLabel");
  if (!scoreEl) return;

  scoreEl.textContent = score;

  /* Update the SVG arc — circumference ≈ 100.5px, dashoffset controls the fill amount */
  if (arcEl) arcEl.style.strokeDashoffset = 100.5 - (score / 10) * 100.5;

  /* Color-code the gauge by effort level */
  let color, label;
  if (score <= 3) { color = "#7cde9a"; label = "Effort faible"; }        // Low (green)
  else if (score <= 6) { color = "#facc15"; label = "Effort moyen"; }    // Medium (yellow)
  else { color = "#c8321a"; label = "Effort élevé"; }                    // High (red)

  if (arcEl) arcEl.style.stroke = color;
  if (scoreEl) scoreEl.style.color = color;
  if (lblEl) lblEl.textContent = label;
}


/* ══════════════════════════════════════════════════════════════════
   14. SESSION LOG + CSV EXPORT
   Tracks every mode switch (with timestamp, mode name, and trigger)
   and displays it as a scrollable event log.
   Supports downloading the log as a CSV file.
   ══════════════════════════════════════════════════════════════════ */

const sessionLog = [
  { time: 0, mode: "normal", trigger: "init", label: "Session démarrée — mode Normal" }
];

/**
 * Records a mode-change event and appends a new row to the session log UI.
 * @param {string} mode    - The new mode (e.g., "dyslexia")
 * @param {string} trigger - "auto" if AI-detected, "manual" if user-selected
 */
function logEvent(mode, trigger) {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const cfg = modeConfig[mode] || modeConfig.normal;
  sessionLog.push({ time: elapsed, mode, trigger, label: cfg.label });

  const entries = document.getElementById("slEntries");
  if (!entries) return;

  /* Append a new log row to the session journal UI */
  const div = document.createElement("div");
  div.className = "sl-entry sl-entry--" + mode;
  div.innerHTML =
    `<span class="sl-time">${elapsed}s</span>` +
    `<span class="sl-dot sl-dot--${mode}"></span>` +
    `<span class="sl-text"><strong>${trigger === "auto" ? "AUTO" : "MANUEL"}</strong> → mode <strong>${cfg.label}</strong></span>`;
  entries.appendChild(div);
  entries.scrollTop = entries.scrollHeight; // Auto-scroll to the newest entry

  /* Update the event counter in the footer */
  const total = document.getElementById("slTotal");
  if (total) total.textContent = sessionLog.length + (sessionLog.length === 1 ? " événement" : " événements");
}

/**
 * Wires up the CSV Export button.
 * Exports the session log as a downloadable CSV file with columns: time_s, mode, trigger.
 */
function initExport() {
  const btn = document.getElementById("slExportBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const rows = ["timp_s,mod,trigger"]; // CSV header
    sessionLog.forEach(e => rows.push(`${e.time},${e.mode},${e.trigger}`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "forma_sesiune_" + Date.now() + ".csv";
    a.click();
  });
}


/* ══════════════════════════════════════════════════════════════════
   15. A/B COMPARISON OVERLAY
   Opens a split-screen overlay with two iframes side by side:
   Pane A always shows Normal mode; Pane B shows a user-chosen mode.
   Both iframes load the current page with a URL param (?abmode=X).
   ══════════════════════════════════════════════════════════════════ */

let abMode = "focus"; // Default comparison mode for Pane B

function openAB() {
  const overlay = document.getElementById("abOverlay");
  if (!overlay) return;
  overlay.classList.add("ab-open");
  overlay.setAttribute("aria-hidden", "false");
  _loadABFrames();
}

function closeAB() {
  const overlay = document.getElementById("abOverlay");
  if (!overlay) return;
  overlay.classList.remove("ab-open");
  overlay.setAttribute("aria-hidden", "true");
}

/**
 * Changes the mode shown in Pane B and reloads both iframes.
 * @param {string} mode - One of "dyslexia", "low-vision", or "focus"
 */
function abPickMode(mode) {
  abMode = mode;
  /* Highlight the active mode picker button */
  document.querySelectorAll(".ab-pick").forEach(b => {
    b.classList.toggle("ab-pick--active", b.dataset.mode === mode);
  });
  const lbl = document.getElementById("abPaneBLabel");
  if (lbl) lbl.textContent = "B — " + (modeConfig[mode]?.label || mode);
  _loadABFrames();
}

function _loadABFrames() {
  /* Strip any existing query params so iframes always load a clean URL */
  const url = window.location.href.split("?")[0];
  const iA = document.getElementById("abIframeA");
  const iB = document.getElementById("abIframeB");
  if (iA) iA.src = url + "?abmode=normal&_t=" + Date.now();   // Cache-buster via timestamp
  if (iB) iB.src = url + "?abmode=" + abMode + "&_t=" + Date.now();
}

/* Apply mode from URL parameter — used by the A/B iframe instances at load time */
(function applyABParam() {
  const params = new URLSearchParams(window.location.search);
  const abm = params.get("abmode");
  if (abm && modeConfig[abm]) {
    setTimeout(() => setMode(abm), 100); // Short delay to let init() complete first
  }
})();


/* ══════════════════════════════════════════════════════════════════
   16. ANNOTATION LAYER
   Allows users to add personal notes to any paragraph, heading, or
   blockquote on the page. Notes are persisted in localStorage and
   restored on every visit.
   ══════════════════════════════════════════════════════════════════ */

let annotModeActive = false;  // Whether annotation mode is currently active
let annotTargetEl = null;     // The DOM element the open modal is attached to
let annotTargetKey = null;    // The localStorage key for that element's annotation

/** Toggles annotation mode on/off. In annotation mode, clicking any paragraph opens the modal. */
function toggleAnnotMode() {
  annotModeActive = !annotModeActive;
  document.body.classList.toggle("annot-mode", annotModeActive);
  const btn = document.getElementById("annotToggleBtn");
  if (btn) btn.classList.toggle("annot-mode-on", annotModeActive);
}

/* Intercept clicks in annotation mode — only target readable content elements */
document.addEventListener("click", (e) => {
  if (!annotModeActive) return;
  const target = e.target.closest("p, h2, h3, blockquote");
  if (!target) return;
  /* Ignore clicks inside UI panels to avoid accidental annotation triggers */
  if (target.closest(".access-section, #manualModePanel, .annot-modal, .ab-overlay")) return;
  e.stopPropagation();
  _openAnnotModal(target);
});

/**
 * Opens the annotation modal for a given element.
 * Pre-populates the textarea if an annotation already exists for this element.
 * @param {HTMLElement} el - The paragraph, heading, or blockquote being annotated
 */
function _openAnnotModal(el) {
  annotTargetEl = el;
  /* Build a stable localStorage key from the first 80 characters of the element's text */
  annotTargetKey = "annot_" + _encodeKey(el.textContent.slice(0, 80));

  const preview = document.getElementById("annotPreview");
  const textarea = document.getElementById("annotText");
  const delBtn = document.getElementById("annotDelBtn");

  /* Show a preview snippet of the annotated text (truncated to 120 chars) */
  if (preview) preview.textContent = el.textContent.slice(0, 120) + (el.textContent.length > 120 ? "…" : "");
  if (textarea) textarea.value = "";

  /* Load existing annotation from localStorage if one exists */
  try {
    const existing = localStorage.getItem(annotTargetKey);
    if (existing && textarea) {
      textarea.value = existing;
      if (delBtn) delBtn.style.display = "inline-flex"; // Show the delete button
    } else {
      if (delBtn) delBtn.style.display = "none"; // No existing annotation — hide delete
    }
  } catch (err) { }

  const modal = document.getElementById("annotModal");
  const backdrop = document.getElementById("annotBackdrop");
  if (modal) { modal.classList.add("annot-open"); modal.setAttribute("aria-hidden", "false"); }
  if (backdrop) backdrop.classList.add("annot-open");
  if (textarea) setTimeout(() => textarea.focus(), 50); // Focus textarea for immediate typing
  el.classList.add("annot-target-highlight"); // Visually highlight the annotated element
}

function closeAnnotModal() {
  const modal = document.getElementById("annotModal");
  const backdrop = document.getElementById("annotBackdrop");
  if (modal) { modal.classList.remove("annot-open"); modal.setAttribute("aria-hidden", "true"); }
  if (backdrop) backdrop.classList.remove("annot-open");
  if (annotTargetEl) annotTargetEl.classList.remove("annot-target-highlight");
  annotTargetEl = null;
  annotTargetKey = null;
}

/** Saves the current annotation to localStorage and marks the element with a badge. */
function saveAnnotation() {
  const text = document.getElementById("annotText")?.value?.trim();
  if (!text || !annotTargetKey || !annotTargetEl) return;
  try {
    localStorage.setItem(annotTargetKey, text);
    _markAnnotated(annotTargetEl, text);
  } catch (e) { }
  closeAnnotModal();
}

/** Removes an annotation from localStorage and its visual badge from the element. */
function deleteAnnotation() {
  if (!annotTargetKey || !annotTargetEl) return;
  try { localStorage.removeItem(annotTargetKey); } catch (e) { }
  annotTargetEl.classList.remove("has-annotation");
  const badge = annotTargetEl.querySelector(".annot-badge");
  if (badge) badge.remove();
  closeAnnotModal();
}

/**
 * Adds the "has-annotation" class and a ✎ badge to an annotated element.
 * Clicking the badge reopens the annotation modal in annotation mode.
 */
function _markAnnotated(el, text) {
  el.classList.add("has-annotation");
  let badge = el.querySelector(".annot-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "annot-badge";
    badge.onclick = (e) => { e.stopPropagation(); if (annotModeActive) _openAnnotModal(el); };
    el.appendChild(badge);
  }
  badge.textContent = "✎";
  badge.title = text; // Show annotation text on hover
}

/**
 * Creates a URL-safe localStorage key from a text snippet.
 * Replaces whitespace with underscores and strips non-alphanumeric characters.
 */
function _encodeKey(str) {
  return str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60);
}

/** Scans all annotatable elements on page load and restores any saved annotations from localStorage. */
function restoreAnnotations() {
  document.querySelectorAll("p, h2, h3, blockquote").forEach(el => {
    const key = "annot_" + _encodeKey(el.textContent.slice(0, 80));
    try {
      const saved = localStorage.getItem(key);
      if (saved) _markAnnotated(el, saved);
    } catch (e) { }
  });
}


/* ══════════════════════════════════════════════════════════════════
   17. SCROLL-REVEAL (IntersectionObserver)
   Elements with .reveal-section or .reveal-item fade in from below
   when they enter the viewport. Each element is unobserved after
   its first reveal to avoid re-triggering.
   ══════════════════════════════════════════════════════════════════ */

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        io.unobserve(entry.target); // One-shot: stop observing after reveal
      }
    });
  }, { threshold: 0.08 }); // Trigger when 8% of the element is visible

  /* Stagger reveal-item transitions within each group (4-item cycle, 80ms apart) */
  document.querySelectorAll(".reveal-section, .reveal-item").forEach((el, i) => {
    el.style.transitionDelay = el.classList.contains("reveal-item") ? (i % 4) * 0.08 + "s" : "0s";
    io.observe(el);
  });
}


/* ══════════════════════════════════════════════════════════════════
   18. HAMBURGER MENU (mobile)
   Toggles the navigation drawer open/closed on small screens.
   ══════════════════════════════════════════════════════════════════ */

function initHamburger() {
  const hamburger = document.getElementById("hamburger");
  const headerNav = document.querySelector(".header-nav");
  if (!hamburger || !headerNav) return;
  hamburger.addEventListener("click", () => {
    const open = hamburger.classList.toggle("open");
    headerNav.classList.toggle("nav-open", open);
  });
}


/* ══════════════════════════════════════════════════════════════════
   19. INIT — Main entry point
   Orchestrates all module initialization in the correct order.
   ══════════════════════════════════════════════════════════════════ */

function init() {
  buildManualPanel();       // Inject the slide-in mode panel into the DOM
  initReveal();             // Set up scroll-reveal observers
  initExport();             // Wire up the CSV export button
  restoreAnnotations();     // Reload any saved annotations from localStorage
  initHamburger();          // Set up the mobile hamburger menu

  /* Restore the previously saved mode (focus mode is intentionally not restored) */
  try {
    const saved = localStorage.getItem("formaMode");
    if (saved && saved !== "focus" && modeConfig[saved]) {
      setMode(saved);
    } else {
      localStorage.removeItem("formaMode");
      updateUI("normal"); // Default UI state with no mode change
    }
  } catch (e) {
    updateUI("normal");
  }

  /* Auto-activate Low Vision mode on very small screens (< 500px) */
  if (window.innerWidth < 500) {
    safeSetMode("low-vision");
  }

  /* Initialize all dashboard widgets with default/empty values */
  updateMetrics();
  drawRadar(0, 0, 0);
  updateCogLoad();
  updateSectionProgress();
}

/* Run init() as soon as the DOM is ready — or immediately if it already is */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}


/* ══════════════════════════════════════════════════════════════════
   GLOBAL EXPOSURE
   Functions called via onclick="" attributes in the HTML must be
   attached to the window object to be accessible from inline handlers.
   ══════════════════════════════════════════════════════════════════ */

window.setMode = setMode;
window.manualSetMode = manualSetMode;
window.scrollToAccess = scrollToAccess;
window.openAB = openAB;
window.closeAB = closeAB;
window.abPickMode = abPickMode;
window.toggleAnnotMode = toggleAnnotMode;
window.closeAnnotModal = closeAnnotModal;
window.saveAnnotation = saveAnnotation;
window.deleteAnnotation = deleteAnnotation;


/* ══════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ══════════════════════════════════════════════════════════════════ */

/** Smoothly scrolls the page to the accessibility section. Used by the FAB button. */
function scrollToAccess() {
  const sec = document.getElementById("access-section");
  if (sec) sec.scrollIntoView({ behavior: "smooth" });
}

/**
 * Displays a non-blocking toast notification suggesting a mode change.
 * The toast has "Activate" and "Dismiss" options.
 * Dismissing applies a 30-second cooldown to prevent re-suggesting the same mode.
 * @param {string} mode - The mode being suggested ("focus" or "dyslexia")
 */
function suggestMode(mode) {
    if (document.getElementById('smartToast')) return; // Prevent duplicate toasts

    const modeName = mode === 'focus' ? 'Concentration' : 'Dyslexie';

    const toast = document.createElement('div');
    toast.id = 'smartToast';
    toast.className = 'smart-toast';
    toast.innerHTML = `
        <div class="st-header">
            <span class="st-title">SUGGESTION</span>
            <button class="st-close" id="stClose">✕</button>
        </div>
        <p class="st-desc">Nous avons détecté que le mode <strong>${modeName}</strong> pourrait vous convenir. Essayez-le ?</p>
        <button class="st-activate" id="stActivate">Activer</button>
    `;

    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('st-show'), 100); // Trigger CSS entrance animation

    /* Activate button — applies the suggested mode immediately */
    document.getElementById('stActivate').addEventListener('click', () => {
        setMode(mode);
        closeToast(toast);
    });

    /* Dismiss button — closes the toast and applies a 30-second cooldown */
    document.getElementById('stClose').addEventListener('click', () => {
        closeToast(toast);
        modeChangeCooldown = true;
        setTimeout(() => { modeChangeCooldown = false; }, 30000);
    });
}

/**
 * Animates the toast out and removes it from the DOM after the transition.
 * @param {HTMLElement} toast - The toast element to dismiss
 */
function closeToast(toast) {
    toast.classList.remove('st-show');
    setTimeout(() => toast.remove(), 400); // Wait for CSS exit animation to complete
}
