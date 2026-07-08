// ================================================================
// 1. INISIALISASI PETA
// ================================================================
const map = L.map('map', {
    zoomControl: false
}).setView([-3.443, 114.835], 13);

L.control.zoom({ position: 'bottomleft' }).addTo(map);

// ================================================================
// 2. BASEMAP — 2 LAYER (SATELIT & KLASIK)
// ================================================================
const layerSatelit = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google Maps Satellite'
});

const layerKlasik = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
});

layerSatelit.addTo(map);

let layerAktif = 'satelit';
function gantiLayer(tipe) {
    if (tipe === 'satelit' && layerAktif !== 'satelit') {
        map.removeLayer(layerKlasik);
        layerSatelit.addTo(map);
        layerAktif = 'satelit';
    } else if (tipe === 'klasik' && layerAktif !== 'klasik') {
        map.removeLayer(layerSatelit);
        layerKlasik.addTo(map);
        layerAktif = 'klasik';
    }
    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.layer === tipe);
    });
}

// ================================================================
// 3. PALET WARNA NEON CYBERPUNK
// ================================================================
function getColor(tipe) {
    switch(tipe) {
        case 'Muslim':               return '#00FF66';
        case 'Christian Protestant': return '#00E5FF';
        case 'Christian':            return '#B500FF';
        case 'Christian Evangelical':return '#FF007F';
        default:                     return '#F1C40F';
    }
}

// ================================================================
// 4. STATE GLOBAL: semua marker + cluster group
// ================================================================
let allMarkers = []; // { marker, feature, latlng }
let activeFilter = 'Semua';

// Buat MarkerClusterGroup dengan styling cyberpunk
const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
            html: `
                <div class="cyber-cluster">
                    <div class="cyber-cluster-ring"></div>
                    <span class="cyber-cluster-count">${count}</span>
                </div>
            `,
            className: 'cyber-cluster-wrapper',
            iconSize: [48, 48],
            iconAnchor: [24, 24]
        });
    }
});
map.addLayer(clusterGroup);

