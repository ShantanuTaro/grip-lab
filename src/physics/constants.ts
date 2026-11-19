// Every physical constant and tunable coefficient lives here.
//
// Each value is tagged with where it comes from:
//   Law      = Laws of Cricket (MCC)
//   Brief    = starting value from SPEC.md
//   Estimate = a reasoned guess that has not been fitted to data yet
// `npm run fit` fits the Coeffs block to tracked deliveries (see README.md).

export const G = 9.81; // m/s², standard gravity
export const AIR_DENSITY = 1.2; // kg/m³ (Cross, "Sports ball aerodynamics", Univ. of Sydney). Heat and altitude move it about 5%.

export const PITCH = {
  stumpsZ: 20.12, // m from the bowler's stumps to the batter's stumps (Law 6: 22 yards)
  bowlerCreaseZ: 1.22, // m, popping crease at the bowler's end (Law 7: 4 ft)
  batterCreaseZ: 18.9, // m, popping crease at the batter's end
  width: 3.05, // m (Law 6: 10 ft)
  stumpHeight: 0.711, // m (Law 8: 28 in)
  wicketHalfWidth: 0.1143, // m; the wicket is 22.86 cm wide (Law 8). SPEC.md lists this as "stump spacing".
} as const;

export const BALL = {
  radius: 0.036, // m (Law 4: circumference 22.4 to 22.9 cm)
  mass: 0.156, // kg (Law 4: 155.9 to 163 g)
  inertiaFactor: 0.4, // moment of inertia = 0.4·m·r², a uniform solid sphere. Estimate: a real ball has a dense cork core.
} as const;

export const RELEASE = {
  height: 2.1, // m (Brief): a 1.89 m bowler, at the share below. A tracked delivery can override it.
  // Release height as a share of the bowler's standing height, for a stock ball: 111.3 ± 3.9% for 21 county fast
  // bowlers (Manawadu, PhD thesis, Loughborough 2023); 112.8% for elite men and 109.7% for elite women (Felton et al.
  // 2019). Measured on pace bowlers; used for spinners too, an estimate.
  perHeight: 1.11,
  side: 0.4, // m from middle stump over the wicket, where the bowling arm passes close to the stumps (Brief)
  // m from middle stump on the other side, round the wicket, where the body is between the arm and the stumps.
  // Estimate: I found no measured figure. The back foot must land inside the return crease, 1.32 m out (Law 21.5).
  roundSide: 0.9,
  z: PITCH.bowlerCreaseZ, // released above the popping crease (Brief)
} as const;

/** The coefficients `npm run fit` can adjust. */
export interface Coeffs {
  dragCd: number;
  magnusScale: number;
  swingCsMax: number;
  restitution: number;
  friction: number;
  seamKickDegPerDeg: number;
}

export const DEFAULT_COEFFS: Coeffs = {
  // Drag coefficient, held constant through the flight. Brief: about 0.45. Cross gives about 0.5 for
  // most balls at low speed. Estimate: a real ball's Cd shifts with speed and seam position.
  dragCd: 0.45,

  // Multiplier on the Magnus lift curve below; 1 leaves the baseball curve unchanged. Estimate.
  magnusScale: 1,

  // Peak side-force coefficient for seam swing: a new ball, seam at about 20°, about 108 kph.
  // 0.25 puts the peak side force near 0.35 × the ball's weight at 30 m/s, inside the 0.3 to 0.4
  // range reported from Mehta's wind-tunnel work. Estimate until fitted to tracked swing.
  swingCsMax: 0.25,

  // How much vertical speed survives the bounce on day 1 (`wear` in venues.ts takes 5% off by day 5). Fitted
  // (`scripts/hawkeye/fit.ts`, ± 0.001) to the height at the stumps of 6,420 Hawk-Eye-tracked balls by seam bowlers,
  // spread over 214 men's Tests at 61 grounds, 2012 to 2021, each on its day of the match (see README, "Real tracking
  // data"). The brief's 0.55 left real balls 16 cm lower at the stumps than Hawk-Eye saw them.
  // An effective value: it also absorbs whatever the assumed 2.1 m release gets wrong. (Giving pace balls backspin,
  // which they lack here, fitted the same data worse.)
  // It depends on the pitch: James, Carré & Haake, "Predicting the playing character of cricket pitches",
  // Sports Engineering 8 (2005), measured it ground by ground.
  restitution: 0.631,

  // Sliding friction between ball and pitch during the bounce. Estimate, chosen so the stock
  // 132 kph ball loses about 12% of its horizontal speed, the figure in the brief.
  // Also pitch-dependent (same source).
  friction: 0.35,

  // Sideways kick when an angled seam lands on the pitch, in degrees of deviation per degree of
  // seam angle. Estimate with no published source: a 22° seam gives about 0.7° of movement.
  seamKickDegPerDeg: 0.03,
};

