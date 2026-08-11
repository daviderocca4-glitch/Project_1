'use strict';

(() => {
  const $ = (sel) => document.querySelector(sel);

  const els = {
    grid: $('#grid'),
    status: $('#status'),
    stats: $('#stats'),
    progressWrap: $('#progressWrap'),
    progressFill: $('#progressFill'),
    progressLabel: $('#progressLabel'),
    segButtons: Array.from(document.querySelectorAll('.seg-btn')),
    search: $('#search'),
    filterCategory: $('#filterCategory'),
    filterAlcoholic: $('#filterAlcoholic'),
    filterIngredient: $('#filterIngredient'),
    ingredientList: $('#ingredientList'),
    clearFilters: $('#clearFilters'),
    modal: $('#modal'),
    detail: $('#detail'),
    installBtn: $('#installBtn')
  };

  const state = {
    all: [],        // drink completi: {id, name, thumb, category, alcoholic, ingredients[], measures[], categories:Set}
    list: [],       // drink attualmente mostrati
    search: '',
    filter: null,
    stateFilter: '',
    detailId: null,
    deferredPrompt: null
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const thumb = (t, size) => {
    if (!t) return '';
    const s = size || 'small';
    return t.replace(/\.(jpg|jpeg|png|gif)$/i, '.$1/' + s);
  };

  const norm = (d, categories) => {
    const out = {
      id: d.idDrink,
      name: d.strDrink,
      thumb: d.strDrinkThumb,
      category: d.strCategory || '',
      alcoholic: d.strAlcoholic || '',
      ingredients: collectIngredients(d),
      measures: collectMeasures(d),
      instructions: String(d.strInstructions || '').trim(),
      categories: categories || null,
      abv: null
    };
    out.abv = Abv.estimate(out);
    return out;
  };

  function collectIngredients(d) {
    const out = [];
    for (let i = 1; i <= 15; i++) {
      const name = d['strIngredient' + i];
      if (name && String(name).trim()) out.push(String(name).trim());
    }
    return out;
  }

  function collectMeasures(d) {
    const out = [];
    for (let i = 1; i <= 15; i++) {
      out.push(String(d['strMeasure' + i] || '').trim());
    }
    return out;
  }

  const spinnerHtml = () => '<div class="spinner"></div>';

  const cardHtml = (d) => {
    const drunk = Store.isDrunk(d.id);
    const abv = d.abv || Abv.estimate(d);
    return (
      '<article class="card' + (drunk ? ' card-drunk' : '') + '" data-id="' + esc(d.id) + '" tabindex="0" role="button" aria-label="' + esc(d.name) + '">' +
        '<div class="card-img">' +
          '<img loading="lazy" src="' + esc(thumb(d.thumb)) + '" alt="' + esc(d.name) + '" onerror="this.style.display=\'none\'">' +
          (drunk ? '<span class="badge">Bevuto</span>' : '') +
          (abv ? '<span class="abv-chip abv-' + abv.cls + '">~' + abv.abv + '%</span>' : '') +
        '</div>' +
        '<div class="card-body">' +
          '<h3>' + esc(d.name) + '</h3>' +
          '<button class="btn-drunk' + (drunk ? ' is-drunk' : '') + '" data-toggle="' + esc(d.id) + '" aria-pressed="' + drunk + '">' +
            (drunk ? '&#10003; Bevuto' : 'Da bere') +
          '</button>' +
        '</div>' +
      '</article>'
    );
  };

  function applyStateFilter(list) {
    if (!state.stateFilter) return list;
    const drunk = state.stateFilter === 'drunk';
    return list.filter((d) => Store.isDrunk(d.id) === drunk);
  }

  function updateStats() {
    if (state.list.length) {
      els.stats.textContent = state.list.length + ' drink mostrati · ' + Store.count() + ' bevuti';
    } else if (!state.all.length) {
      els.stats.textContent = '';
    } else {
      els.stats.textContent = '0 drink mostrati · ' + Store.count() + ' bevuti';
    }
    const total = state.all.length;
    const drunk = Store.count();
    if (total > 0) {
      els.progressWrap.hidden = false;
      const pct = Math.round((drunk / total) * 100);
      els.progressFill.style.width = pct + '%';
      els.progressLabel.textContent = drunk + ' di ' + total + ' bevuti (' + pct + '%)';
    } else {
      els.progressWrap.hidden = true;
    }
  }

  function renderList(list) {
    state.list = applyStateFilter(list);
    if (!state.list.length) {
      els.grid.innerHTML = '<p class="empty">' +
        (state.stateFilter ? 'Nessun drink in questo elenco.' : 'Nessun drink trovato.') +
        '</p>';
    } else {
      els.grid.innerHTML = state.list.map(cardHtml).join('');
    }
    updateStats();
  }

  function setStatus(msg, isError) {
    if (!msg) {
      els.status.hidden = true;
      els.status.className = 'status';
      els.status.textContent = '';
      return;
    }
    els.status.hidden = false;
    els.status.className = 'status' + (isError ? ' error' : '');
    els.status.textContent = msg;
  }

  function showError(msg) {
    setStatus(msg, true);
  }

  async function apiSearch(q) {
    const data = await Api.searchByName(q);
    return (data && data.drinks ? data.drinks : []).map(norm);
  }

  async function applyView() {
    const q = state.search.toLowerCase();
    if (q) {
      let hits = state.all.filter((d) => d.name.toLowerCase().indexOf(q) !== -1);
      if (!hits.length) {
        setStatus('Cerco online…');
        try {
          hits = await apiSearch(q);
          setStatus('');
        } catch (e) {
          showError('Ricerca non riuscita: ' + e.message);
          return;
        }
      }
      renderList(hits);
      return;
    }

    if (state.filter) {
      let hits;
      if (state.filter.type === 'category') {
        hits = state.all.filter((d) => d.categories && d.categories.has(state.filter.value));
      } else if (state.filter.type === 'alcoholic') {
        const want = state.filter.value === 'Non_Alcoholic' ? 'non alcoholic' : 'alcoholic';
        hits = state.all.filter((d) => d.alcoholic && d.alcoholic.toLowerCase().indexOf(want) !== -1);
      } else {
        const ing = state.filter.value.toLowerCase();
        hits = state.all.filter((d) => d.ingredients.some((i) => i.toLowerCase().indexOf(ing) !== -1));
      }
      renderList(hits);
      return;
    }

    renderList(state.all);
  }

  function syncFilterUI() {
    const f = state.filter;
    els.filterCategory.value = f && f.type === 'category' ? f.value : '';
    els.filterAlcoholic.value = f && f.type === 'alcoholic' ? f.value : '';
    els.filterIngredient.value = f && f.type === 'ingredient' ? f.value : '';
    els.clearFilters.hidden = !f;
  }

  function setFilter(f) {
    state.filter = f;
    if (f) {
      state.search = '';
      els.search.value = '';
    }
    syncFilterUI();
    applyView();
  }

  async function fetchWithRetry(fn, retries) {
    const max = retries == null ? 1 : retries;
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= max) throw e;
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }

  async function loadAll() {
    setStatus('Caricamento drink…');
    els.status.insertAdjacentHTML('beforeend', spinnerHtml());

    try {
      const catsData = await fetchWithRetry(() => Api.listCategories(), 2);
      const cats = (catsData && catsData.drinks ? catsData.drinks : []).map((c) => c.strCategory);

      const map = new Map();
      const categoryOf = new Map();

      const addFromCategoryList = (data, cat) => {
        (data && data.drinks || []).forEach((d) => {
          categoryOf.set(d.idDrink, (categoryOf.get(d.idDrink) || new Set()).add(cat));
          if (!map.has(d.idDrink)) {
            map.set(d.idDrink, {
              id: d.idDrink,
              name: d.strDrink,
              thumb: d.strDrinkThumb,
              category: '',
              alcoholic: '',
              ingredients: [],
              measures: [],
              instructions: '',
              categories: null,
              abv: null
            });
          }
        });
      };

      const addFromLetter = (data) => {
        (data && data.drinks || []).forEach((d) => map.set(d.idDrink, norm(d)));
      };

      const letters = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');
      let done = 0;
      for (const l of letters) {
        try {
          const data = await fetchWithRetry(() => Api.drinksByLetter(l), 1);
          addFromLetter(data);
        } catch (e) { /* lettera non disponibile: salta */ }
        done++;
        els.status.firstChild.textContent = 'Caricamento drink… (' + done + '/' + letters.length + ')';
      }

      done = 0;
      for (const cat of cats) {
        try {
          const data = await fetchWithRetry(() => Api.drinksByCategory(cat), 1);
          addFromCategoryList(data, cat);
        } catch (e) { /* categoria non disponibile: salta */ }
        done++;
        els.status.firstChild.textContent = 'Caricamento categorie… (' + done + '/' + cats.length + ')';
      }

      state.all = [...map.values()];
      state.all.forEach((d) => {
        if (!d.categories || !d.categories.size) {
          const fromCat = categoryOf.get(d.id);
          if (fromCat) d.categories = fromCat;
          else if (d.category) d.categories = new Set([d.category]);
        }
      });
      state.all.sort((a, b) => a.name.localeCompare(b.name));

      setStatus('');
      renderList(state.all);
    } catch (e) {
      showError('Impossibile caricare i drink: ' + e.message);
      els.status.insertAdjacentHTML('beforeend', '<button class="btn" id="retryAll" style="margin-top:10px">Riprova</button>');
    }
  }

  function toggleDrunk(id) {
    Store.toggle(id);
    const drunk = Store.isDrunk(id);

    if (state.stateFilter) {
      const keeps = state.stateFilter === 'drunk' ? drunk : !drunk;
      if (!keeps) {
        state.list = state.list.filter((d) => d.id !== id);
        const cardEl = els.grid.querySelector('.card[data-id="' + id + '"]');
        if (cardEl) cardEl.remove();
        if (!state.list.length) {
          els.grid.innerHTML = '<p class="empty">Nessun drink in questo elenco.</p>';
        }
        const dt = els.detail.querySelector('[data-detail-toggle="' + id + '"]');
        if (dt) {
          dt.classList.toggle('is-drunk', drunk);
          dt.textContent = drunk ? '\u2713 Bevuto — togli' : 'Segna come bevuto';
        }
        updateStats();
        return;
      }
    }

    const cardEl = els.grid.querySelector('.card[data-id="' + id + '"]');
    if (cardEl) {
      cardEl.classList.toggle('card-drunk', drunk);
      const imgBox = cardEl.querySelector('.card-img');
      const badge = imgBox.querySelector('.badge');
      if (drunk && !badge) {
        imgBox.insertAdjacentHTML('beforeend', '<span class="badge">Bevuto</span>');
      } else if (!drunk && badge) {
        badge.remove();
      }
      const btn = cardEl.querySelector('[data-toggle]');
      if (btn) {
        btn.classList.toggle('is-drunk', drunk);
        btn.setAttribute('aria-pressed', String(drunk));
        btn.innerHTML = drunk ? '&#10003; Bevuto' : 'Da bere';
      }
    }

    const dt = els.detail.querySelector('[data-detail-toggle="' + id + '"]');
    if (dt) {
      dt.classList.toggle('is-drunk', drunk);
      dt.textContent = drunk ? '\u2713 Bevuto — togli' : 'Segna come bevuto';
    }

    updateStats();
  }

  function renderDetail(d, loading) {
    const drunk = Store.isDrunk(d.id);
    const abv = d.abv || Abv.estimate(d);
    const meta = [d.category, d.alcoholic].filter(Boolean).join(' · ');
    const ings = d.ingredients.map((name, i) => {
      return '<li><span class="measure">' + esc(d.measures[i] || '') + '</span>' + esc(name) + '</li>';
    }).join('');
    els.detail.innerHTML =
      '<img class="detail-img" src="' + esc(thumb(d.thumb, 'medium')) + '" alt="' + esc(d.name) + '" onerror="this.style.display=\'none\'">' +
      '<h2>' + esc(d.name) + '</h2>' +
      (meta ? '<p class="detail-meta">' + esc(meta) + '</p>' : '') +
      (abv ? '<p class="abv-line"><span class="abv-badge abv-' + abv.cls + '">~' + abv.abv + '% vol</span> ' + esc(abv.label) + '</p>' : '') +
      '<h3>Ingredienti</h3>' +
      (ings || loading
        ? '<ul class="ingredients">' + (ings || '<li class="measure">Caricamento…</li>') + '</ul>'
        : '<p class="instructions">Nessun ingrediente indicato.</p>') +
      (d.instructions ? '<h3>Preparazione</h3><p class="instructions">' + esc(d.instructions) + '</p>' : '') +
      '<button class="btn-primary detail-toggle' + (drunk ? ' is-drunk' : '') + '" data-detail-toggle="' + esc(d.id) + '">' +
        (drunk ? '\u2713 Bevuto — togli' : 'Segna come bevuto') +
      '</button>';
  }

  function showModal() {
    els.modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function hideModal() {
    els.modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  async function openDetail(id) {
    state.detailId = id;
    const local = state.all.find((d) => d.id === id);
    showModal();

    if (local && local.ingredients.length) {
      renderDetail(local);
      return;
    }

    if (local) {
      renderDetail(local, true);
    } else {
      els.detail.innerHTML = spinnerHtml();
    }

    try {
      const data = await Api.drinkDetail(id);
      if (!data || !Array.isArray(data.drinks) || !data.drinks.length) throw new Error('vuoto');
      renderDetail(norm(data.drinks[0]));
      return;
    } catch (e) { /* prova con la ricerca */ }

    try {
      const base = state.all.find((d) => d.id === id);
      const q = base ? base.name : id;
      const hits = await apiSearch(q);
      const found = hits.find((h) => h.id === id) || hits[0];
      if (!found) throw new Error('non trovato');
      renderDetail(found);
    } catch (e) {
      els.detail.innerHTML = '<p class="error">Dettaglio non disponibile: ' + esc(e.message) + '</p>' +
        '<button class="btn" data-retry="' + esc(id) + '" style="width:100%;margin-top:10px">Riprova</button>';
    }
  }

  function bindEvents() {
    els.status.addEventListener('click', (e) => {
      if (e.target.id === 'retryAll') loadAll();
    });

    els.grid.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-toggle]');
      if (toggleBtn) {
        e.stopPropagation();
        toggleDrunk(toggleBtn.dataset.toggle);
        return;
      }
      const cardEl = e.target.closest('.card');
      if (cardEl) openDetail(cardEl.dataset.id);
    });

    els.grid.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const cardEl = e.target.closest('.card');
        if (cardEl && !e.target.closest('button')) {
          e.preventDefault();
          openDetail(cardEl.dataset.id);
        }
      }
    });

    els.detail.addEventListener('click', (e) => {
      const t = e.target.closest('[data-detail-toggle]');
      if (t) {
        toggleDrunk(t.dataset.detailToggle);
        return;
      }
      const r = e.target.closest('[data-retry]');
      if (r) openDetail(r.dataset.retry);
    });

    els.modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) hideModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideModal();
    });

    let searchTimer = null;
    els.search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = els.search.value.trim();
        if (state.search) {
          state.filter = null;
          syncFilterUI();
        }
        applyView();
      }, 250);
    });

    els.filterCategory.addEventListener('change', () => {
      const v = els.filterCategory.value;
      setFilter(v ? { type: 'category', value: v } : null);
    });

    els.filterAlcoholic.addEventListener('change', () => {
      const v = els.filterAlcoholic.value;
      setFilter(v ? { type: 'alcoholic', value: v } : null);
    });

    els.filterIngredient.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = els.filterIngredient.value.trim();
        setFilter(v ? { type: 'ingredient', value: v } : null);
      }
    });

    els.clearFilters.addEventListener('click', () => setFilter(null));

    els.segButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        state.stateFilter = btn.dataset.state;
        els.segButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        applyView();
      });
    });

    els.installBtn.addEventListener('click', async () => {
      if (!state.deferredPrompt) return;
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice;
      state.deferredPrompt = null;
      els.installBtn.hidden = true;
    });
  }

  async function initFilters() {
    try {
      const catsData = await Api.listCategories();
      (catsData && catsData.drinks || []).forEach((c) => {
        els.filterCategory.insertAdjacentHTML(
          'beforeend',
          '<option value="' + esc(c.strCategory) + '">' + esc(c.strCategory) + '</option>'
        );
      });
    } catch (e) { /* filtri non vitali */ }

    const names = new Set();
    state.all.forEach((d) => d.ingredients.forEach((i) => names.add(i)));
    els.ingredientList.innerHTML = [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((i) => '<option value="' + esc(i) + '"></option>')
      .join('');
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
  }

  function bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      els.installBtn.hidden = false;
    });
  }

  async function init() {
    bindEvents();
    bindInstallPrompt();
    registerSW();
    await loadAll();
    initFilters();
  }

  init();
})();
