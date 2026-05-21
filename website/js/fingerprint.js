(async function initFingerprint() {
  const data  = await d3.json('./data/players_fingerprint.json');
  const svg   = d3.select('#fingerprint-svg');
  const trendSvg = d3.select('#fingerprint-trend');
  const statsEl = document.getElementById('player-stats');

  const CX = 210, CY = 210, R_OUTER = 165, R_INNER = 65;
  const PHOTO_R = 55;

  // 6 zones (exclude Backcourt)
  const ZONES = [
    'Restricted Area',
    'In The Paint (Non-RA)',
    'Mid-Range',
    'Left Corner 3',
    'Right Corner 3',
    'Above the Break 3',
  ];
  const ZONE_SHORT = [
    'Restricted\nArea', 'Paint\n(Non-RA)', 'Mid-Range',
    'Left\nCorner 3', 'Right\nCorner 3', 'Above\nBreak 3',
  ];
  const N = ZONES.length;
  const SLICE = (Math.PI * 2) / N;
  const START = -Math.PI / 2; // top of circle

  // FG% colour scale: blue → red
  const fgColor = d3.scaleLinear()
    .domain([0.28, 0.65])
    .range(['#2166ac', '#C9082A'])
    .clamp(true);

  // ── Defs: clip for player photo ───────────────────────────────────────────
  svg.append('defs').append('clipPath').attr('id', 'fp-photo-clip')
    .append('circle').attr('cx', CX).attr('cy', CY).attr('r', PHOTO_R);

  // ── Background rings ──────────────────────────────────────────────────────
  const gridG = svg.append('g');
  [0.25, 0.5, 0.75, 1].forEach(t => {
    gridG.append('circle')
      .attr('cx', CX).attr('cy', CY)
      .attr('r', R_INNER + t * (R_OUTER - R_INNER))
      .attr('fill', 'none')
      .attr('stroke', '#1e1e35')
      .attr('stroke-width', 1);
  });

  // ── Spoke dividers ────────────────────────────────────────────────────────
  const spokeG = svg.append('g');
  ZONES.forEach((_, i) => {
    const angle = START + i * SLICE;
    const x2 = CX + R_OUTER * Math.cos(angle);
    const y2 = CY + R_OUTER * Math.sin(angle);
    spokeG.append('line')
      .attr('x1', CX).attr('y1', CY)
      .attr('x2', x2).attr('y2', y2)
      .attr('stroke', '#1e1e35')
      .attr('stroke-width', 1);
  });

  // ── Zone labels ───────────────────────────────────────────────────────────
  const labelG = svg.append('g');
  ZONES.forEach((_, i) => {
    const midAngle = START + (i + 0.5) * SLICE;
    const r = R_OUTER + 22;
    const x = CX + r * Math.cos(midAngle);
    const y = CY + r * Math.sin(midAngle);
    const lines = ZONE_SHORT[i].split('\n');
    const labelEl = labelG.append('text')
      .attr('x', x).attr('y', y - (lines.length - 1) * 6)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#7070a0')
      .attr('font-size', '9.5px')
      .attr('font-family', 'Inter, sans-serif');
    lines.forEach((ln, li) => {
      labelEl.append('tspan')
        .attr('x', x).attr('dy', li === 0 ? 0 : 12)
        .text(ln);
    });
  });

  // ── Bars group ────────────────────────────────────────────────────────────
  const barsG  = svg.append('g');
  const photoEl = svg.append('image')
    .attr('clip-path', 'url(#fp-photo-clip)')
    .attr('preserveAspectRatio', 'xMidYMin slice');

  // Centre ring (covers inner part)
  svg.append('circle')
    .attr('cx', CX).attr('cy', CY).attr('r', R_INNER)
    .attr('fill', '#090910');

  // Centre text elements (player name + total)
  const nameEl  = svg.append('text')
    .attr('x', CX).attr('y', CY + PHOTO_R + 14)
    .attr('text-anchor', 'middle')
    .attr('fill', '#e8e8f0')
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .attr('font-family', 'Inter, sans-serif');
  const shotsEl = svg.append('text')
    .attr('x', CX).attr('y', CY + PHOTO_R + 28)
    .attr('text-anchor', 'middle')
    .attr('fill', '#7070a0')
    .attr('font-size', '9px')
    .attr('font-family', 'Inter, sans-serif');

  // ── Render player ─────────────────────────────────────────────────────────
  function render(playerName) {
    const p    = data[playerName];
    if (!p) return;

    // Build lookup by zone name
    const zoneMap = Object.fromEntries(p.zones.map(z => [z.zone, z]));
    const maxFreq = Math.max(...ZONES.map(z => zoneMap[z]?.freq ?? 0));

    const arcs = ZONES.map((zoneName, i) => {
      const z    = zoneMap[zoneName] || { freq: 0, fg: 0 };
      const a0   = START + i * SLICE + 0.04;
      const a1   = START + (i + 1) * SLICE - 0.04;
      const rBar = R_INNER + (z.freq / Math.max(maxFreq, 0.01)) * (R_OUTER - R_INNER);
      return { a0, a1, r: rBar, fg: z.fg, freq: z.freq, n: z.n, zone: zoneName };
    });

    // Update bars
    barsG.selectAll('path.fp-bar').data(arcs)
      .join(
        enter => enter.append('path').attr('class', 'fp-bar')
          .attr('d', d => arcPath(CX, CY, R_INNER, R_INNER, d.a0, d.a1))
          .attr('fill', d => fgColor(d.fg))
          .attr('opacity', 0.85)
          .call(e => e.transition().duration(600)
            .attr('d', d => arcPath(CX, CY, R_INNER, d.r, d.a0, d.a1))),
        update => update
          .call(u => u.transition().duration(500)
            .attr('d', d => arcPath(CX, CY, R_INNER, d.r, d.a0, d.a1))
            .attr('fill', d => fgColor(d.fg)))
      );

    // Photo
    const pid = p.player_id;
    photoEl
      .attr('href', `https://cdn.nba.com/headshots/nba/latest/1040x760/${pid}.png`)
      .attr('x', CX - PHOTO_R).attr('y', CY - PHOTO_R)
      .attr('width', PHOTO_R * 2).attr('height', PHOTO_R * 2);

    nameEl.text(playerName.split(' ').slice(-1)[0]);  // last name
    shotsEl.text(`${p.total_shots.toLocaleString()} shots`);

    // Stats panel
    const topZone = p.zones.slice().sort((a,b) => b.freq - a.freq)[0];
    const bestZone = p.zones.filter(z => z.n > 200).sort((a,b) => b.fg - a.fg)[0];
    statsEl.innerHTML = `
      <div class="stat-item">
        <span class="stat-key">Overall FG%</span>
        <span class="stat-val">${(p.overall_fg * 100).toFixed(1)}%</span>
      </div>
      <div class="stat-item">
        <span class="stat-key">Total shots</span>
        <span class="stat-val">${p.total_shots.toLocaleString()}</span>
      </div>
      <div class="stat-item">
        <span class="stat-key">Most attempted zone</span>
        <span class="stat-val">${topZone ? topZone.zone.replace('(Non-RA)','') : '—'}</span>
      </div>
      <div class="stat-item">
        <span class="stat-key">Most efficient zone</span>
        <span class="stat-val">${bestZone ? bestZone.zone.replace('(Non-RA)','') + ' ' + (bestZone.fg*100).toFixed(1)+'%' : '—'}</span>
      </div>
    `;

    renderTrend(p.seasons_3pt || []);
  }

  function renderTrend(points) {
    trendSvg.selectAll('*').remove();
    if (!points.length) return;

    const margin = { top: 12, right: 18, bottom: 22, left: 34 };
    const width = 320 - margin.left - margin.right;
    const height = 90 - margin.top - margin.bottom;
    const g = trendSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear()
      .domain(d3.extent(points, d => +d.season))
      .range([0, width]);
    const y = d3.scaleLinear()
      .domain([0, Math.max(0.55, d3.max(points, d => +d.three_rate) + 0.05)])
      .range([height, 0]);

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', '#C9082A')
      .attr('stroke-width', 2)
      .attr('d', d3.line()
        .x(d => x(+d.season))
        .y(d => y(+d.three_rate))
        .curve(d3.curveMonotoneX));

    g.selectAll('circle').data(points).join('circle')
      .attr('cx', d => x(+d.season))
      .attr('cy', d => y(+d.three_rate))
      .attr('r', 2.5)
      .attr('fill', '#C9082A');

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('d')))
      .call(g => g.selectAll('text').attr('fill', '#7070a0'))
      .call(g => g.selectAll('path,line').attr('stroke', '#1e1e35'));

    g.append('g')
      .call(d3.axisLeft(y).ticks(3).tickFormat(d => `${Math.round(d * 100)}%`))
      .call(g => g.selectAll('text').attr('fill', '#7070a0'))
      .call(g => g.selectAll('path,line').attr('stroke', '#1e1e35'));

    trendSvg.append('text')
      .attr('x', 8)
      .attr('y', 10)
      .attr('fill', '#7070a0')
      .attr('font-size', 10)
      .text('3PT attempt rate over seasons');
  }

  // ── Arc path helper ───────────────────────────────────────────────────────
  function arcPath(cx, cy, rInner, rOuter, a0, a1) {
    const x1 = cx + rOuter * Math.cos(a0), y1 = cy + rOuter * Math.sin(a0);
    const x2 = cx + rOuter * Math.cos(a1), y2 = cy + rOuter * Math.sin(a1);
    const x3 = cx + rInner * Math.cos(a1), y3 = cy + rInner * Math.sin(a1);
    const x4 = cx + rInner * Math.cos(a0), y4 = cy + rInner * Math.sin(a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return [
      `M ${x1} ${y1}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  document.querySelectorAll('#player-tabs .player-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#player-tabs .player-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.player);
    });
  });

  render('LeBron James');

})();
