# Showcase design review

Single-reviewer pass. The owner requested that I evaluate each phase myself. I applied the Impeccable shape, critique, polish and audit guidance to the same route.

The landing introduces the sample choice over the star field. During replay each stage has one visible caption. The concept list provides an alternate path to a star's evidence. The replay and source reader worked during keyboard and pointer checks. The dense moment is the ready view, where replay, concept controls and questions coexist. The concept list and history begin collapsed to keep the map visible.

The rendered scan found file-type labels below the detector's functional text floor. Polish increased their size and balanced a short last line on phones. The final rendered scans reported no findings on the opening page at 1280 × 720 and 390 × 844. The source scan reported no matches for its regex rules. The browser review covered ready and source states separately. [Verification log](PROGRESS.md#replay-and-chat)

The audit covered labelled controls, focus, source contrast, reduced motion and layout. The browser showed a native source dialog, a highlighted exact quote and a working Escape key. It rendered and selected stars in both graph modes. The automated event test proves that external files never reach a read path. Tests for the sample buttons exercise taps, keyboard activation, pointer ownership, cancellation and duplicate clicks after a drag. Run `node --test scripts/tests/showcase.test.cjs`. Physical touch still needs a device check.

To reproduce the scans, run the local app, then run `npx impeccable detect apps/web/src`. Run the same command with `http://127.0.0.1:5173/showcase/ --viewport 1280x720` and with `--viewport 390x844` for the rendered checks. Continue through the [demo script](../README.md#demo-script) to check the interactive states.

## Interactive course walkthrough

The walkthrough keeps the replay separate and groups the interview topics in the reading rail. I verified keyboard entry, both pipeline lanes, the effect of chunk size and ranking on the archived numbers, an embedding replacement, both evaluation modes, claim feedback and the local production mode. The router example opened the original cited passage after returning to the map. The prompt comparison kept the question fixed and showed or hid both the retrieved quote and grounding instruction as expected.

The first keyboard pass scrolled the back control out of reach. The guide now keeps its back and example controls visible in a sticky header. Phone-width testing confirmed that the topic controls and evidence table fit. The rendered Impeccable scans reported no findings at the same desktop and phone viewports. Run the commands above with `/showcase/?view=guide` to repeat the check.

## Browser frame sample

I measured the production build at `1c239c6` on a Lenovo 83DF laptop with an Intel Core i9-14900HX, an NVIDIA RTX 4060 Laptop GPU, 32 GB RAM and a 240 Hz display. Chrome 157 used hardware WebGL through ANGLE with a 1366 × 701 CSS-pixel viewport and a 1.875 device pixel ratio.

| Browser state | Sample | Mean callbacks/s | 95th-percentile interval | Intervals over 20 ms | Longest interval |
| --- | ---: | ---: | ---: | ---: | ---: |
| Landing | 5,004.3 ms | 240.0 | 4.3 ms | 0 | 5.2 ms |
| Network replay through first 3D canvas | 16,374.9 ms | 227.8 | 6.0 ms | 2 | 37.5 ms |
| 3D rotate, zoom and show router answer | 5,000.0 ms | 232.4 | 4.3 ms | 1 | 29.1 ms |

The sampler counts `requestAnimationFrame` callbacks. These are browser scheduling observations on one laptop. They do not measure uniquely rendered GPU frames or establish a sustained 60 fps on other hardware. Later automation samples included intervals of about one second while Chrome had a different tab in front. The rerun after reopening Computer Use still showed a slower graph sample, so the table records the initial build observations. The probe reports focus and visibility to help identify unsuitable samples.

Run these commands from the repository root. Keep the resulting tab and Chrome window in front for the whole sample.

```sh
npm run build
node scripts/prepare_showcase_frame_probe.cjs
python -m http.server 15179 --bind 127.0.0.1 --directory work/showcase-frame-probe
```

Open `http://127.0.0.1:15179/showcase/frame-probe.html` in Chrome. Use **Measure five seconds** for the landing sample. For replay, reload the page, select **Measure until 3D opens**, then select **Computer networks**. Once the map is ready, start a five-second sample, rotate and zoom, then ask the suggested router question. Copy the resulting JSON and record which actions were included. The probe lives in the ignored `work/` copy of the built site.
