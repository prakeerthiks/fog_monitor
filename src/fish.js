import * as THREE from 'three';

const VS = 0.2; // voxel size
const boxGeo = new THREE.BoxGeometry(VS * 0.96, VS * 0.96, VS * 0.96);
const matCache = new Map();
export function voxMat(color) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}
export { boxGeo, VS };

// Side profiles, head faces RIGHT (+x). Uppercase = chunky body, lowercase = thin fin, E = eye.
const SPECIES = {
  clown: {
    depth: 3,
    rows: [
      '....ffff.....',
      '..OOOWOOOWOO.',
      'fOOOOWOOOWOOO',
      'ffOOOWOOOWOEO',
      'fOOOOWOOOWOOO',
      '..OOOWOOOWOO.',
      '....ff.ff....'
    ],
    colors: { O: 0xff8a1f, W: 0xffffff, f: 0xff5a3c, E: 0xff8a1f }
  },
  puffer: {
    depth: 5,
    rows: [
      '...YYYYYY...',
      '..YYYYYYYYY.',
      'fYYYYYYYYEYY',
      'fYYYYYYYYYYY',
      '..CCCCCCCCC.',
      '...CCCCCC...'
    ],
    colors: { Y: 0xffd23f, C: 0xfff1c9, f: 0xff9f1c, E: 0xffd23f }
  },
  angel: {
    depth: 3,
    rows: [
      '....f......',
      '...fBB.....',
      '..BBByBB...',
      '.BBBByBBBB.',
      'fBBByBBBEBB',
      '.BBBByBBBB.',
      '..BBByBB...',
      '...fBB.....',
      '....f......'
    ],
    colors: { B: 0x3ea6ff, y: 0xffe14d, f: 0xb06bff, E: 0x3ea6ff }
  }
};

export function buildFish(kind, tint = null, scale = 1) {
  const sp = SPECIES[kind];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const h = sp.rows.length;
  const w = Math.max(...sp.rows.map((r) => r.length));
  const tintCol = tint !== null ? new THREE.Color(tint) : null;

  sp.rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const isFin = ch >= 'a' && ch <= 'z';
      const isEye = ch === 'E';
      let hex = sp.colors[ch];
      let col = new THREE.Color(hex);
      if (tintCol && (ch === 'O' || ch === 'Y' || ch === 'B' || ch === 'E')) col = tintCol.clone();
      const mat = voxMat(col.getHex());
      const layers = isFin ? [0] : range(sp.depth);
      layers.forEach((z) => {
        const edge = !isFin && Math.abs(z) === (sp.depth - 1) / 2;
        const m = new THREE.Mesh(boxGeo, isEye && edge ? voxMat(0x101820) : mat);
        m.position.set((c - w / 2) * VS, (h / 2 - r) * VS, z * VS);
        body.add(m);
      });
    }
  });

  // mouth anchor (where speech bubbles come out)
  const mouth = new THREE.Object3D();
  mouth.position.set((w / 2 + 0.4) * VS, -0.2 * VS, 0);
  body.add(mouth);
  root.userData = { body, mouth, length: w * VS };
  root.scale.setScalar(scale);
  return root;
}

function range(n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i - (n - 1) / 2);
  return a;
}

const FRONT = new THREE.Vector3(0, -0.2, 5.5);

// A teacher fish: lives at `home`, swims to the front when selected.
export class TeacherFish {
  constructor(kind, home, scale = 1.2) {
    this.kind = kind;
    this.obj = buildFish(kind, null, scale);
    this.home = home.clone();
    this.state = 'home'; // 'home' | 'front'
    this.talking = false;
    this.heading = 0;
    this.obj.position.copy(this.home);
    this.obj.rotation.y = 0;
    this.phase = Math.random() * 10;
    this.vel = new THREE.Vector3();
    this.obj.traverse((o) => (o.userData.teacher = this));
  }
  goFront() {
    this.state = 'front';
  }
  goHome() {
    this.state = 'home';
    this.talking = false;
  }
  update(dt, t) {
    const p = this.obj.position;
    const prev = p.clone();
    let target;
    let k;
    if (this.state === 'front') {
      target = FRONT.clone();
      target.y += Math.sin(t * 1.4 + this.phase) * 0.06;
      k = 1.9;
    } else {
      // tucked in near the cave, gentle hover
      target = this.home.clone();
      target.x += Math.sin(t * 0.6 + this.phase) * 0.5;
      target.y += Math.sin(t * 1.1 + this.phase) * 0.12;
      k = 1.6;
    }
    p.lerp(target, 1 - Math.exp(-dt * k));
    this.vel.copy(p).sub(prev);

    // heading
    let targetHeading;
    if (this.state === 'front') {
      targetHeading = this.vel.length() > 0.004 ? headingFromVel(this.vel) : -0.55;
      if (p.distanceTo(FRONT) < 0.6) targetHeading = -0.55;
    } else {
      targetHeading = Math.cos(t * 0.6 + this.phase) >= 0 ? 0 : Math.PI;
      if (this.vel.length() > 0.01) targetHeading = headingFromVel(this.vel);
    }
    this.heading = lerpAngle(this.heading, targetHeading, 1 - Math.exp(-dt * 3));
    this.obj.rotation.y = this.heading;

    // tail wiggle / mouth chatter
    const speed = this.vel.length() / Math.max(dt, 0.001);
    const wig = 0.12 + Math.min(speed * 0.1, 0.25);
    this.obj.userData.body.rotation.y = Math.sin(t * 7 + this.phase) * wig;
    this.obj.userData.body.rotation.z = Math.sin(t * 2.2 + this.phase) * 0.04;
    const talkPulse = this.talking ? 1 + Math.abs(Math.sin(t * 14)) * 0.05 : 1;
    this.obj.userData.body.scale.setScalar(talkPulse);
  }
}

function headingFromVel(v) {
  // body faces +x; rotating by theta about y maps +x -> (cos, 0, -sin)
  return Math.atan2(-v.z, v.x);
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Small background swimmers for life
export class AmbientFish {
  constructor(kind, color, bounds) {
    this.obj = buildFish(kind, color, 0.55 + Math.random() * 0.35);
    this.bounds = bounds;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.speed = 0.5 + Math.random() * 0.9;
    this.baseY = bounds.yMin + Math.random() * (bounds.yMax - bounds.yMin);
    this.phase = Math.random() * 10;
    this.obj.position.set(
      bounds.xMin + Math.random() * (bounds.xMax - bounds.xMin),
      this.baseY,
      bounds.zMin + Math.random() * (bounds.zMax - bounds.zMin)
    );
    this.obj.rotation.y = this.dir > 0 ? 0 : Math.PI;
  }
  update(dt, t) {
    const p = this.obj.position;
    p.x += this.dir * this.speed * dt;
    p.y = this.baseY + Math.sin(t * 0.9 + this.phase) * 0.35;
    if (p.x > this.bounds.xMax) this.dir = -1;
    if (p.x < this.bounds.xMin) this.dir = 1;
    const target = this.dir > 0 ? 0 : Math.PI;
    this.obj.rotation.y = lerpAngle(this.obj.rotation.y, target, 1 - Math.exp(-dt * 2.5));
    this.obj.userData.body.rotation.y = Math.sin(t * 8 + this.phase) * 0.18;
  }
}

export const FRONT_POS = FRONT;
