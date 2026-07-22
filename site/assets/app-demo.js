/**
 * INTERFACE DEMO: a scripted replay of the app's screen, for the website.
 *
 * What it shows: telemetry ticking in, the fall line arriving, the app asking
 * the model on its own, and the recorded answer with its EVACUATION line
 * pulled out. The response text is the verbatim recorded output from the real
 * local run (docs/session-reports/2026-07-22-phase2-sensor-aware-llm.md,
 * case 3). Nothing here calls a model: the page labels it as a scripted
 * demonstration, and that label is the point.
 */

// The reference telemetry lines from DATA_FORMAT.md, shortened for the ticker.
const TICKER = [
  't_ms 100 · alt 0.0 m · 21.0 °C · 1.00 g',
  't_ms 200 · alt 2.1 m · 21.0 °C · 0.04 g',
  't_ms 300 · alt 2.1 m · 21.0 °C · 2.62 g · FALL',
  't_ms 400 · alt 2.2 m · 21.1 °C · 0.99 g',
];

// Verbatim recorded response (model llama3.2:3b, local, seeded run).
const RESPONSE = [
  ['b', 'IMMEDIATE ACTION REQUIRED'],
  ['p', '1. Stop any bleeding: Apply gentle pressure to the wound with a clean cloth or bandage for at least 5 minutes if you see any bleeding.'],
  ['p', '2. Check for head, neck, and spine injury: Look for signs of concussion, broken neck, or spinal cord injury, such as numbness, tingling, weakness, or difficulty moving your arms or legs.'],
  ['p', '3. Assess for hidden trauma: Check for injuries that may not be immediately visible, such as internal bleeding, broken ribs, or head trauma.'],
  ['p', '4. Look for breathing difficulties: Check if you’re having trouble breathing or if your breathing is labored.'],
  ['p', '5. Check for movement and sensation: Move each limb carefully to check for numbness, tingling, or weakness.'],
];
const EVAC = 'CALL FOR HELP NOW — GET MEDICAL ASSISTANCE AS SOON AS POSSIBLE.';

export function mountAppDemo(root) {
  const $ = (cls) => root.querySelector(cls);
  const ticker = $('.pd-ticker');
  const alertEl = $('.pd-alert');
  const chip = $('.pd-chip');
  const body = $('.pd-body');
  const evac = $('.pd-evac');
  const replay = $('.pd-replay');

  const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, instant ? 0 : ms)); };

  function run() {
    timers.forEach(clearTimeout);
    timers = [];
    ticker.textContent = TICKER[0];
    ticker.classList.remove('is-fall');
    alertEl.hidden = true;
    chip.hidden = true;
    evac.hidden = true;
    body.replaceChildren();
    replay.hidden = true;

    // two quiet passes of the loop, then stop on the fall line
    const steps = [...TICKER.slice(0, 2), ...TICKER, TICKER[0], TICKER[1], TICKER[2]];
    steps.forEach((line, i) => {
      later(() => {
        ticker.textContent = line;
        if (i === steps.length - 1) {
          ticker.classList.add('is-fall');
          later(() => { alertEl.hidden = false; }, 350);
          later(() => { chip.hidden = false; }, 900);
          later(type, 1500);
        }
      }, 420 * i);
    });
  }

  function type() {
    // The real app does the same thing: the full response has already arrived,
    // and is revealed at reading pace. This is display pacing, not the model.
    let delay = 0;
    for (const [kind, text] of RESPONSE) {
      const el = document.createElement(kind === 'b' ? 'strong' : 'p');
      body.appendChild(el);
      const words = text.split(' ');
      words.forEach((w, i) => {
        later(() => {
          el.textContent += (i ? ' ' : '') + w;
          body.scrollTop = body.scrollHeight;
        }, delay);
        delay += 34;
      });
      delay += 120;
    }
    later(() => {
      evac.textContent = EVAC;
      evac.hidden = false;
      replay.hidden = false;
      body.scrollTop = body.scrollHeight;
    }, delay + 200);
  }

  replay.addEventListener('click', run);

  // start when it scrolls into view, once
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { io.disconnect(); run(); }
  }, { threshold: 0.4 });
  io.observe(root);
}
