"""Hawk-Eye Test tracking -> Grip Lab tracked deliveries: seamers' balls, with each match's ground and each ball's day.

Usage: python3 scripts/hawkeye/prepare.py <mensTest.csv> <Cricsheet tests_json dir> <out dir>
Writes <out dir>/pace.csv (input to fit.ts) and <out dir>/demo/ (the Tracking tab's demo files, as in src/ground/demo/),
and prints checks against published Hawk-Eye figures. Python 3, standard library only. See README, "Real tracking data".

1. Grounds: the feed has match ids, not grounds. Players' surnames narrow a match to a series of Cricsheet scorecards;
   the order batters were out, innings by innings, picks the Test (run totals cannot: the feed is missing some balls).
2. Directions, read off the data: Hawk-Eye x is absolute, negative toward a right-hander's off side, so a ball's line
   relative to the batter (Grip Lab: - off, + leg) is off * x, with off +1 for a right-hander and -1 for a left-hander.
   pitchY is metres from the batter's stumps (lengthM); stumpsY is the height as the ball passes the stumps.
3. Seam angle and spin are not in the feed: 0. Day of the match: overs bowled before the ball, 90 a day.
"""
import csv, json, os, statistics as st, sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher

hawk_path, cs_dir, out_dir = sys.argv[1:4]
os.makedirs(os.path.join(out_dir, 'demo'), exist_ok=True)


def surname(name):
    return name.strip().split(' ')[-1].lower()


def signature(outs_by_innings):
    return [f'{i}:{s}' for i, outs in enumerate(outs_by_innings) for s in outs]


# --- 1. Each Hawk-Eye match's Cricsheet scorecard ---
hawk = defaultdict(lambda: {'names': set(), 'innings': set(), 'outs': defaultdict(list)})
overs = defaultdict(int)  # (match, innings) -> overs in that innings
for r in csv.DictReader(open(hawk_path, newline='')):
    m = hawk[r['matchId']]
    for k in ('batter', 'nonStriker', 'bowler'):
        if r[k] and r[k] != 'NA':
            m['names'].add(surname(r[k]))
    inn, over = (int(x) for x in r['delivery'].split('.')[:2])
    m['innings'].add(inn)
    overs[(r['matchId'], inn)] = max(overs[(r['matchId'], inn)], over)
    if r['dismissalDetails'] not in ('', 'NA'):
        m['outs'][inn].append(surname(r['batter']))

cards = []
for f in os.listdir(cs_dir):
    if not f.endswith('.json'):
        continue
    d = json.load(open(os.path.join(cs_dir, f)))
    info = d['info']
    if info['dates'][0] < '2005':
        continue
    outs = [[surname(w['player_out']) for o in inn.get('overs', []) for dl in o['deliveries'] for w in dl.get('wickets', [])]
            for inn in d['innings']]
    cards.append({'id': f[:-5], 'date': info['dates'][0], 'venue': info.get('venue', ''),
                  'names': {surname(p) for team in info['players'].values() for p in team}, 'sig': signature(outs)})

venues = {}
for mid, m in hawk.items():
    sig = signature([m['outs'].get(i + 1, []) for i in range(max(m['innings']))])
    best = None
    for c in cards:
        jac = len(m['names'] & c['names']) / len(m['names'] | c['names'])
        if jac < 0.5:
            continue
        seq = SequenceMatcher(None, sig, c['sig'], autojunk=False).ratio() if sig and c['sig'] else 0
        if best is None or (seq, jac) > (best[0], best[1]):
            best = (seq, jac, c)
    if best and best[0] >= 0.8 and best[1] >= 0.6:
        venues[mid] = best[2]
twice = [k for k, n in Counter(c['id'] for c in venues.values()).items() if n > 1]
print(f'{len(hawk)} Hawk-Eye matches; {len(venues)} paired with a scorecard (dismissal order >= 80% alike, surnames >= 60%); '
      f'scorecards claimed twice: {twice or "none"}')

# --- 2. Seamers' tracked balls ---
ALIAS = {'Chattogram': 'Chittagong', 'Narendra Modi Stadium': 'Sardar Patel Stadium',
         'Beausejour Stadium': 'Darren Sammy National Cricket Stadium',
         'Punjab Cricket Association IS Bindra Stadium': 'Punjab Cricket Association Stadium'}


def num(s):
    try:
        return float(s)
    except ValueError:
        return None


COLS = ['speedKph', 'seamAngleDeg', 'spinRpm', 'lengthM', 'lineCm', 'arm', 'batter', 'ball', 'heightAtStumpsCm', 'lineAtStumpsCm',
        'matchId', 'ground', 'date', 'bowler', 'day']
