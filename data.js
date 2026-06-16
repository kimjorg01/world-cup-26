const PLAYERS = ["Kim", "Sander", "Jonatan", "Sebastian"];

const PLAYER_COLORS = {
  Kim: "#4488ff",
  Sander: "#ff4444",
  Jonatan: "#44cc44",
  Sebastian: "#ffcc00",
};

const TEAMS = {
  "Mexico": { code: "MEX", iso: "mx" },
  "South Africa": { code: "RSA", iso: "za" },
  "South Korea": { code: "KOR", iso: "kr" },
  "Czechia": { code: "CZE", iso: "cz" },
  "Canada": { code: "CAN", iso: "ca" },
  "Bosnia and Herzegovina": { code: "BIH", iso: "ba" },
  "Qatar": { code: "QAT", iso: "qa" },
  "Switzerland": { code: "SUI", iso: "ch" },
  "Brazil": { code: "BRA", iso: "br" },
  "Morocco": { code: "MAR", iso: "ma" },
  "Haiti": { code: "HAI", iso: "ht" },
  "Scotland": { code: "SCO", iso: "gb-sct" },
  "United States": { code: "USA", iso: "us" },
  "Paraguay": { code: "PAR", iso: "py" },
  "Australia": { code: "AUS", iso: "au" },
  "Türkiye": { code: "TUR", iso: "tr" },
  "Germany": { code: "GER", iso: "de" },
  "Curaçao": { code: "CUW", iso: "cw" },
  "Ivory Coast": { code: "CIV", iso: "ci" },
  "Ecuador": { code: "ECU", iso: "ec" },
  "Netherlands": { code: "NED", iso: "nl" },
  "Japan": { code: "JPN", iso: "jp" },
  "Sweden": { code: "SWE", iso: "se" },
  "Tunisia": { code: "TUN", iso: "tn" },
  "Belgium": { code: "BEL", iso: "be" },
  "Egypt": { code: "EGY", iso: "eg" },
  "Iran": { code: "IRN", iso: "ir" },
  "New Zealand": { code: "NZL", iso: "nz" },
  "Spain": { code: "ESP", iso: "es" },
  "Cape Verde": { code: "CPV", iso: "cv" },
  "Saudi Arabia": { code: "KSA", iso: "sa" },
  "Uruguay": { code: "URU", iso: "uy" },
  "France": { code: "FRA", iso: "fr" },
  "Senegal": { code: "SEN", iso: "sn" },
  "Iraq": { code: "IRQ", iso: "iq" },
  "Norway": { code: "NOR", iso: "no" },
  "Argentina": { code: "ARG", iso: "ar" },
  "Algeria": { code: "ALG", iso: "dz" },
  "Austria": { code: "AUT", iso: "at" },
  "Jordan": { code: "JOR", iso: "jo" },
  "Portugal": { code: "POR", iso: "pt" },
  "DR Congo": { code: "COD", iso: "cd" },
  "Uzbekistan": { code: "UZB", iso: "uz" },
  "Colombia": { code: "COL", iso: "co" },
  "England": { code: "ENG", iso: "gb-eng" },
  "Croatia": { code: "CRO", iso: "hr" },
  "Ghana": { code: "GHA", iso: "gh" },
  "Panama": { code: "PAN", iso: "pa" },
};

const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czechia"],
  B: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Türkiye"],
  E: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Sweden", "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Iraq", "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

