import * as THREE from 'three';
import { voxMat } from './fish.js';

const FLOOR_Y = -3;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const CORAL_COLORS = [0xff5fa2, 0xff8a3d, 0xffd23f, 0xb06bff, 0x2ee6c5, 0xff6b6b, 0x5ad1ff];
const SAND = [0xffe2a8, 0xffd68a, 0xfff0c4, 0xf7c98b];

export function buildWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const updaters = [];

  // ---- Sand floor (instanced) ----
  const xs = [-15, 15];
  const zs = [-10, 9];
  const tiles = [];
  for (let x = xs[0]; x <= xs[1]; x++) {
    for (let z = zs[0]; z <= zs[1]; z++) {
      const bump = Math.random() < 0.18 && z < 4 ? 1 : 0;
      tiles.push({ x, z, bump });
    }
  }
  const floorGeo = new THREE.BoxGeometry(1, 1, 1);
  const floor = new THREE.InstancedMesh(floorGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), tiles.length * 2);
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  let i = 0;
  tiles.forEach((t) => {
    d.position.set(t.x, FLOOR_Y - 0.5, t.z);
    d.updateMatrix();
    floor.setMatrixAt(i, d.matrix);
    floor.setColorAt(i, c.set(pick(SAND)));
    i++;
    if (t.bump) {
      d.position.set(t.x, FLOOR_Y + 0.5, t.z);
      d.updateMatrix();
      floor.setMatrixAt(i, d.matrix);
      floor.setColorAt(i, c.set(pick(SAND)));
      i++;
    }
  });
  floor.count = i;
  group.add(floor);

  // ---- Corals ----
  const coralGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const coralSpots = [];
  for (let n = 0; n < 34; n++) {
    const x = rnd(-14, 14);
    const z = rnd(-9, 2.5);
    // keep the front-center stage clear
    if (Math.abs(x) < 3 && z > 0) continue;
    coralSpots.push([x, z]);
  }
  coralSpots.forEach(([x, z]) => {
    const col = pick(CORAL_COLORS);
    const g = new THREE.Group();
    const h = 2 + Math.floor(Math.random() * 4);
    for (let y = 0; y < h; y++) {
      const m = new THREE.Mesh(coralGeo, voxMat(col));
      m.position.set(0, y * 0.5 + 0.25, 0);
      g.add(m);
      if (y > 0 && Math.random() < 0.6) {
        const s = Math.random() < 0.5 ? -1 : 1;
        const b = new THREE.Mesh(coralGeo, voxMat(col));
        b.position.set(s * 0.5, y * 0.5 + 0.25, 0);
        g.add(b);
        if (Math.random() < 0.5) {
          const b2 = new THREE.Mesh(coralGeo, voxMat(col));
          b2.position.set(s * 0.5, y * 0.5 + 0.75, 0);
          g.add(b2);
        }
      }
    }
    g.position.set(Math.round(x), FLOOR_Y, Math.round(z));
    group.add(g);
  });

  // ---- Seaweed (sways) ----
  const weedGeo = new THREE.BoxGeometry(0.28, 0.4, 0.28);
  for (let n = 0; n < 32; n++) {
    const x = rnd(-14, 14);
    const z = rnd(-9, 3);
    if (Math.abs(x) < 3 && z > 0) continue;
    const g = new THREE.Group();
    const h = 4 + Math.floor(Math.random() * 5);
    const col = pick([0x39d98a, 0x2ecf6e, 0x7be36b]);
    for (let y = 0; y < h; y++) {
      const m = new THREE.Mesh(weedGeo, voxMat(col));
      m.position.y = y * 0.4 + 0.2;
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

  // ---- Homes (caves) ----
  const homeDefs = [
    { x: -6.5, color: 0xff5fa2 },
    { x: 0, color: 0x2ee6c5 },
    { x: 6.5, color: 0xb06bff }
  ];
  const homes = homeDefs.map((hd) => {
    const g = new THREE.Group();
    const rock = (px, py, pz, sx, sy, sz, col) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), voxMat(col));
      m.position.set(px, py, pz);
      g.add(m);
    };
    const dark = 0x1a2a4a;
    rock(0, 0.6, -0.9, 3.2, 1.2, 0.6, dark); // dark interior
    rock(-1.5, 0.9, 0, 0.9, 1.8, 1.4, hd.color); // left pillar
    rock(1.5, 0.9, 0, 0.9, 1.8, 1.4, hd.color); // right pillar
    rock(0, 2.1, 0, 3.9, 0.7, 1.4, hd.color); // lintel
    rock(-0.9, 2.7, 0, 1.2, 0.5, 1.0, 0xffffff); // little cap accents
    rock(1.0, 2.65, 0, 0.8, 0.4, 0.9, hd.color);
    g.position.set(hd.x, FLOOR_Y, -1.2);
    group.add(g);
    // fish "home" hover point, in front of the cave mouth
    return new THREE.Vector3(hd.x, FLOOR_Y + 1.1, 0.2);
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
  for (let n = 0; n < 6; n++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rnd(1.5, 3), 24), shaftMat.clone());
    m.position.set(-12 + n * 5 + rnd(-1, 1), 4, rnd(-8, -3));
    m.rotation.z = -0.28;
    group.add(m);
    const ph = Math.random() * 6;
    updaters.push((t) => {
      m.material.opacity = 0.045 + Math.sin(t * 0.5 + ph) * 0.025;
      m.position.x += Math.sin(t * 0.2 + ph) * 0.002;
    });
  }

  // ---- Ambient rising bubbles (instanced) ----
  const bubCount = 70;
  const bubGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const bubMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  const bubbles = new THREE.InstancedMesh(bubGeo, bubMat, bubCount);
  const seeds = Array.from({ length: bubCount }, () => ({
    x: rnd(-14, 14),
    z: rnd(-8, 6),
    y: rnd(FLOOR_Y, 9),
    s: rnd(0.4, 1.1),
    sc: rnd(0.6, 1.5),
    ph: Math.random() * 6
  }));
  group.add(bubbles);
  updaters.push((t, dt) => {
    seeds.forEach((b, idx) => {
      b.y += b.s * dt;
      if (b.y > 9) b.y = FLOOR_Y;
      d.position.set(b.x + Math.sin(t + b.ph) * 0.25, b.y, b.z);
      d.scale.setScalar(b.sc);
      d.rotation.set(0, 0, 0);
      d.updateMatrix();
      bubbles.setMatrixAt(idx, d.matrix);
    });
    bubbles.instanceMatrix.needsUpdate = true;
  });
  d.scale.setScalar(1);

  return {
    homes,
    floorY: FLOOR_Y,
    update(t, dt) {
      updaters.forEach((u) => u(t, dt));
    }
  };
}
