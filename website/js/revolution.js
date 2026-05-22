(async function initRevolution() {
  const raw = await d3.json('./data/hex_by_season.json');
  const svg = d3.select('#revolution-svg');
  const trendSvg = d3.select('#revolution-trend');
  const slider = document.getElementById('rev-slider');
  const label = document.getElementById('rev-year-label');
  const playBtn = document.getElementById('rev-play');
  const summaryEl = document.getElementById('rev-summary');
  const metricsEl = document.getElementById('rev-metrics');

  const { W, H, toX, toY, drawCourt } = Court;
  const GRID = 25;
  const HEX_W = 50 / GRID;
  const HEX_H = HEX_W * Math.sqrt(3) / 2;
  const CELL_W = HEX_W * Court.SCALE;
  const CELL_H = HEX_H * Court.SCALE;

  svg.append('defs').append('clipPath').attr('id', 'rev-clip')
    .append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H);

  const cellsG = svg.append('g').attr('clip-path', 'url(#rev-clip)');
  drawCourt(svg, { color: '#ffffff', opacity: 0.58, lw: 1.2 });

  const color = d3.scaleDiverging()
    .domain([0, 1, 3.2])
    .interpolator(t => d3.interpolateRdBu(1 - t))
    .clamp(true);

  function pct(v) { return `${(v * 100).toFixed(1)}%`; }

  const seasons = raw.seasons.map(Number);
  const trendSeries = [
    { key: 'three_rate', label: '3PT rate', color: '#C9082A' },
    { key: 'mid_rate', label: 'Mid-range', color: '#64748b' },
    { key: 'rim_rate', label: 'At rim', color: '#22c55e' },
  ];
  const trendData = seasons.map(season => ({
    season,
    ...raw.metrics[String(season)],
  }));
  const trend = buildTrendChart();

  function metricCard(label, value, delta) {
    const sign = delta > 0 ? '+' : '';
    return `
      <div class="metric-card">
        <span>${label}</span>
        <strong>${value}</strong>
        <em>${sign}${(delta * 100).toFixed(1)} pts vs 2004</em>
      </div>`;
  }

  function render(season) {
    const bins = raw.data[season] || [];
    const metrics = raw.metrics?.[season];
    const base = raw.metrics?.['2004'];

    cellsG.selectAll('rect.hex').data(bins, d => `${d.q}-${d.r}`).join(
      enter => enter.append('rect')
        .attr('class', 'hex')
        .attr('x', d => toX(d.cx) - CELL_W / 2)
        .attr('y', d => toY(d.cy) - CELL_H / 2)
        .attr('width', CELL_W)
        .attr('height', CELL_H)
        .attr('fill', d => d.count < 3 ? 'transparent' : color(d.rel))
        .attr('opacity', 0)
        .call(e => e.transition().duration(420).attr('opacity', d => d.count < 3 ? 0 : 0.84)),
      update => update.call(u => u.transition().duration(520)
        .attr('fill', d => d.count < 3 ? 'transparent' : color(d.rel))
        .attr('opacity', d => d.count < 3 ? 0 : 0.84)),
      exit => exit.transition().duration(250).attr('opacity', 0).remove()
    );

    if (metrics && base) {
      summaryEl.innerHTML = `In <strong>${season}</strong>, the league took <strong>${metrics.shots.toLocaleString()}</strong> shots. The shot map shows where that season over- or under-indexed compared with the 22-year average.`;
      metricsEl.innerHTML = [
        metricCard('3PT rate', pct(metrics.three_rate), metrics.three_rate - base.three_rate),
        metricCard('Mid-range rate', pct(metrics.mid_rate), metrics.mid_rate - base.mid_rate),
        metricCard('At-rim rate', pct(metrics.rim_rate), metrics.rim_rate - base.rim_rate),
        metricCard('FG%', pct(metrics.fg), metrics.fg - base.fg),
      ].join('');
    }

    trend.render(+season);
  }

  function buildTrendChart() {
    const margin = { top: 28, right: 105, bottom: 30, left: 42 };
    const width = 520;
    const height = 160;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    trendSvg.selectAll('*').remove();

    const g = trendSvg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(seasons))
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([
        0,
        d3.max(trendData, d => d3.max(trendSeries, s => d[s.key])) + 0.035,
      ])
      .nice()
      .range([innerH, 0]);

    g.append('g')
      .attr('class', 'trend-x-axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')))
      .call(axis => axis.selectAll('text').attr('fill', '#7070a0').attr('font-size', 10))
      .call(axis => axis.selectAll('path,line').attr('stroke', '#1e1e35'));

    g.append('g')
      .attr('class', 'trend-y-axis')
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => `${Math.round(d * 100)}%`))
      .call(axis => axis.selectAll('text').attr('fill', '#7070a0').attr('font-size', 10))
      .call(axis => axis.selectAll('path,line').attr('stroke', '#1e1e35'));

    g.append('text')
      .attr('x', 0)
      .attr('y', -10)
      .attr('fill', '#7070a0')
      .attr('font-size', 11)
      .text('League metrics revealed year by year');

    const line = d3.line()
      .x(d => x(d.season))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    const linesG = g.append('g').attr('class', 'trend-lines');
    const pointsG = g.append('g').attr('class', 'trend-points');
    const marker = g.append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#ffffff')
      .attr('stroke-opacity', 0.18)
      .attr('stroke-dasharray', '3 4');

    const legend = trendSvg.append('g')
      .attr('transform', `translate(${width - margin.right + 14},${margin.top})`);
    trendSeries.forEach((s, i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 21})`);
      row.append('circle').attr('r', 4).attr('cx', 0).attr('cy', 0).attr('fill', s.color);
      row.append('text')
        .attr('x', 10)
        .attr('y', 3)
        .attr('fill', '#7070a0')
        .attr('font-size', 10)
        .text(s.label);
    });

    function valuesUntil(year, series) {
      return trendData
        .filter(d => d.season <= year)
        .map(d => ({ season: d.season, value: d[series.key] }));
    }

    return {
      render(year) {
        marker.transition().duration(250).attr('x1', x(year)).attr('x2', x(year));

        const lineData = trendSeries.map(series => ({
          ...series,
          values: valuesUntil(year, series),
        }));

        linesG.selectAll('path.trend-line').data(lineData, d => d.key).join(
          enter => enter.append('path')
            .attr('class', 'trend-line')
            .attr('fill', 'none')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 2.4)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('d', d => line(d.values)),
          update => update.transition().duration(420).attr('d', d => line(d.values))
        );

        pointsG.selectAll('g.trend-point-series').data(lineData, d => d.key).join(
          enter => enter.append('g').attr('class', 'trend-point-series'),
          update => update,
          exit => exit.remove()
        )
          .attr('fill', d => d.color)
          .each(function(series) {
            d3.select(this).selectAll('circle').data(series.values, d => d.season).join(
              enter => enter.append('circle')
                .attr('cx', d => x(d.season))
                .attr('cy', d => y(d.value))
                .attr('r', 0)
                .attr('stroke', '#090910')
                .attr('stroke-width', 1.5)
                .call(e => e.transition().duration(260).attr('r', 3.4)),
              update => update.transition().duration(260)
                .attr('cx', d => x(d.season))
                .attr('cy', d => y(d.value)),
              exit => exit.remove()
            );
          });
      },
    };
  }

  function setYear(year) {
    slider.value = year;
    label.textContent = year;
    render(String(year));
  }

  let playing = false;
  let timer = null;
  const lastSeason = seasons[seasons.length - 1];

  function syncPlayButton() {
    playBtn.classList.remove('playing');
    const atEnd = +slider.value === lastSeason;
    playBtn.textContent = atEnd ? 'Replay' : '▶ Play';
    playBtn.classList.toggle('rev-play-cta', !atEnd);
  }

  function stopPlayback() {
    playing = false;
    clearInterval(timer);
    timer = null;
    syncPlayButton();
  }

  function startPlayback() {
    if (playing) return;
    if (+slider.value === lastSeason) setYear(seasons[0]);

    playing = true;
    playBtn.textContent = 'Pause';
    playBtn.classList.add('playing');
    playBtn.classList.remove('rev-play-cta');

    let idx = seasons.indexOf(+slider.value);
    timer = setInterval(() => {
      if (idx >= seasons.length - 1) {
        stopPlayback();
        return;
      }
      idx += 1;
      setYear(seasons[idx]);
    }, 850);
  }

  slider.min = d3.min(seasons);
  slider.max = d3.max(seasons);
  setYear(seasons[0]);
  syncPlayButton();

  slider.addEventListener('input', () => {
    setYear(+slider.value);
    if (!playing) syncPlayButton();
  });

  playBtn.addEventListener('click', () => {
    if (playing) stopPlayback();
    else startPlayback();
  });
})();
