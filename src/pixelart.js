// Crisp pixel art for the start card (Praky's Arcade: the world is pixels). Nearest-neighbour only.
const PAL = {
  o: '#040606', // pixel-outline
  w: '#ffffff',
  s: '#bfebf4', // pixel-cloud
  d: '#52a6c8', // pixel-cloud-shade
  g: '#00c49c', // pixel-teal
  G: '#007d2a', // pixel-grass
  e: '#040606',
  b: '#bfebf4',
  y: '#f7e05a', // pixel-sun
  p: '#fc85ff', // pixel-flower
  P: '#2e1b5b' // pixel-plum
};

const DINO = [
  '.............ooooo..',
  '............ogggggo.',
  '............ogeggggo',
  '............oggggggo',
  '............ogggoooo',
  'o...........oggggo..',
  'ogo.......ooggggo...',
  '.oggoooooogggggo....',
  '..oggggggggggggo..oo',
  '...ogggggggggggoo.go',
  '....oggbbbgggggggogo',
  '.....oggbbbggggggo..',
  '......oggooggggo....',
  '......ogo..ogo......',
  '......ooo..ooo......'
];

const CLOUD = [
  '....oooo.......',
  '...owwwwoo.oo..',
  '..owwwwwwowwwo.',
  '.owwwwwwwwwwwwo',
  'owwwwwwwwwwsssd',
  '.ooosssssssdddo',
  '.....oooooooo..'
];

function sprite(ctx, rows, x, y, u) {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      ctx.fillStyle = PAL[ch] || '#000';
      ctx.fillRect(Math.round(x + c * u), Math.round(y + r * u), u, u);
    }
  });
}

export function drawStart(canvas) {
  const dpr = 1;
  const W = (canvas.width = Math.ceil(window.innerWidth / 4) * 4 * dpr);
  const H = (canvas.height = Math.ceil(window.innerHeight / 4) * 4 * dpr);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  const u = Math.max(4, Math.round(Math.min(W, H) / 90)) ; // pixel unit

  // clouds, top corners
  sprite(ctx, CLOUD, W * 0.03, H * 0.05, u * 1.5 | 0);
  sprite(ctx, CLOUD, W * 0.9 - 15 * u, H * 0.08, u);
  sprite(ctx, CLOUD, W * 0.76, H * 0.02, u);

  // grass strip along the bottom
  const rows = 6;
  const gh = rows * u;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < W; x += u) {
    ctx.fillStyle = PAL.G;
    ctx.fillRect(x, H - gh, u, gh - u);
    ctx.fillStyle = PAL.P;
    ctx.fillRect(x, H - u, u, u);
    const r = rnd();
    if (r < 0.1) { ctx.fillStyle = PAL.g; ctx.fillRect(x, H - gh + u * Math.floor(rnd() * 3), u, u); }
    else if (r < 0.14) { ctx.fillStyle = PAL.p; ctx.fillRect(x, H - gh + u * Math.floor(rnd() * 3), u, u); }
    else if (r < 0.18) { ctx.fillStyle = '#0087fe'; ctx.fillRect(x, H - gh + u * Math.floor(rnd() * 3), u, u); }
    if (rnd() < 0.12) { ctx.fillStyle = PAL.g; ctx.fillRect(x, H - gh - u, u, u); }
  }
  return { u, W, H };
}

// A walking pixel dino for the lavender blob (drawn to its own small canvas)
export function drawDino(canvas, u = 9) {
  canvas.width = DINO[0].length * u;
  canvas.height = DINO.length * u;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  sprite(ctx, DINO, 0, 0, u);
}
