/**
 * js/map.js
 * Dual-Mount Interactive SVG World Map component for Rabies Evidence Observatory.
 * Seamlessly renders and synchronizes interactive maps on both Overview and Dedicated Global Map views.
 */

window.WorldMap = (function () {
  let svgPathsData = null;
  let countriesMap = {};
  let currentDomain = "human";
  let currentLang = "en";

  // Zoom/Pan state for dedicated Global Map
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  const MICROSTATES = [
    { iso3: "SGP", name: "Singapore", zh: "新加坡" },
    { iso3: "MLT", name: "Malta", zh: "马耳他" },
    { iso3: "BHR", name: "Bahrain", zh: "巴林" },
    { iso3: "BRB", name: "Barbados", zh: "巴巴多斯" },
    { iso3: "LCA", name: "Saint Lucia", zh: "圣卢西亚" },
    { iso3: "VCT", name: "St. Vincent & Grenadines", zh: "圣文森特和格林纳丁斯" },
    { iso3: "MUS", name: "Mauritius", zh: "毛里求斯" },
    { iso3: "SYC", name: "Seychelles", zh: "塞舌尔" },
    { iso3: "COM", name: "Comoros", zh: "科摩罗" },
    { iso3: "CPV", name: "Cabo Verde", zh: "佛得角" },
    { iso3: "STP", name: "Sao Tome & Principe", zh: "圣多美和普林西比" },
    { iso3: "MDV", name: "Maldives", zh: "马尔代夫" },
    { iso3: "AND", name: "Andorra", zh: "安道尔" },
    { iso3: "SMR", name: "San Marino", zh: "圣马力诺" },
    { iso3: "FSM", name: "Micronesia", zh: "密克罗尼西亚" }
  ];

  function init(pathsData, countriesList, domain, lang) {
    svgPathsData = pathsData;
    currentDomain = domain || "human";
    currentLang = lang || "en";

    countriesMap = {};
    for (let c of countriesList) {
      countriesMap[c.iso3] = c;
    }

    renderAllMaps();
    setupControls();
    renderAllSmallIslands();
  }

  function setDomain(domain) {
    currentDomain = domain;
    updateAllMapColors();
  }

  function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll(".map-country-path").forEach(path => {
      const country = countriesMap[path.getAttribute("data-iso")];
      if (country) path.setAttribute("aria-label", `${currentLang === "zh" ? (country.country_zh || country.country) : country.country} (${country.iso3})`);
    });
    renderAllSmallIslands();
  }

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));

  function getCountryColor(iso3) {
    if (!iso3 || !countriesMap[iso3]) {
      return "#f1f3f4"; // Outside study
    }
    const country = countriesMap[iso3];
    const d = country.domains[currentDomain];
    if (!d) return "#f1f3f4";

    if (d.status === "CONFIRMED") {
      return { human: "#C97D74", animal: "#6B8CAE", cross: "#3A608F" }[currentDomain];
    } else {
      return "#e3e8eb";
    }
  }

  function buildSvgHtml(instanceId, isZoomable) {
    const transformAttr = isZoomable
      ? `id="${instanceId}-group" transform="translate(${translateX}, ${translateY}) scale(${scale})"`
      : `id="${instanceId}-group"`;

    let svgHtml = `
      <svg id="${instanceId}-svg" class="map-svg" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
        <g ${transformAttr}>
    `;

    for (let key in svgPathsData) {
      const item = svgPathsData[key];
      const iso = item.iso3;
      const inStudy = !!(iso && countriesMap[iso]);
      const fillColor = getCountryColor(iso);
      const cls = inStudy ? `map-country-path map-path-${instanceId}` : `map-country-non-study map-nonstudy-${instanceId}`;

      svgHtml += `
        <path id="${instanceId}-path-${iso || key}"
              class="${cls}"
              d="${escapeHtml(item.d)}"
              fill="${fillColor}"
              data-iso="${iso || ''}"
              data-name="${escapeHtml(item.name || '')}"
              ${inStudy ? `tabindex="0" role="button" aria-label="${escapeHtml(countriesMap[iso].country)} (${iso})"` : 'aria-hidden="true"'}
        />
      `;
    }

    svgHtml += `
        </g>
      </svg>
    `;
    return svgHtml;
  }

  function renderAllMaps() {
    // 1. Render on Home Map Container (if exists)
    const homeContainer = document.getElementById("homeMapSvgContainer");
    if (homeContainer && svgPathsData) {
      homeContainer.innerHTML = buildSvgHtml("homeMap", false);
      attachMapEvents("homeMap", "homeMapSvgWrapper", "homeMapTooltip");
    }

    // 2. Render on Dedicated Global Map Container (if exists)
    const globalContainer = document.getElementById("globalMapSvgContainer");
    if (globalContainer && svgPathsData) {
      globalContainer.innerHTML = buildSvgHtml("globalMap", true);
      attachMapEvents("globalMap", "globalMapSvgWrapper", "globalMapTooltip");
    }
  }

  function updateAllMapColors() {
    for (let key in svgPathsData) {
      const item = svgPathsData[key];
      const iso = item.iso3;
      const color = getCountryColor(iso);

      const homeP = document.getElementById(`homeMap-path-${iso || key}`);
      if (homeP) homeP.setAttribute("fill", color);

      const globalP = document.getElementById(`globalMap-path-${iso || key}`);
      if (globalP) globalP.setAttribute("fill", color);
    }
    renderAllSmallIslands();
  }

  function attachMapEvents(instanceId, wrapperId, tooltipId) {
    const tooltip = document.getElementById(tooltipId);
    const wrapper = document.getElementById(wrapperId);
    const paths = document.querySelectorAll(`.map-path-${instanceId}`);

    paths.forEach(p => {
      const showTooltip = function () {
        const iso = this.getAttribute("data-iso");
        const country = countriesMap[iso];
        if (!country || !tooltip) return;
        const name = currentLang === "zh" ? (country.country_zh || country.country) : country.country;
        const status = country.domains[currentDomain].status === "CONFIRMED" ? TRANSLATIONS[currentLang].confirmed : TRANSLATIONS[currentLang].notConfirmed;
        tooltip.innerHTML = `<strong>${escapeHtml(name)} (${escapeHtml(iso)})</strong><br>${escapeHtml(status)}<br><small>${TRANSLATIONS[currentLang].mapClick}</small>`;
        tooltip.classList.add("visible");
      };
      p.addEventListener("mouseenter", showTooltip);
      p.addEventListener("focus", showTooltip);
      p.addEventListener("mousemove", function (e) {
        if (!wrapper || !tooltip) return;
        const rect = wrapper.getBoundingClientRect();
        tooltip.style.left = `${Math.min(e.clientX - rect.left + 15, rect.width - 190)}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });
      p.addEventListener("mouseleave", () => tooltip?.classList.remove("visible"));
      p.addEventListener("blur", () => tooltip?.classList.remove("visible"));
      p.addEventListener("click", function () { window.App?.openCountryDrawer(this.getAttribute("data-iso")); });
      p.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.click(); } });
    });
  }

  function setupControls() {
    const zoomInBtn = document.getElementById("mapZoomIn");
    const zoomOutBtn = document.getElementById("mapZoomOut");
    const zoomResetBtn = document.getElementById("mapZoomReset");

    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => {
        scale = Math.min(scale * 1.3, 6);
        applyTransform();
      });
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
        scale = Math.max(scale / 1.3, 0.8);
        applyTransform();
      });
    }
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener("click", () => {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
      });
    }

    // Drag-to-pan & mouse wheel zooming on Global Map
    const wrapper = document.getElementById("globalMapSvgWrapper");
    if (wrapper) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let startTransX = 0;
      let startTransY = 0;

      wrapper.classList.add("draggable");

      wrapper.addEventListener("mousedown", (e) => {
        // Only initiate dragging on primary button and not on interactive links
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startTransX = translateX;
        startTransY = translateY;
        wrapper.classList.add("dragging");
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        translateX = startTransX + dx;
        translateY = startTransY + dy;
        applyTransform();
      });

      window.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          wrapper.classList.remove("dragging");
        }
      });

      wrapper.addEventListener("wheel", (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        const newScale = Math.min(Math.max(scale * factor, 0.8), 6);
        if (newScale !== scale) {
          scale = newScale;
          applyTransform();
        }
      }, { passive: false });
    }
  }

  function applyTransform() {
    const group = document.getElementById("globalMap-group");
    if (group) {
      group.setAttribute("transform", `translate(${translateX}, ${translateY}) scale(${scale})`);
    }
  }

  function refreshGlobalMap() {
    const globalContainer = document.getElementById("globalMapSvgContainer");
    if (globalContainer && svgPathsData) {
      if (!globalContainer.innerHTML || globalContainer.innerHTML.trim() === "") {
        globalContainer.innerHTML = buildSvgHtml("globalMap", true);
        attachMapEvents("globalMap", "globalMapSvgWrapper", "globalMapTooltip");
      }
    }
    applyTransform();
    renderChips("globalSmallIslandChips");
  }

  function renderAllSmallIslands() {
    renderChips("homeSmallIslandChips");
    renderChips("globalSmallIslandChips");
  }

  function renderChips(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = "";
    MICROSTATES.forEach(m => {
      const country = countriesMap[m.iso3];
      if (!country) return;
      const d = country.domains[currentDomain];
      const isConf = d && d.status === "CONFIRMED";
      const dotColor = isConf ? getCountryColor(m.iso3) : "#e3e8eb";
      const name = currentLang === "zh" ? m.zh : m.name;

      html += `
        <button class="island-chip" onclick="window.App.openCountryDrawer('${m.iso3}')">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${dotColor}; margin-right:4px;"></span>
          ${name} (${m.iso3})
        </button>
      `;
    });
    container.innerHTML = html;
  }

  return {
    init,
    setDomain,
    setLanguage,
    refreshGlobalMap
  };
})();
