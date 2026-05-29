(async function initClutch() {
  const [shotsRaw, comparison] = await Promise.all([
    d3.json('./data/clutch_shots.json'),
    d3.json('./data/clutch_comparison.json'),
  ]);

  const svg = d3.select('#clutch-svg');
  const scatterSvg = d3.select('#clutcher-svg');
  const statsEl = document.getElementById('clutch-stats');
  const playerSel = document.getElementById('clutch-player');
  const tipEl = document.getElementById('clutch-tooltip');

  const { W, H, toX, toY, drawCourt, pct } = Court;
  const GRID = 25;
  const HEX_W = 50 / GRID;
  const HEX_H = HEX_W * Math.sqrt(3) / 2;
  const CELL_W = HEX_W * Court.SCALE;
  const CELL_H = HEX_H * Court.SCALE;

  const shots = shotsRaw.shots.map(s => ({
    x: s[0],
    y: s[1],
    made: s[2],
    season: s[3],
    player: shotsRaw.players[s[4]],
    team: shotsRaw.teams[s[5]],
    secs: s[6],
    is3: s[7],
  }));

  const qualifiedPlayers = comparison.players
    .slice()
    .filter(d => d.attempts >= 5)
    .sort((a, b) => b.attempts - a.attempts || b.fg - a.fg);

  qualifiedPlayers.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.player;
    opt.textContent = `${p.player} (${p.attempts})`;
    playerSel.appendChild(opt);
  });

  svg.append('defs').append('clipPath').attr('id', 'clutch-clip')
    .append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);

  const heatG = svg.append('g').attr('clip-path', 'url(#clutch-clip)');
  drawCourt(svg, { color: '#ffffff', opacity: 0.56, lw: 1.2 });

  const color = d3.scaleDiverging()
    .domain([-1.6, 0, 1.6])
    .interpolator(t => d3.interpolateRdBu(1 - t))
    .clamp(true);

  function showTip(event, html, containerSvg = svg.node()) {
    const rect = containerSvg.closest('.section-viz').getBoundingClientRect();
    tipEl.style.left = `${event.clientX - rect.left + 12}px`;
    tipEl.style.top = `${event.clientY - rect.top - 10}px`;
    tipEl.innerHTML = html;
    tipEl.classList.add('visible');
  }

  function hideTip() {
    tipEl.classList.remove('visible');
  }

  function renderHeatmap() {
    const cells = comparison.bins.filter(d => d.clutch_count >= 1 || d.rest_count >= 100);
    heatG.selectAll('rect.clutch-cell').data(cells, d => `${d.q}-${d.r}`).join(
      enter => enter.append('rect')
        .attr('class', 'clutch-cell')
        .attr('x', d => toX(d.cx) - CELL_W / 2)
        .attr('y', d => toY(d.cy) - CELL_H / 2)
        .attr('width', CELL_W)
        .attr('height', CELL_H)
        .attr('fill', d => color(d.log_ratio))
        .attr('opacity', d => d.clutch_count < 2 ? 0.4 : 0.84)
        .on('mousemove', (event, d) => showTip(event, `
          <strong>${d.ratio.toFixed(2)}× share vs rest of game</strong><br>
          Clutch share: ${(d.clutch_share * 100).toFixed(2)}%<br>
          Rest share: ${(d.rest_share * 100).toFixed(2)}%<br>
          Clutch FG: ${pct(d.clutch_fg)}<br>
          Rest FG: ${pct(d.rest_fg)}
        `))
        .on('mouseleave', hideTip),
      update => update
        .attr('fill', d => color(d.log_ratio))
        .attr('opacity', d => d.clutch_count < 2 ? 0.4 : 0.84)
    );
  }

  function renderStats(playerName = '') {
    const top = qualifiedPlayers[0];
    let total;
    let made;
    let fgPct;
    const restFg = comparison.overall.rest_fg;

    if (!playerName) {
      total = comparison.overall.clutch_shots;
      fgPct = comparison.overall.clutch_fg;
      made = Math.round(total * fgPct);
    } else {
      const playerRec = comparison.players.find(p => p.player === playerName);
      if (playerRec) {
        total = playerRec.attempts;
        made = playerRec.made;
        fgPct = playerRec.fg;
      } else {
        const filtered = shots.filter(d => d.player === playerName);
        total = filtered.length;
        made = filtered.filter(d => d.made).length;
        fgPct = total ? made / total : 0;
      }
    }

    statsEl.innerHTML = `
      <div class="clutch-stat-row"><span>Clutch attempts</span><span class="val">${total.toLocaleString()}</span></div>
      <div class="clutch-stat-row"><span>Clutch makes</span><span class="val">${made.toLocaleString()}</span></div>
      <div class="clutch-stat-row"><span>Clutch FG%</span><span class="val">${pct(fgPct)}</span></div>
      <div class="clutch-stat-row"><span>Rest-of-game FG%</span><span class="val">${pct(restFg)}</span></div>
      ${!playerName && top ? `<div class="clutch-stat-row"><span>Most clutch makes</span><span class="val">${top.player.split(' ').pop()} (${top.made})</span></div>` : ''}
    `;
  }

  function renderScatter(selectedPlayer = '') {
    const margin = { top: 28, right: 26, bottom: 44, left: 52 };
    const width = 520;
    const height = 260;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    scatterSvg.selectAll('*').remove();

    const x = d3.scaleLinear()
      .domain([5, d3.max(qualifiedPlayers, d => d.attempts)])
      .nice()
      .range([0, innerW]);
    const y = d3.scaleLinear()
      .domain([0, Math.min(1, d3.max(qualifiedPlayers, d => d.fg) + 0.08)])
      .nice()
      .range([innerH, 0]);

    const g = scatterSvg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')))
      .call(axis => axis.selectAll('text').attr('fill', '#7070a0'))
      .call(axis => axis.selectAll('path,line').attr('stroke', '#1e1e35'));

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`))
      .call(axis => axis.selectAll('text').attr('fill', '#7070a0'))
      .call(axis => axis.selectAll('path,line').attr('stroke', '#1e1e35'));

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7070a0')
      .attr('font-size', 11)
      .text('Clutch attempts (last 5 seconds of Q4)');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2)
      .attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7070a0')
      .attr('font-size', 11)
      .text('Clutch FG%');

    g.append('text')
      .attr('x', 0)
      .attr('y', -12)
      .attr('fill', '#7070a0')
      .attr('font-size', 11)
      .text('Qualified players: ≥1 made clutch shot and ≥5 attempts');

    const clutchAvg = comparison.overall.clutch_fg;
    const restAvg = comparison.overall.rest_fg;

    function drawFgReference(fg, color) {
      const yPos = y(fg);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yPos)
        .attr('y2', yPos)
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.75)
        .attr('stroke-dasharray', '5 4');
      return yPos;
    }

    drawFgReference(restAvg, '#17408B');
    drawFgReference(clutchAvg, '#C9082A');

    const legend = g.append('g').attr('transform', `translate(${innerW - 118}, 2)`);
    [
      { label: 'Clutch avg', value: clutchAvg, color: '#C9082A' },
      { label: 'Rest-of-game avg', value: restAvg, color: '#17408B' },
    ].forEach((item, i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 17})`);
      row.append('line')
        .attr('x1', 0)
        .attr('x2', 16)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', item.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 3');
      row.append('text')
        .attr('x', 20)
        .attr('y', 4)
        .attr('fill', item.color)
        .attr('font-size', 10)
        .text(`${item.label} ${pct(item.value)}`);
    });

    const orderedPlayers = qualifiedPlayers
      .slice()
      .sort((a, b) => (a.player === selectedPlayer) - (b.player === selectedPlayer));

    g.selectAll('circle.player-dot').data(orderedPlayers, d => d.player).join('circle')
      .attr('class', 'player-dot')
      .attr('cx', d => x(d.attempts))
      .attr('cy', d => y(d.fg))
      .attr('r', d => d.player === selectedPlayer ? 8 : 5.5)
      .attr('fill', d => d.player === selectedPlayer ? '#C9082A' : '#64748b')
      .attr('fill-opacity', d => d.player === selectedPlayer ? 0.92 : 0.52)
      .attr('stroke', d => d.player === selectedPlayer ? '#ffffff' : 'transparent')
      .attr('stroke-width', d => d.player === selectedPlayer ? 2.5 : 1.5)
      .on('mousemove', (event, d) => showTip(event, `
        <strong>${d.player}</strong><br>
        Attempts: ${d.attempts}<br>
        Made: ${d.made}<br>
        FG%: ${pct(d.fg)}
      `, scatterSvg.node()))
      .on('mouseleave', hideTip)
      .on('click', (_, d) => {
        playerSel.value = d.player;
        applyFilters();
      });
  }

  function applyFilters() {
    const player = playerSel.value;
    renderStats(player);
    renderScatter(player);
  }

  playerSel.addEventListener('change', applyFilters);

  renderHeatmap();
  renderStats();
  renderScatter();
})();