const MATCHES = [
  // ========== MATCHDAY 1 ==========
  // June 11
  { id: 1, date: "2026-06-11", group: "A", home: "Mexico", away: "South Africa", homeScore: 2, awayScore: 0, completed: true },
  { id: 2, date: "2026-06-11", group: "A", home: "South Korea", away: "Czechia", homeScore: 2, awayScore: 1, completed: true },
  // June 12
  { id: 3, date: "2026-06-12", group: "B", home: "Canada", away: "Bosnia and Herzegovina", homeScore: 1, awayScore: 1, completed: true },
  { id: 4, date: "2026-06-12", group: "D", home: "United States", away: "Paraguay", homeScore: 4, awayScore: 1, completed: true },
  // June 13
  { id: 5, date: "2026-06-13", group: "B", home: "Qatar", away: "Switzerland", homeScore: 1, awayScore: 1, completed: true },
  { id: 6, date: "2026-06-13", group: "C", home: "Brazil", away: "Morocco", homeScore: 1, awayScore: 1, completed: true },
  { id: 7, date: "2026-06-13", group: "C", home: "Haiti", away: "Scotland", homeScore: 0, awayScore: 1, completed: true },
  { id: 8, date: "2026-06-13", group: "D", home: "Australia", away: "Türkiye", homeScore: 2, awayScore: 0, completed: true },
  // June 14
  { id: 9, date: "2026-06-14", group: "E", home: "Germany", away: "Curaçao", homeScore: 7, awayScore: 1, completed: true },
  { id: 10, date: "2026-06-14", group: "F", home: "Netherlands", away: "Japan", homeScore: 2, awayScore: 2, completed: true },
  { id: 11, date: "2026-06-14", group: "E", home: "Ivory Coast", away: "Ecuador", homeScore: 1, awayScore: 0, completed: true },
  { id: 12, date: "2026-06-14", group: "F", home: "Sweden", away: "Tunisia", homeScore: 5, awayScore: 1, completed: true },
  // June 15
  { id: 13, date: "2026-06-15", group: "H", home: "Spain", away: "Cape Verde", homeScore: 0, awayScore: 0, completed: true },
  { id: 14, date: "2026-06-15", group: "G", home: "Belgium", away: "Egypt", homeScore: 1, awayScore: 1, completed: true },
  { id: 15, date: "2026-06-15", group: "H", home: "Saudi Arabia", away: "Uruguay", homeScore: 1, awayScore: 1, completed: true },
  { id: 16, date: "2026-06-15", group: "G", home: "Iran", away: "New Zealand", homeScore: 2, awayScore: 2, completed: true },
  // June 16
  { id: 17, date: "2026-06-16", group: "I", home: "France", away: "Senegal", homeScore: null, awayScore: null, completed: false },
  { id: 18, date: "2026-06-16", group: "I", home: "Iraq", away: "Norway", homeScore: null, awayScore: null, completed: false },
  { id: 19, date: "2026-06-16", group: "J", home: "Argentina", away: "Algeria", homeScore: null, awayScore: null, completed: false },
  { id: 20, date: "2026-06-16", group: "J", home: "Austria", away: "Jordan", homeScore: null, awayScore: null, completed: false },
  // June 17
  { id: 21, date: "2026-06-17", group: "K", home: "Portugal", away: "DR Congo", homeScore: null, awayScore: null, completed: false },
  { id: 22, date: "2026-06-17", group: "L", home: "England", away: "Croatia", homeScore: null, awayScore: null, completed: false },
  { id: 23, date: "2026-06-17", group: "L", home: "Ghana", away: "Panama", homeScore: null, awayScore: null, completed: false },
  { id: 24, date: "2026-06-17", group: "K", home: "Uzbekistan", away: "Colombia", homeScore: null, awayScore: null, completed: false },

  // ========== MATCHDAY 2 ==========
  // June 18
  { id: 25, date: "2026-06-18", group: "A", home: "Czechia", away: "South Africa", homeScore: null, awayScore: null, completed: false },
  { id: 26, date: "2026-06-18", group: "B", home: "Switzerland", away: "Bosnia and Herzegovina", homeScore: null, awayScore: null, completed: false },
  { id: 27, date: "2026-06-18", group: "B", home: "Canada", away: "Qatar", homeScore: null, awayScore: null, completed: false },
  { id: 28, date: "2026-06-18", group: "A", home: "Mexico", away: "South Korea", homeScore: null, awayScore: null, completed: false },
  // June 19
  { id: 29, date: "2026-06-19", group: "D", home: "United States", away: "Australia", homeScore: null, awayScore: null, completed: false },
  { id: 30, date: "2026-06-19", group: "C", home: "Scotland", away: "Morocco", homeScore: null, awayScore: null, completed: false },
  { id: 31, date: "2026-06-19", group: "C", home: "Brazil", away: "Haiti", homeScore: null, awayScore: null, completed: false },
  { id: 32, date: "2026-06-19", group: "D", home: "Türkiye", away: "Paraguay", homeScore: null, awayScore: null, completed: false },
  // June 20
  { id: 33, date: "2026-06-20", group: "F", home: "Netherlands", away: "Sweden", homeScore: null, awayScore: null, completed: false },
  { id: 34, date: "2026-06-20", group: "E", home: "Germany", away: "Ivory Coast", homeScore: null, awayScore: null, completed: false },
  { id: 35, date: "2026-06-20", group: "E", home: "Ecuador", away: "Curaçao", homeScore: null, awayScore: null, completed: false },
  { id: 36, date: "2026-06-20", group: "F", home: "Tunisia", away: "Japan", homeScore: null, awayScore: null, completed: false },
  // June 21
  { id: 37, date: "2026-06-21", group: "H", home: "Spain", away: "Saudi Arabia", homeScore: null, awayScore: null, completed: false },
  { id: 38, date: "2026-06-21", group: "G", home: "Belgium", away: "Iran", homeScore: null, awayScore: null, completed: false },
  { id: 39, date: "2026-06-21", group: "H", home: "Uruguay", away: "Cape Verde", homeScore: null, awayScore: null, completed: false },
  { id: 40, date: "2026-06-21", group: "G", home: "New Zealand", away: "Egypt", homeScore: null, awayScore: null, completed: false },
  // June 22
  { id: 41, date: "2026-06-22", group: "J", home: "Argentina", away: "Austria", homeScore: null, awayScore: null, completed: false },
  { id: 42, date: "2026-06-22", group: "I", home: "France", away: "Iraq", homeScore: null, awayScore: null, completed: false },
  { id: 43, date: "2026-06-22", group: "I", home: "Norway", away: "Senegal", homeScore: null, awayScore: null, completed: false },
  { id: 44, date: "2026-06-22", group: "J", home: "Jordan", away: "Algeria", homeScore: null, awayScore: null, completed: false },
  // June 23
  { id: 45, date: "2026-06-23", group: "K", home: "Portugal", away: "Uzbekistan", homeScore: null, awayScore: null, completed: false },
  { id: 46, date: "2026-06-23", group: "L", home: "England", away: "Ghana", homeScore: null, awayScore: null, completed: false },
  { id: 47, date: "2026-06-23", group: "L", home: "Panama", away: "Croatia", homeScore: null, awayScore: null, completed: false },
  { id: 48, date: "2026-06-23", group: "K", home: "Colombia", away: "DR Congo", homeScore: null, awayScore: null, completed: false },

  // ========== MATCHDAY 3 (simultaneous within groups) ==========
  // June 24
  { id: 49, date: "2026-06-24", group: "B", home: "Switzerland", away: "Canada", homeScore: null, awayScore: null, completed: false },
  { id: 50, date: "2026-06-24", group: "B", home: "Bosnia and Herzegovina", away: "Qatar", homeScore: null, awayScore: null, completed: false },
  { id: 51, date: "2026-06-24", group: "C", home: "Scotland", away: "Brazil", homeScore: null, awayScore: null, completed: false },
  { id: 52, date: "2026-06-24", group: "C", home: "Morocco", away: "Haiti", homeScore: null, awayScore: null, completed: false },
  { id: 53, date: "2026-06-24", group: "A", home: "Czechia", away: "Mexico", homeScore: null, awayScore: null, completed: false },
  { id: 54, date: "2026-06-24", group: "A", home: "South Africa", away: "South Korea", homeScore: null, awayScore: null, completed: false },
  // June 25
  { id: 55, date: "2026-06-25", group: "E", home: "Curaçao", away: "Ivory Coast", homeScore: null, awayScore: null, completed: false },
  { id: 56, date: "2026-06-25", group: "E", home: "Ecuador", away: "Germany", homeScore: null, awayScore: null, completed: false },
  { id: 57, date: "2026-06-25", group: "F", home: "Japan", away: "Sweden", homeScore: null, awayScore: null, completed: false },
  { id: 58, date: "2026-06-25", group: "F", home: "Tunisia", away: "Netherlands", homeScore: null, awayScore: null, completed: false },
  { id: 59, date: "2026-06-25", group: "D", home: "Türkiye", away: "United States", homeScore: null, awayScore: null, completed: false },
  { id: 60, date: "2026-06-25", group: "D", home: "Paraguay", away: "Australia", homeScore: null, awayScore: null, completed: false },
  // June 26
  { id: 61, date: "2026-06-26", group: "I", home: "Norway", away: "France", homeScore: null, awayScore: null, completed: false },
  { id: 62, date: "2026-06-26", group: "I", home: "Senegal", away: "Iraq", homeScore: null, awayScore: null, completed: false },
  { id: 63, date: "2026-06-26", group: "H", home: "Cape Verde", away: "Saudi Arabia", homeScore: null, awayScore: null, completed: false },
  { id: 64, date: "2026-06-26", group: "H", home: "Uruguay", away: "Spain", homeScore: null, awayScore: null, completed: false },
  { id: 65, date: "2026-06-26", group: "G", home: "Egypt", away: "Iran", homeScore: null, awayScore: null, completed: false },
  { id: 66, date: "2026-06-26", group: "G", home: "New Zealand", away: "Belgium", homeScore: null, awayScore: null, completed: false },
  // June 27
  { id: 67, date: "2026-06-27", group: "L", home: "Panama", away: "England", homeScore: null, awayScore: null, completed: false },
  { id: 68, date: "2026-06-27", group: "L", home: "Croatia", away: "Ghana", homeScore: null, awayScore: null, completed: false },
  { id: 69, date: "2026-06-27", group: "K", home: "Colombia", away: "Portugal", homeScore: null, awayScore: null, completed: false },
  { id: 70, date: "2026-06-27", group: "K", home: "DR Congo", away: "Uzbekistan", homeScore: null, awayScore: null, completed: false },
  { id: 71, date: "2026-06-27", group: "J", home: "Algeria", away: "Austria", homeScore: null, awayScore: null, completed: false },
  { id: 72, date: "2026-06-27", group: "J", home: "Jordan", away: "Argentina", homeScore: null, awayScore: null, completed: false },
];



