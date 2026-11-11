import * as THREE from 'three';
import { voxelMesh, voxMat } from './fish.js';

export const FLOOR_Y = -3;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const CORAL_COLORS = [0xff7eb6, 0xffa24d, 0xffd84d, 0xc08bff, 0x3eead0, 0xff7a7a, 0x6fd6ff];
const SAND = [0xffe8b8, 0xffdf9e, 0xfff3d0, 0xf9d9a0];

function tweak(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(0.95, Math.max(0.15, hsl.l + amt)));
  return c.getHex();
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const updaters = [];
  const d = new THREE.Object3D();

  // ---- Sand floor: small 0.5 tiles with gentle bumps ----
  const T = 0.5;
  const sandVox = [];
  for (let x = -20; x <= 20; x += T) {
    for (let z = -12; z <= 12; z += T) {
      const lump = Math.sin(x * 0.7) * Math.cos(z * 0.9) > 0.55 && z < 3.5 && Math.abs(x) % 9 > 1;
      sandVox.push({ x: x / T, y: (FLOOR_Y - T / 2) / T, z: z / T, c: tweak(pick(SAND), rnd(-0.03, 0.03)) });
      if (lump) sandVox.push({ x: x / T, y: (FLOOR_Y + T / 2) / T, z: z / T, c: tweak(pick(SAND), rnd(-0.03, 0.03)) });
    }
  }
  group.add(voxelMesh(sandVox, T));

  // ---- Corals: little branching voxel trees, 0.22 cubes ----
  const CV = 0.22;
  const coralVox = [];
  const coralSpot = () => {
    for (let tries = 0; tries < 20; tries++) {
      const x = rnd(-19, 19);
      const z = rnd(-11, 3.5);
      const behind = z < -3.6;
      const sides = Math.abs(x) > 14.5;
      if (behind || sides) return [x, z];
    }
    return [rnd(-19, -15), -6];
  };
  for (let n = 0; n < 46; n++) {
    const [x0, z0] = coralSpot();
    const col = pick(CORAL_COLORS);
    const ox = Math.round(x0 / CV);
    const oz = Math.round(z0 / CV);
    const baseY = Math.round(FLOOR_Y / CV);
    const h = 5 + Math.floor(Math.random() * 8);
    const branches = [];
    for (let y = 0; y < h; y++) {
      const shade = tweak(col, y * 0.012);
      for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) coralVox.push({ x: ox + dx, y: baseY + y, z: oz + dz, c: shade });
      if (y > 2 && Math.random() < 0.45) branches.push({ y, s: Math.random() < 0.5 ? -1 : 1 });
    }
    branches.forEach((b) => {
      const len = 2 + Math.floor(Math.random() * 3);
      for (let k = 1; k <= len; k++) {
        const bx = ox + (b.s > 0 ? 1 + k : -k);
        coralVox.push({ x: bx, y: baseY + b.y + Math.floor(k / 2), z: oz, c: tweak(col, 0.05) });
        coralVox.push({ x: bx, y: baseY + b.y + Math.floor(k / 2), z: oz + 1, c: tweak(col, 0.05) });
      }
    });
    // cute round "bud" on top
    coralVox.push({ x: ox, y: baseY + h, z: oz, c: tweak(col, 0.12) });
    coralVox.push({ x: ox + 1, y: baseY + h, z: oz + 1, c: tweak(col, 0.12) });
  }
  group.add(voxelMesh(coralVox, CV));

  // ---- Seaweed (sways) ----
  const weedGeo = new THREE.BoxGeometry(0.16, 0.2, 0.16);
  for (let n = 0; n < 44; n++) {
    const [x, z] = coralSpot();
    const g = new THREE.Group();
    const h = 7 + Math.floor(Math.random() * 9);
    const col = pick([0x4be39a, 0x34d97c, 0x8bf079]);
    for (let y = 0; y < h; y++) {
      const m = new THREE.Mesh(weedGeo, voxMat(tweak(col, y * 0.004)));
      m.position.y = y * 0.2 + 0.1;
      g.add(m);
    }
    g.position.set(x, FLOOR_Y, z);
    const ph = Math.random() * 6;
    const sp = rnd(0.8, 1.4);
    group.add(g);
    updaters.push((t) => {
      g.rotation.z = Math.sin(t * sp + ph) * 0.14;
      g.rotation.x = Math.cos(t * sp * 0.8 + ph) * 0.08;
    });
  }

  // ---- Homes: rounded voxel burrows on the sea bed ----
  const CELL = 0.3;
  const W = 26;
  const H = 15;
  const D = 6;
  const homeDefs = [
    { x: -9, color: 0xff7eb6, trim: 0xffd0e6 },
    { x: 0, color: 0x3eead0, trim: 0xc9fff4 },
    { x: 9, color: 0xc08bff, trim: 0xeed9ff }
  ];
  const homes = homeDefs.map((hd) => {
    const vox = [];
    const cx = (W - 1) / 2;
    const rx = 8.2;
    const ry = 9.2;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        for (let z = 0; z < D; z++) {
          // outer dome (half-ellipse)
          const ox = (x - cx) / (W / 2);
          const inDome = ox * ox + (y / H) * (y / H) <= 1;
          if (!inDome) continue;
          // hollow opening (rounded doorway), open to the front (+z), back wall at z = 0
          const ix = (x - cx) / rx;
          const iy = y / ry;
          const inOpening = ix * ix + iy * iy < 1;
          if (inOpening && z > 0) continue;
          let c;
          if (inOpening) c = 0x2a3a6b; // dark back wall
          else {
            const onRim = (ix * ix + iy * iy) < 1.25 && z >= D - 1;
            c = onRim ? hd.trim : tweak(hd.color, rnd(-0.05, 0.05));
          }
          vox.push({ x, y, z, c });
        }
      }
    }
    // cute decorations on top: little pastel pebbles / flower
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(cx + rnd(-4, 4));
      vox.push({ x, y: H - 3 - Math.floor(Math.abs(x - cx) * 0.9), z: 1 + Math.floor(Math.random() * 3), c: pick([0xffffff, 0xffe86b, hd.trim]) });
    }
    const mesh = voxelMesh(vox, CELL);
    mesh.position.set(hd.x - (cx * CELL), FLOOR_Y + CELL / 2, -2.2 - D * CELL * 0.5);
    group.add(mesh);

    const midZ = -2.2 - D * CELL * 0.5 + (D * CELL) / 2 - 0.2; // inside, just in front of back wall
    return {
      x: hd.x,
      entrance: new THREE.Vector3(hd.x, FLOOR_Y + 1.25, 0.6),
      inside: new THREE.Vector3(hd.x, FLOOR_Y + 1.25, midZ + 0.05)
    };
  });

  // ---- Light shafts ----
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  for (let n = 0; n < 7; n++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rnd(1.5, 3), 28), shaftMat.clone());
    m.position.set(-16 + n * 5.5 + rnd(-1, 1), 5, rnd(-10, -4));
    m.rotation.z = -0.28;
    group.add(m);
    const ph = Math.random() * 6;
    updaters.push((t) => {
      m.material.opacity = 0.045 + Math.sin(t * 0.5 + ph) * 0.025;
    });
  }

  // ---- Ambient rising bubbles (instanced) ----
  const bubCount = 80;
  const bubbles = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    bubCount
  );
  const seeds = Array.from({ length: bubCount }, () => ({
    x: rnd(-16, 16),
    z: rnd(-9, 6),
    y: rnd(FLOOR_Y, 10),
    s: rnd(0.4, 1.1),
    sc: rnd(0.6, 1.6),
    ph: Math.random() * 6
  }));
  group.add(bubbles);
  updaters.push((t, dt) => {
    seeds.forEach((b, idx) => {
      b.y += b.s * dt;
      if (b.y > 10) b.y = FLOOR_Y;
      d.position.set(b.x + Math.sin(t + b.ph) * 0.25, b.y, b.z);
      d.scale.setScalar(b.sc);
      d.updateMatrix();
      bubbles.setMatrixAt(idx, d.matrix);
    });
    bubbles.instanceMatrix.needsUpdate = true;
  });

  return {
    homes,
    floorY: FLOOR_Y,
    update(t, dt) {
      updaters.forEach((u) => u(t, dt));
    }
  };
}
