/**
 * Shared NBA half-court SVG drawing utilities.
 * Court coordinate system (data space, feet):
 *   x: −25 to 25   (basket centre at x=0)
 *   y:   0 to ~42.5 (baseline at y=0, basket at y=5.25, half-court ~47ft)
 * SVG viewBox: 0 0 500 470  (scale = 10 px/ft)
 */
const Court = (() => {
  const SCALE   = 10;    // px per foot
  const W       = 500;   // SVG width  (50 ft)
  const H       = 470;   // SVG height (47 ft)
  const BX      = 250;   // basket SVG x
  const BY      = 417.5; // basket SVG y = H − 5.25*SCALE

  const toX = dataX => BX + dataX * SCALE;
  const toY = dataY => H  - dataY * SCALE;

  // Pre-computed court geometry constants
  const CORNER_Y_DATA  = 5.25 + Math.sqrt(23.75 ** 2 - 22 ** 2); // ≈ 14.198
  const CORNER_SVG_Y   = toY(CORNER_Y_DATA);   // ≈ 328.0
  const CORNER_SVG_XL  = toX(-22);             // 30
  const CORNER_SVG_XR  = toX(22);              // 470
  const R3             = 23.75 * SCALE;         // 237.5 px
  const FT_SVG_Y       = toY(19);              // 280 (free-throw line)

  /**
   * Draw NBA half-court lines into `sel` (a D3 selection of an <svg> or <g>).
   * @param {d3.Selection} sel
   * @param {object} opts
   *   color    – stroke colour     (default '#C9082A')
   *   opacity  – stroke opacity    (default 0.5)
   *   lw       – stroke width      (default 1.5)
   */
  function drawCourt(sel, { color = '#C9082A', opacity = 0.5, lw = 1.5 } = {}) {
    const g = sel.append('g')
      .attr('class', 'court-lines')
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-opacity', opacity)
      .attr('stroke-width', lw);

    // Helpers
    const line = (x1, y1, x2, y2) =>
      g.append('line').attr('x1',x1).attr('y1',y1).attr('x2',x2).attr('y2',y2);

    // Baseline
    line(0, H, W, H);
    // Sidelines
    line(0, H, 0, 0);
    line(W, H, W, 0);

    // Paint outer  (x ±8 ft, y 0–19 ft)
    g.append('rect').attr('x', toX(-8)).attr('y', FT_SVG_Y)
      .attr('width', 160).attr('height', H - FT_SVG_Y).attr('fill','none');
    // Paint inner  (x ±6 ft)
    g.append('rect').attr('x', toX(-6)).attr('y', FT_SVG_Y)
      .attr('width', 120).attr('height', H - FT_SVG_Y).attr('fill','none');

    // Free-throw arc — upper (solid), lower (dashed)
    const ftR = 60;
    g.append('path')
      .attr('d', `M ${toX(-6)},${FT_SVG_Y} A ${ftR},${ftR} 0 0,0 ${toX(6)},${FT_SVG_Y}`);
    g.append('path')
      .attr('d', `M ${toX(6)},${FT_SVG_Y} A ${ftR},${ftR} 0 0,0 ${toX(-6)},${FT_SVG_Y}`)
      .attr('stroke-dasharray', '4 4');

    // Restricted area
    g.append('path')
      .attr('d', `M ${BX-40},${BY} A 40,40 0 0,0 ${BX+40},${BY}`);

    // Hoop
    g.append('circle').attr('cx', BX).attr('cy', BY).attr('r', 7.5);

    // Backboard
    line(toX(-3), toY(4.25), toX(3), toY(4.25));

    // Corner 3-point lines
    line(CORNER_SVG_XL, H, CORNER_SVG_XL, CORNER_SVG_Y);
    line(CORNER_SVG_XR, H, CORNER_SVG_XR, CORNER_SVG_Y);

    // 3-point arc
    g.append('path')
      .attr('d', `M ${CORNER_SVG_XR},${CORNER_SVG_Y} A ${R3},${R3} 0 0,0 ${CORNER_SVG_XL},${CORNER_SVG_Y}`);

    return g;
  }

  return { SCALE, W, H, BX, BY, toX, toY, drawCourt };
})();
