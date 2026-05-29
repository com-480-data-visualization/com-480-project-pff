(async function initTeamDNA() {
  const [teamsRaw, champsRaw] = await Promise.all([
    d3.json('./data/team_profiles.json'),
    d3.json('./data/champion_profiles.json'),
  ]);

  const svg = d3.select('#team-svg');
  const seasonSel = document.getElementById('team-season');
  const teamSel = document.getElementById('team-name');
  const championBtn = document.getElementById('team-champion');
  const statsEl = document.getElementById('team-stats');

  const NBA_RED = '#C9082A';
  const NBA_BLUE = '#17408B';
  const LEAGUE_GRAY = '#8B92A8';

  const ZONES = [
    'Restricted Area',
    'In The Paint (Non-RA)',
    'Mid-Range',
    'Left Corner 3',
    'Right Corner 3',
    'Above the Break 3',
  ];

  const ZONE_LABEL = {
    'Restricted Area': 'At rim',
    'In The Paint (Non-RA)': 'Paint',
    'Mid-Range': 'Mid-range',
    'Left Corner 3': 'L corner 3',
    'Right Corner 3': 'R corner 3',
    'Above the Break 3': 'Above break 3',
  };

  const W = 800;
  const H = 660;
  const margin = { top: 32, right: 10, bottom: 118, left: 92 };
  const LEGEND_GAP = 28;
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  teamsRaw.seasons.forEach(season => {
    const opt = document.createElement('option');
    opt.value = season;
    opt.textContent = season;
    seasonSel.appendChild(opt);
  });
  seasonSel.value = teamsRaw.seasons[teamsRaw.seasons.length - 1];

  const { pct, shortTeam } = Court;
  function ppDiff(teamShare, leagueShare) {
    const d = (teamShare - leagueShare) * 100;
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(1)} pp`;
  }

  function populateTeams() {
    const season = seasonSel.value;
    const teams = teamsRaw.teams_by_season[season] || [];
    teamSel.innerHTML = '';
    teams.forEach(team => {
      const opt = document.createElement('option');
      opt.value = team;
      opt.textContent = team;
      teamSel.appendChild(opt);
    });
    if (teams.includes('Golden State Warriors')) teamSel.value = 'Golden State Warriors';
    render();
  }

  function profileFor(profile, zone) {
    return profile?.zones?.find(z => z.zone === zone) || { share: 0, fg: 0, count: 0 };
  }

  function render() {
    const season = seasonSel.value;
    const team = teamSel.value;
    const teamProfile = teamsRaw.profiles[season]?.[team];
    const league = champsRaw.league[season];
    const champion = champsRaw.profiles[season];
    if (!teamProfile || !league || !champion) return;

    svg.selectAll('*').remove();

    const rows = ZONES.map(zone => {
      const teamShare = profileFor(teamProfile, zone).share;
      const leagueShare = profileFor(league, zone).share;
      return {
        zone,
        team: teamShare,
        league: leagueShare,
        champion: profileFor(champion, zone).share,
        diff: teamShare - leagueShare,
      };
    });

    const most = rows.slice().sort((a, b) => b.team - a.team)[0];
    const strongestDiff = rows.slice().sort(
      (a, b) => Math.abs(b.diff) - Math.abs(a.diff),
    )[0];

    const series = [
      { key: 'league', label: 'League average', color: LEAGUE_GRAY },
      { key: 'champion', label: `Champion · ${shortTeam(champion.team)}`, color: NBA_BLUE },
      { key: 'team', label: shortTeam(team), color: NBA_RED },
    ];

    const xMax = Math.max(0.5, d3.max(rows, d => Math.max(d.team, d.league, d.champion)) + 0.06);
    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
    const y = d3.scaleBand()
      .domain(ZONES)
      .range([0, innerH])
      .padding(0.2);

    const barH = Math.min(16, (y.bandwidth() - 4) / series.length);
    const barGap = 3;
    const groupOffset = (series.length * barH + (series.length - 1) * barGap) / 2;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3.axisBottom(x)
          .ticks(5)
          .tickSize(-innerH)
          .tickFormat(''),
      )
      .call(axis => axis.selectAll('line').attr('stroke', '#252540').attr('stroke-dasharray', '3,5'))
      .call(axis => axis.select('.domain').remove());

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`))
      .call(axis => axis.selectAll('text').attr('fill', '#7070a0').attr('font-size', 10))
      .call(axis => axis.selectAll('path,line').attr('stroke', '#1e1e35'));

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7070a0')
      .attr('font-size', 11)
      .text('Share of team attempts (%)');

    g.append('g')
      .call(d3.axisLeft(y).tickSize(0).tickFormat(z => ZONE_LABEL[z]))
      .call(axis => axis.selectAll('text')
        .attr('fill', '#e8e8f0')
        .attr('font-size', 11)
        .attr('text-anchor', 'end')
        .attr('x', -14)
        .each(function addTitle(zone) {
          d3.select(this).append('title').text(zone);
        }))
      .call(axis => axis.selectAll('path').remove());

    const rowG = g.selectAll('g.zone-row').data(rows).join('g')
      .attr('class', 'zone-row')
      .attr('transform', d => `translate(0,${y(d.zone)})`);

    rowG.each(function rowDecor(d) {
      const row = d3.select(this);
      if (d.zone !== strongestDiff.zone) return;

      row.insert('rect', ':first-child')
        .attr('x', -10)
        .attr('y', -y.bandwidth() * 0.06)
        .attr('width', innerW + 20)
        .attr('height', y.bandwidth() * 1.12)
        .attr('rx', 5)
        .attr('fill', 'rgba(23,64,139,0.12)')
        .attr('stroke', NBA_BLUE)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');

    });

    series.forEach((s, i) => {
      const dy = y.bandwidth() / 2 - groupOffset + i * (barH + barGap);
      const bars = rowG.append('g').attr('transform', `translate(0,${dy})`);
      bars.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('height', barH)
        .attr('width', 0)
        .attr('rx', 3)
        .attr('fill', s.color)
        .attr('opacity', s.key === 'league' ? 0.75 : 1)
        .transition()
        .duration(550)
        .attr('width', d => x(d[s.key]));

      bars.append('text')
        .attr('x', d => {
          const w = x(d[s.key]);
          return w > 44 ? w - 5 : w + 5;
        })
        .attr('y', barH / 2)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', d => (x(d[s.key]) > 44 ? 'end' : 'start'))
        .attr('fill', d => (x(d[s.key]) > 44 ? '#f4f4fa' : s.color))
        .attr('font-size', 10)
        .attr('font-weight', s.key === 'team' ? 600 : 400)
        .attr('opacity', 0)
        .text(d => pct(d[s.key]))
        .transition()
        .duration(550)
        .attr('opacity', 1);
    });

    const markerSize = 20;
    rowG.filter(d => d.zone === strongestDiff.zone)
      .append('g')
      .attr('class', 'vs-league-marker')
      .attr('transform', `translate(${innerW - markerSize - 4},${y.bandwidth() / 2})`)
      .each(function drawMarker() {
        const mk = d3.select(this);
        mk.append('rect')
          .attr('x', 0)
          .attr('y', -markerSize / 2)
          .attr('width', markerSize)
          .attr('height', markerSize)
          .attr('rx', 4)
          .attr('fill', NBA_BLUE);
        mk.append('text')
          .attr('x', markerSize / 2)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', '#fff')
          .attr('font-size', 9)
          .attr('font-weight', 700)
          .text('≠');
      })
      .raise();

    const legend = svg.append('g').attr('transform', `translate(${margin.left},${margin.top + innerH + LEGEND_GAP})`);
    series.forEach((s, i) => {
      const item = legend.append('g').attr('transform', `translate(0,${i * 18})`);
      item.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 3)
        .attr('fill', s.color)
        .attr('opacity', s.key === 'league' ? 0.75 : 1);
      item.append('text')
        .attr('x', 18)
        .attr('y', 10)
        .attr('fill', '#9090b8')
        .attr('font-size', 11)
        .text(s.label);
    });

    legend.append('g')
      .attr('transform', `translate(0,${series.length * 18 + 4})`)
      .call(g => {
        g.append('rect')
          .attr('width', 12)
          .attr('height', 12)
          .attr('rx', 3)
          .attr('fill', NBA_BLUE);
        g.append('text')
          .attr('x', 18)
          .attr('y', 10)
          .attr('fill', '#9090b8')
          .attr('font-size', 11)
          .text('≠ = largest gap vs league average');
      });

    statsEl.innerHTML = `
      <div class="clutch-stat-row"><span>Team</span><span class="val">${team}</span></div>
      <div class="clutch-stat-row"><span>Shots</span><span class="val">${teamProfile.shots.toLocaleString()}</span></div>
      <div class="clutch-stat-row"><span>FG%</span><span class="val">${pct(teamProfile.fg)}</span></div>
      <div class="clutch-stat-row"><span>3PT rate</span><span class="val">${pct(teamProfile.three_rate)}</span></div>
      <div class="clutch-stat-row"><span>Most used zone</span><span class="val">${ZONE_LABEL[most.zone]}</span></div>
      <div class="clutch-stat-row"><span>Most different from league</span><span class="val">${ZONE_LABEL[strongestDiff.zone]} (${ppDiff(strongestDiff.team, strongestDiff.league)})</span></div>
    `;
  }

  championBtn.addEventListener('click', () => {
    const season = seasonSel.value;
    const champ = champsRaw.profiles[season]?.team;
    if (champ) {
      teamSel.value = champ;
      render();
    }
  });
  seasonSel.addEventListener('change', populateTeams);
  teamSel.addEventListener('change', render);
  populateTeams();
})();
