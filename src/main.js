import * as THREE from 'three';
import topicsData from './data/topics.json';
import { TeacherFish, AmbientFish, FRONT_POS, voxMat } from './fish.js';
import { buildWorld } from './world.js';
import { initAudio, setMuted, isMuted, sfxBubble, sfxWhoosh, sfxChime, sfxBlip } from './audio.js';

const topics = topicsData.topics;

// ---------- renderer / scene / camera ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x36b6e6, 16, 44);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xe6ffff, 0x2a7fc0, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(-6, 12, 8);
scene.add(sun);

const world = buildWorld(scene);

// ---------- fish ----------
const teachers = topics.map((tp, i) => {
  const f = new TeacherFish(tp.fish, world.homes[i]);
  f.topic = tp;
  scene.add(f.obj);
  return f;
});
const ambient = [];
const kinds = ['clown', 'puffer', 'angel'];
const tints = [0xff5fa2, 0x2ee6c5, 0xffd23f, 0xb06bff, 0xff8a3d, 0x5ad1ff];
for (let i = 0; i < 9; i++) {
  const a = new AmbientFish(kinds[i % 3], tints[i % tints.length], { xMin: -15, xMax: 15, yMin: -1.2, yMax: 5.5, zMin: -9, zMax: 0.5 });
  ambient.push(a);
  scene.add(a.obj);
}

// ---------- talking bubbles (only spawn while fish talks) ----------
const bubbleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
const talkBubbles = [];
const _mouth = new THREE.Vector3();
function spawnTalkBubble(fish) {
  fish.obj.userData.mouth.getWorldPosition(_mouth);
  const m = new THREE.Mesh(bubbleGeo, bubbleMat.clone());
  m.position.copy(_mouth).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.15));
  const s = 0.5 + Math.random() * 1.1;
  m.scale.setScalar(s);
  m.userData = { life: 0, max: 2 + Math.random() * 1.2, vy: 0.7 + Math.random() * 0.6, ph: Math.random() * 6, s };
  scene.add(m);
  talkBubbles.push(m);
}
function updateTalkBubbles(dt, t) {
  for (let i = talkBubbles.length - 1; i >= 0; i--) {
    const b = talkBubbles[i];
    const u = b.userData;
    u.life += dt;
    b.position.y += u.vy * dt;
    b.position.x += Math.sin(t * 3 + u.ph) * 0.4 * dt;
    b.material.opacity = Math.max(0, 0.85 * (1 - u.life / u.max));
    b.scale.setScalar(u.s * (1 + u.life * 0.25));
    if (u.life >= u.max) {
      scene.remove(b);
      b.material.dispose();
      talkBubbles.splice(i, 1);
    }
  }
}

// ---------- camera director ----------
const camPos = new THREE.Vector3(0, 3, 21);
const camLook = new THREE.Vector3(0, -0.5, 0);
let camFov = 46;
const pointer = { x: 0, y: 0 };
let focus = null; // TeacherFish | null

const DEG = Math.PI / 180;
function cameraTargets(t) {
  const portrait = window.innerWidth / window.innerHeight < 1;
  // orbit the camera ~10 degrees around the fish when it is talking, for a dynamic feel
  const az = focus ? 10 * DEG + Math.sin(t * 0.35) * 1.5 * DEG : Math.sin(t * 0.12) * 3 * DEG + pointer.x * 4 * DEG;
  const dist = focus ? (portrait ? 11 : 10.5) : portrait ? 30 : 21;
  const height = focus ? 0.9 : 3.0;
  const center = focus ? FRONT_POS : new THREE.Vector3(0, -0.3, 0);
  const pos = new THREE.Vector3(center.x + Math.sin(az) * dist, center.y + height + pointer.y * 0.3, center.z + Math.cos(az) * dist);
  const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
  const look = center.clone();
  if (focus) {
    if (portrait) look.y -= 1.7; // fish sits in the upper half, scroll below
    else look.addScaledVector(right, 2.6); // fish sits on the left, scroll on the right
  }
  return { pos, look, fov: focus ? 36 : 46 };
}
function updateCamera(dt, t) {
  const tg = cameraTargets(t);
  const k = 1 - Math.exp(-dt * (focus ? 1.9 : 1.5)); // slow, silky glide
  camPos.lerp(tg.pos, k);
  camLook.lerp(tg.look, k);
  camFov += (tg.fov - camFov) * k;
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  if (Math.abs(camera.fov - camFov) > 0.01) {
    camera.fov = camFov;
    camera.updateProjectionMatrix();
  }
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const bar = $('bar');
const scrollEl = $('scroll');
const chips = topics.map((tp) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = tp.chip;
  b.onclick = () => selectTopic(tp.id);
  bar.appendChild(b);
  return b;
});
const muteBtn = document.createElement('button');
muteBtn.className = 'chip icon';
muteBtn.textContent = '🔊';
muteBtn.onclick = () => {
  setMuted(!isMuted());
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
};
bar.appendChild(muteBtn);

