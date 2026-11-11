import * as THREE from 'three';

export const VS = 0.1; // voxel size (smaller = more detail)
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const lambert = new THREE.MeshLambertMaterial({ color: 0xffffff });
const matCache = new Map();
export function voxMat(color) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}

// Turn a list of {x,y,z,c} voxels into ONE instanced mesh (fast, even with thousands of voxels).
export function voxelMesh(vox, size) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size * 0.97, size * 0.97, size * 0.97), lambert, vox.length);
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  vox.forEach((v, i) => {
    d.position.set(v.x * size, v.y * size, v.z * size);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
    mesh.setColorAt(i, col.set(v.c));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// Side profiles (head faces RIGHT). Uppercase = chubby body, lowercase = thin fin,
// E = big sparkly eye, P = rosy blush cheek. Profiles are doubled in resolution when built.
const SPECIES = {
  clown: {
    maxHalf: 3,
    rows: [
      '....ffff.....',
      '..OOOWOOOWOO.',
      'fOOOOWOOOWOOO',
      'ffOOOWOOOWOEO',
      'fOOOOWOOOWOPO',
      '..OOOWOOOWOO.',
      '....ff.ff....'
    ],
    colors: { O: 0xff9a3c, W: 0xffffff, f: 0xff6b6b, E: 0xff9a3c, P: 0xff9a3c }
  },
  puffer: {
    maxHalf: 4,
    rows: [
      '...YYYYYY...',
      '..YYYYYYYYY.',
      'fYYYYYYYYEYY',
      'fYYYYYYYYPYY',
      '..CCCCCCCCC.',
      '...CCCCCC...'
    ],
    colors: { Y: 0xffd84d, C: 0xfff4d1, f: 0xffa94d, E: 0xffd84d, P: 0xffd84d }
  },
  angel: {
    maxHalf: 2,
    rows: [
      '....f......',
      '...fBB.....',
      '..BBByBB...',
      '.BBBByBBBB.',
      'fBBByBBBEBB',
      '.BBBByBBPB.',
      '..BBByBB...',
      '...fBB.....',
      '....f......'
    ],
    colors: { B: 0x4fb4ff, y: 0xffe86b, f: 0xc08bff, E: 0x4fb4ff, P: 0x4fb4ff }
  }
};

const EYE_WHITE = 0xffffff;
const EYE_DARK = 0x1d1b3a;
const BLUSH = 0xff7fb0;

export function buildFish(kind, tint = null, targetSize = 1.9) {
  const sp = SPECIES[kind];
  // 1) double the resolution so voxels are smaller
  const S = 2;
  const grid = [];
  sp.rows.forEach((row) => {
    const big = [];
    for (let k = 0; k < S; k++) {
      let line = '';
      for (const ch of row) line += ch.repeat(S);
      big.push(line);
    }
    big.forEach((l) => grid.push(l.split('')));
  });
  const h = grid.length;
  const w = Math.max(...grid.map((r) => r.length));
  const at = (r, c) => (r < 0 || r >= h || c < 0 || c >= grid[r].length ? '.' : grid[r][c]);

  const tintHex = tint !== null ? tint : null;
  const colorOf = (ch) => {
    const hex = sp.colors[ch];
    if (tintHex !== null && 'OYBEP'.includes(ch)) return tintHex;
    return hex;
  };

  // 2) chubby rounded body: thickness depends on distance from the silhouette edge
  const vox = new Map();
  const put = (x, y, z, c) => vox.set(`${x},${y},${z}`, c);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c];
      if (ch === '.') continue;
      const isFin = ch >= 'a' && ch <= 'z';
      let k = 1;
      for (; k < 6; k++) {
        let empty = false;
        for (let dr = -k; dr <= k && !empty; dr++)
          for (let dc = -k; dc <= k; dc++) {
            if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
            if (at(r + dr, c + dc) === '.') {
              empty = true;
              break;
            }
          }
        if (empty) break;
      }
      const hz = isFin ? 0 : Math.min(sp.maxHalf, k - 1);
      const x = c - w / 2;
      const y = h / 2 - r;
      const base = colorOf(ch);
      for (let z = -hz; z <= hz; z++) {
        let col = base;
        const outer = Math.abs(z) === hz && !isFin;
        if (outer && ch === 'E') {
          // 2x2 sparkly eye: one white highlight, rest dark
          col = r % 2 === 0 && c % 2 === 0 ? EYE_WHITE : EYE_DARK;
        } else if (outer && ch === 'P') {
          col = BLUSH;
        } else if (!isFin && z === hz - 0 && hz > 0 && (ch === 'O' || ch === 'Y' || ch === 'B')) {
          // slightly lighter skin on the very top layers = soft shading
          col = base;
        }
        put(x, y, z, col);
      }
    }
  }

  // 3) skip fully buried voxels (they are never seen)
  const list = [];
  vox.forEach((c, key) => {
    const [x, y, z] = key.split(',').map(Number);
    const buried =
      vox.has(`${x + 1},${y},${z}`) && vox.has(`${x - 1},${y},${z}`) &&
      vox.has(`${x},${y + 1},${z}`) && vox.has(`${x},${y - 1},${z}`) &&
      vox.has(`${x},${y},${z + 1}`) && vox.has(`${x},${y},${z - 1}`);
    if (!buried) list.push({ x, y, z, c });
  });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(voxelMesh(list, VS));

  const mouth = new THREE.Object3D();
  mouth.position.set((w / 2 + 0.5) * VS, -0.3 * VS, 0);
  body.add(mouth);

  // same relative size for every fish: scale by sqrt(width*height)
  const norm = targetSize / (Math.sqrt(w * h) * VS);
  root.scale.setScalar(norm);
  root.userData = { body, mouth, width: w * VS * norm, height: h * VS * norm };
  return root;
}