// ============================================================
//  BRACKET CONFIG
// ============================================================
// R32 is resolved from group standings. This mapping is intentionally kept
// here so it is easy to adjust if your sheet uses a different knockout path.
const BRACKET_POINTS = {
  r32: 1,
  r16: 2,
  qf: 4,
  sf: 6,
  bronze: 6,
  final: 10,
  champion: 15,
};

const BRACKET_ROUNDS = [
  { key: "r32", label: "ROUND OF 32", short: "R32", slots: 32, points: BRACKET_POINTS.r32 },
  { key: "r16", label: "ROUND OF 16", short: "R16", slots: 16, points: BRACKET_POINTS.r16 },
  { key: "qf", label: "QUARTER-FINALS", short: "QF", slots: 8, points: BRACKET_POINTS.qf },
  { key: "sf", label: "SEMI-FINALS", short: "SF", slots: 4, points: BRACKET_POINTS.sf },
  { key: "bronze", label: "THIRD-PLACE MATCH", short: "BRONZE", slots: 2, points: BRACKET_POINTS.bronze },
  { key: "final", label: "FINAL", short: "FINAL", slots: 2, points: BRACKET_POINTS.final },
  { key: "champion", label: "CHAMPION", short: "WINNER", slots: 1, points: BRACKET_POINTS.champion },
];

