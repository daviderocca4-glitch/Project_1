'use strict';

const Store = {
  KEY: 'dt.drunk.v1',
  _set: null,

  load() {
    if (this._set) return this._set;
    try {
      const raw = localStorage.getItem(this.KEY);
      this._set = new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      this._set = new Set();
    }
    return this._set;
  },

  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify([...this.load()]));
    } catch (e) { /* storage pieno: ignora */ }
  },

  isDrunk(id) {
    return this.load().has(String(id));
  },

  toggle(id) {
    const set = this.load();
    const key = String(id);
    if (set.has(key)) {
      set.delete(key);
      this.save();
      return false;
    }
    set.add(key);
    this.save();
    return true;
  },

  count() {
    return this.load().size;
  }
};

window.Store = Store;
