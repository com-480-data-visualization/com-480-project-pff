(async function initPlayerEvolution() {
  const data = await d3.json('./data/player_team_evolution.json');
  const svg = d3.select('#evolution-svg');
  const statsEl = document.getElementById('evolution-stats');

  const ZONES = [
    'Restricted Area',
    'In The Paint (Non-RA)',
    'Mid-Range',
    'Left Corner 3',
    'Right Corner 3',
    'Above the Break 3',
  ];

  const ZONE_SHORT = {
    'Restricted Area': 'At rim',
    'In The Paint (Non-RA)': 'Paint',
    'Mid-Range': 'Mid-range',
    'Left Corner 3': 'L corner 3',
    'Right Corner 3': 'R corner 3',
    'Above the Break 3': 'Above break 3',
  };

  const COLORS = {
    'Restricted Area': '#C9082A',
    'In The Paint (Non-RA)': '#E4475F',
    'Mid-Range': '#7D8597',
    'Left Corner 3': '#5C7FB8',
    'Right Corner 3': '#17408B',
    'Above the Break 3': '#0B2559',
  };

  const W = 620;
  const H = 430;
  const margin = { top: 38, right: 28, bottom: 80, left: 170};
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  const { pct, shortTeam } = Court;

  function zoneShare(stint, zone) {
    return stint.zones.find(z => z.zone === zone)?.share || 0;
  }

  function render(playerName) {
    const player = data[playerName];
    if (!player) return;
    const stints = player.stints || [];

    svg.selectAll('*').remove();

    const x = d3.scaleLinear()
      .domain([0, 1])
      .range([0, innerW]);
    const y = d3.scaleBand()
      .domain(stints.map(d => `${shortTeam(d.team)} ${d.start}-${d.end}`))
      .range([0, innerH])
      .padding(0.2);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .call(axis => axis.selectAll('text')
        .attr('fill', '#e8e8f0')
        .attr('font-size', 11)
        .attr('text-anchor', 'end')
        .attr('dx', '-0.5em'))
      .call(axis => axis.selectAll('path').remove());

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`))
      .call(axis => axis.selectAll('text').attr('fill', '#7070a0'))
      .call(axis => axis.selectAll('path,line').attr('stroke', '#1e1e35'));

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7070a0')
      .attr('font-size', 11)
      .text('Share of attempts (%)');

    const stacked = stints.map(stint => {
      let cursor = 0;
      return {
        label: `${shortTeam(stint.team)} ${stint.start}-${stint.end}`,
        stint,
        zones: ZONES.map(zone => {
          const start = cursor;
          const share = zoneShare(stint, zone);
          cursor += share;
          return { zone, start, end: cursor, share };
        }),
      };
    });

    const rows = g.selectAll('g.stint-row').data(stacked).join('g')
      .attr('class', 'stint-row')
      .attr('transform', d => `translate(0,${y(d.label)})`);

    rows.selectAll('rect').data(d => d.zones).join('rect')
      .attr('x', d => x(d.start))
      .attr('y', 0)
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .attr('fill', d => COLORS[d.zone])
      .attr('opacity', 0.88)
      .call(sel => sel.transition().duration(650).attr('width', d => Math.max(0, x(d.end) - x(d.start))));

    rows.selectAll('text.zone-pct').data(d => d.zones.filter(z => z.share >= 0.08)).join('text')
      .attr('class', 'zone-pct')
      .attr('x', d => x(d.start) + (x(d.end) - x(d.start)) / 2)
      .attr('y', y.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#f4f4fa')
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('opacity', 0)
      .text(d => pct(d.share))
      .transition()
      .duration(650)
      .attr('opacity', 1);

    const legend = svg.append('g').attr('transform', `translate(${margin.left},${H - 46})`);
    ZONES.forEach((zone, i) => {
      const row = legend.append('g').attr('transform', `translate(${(i % 3) * 165},${Math.floor(i / 3) * 20})`);
      row.append('rect').attr('width', 11).attr('height', 11).attr('rx', 3).attr('fill', COLORS[zone]);
      row.append('text').attr('x', 17).attr('y', 9).attr('fill', '#7070a0').attr('font-size', 10).text(ZONE_SHORT[zone]);
    });

    const biggestShift = stints.length > 1
      ? ZONES.map(zone => {
          const vals = stints.map(stint => zoneShare(stint, zone));
          return { zone, spread: Math.max(...vals) - Math.min(...vals) };
        }).sort((a, b) => b.spread - a.spread)[0]
      : null;
    const totalShots = d3.sum(stints, d => d.shots);
    statsEl.innerHTML = `
      <div class="clutch-stat-row"><span>Player</span><span class="val">${playerName}</span></div>
      <div class="clutch-stat-row"><span>Teams played for</span><span class="val">${stints.length}</span></div>
      <div class="clutch-stat-row"><span>Shots shown</span><span class="val">${totalShots.toLocaleString()}</span></div>
      <div class="clutch-stat-row"><span>Biggest zone change</span><span class="val">${biggestShift ? biggestShift.zone : '—'}</span></div>
    `;
  }

  document.querySelectorAll('#evolution-tabs .player-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#evolution-tabs .player-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.player);
    });
  });

  render('LeBron James');
})();
