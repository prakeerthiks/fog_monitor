# PRP: AI Aquarium (prototype v0.1)

## 1. Goal
A single-screen, voxel-style 3D aquarium in the browser where blocky fish teach AI concepts. The player picks a topic, fish swim forward and "talk" through speech bubbles and a swipeable lesson scroll, then return to their homes. Built for screen-recording Instagram reels.

**Success = a 30-second reel-worthy loop:** pick topic -> fish come forward -> talk -> swipe through lessons -> end -> fish go home. Works with hand gestures AND with mouse/touch.

## 2. Non-goals (v0.1)
- No free-form AI chat (Claude API is v0.3+).
- No accounts, saving, or backend.
- No fine-tuned gesture recognition. Only 3 gestures (below).
- No free camera movement. One fixed camera.

## 3. Tech stack
| Need | Choice |
|---|---|
| Rendering | Three.js (r160+), plain JS modules, Vite for dev/build |
| Voxel look | Fish/coral/rocks built from small cubes (InstancedMesh), flat shading, low-poly lighting, optional slight tilt-shift/fog |
| Hand tracking | MediaPipe Tasks Vision `HandLandmarker` (browser, webcam) |
| UI (bubbles, scroll) | HTML/CSS overlay with a pixel/voxel-style font, positioned over 3D fish via world-to-screen projection |
| Content | `src/data/topics.json` |
| Hosting | GitHub Pages / Netlify (HTTPS needed for webcam) |

## 4. Simplified gestures (least tuning)
Design rule: **only use gestures decided by one simple measurement**, with a mouse/touch equivalent for each. All gestures need to be held ~0.4s to fire (debounce) so jitter does not trigger them.

| Action | Gesture | How it is detected | Fallback |
|---|---|---|---|
| **Aim** at a fish | Move index fingertip (landmark 8) | Map fingertip x/y to screen; nearest fish within radius is highlighted | Mouse hover / touch |
| **Talk to a fish** | Hold finger over fish ~0.8s (dwell) | Timer ring fills; no pinch precision needed | Click / tap |
| **Next lesson / previous** | Swipe hand left/right | Wrist x velocity over ~0.3s exceeds threshold | Swipe / arrow keys |
| **Done (fish go home)** | Open palm held up ~1s | All 5 fingertips above their knuckles | Esc / button |

Why this works: dwell-to-select replaces double-tap/pinch (the hardest to tune), and open palm is the most reliably detected hand shape. Zoom-out gesture is dropped.

## 5. Scene and visuals
- **Tank:** one fixed perspective camera, slight parallax from hand/mouse position (a few degrees) for the 3D feel.
- **Voxel environment:** sand floor, coral and rock clusters, seaweed that sways (sine on voxel columns), floating bubbles, soft light shafts.
- **Homes:** each fish breed has a "home" (cave, coral, shell) at the bottom; fish idle-swim near it.
- **Fish:** built from cubes, 3 breeds in v0.1 (e.g. Angelfish, Pufferfish, Clownfish), each with a distinct color and a topic.
- **Animation:** gentle idle swim loop, tail wiggle, ease toward the camera when selected, ease back home when done.
- Keep movement subtle: slow drift, not constant chaos.

## 6. Interaction flow
1. **Topic picker** (top bar): tap or dwell a topic chip. Fish for that topic highlight.
2. Fish swim to the front of the tank.
3. **Talk:** aim at a fish -> dwell -> its speech bubble appears (voxel/pixel style) with a short line. A **lesson scroll** card slides up with the full lesson.
4. **Swipe** left/right to move between lessons.
5. **Open palm / Esc:** fish swim back home, scroll closes.
6. Pick another topic to repeat.

## 7. Content format (`src/data/topics.json`)
```json
{
  "topics": [
    {
      "id": "neural-networks",
      "title": "Neural Networks",
      "fish": "angelfish",
      "color": "#ffb347",
      "lessons": [
        { "bubble": "I am a neuron!", "title": "What is a neuron?", "text": "A tiny math box that takes numbers in and passes one number out." }
      ]
    }
  ]
}
```
Adding AI knowledge = adding entries here. No code changes. Lesson text max ~220 chars so the scroll fits on a phone-sized recording.

## 8. File structure
```
airoadmap_game/
  index.html
  package.json
  src/
    main.js          # boot, loop
    scene.js         # tank, lights, camera, parallax
    voxel.js         # helpers to build voxel models
    fish.js          # fish factory, states: idle | forward | home
    ui.js            # bubbles, scroll, topic bar
    input.js         # unified input: mouse/touch + hand events
    hands.js         # MediaPipe setup + 3 gesture detectors
    data/topics.json
  PRP.md
```

## 9. Milestones
1. **M1 (no hands):** Voxel tank, 3 fish, topic bar, mouse/tap talking, bubble + scroll, swipe, fish go home. Fully playable.
2. **M2:** Add MediaPipe: fingertip cursor + dwell select.
3. **M3:** Swipe and open-palm gestures, tuning thresholds in one config object.
4. **M4:** Polish for reels: sound, more fish/topics, clean recording mode (hide cursor/debug).

## 10. Acceptance criteria (v0.1 = M1 + M2)
- Loads in under 3s on a laptop, runs at ~60fps with 3 fish.
- Every action works with mouse/touch alone.
- Hand cursor follows index fingertip with no noticeable lag; dwell select works from ~1m from webcam.
- Adding a new topic in `topics.json` appears with no code change.
- Webcam denied -> game falls back to mouse/touch with a friendly note.

## 11. Risks and mitigations
- **Gesture jitter:** smooth landmarks (exponential moving average) and use dwell timers.
- **Poor webcam light:** show a small "hand detected" indicator.
- **Mobile webcam permissions:** keep touch as first-class input.
- **Scope creep:** gestures and chat are capped at the list above for v0.1.

## 12. Open questions
- First 3 topics and their fish breeds?
- Voxel palette: bright/colorful (ChromaCraft-like) or calm ocean blues?
- Sound on or off for v0.1?
