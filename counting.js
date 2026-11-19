// counting_page.js - Dedicated script for Sumerpur Election Counting Portal
// Powered by Official DEO Pali Counting Plan (152 Polling Stations, 14 Rounds, 15 Tables, CU IDs)

let countingData = null;
let currentScope = 'PS'; // 'PS' or 'ZP'
let activeSubtab = 'round_cards'; // 'round_cards', 'ps_wards', 'zp_wards', 'master_matrix', 'manual_entry', 'bulletin'
let selectedRound = 1;
let autoSyncTimer = null;
let isWarRoomOpen = false;
let warRoomView = 'ps_wards';
let warRoomTimer = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    if (window.location.search.includes('warroom=1')) {
        document.body.classList.add('warroom-active');
    }
    fetchCountingData().then(() => {
        if (window.location.search.includes('warroom=1')) {
            openWarRoom();
        }
    });
    initSSE();

    // TV Remote & Keyboard Fullscreen Shortcut (Enter / OK / 'F')
    document.addEventListener('keydown', (e) => {
        if (!isWarRoomOpen) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.key === 'f' || e.key === 'F' || e.keyCode === 13 || e.key === 'Enter') {
            toggleWarRoomFullscreen();
        }
    });
});

// Portal Clock
function initClock() {
    function update() {
        const el = document.getElementById('portalClock');
        if (el) el.textContent = new Date().toLocaleTimeString('en-IN');
        const wrEl = document.getElementById('warRoomClock');
        if (wrEl) wrEl.textContent = new Date().toLocaleTimeString('en-IN');
    }
    update();
    setInterval(update, 1000);
}

// SSE live stream
function initSSE() {
    try {
        const evtSource = new EventSource('/api/live-stream');
        evtSource.onmessage = (event) => {
            const payload = JSON.parse(event.data);
            if (payload.type === 'COUNTING_UPDATE' || payload.type === 'BULK_UPDATE') {
                fetchCountingData(true);
            }
        };
        evtSource.onerror = () => {
            setTimeout(initSSE, 5000);
        };
    } catch (e) {
        console.warn('SSE not supported or failed to connect:', e);
    }
}

// Fetch all counting data from server (with static fallback for GitHub Pages)
async function fetchCountingData(silent = false) {
    try {
        const res = await fetch('/api/counting');
        if (res.ok) {
            const data = await res.json();
            if (data && data.success) {
                countingData = data;
                if (data.kpi && data.kpi.activeRound && selectedRound === 1 && data.kpi.activeRound > 1) {
                    selectedRound = data.kpi.activeRound;
                }
                renderAll();
                if (!silent) {
                    const syncTimeEl = document.getElementById('syncTimeText');
                    if (syncTimeEl) syncTimeEl.textContent = `अंतिम सिंक: ${new Date().toLocaleTimeString('en-IN')}`;
                }
                return;
            }
        }
    } catch (err) {
        console.warn('Backend API not responding, checking static counting_data.json fallback...', err);
    }

    // Static fallback for GitHub Pages
    try {
        const resStatic = await fetch('counting_data.json');
        if (resStatic.ok) {
            const data = await resStatic.json();
            if (data) {
                countingData = data;
                if (data.kpi && data.kpi.activeRound && selectedRound === 1 && data.kpi.activeRound > 1) {
                    selectedRound = data.kpi.activeRound;
                }
                renderAll();
                if (!silent) {
                    const syncTimeEl = document.getElementById('syncTimeText');
                    if (syncTimeEl) syncTimeEl.textContent = `GitHub Pages मोड • अंतिम सिंक: ${new Date().toLocaleTimeString('en-IN')}`;
                }
            }
        }
    } catch (e) {
        console.error('Static counting data fallback failed:', e);
    }
}

// Scope switch (PS vs ZP)
function switchScope(scope) {
    currentScope = scope;
    document.getElementById('btnScopePS').classList.toggle('active', scope === 'PS');
    document.getElementById('btnScopeZP').classList.toggle('active', scope === 'ZP');

    if (scope === 'ZP') {
        switchSubtab('zp_wards');
    } else {
        switchSubtab('round_cards');
    }
    renderKPIs();
}

// Subtab switch
function switchSubtab(tab) {
    activeSubtab = tab;
    document.querySelectorAll('.counting-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    ['round_cards', 'ps_wards', 'zp_wards', 'master_matrix', 'manual_entry', 'bulletin'].forEach(t => {
        const el = document.getElementById(`view_${t}`);
        if (el) el.style.display = (activeSubtab === t) ? 'block' : 'none';
    });

    renderActiveTab();
}

// Render everything
function renderAll() {
    if (!countingData) return;
    renderKPIs();
    renderActiveTab();
    if (isWarRoomOpen) renderWarRoom();
}

// Render Top KPI Ribbon
function renderKPIs() {
    if (!countingData) return;
    const k = countingData.kpi || {};
    const psPt = k.psPartyTally || {};
    const zpPt = k.zpPartyTally || {};

    // 1. General Polling & Progress
    const elPolled = document.getElementById('kpiTotalPolled');
    if (elPolled) elPolled.textContent = (71943).toLocaleString('en-IN');

    const elCounted = document.getElementById('kpiTotalCounted');
    if (elCounted) elCounted.textContent = (k.totalCountedVotes || 0).toLocaleString('en-IN');

    const elBooths = document.getElementById('kpiCountedBooths');
    if (elBooths) elBooths.textContent = `${k.totalCompletedBooths || 0} / ${k.totalBooths || 152} (${k.progressPct || 0}%)`;

    const elRound = document.getElementById('kpiActiveRound');
    const elRoundSub = document.getElementById('kpiActiveRoundSub');
    if (elRound) {
        if (k.isAllCompleted || (k.totalCompletedBooths >= (k.totalBooths || 152))) {
            elRound.innerHTML = `<span style="color:#059669; font-weight:900;">14 / 14 (पूर्ण)</span>`;
            if (elRoundSub) elRoundSub.textContent = 'सभी 14 राउंड गणना पूर्ण';
        } else {
            elRound.textContent = `राउंड ${k.activeRound || 1} / 14`;
            if (elRoundSub) elRoundSub.textContent = `वर्तमान में राउंड ${k.activeRound || 1} सक्रिय`;
        }
    }

    const elBar = document.getElementById('countingProgressBar');
    if (elBar) elBar.style.width = `${k.progressPct || 0}%`;

    // 2. Separate Panchayat Samiti Standings (21 Wards)
    const elPSDec = document.getElementById('kpiPSDeclaredBadge');
    if (elPSDec) elPSDec.textContent = `${k.declaredWardsPS || 0} / 21 वार्ड घोषित`;

    const psBjp = (psPt.BJP?.won || 0) + (psPt.BJP?.lead || 0);
    const psInc = (psPt.INC?.won || 0) + (psPt.INC?.lead || 0);
    const psInd = (psPt.IND?.won || 0) + (psPt.IND?.lead || 0);

    const elPsBjp = document.getElementById('psTallyBjp');
    const elPsBjpSub = document.getElementById('psTallyBjpSub');
    if (elPsBjp) elPsBjp.textContent = psBjp;
    if (elPsBjpSub) elPsBjpSub.textContent = `जीत: ${psPt.BJP?.won || 0} | आगे: ${psPt.BJP?.lead || 0}`;

    const elPsInc = document.getElementById('psTallyInc');
    const elPsIncSub = document.getElementById('psTallyIncSub');
    if (elPsInc) elPsInc.textContent = psInc;
    if (elPsIncSub) elPsIncSub.textContent = `जीत: ${psPt.INC?.won || 0} | आगे: ${psPt.INC?.lead || 0}`;

    const elPsInd = document.getElementById('psTallyInd');
    const elPsIndSub = document.getElementById('psTallyIndSub');
    if (elPsInd) elPsInd.textContent = psInd;
    if (elPsIndSub) elPsIndSub.textContent = `जीत: ${psPt.IND?.won || 0} | आगे: ${psPt.IND?.lead || 0}`;

    // 3. Separate Zila Parishad Standings (4 Wards)
    const elZPDec = document.getElementById('kpiZPDeclaredBadge');
    if (elZPDec) elZPDec.textContent = `${k.declaredWardsZP || 0} / 4 वार्ड घोषित`;

    const zpBjp = (zpPt.BJP?.won || 0) + (zpPt.BJP?.lead || 0);
    const zpInc = (zpPt.INC?.won || 0) + (zpPt.INC?.lead || 0);
    const zpInd = (zpPt.IND?.won || 0) + (zpPt.IND?.lead || 0);

    const elZpBjp = document.getElementById('zpTallyBjp');
    const elZpBjpSub = document.getElementById('zpTallyBjpSub');
    if (elZpBjp) elZpBjp.textContent = zpBjp;
    if (elZpBjpSub) elZpBjpSub.textContent = `जीत: ${zpPt.BJP?.won || 0} | आगे: ${zpPt.BJP?.lead || 0}`;

    const elZpInc = document.getElementById('zpTallyInc');
    const elZpIncSub = document.getElementById('zpTallyIncSub');
    if (elZpInc) elZpInc.textContent = zpInc;
    if (elZpIncSub) elZpIncSub.textContent = `जीत: ${zpPt.INC?.won || 0} | आगे: ${zpPt.INC?.lead || 0}`;

    const elZpInd = document.getElementById('zpTallyInd');
    const elZpIndSub = document.getElementById('zpTallyIndSub');
    if (elZpInd) elZpInd.textContent = zpInd;
    if (elZpIndSub) elZpIndSub.textContent = `जीत: ${zpPt.IND?.won || 0} | आगे: ${zpPt.IND?.lead || 0}`;
}

// Render Active Sub-View
function renderActiveTab() {
    if (!countingData) return;
    if (activeSubtab === 'round_cards') renderRoundCardsView();
    else if (activeSubtab === 'ps_wards') renderPSWardsView();
    else if (activeSubtab === 'zp_wards') renderZPWardsView();
    else if (activeSubtab === 'master_matrix') renderMasterMatrixView();
    else if (activeSubtab === 'manual_entry') renderManualEntryView();
    else if (activeSubtab === 'bulletin') renderBulletinView();
}

// -------------------------------------------------------------
// 1. ROUND CARDS VIEW (OFFICIAL DEO PALI PLAN)
// -------------------------------------------------------------
function selectRound(r) {
    selectedRound = r;
    renderRoundCardsView();
}

