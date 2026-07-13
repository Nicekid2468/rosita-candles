/* =========================================================
   Rosita Candles — Clean Retail App
   Vanilla JS + GSAP. Single source of truth data array drives
   the hero counter, the SVG chart, and the asset list.
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     1. MATHEMATICAL MOBILE SCALING
     Bypasses Safari/Android viewport bugs by scaling the fixed
     1080x1920 canvas manually instead of relying on CSS zoom.
     ========================================================= */
  const canvas = document.getElementById("canvas");

  function applyScale() {
    const scale = Math.min(1, window.innerWidth / 1080, window.innerHeight / 1920);
    const xOffset = (window.innerWidth - 1080 * scale) / 2;
    const yOffset = (window.innerHeight - 1920 * scale) / 2;

    canvas.style.transformOrigin = "top left";
    canvas.style.transform = `translate(${xOffset}px, ${yOffset}px) scale(${scale})`;
  }

  let resizeRAF = null;
  function scheduleScale() {
    if (resizeRAF) cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(applyScale);
  }

  window.addEventListener("resize", scheduleScale);
  window.addEventListener("orientationchange", scheduleScale);
  applyScale();

  /* =========================================================
     2. SYNCHRONIZED MASTER DATA ARRAY
     Start and end values are exact. Every intermediate point
     is a day-by-day waypoint; because the series telescopes,
     the sum of daily deltas always equals (end - start)
     regardless of the path shape in between.
     ========================================================= */
  const START_VALUE = 10780.31;
  const END_VALUE = 15901.95;

  const MASTER_DATA = [
    { label: "Mon", value: 10780.31 },
    { label: "Tue", value: 11250.80 },
    { label: "Wed", value: 10980.45 },
    { label: "Thu", value: 12430.60 },
    { label: "Fri", value: 13100.25 },
    { label: "Sat", value: 12850.90 },
    { label: "Sun", value: 14500.75 },
    { label: "Now", value: 15901.95 },
  ];

  // Sanity-lock the endpoints to the exact required values.
  MASTER_DATA[0].value = START_VALUE;
  MASTER_DATA[MASTER_DATA.length - 1].value = END_VALUE;

  const TOTAL_DELTA = END_VALUE - START_VALUE;
  const TOTAL_RETURN_PCT = (TOTAL_DELTA / START_VALUE) * 100;

  // Most recent day-over-day delta drives the "Today" badge and
  // acts as the base rate for each asset's daily change.
  const lastPoint = MASTER_DATA[MASTER_DATA.length - 1];
  const prevPoint = MASTER_DATA[MASTER_DATA.length - 2];
  const TODAY_RETURN_PCT = ((lastPoint.value - prevPoint.value) / prevPoint.value) * 100;

  /* =========================================================
     3. FORMATTING HELPERS
     ========================================================= */
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function formatCurrency(value) {
    return currencyFormatter.format(value);
  }

  function formatShort(value) {
    const abs = Math.abs(value);
    if (abs >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(0)}`;
  }

  function formatPct(value) {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }

  /* =========================================================
     4. DYNAMIC CHART BOUNDARIES
     Scans the data array for the real min/max, then pads with
     a buffer so the stroke never clips the container edges.
     ========================================================= */
  const svg = document.getElementById("chartSvg");
  const path = document.getElementById("chartPath");
  const dot = document.getElementById("chartDot");
  const axisEl = document.getElementById("chartAxis");

  const VIEWBOX_W = 1080;
  const VIEWBOX_H = 640;
  const PAD_X = 40;
  const PAD_Y_TOP = 50;
  const PAD_Y_BOTTOM = 50;

  const values = MASTER_DATA.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin || 1;
  const buffer = range * 0.18; // headroom so peaks/valleys never touch the edges

  const boundMin = rawMin - buffer;
  const boundMax = rawMax + buffer;
  const boundRange = boundMax - boundMin;

  function xForIndex(i) {
    const usableW = VIEWBOX_W - PAD_X * 2;
    return PAD_X + (i / (MASTER_DATA.length - 1)) * usableW;
  }

  function yForValue(v) {
    const usableH = VIEWBOX_H - PAD_Y_TOP - PAD_Y_BOTTOM;
    const ratio = (v - boundMin) / boundRange;
    // Invert because SVG y grows downward.
    return PAD_Y_TOP + (1 - ratio) * usableH;
  }

  const chartPoints = MASTER_DATA.map((d, i) => ({
    x: xForIndex(i),
    y: yForValue(d.value),
  }));

  /* Catmull-Rom -> cubic Bezier conversion for a smooth, organic
     curve (no gridlines, no sharp joints). */
  function buildSmoothPath(points) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  path.setAttribute("d", buildSmoothPath(chartPoints));

  /* =========================================================
     5. AXIS LABELS (shorthand currency)
     ========================================================= */
  function renderAxisLabels() {
    axisEl.innerHTML = "";
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const v = boundMin + (boundRange * i) / (steps - 1);
      const span = document.createElement("span");
      span.textContent = formatShort(v);
      axisEl.appendChild(span);
    }
  }
  renderAxisLabels();

  /* =========================================================
     6. ASSET LIST — derived from the same synchronized data
     ========================================================= */
  const ASSET_CONFIG = [
    { symbol: "AAPL", basePrice: 212.44, multiplier: 0.72 },
    { symbol: "TSLA", basePrice: 318.07, multiplier: 1.35 },
    { symbol: "MSFT", basePrice: 487.90, multiplier: -0.48 },
  ];

  const assetCards = Array.from(document.querySelectorAll(".asset-card"));

  assetCards.forEach((card, i) => {
    const config = ASSET_CONFIG[i];
    if (!config) return;

    const changePct = TODAY_RETURN_PCT * config.multiplier;
    const priceEl = card.querySelector(".asset-price");
    const changeEl = card.querySelector(".asset-change");

    priceEl.textContent = `$${formatCurrency(config.basePrice)}`;
    changeEl.textContent = formatPct(changePct);
    changeEl.classList.remove("positive", "negative");
    changeEl.classList.add(changePct >= 0 ? "positive" : "negative");
  });

  /* =========================================================
     7. GSAP ANIMATIONS — organic, human-led easing throughout
     ========================================================= */
  const heroValueEl = document.getElementById("heroValue");
  const badgeReturnValueEl = document.getElementById("badgeReturnValue");
  const badgeEl = document.getElementById("badgeReturn");

  gsap.set([".header", ".hero-label", ".hero-value", ".badge-return"], {
    opacity: 0,
    y: 24,
  });
  gsap.set(".chart-container", { opacity: 0, y: 32, scale: 0.98 });
  gsap.set(assetCards, { opacity: 0, y: 40 });
  gsap.set(dot, { opacity: 0 });

  const master = gsap.timeline({ defaults: { ease: "power2.out" } });

  // Header settles in first.
  master.to(".header", { opacity: 1, y: 0, duration: 0.8 }, 0);

  // Hero label + number rise together with a soft, natural ease.
  master.to(".hero-label", { opacity: 1, y: 0, duration: 0.7 }, 0.4);
  master.to(
    ".hero-value",
    { opacity: 1, y: 0, duration: 0.9, ease: "sine.out" },
    0.8
  );

  // Chart container and badge settle into place early, then everything
  // below runs IN PARALLEL with the slow counter — not stacked after it —
  // so the total video lands around 30s instead of 45s+.
  master.to(
    ".chart-container",
    { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: "sine.inOut" },
    1.0
  );
  master.fromTo(
    badgeEl,
    { opacity: 0, y: 16, scale: 0.9 },
    { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.6)" },
    1.0
  );

  // Count the hero number up from the start value to the end value.
  // This is the star of the animation — deliberately slow (30s).
  const counter = { val: START_VALUE };
  master.to(
    counter,
    {
      val: END_VALUE,
      duration: 30,
      ease: "power2.out",
      onUpdate: () => {
        heroValueEl.textContent = formatCurrency(counter.val);
      },
    },
    1.2
  );

  // Badge percentage counts up across roughly the same span, settling
  // a beat before the hero number so it doesn't feel like it's racing it.
  const pctCounter = { val: 0 };
  master.to(
    pctCounter,
    {
      val: TOTAL_RETURN_PCT,
      duration: 28,
      ease: "power2.out",
      onUpdate: () => {
        badgeReturnValueEl.textContent = formatPct(pctCounter.val);
      },
    },
    1.6
  );

  // Draw the line slowly, in sync with the counter climbing — not a
  // quick 2s flourish that finishes and then just sits there idle.
  const pathLength = path.getTotalLength();
  gsap.set(path, {
    strokeDasharray: pathLength,
    strokeDashoffset: pathLength,
  });

  master.to(
    path,
    { strokeDashoffset: 0, duration: 27, ease: "power2.inOut" },
    1.6
  );

  // Leading dot fades in and travels the curve at the same pace as the
  // line draw, so both feel like one continuous gesture.
  const finalPoint = chartPoints[chartPoints.length - 1];
  gsap.set(dot, {
    cx: chartPoints[0].x,
    cy: chartPoints[0].y,
  });
  master.to(dot, { opacity: 1, duration: 0.4 }, 1.6);
  master.to(
    dot,
    {
      cx: finalPoint.x,
      cy: finalPoint.y,
      duration: 27,
      ease: "power2.inOut",
    },
    1.6
  );

  // Asset cards rise in with a gentle stagger near the tail end, just
  // before the counter finishes — the last beat of the sequence.
  master.to(
    assetCards,
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power2.out",
      stagger: 0.18,
    },
    27.5
  );
})();
