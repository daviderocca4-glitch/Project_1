'use strict';

const Abv = (() => {
  const DB = {
    vodka: 40, gin: 40, 'dry gin': 40, 'old tom gin': 40, 'genever': 40, 'sloe gin': 26,
    rum: 40, 'white rum': 37.5, 'light rum': 37.5, 'dark rum': 40, 'gold rum': 40,
    'spiced rum': 35, 'black rum': 40, 'jamaican rum': 40, 'coconut rum': 21,
    '151 proof rum': 75.5, bacardi: 37.5,
    tequila: 38, 'silver tequila': 38, 'gold tequila': 38, 'reposado tequila': 38, mezcal: 40,
    whiskey: 40, 'rye whiskey': 40, 'irish whiskey': 40, bourbon: 40, scotch: 40,
    'single malt scotch': 40, 'blended scotch': 40, 'canadian whisky': 40, 'jack daniels': 40,
    jameson: 40, 'jim beam': 40, 'wild turkey': 40, 'crown royal': 40, 'johnnie walker': 40,
    'smirnoff': 40, 'southern comfort': 35,
    brandy: 40, 'apple brandy': 40, 'apricot brandy': 24, 'cherry brandy': 24,
    'peach brandy': 24, cognac: 40, armagnac: 40, calvados: 40, pisco: 40, grappa: 42,
    aquavit: 40, kirsch: 40, kirschwasser: 40,
    absinthe: 60, ouzo: 37.5, pastis: 45, anisette: 30, anis: 40, anise: 40, sambuca: 38,
    raki: 40, cachaca: 40, 'cachaça': 40, everclear: 95, moonshine: 50,
    'triple sec': 30, cointreau: 40, curacao: 30, 'blue curacao': 30, 'orange curacao': 30,
    'grand marnier': 40, galliano: 30, amaretto: 28, disaronno: 28, kahlua: 20,
    'tia maria': 20, baileys: 17, 'irish cream': 17, frangelico: 20, drambuie: 40,
    jagermeister: 35, jager: 35, midori: 20, chambord: 16.5, 'creme de cassis': 15,
    'creme de menthe': 24, 'creme de cacao': 25, 'creme de banane': 24, 'creme de violette': 20,
    'creme de framboise': 20, benedictine: 40, chartreuse: 44, 'green chartreuse': 55,
    'yellow chartreuse': 40, limoncello: 30, lemoncello: 30, malibu: 21,
    'peach schnapps': 20, schnapps: 20, 'butterscotch schnapps': 20, 'peppermint schnapps': 20,
    goldschlager: 43.5, fireball: 33, 'cinnamon schnapps': 25,
    wine: 12, 'red wine': 12, 'white wine': 12, 'rose wine': 12, champagne: 12,
    prosecco: 11.5, 'sparkling wine': 12, sake: 15, 'rice wine': 15, sherry: 17.5,
    port: 20, madeira: 19, vermouth: 16, 'sweet vermouth': 16, 'dry vermouth': 16.5,
    'red vermouth': 16, 'white vermouth': 16, 'bianco vermouth': 16, 'rosso vermouth': 16,
    'martini rosso': 16, 'martini bianco': 16, 'martini extra dry': 16.5, 'punt e mes': 16,
    beer: 5, stout: 5, guinness: 4.2, cider: 5, 'hard cider': 5,
    campari: 25, aperol: 11, fernet: 39, amaro: 30, 'amaro montenegro': 23, 'angostura bitters': 44.7,
    bitters: 40, 'peychaud bitters': 40, 'orange bitters': 40, 'ginger beer': 0.5, 'ginger ale': 0
  };

  const VOLUME_ML = {
    oz: 30, 'fl oz': 30, ml: 1, cl: 10, part: 30, parts: 30, shot: 45, shots: 45,
    tsp: 5, tbsp: 15, tblsp: 15, bottle: 750, gr: 1, kg: 1000, cup: 240,
    drops: 0.05, drop: 0.05
  };

  const FILL_TARGET_ML = 180;

  const ALCOHOL_KEYWORDS = [
    'whiskey', 'whisky', 'bourbon', 'scotch', 'rum', 'vodka', 'gin', 'tequila',
    'mezcal', 'brandy', 'cognac', 'calvados', 'absinthe', 'ouzo', 'sake', 'liqueur',
    'liquor', 'schnapps', 'amaretto', 'curacao', 'vermouth', 'aperol', 'campari',
    'chartreuse', 'benedictine', 'drambuie', 'kahlua', 'baileys', 'irish cream',
    'aquavit', 'grappa', 'pisco', 'sambuca', 'pastis', 'galliano', 'limoncello',
    'malibu', 'chambord', 'triple sec', 'grand marnier', 'fireball', 'jagermeister',
    'sherry', 'port', 'beer', 'stout', 'cider', 'wine', 'champagne', 'prosecco',
    'cachaca', 'cachaça', 'sloe', 'bitters', 'amaro', 'fernet', 'sambuca', 'anise'
  ];

  const ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function numFromText(t) {
    let v = 0;
    for (const p of String(t).trim().split(/\s+/)) {
      if (p.indexOf('/') !== -1) {
        const parts = p.split('/').map(Number);
        v += parts[0] / (parts[1] || 1);
      } else {
        v += parseFloat(p) || 0;
      }
    }
    return v;
  }

  function parseMeasure(str) {
    const s = String(str == null ? '' : str).trim().toLowerCase();
    if (!s) return { type: 'unknown' };
    if (/(fill|top)\s+(up\s+)?(with|off|up)/.test(s) || /fill\s+with/.test(s)) return { type: 'fill' };
    if (s.indexOf('dash') !== -1) return { type: 'fixed', ml: 1 };
    if (s.indexOf('splash') !== -1) return { type: 'fixed', ml: 5 };
    if (/^juice of/.test(s)) return { type: 'fixed', ml: 20 };
    if (/twist|peel|wedge|slice|cherry|olive|sprig|leaves|cube|ice|salt|sugar|rim|garnish|mint|strawberry|lemon peel|orange peel|swizzle|stirrer|stick|bunch|bag/.test(s)) return { type: 'none' };
    const m = s.match(/^([0-9][0-9\/\s.,]*)\s*(fl\.?\s*oz|oz|ml|cl|parts?|shots?|tsp|tbsp|tblsp|bottles?|grs?|kgs?|drops?|cups?)?/);
    if (!m) return { type: 'unknown' };
    const qty = numFromText(m[1].replace(/,/g, '.'));
    if (!qty || qty <= 0) return { type: 'unknown' };
    const unit = (m[2] || 'part').trim();
    return { type: 'fixed', ml: (VOLUME_ML[unit] || 30) * qty };
  }

  function abvOf(name) {
    const n = String(name || '').toLowerCase().trim();
    if (!n) return 0;
    if (DB[n] != null) return DB[n];
    const keys = Object.keys(DB).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (new RegExp('\\b' + ESC(k) + '\\b').test(n)) return DB[k];
    }
    return 0;
  }

  function isAlcoholic(name) {
    const n = String(name || '').toLowerCase();
    for (const k of ALCOHOL_KEYWORDS) {
      if (new RegExp('\\b' + ESC(k) + '\\b').test(n)) return true;
    }
    return false;
  }

  function level(abv) {
    if (abv < 1) return { label: 'Analcolico', cls: 'none' };
    if (abv < 10) return { label: 'Basso', cls: 'low' };
    if (abv < 20) return { label: 'Medio', cls: 'med' };
    if (abv < 32) return { label: 'Alto', cls: 'high' };
    return { label: 'Forte', cls: 'very' };
  }

  function estimate(drink) {
    const ings = (drink && drink.ingredients) || [];
    const ms = (drink && drink.measures) || [];
    if (!ings.length) return null;

    let total = 0;
    let alcohol = 0;
    let fixedCount = 0;
    let fillAbv = 0;
    let hasFill = false;
    const abvs = [];

    for (let i = 0; i < ings.length; i++) {
      const p = parseMeasure(ms[i]);
      const abv = abvOf(ings[i]);
      abvs.push(abv);
      if (p.type === 'fixed') {
        total += p.ml;
        alcohol += p.ml * abv;
        fixedCount++;
      } else if (p.type === 'fill') {
        hasFill = true;
        fillAbv = abv;
      }
    }

    if (total > 0) {
      if (hasFill && total < FILL_TARGET_ML) {
        const fill = FILL_TARGET_ML - total;
        total += fill;
      }
      const pct = alcohol / total;
      return { abv: Math.round(pct), ...level(pct) };
    }

    const known = abvs.filter((a) => a > 0);
    if (known.length) {
      const mean = known.reduce((s, a) => s + a, 0) / abvs.length;
      return { abv: Math.round(mean), ...level(mean) };
    }

    if (abvs.length) {
      return { abv: 0, ...level(0) };
    }

    return null;
  }

  return { estimate, abvOf, isAlcoholic, level };
})();

window.Abv = Abv;
