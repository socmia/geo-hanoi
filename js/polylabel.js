// Pole of inaccessibility: the interior point farthest from the polygon edge.
// Compact port of mapbox/polylabel (ISC). Used so a tổ label always sits inside its own polygon.
// rings: [[ [x, y], ... ], ...] (outer ring first, holes after). Returns [x, y].
export function polylabel(rings, precision = 1e-6) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of rings[0]) {
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  const size = Math.min(maxX - minX, maxY - minY);
  if (size === 0) return [minX, minY];
  const cell = (x, y, h) => { const d = pointToPolygonDist(x, y, rings); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
  const queue = [];
  for (let x = minX; x < maxX; x += size) for (let y = minY; y < maxY; y += size) queue.push(cell(x + size / 2, y + size / 2, size / 2));
  let best = cell((minX + maxX) / 2, (minY + maxY) / 2, 0);
  const c = centroid(rings[0]);
  const cc = cell(c[0], c[1], 0);
  if (cc.d > best.d) best = cc;
  while (queue.length) {
    queue.sort((a, b) => b.max - a.max);
    const q = queue.shift();
    if (q.d > best.d) best = q;
    if (q.max - best.d <= precision) continue;
    const h = q.h / 2;
    queue.push(cell(q.x - h, q.y - h, h), cell(q.x + h, q.y - h, h), cell(q.x - h, q.y + h, h), cell(q.x + h, q.y + h, h));
  }
  return [best.x, best.y];
}

function centroid(ring) {
  let area = 0, x = 0, y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[j];
    const f = ax * by - bx * ay;
    x += (ax + bx) * f; y += (ay + by) * f; area += f * 3;
  }
  return area === 0 ? ring[0] : [x / area, y / area];
}

// Signed distance: positive inside, negative outside.
function pointToPolygonDist(x, y, rings) {
  let inside = false, min = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[j];
      if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      min = Math.min(min, segDist2(x, y, ax, ay, bx, by));
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(min);
}

function segDist2(px, py, ax, ay, bx, by) {
  let x = ax, y = ay, dx = bx - x, dy = by - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = bx; y = by; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = px - x; dy = py - y;
  return dx * dx + dy * dy;
}
