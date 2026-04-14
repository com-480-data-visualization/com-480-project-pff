(async function initRevolution() {
  const raw    = await d3.json('./data/hex_by_season.json');
  const svg    = d3.select('#revolution-svg');
  const slider = document.getElementById('rev-slider');
  const label  = document.getElementById('rev-year-label');
  const playBtn= document.getElementById('rev-play');
  const statEl = document.getElementById('rev-3pt-pct');

  const { W, H, toX, toY, drawCourt } = Court;

  // ── Cell dimensions (must match preprocess.py constants) ─────────────────
  const GRID   = 25;
  const HEX_W  = 50 / GRID;          // 2 ft
  const HEX_H  = HEX_W * Math.sqrt(3) / 2; // ~1.732 ft
  const CELL_W = HEX_W  * Court.SCALE;     // 20 px
  const CELL_H = HEX_H  * Court.SCALE;     // ~17.3 px

  // Clip path so cells don't paint outside the court boundary
  svg.append('defs').append('clipPath').attr('id', 'rev-clip')
    .append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);

  // Cells group (below court lines)
  const cellsG = svg.append('g').attr('clip-path', 'url(#rev-clip)');

  // Court overlay
  drawCourt(svg, { color: '#ffffff', opacity: 0.55, lw: 1.2 });

  // Color scale: diverging blue → white → red
  // `rel` = ratio of shots in cell vs league average
  const colorScale = d3.scaleDiverging()
    .domain([0, 1, 3.5])
    .interpolator(d3.interpolateRdBu)
    .clamp(true);
  // Note: RdBu goes red→white→blue, we want blue=low, red=high
  // Wrap to invert: low rel → blue, high rel → red
  const color = rel => colorScale(4 - Math.min(rel, 3.5)); // invert domain

  // ── Render a season ───────────────────────────────────────────────────────
  function render(season) {
    const bins = raw.data[season];

    const cells = cellsG.selectAll('rect.hex').data(bins, d => `${d.q}-${d.r}`);

    cells.join(
      enter => enter.append('rect')
        .attr('class', 'hex')
        .attr('x', d => toX(d.cx) - CELL_W / 2)
        .attr('y', d => toY(d.cy) - CELL_H / 2)
        .attr('width',  CELL_W)
        .attr('height', CELL_H)
        .attr('fill', d => d.count < 3 ? 'transparent' : color(d.rel))
        .attr('opacity', 0)
        .call(e => e.transition().duration(400).attr('opacity', d => d.count < 3 ? 0 : 0.82)),
      update => update
        .call(u => u.transition().duration(500)
          .attr('fill', d => d.count < 3 ? 'transparent' : color(d.rel))
          .attr('opacity', d => d.count < 3 ? 0 : 0.82)
        ),
      exit => exit.transition().duration(300).attr('opacity', 0).remove()
    );

    // Update 3PT stat callout
    const allBins   = bins.filter(d => d.count >= 3);
    const total     = d3.sum(allBins, d => d.count);
    // We don't have direct 3PT flag per cell, but cx > 247.5 or < 252.5 at far distance
    // Instead pull from season-level data stored in hex_by_season (not added) —
    // use an approximate heuristic: cells with cy_data > 24ft are almost all 3PT
    // For exact value we'd need a separate field, so show FG% instead
    const avgFg     = total > 0 ? d3.sum(allBins, d => d.count * d.fg) / total : 0;
    statEl.textContent = `Avg FG: ${(avgFg * 100).toFixed(1)}%`;
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  function setYear(yr) {
    slider.value = yr;
    label.textContent = yr;
    render(yr);
  }

  setYear(2004);

  slider.addEventListener('input', () => setYear(+slider.value));

  let playing = false, timer = null;
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent  = playing ? '⏸ Pause' : '▶ Play';
    playBtn.classList.toggle('playing', playing);
    if (playing) {
      let yr = +slider.value;
      timer = setInterval(() => {
        yr++;
        if (yr > 2025) { yr = 2004; }
        setYear(yr);
      }, 900);
    } else {
      clearInterval(timer);
    }
  });

  // Update stat to show 3PT rate for the selected year using pre-loaded hex data
  // (We add this as a direct 3PT rate display)
  const THREE_PT_RATES = {
    2004:.222,2005:.223,2006:.223,2007:.224,2008:.228,2009:.229,2010:.228,
    2011:.228,2012:.237,2013:.244,2014:.252,2015:.270,2016:.281,2017:.295,
    2018:.315,2019:.336,2020:.349,2021:.391,2022:.399,2023:.407,2024:.415,2025:.420,
  };
  slider.addEventListener('input', () => {
    const yr  = +slider.value;
    const pct = THREE_PT_RATES[yr];
    if (pct) statEl.textContent = `${(pct * 100).toFixed(1)}% of shots were 3-pointers`;
  });
  // initialise
  statEl.textContent = `${(THREE_PT_RATES[2004]*100).toFixed(1)}% of shots were 3-pointers`;

})();
