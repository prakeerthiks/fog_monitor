import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Tunable thresholds in one place
export const CFG = {
  smooth: 0.35, // cursor smoothing (higher = snappier)
  swipeWindow: 0.45, // seconds
  stillSpeed: 0.05 // max wrist travel (frame fraction) in the window to count as "still"
};

export class Hands {
  constructor(video) {
    this.video = video;
    this.landmarker = null;
    this.running = false;
    this.stream = null;
    this.cursor = { x: 0.5, y: 0.5 };
    this.samples = [];
    this.lastSwipe = -10;
    this.lastVideoTime = -1;
    this.state = { present: false, x: 0.5, y: 0.5, openPalm: false, still: false, swipe: null };
  }

  async start() {
    if (!this.landmarker) {
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate) =>
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: 'VIDEO',
          numHands: 1
        });
      try {
        this.landmarker = await make('GPU');
      } catch {
        this.landmarker = await make('CPU');
      }
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
  }

  stop() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.state = { present: false, x: 0.5, y: 0.5, openPalm: false, still: false, swipe: null };
  }

  // call once per frame; returns the current simple state
  poll(nowSec) {
    const s = this.state;
    if (!this.running || !this.landmarker || this.video.readyState < 2) return s;
    if (this.video.currentTime === this.lastVideoTime) return s;
    this.lastVideoTime = this.video.currentTime;

    let res;
    try {
      res = this.landmarker.detectForVideo(this.video, performance.now());
    } catch {
      return s;
    }
    const lm = res.landmarks && res.landmarks[0];
    if (!lm) {
      s.present = false;
      s.openPalm = false;
      this.samples.length = 0;
      return s;
    }
    s.present = true;

    // cursor = index fingertip, mirrored so it moves like a mirror
    const tipX = 1 - lm[8].x;
    const tipY = lm[8].y;
    // stretch the central part of the camera frame to the whole screen (easier reach)
    const mx = clamp01((tipX - 0.15) / 0.7);
    const my = clamp01((tipY - 0.1) / 0.6);
    this.cursor.x += (mx - this.cursor.x) * CFG.smooth;
    this.cursor.y += (my - this.cursor.y) * CFG.smooth;
    s.x = this.cursor.x;
    s.y = this.cursor.y;

    // open palm: four fingertips above their middle joints (hand upright) + thumb out
    const up = (tip, pip) => lm[tip].y < lm[pip].y - 0.02;
    const fingersUp = up(8, 6) && up(12, 10) && up(16, 14) && up(20, 18);
    const thumbOut = Math.abs(lm[4].x - lm[2].x) > 0.04;
    s.openPalm = fingersUp && thumbOut;

    // wrist history for swipe + stillness
    const wx = 1 - lm[0].x;
    const wy = lm[0].y;
    this.samples.push({ t: nowSec, x: wx, y: wy });
    while (this.samples.length && nowSec - this.samples[0].t > CFG.swipeWindow) this.samples.shift();
    const first = this.samples[0];
    const dx = wx - first.x;
    const dy = wy - first.y;
    s.still = Math.hypot(dx, dy) < CFG.stillSpeed;
    return s;
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