let typing = null; // { full, shown, acc }
let openTimer = null;
let blipAcc = 0;

// ONE scroll per fish: title, a few bullet points, and a fish fact. It types itself out.
function renderScroll() {
  const tp = focus.topic;
  $('who').textContent = `${tp.name} says…`;
  $('ltitle').textContent = tp.title;
  const full = tp.points.map((p) => `• ${p}`).join('\n') + `\n\n🐟 ${tp.fishFact}`;
  typing = { full, shown: 0, acc: 0 };
  setTyped(0);
}
function setTyped(n) {
  const full = typing.full;
  const el = $('ltext');
  el.innerHTML = '';
  const a = document.createElement('span');
  a.textContent = full.slice(0, n);
  const b = document.createElement('span');
  b.className = 'hide';
  b.textContent = full.slice(n);
  el.append(a, b);
}

function selectTopic(id) {
  initAudio();
  const next = teachers.find((f) => f.topic.id === id);
  if (!next) return;
  if (focus === next) return;
  clearTimeout(openTimer);
  if (focus) {
    focus.goHome();
  }
  closeScroll();
  focus = next;
  next.goFront();
  sfxWhoosh();
  chips.forEach((c, i) => c.classList.toggle('active', topics[i].id === id));
  $('hint').style.opacity = 0;
  typing = null;
  openTimer = setTimeout(() => {
    if (focus !== next) return;
    sfxChime();
    scrollEl.classList.add('open');
    renderScroll();
  }, 1400);
}

function closeScroll() {
  scrollEl.classList.remove('open');
  typing = null;
}

function leave() {
  clearTimeout(openTimer);
  if (!focus) return;
  focus.goHome();
  focus = null;
  closeScroll();
  sfxWhoosh();
  chips.forEach((c) => c.classList.remove('active'));
  $('hint').style.opacity = 1;
}

$('done').onclick = leave;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') leave();
});

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
});

// click a fish to talk to it
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickFish(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(teachers.map((t) => t.obj), true);
  return hits.length ? hits[0].object.userData.teacher : null;
}
canvas.addEventListener('click', (e) => {
  const f = pickFish(e);
  if (f) selectTopic(f.topic.id);
});
canvas.addEventListener('pointermove', (e) => {
  canvas.style.cursor = pickFish(e) ? 'pointer' : 'default';
});

// start overlay (needed to unlock audio)
$('start').addEventListener('click', () => {
  initAudio();
  $('start').classList.add('gone');
});

// ---------- hand control (3 simple gestures) ----------
// point + hold = talk to fish | open palm held = done
const DWELL = 0.45;
const PALM_HOLD = 0.6;
const camVideo = $('cam');
const cursorEl = $('cursor');
const toastEl = $('toast');
let hands = null;
let handsOn = false;
let dwell = { id: null, t: 0 };
let palmT = 0;

function toast(msg, ms = 3500) {
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (toastEl.style.display = 'none'), ms);
}

const handBtn = document.createElement('button');
handBtn.className = 'chip icon';
handBtn.textContent = '🖐';
handBtn.title = 'Hand control (webcam)';
bar.appendChild(handBtn);
handBtn.onclick = async () => {
  initAudio();
  if (handsOn) {
    hands.stop();
    handsOn = false;
    camVideo.style.display = 'none';
    cursorEl.style.display = 'none';
    handBtn.classList.remove('active');
    return;
  }
  try {
    toast('Loading hand tracking… allow the camera 📷', 8000);
    if (!hands) {
      const { Hands } = await import('./hands.js');
      hands = new Hands(camVideo);
    }
    await Promise.race([
      hands.start(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('hand tracking timed out')), 25000))
    ]);
    handsOn = true;
    camVideo.style.display = 'block';
    handBtn.classList.add('active');
    toast('Hands on! Point at a fish and hold still 🐠', 4000);
  } catch (err) {
    console.warn(err);
    handsOn = false;
    toast('Camera or hand tracking unavailable. Mouse and touch still work!', 5000);
  }
};

