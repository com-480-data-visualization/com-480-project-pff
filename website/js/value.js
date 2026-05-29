(async function initValue() {
  const data   = await d3.json('./data/expected_value.json');
  const svg    = d3.select('#value-svg');
  const noteEl = document.getElementById('value-note');
  const legendEl = document.getElementById('value-legend');

  const { W, H, toX, toY, drawCourt } = Court;

  // Cell dimensions match preprocess.py EV_GRID=50 over X=[-25,25], Y=[0,42.5]
  const CELL_W = (50 / 50) * Court.SCALE;      // 10 px
  const CELL_H = (42.5 / 50) * Court.SCALE;    // 8.5 px

  // Clip
  svg.append('defs').append('clipPath').attr('id', 'val-clip')
    .append('rect').attr('x',0).attr('y',0).attr('width',W).attr('height',H);

  const cellsG = svg.append('g').attr('clip-path', 'url(#val-clip)');
  drawCourt(svg, { color: '#ffffff', opacity: 0.5, lw: 1.2 });

  // ── Scales per mode ──────────────────────────────────────────────────────
  const scales = {
    ev: {
      accessor: d => d.ev,
      color: d3.scaleSequential(d3.interpolateRdYlBu).domain([1.2, 0.5]).clamp(true),
      label: v => `${v.toFixed(2)} pts/attempt`,
      noteText: 'Expected points per attempt (FG% × point value). Avg ≈ 0.93',
      legendTicks: [0.5, 0.7, 0.85, 1.0, 1.2],
      formatTick: v => v.toFixed(2),
    },
    fg: {
      accessor: d => d.fg,
      color: d3.scaleSequential(d3.interpolateRdYlBu).domain([0.60, 0.30]).clamp(true),
      label: v => `${(v*100).toFixed(1)}% FG`,
      noteText: 'Field goal percentage at each court location.',
      legendTicks: [0.30, 0.38, 0.46, 0.54, 0.60],
      formatTick: v => `${Math.round(v * 100)}%`,
    },
    vol: {
      accessor: d => d.count,
      color: (() => {
        const ext = d3.extent(data, d => d.count);
        return d3.scaleSequentialLog(d3.interpolateYlOrRd).domain(ext).clamp(true);
      })(),
      label: v => `${v.toLocaleString()} shots`,
      noteText: 'Total shots taken at each court location (log scale).',
      legendTicks: (() => {
        const ext = d3.extent(data, d => d.count);
        return [ext[0], 100, 1000, 10000, ext[1]];
      })(),
      formatTick: v => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v)),
    },
  };

  let currentMode = 'ev';

  // ── Tooltip ──────────────────────────────────────────────────────────────
  const tip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('position', 'fixed')
    .style('pointer-events', 'none');

  function valueAtGradientT(t, d0, d1, isLog) {
    if (isLog) {
      const log = Math.log;
      return Math.exp(log(d0) + (1 - t) * (log(d1) - log(d0)));
    }
    return d0 + (1 - t) * (d1 - d0);
  }

  function renderLegend(mode) {
    const s = scales[mode];
    const isLog = mode === 'vol';
    const stops = d3.range(0, 1.01, 0.1);
    const [d0, d1] = s.color.domain();
    const gradColors = stops.map(t => s.color(valueAtGradientT(t, d0, d1, isLog)));
    const tickLabels = s.legendTicks.map(v => s.formatTick(v));

    legendEl.innerHTML = `
      <div class="value-legend-bar">
        <div class="value-legend-gradient" style="background:linear-gradient(to right,${gradColors.join(',')})"></div>
        <div class="value-legend-ticks">${tickLabels.map(l => `<span>${l}</span>`).join('')}</div>
      </div>
    `;
    noteEl.innerHTML = s.noteText;
  }

  function render(mode) {
    const s = scales[mode];
    const cells = cellsG.selectAll('rect.val-cell').data(data, d => `${d.cx}-${d.cy}`);
    cells.join(
      enter => enter.append('rect').attr('class', 'val-cell')
        .attr('x', d => toX(d.cx) - CELL_W / 2)
        .attr('y', d => toY(d.cy) - CELL_H / 2)
        .attr('width', CELL_W).attr('height', CELL_H)
        .attr('fill', d => s.color(s.accessor(d)))
        .attr('opacity', 0.88)
        .on('mousemove', (event, d) => {
          tip.html(`
            <strong>${s.label(s.accessor(d))}</strong><br>
            FG: ${(d.fg*100).toFixed(1)}%<br>
            Value: ${d.pts === 3 ? '3PT' : '2PT'} shot<br>
            Volume: ${d.count.toLocaleString()} shots
          `)
          .style('left', (event.clientX + 12) + 'px')
          .style('top',  (event.clientY - 28) + 'px')
          .classed('visible', true);
        })
        .on('mouseleave', () => tip.classed('visible', false)),
      update => update.call(u => u.transition().duration(450)
        .attr('fill', d => s.color(s.accessor(d))))
    );
    renderLegend(mode);
  }

  render('ev');

  // ── Toggle buttons ───────────────────────────────────────────────────────
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      render(currentMode);
    });
  });

})();