// Magnus lift coefficient: C_L = S / (MAGNUS_A·S + MAGNUS_B), where S = r·ω/v uses only the spin
// that is at right angles to the flight. This is a fit to baseball measurements (the form used in
// Alan Nathan's baseball trajectory work). Estimate for a cricket ball: I found no cricket-specific curve.
export const MAGNUS_A = 2.32;
export const MAGNUS_B = 0.4;

/** [x, y] points joined by straight lines; flat beyond either end. */
export type Table = readonly (readonly [number, number])[];

export type BallCondition = 'new' | 'old';

/**
 * The balls professional cricket uses. Law 4 fixes their size and weight; the makers differ in the seam and the finish.
 * Dukes and SG hand-stitch all six rows of the seam through both halves. Kookaburra hand-stitches the middle two and
 * machine-stitches the outer four into one half each, so its seam flattens sooner (S. Pradhan, "How Kookaburra balls
 * came to rule the world", The Cricket Monthly, 2018). White-ball internationals all use Kookaburra's white ball, and most
 * day/night Tests its pink one.
 *
 * reverseKph: where conventional swing stops and reverse swing starts (SWING_VS_SPEED slides to it).
 *   New, measured in wind tunnels with the seam at 15° (Scobie et al., "Practical perspective of cricket ball swing",
 *   Proc. IMechE P, 2020, doi:10.1177/1754337119872874; Grimshaw, Briggs & Atkins, "A review and reassessment of the
 *   aerodynamics of cricket ball swing", Flow 4 E6, 2024, doi:10.1017/flo.2024.4) and read off their graphs, with the
 *   review's air (1.225 kg/m³, 1.8e-5 kg/m/s, 71.6 mm ball):
 *     Dukes red 160 kph at Bath, 144 at Cambridge: 152. Kookaburra white 134 at Bath, 141 at Cambridge: 138. The two labs
 *     disagree on the gap (26 kph at Bath, 2 at Cambridge); this takes the average. Bath blamed the Kookaburra's quarter
 *     seam, a 0.5 mm gap across each half. The red Kookaburra has not been measured; it is taken as the white, with the
 *     same seam. Dukes pink: 8 kph below the red at Bath, so 144. SG red 138 (Deshpande, Shakya & Mittal, J. Fluid Mech.
 *     851, 2018, with the seam at 30°).
 *   Old, the same for every ball: worn red Dukes (8 to 25 overs) and a 70-over pink Kookaburra start to reverse at 122 to
 *   127 kph (Scobie 2020). Rougher or older balls reverse lower, down to 86.
 * oldReverse: how hard an old ball reverse-swings against an old Dukes. Kookaburra 1.25: red Kookaburra and Dukes balls
 *   roughened on the seam side, in the same tunnel, reversed at about −0.34 and −0.27 (Grimshaw 2024). Pink 0.75: worn pink
 *   Kookaburras reversed at −0.06 to −0.1 against −0.12 for worn red Dukes (Scobie 2020); in Australian Tests the pink
 *   ball swings more than the red for about 30 overs and less after (B. Jones, "Turning off the lights", CricViz, 2025).
 *   The white is taken as the red Kookaburra; SG as the Dukes (its rough-ball test used a different tunnel).
 * oldSeam: movement off an old ball's seam against a new one's. Estimate: nothing has measured it. 0.7 for Kookaburra's
 *   balls: "once the seam gets embedded in the surface (which happens too quickly for the bowlers' liking) it ceases to
 *   move quite as much" (A. Chopra, "Decoding the SG and Kookaburra", ESPNcricinfo, 2009). 1 for the hand-stitched Dukes
 *   and SG, whose seam stays proud.
 * Not modelled, for want of a measurement: bounce and hardness, and the grip spinners get from the seam (accounts differ).
 */