rows, reasons = [], Counter()
for r in csv.DictReader(open(hawk_path, newline='')):
    if r['matchId'] not in venues or r['bowlingStyle'] not in ('FAST_SEAM', 'MEDIUM_SEAM'):
        continue
    speed, px, py, sx, sy = (num(r[k]) for k in ('ballSpeed', 'pitchX', 'pitchY', 'stumpsX', 'stumpsY'))
    why = ('no tracking' if None in (speed, px, py, sx, sy) or speed <= 0 else
           'speed outside 25-45 m/s' if not 25 <= speed <= 45 else
           'did not pitch 0.5-16 m out (full toss or wild)' if not 0.5 <= py <= 16 else
           'pitched more than 1.5 m wide' if abs(px) > 1.5 else
           'height at stumps outside 0-3 m (tracking glitch)' if not 0 <= sy <= 3 else
           'more than 3 m wide at the stumps' if abs(sx) > 3 else None)
    if why:
        reasons[why] += 1
        continue
    off = 1 if r['rightHandedBat'] == 'TRUE' else -1
    inn, over = (int(x) for x in r['delivery'].split('.')[:2])
    before = sum(overs[(r['matchId'], i)] for i in range(1, inn)) + over - 1
    v = venues[r['matchId']]
    name = v['venue'].split(',')[0].strip()
    rows.append(dict(zip(COLS, [
        round(speed * 3.6, 1), 0, 0, round(py, 2), round(off * px * 100, 1), 'right' if r['rightArmedBowl'] == 'TRUE' else 'left',
        'right' if off == 1 else 'left', 'new' if (over - 1) % 80 < 20 else 'old',  # Tests: a new ball is due after 80 overs
        round(sy * 100, 1), round(off * sx * 100, 1), r['matchId'], ALIAS.get(name, name), v['date'], r['bowler'].replace(',', ' '),
        min(5, 1 + before // 90)])))
with open(os.path.join(out_dir, 'pace.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=COLS, lineterminator='\n')
    w.writeheader()
    w.writerows(rows)
print(f'kept {len(rows)} seamers\' balls; dropped {sum(reasons.values())}:')
for k, n in reasons.most_common():
    print(f'  {n:6}  {k}')

# --- 3. Checks against published Hawk-Eye figures ---
# N. Leamon, "What is the best length to bowl in Tests?", The Cricket Monthly (2018): balls by length, all Tests, and the
# share that would hit the stumps, Tests in England. CricViz (Hindustan Times, 14 Dec 2018): 93 cm of bounce from
# good-length balls at Perth Stadium, the 11th highest match since 2005 (its one Test here has no tracking).
L = lambda r: r['lengthM']
print('\nShare of balls by length (Leamon %, here %):')
for lo, hi, pub in [(0, 5, 10), (5, 6, 13), (6, 8, 43), (8, 9, 15), (9, 99, 7)]:
    print(f'  {lo}-{hi} m: {pub:3} | {sum(lo <= L(r) < hi for r in rows) / len(rows) * 100:4.1f}')
ENGLAND = {"Lord's", 'Headingley', 'Trent Bridge', 'Old Trafford', 'The Oval', 'Edgbaston', 'The Rose Bowl', 'Sophia Gardens', 'Riverside Ground'}
eng = [r for r in rows if r['ground'] in ENGLAND]
hits = lambda r: abs(r['lineAtStumpsCm']) <= 11.43 + 3.6 and r['heightAtStumpsCm'] - 3.6 <= 71.1
print(f'Would hit the stumps, Tests in England ({len(eng)} balls; Leamon %, here %):')
for lo, hi, pub in [(0, 5, 28), (5, 6, 22), (6, 8, 10), (8, 9, 2), (9, 99, 1)]:
    b = [r for r in eng if lo <= L(r) < hi]
    print(f'  {lo}-{hi} m: {pub:3} | {sum(map(hits, b)) / len(b) * 100:4.1f}')
good = defaultdict(list)
for r in rows:
    if 6 <= L(r) < 8:
        good[(r['ground'], r['date'])].append(r['heightAtStumpsCm'])
means = sorted((st.mean(v) for v in good.values() if len(v) >= 100), reverse=True)
print(f'Good-length (6-8 m) balls, mean height at the stumps per Test ({len(means)} Tests): '
      f'median {st.median(means):.0f} cm, 11th highest {means[10]:.0f} cm')

# --- 4. The Tracking tab's demo files: 100 balls spread evenly over a ground's Tests ---
DEMO_COLS = COLS[:9]
for file, ground in [('gabba', 'Brisbane Cricket Ground'), ('lords', "Lord's"), ('mohali', 'Punjab Cricket Association Stadium')]:
    by_test = defaultdict(list)
    for r in rows:
        if r['ground'] == ground:
            by_test[(r['date'], r['matchId'])].append(r)
    tests = sorted(by_test)
    per = -(-100 // len(tests))  # ceil
    pick = [b for t in tests for b in by_test[t][::max(1, len(by_test[t]) // per)][:per]][:100]
    with open(os.path.join(out_dir, 'demo', f'{file}.csv'), 'w', newline='') as fh:
        w = csv.writer(fh, lineterminator='\n')
        w.writerow(DEMO_COLS)
        w.writerows([r[c] for c in DEMO_COLS] for r in pick)
    print(f'demo/{file}.csv: {len(pick)} balls from {len(tests)} Tests at {ground}, {tests[0][0][:4]} to {tests[-1][0][:4]}')