// add data-id on chips for dwell targeting
chips.forEach((c, i) => (c.dataset.id = topics[i].id));

function handleHand(dt, nowSec, injected) {
  if (!handsOn && !injected) return;
  const s = injected || hands.poll(nowSec);
  if (!s.present) {
    cursorEl.style.display = 'none';
    dwell = { id: null, t: 0 };
    palmT = 0;
    return;
  }
  const px = s.x * window.innerWidth;
  const py = s.y * window.innerHeight;
  cursorEl.style.display = 'block';
  cursorEl.style.transform = `translate(${px}px, ${py}px)`;
  chips.forEach((c) => c.classList.remove('hover'));

  if (!focus) {
    // overview: dwell on a topic chip or a fish
    cursorEl.classList.remove('palm');
    let id = null;
    const el = document.elementFromPoint(px, py);
    const chip = el && el.closest && el.closest('.chip[data-id]');
    if (chip) {
      id = chip.dataset.id;
      chip.classList.add('hover');
    } else {
      const f = pickFish({ clientX: px, clientY: py });
      if (f) id = f.topic.id;
    }
    if (id && id === dwell.id) dwell.t += dt;
    else dwell = { id, t: 0 };
    cursorEl.style.setProperty('--p', id ? Math.min(dwell.t / DWELL, 1) : 0);
    if (id && dwell.t >= DWELL) {
      dwell = { id: null, t: 0 };
      selectTopic(id);
    }
    palmT = 0;
  } else {
    // focused: open palm to finish
    dwell = { id: null, t: 0 };
    if (s.openPalm && s.still) palmT += dt;
    else palmT = Math.max(0, palmT - dt * 2);
    cursorEl.classList.add('palm');
    cursorEl.style.setProperty('--p', Math.min(palmT / PALM_HOLD, 1));
    if (palmT >= PALM_HOLD) {
      palmT = 0;
      leave();
    }
  }
}

// ---------- resize + loop ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let bubbleAcc = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  world.update(t, dt);
  teachers.forEach((f) => f.update(dt, t));
  ambient.forEach((a) => a.update(dt, t));

  // typewriter: reveals only once the fish has arrived and scroll is open
  if (typing && focus && scrollEl.classList.contains('open')) {
    const arrived = focus.obj.position.distanceTo(FRONT_POS) < 0.5;
    if (arrived && typing.shown < typing.full.length) {
      typing.acc += dt * 48; // chars per second
      const n = Math.min(typing.full.length, Math.floor(typing.acc));
      if (n !== typing.shown) {
        typing.shown = n;
        setTyped(n);
        blipAcc += 1;
        if (blipAcc % 3 === 0) sfxBlip();
      }
      focus.talking = true;
    } else {
      focus.talking = false;
    }
  } else if (focus) {
    focus.talking = false;
  }

  // bubbles ONLY while talking
  if (focus && focus.talking) {
    bubbleAcc += dt * 7;
    while (bubbleAcc >= 1) {
      bubbleAcc -= 1;
      spawnTalkBubble(focus);
      if (Math.random() < 0.5) sfxBubble();
    }
  } else {
    bubbleAcc = 0;
  }
  updateTalkBubbles(dt, t);

  handleHand(dt, t);
  updateCamera(dt, t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

// handy for testing in the console
window.__aq = { selectTopic, leave, teachers, fakeHand: (s, secs = 1) => {
  // test helper: feed a synthetic hand state for `secs` seconds
  const end = performance.now() + secs * 1000;
  const iv = setInterval(() => {
    handleHand(1 / 60, clock.elapsedTime, { present: true, swipe: null, ...s });
    if (performance.now() > end) clearInterval(iv);
  }, 16);
}, get focus() { return focus; } };
