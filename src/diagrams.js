// Tiny SVG diagram renderer: flow, hub and stack. Nodes pop in one by one.
const W = 400;
const H = 130;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function node(x, y, w, h, [icon, label], i, hot = false) {
  const delay = (i * 0.28).toFixed(2);
  return `
  <g class="dg-node" style="animation-delay:${delay}s; transform-origin:${x + w / 2}px ${y + h / 2}px">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${hot ? '#ffd23f' : '#ffffff'}" stroke="${hot ? '#e0a400' : '#e6c987'}" stroke-width="3"/>
    <text x="${x + w / 2}" y="${y + h / 2 - 2}" text-anchor="middle" font-size="22">${icon}</text>
    <text x="${x + w / 2}" y="${y + h / 2 + 17}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#3b2a1a">${esc(label)}</text>
  </g>`;
}

function arrow(x1, y1, x2, y2, i) {
  const delay = (i * 0.28 + 0.15).toFixed(2);
  return `<line class="dg-line" style="animation-delay:${delay}s" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c2571a" stroke-width="3" stroke-linecap="round" marker-end="url(#ah)"/>`;
}

function flow(d) {
  const n = d.nodes.length;
  const gap = 24;
  const bw = (W - 20 - gap * (n - 1)) / n;
  const y = 22;
  const bh = 62;
  let out = '';
  d.nodes.forEach((nd, i) => {
    const x = 10 + i * (bw + gap);
    out += node(x, y, bw, bh, nd, i, d.highlight === i);
    if (i < n - 1) out += arrow(x + bw + 3, y + bh / 2, x + bw + gap - 3, y + bh / 2, i);
  });
  if (d.loop) {
    const fx = 10 + d.loop.from * (bw + gap) + bw / 2;
    const tx = 10 + d.loop.to * (bw + gap) + bw / 2;
    const yb = y + bh;
    out += `<path class="dg-line" style="animation-delay:${(n * 0.28).toFixed(2)}s" d="M ${fx} ${yb + 3} C ${fx} ${yb + 38}, ${tx} ${yb + 38}, ${tx} ${yb + 5}" fill="none" stroke="#c2571a" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 6" marker-end="url(#ah)"/>`;
    out += `<text x="${(fx + tx) / 2}" y="${yb + 40}" text-anchor="middle" font-size="12" font-weight="800" fill="#c2571a">${esc(d.loop.label || 'repeat')}</text>`;
  }
  return out;
}

function hub(d) {
  const cx = W / 2;
  const cy = H / 2;
  const spots = [[10, 8], [W - 110, 8], [10, H - 62], [W - 110, H - 62]];
  let out = '';
  d.nodes.forEach((nd, i) => {
    const [x, y] = spots[i];
    out += `<line class="dg-line" style="animation-delay:${(i * 0.28 + 0.1).toFixed(2)}s" x1="${cx}" y1="${cy}" x2="${x + 50}" y2="${y + 27}" stroke="#c2571a" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>`;
  });
  out += `<g class="dg-node" style="transform-origin:${cx}px ${cy}px">
    <circle cx="${cx}" cy="${cy}" r="38" fill="#ffd23f" stroke="#e0a400" stroke-width="3"/>
    <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="26">${d.center[0]}</text>
    <text x="${cx}" y="${cy + 20}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#5a3b00">${esc(d.center[1])}</text></g>`;
  d.nodes.forEach((nd, i) => {
    const [x, y] = spots[i];
    out += node(x, y, 100, 54, nd, i + 1);
  });
  return out;
}

function stack(d) {
  const n = d.layers.length;
  const bh = 26;
  const gap = 4;
  let out = '';
  d.layers.forEach(([icon, label], i) => {
    const y = 4 + i * (bh + gap);
    const delay = (i * 0.28).toFixed(2);
    out += `<g class="dg-node" style="animation-delay:${delay}s; transform-origin:130px ${y + bh / 2}px">
      <rect x="10" y="${y}" width="240" height="${bh}" rx="9" fill="#fff" stroke="#e6c987" stroke-width="3"/>
      <text x="24" y="${y + 18}" font-size="15">${icon}</text>
      <text x="48" y="${y + 18}" font-size="12.5" font-weight="800" fill="#3b2a1a">${esc(label)}</text></g>`;
  });
  out += arrow(256, H / 2, 296, H / 2, n);
  out += `<g class="dg-node" style="animation-delay:${(n * 0.28 + 0.2).toFixed(2)}s; transform-origin:342px ${H / 2}px">
    <circle cx="342" cy="${H / 2}" r="38" fill="#ffd23f" stroke="#e0a400" stroke-width="3"/>
    <text x="342" y="${H / 2 + 2}" text-anchor="middle" font-size="26">${d.target[0]}</text>
    <text x="342" y="${H / 2 + 20}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#5a3b00">${esc(d.target[1])}</text></g>`;
  return out;
}

export function renderDiagram(d) {
  const body = d.type === 'hub' ? hub(d) : d.type === 'stack' ? stack(d) : flow(d);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="diagram">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#c2571a"/></marker></defs>
    ${body}</svg>`;
}