const BRACKET_R32_MATCHES = [
  [{ type: "groupRank", group: "A", rank: 1 }, { type: "bestThird", rank: 8 }],
  [{ type: "groupRank", group: "B", rank: 1 }, { type: "bestThird", rank: 7 }],
  [{ type: "groupRank", group: "C", rank: 1 }, { type: "bestThird", rank: 6 }],
  [{ type: "groupRank", group: "D", rank: 1 }, { type: "bestThird", rank: 5 }],
  [{ type: "groupRank", group: "E", rank: 1 }, { type: "bestThird", rank: 4 }],
  [{ type: "groupRank", group: "F", rank: 1 }, { type: "bestThird", rank: 3 }],
  [{ type: "groupRank", group: "G", rank: 1 }, { type: "bestThird", rank: 2 }],
  [{ type: "groupRank", group: "H", rank: 1 }, { type: "bestThird", rank: 1 }],
  [{ type: "groupRank", group: "I", rank: 1 }, { type: "groupRank", group: "J", rank: 2 }],
  [{ type: "groupRank", group: "J", rank: 1 }, { type: "groupRank", group: "I", rank: 2 }],
  [{ type: "groupRank", group: "K", rank: 1 }, { type: "groupRank", group: "L", rank: 2 }],
  [{ type: "groupRank", group: "L", rank: 1 }, { type: "groupRank", group: "K", rank: 2 }],
  [{ type: "groupRank", group: "A", rank: 2 }, { type: "groupRank", group: "B", rank: 2 }],
  [{ type: "groupRank", group: "C", rank: 2 }, { type: "groupRank", group: "D", rank: 2 }],
  [{ type: "groupRank", group: "E", rank: 2 }, { type: "groupRank", group: "F", rank: 2 }],
  [{ type: "groupRank", group: "G", rank: 2 }, { type: "groupRank", group: "H", rank: 2 }],
];

