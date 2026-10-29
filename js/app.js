window.App = (() => {
  let data, language = 'en', tab = 'home', domain = 'human', openIso = null, focusBeforeDrawer = null;
  const domains = ['human', 'animal', 'cross'];
  const mechanisms = ['X01', 'X02', 'X03', 'X04'];
  const labels = {X01:'x01', X02:'x02', X03:'x03', X04:'x04'};
  const t = () => TRANSLATIONS[language];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const nameOf = c => language === 'zh' ? c.country_zh || c.country : c.country;
  const regionOf = c => language === 'zh' ? c.who_region_display_zh : c.who_region_display_en;
  const domainLabel = key => t()[{human:'domainHuman',animal:'domainAnimal',cross:'domainCross'}[key]];
  const confirmed = d => d.status === 'CONFIRMED';
  const status = d => `<span class="status ${confirmed(d) ? 'yes' : 'no'}">${confirmed(d) ? t().confirmed : t().notConfirmed}</span>`;

  async function init() {
    try {
      data = window.STUDY_FREEZE_DATA || await (await fetch('data/study_freeze.json')).json();
      const paths = window.WORLD_SVG_DATA || await (await fetch('data/world_svg_paths.json')).json();
      window.WorldMap.init(paths, data.countries, domain, language);
      bind();
      populateFilters();
      applyLanguage();
      const params = new URLSearchParams(location.hash.slice(1));
      if (params.get('lang') === 'zh') setLanguage('zh');
      if (['home','map','explorer','mechanisms','methods','about'].includes(params.get('tab'))) setActiveTab(params.get('tab'));
      if (params.get('country')) openCountryDrawer(params.get('country').toUpperCase());
    } catch (error) {
      console.error(error);
      document.querySelector('main').innerHTML = '<p class="load-error">Evidence data could not be loaded. Open the site through a local web server, or use standalone.html.</p>';
    }
  }
  function bind() {
    document.getElementById('langToggleBtn').addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en'));
    document.querySelectorAll('.nav-btn').forEach(button => button.addEventListener('click', () => setActiveTab(button.dataset.tab)));
    document.getElementById('heroMapBtn').addEventListener('click', () => setActiveTab('map'));
    document.getElementById('heroExploreBtn').addEventListener('click', () => setActiveTab('explorer'));
    document.getElementById('openFullMap').addEventListener('click', () => setActiveTab('map'));
    document.querySelectorAll('.domain-tab-btn').forEach(button => button.addEventListener('click', () => {
      domain = button.dataset.domain;
      document.querySelectorAll('.domain-tab-btn').forEach(item => {
        item.classList.toggle('active', item.dataset.domain === domain);
        item.setAttribute('aria-pressed', String(item.dataset.domain === domain));
      });
      window.WorldMap.setDomain(domain);
      document.querySelectorAll('.confirmed-swatch').forEach(swatch => swatch.style.background = {human:'#C97D74', animal:'#6B8CAE', cross:'#3A608F'}[domain]);
    }));
    ['countrySearchInput','regionFilter','domainFilter','statusFilter'].forEach(id => document.getElementById(id).addEventListener(id === 'countrySearchInput' ? 'input' : 'change', renderCountries));
    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
      ['countrySearchInput','regionFilter','domainFilter','statusFilter'].forEach(id => document.getElementById(id).value = id === 'countrySearchInput' ? '' : 'all');
      renderCountries();
    });
    document.getElementById('explorerTableBody').addEventListener('click', event => {
      const button = event.target.closest('[data-country]');
      if (button) openCountryDrawer(button.dataset.country);
    });
    document.getElementById('mechanismsListContainer').addEventListener('click', event => {
      const button = event.target.closest('[data-country]');
      if (button) openCountryDrawer(button.dataset.country);
    });
    const backdrop = document.getElementById('countryDrawerBackdrop');
    backdrop.addEventListener('click', event => { if (event.target === backdrop) closeCountryDrawer(); });
    document.getElementById('drawerCloseBtn').addEventListener('click', closeCountryDrawer);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !backdrop.hidden) closeCountryDrawer();
      if (event.key === 'Tab' && !backdrop.hidden) {
        const focusable = [...backdrop.querySelectorAll('a[href],button:not([disabled])')];
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }
  function populateFilters() {
    const regionSelect = document.getElementById('regionFilter');
    const selectedRegion = regionSelect.value || 'all';
    const regions = [...new Set(data.countries.map(c => c.who_region))].sort();
    regionSelect.innerHTML = `<option value="all">${t().allRegions}</option>` + regions.map(region => {
      const c = data.countries.find(item => item.who_region === region);
      return `<option value="${escapeHtml(region)}">${escapeHtml(regionOf(c))}</option>`;
    }).join('');
    regionSelect.value = selectedRegion;
    const domainSelect = document.getElementById('domainFilter');
    const selectedDomain = domainSelect.value || 'all';
    domainSelect.innerHTML = `<option value="all">${t().allDomains}</option>` + domains.map(key => `<option value="${key}">${domainLabel(key)}</option>`).join('');
    domainSelect.value = selectedDomain;
    const statusSelect = document.getElementById('statusFilter');
    const selectedStatus = statusSelect.value || 'all';
    statusSelect.innerHTML = `<option value="all">${t().allStatuses}</option><option value="confirmed">${t().confirmed}</option><option value="not-confirmed">${t().notConfirmed}</option>`;
    statusSelect.value = selectedStatus;
  }
  function applyLanguage() {
    document.documentElement.lang = language;
    document.getElementById('langToggleBtn').textContent = language === 'en' ? '中文' : 'EN';
    document.getElementById('langToggleBtn').setAttribute('aria-label', language === 'en' ? 'Switch to Chinese' : '切换为英文');
    document.querySelectorAll('[data-i18n]').forEach(element => { const value = t()[element.dataset.i18n]; if (value) element.textContent = value; });
    document.getElementById('countrySearchInput').placeholder = t().searchPlaceholder;
    document.getElementById('drawerCloseBtn').setAttribute('aria-label', t().closeProfile);
    document.querySelector('.site-nav').setAttribute('aria-label', language === 'en' ? 'Primary navigation' : '主导航');
    document.querySelectorAll('.domain-tabs').forEach(group => group.setAttribute('aria-label', t().mapLayer));
    document.getElementById('mapZoomIn').setAttribute('aria-label', language === 'en' ? 'Zoom in' : '放大');
    document.getElementById('mapZoomOut').setAttribute('aria-label', language === 'en' ? 'Zoom out' : '缩小');
    window.WorldMap.setLanguage(language);
    populateFilters();
    renderCountries();
    renderLinkage();
    if (openIso) renderDrawer(openIso);
  }
  function setLanguage(value) { language = value; applyLanguage(); }
  function setActiveTab(value) {
    tab = value;
    document.querySelectorAll('.nav-btn').forEach(button => { const active = button.dataset.tab === value; button.classList.toggle('active', active); button.setAttribute('aria-current', active ? 'page' : 'false'); });
    document.querySelectorAll('.view-section').forEach(section => section.classList.toggle('active', section.id === `view-${value}`));
    if (value === 'map') window.WorldMap.refreshGlobalMap();
    window.scrollTo(0, 0);
  }
  function renderCountries() {
    const query = document.getElementById('countrySearchInput').value.trim().toLocaleLowerCase();
    const region = document.getElementById('regionFilter').value;
    const selectedDomain = document.getElementById('domainFilter').value;
    const selectedStatus = document.getElementById('statusFilter').value;
    const filtered = data.countries.filter(c => {
      if (query && ![c.country,c.country_zh,c.iso3].some(s => (s || '').toLocaleLowerCase().includes(query))) return false;
      if (region !== 'all' && c.who_region !== region) return false;
      if (selectedStatus !== 'all') {
        const keys = selectedDomain === 'all' ? domains : [selectedDomain];
        if (!keys.some(key => confirmed(c.domains[key]) === (selectedStatus === 'confirmed'))) return false;
      }
      return true;
    }).sort((a,b) => nameOf(a).localeCompare(nameOf(b), language));
    document.getElementById('explorerResultsCount').textContent = t().showing.replace('{count}', filtered.length).replace('{total}', data.countries.length);
    document.getElementById('explorerTableBody').innerHTML = filtered.length ? filtered.map(c => `<tr><th scope="row"><strong>${escapeHtml(nameOf(c))}</strong><small>${escapeHtml(c.iso3)}</small></th><td>${escapeHtml(regionOf(c))}</td>${domains.map(key => `<td>${status(c.domains[key])}</td>`).join('')}<td><button class="table-link" type="button" data-country="${escapeHtml(c.iso3)}">${t().viewProfile} →</button></td></tr>`).join('') : `<tr><td colspan="6">${t().noResults}</td></tr>`;
  }
  function renderLinkage() {
    const stats = data.metadata.global_counts.cross_sectoral_mechanisms;
    const cards = mechanisms.map(code => `<div class="mechanism-summary"><span class="mechanism-code">${code}</span><strong>${stats[code]}<small>/108</small></strong><h2>${t()[labels[code]]}</h2></div>`).join('');
    const rows = data.countries.filter(c => confirmed(c.domains.cross)).sort((a,b) => nameOf(a).localeCompare(nameOf(b), language)).map(c => `<tr><th scope="row">${escapeHtml(nameOf(c))}<small>${escapeHtml(c.iso3)}</small></th>${mechanisms.map(code => `<td><span class="mechanism-state ${c.domains.cross.mechanisms[code] ? 'documented' : ''}">${c.domains.cross.mechanisms[code] ? t().documented : t().notDocumented}</span></td>`).join('')}<td><button class="table-link" type="button" data-country="${escapeHtml(c.iso3)}">${t().viewProfile} →</button></td></tr>`).join('');
    document.getElementById('mechanismsListContainer').innerHTML = `<div class="mechanism-grid">${cards}</div><h2 class="list-heading">${t().mechanismCountries}</h2><div class="table-wrap"><table class="data-table mechanism-table"><thead><tr><th>${t().country}</th>${mechanisms.map(code => `<th>${code}</th>`).join('')}<th><span class="sr-only">${t().profile}</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function field(label, value) { return `<div class="source-field"><dt>${label}</dt><dd>${escapeHtml(value || '—')}</dd></div>`; }
  function officialSourceLinks(value) {
    const urls = String(value || '').split('|').map(part => part.trim()).filter(Boolean).filter(part => {
      try { return ['http:', 'https:'].includes(new URL(part).protocol); } catch { return false; }
    });
    return urls.map((url, index) => {
      const label = urls.length === 1 ? t().sourceLink : t().sourceLinkNumbered.replace('{number}', index + 1);
      return `<a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }).join('');
  }
  function renderDrawer(iso) {
    const c = data.countries.find(item => item.iso3 === iso);
    if (!c) return;
    openIso = iso;
    document.getElementById('drawerCountryName').textContent = nameOf(c);
    document.getElementById('drawerCountrySub').textContent = `${c.iso3} · ${regionOf(c)}`;
    document.getElementById('drawerDomainsContainer').innerHTML = domains.map(key => {
      const d = c.domains[key], source = d.supporting_official_source;
      let body = `<p class="not-confirmed-explanation">${t().notConfirmedExplanation}</p>`;
      if (confirmed(d) && source) {
        body = `<div class="source-block"><div class="eyebrow">${t().sourceHeading}</div><h4>${escapeHtml(source.source_title)}</h4><dl class="source-details">${field(t().issuer,source.issuer)}${field(t().date,source.date_or_period)}</dl>${officialSourceLinks(source.official_url)}</div>`;
      }
      if (key === 'cross' && confirmed(d) && d.mechanisms) body += `<div class="profile-mechanisms"><h4>${t().navLinkage}</h4>${mechanisms.map(code => `<div><span><b>${code}</b> ${t()[labels[code]]}</span><span class="mechanism-state ${d.mechanisms[code] ? 'documented' : ''}">${d.mechanisms[code] ? t().documented : t().notDocumented}</span></div>`).join('')}<p>${t().mechanismNote}</p></div>`;
      return `<article class="evidence-card ${key}"><div class="evidence-card-head"><h3>${domainLabel(key)}</h3>${status(d)}</div>${body}</article>`;
    }).join('');
  }
  function openCountryDrawer(iso) {
    if (!data || !data.countries.some(c => c.iso3 === iso)) return;
    focusBeforeDrawer = document.activeElement;
    renderDrawer(iso);
    const backdrop = document.getElementById('countryDrawerBackdrop');
    backdrop.hidden = false;
    document.body.classList.add('drawer-open');
    document.getElementById('drawerCloseBtn').focus();
  }
  function closeCountryDrawer() {
    document.getElementById('countryDrawerBackdrop').hidden = true;
    document.body.classList.remove('drawer-open');
    openIso = null;
    if (focusBeforeDrawer && focusBeforeDrawer.isConnected) focusBeforeDrawer.focus();
  }
  return {init,setActiveTab,setLanguage,openCountryDrawer,closeCountryDrawer};
})();
document.addEventListener('DOMContentLoaded', window.App.init);
