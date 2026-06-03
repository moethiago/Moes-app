// ============================================================
// wc-data.js — World Cup 2026 static reference data
// 12 groups (48 teams), host cities. Edit if FIFA revises.
// ============================================================

var WC_GROUPS = {
  'Group A': ['Mexico', 'South Africa', 'South Korea', 'Czech Republic'],
  'Group B': ['Canada', 'Bosnia & Herzegovina', 'Qatar', 'Switzerland'],
  'Group C': ['Brazil', 'Morocco', 'Haiti', 'Scotland'],
  'Group D': ['USA', 'Paraguay', 'Australia', 'Turkey'],
  'Group E': ['Germany', 'Curacao', 'Ivory Coast', 'Ecuador'],
  'Group F': ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  'Group G': ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  'Group H': ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'],
  'Group I': ['France', 'Senegal', 'Iraq', 'Norway'],
  'Group J': ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  'Group K': ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
  'Group L': ['England', 'Croatia', 'Ghana', 'Panama'],
};

// The user's team to highlight/track throughout the tab.
var WC_MY_TEAM = 'Saudi Arabia';

var WC_HOST_CITIES = [
  'Mexico City', 'Guadalajara', 'Monterrey', 'Toronto', 'Vancouver',
  'Atlanta', 'Boston', 'Dallas', 'Houston', 'Kansas City', 'Los Angeles',
  'Miami', 'New York/New Jersey', 'Philadelphia', 'San Francisco Bay Area', 'Seattle'
];

// Flag emoji by country (best-effort; falls back to a soccer ball).
var WC_FLAGS = {
  'Mexico':'\u{1F1F2}\u{1F1FD}','South Africa':'\u{1F1FF}\u{1F1E6}','South Korea':'\u{1F1F0}\u{1F1F7}','Czech Republic':'\u{1F1E8}\u{1F1FF}',
  'Canada':'\u{1F1E8}\u{1F1E6}','Bosnia & Herzegovina':'\u{1F1E7}\u{1F1E6}','Qatar':'\u{1F1F6}\u{1F1E6}','Switzerland':'\u{1F1E8}\u{1F1ED}',
  'Brazil':'\u{1F1E7}\u{1F1F7}','Morocco':'\u{1F1F2}\u{1F1E6}','Haiti':'\u{1F1ED}\u{1F1F9}','Scotland':'\u{1F3F4}',
  'USA':'\u{1F1FA}\u{1F1F8}','Paraguay':'\u{1F1F5}\u{1F1FE}','Australia':'\u{1F1E6}\u{1F1FA}','Turkey':'\u{1F1F9}\u{1F1F7}',
  'Germany':'\u{1F1E9}\u{1F1EA}','Curacao':'\u{1F1E8}\u{1F1FC}','Ivory Coast':'\u{1F1E8}\u{1F1EE}','Ecuador':'\u{1F1EA}\u{1F1E8}',
  'Netherlands':'\u{1F1F3}\u{1F1F1}','Japan':'\u{1F1EF}\u{1F1F5}','Sweden':'\u{1F1F8}\u{1F1EA}','Tunisia':'\u{1F1F9}\u{1F1F3}',
  'Belgium':'\u{1F1E7}\u{1F1EA}','Egypt':'\u{1F1EA}\u{1F1EC}','Iran':'\u{1F1EE}\u{1F1F7}','New Zealand':'\u{1F1F3}\u{1F1FF}',
  'Spain':'\u{1F1EA}\u{1F1F8}','Cape Verde':'\u{1F1E8}\u{1F1FB}','Saudi Arabia':'\u{1F1F8}\u{1F1E6}','Uruguay':'\u{1F1FA}\u{1F1FE}',
  'France':'\u{1F1EB}\u{1F1F7}','Senegal':'\u{1F1F8}\u{1F1F3}','Iraq':'\u{1F1EE}\u{1F1F6}','Norway':'\u{1F1F3}\u{1F1F4}',
  'Argentina':'\u{1F1E6}\u{1F1F7}','Algeria':'\u{1F1E9}\u{1F1FF}','Austria':'\u{1F1E6}\u{1F1F9}','Jordan':'\u{1F1EF}\u{1F1F4}',
  'Portugal':'\u{1F1F5}\u{1F1F9}','DR Congo':'\u{1F1E8}\u{1F1E9}','Uzbekistan':'\u{1F1FA}\u{1F1FF}','Colombia':'\u{1F1E8}\u{1F1F4}',
  'England':'\u{1F3F4}','Croatia':'\u{1F1ED}\u{1F1F7}','Ghana':'\u{1F1EC}\u{1F1ED}','Panama':'\u{1F1F5}\u{1F1E6}',
};

function wcFlag(team) {
  if (!team) return '\u26BD';
  // normalise common variants
  var t = team.replace('Czechia','Czech Republic');
  return WC_FLAGS[t] || '\u26BD';
}
