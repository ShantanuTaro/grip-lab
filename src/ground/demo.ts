// Real tracked deliveries to try the Tracking tab with: 100 balls by seam bowlers at each ground, spread evenly over
// its men's Tests, tracked by Hawk-Eye. From the ICC's match-centre data, as collected at
// github.com/alittlefitness/HawkeyeStats (no licence given; the tracking belongs to Hawk-Eye and the ICC). Grounds and
// dates from Cricsheet scorecards. How the files were made, and what the fit gets from them: README, "Real tracking data".

import gabba from './demo/gabba.csv?raw';
import lords from './demo/lords.csv?raw';
import mohali from './demo/mohali.csv?raw';

/** `base` is the ground the rest comes from: its air, wind, slope, and the settings the tracking cannot fit. */
export const DEMOS = [
  { label: 'The Gabba', name: 'The Gabba, from Hawk-Eye', base: 'gabba', file: 'Hawk-Eye, the Gabba: 4 Tests, 2012–2015', csv: gabba },
  { label: 'Lord’s', name: 'Lord’s, from Hawk-Eye', base: 'lords', file: 'Hawk-Eye, Lord’s: 13 Tests, 2013–2019', csv: lords },
  { label: 'Mohali', name: 'Mohali, from Hawk-Eye', base: 'neutral', file: 'Hawk-Eye, Mohali: 3 Tests, 2013–2016', csv: mohali },
];
