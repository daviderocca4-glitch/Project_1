'use strict';

const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1/';

const Api = {
  TTL_LIST: 7 * 24 * 3600 * 1000,
  TTL_DETAIL: 30 * 24 * 3600 * 1000,

  cacheKey(path) {
    return 'dt.cache.' + path;
  },

  readCache(path) {
    try {
      const raw = localStorage.getItem(this.cacheKey(path));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.t > entry.ttl) return null;
      return entry.data;
    } catch (e) {
      return null;
    }
  },

  writeCache(path, data, ttl) {
    try {
      localStorage.setItem(this.cacheKey(path), JSON.stringify({ t: Date.now(), ttl, data }));
    } catch (e) { /* storage pieno: ignora */ }
  },

  async fetchJSON(path, ttl) {
    const cached = this.readCache(path);
    if (cached) return cached;

    let res;
    try {
      res = await fetch(API_BASE + path, { headers: { Accept: 'application/json' } });
    } catch (e) {
      throw new Error('Rete non disponibile');
    }

    if (!res.ok) {
      throw new Error('Errore del server (' + res.status + ')');
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Risposta del server non valida');
    }

    if (data && Array.isArray(data.drinks) && data.drinks.length) {
      this.writeCache(path, data, ttl);
    }
    return data;
  },

  listCategories() {
    return this.fetchJSON('list.php?c=list', this.TTL_LIST);
  },

  drinksByLetter(letter) {
    return this.fetchJSON('search.php?f=' + encodeURIComponent(letter), this.TTL_LIST);
  },

  drinksByCategory(cat) {
    return this.fetchJSON('filter.php?c=' + encodeURIComponent(cat), this.TTL_LIST);
  },

  searchByName(q) {
    return this.fetchJSON('search.php?s=' + encodeURIComponent(q), this.TTL_DETAIL);
  },

  drinkDetail(id) {
    return this.fetchJSON('lookup.php?id=' + encodeURIComponent(id), this.TTL_DETAIL);
  }
};

window.Api = Api;