export const BALLS = {
  kookaburra: { name: 'Kookaburra', used: 'Tests in Australia, New Zealand, South Africa, Pakistan, Sri Lanka and Bangladesh', reverseKph: { new: 138, old: 125 }, oldReverse: 1.25, oldSeam: 0.7 },
  dukes: { name: 'Dukes', used: 'Tests in England, the West Indies and Ireland', reverseKph: { new: 152, old: 125 }, oldReverse: 1, oldSeam: 1 },
  sg: { name: 'SG', used: 'Tests in India', reverseKph: { new: 138, old: 125 }, oldReverse: 1, oldSeam: 1 },
  pink: { name: 'Pink', used: 'Day/night Tests (Kookaburra)', reverseKph: { new: 144, old: 125 }, oldReverse: 0.75, oldSeam: 0.7 },
  white: { name: 'White', used: 'ODIs and T20 internationals (Kookaburra), a new one from each end in an ODI', reverseKph: { new: 138, old: 125 }, oldReverse: 1.25, oldSeam: 0.7 },
} as const;

export type BallType = keyof typeof BALLS;

// Seam swing against seam angle (degrees), as a share of the peak. The peak is at about 20°
// (Cross; Mehta, "An overview of cricket ball swing", Sports Engineering 8, 2005).
// The shape between the anchors is an estimate.
export const SWING_VS_SEAM_ANGLE: Table = [
  [0, 0],
  [10, 0.6],
  [20, 1],
  [30, 0.85],
];

// A wobble seam rocks either side of upright, between about 11 and 1 o'clock (Wisden, "The story of the wobble seam").
// So it has no steady angle to swing with (Mehta: swing needs the ball to spin along the seam with minimal wobble), and
// it lands at any angle in that reach: each ball can seam either way or go straight on. The ±30° is from that
// description; nothing has measured it.
export const WOBBLE_DEG = 30;

// Seam swing against speed, as a share of the peak. Negative means reverse swing: the ball goes the opposite way to
// where the seam points. Speed is in kph past the ball's own reverse speed (BALLS), so each ball slides the curve.
// Anchors:
//   - the side force peaks near 30 m/s, about 108 kph (Mehta), for a new ball that reverses at 145 kph
//   - a new ball reverses above about 85 to 90 mph, 137 to 145 kph (Cross; Mehta); for each make see BALLS
//   - a rough ball reverses at lower speeds, with weaker conventional swing and stronger reverse
//     swing than a new ball ("The role of the seam in the swing of a cricket ball",
//     J. Fluid Mech. 851, 2018, doi:10.1017/jfm.2018.474). Worn balls reverse at −0.1 to −0.12 with the seam at 15°
//     (Scobie 2020), which is the −0.5 here.
// Values between the anchors are estimates. In a wind tunnel a new ball keeps its full swing right up to its reverse
// speed and then flips (Scobie 2020); tracked match balls show every amount in between, perhaps because the seam
// wobbles across the two (Grimshaw 2024), so the fall here is spread over the 35 kph below. Fit this table first.
export const SWING_VS_SPEED: Record<BallCondition, Table> = {
  new: [
    [-85, 0.7],
    [-37, 1],
    [-20, 0.85],
    [-10, 0.5],
    [0, 0],
    [5, -0.2],
  ],
  old: [
    [-65, 0.45],
    [-25, 0.45],
    [-10, 0.2],
    [0, 0],
    [15, -0.5],
    [25, -0.6],
  ],
};

export function lookup(table: Table, x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const a = table[i - 1];
      const b = table[i];
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
  }
  return table[table.length - 1][1];
}
