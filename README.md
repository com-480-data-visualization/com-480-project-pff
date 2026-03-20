# Milestone 1 - Data Visualization

## Dataset
For this project we will be using the dataset NBA_Shots_04_25 GitHub dataset (https://github.com/DomSamangy/NBA_Shots_04_25). It contains NBA regular-season shot data from 2003–2004 to 2024–2025 and includes one CSV per season as well as a merged dataset, covering over two decades of shot attempts. 

Each of the entries of the dataset contains the information related to a single shot that was taken. Among these information we can find the following:
- Player who took the shot
- Team from which the player was
- Whether the shot was successful or not
- Type of shot
- Coordinates from where the shot occurred 
- When in the game the shot was taken
This makes the dataset particularly well-suited for spatial and temporal analysis.

The dataset is sourced from NBA.com and is already structured and consistent across seasons, allowing to avoid too much preprocessing, or any additional scrapping to retrieve more data. However, the authors explicitly note that it is relatively “raw” and requires some wrangling. 
It could also be interesting to retrieve data more specifics to the players and overall scores of the games, to allow for some additional information.
The data processing will include the merging of multiple seasonal CSV files, as well as the potential handling of missing or inconsistent values across seasons. We will also have to potentially perform some filtering to focus more specifically on some players, teams or seasons, allowing us to delve into a more detailed analysis.

Overall, the dataset is high-quality and standardised, requiring moderate cleaning but no complex data collection, making it appropriate for this visualisation focused project.

## Problematic
The goal of this project is to analyse and visualise how shot selection in the NBA has evolved over time, across players and teams.

The main question we aim at answering would be: How have shooting patterns (location, type, and frequency) evolved in the NBA, and how do they differ between players and teams?
The study would be conducted over several axis:
Temporal: shot distribution changes over seasons and game periods.
Player: differences in shooting tendencies between players.
Team: differences in shot profiles according to the teams.
These three principal axes can also be combined two by two to conduct additional analysis.

With this project we want to highlight the transformation of modern basketball through spatial shot distributions. Basketball has undergone a major analytical revolution in the past 20 years and this dataset allows us to visually demonstrate these changes in a clear and engaging way using real game data.
The targeted audience would be sport enthusiasts who are interested in basketball analytics. And the visualisation aspect would allow the analytics to be more accessible to people.

## Exploratory Data Analysis

The dataset contains every regular-season field goal attempts recorded by the NBA from the 2003-04 season to 2024-25, covering over 4.4 million shots across 22 seasons, 2,265 unique players, and 36 team identities (30 current franchises plus historical versions of teams that relocated or rebranded over the period). Each row describes a single attempt with spatial coordinates in feet, the outcome (made or missed), the shot type (2PT or 3PT), the court zone, the player and team, and the game clock context.

Pre-processing involved correcting column types, adding two derived helper columns, dropping the few rows with missing spatial coordinates (< 0.1% of the data).

The league-wide field goal percentage sits around 46%, which is typical for professional basketball. The most striking trend is the three-point revolution: the share of 3PT attempts grew from roughly 22% of all shots in 2004 to over 40% by 2025, reflecting a fundamental strategic shift in the game driven by analytics showing that threes and close-range shots offer the best expected value.

By court zone, the restricted area concentrates the highest shot volume and the best efficiency (~63% FG%), while mid-range shots combine below-average efficiency (~40%) with only 2 points, explaining why modern teams increasingly avoid them. Corner threes post a higher FG% than above-the-break threes due to the shorter distance. Shot charts confirm this: density is highest right under the basket and along the three-point arc, with a visible void in the mid-range area in recent seasons.

Finally, shot volume decreases slightly across quarters while FG% drops more noticeably toward the end of regulation, likely reflecting fatigue and tighter defense in close games.


## Related Work

Previous work, such as the work of Kirk Goldsberry (https://fivethirtyeight.com/features/how-mapping-shots-in-the-nba-changed-it-forever/), has been done on analyzing the evolution of shot selection. Kirk Goldsberry revealed how the analytical optimization of the three-point line has driven teams into taking less mid-rangers and rather go for shots at the rim and the three point line. To prove this shift, Goldsberry used spatial smoothed heat maps of shot attempts and field goals made. However, while he and various other open-source developers attempted to build interactive web apps to visualize this, to this day, none remain functional and visualizations seem, for the most part, ‘broken’. 

While extensive work has been done to analyse the trends of the NBA’s shot profile, by aggregating data at the season or career level, our original approach is to visualize and understand how shot selection evolves iin the NBA over the seasons, but now also understand how game context, organization’s coaching and philosophy, and player transitions between franchises dictate spatial behavior. Rather than just showing where players shoot, this project attempts to model how shot selection dynamically changes depending on the time left in the game, the differences between teams (and thus their coaches), and whether an individual player's shot profile adapts or remains static when they change teams. 

Finally, in attempt to visualize the previously discussed narrative, the visual language and framing of our project draws inspiration from Kirk Goldsberry’s smoothed heat maps to effectively communicate shot volume and efficiency, alongside the immersive, modern 3D NBA shot chart web applications, such as those rapidly introduced here: https://blog.stackademic.com/3d-nba-shot-chart-web-app-with-streamlit-196dd71720f9, to provide a more dynamic, interactive exploration of spatial data than traditional flat plots.