// ---- Teacher fish: swims in one plane, comes to a front plane, dives into its cave ----
export const FRONT_POS = new THREE.Vector3(0, 1.5, 5.5);
const SWIM_Z = 2.5;
const SWIM_Y = 3.7;

export class TeacherFish {
  constructor(kind, home, targetSize = 1.9) {
    this.kind = kind;
    this.obj = buildFish(kind, null, targetSize);
    this.home = home; // {x, entrance, inside}
    this.state = 'swim'; // 'swim' | 'front' | 'home'
    this.path = [];
    this.talking = false;
    this.heading = 0;
    this.faceLeft = false;
    this.phase = Math.random() * 10;
    this.vel = new THREE.Vector3();
    this.obj.position.set(home.x, SWIM_Y, SWIM_Z);
    this.obj.traverse((o) => (o.userData.teacher = this));
  }
  goFront() {
    this.state = 'front';
    this.talking = false;
    const atHome = this.obj.position.z < 1.2 && this.obj.position.y < this.home.entrance.y + 0.8;
    this.path = atHome ? [this.home.entrance.clone(), FRONT_POS.clone()] : [FRONT_POS.clone()];
  }
  goHome() {
    this.state = 'home';
    this.talking = false;
    this.path = [this.home.entrance.clone(), this.home.inside.clone()];
  }
  update(dt, t) {
    const p = this.obj.position;
    let target;
    let maxSpeed = 5;
    if (this.state === 'swim') {
      target = new THREE.Vector3(this.home.x + Math.sin(t * 0.45 + this.phase) * 2.6, SWIM_Y + Math.sin(t * 0.9 + this.phase) * 0.3, SWIM_Z);
      maxSpeed = 3;
    } else {
      target = this.path[0] || (this.state === 'front' ? FRONT_POS : this.home.inside);
      if (this.path.length > 1 && p.distanceTo(target) < 0.45) {
        this.path.shift();
        target = this.path[0];
      }
    }
    const dir = target.clone().sub(p);
    const dist = dir.length();
    const want = dist > 0.001 ? dir.normalize().multiplyScalar(Math.min(maxSpeed, dist * 2.0)) : new THREE.Vector3();
    this.vel.lerp(want, 1 - Math.exp(-dt * 4));
    p.addScaledVector(this.vel, dt);

    // gentle bob once settled
    let bob = 0;
    if (this.state === 'front') bob = Math.sin(t * 1.6 + this.phase) * 0.05;
    if (this.state === 'home') bob = Math.sin(t * 1.2 + this.phase) * 0.04;

    // heading: ALWAYS a clean side profile (never angled toward the camera)
    if (this.state === 'front' && dist < 1.5) this.faceLeft = false;
    else if (this.state === 'home' && this.path.length <= 1) this.faceLeft = false;
    else if (this.vel.x < -0.25) this.faceLeft = true;
    else if (this.vel.x > 0.25) this.faceLeft = false;
    const targetHeading = this.faceLeft ? Math.PI : 0;
    this.heading = lerpAngle(this.heading, targetHeading, 1 - Math.exp(-dt * 5));
    this.obj.rotation.y = this.heading;
    this.obj.position.y += bob * dt * 10;

    // tail wiggle + talking chatter
    const speed = this.vel.length();
    const wig = 0.07 + Math.min(speed * 0.04, 0.1);
    this.obj.userData.body.rotation.y = Math.sin(t * 7 + this.phase) * wig;
    this.obj.userData.body.rotation.z = Math.sin(t * 2.2 + this.phase) * 0.03;
    const pulse = this.talking ? 1 + Math.abs(Math.sin(t * 14)) * 0.04 : 1;
    this.obj.userData.body.scale.setScalar(pulse);
  }
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Small background swimmers for life
export class AmbientFish {
  constructor(kind, color, bounds) {
    this.obj = buildFish(kind, color, 0.7 + Math.random() * 0.5);
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
    p.y = this.baseY + Math.sin(t * 0.9 + this.phase) * 0.3;
    if (p.x > this.bounds.xMax) this.dir = -1;
    if (p.x < this.bounds.xMin) this.dir = 1;
    const target = this.dir > 0 ? 0 : Math.PI;
    this.obj.rotation.y = lerpAngle(this.obj.rotation.y, target, 1 - Math.exp(-dt * 2.5));
    this.obj.userData.body.rotation.y = Math.sin(t * 8 + this.phase) * 0.12;
  }
}