function renderRoundCardsView() {
    const rounds = countingData.rounds || {};
    const curRd = rounds[selectedRound] || { completedBoothsInRound: 0, totalBoothsInRound: 0, totalVotes: 0, totalPolledVotes: 0, status: 'PENDING', slots: [] };

    // Round Selector Pills (1 to 14)
    const pillsWrap = document.getElementById('roundPillsContainer');
    if (pillsWrap) {
        let phtml = '';
        for (let r = 1; r <= 14; r++) {
            const rd = rounds[r] || { completedBoothsInRound: 0, totalBoothsInRound: 0, status: 'PENDING' };
            const isActive = (r === selectedRound);
            let icon = '⚪';
            let cls = 'status-pending';

            if (rd.status === 'COMPLETED' || (rd.completedBoothsInRound === rd.totalBoothsInRound && rd.totalBoothsInRound > 0)) {
                icon = '🟢';
                cls = 'status-completed';
            } else if (rd.status === 'COUNTING' || rd.completedBoothsInRound > 0) {
                icon = '🟡';
                cls = 'status-counting';
            }

            phtml += `
                <button class="round-nav-pill ${isActive ? 'active' : ''} ${cls}" onclick="selectRound(${r})">
                    <span class="r-title">राउंड ${r}</span>
                    <span class="r-sub">${icon} ${rd.completedBoothsInRound || 0}/${rd.totalBoothsInRound || 0} बूथ</span>
                </button>
            `;
        }
        pillsWrap.innerHTML = phtml;
    }

    // Selected Round Header Bar
    const headBar = document.getElementById('selectedRoundHeaderBar');
    if (headBar) {
        let statusBadge = `<span class="badge-status-pending">⚪ राउंड प्रतीक्षारत</span>`;
        if (curRd.status === 'COMPLETED' || (curRd.completedBoothsInRound === curRd.totalBoothsInRound && curRd.totalBoothsInRound > 0)) {
            statusBadge = `<span class="badge-status-completed">🟢 राउंड पूर्ण (${curRd.totalBoothsInRound}/${curRd.totalBoothsInRound} बूथ)</span>`;
        } else if (curRd.status === 'COUNTING' || curRd.completedBoothsInRound > 0) {
            statusBadge = `<span class="badge-status-counting">🟡 मतगणना जारी (${curRd.completedBoothsInRound}/${curRd.totalBoothsInRound} बूथ)</span>`;
        }

        headBar.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <h2 style="margin:0; font-size:18px; color:#1e1b4b; font-weight:800;">
                        <i class="fas fa-layer-group" style="color:#6366f1;"></i> राउंड ${selectedRound} — मतगणना प्लान अनुसार (${curRd.totalBoothsInRound} बूथ)
                    </h2>
                    ${statusBadge}
                </div>
                <div style="display:flex; align-items:center; gap:16px; font-size:13px; font-weight:700;">
                    <span style="color:#475569;">EVM डाले गए मत: <b style="color:#0369a1;">${(curRd.totalPolledVotes || 0).toLocaleString('en-IN')}</b></span>
                    <span style="color:#475569;">गिने गए मत: <b style="color:#15803d;">${(curRd.totalVotes || 0).toLocaleString('en-IN')}</b></span>
                    <button class="btn-sm btn-whatsapp" onclick="openWhatsAppModal(${selectedRound})">
                        <i class="fab fa-whatsapp"></i> राउंड ${selectedRound} बुलेटिन
                    </button>
                </div>
            </div>
        `;
    }

    // Table Cards Grid for Selected Round
    const cardsGrid = document.getElementById('tableCardsGrid');
    if (!cardsGrid) return;

    let cHtml = '';
    const roundSlots = curRd.slots || [];

    roundSlots.forEach(s => {
        const v = s.votes || {};
        const zv = s.zp_votes || {};
        const psTot = Number(v.total) || 0;
        const zpTot = Number(zv.total) || 0;
        const polled = Number(s.polled_votes) || 0;
        
        const wInfo = countingData.ps_wards[s.ps_ward] || {};
        const psCandList = wInfo.candidates || [];
        const zwInfo = countingData.zp_wards[s.zp_ward] || {};
        const zpCandList = zwInfo.candidates || [];

        // PS ranking
        const psRanked = psCandList.map(c => ({
            name: c.name, party: c.party, votes: Number(v[c.key]) || 0
        })).sort((a, b) => b.votes - a.votes);
        const psLeader = psRanked[0] || { name: '-', party: '-', votes: 0 };
        const psRunner = psRanked[1] || { name: '-', party: '-', votes: 0 };
        const psMargin = psLeader.votes - psRunner.votes;

        // ZP ranking
        const zpRanked = zpCandList.map(c => ({
            name: c.name, party: c.party, votes: Number(zv[c.key]) || 0
        })).sort((a, b) => b.votes - a.votes);
        const zpLeader = zpRanked[0] || { name: '-', party: '-', votes: 0 };
        const zpRunner = zpRanked[1] || { name: '-', party: '-', votes: 0 };
        const zpMargin = zpLeader.votes - zpRunner.votes;

        let statusClass = 'pending';
        let statusBadge = '⚪ प्रतीक्षारत';
        if (s.status === 'COMPLETED' || (psTot > 0 && zpTot > 0)) {
            statusClass = 'completed';
            statusBadge = '🟢 पूर्ण';
        } else if (psTot > 0 || zpTot > 0) {
            statusClass = 'counting';
            statusBadge = '🟡 आंशिक';
        }

        let balanceTag = '';
        if (psTot > 0 && polled > 0) {
            if (psTot === polled) {
                balanceTag = `<span class="tag-verified"><i class="fas fa-circle-check"></i> EVM 17C मत (${polled}) पूर्ण मिलान</span>`;
            } else {
                balanceTag = `<span class="tag-mismatch"><i class="fas fa-triangle-exclamation"></i> अंतर: ${psTot - polled} मत (EVM: ${polled})</span>`;
            }
        }

        cHtml += `
            <div class="counting-card ${statusClass}" onclick="openEditSlotModal(${s.s_no})" style="cursor:pointer;">
                <div class="card-head">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="table-pill">टेबल ${s.table}</span>
                        <span class="booth-pill">बूथ ${s.booth_no}</span>
                        <span class="ward-pill">पं.स. ${s.ps_ward}</span>
                        <span class="ward-pill zp" style="background:#faf5ff; color:#7c3aed; border:1px solid #e9d5ff;">जि.प. ${s.zp_ward}</span>
                    </div>
                    <span class="status-indicator ${statusClass}">${statusBadge}</span>
                </div>

                <div style="margin:8px 0 6px;">
                    <div class="cu-badge-chip" style="font-size:12.5px;">
                        <i class="fas fa-microchip"></i> CU ID: <b>${s.cu_id}</b>
                    </div>
                </div>

                <div class="card-body-meta">
                    <div class="gp-name" title="${s.location || s.gp_name || ''}">${s.gp_name || ''} - <small style="color:#64748b;">${s.location || ''}</small></div>
                    <div class="stats-row" style="margin-top:6px;">
                        <span>पंजीकृत मतदाता: <b>${(s.electors || 0).toLocaleString('en-IN')}</b></span>
                        <span style="color:#0369a1; font-weight:800;">EVM मत (17C): <b>${polled.toLocaleString('en-IN')}</b></span>
                    </div>
                </div>

                <!-- Side-by-Side PS & ZP Mini Result Bars -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin:10px 0; display:flex; flex-direction:column; gap:8px;">
                    <!-- PS Member Row -->
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
                        <span style="color:#1e40af; font-weight:800;"><i class="fas fa-landmark"></i> पं.स. (${s.ps_ward}):</span>
                        <b style="font-size:13px; color:#0f172a;">${psTot > 0 ? psTot + ' मत' : '<span style="color:#94a3b8;">प्रतीक्षारत</span>'}</b>
                    </div>
                    ${psTot > 0 && psLeader.votes > 0 ? `
                        <div style="font-size:11.5px; color:#15803d; font-weight:700;">
                            <i class="fas fa-trophy" style="color:#f59e0b;"></i> ${psLeader.name} [${psLeader.party}] (+${psMargin})
                        </div>
                    ` : ''}

                    <!-- ZP Member Row -->
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; padding-top:2px;">
                        <span style="color:#7c3aed; font-weight:800;"><i class="fas fa-building-columns"></i> जि.प. (${s.zp_ward}):</span>
                        <b style="font-size:13px; color:#0f172a;">${zpTot > 0 ? zpTot + ' मत' : '<span style="color:#94a3b8;">प्रतीक्षारत</span>'}</b>
                    </div>
                    ${zpTot > 0 && zpLeader.votes > 0 ? `
                        <div style="font-size:11.5px; color:#15803d; font-weight:700;">
                            <i class="fas fa-trophy" style="color:#f59e0b;"></i> ${zpLeader.name} [${zpLeader.party}] (+${zpMargin})
                        </div>
                    ` : ''}
                </div>

                <div class="card-footer-box">
                    ${balanceTag}
                    <button class="btn-card-action" onclick="event.stopPropagation(); openEditSlotModal(${s.s_no})">
                        <i class="fas fa-pen-to-square"></i> मत प्रविष्टि (PS + ZP)
                    </button>
                </div>
            </div>
        `;
    });

    cardsGrid.innerHTML = cHtml;
}

// -------------------------------------------------------------
// 2. PANCHAYAT SAMITI (21 WARDS) RESULTS VIEW
// -------------------------------------------------------------
function renderPSWardsView() {
    const wards = countingData.ps_wards || {};
    const tbody = document.getElementById('psWardsTableBody');
    if (!tbody) return;

    let html = '';
    for (let w = 1; w <= 21; w++) {
        const wKey = `W-${w}`;
        const wm = wards[wKey] || {};
        const candList = wm.candidates || [];
        const candVotes = wm.candVotes || {};
        const totCounted = wm.totalCountedVotes || 0;
        const totPolled = wm.totalPolledVotes || 0;

        let statusTag = `<span class="status-pill pending">⚪ प्रतीक्षारत</span>`;
        if (wm.status === 'DECLARED') {
            statusTag = `<span class="status-pill declared">🟢 विजयी घोषित</span>`;
        } else if (wm.status === 'COUNTING') {
            statusTag = `<span class="status-pill counting">🟡 प्रगति पर (${wm.completedBooths}/${wm.totalBooths})</span>`;
        }

        let leaderHtml = '<span style="color:#94a3b8;">-</span>';
        if (wm.completedBooths > 0 && wm.leader && wm.leader.votes > 0) {
            let pColor = '#64748b';
            if (wm.leader.party === 'BJP') pColor = '#ea580c';
            else if (wm.leader.party === 'INC') pColor = '#0284c7';
            else if (wm.leader.party === 'IND') pColor = '#9333ea';

            leaderHtml = `
                <div style="font-weight:800; color:${pColor}; display:flex; align-items:center; gap:6px;">
                    <span class="party-badge" style="background:${pColor}15; color:${pColor}; border:1px solid ${pColor}30;">${wm.leader.party}</span>
                    <span>${wm.leader.name}</span>
                </div>
            `;
        }

        const marginHtml = (wm.completedBooths > 0 && wm.margin > 0) ? `
            <span class="margin-badge">+${wm.margin.toLocaleString('en-IN')} मत</span>
        ` : (wm.completedBooths > 0 ? '<span style="color:#64748b;">बराबर</span>' : '-');

        const c1 = candList[0] ? (candVotes[candList[0].key] || 0) : 0;
        const c2 = candList[1] ? (candVotes[candList[1].key] || 0) : 0;
        const c3 = candList[2] ? (candVotes[candList[2].key] || 0) : 0;
        const nota = candVotes.nota || 0;

        html += `
            <tr>
                <td style="text-align:center; font-weight:800;">
                    <span class="ward-title-pill">${wKey}</span>
                </td>
                <td style="text-align:center; font-weight:700;">
                    ${wm.completedBooths} / ${wm.totalBooths} बूथ
                    <div class="mini-bar-track">
                        <div class="mini-bar-fill" style="width:${wm.totalBooths > 0 ? ((wm.completedBooths / wm.totalBooths) * 100) : 0}%;"></div>
                    </div>
                </td>
                <td style="text-align:right; font-weight:700; color:#475569;">${(wm.totalElectors || 0).toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:800; color:#0369a1; background:#f0f9ff;">${totPolled.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:900; color:#0f172a; background:#f8fafc;">${totCounted.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:700; color:#ea580c; background:#fffaf5;">${c1.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:700; color:#0284c7; background:#f0f9ff;">${c2.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:700; color:#9333ea; background:#faf5ff;">${c3.toLocaleString('en-IN')}</td>
                <td style="text-align:right; color:#64748b;">${nota.toLocaleString('en-IN')}</td>
                <td>${leaderHtml}</td>
                <td style="text-align:center;">${marginHtml}</td>
                <td style="text-align:center;">${statusTag}</td>
                <td style="text-align:center;">
                    <button class="btn-xs btn-outline" onclick="openWardBreakdownModal('${wKey}')">
                        <i class="fas fa-list"></i> बूथ विवरण
                    </button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

// -------------------------------------------------------------
// 3. ZILA PARISHAD (4 WARDS) RESULTS VIEW
// -------------------------------------------------------------
function renderZPWardsView() {
    const zpWards = countingData.zp_wards || {};
    const container = document.getElementById('zpWardsCardsContainer');
    if (!container) return;

    let html = '';
    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const zw = zpWards[zKey] || {};
        const candList = zw.candidates || [];
        const candVotes = zw.candVotes || {};
        const totPolled = zw.totalPolledVotes || 0;
        const totCounted = zw.totalCountedVotes || 0;

        let statusClass = 'pending';
        let statusBadge = '⚪ मतगणना प्रतीक्षारत';
        if (zw.status === 'DECLARED') {
            statusClass = 'declared';
            statusBadge = '🟢 विजयी घोषित';
        } else if (zw.status === 'COUNTING') {
            statusClass = 'counting';
            statusBadge = `🟡 मतगणना जारी (${zw.completedBooths} बूथ)`;
        }

        html += `
            <div class="zp-ward-card ${statusClass}">
                <div class="zp-card-header">
                    <div>
                        <div class="zp-badge">जिला परिषद वार्ड संख्या ${zw.wardNo || zKey}</div>
                        <div class="zp-sub">सुमेरपुर ब्लॉक क्षेत्र • ZP WARD ${zw.wardNo || zKey}</div>
                    </div>
                    <span class="status-pill ${statusClass}">${statusBadge}</span>
                </div>

                <div class="zp-stats-strip">
                    <div class="zp-stat-box">
                        <div class="lbl">EVM में डाले गए कुल मत</div>
                        <div class="val" style="color:#0369a1;">${totPolled.toLocaleString('en-IN')}</div>
                    </div>
                    <div class="zp-stat-box">
                        <div class="lbl">अब तक गिने गए मत</div>
                        <div class="val" style="color:#15803d;">${totCounted.toLocaleString('en-IN')}</div>
                    </div>
                    <div class="zp-stat-box">
                        <div class="lbl">अग्रणी प्रत्याशी</div>
                        <div class="val" style="color:#1e1b4b; font-size:15px;">${zw.leader?.name || '-'}</div>
                    </div>
                    <div class="zp-stat-box">
                        <div class="lbl">वर्तमान बढ़त (Margin)</div>
                        <div class="val" style="color:#ea580c;">+${zw.margin || 0} मत</div>
                    </div>
                </div>

                <!-- Candidates Vote Box -->
                <div class="zp-candidates-list">
                    <h4 style="margin:0 0 10px 0; font-size:13px; color:#334155;">प्रत्याशी-वार मतगणना स्थिति:</h4>
                    ${candList.map(c => {
                        const votes = Number(candVotes[c.key]) || 0;
                        const pct = totPolled > 0 ? ((votes / totPolled) * 100) : 0;
                        let pColor = '#9333ea';
                        if (c.party === 'BJP') pColor = '#ea580c';
                        else if (c.party === 'INC') pColor = '#0284c7';

                        return `
                            <div class="zp-cand-row">
                                <div class="zp-cand-name">
                                    <span class="party-badge" style="background:${pColor}15; color:${pColor}; border:1px solid ${pColor}30;">${c.party}</span>
                                    <b>${c.name}</b>
                                </div>
                                <div class="zp-bar-track">
                                    <div class="zp-bar-fill" style="width:${pct}%; background:${pColor};"></div>
                                </div>
                                <div class="zp-cand-votes">
                                    <b>${votes.toLocaleString('en-IN')}</b>
                                    <small>${pct.toFixed(1)}%</small>
                                </div>
                            </div>
                        `;
                    }).join('')}

                    <div class="zp-cand-row nota-row">
                        <div class="zp-cand-name" style="color:#64748b;">
                            <span class="party-badge" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;">NOTA</span>
                            <b>नोटा (NOTA)</b>
                        </div>
                        <div class="zp-bar-track">
                            <div class="zp-bar-fill" style="width:${totPolled > 0 ? ((candVotes.nota / totPolled) * 100) : 0}%; background:#64748b;"></div>
                        </div>
                        <div class="zp-cand-votes">
                            <b>${(candVotes.nota || 0).toLocaleString('en-IN')}</b>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// -------------------------------------------------------------
// 4. MASTER 15 TABLES x 14 ROUNDS MATRIX (WITH CU ID)
// -------------------------------------------------------------
function renderMasterMatrixView() {
    const slots = countingData.slots || {};
    const thead = document.getElementById('matrixThead');
    const tbody = document.getElementById('matrixTbody');
    if (!thead || !tbody) return;

    let headHtml = '<tr><th style="position:sticky; left:0; z-index:20; background:#1e1b4b; color:#ffffff; min-width:85px; text-align:center;">राउंड</th>';
    for (let t = 1; t <= 15; t++) {
        headHtml += `<th style="text-align:center; min-width:125px;">टेबल ${t}</th>`;
    }
    headHtml += '</tr>';
    thead.innerHTML = headHtml;

    // Group slots by round & table
    const roundTableMap = {};
    for (let r = 1; r <= 14; r++) {
        roundTableMap[r] = {};
        for (let t = 1; t <= 15; t++) roundTableMap[r][t] = [];
    }

    Object.values(slots).forEach(s => {
        if (roundTableMap[s.round] && roundTableMap[s.round][s.table]) {
            roundTableMap[s.round][s.table].push(s);
        }
    });

    let bodyHtml = '';
    for (let r = 1; r <= 14; r++) {
        bodyHtml += `<tr>`;
        bodyHtml += `
            <td style="position:sticky; left:0; z-index:10; background:#f8fafc; font-weight:800; text-align:center; color:#1e1b4b; border-right:2px solid #cbd5e1;">
                राउंड ${r}
            </td>
        `;

        for (let t = 1; t <= 15; t++) {
            const list = roundTableMap[r][t] || [];
            if (list.length === 0) {
                bodyHtml += `<td style="background:#f8fafc; color:#cbd5e1; font-size:11px;">-</td>`;
            } else {
                const s = list[0]; // primary slot
                const tot = s.votes ? Number(s.votes.total) || 0 : 0;
                const polled = Number(s.polled_votes) || 0;

                let cellClass = 'matrix-pending';
                let statusText = 'प्रतीक्षारत';

                if (s.status === 'COMPLETED' || tot > 0) {
                    cellClass = 'matrix-completed';
                    statusText = `${tot} मत`;
                } else if (s.status === 'COUNTING') {
                    cellClass = 'matrix-counting';
                    statusText = 'जारी';
                }

                bodyHtml += `
                    <td class="matrix-cell ${cellClass}" onclick="openEditSlotModal(${s.s_no})" title="राउंड ${r} - टेबल ${t} | बूथ ${s.booth_no} | CU: ${s.cu_id} | EVM मत: ${polled}">
                        <div class="m-booth">बूथ ${s.booth_no}</div>
                        <div style="font-size:10px; font-weight:800; color:#d97706; background:#fef3c7; border-radius:3px; margin:2px 0;">CU: ${s.cu_id}</div>
                        <div class="m-ward">${s.ps_ward}</div>
                        <div class="m-polled">EVM: ${polled}</div>
                        <div class="m-votes">${statusText}</div>
                    </td>
                `;
            }
        }
        bodyHtml += `</tr>`;
    }
    tbody.innerHTML = bodyHtml;
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// 5. TABLE-BASED ENTRY VIEW (NO DROPDOWNS - FAST TABLE GRID)
// -------------------------------------------------------------
let entryFilterRound = 1;

function renderManualEntryView() {
    renderEntryRoundPills();
    renderEntryTable();
}

function renderEntryRoundPills() {
    const container = document.getElementById('entryRoundPills');
    if (!container) return;

    let html = '';
    for (let r = 1; r <= 14; r++) {
        const activeClass = (entryFilterRound === r) ? 'active' : '';
        html += `<button class="entry-rd-pill ${activeClass}" onclick="selectEntryRound(${r})">राउंड ${r}</button>`;
    }
    const allActive = (entryFilterRound === 'ALL') ? 'active' : '';
    html += `<button class="entry-rd-pill ${allActive}" onclick="selectEntryRound('ALL')">🌐 सभी 152 बूथ</button>`;
    container.innerHTML = html;
}

function selectEntryRound(r) {
    entryFilterRound = r;
    renderEntryRoundPills();
    renderEntryTable();
}

function filterEntryTable() {
    renderEntryTable();
}

function renderEntryTable() {
    if (!countingData) return;
    const tbody = document.getElementById('entryTableTbody');
    if (!tbody) return;

    let slots = [];
    if (entryFilterRound === 'ALL') {
        slots = Object.values(countingData.slots || {});
    } else {
        const curRd = countingData.rounds[entryFilterRound] || { slots: [] };
        slots = curRd.slots || [];
    }

    const q = (document.getElementById('entryTableSearch')?.value || '').toLowerCase().trim();
    if (q) {
        slots = slots.filter(s => {
            const str = `${s.table} ${s.booth_no} ${s.cu_id} ${s.ps_ward} ${s.zp_ward} ${s.gp_name} ${s.location}`.toLowerCase();
            return str.includes(q);
        });
    }

    // Compute summary
    let sumTables = slots.length;
    let sumCompleted = 0;
    let sumPending = 0;
    let sumPolled = 0;
    let sumCounted = 0;

    slots.forEach(s => {
        const psTot = Number(s.votes?.total) || 0;
        const zpTot = Number(s.zp_votes?.total) || 0;
        const polled = Number(s.polled_votes) || 0;
        sumPolled += polled;
        sumCounted += psTot;

        if (s.status === 'COMPLETED' || (psTot > 0 && zpTot > 0)) {
            sumCompleted++;
        } else {
            sumPending++;
        }
    });

    const elSumT = document.getElementById('entrySumTables');
    const elSumC = document.getElementById('entrySumCompleted');
    const elSumP = document.getElementById('entrySumPending');
    const elSumPol = document.getElementById('entrySumPolled');
    const elSumCnt = document.getElementById('entrySumCounted');

    if (elSumT) elSumT.textContent = sumTables;
    if (elSumC) elSumC.textContent = sumCompleted;
    if (elSumP) elSumP.textContent = sumPending;
    if (elSumPol) elSumPol.textContent = sumPolled.toLocaleString('en-IN');
    if (elSumCnt) elSumCnt.textContent = sumCounted.toLocaleString('en-IN');

    // Render Table Rows
    let rowsHtml = '';
    slots.forEach(s => {
        const psTot = Number(s.votes?.total) || 0;
        const zpTot = Number(s.zp_votes?.total) || 0;
        const polled = Number(s.polled_votes) || 0;

        let statusBadge = '<span class="status-pill pending">⚪ प्रतीक्षारत</span>';
        if (s.status === 'COMPLETED' || (psTot > 0 && zpTot > 0)) {
            if (psTot === polled && zpTot === polled) {
                statusBadge = '<span class="status-pill declared">🟢 पूर्ण</span>';
            } else {
                statusBadge = '<span class="status-pill counting" style="background:#fee2e2; color:#b91c1c;">⚠️ अंतर</span>';
            }
        } else if (psTot > 0 || zpTot > 0) {
            statusBadge = '<span class="status-pill counting">🟡 आंशिक</span>';
        }

        const psDisp = psTot > 0 ? `<b style="color:#1e40af;">${psTot.toLocaleString('en-IN')} मत</b>` : `<span style="color:#94a3b8;">-</span>`;
        const zpDisp = zpTot > 0 ? `<b style="color:#7c3aed;">${zpTot.toLocaleString('en-IN')} मत</b>` : `<span style="color:#94a3b8;">-</span>`;

        rowsHtml += `
            <tr onclick="openEditSlotModal(${s.s_no})">
                <td style="text-align:center; font-weight:800; color:#1e3a8a;">टेबल ${s.table}</td>
                <td style="text-align:center; font-weight:900; color:#0f172a;">बूथ ${s.booth_no}</td>
                <td style="text-align:center;">
                    <span class="cu-badge-chip"><i class="fas fa-microchip"></i> ${s.cu_id}</span>
                </td>
                <td>
                    <div style="font-weight:700; color:#0f172a;">${s.gp_name}</div>
                    <small style="color:#64748b;">${s.location || ''}</small>
                </td>
                <td style="text-align:center;">
                    <span class="cmh-badge ps-ward">${s.ps_ward}</span>
                </td>
                <td style="text-align:center;">
                    <span class="cmh-badge zp-ward">${s.zp_ward}</span>
                </td>
                <td style="text-align:right; font-weight:800; color:#0369a1;">${polled.toLocaleString('en-IN')}</td>
                <td style="text-align:center;">${psDisp}</td>
                <td style="text-align:center;">${zpDisp}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center;">
                    <button class="btn-entry-action" onclick="event.stopPropagation(); openEditSlotModal(${s.s_no})">
                        <i class="fas fa-pen-to-square"></i> प्रविष्टि
                    </button>
                </td>
            </tr>
        `;
    });

    if (slots.length === 0) {
        rowsHtml = `<tr><td colspan="11" style="text-align:center; padding:30px; color:#64748b;">कोई बूथ नहीं मिला</td></tr>`;
    }

    tbody.innerHTML = rowsHtml;
}

// -------------------------------------------------------------
// 6. WHATSAPP BULLETIN VIEW
// -------------------------------------------------------------
function renderBulletinView() {
    generateBulletin(selectedRound);
}

function generateBulletin(roundNum) {
    if (!countingData) return;
    const rData = countingData.rounds[roundNum] || { completedBoothsInRound: 0, totalBoothsInRound: 0, totalVotes: 0, totalPolledVotes: 0 };
    const k = countingData.kpi || {};
    const pt = k.psPartyTally || {};

    let msg = `🗳️ *पंचायती राज आम चुनाव 2026 — सुमेरपुर (पाली)*\n`;
    msg += `🏛️ *कार्यालय निर्वाचक रजिस्ट्रीकरण अधिकारी (SDM) सुमेरपुर*\n`;
    msg += `📊 *आधिकारिक मतगणना बुलेटिन — राउंड ${roundNum}*\n`;
    msg += `🕒 समय: ${new Date().toLocaleTimeString('en-IN')} | दिनांक: 22-10-2026\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📌 *राउंड ${roundNum} सारांश:*\n`;
    msg += `• पूर्ण बूथ: ${rData.completedBoothsInRound || 0} / ${rData.totalBoothsInRound || 0} बूथ\n`;
    msg += `• राउंड में गिने गए मत: ${(rData.totalVotes || 0).toLocaleString('en-IN')}\n`;
    msg += `• समग्र प्रगति: ${k.totalCompletedBooths || 0} / 152 बूथ (${k.progressPct || 0}%)\n`;
    msg += `• EVM कुल डाले गए मत: 71,943\n`;
    msg += `• अब तक गिने गए कुल मत: ${(k.totalCountedVotes || 0).toLocaleString('en-IN')}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🚩 *21 पं.स. वार्ड ताज़ा रुझान / बढ़त:*\n`;

    for (let w = 1; w <= 21; w++) {
        const wm = countingData.ps_wards[`W-${w}`];
        if (wm && wm.completedBooths > 0 && wm.leader && wm.leader.votes > 0) {
            const statusEmoji = wm.status === 'DECLARED' ? '✅ [घोषित]' : '⏳ [आगे]';
            msg += `• *वार्ड ${w}:* ${wm.leader.name} (${wm.leader.party}) +${wm.margin} मतों से ${statusEmoji}\n`;
        }
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📈 *दलगत स्थिति (पंचायत समिति 21 वार्ड):*\n`;
    msg += `• भाजपा: ${(pt.BJP?.won || 0) + (pt.BJP?.lead || 0)} (जीत: ${pt.BJP?.won || 0} | आगे: ${pt.BJP?.lead || 0})\n`;
    msg += `• कांग्रेस: ${(pt.INC?.won || 0) + (pt.INC?.lead || 0)} (जीत: ${pt.INC?.won || 0} | आगे: ${pt.INC?.lead || 0})\n`;
    msg += `• निर्दलीय: ${(pt.IND?.won || 0) + (pt.IND?.lead || 0)} (जीत: ${pt.IND?.won || 0} | आगे: ${pt.IND?.lead || 0})\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `_— कंट्रोल रूम, निर्वाचक रजिस्ट्रीकरण अधिकारी (SDM), सुमेरपुर_`;

    const txtBox = document.getElementById('bulletinTextBox');
    if (txtBox) txtBox.value = msg;
}

function copyBulletin() {
    const txtBox = document.getElementById('bulletinTextBox');
    if (txtBox) {
        txtBox.select();
        navigator.clipboard.writeText(txtBox.value).then(() => {
            showToast('कॉपी हुआ!', 'WhatsApp बुलेटिन क्लिपबोर्ड पर कॉपी हो गया।', 'success', 3000);
        });
    }
}

// -------------------------------------------------------------
// GOOGLE SHEET SYNC
// -------------------------------------------------------------
async function triggerGoogleSheetSync() {
    const btn = document.getElementById('btnSyncGoogle');
    if (btn) { btn.classList.add('spinning'); btn.disabled = true; }

    const statusEl = document.getElementById('syncStatusIndicator');
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#6366f1;"></i> Google Sheet से डेटा सिंक हो रहा है...';

    try {
        const res = await fetch('/api/counting/sync-google-sheet');
        const data = await res.json();
        if (data.success) {
            countingData = data;
            showToast('सिंक सफल!', data.message, 'success', 4000);
            if (statusEl) statusEl.innerHTML = `<i class="fas fa-circle-check" style="color:#10b981;"></i> सिंक सफल (${data.updatedCount} प्रविष्टियां अपडेट)`;
            renderAll();
        } else if (data.error === 'UNAUTHORIZED') {
            showToast('परमिशन आवश्यक', data.message, 'warning', 7000);
            openSheetSettingsModal();
        } else {
            showToast('सिंक त्रुटि', data.message || 'त्रुटि', 'error', 4000);
        }
    } catch (e) {
        showToast('नेटवर्क त्रुटि', e.message, 'error', 3000);
    } finally {
        if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
    }
}

function toggleAutoSync(enabled) {
    if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
    if (enabled) {
        showToast('ऑटो-सिंक चालू', 'प्रत्येक 30 सेकंड में स्वतः सिंक होगा।', 'info', 3000);
        triggerGoogleSheetSync();
        autoSyncTimer = setInterval(triggerGoogleSheetSync, 30000);
    } else {
        showToast('ऑटो-सिंक बंद', 'स्वचालित सिंक रोक दिया गया है।', 'info', 2500);
    }
}

// -------------------------------------------------------------
// MODALS
// -------------------------------------------------------------
function openSheetSettingsModal() {
    const m = document.getElementById('sheetSettingsModal');
    if (m) {
        document.getElementById('settingSheetId').value = countingData?.config?.sheetId || '';
        document.getElementById('settingGid').value = countingData?.config?.gid || '0';
        m.style.display = 'flex';
    }
}

function closeSheetSettingsModal() {
    const m = document.getElementById('sheetSettingsModal');
    if (m) m.style.display = 'none';
}

async function saveSheetSettings() {
    const sheetId = document.getElementById('settingSheetId').value.trim();
    const gid = document.getElementById('settingGid').value.trim();
    try {
        const res = await fetch('/api/counting/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheetId, gid })
        });
        const data = await res.json();
        if (data.success) {
            showToast('सेटिंग्स सुरक्षित', 'Google Sheet ID व GID अपडेट कर दी गई है।', 'success', 3000);
            closeSheetSettingsModal();
            triggerGoogleSheetSync();
        }
    } catch (e) {
        showToast('त्रुटि', e.message, 'error', 3000);
    }
}

function downloadTemplateCSV() {
    window.location.href = '/api/counting/template-csv';
}

function exportExcel() {
    window.location.href = '/api/counting/export-csv';
}

// Header Tools Dropdown Menu (3-Dots / Hamburger)
function toggleHeaderMenu(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const dropdown = document.getElementById('headerMenuDropdown');
    const btn = document.getElementById('btnHeaderMenu');
    if (!dropdown) return;
    const isClosed = dropdown.style.display === 'none' || !dropdown.style.display;
    if (isClosed) {
        dropdown.style.display = 'block';
        if (btn) btn.classList.add('active');
    } else {
        dropdown.style.display = 'none';
        if (btn) btn.classList.remove('active');
    }
}

function closeHeaderMenu() {
    const dropdown = document.getElementById('headerMenuDropdown');
    const btn = document.getElementById('btnHeaderMenu');
    if (dropdown) dropdown.style.display = 'none';
    if (btn) btn.classList.remove('active');
}

// Global click & Escape key listener to close header & TV menus
document.addEventListener('click', (e) => {
    const container = document.querySelector('.header-menu-container');
    if (container && !container.contains(e.target)) {
        closeHeaderMenu();
    }
    const tvViewContainer = document.querySelector('.tv-view-menu-container');
    if (tvViewContainer && !tvViewContainer.contains(e.target)) {
        closeTvViewMenu();
    }
    const tvToolsContainer = document.querySelector('.tv-tools-menu-container');
    if (tvToolsContainer && !tvToolsContainer.contains(e.target)) {
        closeTvToolsMenu();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeHeaderMenu();
        closeTvViewMenu();
        closeTvToolsMenu();
    }
});

// Mock Test Modal Controls
function openMockTestModal() {
    const m = document.getElementById('mockTestModal');
    if (m) m.style.display = 'flex';
}

function closeMockTestModal() {
    const m = document.getElementById('mockTestModal');
    if (m) m.style.display = 'none';
}

async function executeMockTest(action) {
    try {
        showToast('सिमुलेशन', 'मॉक टेस्ट प्रोसेस हो रहा है...', 'info', 2000);
        const res = await fetch('/api/counting/mock-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        const data = await res.json();
        if (data.success) {
            countingData = data;
            showToast('मॉक टेस्ट पूर्ण', data.message, 'success', 4000);
            closeMockTestModal();
            renderAll();
        } else {
            showToast('त्रुटि', data.message || 'त्रुटि हुई', 'error', 3000);
        }
    } catch (e) {
        showToast('त्रुटि', e.message, 'error', 3000);
    }
}

// Edit Slot Modal (Unified PS & ZP Display-Compatible)
let activeEditSlotNo = 1;

function openEditSlotModal(sNo) {
    activeEditSlotNo = Number(sNo) || 1;
    const m = document.getElementById('editSlotModal');
    if (!m || !countingData) return;

    const s = countingData.slots[String(activeEditSlotNo)] || {};
    const v = s.votes || {};
    const zv = s.zp_votes || {};

    // Header Badges & Info
    const bRd = document.getElementById('emBadgeRound');
    const bTb = document.getElementById('emBadgeTable');
    const bBt = document.getElementById('emBadgeBooth');
    const bPs = document.getElementById('emBadgePSWard');
    const bZp = document.getElementById('emBadgeZPWard');

    if (bRd) bRd.textContent = `राउंड ${s.round}`;
    if (bTb) bTb.textContent = `टेबल ${s.table}`;
    if (bBt) bBt.textContent = `बूथ ${s.booth_no}`;
    if (bPs) bPs.textContent = `पं.स. ${s.ps_ward}`;
    if (bZp) bZp.textContent = `जि.प. ${s.zp_ward}`;

    const titleEl = document.getElementById('emModalTitle');
    const subEl = document.getElementById('emModalSubtitle');
    const cuEl = document.getElementById('emModalCUID');
    const polEl = document.getElementById('emModalPolled');

    if (titleEl) titleEl.textContent = `${s.gp_name} — ${s.location || ''}`;
    if (subEl) subEl.textContent = `कमरा नं. व भवन | कुल मतदाता: ${(s.electors || 0).toLocaleString('en-IN')}`;
    if (cuEl) cuEl.textContent = s.cu_id || '-';
    if (polEl) polEl.textContent = (s.polled_votes || 0).toLocaleString('en-IN');

    // Header Ward Tags
    const psH = document.getElementById('emPSWardHeader');
    const zpH = document.getElementById('emZPWardHeader');
    if (psH) psH.textContent = `वार्ड ${s.ps_ward}`;
    if (zpH) zpH.textContent = `वार्ड ${s.zp_ward}`;

    // 1. Panchayat Samiti Candidate Fields
    const wInfo = countingData.ps_wards[s.ps_ward] || {};
    const candList = wInfo.candidates || [];
    const psFieldsBox = document.getElementById('emPSFields');

    let psHtml = '';
    candList.forEach((c, idx) => {
        let pColor = '#9333ea';
        if (c.party === 'BJP') pColor = '#ea580c';
        else if (c.party === 'INC') pColor = '#0284c7';

        psHtml += `
            <div class="entry-cand-row" style="border-left: 4px solid ${pColor};">
                <div class="cand-meta">
                    <div class="cand-name-title">
                        <span>${idx + 1}. ${c.name}</span>
                        <span class="party-tag" style="background:${pColor}15; color:${pColor}; font-size:11px;">${c.party}</span>
                    </div>
                    <div class="cand-subinfo">चिन्ह: <b>${c.symbol}</b></div>
                </div>
                <input type="number" id="emInput_ps_${c.key}" class="entry-cand-input" min="0" value="${v[c.key] !== undefined ? v[c.key] : 0}" oninput="calcEditModalTotal()">
            </div>
        `;
    });

    // PS NOTA
    psHtml += `
        <div class="entry-cand-row nota-row">
            <div class="cand-meta">
                <div class="cand-name-title" style="color:#64748b;">
                    <span>${candList.length + 1}. नोटा (NOTA)</span>
                    <span class="party-tag" style="background:#e2e8f0; color:#475569; font-size:11px;">NOTA</span>
                </div>
                <div class="cand-subinfo">उपरोक्त में से कोई नहीं</div>
            </div>
            <input type="number" id="emInput_ps_nota" class="entry-cand-input" min="0" value="${v.nota !== undefined ? v.nota : 0}" oninput="calcEditModalTotal()">
        </div>
    `;
    if (psFieldsBox) psFieldsBox.innerHTML = psHtml;

    // 2. Zila Parishad Candidate Fields
    const zwInfo = countingData.zp_wards[s.zp_ward] || {};
    const zCandList = zwInfo.candidates || [];
    const zpFieldsBox = document.getElementById('emZPFields');

    let zpHtml = '';
    zCandList.forEach((c, idx) => {
        let pColor = '#9333ea';
        if (c.party === 'BJP') pColor = '#ea580c';
        else if (c.party === 'INC') pColor = '#0284c7';

        zpHtml += `
            <div class="entry-cand-row" style="border-left: 4px solid ${pColor};">
                <div class="cand-meta">
                    <div class="cand-name-title">
                        <span>${idx + 1}. ${c.name}</span>
                        <span class="party-tag" style="background:${pColor}15; color:${pColor}; font-size:11px;">${c.party}</span>
                    </div>
                    <div class="cand-subinfo">दल: <b>${c.party}</b> (${c.symbol || 'चिन्ह'})</div>
                </div>
                <input type="number" id="emInput_zp_${c.key}" class="entry-cand-input" min="0" value="${zv[c.key] !== undefined ? zv[c.key] : 0}" oninput="calcEditModalTotal()">
            </div>
        `;
    });

    // ZP NOTA
    zpHtml += `
        <div class="entry-cand-row nota-row">
            <div class="cand-meta">
                <div class="cand-name-title" style="color:#64748b;">
                    <span>${zCandList.length + 1}. नोटा (NOTA)</span>
                    <span class="party-tag" style="background:#e2e8f0; color:#475569; font-size:11px;">NOTA</span>
                </div>
                <div class="cand-subinfo">उपरोक्त में से कोई नहीं</div>
            </div>
            <input type="number" id="emInput_zp_nota" class="entry-cand-input" min="0" value="${zv.nota !== undefined ? zv.nota : 0}" oninput="calcEditModalTotal()">
        </div>
    `;
    if (zpFieldsBox) zpFieldsBox.innerHTML = zpHtml;

    // Remark
    const remEl = document.getElementById('editModalRemark');
    if (remEl) remEl.value = s.remark || '';

    // Prev / Next button state
    const btnP = document.getElementById('btnPrevSlot');
    const btnN = document.getElementById('btnNextSlot');
    if (btnP) btnP.disabled = (activeEditSlotNo <= 1);
    if (btnN) btnN.disabled = (activeEditSlotNo >= 152);

    calcEditModalTotal();
    m.style.display = 'flex';
}

function closeEditSlotModal() {
    const m = document.getElementById('editSlotModal');
    if (m) m.style.display = 'none';
}

function navEditSlot(delta) {
    const target = activeEditSlotNo + delta;
    if (target >= 1 && target <= 152) {
        openEditSlotModal(target);
    }
}

function calcEditModalTotal() {
    const s = countingData.slots[String(activeEditSlotNo)] || {};
    const polled = Number(s.polled_votes) || 0;

    // 1. PS Total
    const wInfo = countingData.ps_wards[s.ps_ward] || {};
    const candList = wInfo.candidates || [];
    let psTot = 0;
    candList.forEach(c => {
        const inp = document.getElementById(`emInput_ps_${c.key}`);
        if (inp) psTot += Number(inp.value) || 0;
    });
    const psNotaInp = document.getElementById('emInput_ps_nota');
    if (psNotaInp) psTot += Number(psNotaInp.value) || 0;

    const psDisp = document.getElementById('emPSTotalDisplay');
    if (psDisp) psDisp.textContent = psTot.toLocaleString('en-IN');

    const psNotice = document.getElementById('emPSVerifNotice');
    if (psNotice) {
        if (psTot === 0) {
            psNotice.innerHTML = '<span class="verif-tag pending">⚪ प्रविष्टि प्रतीक्षारत</span>';
        } else if (psTot === polled) {
            psNotice.innerHTML = `<span class="verif-tag match"><i class="fas fa-circle-check"></i> EVM 17C (${polled}) से शत-प्रतिशत मिलान पूर्ण</span>`;
        } else if (psTot > polled) {
            psNotice.innerHTML = `<span class="verif-tag mismatch"><i class="fas fa-triangle-exclamation"></i> ${psTot - polled} मत अधिक (EVM: ${polled})</span>`;
        } else {
            psNotice.innerHTML = `<span class="verif-tag mismatch"><i class="fas fa-triangle-exclamation"></i> अंतर: ${polled - psTot} मत शेष (EVM: ${polled})</span>`;
        }
    }

    // 2. ZP Total
    const zwInfo = countingData.zp_wards[s.zp_ward] || {};
    const zCandList = zwInfo.candidates || [];
    let zpTot = 0;
    zCandList.forEach(c => {
        const inp = document.getElementById(`emInput_zp_${c.key}`);
        if (inp) zpTot += Number(inp.value) || 0;
    });
    const zpNotaInp = document.getElementById('emInput_zp_nota');
    if (zpNotaInp) zpTot += Number(zpNotaInp.value) || 0;

    const zpDisp = document.getElementById('emZPTotalDisplay');
    if (zpDisp) zpDisp.textContent = zpTot.toLocaleString('en-IN');

    const zpNotice = document.getElementById('emZPVerifNotice');
    if (zpNotice) {
        if (zpTot === 0) {
            zpNotice.innerHTML = '<span class="verif-tag pending">⚪ प्रविष्टि प्रतीक्षारत</span>';
        } else if (zpTot === polled) {
            zpNotice.innerHTML = `<span class="verif-tag match"><i class="fas fa-circle-check"></i> EVM 17C (${polled}) से शत-प्रतिशत मिलान पूर्ण</span>`;
        } else if (zpTot > polled) {
            zpNotice.innerHTML = `<span class="verif-tag mismatch"><i class="fas fa-triangle-exclamation"></i> ${zpTot - polled} मत अधिक (EVM: ${polled})</span>`;
        } else {
            zpNotice.innerHTML = `<span class="verif-tag mismatch"><i class="fas fa-triangle-exclamation"></i> अंतर: ${polled - zpTot} मत शेष (EVM: ${polled})</span>`;
        }
    }
}

async function saveEditSlotModal(andNext = false) {
    const s = countingData.slots[String(activeEditSlotNo)] || {};
    const wInfo = countingData.ps_wards[s.ps_ward] || {};
    const candList = wInfo.candidates || [];

    // PS Votes
    const psVotes = {};
    candList.forEach(c => {
        const inp = document.getElementById(`emInput_ps_${c.key}`);
        if (inp) psVotes[c.key] = Number(inp.value) || 0;
    });
    const psNotaInp = document.getElementById('emInput_ps_nota');
    psVotes.nota = Number(psNotaInp?.value) || 0;

    // ZP Votes
    const zwInfo = countingData.zp_wards[s.zp_ward] || {};
    const zCandList = zwInfo.candidates || [];
    const zpVotes = {};
    zCandList.forEach(c => {
        const inp = document.getElementById(`emInput_zp_${c.key}`);
        if (inp) zpVotes[c.key] = Number(inp.value) || 0;
    });
    const zpNotaInp = document.getElementById('emInput_zp_nota');
    zpVotes.nota = Number(zpNotaInp?.value) || 0;

    const remark = (document.getElementById('editModalRemark')?.value || '').trim();

    try {
        const res = await fetch('/api/counting/slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                s_no: s.s_no,
                round: s.round,
                table: s.table,
                booth_no: s.booth_no,
                votes: psVotes,
                zp_votes: zpVotes,
                remark,
                status: 'COMPLETED'
            })
        });
        const data = await res.json();
        if (data.success) {
            countingData = data;
            renderAll();

            const successMsg = `टेबल ${s.table} • बूथ ${s.booth_no} (CU: ${s.cu_id}) का डेटा सफलतापूर्वक सुरक्षित हो गया!`;
            showToast('डेटा सुरक्षित!', successMsg, 'success', 3500);

            if (andNext && activeEditSlotNo < 152) {
                navEditSlot(1);
                // Show notification in the next slot as well
                setTimeout(() => {
                    const alertBox = document.getElementById('emSaveSuccessAlert');
                    if (alertBox) {
                        alertBox.innerHTML = `<i class="fas fa-circle-check" style="font-size:18px; color:#10b981;"></i> <span>पिछली टेबल (${s.table}) सुरक्षित! अब टेबल ${countingData.slots[String(activeEditSlotNo)]?.table || ''} की प्रविष्टि करें।</span>`;
                        alertBox.style.display = 'flex';
                        setTimeout(() => { if (alertBox) alertBox.style.display = 'none'; }, 4000);
                    }
                }, 50);
            } else {
                openEditSlotModal(activeEditSlotNo);
                const alertBox = document.getElementById('emSaveSuccessAlert');
                if (alertBox) {
                    alertBox.innerHTML = `<i class="fas fa-circle-check" style="font-size:18px; color:#10b981;"></i> <span>${successMsg}</span>`;
                    alertBox.style.display = 'flex';
                    setTimeout(() => { if (alertBox) alertBox.style.display = 'none'; }, 4000);
                }
            }
        } else {
            showToast('त्रुटि', data.message || 'सुरक्षित करने में त्रुटि', 'error', 3000);
        }
    } catch (e) {
        showToast('त्रुटि', e.message, 'error', 3000);
    }
}

// Ward Breakdown Modal
function openWardBreakdownModal(wardKey) {
    const wm = countingData.ps_wards[wardKey];
    if (!wm) return;
    const m = document.getElementById('wardBreakdownModal');
    if (!m) return;

    let leadText = '';
    if (wm.leader && wm.leader.votes > 0) {
        leadText = ` | बढ़त: ${wm.leader.name} (${wm.leader.party}) +${wm.margin.toLocaleString('en-IN')} मत`;
    }

    document.getElementById('wbModalTitle').innerHTML = `
        <i class="fas fa-list-check" style="color:#2563eb;"></i>
        <span>वार्ड ${wardKey} — बूथ-वार मतगणना विवरण</span>
    `;
    document.getElementById('wbModalSubtitle').textContent = `कुल बूथ: ${wm.totalBooths} | पूर्ण: ${wm.completedBooths}/${wm.totalBooths} | EVM मत: ${(wm.totalPolledVotes || 0).toLocaleString('en-IN')} | गिने मत: ${(wm.totalCountedVotes || 0).toLocaleString('en-IN')}${leadText}`;

    const candList = wm.candidates || [];
    const thead = document.getElementById('wbModalThead');
    const tbody = document.getElementById('wbModalTbody');

    thead.innerHTML = `
        <tr>
            <th style="padding:10px 8px; text-align:center;">क्र.सं.</th>
            <th style="padding:10px 8px; text-align:center;">राउंड</th>
            <th style="padding:10px 8px; text-align:center;">टेबल</th>
            <th style="padding:10px 8px; text-align:center;">बूथ</th>
            <th style="padding:10px 8px; text-align:center;">सी.यू. क्रमांक (CU ID)</th>
            <th style="padding:10px 8px; text-align:left;">ग्राम पंचायत व भवन</th>
            <th style="padding:10px 8px; text-align:right;">EVM मत (17C)</th>
            ${candList.map(c => `<th style="padding:10px 8px; text-align:right;">${c.name} <small>[${c.party}]</small></th>`).join('')}
            <th style="padding:10px 8px; text-align:right;">नोटा</th>
            <th style="padding:10px 8px; text-align:right;">कुल मत</th>
            <th style="padding:10px 8px; text-align:center;">स्थिति</th>
        </tr>
    `;

    let html = '';
    (wm.booths || []).forEach(s => {
        const v = s.votes || {};
        html += `
            <tr>
                <td style="text-align:center; font-weight:700;">${s.s_no}</td>
                <td style="text-align:center;"><span class="round-pill" style="padding:2px 7px; background:#e0e7ff; color:#3730a3; border-radius:4px; font-weight:800; font-size:11px;">R-${s.round}</span></td>
                <td style="text-align:center; font-weight:800; color:#1e40af;">टेबल ${s.table}</td>
                <td style="text-align:center; font-weight:900;">${s.booth_no || '-'}</td>
                <td style="text-align:center; font-weight:800; color:#d97706; background:#fffbeb;">${s.cu_id}</td>
                <td style="text-align:left;">
                    <div style="font-weight:700; color:#0f172a;">${s.gp_name}</div>
                    <small style="color:#64748b;">${s.location || ''}</small>
                </td>
                <td style="text-align:right; font-weight:800; color:#0369a1; background:#f0f9ff;">${(s.polled_votes || 0).toLocaleString('en-IN')}</td>
                ${candList.map(c => `<td style="text-align:right; font-weight:700;">${(v[c.key] || 0).toLocaleString('en-IN')}</td>`).join('')}
                <td style="text-align:right; color:#64748b;">${(v.nota || 0).toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:900; color:#0f172a; background:#f8fafc;">${(v.total || 0).toLocaleString('en-IN')}</td>
                <td style="text-align:center;">
                    <span class="status-pill ${s.status === 'COMPLETED' ? 'declared' : 'pending'}">${s.status === 'COMPLETED' ? 'पूर्ण' : 'प्रतीक्षारत'}</span>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    m.style.display = 'flex';
}

function closeWardBreakdownModal() {
    const m = document.getElementById('wardBreakdownModal');
    if (m) m.style.display = 'none';
}

// WhatsApp Modal Functions
function openWhatsAppModal(roundNum) {
    const r = Number(roundNum) || selectedRound || 1;
    const m = document.getElementById('whatsappModal');
    if (!m) return;
    const sel = document.getElementById('waModalRoundSelect');
    if (sel) sel.value = String(r);
    renderWhatsAppModalText(r);
    m.style.display = 'flex';
}

function closeWhatsAppModal() {
    const m = document.getElementById('whatsappModal');
    if (m) m.style.display = 'none';
}

function renderWhatsAppModalText(roundNum) {
    if (!countingData) return;
    const r = Number(roundNum) || 1;
    generateBulletin(r);
    const mainBox = document.getElementById('bulletinTextBox');
    const waBox = document.getElementById('waModalTextBox');
    const waTitle = document.getElementById('waModalTitle');
    if (waTitle) waTitle.textContent = `राउंड ${r} — आधिकारिक मतगणना WhatsApp बुलेटिन`;
    if (mainBox && waBox) {
        waBox.value = mainBox.value;
    }
}

function copyWhatsAppModalText() {
    const waBox = document.getElementById('waModalTextBox');
    if (waBox) {
        waBox.select();
        navigator.clipboard.writeText(waBox.value).then(() => {
            showToast('कॉपी हुआ!', 'WhatsApp बुलेटिन क्लिपबोर्ड पर कॉपी हो गया।', 'success', 3000);
        });
    }
}

function shareWhatsAppDirect() {
    const waBox = document.getElementById('waModalTextBox');
    if (waBox && waBox.value) {
        const text = encodeURIComponent(waBox.value);
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
}

// War Room TV Controls (Separated Round-wise & PS/ZP Stats)
warRoomView = 'round_tables'; // 'round_tables', 'ps_wards', 'zp_wards'
let warRoomSelectedRound = 1;
let isWarRoomAuto = false;

function setWarRoomView(view) {
    warRoomView = view;
    const labelEl = document.getElementById('tvCurrentViewName');
    if (labelEl) {
        if (view === 'round_tables') labelEl.innerHTML = '<i class="fas fa-layer-group" style="color:#60a5fa;"></i> 1. राउंड टेबल (1-15)';
        else if (view === 'ps_wards') labelEl.innerHTML = '<i class="fas fa-landmark" style="color:#fde047;"></i> 2. पं.स. सांख्यिकी (21 वार्ड)';
        else if (view === 'zp_wards') labelEl.innerHTML = '<i class="fas fa-building-columns" style="color:#c084fc;"></i> 3. जि.प. सांख्यिकी (4 वार्ड)';
    }
    const optR = document.getElementById('tvOptRound');
    const optP = document.getElementById('tvOptPS');
    const optZ = document.getElementById('tvOptZP');
    if (optR) optR.classList.toggle('active', view === 'round_tables');
    if (optP) optP.classList.toggle('active', view === 'ps_wards');
    if (optZ) optZ.classList.toggle('active', view === 'zp_wards');
    renderWarRoom();
}

function selectWarRoomView(view) {
    setWarRoomView(view);
    closeTvViewMenu();
}

function toggleTvViewMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    closeTvToolsMenu();
    const d = document.getElementById('tvViewDropdown');
    if (!d) return;
    d.style.display = (d.style.display === 'none' || !d.style.display) ? 'block' : 'none';
}

function closeTvViewMenu() {
    const d = document.getElementById('tvViewDropdown');
    if (d) d.style.display = 'none';
}

function toggleTvToolsMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    closeTvViewMenu();
    const d = document.getElementById('tvToolsDropdown');
    if (!d) return;
    d.style.display = (d.style.display === 'none' || !d.style.display) ? 'block' : 'none';
}

function closeTvToolsMenu() {
    const d = document.getElementById('tvToolsDropdown');
    if (d) d.style.display = 'none';
}

function updateTvSoundMenuText() {
    const soundLbl = document.getElementById('tvMenuSoundLabel');
    const soundIcon = document.getElementById('tvMenuSoundIcon');
    if (soundLbl) soundLbl.textContent = isSoundAlertEnabled ? 'साउंड बीप अलर्ट: चालू' : 'साउंड बीप अलर्ट: बंद';
    if (soundIcon) {
        soundIcon.className = isSoundAlertEnabled ? 'fas fa-volume-high' : 'fas fa-volume-xmark';
        soundIcon.style.color = isSoundAlertEnabled ? '#fde047' : '#94a3b8';
    }
}

function setWarRoomRound(r) {
    warRoomSelectedRound = Number(r) || 1;
    renderWarRoom();
}

function toggleWarRoomAuto() {
    isWarRoomAuto = !isWarRoomAuto;
    const notice = document.getElementById('warRoomAutoNotice');
    const autoLabel = document.getElementById('tvMenuAutoLabel');
    const autoDropLabel = document.getElementById('tvAutoDropdownLabel');
    if (notice) notice.textContent = isWarRoomAuto ? 'ऑटो: चालू (12s)' : 'ऑटो: बंद';
    if (autoLabel) autoLabel.textContent = isWarRoomAuto ? 'ऑटो-रोटेशन (12s): चालू' : 'ऑटो-रोटेशन (12s): बंद';
    if (autoDropLabel) autoDropLabel.textContent = isWarRoomAuto ? '4. ऑटो-रोटेशन (12s): चालू' : '4. ऑटो-रोटेशन (12s): बंद';

    if (isWarRoomAuto) {
        if (!warRoomTimer) {
            warRoomTimer = setInterval(() => {
                if (warRoomView === 'round_tables') setWarRoomView('ps_wards');
                else if (warRoomView === 'ps_wards') setWarRoomView('zp_wards');
                else setWarRoomView('round_tables');
            }, 12000);
        }
    } else {
        if (warRoomTimer) {
            clearInterval(warRoomTimer);
            warRoomTimer = null;
        }
    }
}

function openWarRoom() {
    isWarRoomOpen = true;
    document.body.classList.add('warroom-active');
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam && ['round_tables', 'ps_wards', 'zp_wards'].includes(viewParam)) {
        setWarRoomView(viewParam);
    } else {
        setWarRoomView(warRoomView || 'round_tables');
    }
    const m = document.getElementById('warRoomModal');
    if (m) {
        m.style.display = 'flex';
        renderWarRoom();
    }
}

function closeWarRoom() {
    isWarRoomOpen = false;
    document.body.classList.remove('warroom-active');
    if (warRoomTimer) { clearInterval(warRoomTimer); warRoomTimer = null; }
    closeTvViewMenu();
    closeTvToolsMenu();
    const m = document.getElementById('warRoomModal');
    if (m) m.style.display = 'none';
}

function renderWarRoom() {
    if (!countingData) return;
    const k = countingData.kpi || {};
    const psPt = k.psPartyTally || {};
    const zpPt = k.zpPartyTally || {};

    // 1. Center Large Dual Scoreboard (PS & ZP)
    const dualEl = document.getElementById('warRoomDualTally');
    if (dualEl) {
        const psBjp = (psPt.BJP?.won || 0) + (psPt.BJP?.lead || 0);
        const psInc = (psPt.INC?.won || 0) + (psPt.INC?.lead || 0);
        const psInd = (psPt.IND?.won || 0) + (psPt.IND?.lead || 0);

        const zpBjp = (zpPt.BJP?.won || 0) + (zpPt.BJP?.lead || 0);
        const zpInc = (zpPt.INC?.won || 0) + (zpPt.INC?.lead || 0);
        const zpInd = (zpPt.IND?.won || 0) + (zpPt.IND?.lead || 0);

        if (warRoomView === 'ps_wards') {
            // High-Impact, Enlarged PS 21 Wards Tally Header for PS Tab
            dualEl.innerHTML = `
                <div class="tv-ps-hero-bar">
                    <div class="tp-header-tag">
                        <i class="fas fa-landmark" style="color:#60a5fa; font-size:16px;"></i>
                        <span class="tp-title-text">पं.स. 21 वार्ड</span>
                        <span class="tp-majority-pill">बहुमत: 11</span>
                    </div>
                    <div class="tp-scores-cluster">
                        <!-- BJP Hero Score -->
                        <div class="tp-hero-party bjp" title="भारतीय जनता पार्टी">
                            <span class="tp-pname">भाजपा</span>
                            <span class="tp-pscore">${psBjp}</span>
                            <span class="tp-pbreakdown">(${psPt.BJP?.won || 0} जीते ${psPt.BJP?.lead ? `• ${psPt.BJP?.lead} आगे` : ''})</span>
                        </div>
                        <div class="tp-hero-vs">VS</div>
                        <!-- INC Hero Score -->
                        <div class="tp-hero-party inc" title="भारतीय राष्ट्रीय कांग्रेस">
                            <span class="tp-pname">कांग्रेस</span>
                            <span class="tp-pscore">${psInc}</span>
                            <span class="tp-pbreakdown">(${psPt.INC?.won || 0} जीते ${psPt.INC?.lead ? `• ${psPt.INC?.lead} आगे` : ''})</span>
                        </div>
                        <!-- IND Hero Score -->
                        <div class="tp-hero-party ind" title="निर्दलीय व अन्य">
                            <span class="tp-pname">अन्य</span>
                            <span class="tp-pscore">${psInd}</span>
                            <span class="tp-pbreakdown">(${psPt.IND?.won || 0} जीते)</span>
                        </div>
                    </div>
                    <div class="tp-progress-tag">
                        <span class="tp-dec-badge"><i class="fas fa-circle-check"></i> घोषित: <b>${k.declaredWardsPS || 0}/21</b></span>
                    </div>
                </div>
            `;
        } else {
            // General Scoreboards (for Round tables & ZP view)
            dualEl.innerHTML = `
                <!-- PS 21 Wards Large Scoreboard -->
                <div class="tv-scoreboard-card ps">
                    <div class="tv-sb-label">
                        <i class="fas fa-landmark" style="color:#60a5fa;"></i> पं.स. (21)
                    </div>
                    <div class="tv-sb-scores">
                        <div class="tv-sb-party bjp" title="भारतीय जनता पार्टी">
                            <span class="p-name">भाजपा</span>
                            <span class="p-score">${psBjp}</span>
                        </div>
                        <div class="tv-sb-divider"></div>
                        <div class="tv-sb-party inc" title="भारतीय राष्ट्रीय कांग्रेस">
                            <span class="p-name">कांग्रेस</span>
                            <span class="p-score">${psInc}</span>
                        </div>
                        <div class="tv-sb-divider"></div>
                        <div class="tv-sb-party ind" title="निर्दलीय व अन्य">
                            <span class="p-name">अन्य</span>
                            <span class="p-score">${psInd}</span>
                        </div>
                    </div>
                </div>

                <!-- ZP 4 Wards Large Scoreboard -->
                <div class="tv-scoreboard-card zp">
                    <div class="tv-sb-label">
                        <i class="fas fa-building-columns" style="color:#c084fc;"></i> जि.प. (4)
                    </div>
                    <div class="tv-sb-scores">
                        <div class="tv-sb-party bjp" title="भारतीय जनता पार्टी">
                            <span class="p-name">भाजपा</span>
                            <span class="p-score">${zpBjp}</span>
                        </div>
                        <div class="tv-sb-divider"></div>
                        <div class="tv-sb-party inc" title="भारतीय राष्ट्रीय कांग्रेस">
                            <span class="p-name">कांग्रेस</span>
                            <span class="p-score">${zpInc}</span>
                        </div>
                        <div class="tv-sb-divider"></div>
                        <div class="tv-sb-party ind" title="निर्दलीय व अन्य">
                            <span class="p-name">अन्य</span>
                            <span class="p-score">${zpInd}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    const roundNav = document.getElementById('warRoomRoundNav');
    const grid = document.getElementById('warRoomTilesGrid');
    if (!grid) return;

    // VIEW 1: ROUND-WISE TABLES (5 columns x 3 rows = 15 tables Zero-Scroll Fit)
    if (warRoomView === 'round_tables') {
        if (roundNav) {
            roundNav.style.display = 'flex';
            let navHtml = '<span style="font-size:12.5px; font-weight:900; color:#fde047; margin-right:8px; white-space:nowrap;"><i class="fas fa-layer-group"></i> राउंड चुनें:</span>';
            for (let r = 1; r <= 14; r++) {
                const active = (warRoomSelectedRound === r) ? 'active' : '';
                navHtml += `<button class="tv-round-pill ${active}" onclick="setWarRoomRound(${r})">राउंड ${r}</button>`;
            }
            roundNav.innerHTML = navHtml;
        }

        const curRd = countingData.rounds[warRoomSelectedRound] || { slots: [] };
        let html = '';

        curRd.slots.forEach(s => {
            const v = s.votes || {};
            const zv = s.zp_votes || {};
            const psTot = Number(v.total) || 0;
            const zpTot = Number(zv.total) || 0;
            const polled = Number(s.polled_votes) || 0;

            const pw = countingData.ps_wards[s.ps_ward] || {};
            const zw = countingData.zp_wards[s.zp_ward] || {};

            const isDone = s.status === 'COMPLETED' || (polled > 0 && psTot === polled && zpTot === polled);

            // Booth-level leaders
            const psLeader = s.ps_leader;
            const zpLeader = s.zp_leader;

            html += `
                <div class="tv-table-tile ${isDone ? 'completed' : ''}">
                    <div class="tv-tt-head">
                        <span class="tv-tt-table-badge"><i class="fas fa-table"></i> टेबल ${s.table} • बूथ ${s.booth_no}</span>
                        <span class="tv-tt-cu-badge">CU: ${s.cu_id}</span>
                    </div>
                    <div class="tv-tt-gp" title="${s.gp_name} - ${s.location}">
                        ${s.gp_name} <small>(${s.location || ''})</small>
                    </div>

                    <!-- PS & ZP Booth Leaders in Tile -->
                    <div class="tv-tt-dual-strip">
                        <!-- PS Row -->
                        <div class="tv-tt-leader-box ps">
                            <div class="tv-tt-leader-top">
                                <span style="color:#60a5fa; font-weight:800;"><i class="fas fa-landmark"></i> पं.स. (${s.ps_ward}):</span>
                                <b style="color:#ffffff;">${psTot > 0 ? psTot + ' मत' : '<span style="color:#94a3af; font-weight:600;">प्रतीक्षारत</span>'}</b>
                            </div>
                            ${psLeader ? `
                                <div class="tv-tt-lead-detail">
                                    <span style="color:#fde047; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;" title="${psLeader.name}">
                                        👑 ${psLeader.name}
                                    </span>
                                    <span class="party-tag ${psLeader.party?.toLowerCase()}">${psLeader.party}</span>
                                    <b style="color:#ffffff;">${psLeader.votes}</b>
                                    <small style="color:#4ade80;">+${psLeader.margin}</small>
                                </div>
                            ` : `
                                <div class="tv-tt-lead-detail" style="color:#64748b; font-size:11px;">
                                    ${pw.leader?.name ? `लीड: ${pw.leader.name} (${pw.leader.party} +${pw.margin})` : 'मतगणना शेष'}
                                </div>
                            `}
                        </div>

                        <!-- ZP Row -->
                        <div class="tv-tt-leader-box zp">
                            <div class="tv-tt-leader-top">
                                <span style="color:#c084fc; font-weight:800;"><i class="fas fa-building-columns"></i> जि.प. (${s.zp_ward}):</span>
                                <b style="color:#ffffff;">${zpTot > 0 ? zpTot + ' मत' : '<span style="color:#94a3af; font-weight:600;">प्रतीक्षारत</span>'}</b>
                            </div>
                            ${zpLeader ? `
                                <div class="tv-tt-lead-detail">
                                    <span style="color:#fde047; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;" title="${zpLeader.name}">
                                        👑 ${zpLeader.name}
                                    </span>
                                    <span class="party-tag ${zpLeader.party?.toLowerCase()}">${zpLeader.party}</span>
                                    <b style="color:#ffffff;">${zpLeader.votes}</b>
                                    <small style="color:#4ade80;">+${zpLeader.margin}</small>
                                </div>
                            ` : `
                                <div class="tv-tt-lead-detail" style="color:#64748b; font-size:11px;">
                                    ${zw.leader?.name ? `लीड: ${zw.leader.name} (${zw.leader.party} +${zw.margin})` : 'मतगणना शेष'}
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="tv-tt-foot">
                        <span>EVM मत: <b style="color:#38bdf8; font-size:13px;">${polled}</b></span>
                        <span style="color:${isDone ? '#4ade80' : '#f59e0b'}; font-weight:900; font-size:12.5px;">
                            ${isDone ? '🟢 बूथ पूर्ण' : '⚪ शेष'}
                        </span>
                    </div>
                </div>
            `;
        });
        grid.className = 'warroom-grid-tables';
        grid.removeAttribute('style');
        grid.innerHTML = html;
    }

    // VIEW 2: PANCHAYAT SAMITI (7 columns x 3 rows = 21 Wards Clean Zero-Scroll TV Fit)
    else if (warRoomView === 'ps_wards') {
        if (roundNav) roundNav.style.display = 'none';

        let html = '';
        for (let w = 1; w <= 21; w++) {
            const wm = countingData.ps_wards[`W-${w}`] || {};
            const isDeclared = wm.status === 'DECLARED';
            const leader = wm.leader || { name: '-', party: '-', votes: 0 };
            const runnerUp = wm.runnerUp;
            const hasCounted = wm.completedBooths > 0 && leader.votes > 0;
            const leadingParty = leader.party ? leader.party.toLowerCase() : '';

            let statusClass = 'pending';
            let statusBadge = '<span class="tw-status-badge pending"><i class="fas fa-hourglass-start"></i> प्रतीक्षारत</span>';
            if (isDeclared) {
                statusClass = 'declared';
                statusBadge = '<span class="tw-status-badge won"><i class="fas fa-trophy"></i> परिणाम घोषित</span>';
            } else if (hasCounted) {
                statusClass = 'counting';
                statusBadge = `<span class="tw-status-badge lead"><i class="fas fa-bolt"></i> लीड (${wm.completedBooths}/${wm.totalBooths})</span>`;
            }

            // Hot Seat Check (Margin <= 100 in ongoing counting)
            const isHotSeat = hasCounted && !isDeclared && wm.margin > 0 && wm.margin <= 100;
            const totPolled = Number(wm.totalPolledVotes) || 0;
            const totCounted = Number(wm.totalCountedVotes) || 0;
            const wardProgressPct = totPolled > 0 ? Math.min(100, Math.round((totCounted / totPolled) * 100)) : 0;

            html += `
                <div class="tv-ward-card ${statusClass} party-${leadingParty}">
                    <!-- 1. Header: Ward Tag & Status -->
                    <div class="tw-card-head">
                        <div class="tw-ward-pill">
                            <span class="tw-ward-name">वार्ड W-${w}</span>
                            ${isHotSeat ? `<span class="tw-hot-pill" title="अंतर 100 मतों से कम है"><i class="fas fa-fire"></i> टक्कर</span>` : ''}
                        </div>
                        ${statusBadge}
                    </div>

                    <!-- 2. Hero Box: Winner / Leader (Clean, Punchy & Big) -->
                    ${hasCounted ? `
                        <div class="tw-hero-body">
                            <!-- Candidate Name & Party Badge -->
                            <div class="tw-lead-row">
                                <span class="tw-party-tag ${leadingParty}">${leader.party}</span>
                                <span class="tw-lead-name" title="${leader.name}">${leader.name}</span>
                            </div>

                            <!-- Big Vote Count & Margin Strip -->
                            <div class="tw-metric-row">
                                <div class="tw-vote-box">
                                    <span class="tw-vote-val">${Number(leader.votes).toLocaleString('en-IN')}</span>
                                    <span class="tw-vote-unit">मत</span>
                                </div>
                                <div class="tw-margin-badge ${isDeclared ? 'won' : (isHotSeat ? 'hot' : 'lead')}">
                                    <i class="fas ${isDeclared ? 'fa-check' : 'fa-arrow-up'}"></i>
                                    <span>+${Number(wm.margin).toLocaleString('en-IN')} ${isDeclared ? 'जीत' : 'लीड'}</span>
                                </div>
                            </div>

                            <!-- Runner-up Line (Clean, 1 Single Line) -->
                            <div class="tw-runner-strip">
                                <span class="tw-rn-label">पीछे:</span>
                                <span class="tw-rn-name" title="${runnerUp ? runnerUp.name : '-'}">${runnerUp ? runnerUp.name : '-'}</span>
                                <span class="tw-rn-party">(${runnerUp?.party || '-'})</span>
                                <span class="tw-rn-val">${runnerUp ? Number(runnerUp.votes).toLocaleString('en-IN') : 0} मत</span>
                            </div>
                        </div>
                    ` : `
                        <!-- Pending State: Clean contestants preview -->
                        <div class="tw-pending-body">
                            <div class="tw-cands-title">प्रत्याशी:</div>
                            <div class="tw-cands-list">
                                ${(wm.candidates || []).map(c => `
                                    <div class="tw-cand-item">
                                        <span class="tw-cand-name">${c.name}</span>
                                        <span class="tw-party-mini ${(c.party || 'IND').toLowerCase()}">${c.party || 'IND'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `}

                    <!-- 3. Bottom Footer: Progress & Booths -->
                    <div class="tw-card-foot">
                        <div class="tw-foot-stats">
                            <span>बूथ: <b>${wm.completedBooths}/${wm.totalBooths}</b></span>
                            <span>गिने: <b>${totCounted.toLocaleString('en-IN')}</b> (${wardProgressPct}%)</span>
                        </div>
                        <div class="tw-progress-track">
                            <div class="tw-progress-fill ${isDeclared ? 'declared' : 'counting'}" style="width:${wardProgressPct}%;"></div>
                        </div>
                    </div>
                </div>
            `;
        }
        grid.className = 'warroom-grid-ps';
        grid.removeAttribute('style');
        grid.innerHTML = html;
    }

    // VIEW 3: ZILA PARISHAD (2 columns x 2 rows = 4 Wards Zero-Scroll Big TV Fit)
    else if (warRoomView === 'zp_wards') {
        if (roundNav) roundNav.style.display = 'none';

        let html = '';
        ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
            const zw = countingData.zp_wards[zKey] || {};
            const candList = zw.candidates || [];
            const candVotes = zw.candVotes || {};
            const totPolled = zw.totalPolledVotes || 0;
            const totCounted = zw.totalCountedVotes || 0;
            const progress = totPolled > 0 ? ((totCounted / totPolled) * 100).toFixed(1) : '0.0';
            const isDeclared = zw.status === 'DECLARED';
            const leader = zw.leader || { name: '-', party: '-', votes: 0 };
            const runnerUp = zw.runnerUp;
            const hasCounted = totCounted > 0;

            let statusClass = 'pending';
            let statusBadge = '<span class="tv-wt-status pending" style="font-size:14px; padding:5px 12px;">⚪ प्रतीक्षारत</span>';
            if (isDeclared) {
                statusClass = 'declared';
                statusBadge = '<span class="tv-wt-status declared" style="font-size:14px; padding:5px 12px;">🟢 घोषित</span>';
            } else if (hasCounted) {
                statusClass = 'counting';
                statusBadge = `<span class="tv-wt-status counting" style="font-size:14px; padding:5px 12px;">🟡 लीड (${zw.completedBooths}/${zw.totalBooths} बूथ)</span>`;
            }

            const isZpHotSeat = hasCounted && !isDeclared && zw.margin > 0 && zw.margin <= 100;

            html += `
                <div class="tv-zp-card ${statusClass}">
                    <!-- Top Head: Ward Number + Hot Seat + Top Status (घोषित / लीड / प्रतीक्षारत) -->
                    <div class="tv-zp-head">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div class="tv-zp-title">🏛️ जिला परिषद वार्ड संख्या ${zw.wardNo || zKey}</div>
                                ${isZpHotSeat ? `<span class="hot-contest-badge" style="font-size:12.5px; padding:3px 10px;"><i class="fas fa-fire"></i> कड़ी टक्कर (+${zw.margin} मत)</span>` : ''}
                            </div>
                            <div class="tv-zp-sub">सुमेरपुर ब्लॉक क्षेत्र • ZP WARD ${zw.wardNo || zKey} (${zw.completedBooths || 0}/${zw.totalBooths || 0} बूथ पूर्ण)</div>
                        </div>
                        ${statusBadge}
                    </div>

                    <!-- Highlight Summary Strip: कौन जीता / आगे है, कितने मार्जिन से, कौन पीछे है -->
                    ${isDeclared ? `
                        <div class="tv-zp-stats-strip" style="background:#064e3b; border:1.5px solid #10b981; justify-content:space-between; padding:8px 16px;">
                            <div>
                                <span style="color:#a7f3d0; font-size:12.5px; font-weight:800;"><i class="fas fa-trophy"></i> विजेता (जीता):</span>
                                <div style="font-size:19px; font-weight:900; color:#ffffff;">
                                    ${leader.name} <span style="font-size:13.5px; color:#6ee7b7;">[${leader.party}]</span>
                                    <span style="font-size:18px; color:#fde047; margin-left:8px;">${Number(leader.votes).toLocaleString('en-IN')} मत</span>
                                </div>
                            </div>
                            <div style="text-align:center; background:#047857; padding:5px 14px; border-radius:8px; border:1px solid #34d399;">
                                <div style="font-size:11.5px; color:#d1fae5; font-weight:800;">🎯 जीत का अंतर</div>
                                <div style="font-size:19px; font-weight:900; color:#ffffff;">+${zw.margin} मतों से विजयी</div>
                            </div>
                            <div>
                                <span style="color:#94a3b8; font-size:12.5px; font-weight:800;">🥈 पीछे (उपविजेता):</span>
                                <div style="font-size:17px; font-weight:800; color:#cbd5e1;">
                                    ${runnerUp?.name || '-'} <span style="font-size:12.5px; color:#94a3b8;">[${runnerUp?.party || '-'}]</span>
                                    <span style="font-size:16px; color:#ffffff; margin-left:8px;">${runnerUp ? Number(runnerUp.votes).toLocaleString('en-IN') : 0} मत</span>
                                </div>
                            </div>
                            <div style="font-size:12.5px; color:#94a3b8; text-align:right;">
                                <div>EVM: <b style="color:#38bdf8;">${totPolled.toLocaleString('en-IN')}</b></div>
                                <div>गिने: <b style="color:#4ade80;">${totCounted.toLocaleString('en-IN')} (${progress}%)</b></div>
                            </div>
                        </div>
                    ` : hasCounted ? `
                        <div class="tv-zp-stats-strip" style="background:#1e293b; border:1.5px solid #3b82f6; justify-content:space-between; padding:8px 16px;">
                            <div>
                                <span style="color:#fde047; font-size:12.5px; font-weight:800;"><i class="fas fa-crown"></i> आगे (लीड):</span>
                                <div style="font-size:19px; font-weight:900; color:#ffffff;">
                                    ${leader.name} <span style="font-size:13.5px; color:#fde047;">[${leader.party}]</span>
                                    <span style="font-size:18px; color:#fde047; margin-left:8px;">${Number(leader.votes).toLocaleString('en-IN')} मत</span>
                                </div>
                            </div>
                            <div style="text-align:center; background:${isZpHotSeat ? '#7f1d1d' : '#1e3a8a'}; padding:5px 14px; border-radius:8px; border:1px solid ${isZpHotSeat ? '#ef4444' : '#60a5fa'};">
                                <div style="font-size:11.5px; color:${isZpHotSeat ? '#fca5a5' : '#bfdbfe'}; font-weight:800;">📈 वर्तमान बढ़त (Margin)</div>
                                <div style="font-size:19px; font-weight:900; color:#ffffff;">+${zw.margin} मतों से आगे</div>
                            </div>
                            <div>
                                <span style="color:#94a3b8; font-size:12.5px; font-weight:800;">🥈 पीछे (द्वितीय):</span>
                                <div style="font-size:17px; font-weight:800; color:#cbd5e1;">
                                    ${runnerUp?.name || '-'} <span style="font-size:12.5px; color:#94a3b8;">[${runnerUp?.party || '-'}]</span>
                                    <span style="font-size:16px; color:#ffffff; margin-left:8px;">${runnerUp ? Number(runnerUp.votes).toLocaleString('en-IN') : 0} मत</span>
                                </div>
                            </div>
                            <div style="font-size:12.5px; color:#94a3b8; text-align:right;">
                                <div>EVM: <b style="color:#38bdf8;">${totPolled.toLocaleString('en-IN')}</b></div>
                                <div>गिने: <b style="color:#4ade80;">${totCounted.toLocaleString('en-IN')} (${progress}%)</b></div>
                            </div>
                        </div>
                    ` : `
                        <div class="tv-zp-stats-strip" style="justify-content:space-between; padding:8px 16px;">
                            <div>कुल EVM मत: <b style="color:#38bdf8; font-size:16px;">${totPolled.toLocaleString('en-IN')}</b></div>
                            <div>कुल मतदान केंद्र: <b style="color:#fde047; font-size:16px;">${zw.totalBooths} बूथ</b></div>
                            <div style="color:#9ca3af; font-size:14px;"><i class="fas fa-clock"></i> मतगणना प्रतीक्षारत</div>
                        </div>
                    `}

                    <!-- Candidate Rows with Winner / Leading / Trailing Badges -->
                    <div class="tv-zp-cand-box">
                        ${candList.map(c => {
                            const votes = Number(candVotes[c.key]) || 0;
                            const pct = totPolled > 0 ? ((votes / totPolled) * 100) : 0;
                            let pColor = '#c084fc';
                            if (c.party === 'BJP') pColor = '#fb923c';
                            else if (c.party === 'INC') pColor = '#38bdf8';

                            const isWinner = isDeclared && c.key === leader.key;
                            const isLeading = !isDeclared && hasCounted && c.key === leader.key;
                            const isTrailing = hasCounted && runnerUp && c.key === runnerUp.key;

                            let candTag = '';
                            if (isWinner) {
                                candTag = '<span style="background:#065f46; color:#6ee7b7; border:1px solid #10b981; padding:2px 8px; border-radius:5px; font-size:12px; font-weight:900; margin-left:8px;">🏆 विजेता (जीता)</span>';
                            } else if (isLeading) {
                                candTag = '<span style="background:#78350f; color:#fde68a; border:1px solid #f59e0b; padding:2px 8px; border-radius:5px; font-size:12px; font-weight:900; margin-left:8px;">👑 आगे (लीड)</span>';
                            } else if (isTrailing) {
                                candTag = '<span style="background:#334155; color:#cbd5e1; border:1px solid #475569; padding:2px 8px; border-radius:5px; font-size:12px; font-weight:800; margin-left:8px;">🥈 पीछे</span>';
                            }

                            return `
                                <div style="display:flex; flex-direction:column; gap:3px;">
                                    <div class="tv-zp-cand-row">
                                        <span class="tv-zp-cand-name">
                                            ${c.name}
                                            <span style="color:${pColor}; font-weight:800; font-size:14px;">[${c.party}]</span>
                                            ${candTag}
                                        </span>
                                        <span class="tv-zp-cand-vote">${votes.toLocaleString('en-IN')} <small style="color:#94a3b8; font-size:13.5px; font-weight:700;">(${pct.toFixed(1)}%)</small></span>
                                    </div>
                                    <div style="width:100%; height:7px; background:#1f2937; border-radius:4px; overflow:hidden;">
                                        <div style="width:${pct}%; height:100%; background:${isWinner ? '#10b981' : pColor}; border-radius:4px; transition:width 0.4s ease;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        grid.className = 'warroom-grid-zp';
        grid.removeAttribute('style');
        grid.innerHTML = html;
    }

    // Always update live bottom scrolling ticker & check for declarations
    renderWarRoomTicker();
    checkForNewDeclarations();
}

// Live Bottom Scrolling Ticker for War Room TV (Slowed & High Legibility)
function renderWarRoomTicker() {
    const track = document.getElementById('tickerTrack');
    if (!track || !countingData) return;

    const k = countingData.kpi || {};
    const psPt = k.psPartyTally || {};
    const zpPt = k.zpPartyTally || {};

    let items = [];

    // 1. Overall Round Progress
    items.push(`
        <span class="ticker-item">
            <span class="ticker-badge" style="background:#2563eb; color:#fff;">राउंड ${k.activeRound || 1}/14 जारी</span>
            <span>बूथ पूर्ण: <b>${k.totalCompletedBooths || 0}/${k.totalBooths || 152} (${k.progressPct || 0}%)</b> • कुल गिने गए मत: <b>${(k.totalCountedVotes || 0).toLocaleString('en-IN')}</b> / ${(k.totalPolledVotes || 71943).toLocaleString('en-IN')}</span>
        </span>
    `);

    // 2. PS 21 Tally
    items.push(`
        <span class="ticker-item">
            <span class="ticker-badge" style="background:#4f46e5; color:#fff;">पं.स. 21 वार्ड टैली</span>
            <span>भाजपा: <b style="color:#fb923c;">${(psPt.BJP?.won || 0) + (psPt.BJP?.lead || 0)}</b> (जीत ${psPt.BJP?.won || 0}) | कांग्रेस: <b style="color:#38bdf8;">${(psPt.INC?.won || 0) + (psPt.INC?.lead || 0)}</b> (जीत ${psPt.INC?.won || 0}) | अन्य: <b style="color:#c084fc;">${(psPt.IND?.won || 0) + (psPt.IND?.lead || 0)}</b> • घोषित: <b>${k.declaredWardsPS || 0}/21</b></span>
        </span>
    `);

    // 3. ZP 4 Tally
    items.push(`
        <span class="ticker-item">
            <span class="ticker-badge" style="background:#7c3aed; color:#fff;">जि.प. 4 वार्ड टैली</span>
            <span>भाजपा: <b style="color:#fb923c;">${(zpPt.BJP?.won || 0) + (zpPt.BJP?.lead || 0)}</b> | कांग्रेस: <b style="color:#38bdf8;">${(zpPt.INC?.won || 0) + (zpPt.INC?.lead || 0)}</b> • घोषित: <b>${k.declaredWardsZP || 0}/4</b></span>
        </span>
    `);

    // 4. Declared Wards
    for (let w = 1; w <= 21; w++) {
        const wm = countingData.ps_wards[`W-${w}`];
        if (wm && wm.status === 'DECLARED' && wm.leader) {
            items.push(`
                <span class="ticker-item">
                    <span class="ticker-badge won">🏆 परिणाम W-${w}</span>
                    <span><b>${wm.leader.name}</b> (${wm.leader.party}) विजयी घोषित! बढ़त: <b>+${wm.margin} मत</b> (प्राप्त मत: ${wm.leader.votes})</span>
                </span>
            `);
        }
    }

    // 5. In-Progress Leading Wards (PS) - With Hot Seat Highlights
    for (let w = 1; w <= 21; w++) {
        const wm = countingData.ps_wards[`W-${w}`];
        if (wm && wm.status === 'COUNTING' && wm.leader && wm.leader.votes > 0) {
            const isHot = wm.margin > 0 && wm.margin <= 100;
            items.push(`
                <span class="ticker-item">
                    <span class="ticker-badge ${isHot ? 'hot' : 'lead'}">
                        ${isHot ? '🔥 कड़ी टक्कर W-' + w : '⚡ W-' + w}
                    </span>
                    <span><b>${wm.leader.name}</b> (${wm.leader.party}) आगे • बढ़त: <b style="color:${isHot ? '#f87171' : '#4ade80'};">+${wm.margin} मत</b> (${wm.completedBooths}/${wm.totalBooths} बूथ)</span>
                </span>
            `);
        }
    }

    // 6. ZP Wards status
    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const zw = countingData.zp_wards[zKey];
        if (zw && zw.leader && zw.leader.votes > 0) {
            const isDec = zw.status === 'DECLARED';
            const isHot = !isDec && zw.margin > 0 && zw.margin <= 100;
            items.push(`
                <span class="ticker-item">
                    <span class="ticker-badge ${isDec ? 'won' : (isHot ? 'hot' : 'lead')}">
                        ${isHot ? '🔥 कड़ी टक्कर ZP-' + (zw.wardNo || zKey) : '🏛️ ZP-' + (zw.wardNo || zKey)}
                    </span>
                    <span><b>${zw.leader.name}</b> (${zw.leader.party}) ${isDec ? 'विजयी घोषित!' : 'आगे'} • बढ़त: <b style="color:${isHot ? '#f87171' : '#fde047'};">+${zw.margin} मत</b> (${zw.completedBooths}/${zw.totalBooths} बूथ)</span>
                </span>
            `);
        }
    });

    track.innerHTML = items.join(' • ');
}

// -------------------------------------------------------------
// AUDIO CHIME & DECLARATION ALERT SYSTEM (Web Audio API)
// -------------------------------------------------------------
let declaredWardsSeen = new Set();
let isSoundEnabled = true;
let audioCtx = null;
let isFirstCountingLoad = true;

function toggleWarRoomSound() {
    isSoundEnabled = !isSoundEnabled;
    const btn = document.getElementById('tvBtnSound');
    if (btn) {
        btn.style.background = isSoundEnabled ? '#334155' : '#1f2937';
        btn.style.color = isSoundEnabled ? '#fde047' : '#94a3b8';
        btn.innerHTML = `<i class="fas fa-${isSoundEnabled ? 'volume-high' : 'volume-xmark'}" id="tvSoundIcon"></i> साउंड: ${isSoundEnabled ? 'चालू' : 'बंद'}`;
    }
    if (isSoundEnabled && !audioCtx) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        } catch(e) {}
    }
    showToast(isSoundEnabled ? 'साउंड चालू' : 'साउंड बंद', isSoundEnabled ? 'परिणाम घोषणा पर चाइम बजेगा' : 'घोषणा चाइम म्यूट कर दिया गया है', 'info');
}

function playVictoryChime() {
    if (!isSoundEnabled) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        // Harmonic Fanfare Chord: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
        const notes = [
            { freq: 523.25, time: 0.00, dur: 0.5 },
            { freq: 659.25, time: 0.12, dur: 0.5 },
            { freq: 783.99, time: 0.24, dur: 0.7 },
            { freq: 1046.50, time: 0.38, dur: 1.2 }
        ];

        notes.forEach(n => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.freq, now + n.time);

            gain.gain.setValueAtTime(0.001, now + n.time);
            gain.gain.exponentialRampToValueAtTime(0.3, now + n.time + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(now + n.time);
            osc.stop(now + n.time + n.dur);
        });
    } catch(e) {
        console.warn('Audio chime warning:', e);
    }
}

function showDeclarationToast(title, winnerName, party, margin) {
    const old = document.getElementById('declarationToastEl');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = 'declarationToastEl';
    toast.className = 'declaration-toast';
    toast.innerHTML = `
        <div style="font-size:32px;">🏆</div>
        <div>
            <div style="font-size:12px; font-weight:800; color:#a7f3d0; text-transform:uppercase; letter-spacing:0.5px;">
                🎉 परिणाम घोषित — ${title}
            </div>
            <div style="font-size:20px; font-weight:900; color:#ffffff; margin-top:2px;">
                ${winnerName} <span style="background:rgba(255,255,255,0.2); padding:2px 7px; border-radius:5px; font-size:14px;">${party}</span>
            </div>
            <div style="font-size:13px; color:#d1fae5; margin-top:2px;">
                जीत की बढ़त: <b>+${margin} मत</b>
            </div>
        </div>
        <button onclick="this.parentElement.remove()" style="background:none; border:none; color:#ffffff; font-size:20px; cursor:pointer; opacity:0.8; margin-left:12px;">&times;</button>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast && toast.parentElement) toast.remove();
    }, 9000);
}

function checkForNewDeclarations() {
    if (!countingData) return;

    // Check PS Wards
    for (let w = 1; w <= 21; w++) {
        const key = `W-${w}`;
        const wm = countingData.ps_wards[key];
        if (wm && wm.status === 'DECLARED' && wm.leader) {
            if (!declaredWardsSeen.has(key)) {
                declaredWardsSeen.add(key);
                if (!isFirstCountingLoad) {
                    playVictoryChime();
                    showDeclarationToast(`पं.स. वार्ड W-${w}`, wm.leader.name, wm.leader.party, wm.margin);
                }
            }
        }
    }

    // Check ZP Wards
    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const zw = countingData.zp_wards[zKey];
        if (zw && zw.status === 'DECLARED' && zw.leader) {
            if (!declaredWardsSeen.has(zKey)) {
                declaredWardsSeen.add(zKey);
                if (!isFirstCountingLoad) {
                    playVictoryChime();
                    showDeclarationToast(`जिला परिषद वार्ड ${zw.wardNo || zKey}`, zw.leader.name, zw.leader.party, zw.margin);
                }
            }
        }
    });

    isFirstCountingLoad = false;
}

function toggleWarRoomFullscreen() {
    const el = document.getElementById('warRoomModal') || document.documentElement;
    if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
            el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
            el.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Toast helper
function showToast(title, msg, type = 'info', duration = 3000) {
    const box = document.getElementById('toastContainer');
    if (!box) return;

    const t = document.createElement('div');
    t.className = `toast-item toast-${type}`;
    t.innerHTML = `
        <div style="font-weight:800; font-size:13px; margin-bottom:2px;">${title}</div>
        <div style="font-size:12px; color:#334155;">${msg}</div>
    `;
    box.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, duration);
}
