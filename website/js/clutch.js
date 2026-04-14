(async function initClutch() {
  const raw   = await d3.json('./data/clutch_shots.json');
  const svg   = d3.select('#clutch-svg');
  const statsEl = document.getElementById('clutch-stats');
  const teamSel   = document.getElementById('clutch-team');
  const playerSel = document.getElementById('clutch-player');
  const tipEl     = document.getElementById('clutch-tooltip');

  const { W, H, toX, toY, drawCourt } = Court;

  // ── Populate filter dropdowns ─────────────────────────────────────────────
  raw.top_teams.forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    teamSel.appendChild(o);
  });
  raw.top_players.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    playerSel.appendChild(o);
  });

  // ── Decode compact format ─────────────────────────────────────────────────
  // fields: ["x","y","made","season","player_idx","team_idx","secs","is3"]
  const shots = raw.shots.map(s => ({
    x:      s[0], y: s[1],
    made:   s[2], season: s[3],
    player: raw.players[s[4]],
    team:   raw.teams[s[5]],
    secs:   s[6], is3: s[7],
  }));

  // ── Draw court ────────────────────────────────────────────────────────────
  // Clip
  svg.append('defs').append('clipPath').attr('id', 'clutch-clip')
    .append('rect').attr('x',0).attr('y',0).attr('width',W).attr('height',H);

  const dotsG = svg.append('g').attr('clip-path', 'url(#clutch-clip)');
  drawCourt(svg, { color: '#ffffff', opacity: 0.5, lw: 1.2 });

  // ── Render ────────────────────────────────────────────────────────────────
  function render(filtered) {
    const dots = dotsG.selectAll('circle.clutch-dot').data(filtered, (d,i) => i);

    dots.join(
      enter => enter.append('circle').attr('class', 'clutch-dot')
        .attr('cx', d => toX(d.x))
        .attr('cy', d => toY(d.y))
        .attr('r', 3.5)
        .attr('fill', d => d.made ? '#f7820b' : '#444466')
        .attr('fill-opacity', d => d.made ? 0.75 : 0.45)
        .attr('stroke', d => d.made ? '#f7820b' : 'none')
        .attr('stroke-width', d => d.made ? 0.5 : 0)
        .on('mousemove', (event, d) => {
          const rect = svg.node().closest('.section-viz').getBoundingClientRect();
          const ex = event.clientX - rect.left;
          const ey = event.clientY - rect.top;
          tipEl.style.left  = (ex + 12) + 'px';
          tipEl.style.top   = (ey - 10) + 'px';
          tipEl.innerHTML   = `
            <strong>${d.player}</strong><br>
            ${d.team} · ${d.season}<br>
            ${d.secs}s left · Q4<br>
            ${d.is3 ? '3PT' : '2PT'} — ${d.made ? '<span style="color:#f7820b">Made ✓</span>' : '<span style="color:#888">Missed</span>'}
          `;
          tipEl.classList.add('visible');
        })
        .on('mouseleave', () => tipEl.classList.remove('visible')),
      update => update
        .attr('cx', d => toX(d.x))
        .attr('cy', d => toY(d.y))
        .attr('fill', d => d.made ? '#f7820b' : '#444466')
        .attr('fill-opacity', d => d.made ? 0.75 : 0.45),
      exit => exit.remove()
    );

    // ── Stats panel ──────────────────────────────────────────────────────
    const total = filtered.length;
    const made  = filtered.filter(d => d.made).length;
    const fgPct = total > 0 ? (made / total * 100).toFixed(1) : '—';

    // Top clutch player by makes
    const byPlayer = d3.rollup(filtered.filter(d=>d.made), v => v.length, d => d.player);
    const topPlayer = [...byPlayer.entries()].sort((a,b) => b[1]-a[1])[0];

    // Top clutch team
    const byTeam = d3.rollup(filtered, v => v.length, d => d.team);
    const topTeam = [...byTeam.entries()].sort((a,b) => b[1]-a[1])[0];

    statsEl.innerHTML = `
      <div class="clutch-stat-row"><span>Total shots</span><span class="val">${total.toLocaleString()}</span></div>
      <div class="clutch-stat-row"><span>Made</span><span class="val">${made.toLocaleString()}</span></div>
      <div class="clutch-stat-row"><span>FG%</span><span class="val">${fgPct}%</span></div>
      ${topPlayer ? `<div class="clutch-stat-row"><span>Top scorer</span><span class="val">${topPlayer[0].split(' ').pop()} (${topPlayer[1]})</span></div>` : ''}
      ${topTeam ? `<div class="clutch-stat-row"><span>Most attempts</span><span class="val">${topTeam[0].replace(/^.* /, '')} (${topTeam[1]})</span></div>` : ''}
    `;
  }

  // ── Filter logic ──────────────────────────────────────────────────────────
  function applyFilters() {
    const team   = teamSel.value;
    const player = playerSel.value;
    let filtered = shots;
    if (team)   filtered = filtered.filter(d => d.team === team);
    if (player) filtered = filtered.filter(d => d.player === player);
    render(filtered);
  }

  teamSel.addEventListener('change', applyFilters);
  playerSel.addEventListener('change', applyFilters);

  render(shots);

})();