const ACHIEVEMENTS = [
  { id: "first_blood", name: "First Blood", desc: "Get your first correct outcome prediction", icon: "\u{2694}\u{FE0F}" },
  { id: "oracle", name: "Oracle", desc: "5 perfect score predictions", icon: "\u{1F52E}" },
  { id: "hat_trick", name: "Hat Trick", desc: "3 correct outcomes in a row", icon: "\u{1F3A9}" },
  { id: "on_fire", name: "On Fire", desc: "5 correct outcomes in a row", icon: "\u{1F525}" },
  { id: "unstoppable", name: "Unstoppable", desc: "10 correct outcomes in a row", icon: "\u{1F4A5}" },
  { id: "sniper", name: "Sniper", desc: "3 perfect scores in a row", icon: "\u{1F3AF}" },
  { id: "clean_sheet", name: "Clean Sheet", desc: "Correctly predict a 0-0 draw", icon: "\u{1F9E4}" },
  { id: "goal_fest", name: "Goal Fest", desc: "Correctly predict a match with 5+ goals", icon: "\u{26BD}" },
  { id: "giant_killer", name: "Giant Killer", desc: "Predict an upset correctly", icon: "\u{1F4AA}" },
  { id: "consistent", name: "Consistent", desc: "10 correct outcome predictions total", icon: "\u{1F4C8}" },
  { id: "whale", name: "Whale", desc: "Reach 2000 NOK betting balance", icon: "\u{1F433}" },
  { id: "broke", name: "Broke", desc: "Drop below 200 NOK betting balance", icon: "\u{1F4B8}" },
  { id: "perfect_day", name: "Perfect Day", desc: "All predictions correct for a match day", icon: "\u{2B50}" },
  { id: "group_master", name: "Group Master", desc: "All outcomes correct for an entire group", icon: "\u{1F451}" },
  { id: "lone_wolf", name: "Lone Wolf", desc: "Be the only player to correctly predict the outcome", icon: "\u{1F43A}" },
  { id: "lone_wolf_plus", name: "Lone Wolf +", desc: "Be the only player to nail a perfect score", icon: "\u{1F43A}\u{2728}" },
  { id: "comeback_king", name: "Comeback King", desc: "Go from last place to first place", icon: "\u{1F680}" },
  { id: "bottler", name: "Bottler", desc: "Lose first place after leading for 3+ matchdays", icon: "\u{1F37E}" },
];