// ================================================================
// 5. BUAT MARKER DARI GEOJSON
// ================================================================
function createMarkerIcon(feature) {
    const warna = getColor(feature.properties.tipe);
    let symbol = '📍';
    if (feature.properties.tipe === 'Muslim') {
        symbol = '☪';
    } else if (feature.properties.tipe.includes('Christian')) {
        symbol = '♱';
    }
    return L.divIcon({
        className: 'clean-neon-marker',
        html: `
            <div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:none!important;border:none!important;position:relative;">
                <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:${warna}1a;border:2px solid ${warna};box-shadow:0 0 12px ${warna},inset 0 0 6px ${warna};z-index:1;"></div>
                <span style="position:relative;font-size:16px;color:#ffffff;text-shadow:0 0 8px ${warna},0 0 12px ${warna};font-weight:bold;line-height:1;z-index:2;display:block;margin-top:-1px;">${symbol}</span>
            </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        tooltipAnchor: [0, -20]
    });
}

fetch('tempat_ibadah.geojson')
    .then(response => {
        if (!response.ok) throw new Error("Gagal load data GeoJSON");
        return response.json();
    })
    .then(data => {
        // Update counter
        document.getElementById('data-count').textContent = `${data.features.length} Lokasi`;

        data.features.forEach(feature => {
            const latlng = L.latLng(
                feature.geometry.coordinates[1],
                feature.geometry.coordinates[0]
            );
            const marker = L.marker(latlng, { icon: createMarkerIcon(feature) });

            marker.bindTooltip(`<b>${feature.properties.nama}</b>`, {
                direction: 'top', className: 'cyber-tooltip'
            });

            marker.on('click', function () {
                bukaPanelDetail(feature, latlng);
            });

            allMarkers.push({ marker, feature, latlng });
            clusterGroup.addLayer(marker);
        });

        // Init search autocomplete setelah data siap
        initSearch(data.features);
    })
    .catch(error => console.error('Error fetching data:', error));

// ================================================================
// 6. FILTER BERDASARKAN TIPE
// ================================================================
function filterMarkers(tipe) {
    activeFilter = tipe;

    // Update tombol aktif
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const btnTipe = btn.dataset.tipe;
        btn.classList.remove('active');
        btn.style.removeProperty('--btn-color');
        if (btnTipe === tipe) {
            btn.classList.add('active');
            if (tipe !== 'Semua') {
                btn.style.setProperty('--btn-color', getColor(tipe));
            }
        }
    });

    // Rebuild cluster dengan marker yang sesuai filter
    clusterGroup.clearLayers();
    allMarkers.forEach(({ marker, feature }) => {
        if (tipe === 'Semua' || feature.properties.tipe === tipe) {
            clusterGroup.addLayer(marker);
        }
    });
}

// ================================================================
// 7. SEARCH / CARI LOKASI
// ================================================================
function initSearch(features) {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
        const query = this.value.trim().toLowerCase();

        if (query.length === 0) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }

        const matches = features.filter(f =>
            f.properties.nama.toLowerCase().includes(query)
        );

        searchResults.innerHTML = '';

        if (matches.length === 0) {
            searchResults.innerHTML = `<div class="search-no-result">⚠ Lokasi tidak ditemukan</div>`;
            searchResults.style.display = 'block';
            return;
        }

        matches.slice(0, 6).forEach(feature => {
            const item = document.createElement('div');
            item.className = 'search-item';
            const warna = getColor(feature.properties.tipe);
            item.innerHTML = `
                <span class="search-dot" style="background:${warna};box-shadow:0 0 6px ${warna};"></span>
                <div class="search-item-text">
                    <span class="search-item-name">${feature.properties.nama}</span>
                    <span class="search-item-tipe" style="color:${warna};">${feature.properties.tipe}</span>
                </div>
            `;
            item.addEventListener('click', () => {
                const latlng = L.latLng(
                    feature.geometry.coordinates[1],
                    feature.geometry.coordinates[0]
                );
                map.flyTo(latlng, 17, { animate: true, duration: 1.2 });
                bukaPanelDetail(feature, latlng);
                searchResults.style.display = 'none';
                searchInput.value = feature.properties.nama;
            });
            searchResults.appendChild(item);
        });

        searchResults.style.display = 'block';
    });

    // Tutup dropdown saat klik di luar
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-wrapper')) {
            searchResults.style.display = 'none';
        }
    });

    // Navigasi keyboard
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            searchResults.style.display = 'none';
            searchInput.blur();
        }
    });
}

// ================================================================
// 8. LOGIKA SIDEBAR DETAIL PANEL
// ================================================================
const detailPanel = document.getElementById('detail-panel');
const mapContainer = document.getElementById('map');
const closeBtn = document.getElementById('close-panel');

function bukaPanelDetail(feature, latlng) {
    const titleEl      = document.getElementById('panel-title');
    const subtitleEl   = document.getElementById('panel-subtitle');
    const tipeEl       = document.getElementById('panel-tipe');
    const latEl        = document.getElementById('panel-lat');
    const lngEl        = document.getElementById('panel-lng');
    const fotoEl       = document.getElementById('panel-foto');
    const fotoFallback = document.getElementById('panel-foto-fallback');
    const fotoLabel    = document.getElementById('panel-foto-label');

    if (titleEl)    titleEl.innerText = feature.properties.nama;
    if (subtitleEl) subtitleEl.innerText = "Kategori: Fasilitas Keagamaan";

    if (tipeEl) {
        tipeEl.innerText = feature.properties.tipe;
        tipeEl.style.color = getColor(feature.properties.tipe);
        tipeEl.style.fontWeight = '600';
    }

    if (latEl) latEl.innerText = latlng.lat.toFixed(6);
    if (lngEl) lngEl.innerText = latlng.lng.toFixed(6);

    // ── FOTO ──────────────────────────────────────────────────────
    if (fotoEl) {
        const fotoPath = feature.properties.foto;
        if (fotoPath) {
            fotoEl.style.display = 'block';
            if (fotoFallback) fotoFallback.style.display = 'none';
            if (fotoLabel) fotoLabel.innerText = feature.properties.nama;
            fotoEl.src = fotoPath;
            fotoEl.onerror = function() {
                fotoEl.style.display = 'none';
                if (fotoFallback) fotoFallback.style.display = 'flex';
            };
        } else {
            fotoEl.style.display = 'none';
            if (fotoFallback) fotoFallback.style.display = 'flex';
        }
    }

    if (detailPanel) detailPanel.classList.add('is-open');
    if (mapContainer) mapContainer.classList.add('panel-open');
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        if (detailPanel) detailPanel.classList.remove('is-open');
        if (mapContainer) mapContainer.classList.remove('panel-open');
    });
}

// ================================================================
// 9. LEGENDA INTERAKTIF
// ================================================================
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'legend');
    const categories = ['Muslim', 'Christian Protestant', 'Christian', 'Christian Evangelical'];

    div.innerHTML = '<h4>Kategori Jaringan</h4>';

    for (let i = 0; i < categories.length; i++) {
        let warna = getColor(categories[i]);
        div.innerHTML += `
            <div style="margin-bottom:6px;display:flex;align-items:center;gap:8px;">
                <i style="background:${warna};box-shadow:0 0 8px ${warna};width:12px;height:12px;display:inline-block;border-radius:50%;"></i>
                <span style="letter-spacing:0.5px;font-size:12px;">${categories[i]}</span>
            </div>
        `;
    }
    return div;
};

legend.addTo(map);
