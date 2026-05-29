(async function initFingerprint() {
  const data  = await d3.json('./data/players_fingerprint.json');
  const svg   = d3.select('#fingerprint-svg');
  const trendSvg = d3.select('#fingerprint-trend');
  const statsEl = document.getElementById('player-stats');
  const tipEl = document.getElementById('fingerprint-tooltip');
  const wrapEl = document.querySelector('.fingerprint-wrap');

  const C = Court;
  const CORNER_SVG_Y = C.CORNER_SVG_Y;
  const CORNER_XL = C.CORNER_SVG_XL;
  const CORNER_XR = C.CORNER_SVG_XR;
  const FT_Y = C.FT_SVG_Y;
  const R3_PX = C.R3;
  const RESTRICTED_R = 40;
  const restrictedCircle = `M ${C.BX},${C.BY} m -${RESTRICTED_R},0 a ${RESTRICTED_R},${RESTRICTED_R} 0 1,0 ${RESTRICTED_R * 2},0 a ${RESTRICTED_R},${RESTRICTED_R} 0 1,0 -${RESTRICTED_R * 2},0`;
  const paintRect = `M ${C.toX(-8)},${C.H} L ${C.toX(8)},${C.H} L ${C.toX(8)},${FT_Y} L ${C.toX(-8)},${FT_Y} Z`;
  const insideThreeArc = `M ${CORNER_XL},${CORNER_SVG_Y} A ${R3_PX},${R3_PX} 0 0,1 ${CORNER_XR},${CORNER_SVG_Y} L ${C.W},${C.H} L 0,${C.H} Z`;
  const leftCorner = `M 0,${C.H} L ${CORNER_XL},${C.H} L ${CORNER_XL},${CORNER_SVG_Y} L 0,${CORNER_SVG_Y} Z`;
  const rightCorner = `M ${CORNER_XR},${C.H} L ${C.W},${C.H} L ${C.W},${CORNER_SVG_Y} L ${CORNER_XR},${CORNER_SVG_Y} Z`;
  // Arc + wing strips along sidelines up to half-court (fills elbows beside corner 3)
  const aboveBreak = `M 0,${CORNER_SVG_Y} L ${CORNER_XL},${CORNER_SVG_Y} A ${R3_PX},${R3_PX} 0 0,1 ${CORNER_XR},${CORNER_SVG_Y} L ${C.W},${CORNER_SVG_Y} L ${C.W},0 L 0,0 Z`;

  const ZONE_COURT_PATHS = {
    'Restricted Area': restrictedCircle,
    'In The Paint (Non-RA)': paintRect,
    'Left Corner 3': leftCorner,
    'Right Corner 3': rightCorner,
    'Above the Break 3': aboveBreak,
  };

  const ZONE_MASKS = {
    'In The Paint (Non-RA)': {
      shape: paintRect,
      holes: [restrictedCircle],
    },
    'Mid-Range': {
      shape: insideThreeArc,
      holes: [paintRect, restrictedCircle, leftCorner, rightCorner],
    },
    'Above the Break 3': {
      shape: aboveBreak,
      holes: [leftCorner, rightCorner],
    },
  };

  const miniCourtSvg = d3.select(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    .attr('viewBox', `0 0 ${C.W} ${C.H}`);
  Court.drawCourt(miniCourtSvg, { color: '#505070', opacity: 0.7, lw: 1 });
  const MINI_COURT_LINES = miniCourtSvg.select('.court-lines').node().outerHTML;

  const pct = Court.pct;

  function zoneInsight(d, overallFg) {
    if (!d.n) return 'No shots recorded in this zone.';
    const expectedShare = 1 / 6;
    const shareDiff = d.freq - expectedShare;
    const fgDiff = d.fg - overallFg;

    let vol;
    if (Math.abs(shareDiff) < 0.012) vol = 'Takes a typical share of their attempts here';
    else if (shareDiff > 0) vol = 'Takes more shots here than usual';
    else vol = 'Takes fewer shots here than usual';

    let fg;
    if (Math.abs(fgDiff) < 0.008) fg = 'shoots near their overall FG%';
    else if (fgDiff > 0) fg = `shoots ${(fgDiff * 100).toFixed(1)} pp better than their average`;
    else fg = `shoots ${(Math.abs(fgDiff) * 100).toFixed(1)} pp worse than their average`;

    return `${vol} and ${fg}.`;
  }

  function miniCourtHtml(zone) {
    const maskSpec = ZONE_MASKS[zone];
    let highlight;
    if (maskSpec) {
      const maskId = `fp-mask-${zone.replace(/[^a-z0-9]/gi, '')}`;
      const holes = maskSpec.holes.map(h => `<path fill="black" d="${h}"/>`).join('');
      highlight = `
        <defs>
          <mask id="${maskId}">
            <path fill="white" d="${maskSpec.shape}"/>
            ${holes}
          </mask>
        </defs>
        <path class="fp-zone-highlight" mask="url(#${maskId})" d="${maskSpec.shape}"/>`;
    } else {
      const d = ZONE_COURT_PATHS[zone] || '';
      highlight = `<path class="fp-zone-highlight" d="${d}"/>`;
    }
    return `<svg viewBox="0 0 ${C.W} ${C.H}" class="fp-mini-court-svg" aria-hidden="true">
      <rect width="${C.W}" height="${C.H}" fill="#0a0f1e"/>
      ${MINI_COURT_LINES}
      ${highlight}
    </svg>`;
  }

  function showTip(event, html) {
    const rect = wrapEl.getBoundingClientRect();
    tipEl.innerHTML = html;
    tipEl.classList.add('visible');
    const tipRect = tipEl.getBoundingClientRect();
    let left = event.clientX - rect.left + 14;
    let top = event.clientY - rect.top - 8;
    left = Math.min(left, rect.width - tipRect.width - 8);
    top = Math.min(top, rect.height - tipRect.height - 8);
    left = Math.max(8, left);
    top = Math.max(8, top);
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  }

  function hideTip() {
    tipEl.classList.remove('visible');
  }

  function setBarHighlight(zone) {
    barsG.selectAll('path.fp-bar')
      .attr('opacity', d => (d.zone === zone ? 1 : 0.28))
      .attr('stroke', d => (d.zone === zone ? '#e8e8f0' : 'none'))
      .attr('stroke-width', d => (d.zone === zone ? 1.25 : 0));
  }

  function clearBarHighlight() {
    barsG.selectAll('path.fp-bar')
      .attr('opacity', 0.85)
      .attr('stroke', 'none');
  }

  function zoneTipHtml(d, overallFg) {
    return `
      <div class="fp-tip-inner">
        <div class="fp-tip-court">${miniCourtHtml(d.zone)}</div>
        <div class="fp-tip-stats">
          <strong>${d.zone}</strong>
          <div class="fp-tip-line">Share of attempts: <span>${pct(d.freq)}</span></div>
          <div class="fp-tip-line">FG%: <span>${pct(d.fg)}</span></div>
          <p class="fp-tip-insight">${zoneInsight(d, overallFg)}</p>
        </div>
      </div>
    `;
  }

  function bindZoneHover(sel, overallFg) {
    sel
      .on('mouseenter', (event, d) => setBarHighlight(d.zone))
      .on('mousemove', (event, d) => showTip(event, zoneTipHtml(d, overallFg)))
      .on('mouseleave', () => {
        clearBarHighlight();
        hideTip();
      });
  }

  const CX = 210, CY = 210, R_OUTER = 165, R_INNER = 65;

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

  // ── Background rings + radial frequency ticks ─────────────────────────────
  const FREQ_TICKS = [0, 0.25, 0.5, 0.75, 1];

  const gridG = svg.append('g');
  FREQ_TICKS.slice(1).forEach(t => {
    gridG.append('circle')
      .attr('cx', CX).attr('cy', CY)
      .attr('r', R_INNER + t * (R_OUTER - R_INNER))
      .attr('fill', 'none')
      .attr('stroke', '#1e1e35')
      .attr('stroke-width', 1);
  });

  const freqTicksG = svg.append('g').attr('class', 'fp-freq-ticks');
  const freqLegendEl = document.getElementById('fp-freq-legend');

  const FREQ_TICK_ABOVE = 20;

  function freqTickY(t, r) {
    const pad = FREQ_TICK_ABOVE + (t === 1 ? 6 : 0);
    return CY - r - pad;
  }

  function updateFreqScale(maxFreq) {
    const tickData = FREQ_TICKS.map(t => ({
      t,
      r: R_INNER + t * (R_OUTER - R_INNER),
      label: t === 0 ? '0%' : pct(maxFreq * t),
    }));

    freqTicksG.selectAll('text.fp-freq-tick').data(tickData, d => d.t)
      .join(
        enter => enter.append('text')
          .attr('class', 'fp-freq-tick')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'auto')
          .attr('fill', '#9090b8')
          .attr('font-size', '8.5px')
          .attr('font-family', 'Inter, sans-serif')
          .attr('x', CX)
          .attr('y', d => freqTickY(d.t, d.r))
          .text(d => d.label),
        update => update
          .attr('y', d => freqTickY(d.t, d.r))
          .text(d => d.label),
      );

    if (freqLegendEl) {
      freqLegendEl.textContent = `0% → ${pct(maxFreq)} of attempts`;
    }

    freqTicksG.selectAll('text.fp-freq-axis-title').data([1]).join(
      enter => enter.append('text')
        .attr('class', 'fp-freq-axis-title')
        .attr('x', CX)
        .attr('y', CY - R_OUTER - FREQ_TICK_ABOVE - 14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#7070a0')
        .attr('font-size', '8px')
        .attr('font-family', 'Inter, sans-serif')
        .text('Share of attempts'),
      update => update.attr('y', CY - R_OUTER - FREQ_TICK_ABOVE - 14),
    );

    freqTicksG.raise();
  }

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

  // Centre ring (covers inner part)
  svg.append('circle')
    .attr('cx', CX).attr('cy', CY).attr('r', R_INNER)
    .attr('fill', '#090910');

  // Centre text (player name + total)
  const nameEl  = svg.append('text')
    .attr('x', CX).attr('y', CY - 6)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#e8e8f0')
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .attr('font-family', 'Inter, sans-serif');
  const shotsEl = svg.append('text')
    .attr('x', CX).attr('y', CY + 10)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#7070a0')
    .attr('font-size', '9px')
    .attr('font-family', 'Inter, sans-serif');

  const hitG = svg.append('g').attr('class', 'fp-hits');

  // ── Render player ─────────────────────────────────────────────────────────
  function render(playerName) {
    hideTip();
    clearBarHighlight();
    const p    = data[playerName];
    if (!p) return;

    // Build lookup by zone name
    const zoneMap = Object.fromEntries(p.zones.map(z => [z.zone, z]));
    const maxFreq = Math.max(...ZONES.map(z => zoneMap[z]?.freq ?? 0));

    const arcs = ZONES.map((zoneName, i) => {
      const z    = zoneMap[zoneName] || { freq: 0, fg: 0, n: 0 };
      const a0   = START + i * SLICE + 0.04;
      const a1   = START + (i + 1) * SLICE - 0.04;
      const hitA0 = START + i * SLICE + 0.02;
      const hitA1 = START + (i + 1) * SLICE - 0.02;
      const rBar = R_INNER + (z.freq / Math.max(maxFreq, 0.01)) * (R_OUTER - R_INNER);
      return {
        a0, a1, hitA0, hitA1,
        r: rBar,
        fg: z.fg,
        freq: z.freq,
        n: z.n,
        zone: zoneName,
      };
    });

    // Update bars
    barsG.selectAll('path.fp-bar').data(arcs, d => d.zone)
      .join(
        enter => enter.append('path').attr('class', 'fp-bar')
          .attr('pointer-events', 'none')
          .attr('d', d => arcPath(CX, CY, R_INNER, R_INNER, d.a0, d.a1))
          .attr('fill', d => fgColor(d.fg))
          .attr('opacity', 0.85)
          .call(e => e.transition().duration(600)
            .attr('d', d => arcPath(CX, CY, R_INNER, d.r, d.a0, d.a1))),
        update => update
          .call(u => u.transition().duration(500)
            .attr('d', d => arcPath(CX, CY, R_INNER, d.r, d.a0, d.a1))
            .attr('fill', d => fgColor(d.fg))),
      );

    hitG.selectAll('path.fp-hit').data(arcs, d => d.zone)
      .join(
        enter => enter.append('path')
          .attr('class', 'fp-hit')
          .attr('d', d => arcPath(CX, CY, R_INNER, R_OUTER, d.hitA0, d.hitA1))
          .call(bindZoneHover, p.overall_fg),
        update => update
          .attr('d', d => arcPath(CX, CY, R_INNER, R_OUTER, d.hitA0, d.hitA1))
          .call(bindZoneHover, p.overall_fg),
      );
    hitG.raise();

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

    updateFreqScale(maxFreq);
    freqTicksG.raise();
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
