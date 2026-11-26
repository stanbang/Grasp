const { cpSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

function addFrameProbe() {
  const panel = document.createElement("aside");
  panel.style.cssText = "position:fixed;top:52px;left:8px;z-index:50;display:grid;gap:6px;max-width:calc(100vw - 16px);padding:7px;background:#101923;color:#e7edf1;font:13px system-ui";
  panel.innerHTML = '<div><button type="button">Measure five seconds</button> <button type="button">Measure until 3D opens</button></div><output style="overflow-wrap:anywhere">Ready</output>';
  document.body.append(panel);
  const [sample, replay] = panel.querySelectorAll("button");
  const result = panel.querySelector("output");

  function measure(untilCanvas) {
    const intervals = [];
    const stages = new Set();
    let first, previous, canvasAtStart;
    let visible = true;
    let focused = true;
    sample.disabled = replay.disabled = true;
    result.value = "Measuring…";

    function frame(now) {
      const canvas = document.querySelector(".orbit-engine canvas");
      stages.add(document.querySelector(".replay h2")?.textContent ?? "Landing");
      visible &&= document.visibilityState === "visible";
      focused &&= document.hasFocus();
      if (first === undefined) {
        first = now;
        canvasAtStart = !!canvas;
      } else intervals.push(now - previous);
      previous = now;

      const ms = now - first;
      if (!intervals.length || (ms < (untilCanvas ? 30_000 : 5000) && !(untilCanvas && canvas))) {
        requestAnimationFrame(frame);
        return;
      }

      const ordered = intervals.toSorted((a, b) => a - b);
      const context = canvas?.getContext("webgl2");
      const debug = context?.getExtension("WEBGL_debug_renderer_info");
      result.value = JSON.stringify({
        ms: +ms.toFixed(1), frames: intervals.length, fps: +(1000 * intervals.length / ms).toFixed(1),
        p95Ms: +ordered[Math.ceil(ordered.length * .95) - 1].toFixed(1),
        over20ms: intervals.filter(interval => interval > 20).length,
        maxMs: +ordered.at(-1).toFixed(1), visible, focused, canvasAtStart, canvasAtEnd: !!canvas,
        viewport: [innerWidth, innerHeight], pixelRatio: devicePixelRatio,
        chrome: navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0], stages: [...stages],
        renderer: debug && context.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      });
      sample.disabled = replay.disabled = false;
    }

    requestAnimationFrame(frame);
  }

  sample.addEventListener("click", () => measure(false));
  replay.addEventListener("click", () => measure(true));
}

const workspace = resolve(__dirname, "..");
const build = join(workspace, "apps", "web", "dist");
const destination = join(workspace, "work", "showcase-frame-probe");
const page = readFileSync(join(build, "showcase", "index.html"), "utf8");
cpSync(build, destination, { recursive: true });
writeFileSync(join(destination, "showcase", "frame-probe.html"), page.replace("</body>",
  `<script>(${addFrameProbe.toString()})();</script></body>`));
console.log("Serve work/showcase-frame-probe on loopback and open /showcase/frame-probe.html.");
