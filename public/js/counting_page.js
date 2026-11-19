let activePBType = 'ps';
let activePBTableFilter = 'ps';
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
    initWarRoomTheme();
    if (window.location.search.includes('warroom=1')) {
        document.body.classList.add('warroom-active');
    }
    fetchCountingData().then(() => {
        if (window.location.search.includes('warroom=1')) {
            openWarRoom();
        }
    });
    initSSE();

    // TV Remote & Keyboard Fullscreen Shortcut (Enter / OK / 'F') & Theme ('T')
    document.addEventListener('keydown', (e) => {
        if (!isWarRoomOpen) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.key === 'f' || e.key === 'F' || e.keyCode === 13 || e.key === 'Enter') {
            toggleWarRoomFullscreen();
        } else if (e.key === 't' || e.key === 'T') {
            toggleWarRoomTheme();
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
                saveLocalCountingSnapshot(data);
                checkAndPromptLocalCountingRestore(data);
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
                saveLocalCountingSnapshot(data);
                checkAndPromptLocalCountingRestore(data);
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
    const headerRepBtn = document.getElementById('btnHeaderReports');
    if (headerRepBtn) headerRepBtn.classList.toggle('active', tab === 'official_reports');

    ['round_cards', 'ps_wards', 'zp_wards', 'master_matrix', 'manual_entry', 'postal_ballot', 'official_reports', 'bulletin'].forEach(t => {
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

    // -------------------------------------------------------------
    // 4. TAB 2: PANCHAYAT SAMITI (21 WARDS) DEDICATED STATS
    // -------------------------------------------------------------
    const elPsDecKpi = document.getElementById('psKpiDeclared');
    if (elPsDecKpi) elPsDecKpi.textContent = `${k.declaredWardsPS || 0} / 21`;

    const elPsCntKpi = document.getElementById('psKpiCounting');
    if (elPsCntKpi) elPsCntKpi.textContent = `${k.inProgressWardsPS || 0} / 21`;

    const elPsPndKpi = document.getElementById('psKpiPending');
    if (elPsPndKpi) elPsPndKpi.textContent = `${k.pendingWardsPS || 0} / 21`;

    const elPsPostKpi = document.getElementById('psKpiPostal');
    const psPostalVotes = k.postalKPI?.ps?.valid || 0;
    if (elPsPostKpi) elPsPostKpi.textContent = `${psPostalVotes.toLocaleString('en-IN')} मत`;

    const elPsTallyBadge = document.getElementById('psKpiTallyBadge');
    if (elPsTallyBadge) elPsTallyBadge.textContent = `${k.declaredWardsPS || 0} / 21 वार्ड घोषित`;

    const elPsKpiBjp = document.getElementById('psKpiBjp');
    const elPsKpiBjpSub = document.getElementById('psKpiBjpSub');
    if (elPsKpiBjp) elPsKpiBjp.textContent = psBjp;
    if (elPsKpiBjpSub) elPsKpiBjpSub.textContent = `जीत: ${psPt.BJP?.won || 0} | आगे: ${psPt.BJP?.lead || 0}`;

    const elPsKpiInc = document.getElementById('psKpiInc');
    const elPsKpiIncSub = document.getElementById('psKpiIncSub');
    if (elPsKpiInc) elPsKpiInc.textContent = psInc;
    if (elPsKpiIncSub) elPsKpiIncSub.textContent = `जीत: ${psPt.INC?.won || 0} | आगे: ${psPt.INC?.lead || 0}`;

    const elPsKpiInd = document.getElementById('psKpiInd');
    const elPsKpiIndSub = document.getElementById('psKpiIndSub');
    if (elPsKpiInd) elPsKpiInd.textContent = psInd;
    if (elPsKpiIndSub) elPsKpiIndSub.textContent = `जीत: ${psPt.IND?.won || 0} | आगे: ${psPt.IND?.lead || 0}`;

    // -------------------------------------------------------------
    // 5. TAB 3: ZILA PARISHAD (4 WARDS) DEDICATED STATS
    // -------------------------------------------------------------
    const elZpDecKpi = document.getElementById('zpKpiDeclared');
    if (elZpDecKpi) elZpDecKpi.textContent = `${k.declaredWardsZP || 0} / 4`;

    const zpWards = countingData.zp_wards || {};
    let zpCompletedBooths = 0;
    let zpTotalVotes = 0;
    Object.values(zpWards).forEach(zw => {
        zpCompletedBooths += (zw.completedBooths || 0);
        zpTotalVotes += (zw.totalCountedVotes || 0);
    });
    const zpProgressPct = k.totalBooths ? ((zpCompletedBooths / k.totalBooths) * 100).toFixed(1) : 0;

    const elZpBthsKpi = document.getElementById('zpKpiBooths');
    if (elZpBthsKpi) elZpBthsKpi.textContent = `${zpCompletedBooths} / 152`;

    const elZpProgSub = document.getElementById('zpKpiProgressSub');
    if (elZpProgSub) elZpProgSub.textContent = `${zpProgressPct}% बूथ गिने गए`;

    const elZpTotVotes = document.getElementById('zpKpiTotalCounted');
    if (elZpTotVotes) elZpTotVotes.textContent = `${zpTotalVotes.toLocaleString('en-IN')} मत`;

    const elZpTallyBadge = document.getElementById('zpKpiTallyBadge');
    if (elZpTallyBadge) elZpTallyBadge.textContent = `${k.declaredWardsZP || 0} / 4 वार्ड घोषित`;

    const elZpKpiBjp = document.getElementById('zpKpiBjp');
    const elZpKpiBjpSub = document.getElementById('zpKpiBjpSub');
    if (elZpKpiBjp) elZpKpiBjp.textContent = zpBjp;
    if (elZpKpiBjpSub) elZpKpiBjpSub.textContent = `जीत: ${zpPt.BJP?.won || 0} | आगे: ${zpPt.BJP?.lead || 0}`;

    const elZpKpiInc = document.getElementById('zpKpiInc');
    const elZpKpiIncSub = document.getElementById('zpKpiIncSub');
    if (elZpKpiInc) elZpKpiInc.textContent = zpInc;
    if (elZpKpiIncSub) elZpKpiIncSub.textContent = `जीत: ${zpPt.INC?.won || 0} | आगे: ${zpPt.INC?.lead || 0}`;

    const elZpKpiInd = document.getElementById('zpKpiInd');
    const elZpKpiIndSub = document.getElementById('zpKpiIndSub');
    if (elZpKpiInd) elZpKpiInd.textContent = zpInd;
    if (elZpKpiIndSub) elZpKpiIndSub.textContent = `जीत: ${zpPt.IND?.won || 0} | आगे: ${zpPt.IND?.lead || 0}`;

    // -------------------------------------------------------------
    // 6. TAB 4: MASTER MATRIX (15x14) DEDICATED STATS
    // -------------------------------------------------------------
    const elMatRound = document.getElementById('matrixKpiRound');
    const elMatRoundSub = document.getElementById('matrixKpiRoundSub');
    if (elMatRound) {
        if (k.isAllCompleted) {
            elMatRound.innerHTML = `<span style="color:#059669; font-weight:900;">14 / 14 पूर्ण</span>`;
            if (elMatRoundSub) elMatRoundSub.textContent = 'सभी 14 राउंड संपन्न';
        } else {
            elMatRound.textContent = `राउंड ${k.activeRound || 1} / 14`;
            if (elMatRoundSub) elMatRoundSub.textContent = `वर्तमान सक्रिय राउंड: ${k.activeRound || 1}`;
        }
    }

    const elMatBooths = document.getElementById('matrixKpiBooths');
    if (elMatBooths) elMatBooths.textContent = `${k.totalCompletedBooths || 0} / 152`;

    const elMatPct = document.getElementById('matrixKpiPct');
    if (elMatPct) elMatPct.textContent = `${k.progressPct || 0}% पूर्ण`;

    // 17C Audit Match Analysis for Matrix
    const allSlots = Object.values(countingData.slots || {});
    let matchOkCount = 0;
    let mismatchCount = 0;
    let pendingSlotsCount = 0;
    allSlots.forEach(s => {
        const psTot = Number(s.votes?.total) || 0;
        const zpTot = Number(s.zp_votes?.total) || 0;
        const polled = Number(s.polled_votes) || 0;
        if (psTot > 0 && zpTot > 0) {
            if (psTot === polled && zpTot === polled) matchOkCount++;
            else mismatchCount++;
        } else {
            pendingSlotsCount++;
        }
    });

    const elMatMatch = document.getElementById('matrixKpiMatch');
    const elMatMatchSub = document.getElementById('matrixKpiMatchSub');
    if (elMatMatch) {
        if (mismatchCount > 0) {
            elMatMatch.innerHTML = `<span style="color:#dc2626;">${mismatchCount} विसंगति!</span>`;
            if (elMatMatchSub) elMatMatchSub.textContent = `${matchOkCount} मिलान पूर्ण • ${pendingSlotsCount} शेष`;
        } else if (matchOkCount > 0) {
            elMatMatch.innerHTML = `<span style="color:#16a34a;">${matchOkCount} मिलान पूर्ण</span>`;
            if (elMatMatchSub) elMatMatchSub.textContent = `100% सटीक • ${pendingSlotsCount} शेष`;
        } else {
            elMatMatch.textContent = `152 प्रतीक्षारत`;
            if (elMatMatchSub) elMatMatchSub.textContent = `EVM 17C ऑडिट सत्यापन`;
        }
    }

    const elMatVotes = document.getElementById('matrixKpiVotes');
    if (elMatVotes) elMatVotes.textContent = `${(k.totalCountedVotes || 0).toLocaleString('en-IN')} मत`;
}

// Render Active Sub-View
function renderActiveTab() {
    if (!countingData) return;
    if (activeSubtab === 'round_cards') renderRoundCardsView();
    else if (activeSubtab === 'ps_wards') renderPSWardsView();
    else if (activeSubtab === 'zp_wards') renderZPWardsView();
    else if (activeSubtab === 'master_matrix') renderMasterMatrixView();
    else if (activeSubtab === 'manual_entry') renderManualEntryView();
    else if (activeSubtab === 'postal_ballot') renderPostalBallotView();
    else if (activeSubtab === 'official_reports') renderReportsTab();
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

    // Update Tab 5 Dedicated Data Entry KPI Banner
    const elEntryRdName = document.getElementById('entryKpiRoundName');
    if (elEntryRdName) {
        elEntryRdName.textContent = (entryFilterRound === 'ALL') ? 'समस्त 152 बूथ' : `राउंड ${entryFilterRound}`;
    }
    const elEntryTbls = document.getElementById('entryKpiTotalTables');
    if (elEntryTbls) elEntryTbls.textContent = `${sumTables} टेबलें दर्शित`;

    const elEntryComp = document.getElementById('entryKpiCompleted');
    if (elEntryComp) elEntryComp.textContent = `${sumCompleted} टेबल`;

    const elEntryPend = document.getElementById('entryKpiPending');
    if (elEntryPend) elEntryPend.textContent = `${sumPending} टेबल`;

    const elEntryPolKpi = document.getElementById('entryKpiPolled');
    if (elEntryPolKpi) elEntryPolKpi.textContent = `${sumPolled.toLocaleString('en-IN')} मत`;

    const elEntryCntKpi = document.getElementById('entryKpiCounted');
    if (elEntryCntKpi) elEntryCntKpi.textContent = `${sumCounted.toLocaleString('en-IN')} मत`;

    const elEntryMatch = document.getElementById('entryKpiMatchStatus');
    if (elEntryMatch) {
        if (sumCounted > 0) {
            if (sumCounted === sumPolled) {
                elEntryMatch.innerHTML = '<span style="color:#16a34a; font-weight:800;">✓ 17C शत-प्रतिशत मिलान</span>';
            } else {
                const diff = sumCounted - sumPolled;
                elEntryMatch.innerHTML = `<span style="color:#dc2626; font-weight:800;">⚠️ अंतर: ${diff > 0 ? '+' + diff : diff} मत</span>`;
            }
        } else {
            elEntryMatch.textContent = '17C मिलान जांच';
        }
    }

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
    msg += `• अन्य/निर्दलीय: ${(pt.IND?.won || 0) + (pt.IND?.lead || 0)} (जीत: ${pt.IND?.won || 0} | आगे: ${pt.IND?.lead || 0})\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🏛️ *जिला परिषद सदस्य (सुमेरपुर क्षेत्र - 4 वार्ड) रुझान:*\n`;

    const zpPt = k.zpPartyTally || {};
    const zpWards = countingData.zp_wards || {};
    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const zw = zpWards[zKey];
        if (zw && zw.completedBooths > 0 && zw.leader && zw.leader.votes > 0) {
            const statusEmoji = zw.status === 'DECLARED' ? '✅ [घोषित]' : '⏳ [आगे]';
            msg += `• *${zKey}:* ${zw.leader.name} (${zw.leader.party}) +${zw.margin} मतों से ${statusEmoji} (${zw.completedBooths}/${zw.totalBooths} बूथ)\n`;
        } else {
            msg += `• *${zKey}:* मतगणना जारी / प्रतीक्षारत (${zw?.completedBooths || 0}/${zw?.totalBooths || 0} बूथ)\n`;
        }
    });

    msg += `\n📊 *जि.प. दलगत स्थिति:* BJP: ${(zpPt.BJP?.won || 0) + (zpPt.BJP?.lead || 0)} (जीत: ${zpPt.BJP?.won || 0}) | INC: ${(zpPt.INC?.won || 0) + (zpPt.INC?.lead || 0)} (जीत: ${zpPt.INC?.won || 0})\n`;
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


// =============================================================
// TAB-SPECIFIC EXCEL EXPORT FUNCTIONS
// =============================================================

// 1. Panchayat Samiti 21 Wards Results (EVM + Postal Ballot Combined)
function exportPSResultsExcel() {
    if (!window.XLSX || !countingData) {
        alert('Excel library not loaded.');
        return;
    }
    const wards = countingData.ps_wards || {};
    const rows = [
        ['सुमेरपुर पंचायती राज आम चुनाव 2026 - आधिकारिक मतगणना परिणाम'],
        ['पंचायत समिति 21 वार्ड परिणाम तालिका (प्ररूप-19 अनुसार)'],
        ['[नोट: कुल गिने मत = EVM मत + डाक मतपत्र मत (विजेता का फैसला कुल विधिमान्य मतों पर)]'],
        [''],
        [
            'वार्ड क्र.',
            'बूथ प्रगति',
            'कुल मतदाता',
            'EVM मत (17C)',
            'डाक मत (PB)',
            'कुल गिने मत (EVM + डाक)',
            'भाजपा मत',
            'कांग्रेस मत',
            'निर्दलीय/अन्य मत',
            'नोटा (NOTA)',
            'अग्रणी / विजयी प्रत्याशी',
            'पार्टी',
            'बढ़त / मार्जिन',
            'परिणाम स्थिति',
            'डाक मत प्राप्त',
            'डाक मत निरस्त'
        ]
    ];

    let sumElectors = 0, sumPolled = 0, sumCounted = 0, sumPB = 0;
    let sumBjp = 0, sumInc = 0, sumInd = 0, sumNota = 0;

    for (let w = 1; w <= 21; w++) {
        const wKey = `W-${w}`;
        const wm = wards[wKey] || {};
        const candList = wm.candidates || [];
        const candVotes = wm.candVotes || {};
        const pb = wm.postalBallots || {};

        const c1 = candList[0] ? (candVotes[candList[0].key] || 0) : 0;
        const c2 = candList[1] ? (candVotes[candList[1].key] || 0) : 0;
        const c3 = candList[2] ? (candVotes[candList[2].key] || 0) : 0;
        const nota = candVotes.nota || 0;
        const pbVal = wm.postalCountedVotes || 0;
        const tot = wm.totalCountedVotes || 0;
        const polled = wm.totalPolledVotes || 0;
        const electors = wm.totalElectors || 0;

        sumElectors += electors;
        sumPolled += polled;
        sumCounted += tot;
        sumPB += pbVal;
        
        candList.forEach(c => {
            const v = candVotes[c.key] || 0;
            if (c.party === 'BJP') sumBjp += v;
            else if (c.party === 'INC') sumInc += v;
            else sumInd += v;
        });
        sumNota += nota;

        rows.push([
            wKey,
            `${wm.completedBooths || 0} / ${wm.totalBooths || 0}`,
            electors,
            polled,
            pbVal,
            tot,
            c1,
            c2,
            c3,
            nota,
            wm.leader?.name || '-',
            wm.leader?.party || '-',
            wm.margin ? `+${wm.margin}` : '0',
            wm.status === 'DECLARED' ? 'विजयी घोषित' : (wm.status === 'COUNTING' ? 'मतगणना जारी' : 'प्रतीक्षारत'),
            pb.total_received || 0,
            pb.rejected || 0
        ]);
    }

    // Summary Total Row
    rows.push([
        'कुल योग (Total)',
        '152 / 152',
        sumElectors,
        sumPolled,
        sumPB,
        sumCounted,
        sumBjp,
        sumInc,
        sumInd,
        sumNota,
        '-',
        '-',
        '-',
        '-',
        '-',
        '-'
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PS_21_Wards_Results');
    XLSX.writeFile(wb, `Sumerpur_PS_21_Wards_Results_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// 2. Zila Parishad 4 Wards Results (EVM + Postal Ballot Combined)
function exportZPResultsExcel() {
    if (!window.XLSX || !countingData) {
        alert('Excel library not loaded.');
        return;
    }
    const zpWards = countingData.zp_wards || {};
    const rows = [
        ['सुमेरपुर पंचायती राज आम चुनाव 2026 - आधिकारिक मतगणना परिणाम'],
        ['जिला परिषद सदस्य (सुमेरपुर क्षेत्र - 4 वार्ड) परिणाम तालिका (प्ररूप-19 अनुसार)'],
        ['[नोट: कुल गिने मत = EVM मत + डाक मतपत्र मत (विजेता का फैसला कुल विधिमान्य मतों पर)]'],
        [''],
        [
            'जिला परिषद वार्ड',
            'बूथ प्रगति',
            'EVM मत (17C)',
            'डाक मत (PB)',
            'कुल गिने मत (EVM + डाक)',
            'प्रत्याशी-वार प्राप्त मत',
            'नोटा (NOTA)',
            'अग्रणी / विजयी प्रत्याशी',
            'पार्टी',
            'बढ़त / मार्जिन',
            'परिणाम स्थिति',
            'डाक मत प्राप्त',
            'डाक मत निरस्त'
        ]
    ];

    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const zw = zpWards[zKey] || {};
        const cands = zw.candidates || [];
        const candVotes = zw.candVotes || {};
        const pb = zw.postalBallots || {};
        const candStr = cands.map(c => `${c.name} [${c.party}]: ${candVotes[c.key] || 0}`).join(' | ');

        rows.push([
            zKey,
            `${zw.completedBooths || 0} / ${zw.totalBooths || 0}`,
            zw.totalPolledVotes || 0,
            zw.postalCountedVotes || 0,
            zw.totalCountedVotes || 0,
            candStr,
            candVotes.nota || 0,
            zw.leader?.name || '-',
            zw.leader?.party || '-',
            zw.margin ? `+${zw.margin}` : '0',
            zw.status === 'DECLARED' ? 'विजयी घोषित' : (zw.status === 'COUNTING' ? 'मतगणना जारी' : 'प्रतीक्षारत'),
            pb.total_received || 0,
            pb.rejected || 0
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ZP_4_Wards_Results');
    XLSX.writeFile(wb, `Sumerpur_ZP_4_Wards_Results_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// 3. 15 Tables x 14 Rounds Master Matrix (Pure EVM Booth Counts Only)
function exportMatrixExcel() {
    if (!window.XLSX || !countingData) {
        alert('Excel library not loaded.');
        return;
    }
    const slots = countingData.slots || {};

    const rows = [
        ['सुमेरपुर पंचायती राज चुनाव 2026 - 15 टेबल x 14 राउंड EVM मतगणना मास्टर मैट्रिक्स'],
        ['[केवल 152 मतदान केंद्र EVM गणना डेटा (Form 17C Control Unit मत)]'],
        [''],
        ['टेबल क्र.', 'राउंड 1', 'राउंड 2', 'राउंड 3', 'राउंड 4', 'राउंड 5', 'राउंड 6', 'राउंड 7', 'राउंड 8', 'राउंड 9', 'राउंड 10', 'राउंड 11', 'राउंड 12', 'राउंड 13', 'राउंड 14', 'टेबल कुल EVM मत']
    ];

    let roundSums = Array(15).fill(0);

    for (let t = 1; t <= 15; t++) {
        const row = [`टेबल ${t}`];
        let tableTotal = 0;
        for (let r = 1; r <= 14; r++) {
            const slot = Object.values(slots).find(s => Number(s.round) === r && Number(s.table) === t);
            if (slot) {
                const votes = Number(slot.votes?.total) || 0;
                tableTotal += votes;
                roundSums[r] += votes;
                row.push(votes > 0 ? `${votes} (बूथ ${slot.booth_no})` : `0 (बूथ ${slot.booth_no})`);
            } else {
                row.push('-');
            }
        }
        row.push(tableTotal);
        rows.push(row);
    }

    // Bottom Summary Row
    const totalRow = ['राउंड कुल EVM मत'];
    let grandEVM = 0;
    for (let r = 1; r <= 14; r++) {
        totalRow.push(roundSums[r]);
        grandEVM += roundSums[r];
    }
    totalRow.push(grandEVM);
    rows.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'EVM_Master_Matrix');
    XLSX.writeFile(wb, `Sumerpur_EVM_Matrix_15T_14R_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// 4. 152 Booths Detailed EVM Form 17C Counts (Pure EVM Only)
function exportEVMBoothsExcel() {
    if (!window.XLSX || !countingData) {
        window.location.href = '/api/counting/export-booths-csv';
        return;
    }
    const slots = countingData.slots || {};
    const rows = [
        ['सुमेरपुर पंचायती राज चुनाव 2026 - 152 मतदान केंद्र EVM मतगणना विस्तृत विवरण (Form 17C)'],
        ['[केवल 152 बूथ EVM मत - डाक मतपत्र सम्मिलित नहीं]'],
        [''],
        ['क्र.सं.', 'राउंड', 'टेबल', 'बूथ नं.', 'CU ID', 'ग्राम पंचायत', 'भवन / स्थान', 'पं.स. वार्ड', 'जि.प. वार्ड', 'EVM मत (17C)', 'पं.स. दर्ज मत', 'जि.प. दर्ज मत', 'स्थिति', 'टिप्पणी']
    ];

    const sortedSlots = Object.values(slots).sort((a, b) => Number(a.s_no) - Number(b.s_no));
    sortedSlots.forEach(s => {
        const v = s.votes || {};
        const zv = s.zp_votes || {};
        rows.push([
            s.s_no,
            s.round,
            s.table,
            s.booth_no,
            s.cu_id || '',
            s.gp_name || '',
            s.location || '',
            s.ps_ward || '',
            s.zp_ward || '',
            s.polled_votes || 0,
            v.total || 0,
            zv.total || 0,
            s.status === 'COMPLETED' ? 'पूर्ण' : 'प्रतीक्षारत',
            s.remark || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'EVM_152_Booths');
    XLSX.writeFile(wb, `Sumerpur_EVM_152_Booths_${new Date().toISOString().slice(0, 10)}.xlsx`);
}


// 0. Comprehensive All-in-One Master Results Excel (PS 21 Wards + ZP 4 Wards + 14 Rounds + Postal Ballots)
function exportCompleteMasterResultsExcel() {
    if (!window.XLSX || !countingData) {
        window.location.href = '/api/counting/export-csv';
        return;
    }

    const wb = XLSX.utils.book_new();
    const dateStr = new Date().toISOString().slice(0, 10);

    // Sheet 1: पं.स. 21 वार्ड परिणाम (Form 19)
    const psRows = [
        ['सुमेरपुर पंचायती राज आम चुनाव 2026 - आधिकारिक मतगणना परिणाम'],
        ['पंचायत समिति सदस्य (21 वार्ड) संपूर्ण परिणाम तालिका (प्ररूप-19 अनुसार)'],
        ['[नोट: कुल गिने मत = 152 बूथ EVM मत + डाक मतपत्र मत (विजेता का निर्धारण कुल विधिमान्य मतों पर)]'],
        [''],
        [
            'वार्ड क्र.', 'बूथ प्रगति', 'कुल मतदाता', 'EVM मत (17C)', 'डाक मत (PB)', 'कुल गिने मत (EVM+डाक)',
            'BJP प्रत्याशी व मत', 'INC प्रत्याशी व मत', 'अन्य / निर्दलीय मत', 'नोटा (NOTA)',
            'विजयी / अग्रणी प्रत्याशी', 'पार्टी', 'बढ़त / मार्जिन', 'परिणाम स्थिति',
            'डाक मत प्राप्त', 'डाक मत निरस्त'
        ]
    ];

    let sumElectors = 0, sumPolled = 0, sumCounted = 0, sumPB = 0;
    let sumBjp = 0, sumInc = 0, sumInd = 0, sumNota = 0;
    const psWards = countingData.ps_wards || {};

    for (let w = 1; w <= 21; w++) {
        const wKey = `W-${w}`;
        const wm = psWards[wKey] || {};
        const candList = wm.candidates || [];
        const candVotes = wm.candVotes || {};
        const pb = wm.postalBallots || {};

        let bjpStr = '-', incStr = '-', indStr = '-';
        let bjpVotes = 0, incVotes = 0, indVotes = 0;
        candList.forEach(c => {
            const v = candVotes[c.key] || 0;
            if (c.party === 'BJP') { bjpStr = `${c.name} (${v})`; bjpVotes += v; sumBjp += v; }
            else if (c.party === 'INC') { incStr = `${c.name} (${v})`; incVotes += v; sumInc += v; }
            else { indStr = `${c.name} (${v})`; indVotes += v; sumInd += v; }
        });

        const nota = candVotes.nota || 0;
        const pbVal = wm.postalCountedVotes || 0;
        const tot = wm.totalCountedVotes || 0;
        const polled = wm.totalPolledVotes || 0;
        const electors = wm.totalElectors || 0;

        sumElectors += electors;
        sumPolled += polled;
        sumCounted += tot;
        sumPB += pbVal;
        sumNota += nota;

        psRows.push([
            wKey,
            `${wm.completedBooths || 0} / ${wm.totalBooths || 0}`,
            electors,
            polled,
            pbVal,
            tot,
            bjpStr,
            incStr,
            indStr,
            nota,
            wm.leader?.name || '-',
            wm.leader?.party || '-',
            wm.margin ? `+${wm.margin}` : '0',
            wm.status === 'DECLARED' ? 'विजयी घोषित' : (wm.status === 'COUNTING' ? 'मतगणना जारी' : 'प्रतीक्षारत'),
            pb.total_received || 0,
            pb.rejected || 0
        ]);
    }

    psRows.push([
        'सुमेरपुर पं.स. महायोग',
        '152 / 152',
        sumElectors,
        sumPolled,
        sumPB,
        sumCounted,
        `BJP कुल: ${sumBjp}`,
        `INC कुल: ${sumInc}`,
        `IND कुल: ${sumInd}`,
        sumNota,
        '-',
        '-',
        '-',
        '-',
        '-',
        '-'
    ]);

    const wsPS = XLSX.utils.aoa_to_sheet(psRows);
    XLSX.utils.book_append_sheet(wb, wsPS, 'पं.स. 21 वार्ड परिणाम');

    // Sheet 2: जि.प. 4 वार्ड परिणाम (Form 19)
    const zpRows = [
        ['सुमेरपुर पंचायती राज आम चुनाव 2026 - आधिकारिक मतगणना परिणाम'],
        ['जिला परिषद सदस्य (सुमेरपुर क्षेत्र - 4 वार्ड) परिणाम तालिका (प्ररूप-19 अनुसार)'],
        ['[नोट: कुल गिने मत = EVM मत + डाक मतपत्र मत (विजेता का फैसला कुल विधिमान्य मतों पर)]'],
        [''],
        [
            'जिला परिषद वार्ड', 'बूथ प्रगति', 'EVM मत (17C)', 'डाक मत (PB)', 'कुल गिने मत (EVM + डाक)',
            'प्रत्याशी-वार प्राप्त मत', 'नोटा (NOTA)', 'अग्रणी / विजयी प्रत्याशी', 'पार्टी', 'बढ़त / मार्जिन',
            'परिणाम स्थिति', 'डाक मत प्राप्त', 'डाक मत निरस्त'
        ]
    ];

    const zpWards = countingData.zp_wards || {};
    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const zw = zpWards[zKey] || {};
        const cands = zw.candidates || [];
        const candVotes = zw.candVotes || {};
        const pb = zw.postalBallots || {};
        const candStr = cands.map(c => `${c.name} [${c.party}]: ${candVotes[c.key] || 0}`).join(' | ');

        zpRows.push([
            zKey,
            `${zw.completedBooths || 0} / ${zw.totalBooths || 0}`,
            zw.totalPolledVotes || 0,
            zw.postalCountedVotes || 0,
            zw.totalCountedVotes || 0,
            candStr,
            candVotes.nota || 0,
            zw.leader?.name || '-',
            zw.leader?.party || '-',
            zw.margin ? `+${zw.margin}` : '0',
            zw.status === 'DECLARED' ? 'विजयी घोषित' : (zw.status === 'COUNTING' ? 'मतगणना जारी' : 'प्रतीक्षारत'),
            pb.total_received || 0,
            pb.rejected || 0
        ]);
    });

    const wsZP = XLSX.utils.aoa_to_sheet(zpRows);
    XLSX.utils.book_append_sheet(wb, wsZP, 'जि.प. 4 वार्ड परिणाम');

    // Sheet 3: 14 राउंड सारांश
    const roundRows = [
        ['सुमेरपुर पंचायती राज चुनाव 2026 - 14 राउंड मतगणना प्रगति सारांश'],
        ['[15 टेबल व्यवस्था - कुल 152 मतदान केंद्र]'],
        [''],
        ['राउंड क्र.', 'कुल टेबल/बूथ', 'पूर्ण बूथ', 'EVM डाले गए मत (17C)', 'गिने गए मत (EVM)', 'प्रगति प्रतिशत', 'स्थिति']
    ];

    const rounds = countingData.rounds || {};
    for (let r = 1; r <= 14; r++) {
        const rd = rounds[r] || {};
        const pct = rd.totalPolledVotes > 0 ? ((rd.totalVotes / rd.totalPolledVotes) * 100).toFixed(1) + '%' : '0%';
        roundRows.push([
            `राउंड ${r}`,
            rd.totalBoothsInRound || 0,
            rd.completedBoothsInRound || 0,
            rd.totalPolledVotes || 0,
            rd.totalVotes || 0,
            pct,
            rd.status === 'COMPLETED' ? 'पूर्ण' : (rd.status === 'COUNTING' ? 'जारी' : 'प्रतीक्षारत')
        ]);
    }

    const wsRounds = XLSX.utils.aoa_to_sheet(roundRows);
    XLSX.utils.book_append_sheet(wb, wsRounds, '14 राउंड सारांश');

    // Sheet 4: डाक मतपत्र लेखा
    const pbRows = [
        ['सुमेरपुर पंचायती राज चुनाव 2026 - डाक मतपत्र (Postal Ballot) सम्पूर्ण लेखा'],
        [''],
        ['चुनाव प्रकार', 'वार्ड क्र.', 'प्रत्याशी-वार मत', 'नोटा (NOTA)', 'निरस्त मत (Rejected)', 'कुल विधिमान्य मत', 'कुल प्राप्त डाक मत', 'स्थिति']
    ];

    for (let w = 1; w <= 21; w++) {
        const wKey = `W-${w}`;
        const wm = countingData.ps_wards?.[wKey] || {};
        const cands = wm.candidates || [];
        const pb = wm.postalBallots || {};
        const candStr = cands.map(c => `${c.name} (${c.party}): ${pb[c.key] || 0}`).join(', ');
        pbRows.push([
            'पंचायत समिति',
            wKey,
            candStr,
            pb.nota || 0,
            pb.rejected || 0,
            pb.total_valid || 0,
            pb.total_received || 0,
            (pb.total_received || 0) > 0 ? 'दर्ज' : 'प्रतीक्षारत'
        ]);
    }

    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const zw = countingData.zp_wards?.[zKey] || {};
        const cands = zw.candidates || [];
        const pb = zw.postalBallots || {};
        const candStr = cands.map(c => `${c.name} (${c.party}): ${pb[c.key] || 0}`).join(', ');
        pbRows.push([
            'जिला परिषद',
            zKey,
            candStr,
            pb.nota || 0,
            pb.rejected || 0,
            pb.total_valid || 0,
            pb.total_received || 0,
            (pb.total_received || 0) > 0 ? 'दर्ज' : 'प्रतीक्षारत'
        ]);
    });

    const wsPB = XLSX.utils.aoa_to_sheet(pbRows);
    XLSX.utils.book_append_sheet(wb, wsPB, 'डाक मतपत्र लेखा');

    XLSX.writeFile(wb, `Sumerpur_Complete_Counting_Results_PS_ZP_${dateStr}.xlsx`);
}

// Smart General Export: Dispatches based on active tab
function exportExcel() {
    if (activeSubtab === 'ps_wards') {
        exportPSResultsExcel();
    } else if (activeSubtab === 'zp_wards') {
        exportZPResultsExcel();
    } else if (activeSubtab === 'master_matrix') {
        exportMatrixExcel();
    } else if (activeSubtab === 'postal_ballot') {
        exportPostalBallotsExcel();
    } else if (activeSubtab === 'evm_booths') {
        exportEVMBoothsExcel();
    } else {
        exportCompleteMasterResultsExcel();
    }
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
    const pbVotes = wm.postalCountedVotes || 0;
    document.getElementById('wbModalSubtitle').textContent = `कुल बूथ: ${wm.totalBooths} | पूर्ण: ${wm.completedBooths}/${wm.totalBooths} | EVM मत: ${(wm.totalPolledVotes || 0).toLocaleString('en-IN')} | कुल गिने मत: ${(wm.totalCountedVotes || 0).toLocaleString('en-IN')} (EVM: ${wm.evmCountedVotes || 0} + डाक: ${pbVotes})${leadText}`;

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

// War Room Theme Switcher (Dark / Light)
let warRoomTheme = localStorage.getItem('tv_warroom_theme') || 'dark';

function initWarRoomTheme() {
    applyWarRoomTheme(warRoomTheme);
}

function applyWarRoomTheme(theme) {
    warRoomTheme = theme;
    try { localStorage.setItem('tv_warroom_theme', theme); } catch (e) {}

    const isLight = theme === 'light';
    const modal = document.getElementById('warRoomModal');

    if (isLight) {
        document.body.classList.add('tv-theme-light');
        if (modal) modal.classList.add('tv-theme-light');
    } else {
        document.body.classList.remove('tv-theme-light');
        if (modal) modal.classList.remove('tv-theme-light');
    }

    // Direct Header Button
    const icon = document.getElementById('tvThemeIcon');
    const label = document.getElementById('tvThemeLabel');
    if (icon) {
        icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
        icon.style.color = isLight ? '#4f46e5' : '#fde047';
    }
    if (label) {
        label.textContent = isLight ? 'डार्क' : 'लाइट';
    }

    // Tools Dropdown Menu Item
    const menuLabel = document.getElementById('tvMenuThemeLabel');
    const menuIcon = document.getElementById('tvMenuThemeIcon');
    if (menuLabel) {
        menuLabel.textContent = isLight ? 'थीम: डार्क मोड में बदलें' : 'थीम: लाइट मोड में बदलें';
    }
    if (menuIcon) {
        menuIcon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
        menuIcon.style.color = isLight ? '#4f46e5' : '#fde047';
    }
}

function toggleWarRoomTheme() {
    const next = warRoomTheme === 'light' ? 'dark' : 'light';
    applyWarRoomTheme(next);
    showToast('डिस्प्ले थीम', next === 'light' ? '☀️ लाइट थीम (दिन का व्यू) चालू' : '🌙 डार्क थीम (ब्लैक व्यू) चालू', 'info', 2000);
}

function openWarRoom() {
    isWarRoomOpen = true;
    initWarRoomTheme();
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
        } else if (warRoomView === 'zp_wards') {
            // High-Impact, Enlarged ZP 4 Wards Tally Header for ZP Tab
            dualEl.innerHTML = `
                <div class="tv-zp-hero-bar">
                    <div class="tp-header-tag zp">
                        <i class="fas fa-building-columns" style="color:#c084fc; font-size:16px;"></i>
                        <span class="tp-title-text">जि.प. 4 वार्ड</span>
                        <span class="tp-majority-pill zp">बहुमत: 3</span>
                    </div>
                    <div class="tp-scores-cluster">
                        <!-- BJP Hero Score -->
                        <div class="tp-hero-party bjp" title="भारतीय जनता पार्टी">
                            <span class="tp-pname">भाजपा</span>
                            <span class="tp-pscore">${zpBjp}</span>
                            <span class="tp-pbreakdown">(${zpPt.BJP?.won || 0} जीते ${zpPt.BJP?.lead ? `• ${zpPt.BJP?.lead} आगे` : ''})</span>
                        </div>
                        <div class="tp-hero-vs">VS</div>
                        <!-- INC Hero Score -->
                        <div class="tp-hero-party inc" title="भारतीय राष्ट्रीय कांग्रेस">
                            <span class="tp-pname">कांग्रेस</span>
                            <span class="tp-pscore">${zpInc}</span>
                            <span class="tp-pbreakdown">(${zpPt.INC?.won || 0} जीते ${zpPt.INC?.lead ? `• ${zpPt.INC?.lead} आगे` : ''})</span>
                        </div>
                        <!-- IND Hero Score -->
                        <div class="tp-hero-party ind" title="निर्दलीय व अन्य">
                            <span class="tp-pname">अन्य</span>
                            <span class="tp-pscore">${zpInd}</span>
                            <span class="tp-pbreakdown">(${zpPt.IND?.won || 0} जीते)</span>
                        </div>
                    </div>
                    <div class="tp-progress-tag">
                        <span class="tp-dec-badge zp"><i class="fas fa-circle-check"></i> घोषित: <b>${k.declaredWardsZP || 0}/4</b></span>
                    </div>
                </div>
            `;
        } else {
            // High-Impact Dual Scoreboard for Round Tables View
            dualEl.innerHTML = `
                <div class="tv-round-hero-bar">
                    <!-- PS 21 Score Card -->
                    <div class="tv-round-score-pill ps">
                        <span class="tr-label"><i class="fas fa-landmark" style="color:#60a5fa;"></i> पं.स. (21):</span>
                        <span class="tr-party bjp"><small>भाजपा</small> <b>${psBjp}</b></span>
                        <span class="tr-vs">VS</span>
                        <span class="tr-party inc"><small>कांग्रेस</small> <b>${psInc}</b></span>
                        <span class="tr-party ind"><small>अन्य</small> <b>${psInd}</b></span>
                        <span class="tr-declared">(${k.declaredWardsPS || 0}/21 घोषित)</span>
                    </div>
                    <div class="tv-round-divider"></div>
                    <!-- ZP 4 Score Card -->
                    <div class="tv-round-score-pill zp">
                        <span class="tr-label"><i class="fas fa-building-columns" style="color:#c084fc;"></i> जि.प. (4):</span>
                        <span class="tr-party bjp"><small>भाजपा</small> <b>${zpBjp}</b></span>
                        <span class="tr-vs">VS</span>
                        <span class="tr-party inc"><small>कांग्रेस</small> <b>${zpInc}</b></span>
                        <span class="tr-party ind"><small>अन्य</small> <b>${zpInd}</b></span>
                        <span class="tr-declared">(${k.declaredWardsZP || 0}/4 घोषित)</span>
                    </div>
                </div>
            `;
        }
    }

    const roundNav = document.getElementById('warRoomRoundNav');
    const grid = document.getElementById('warRoomTilesGrid');
    if (!grid) return;

    // VIEW 1: ROUND-WISE TABLES (5 columns x 3 rows = 15 tables Clean Zero-Scroll TV Fit)
    if (warRoomView === 'round_tables') {
        if (roundNav) {
            roundNav.style.display = 'flex';
            let navHtml = '<span class="tv-round-nav-label"><i class="fas fa-layer-group"></i> राउंड:</span>';
            for (let r = 1; r <= 14; r++) {
                const active = (warRoomSelectedRound === r) ? 'active' : '';
                navHtml += `<button class="tv-round-pill ${active}" onclick="setWarRoomRound(${r})">रा-${r}</button>`;
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
            const countedProgress = polled > 0 ? Math.min(100, Math.round((psTot / polled) * 100)) : 0;

            html += `
                <div class="tv-table-tile ${isDone ? 'completed' : (psTot > 0 ? 'counting' : '')}">
                    <!-- 1. Header: Table Badge + CU + Status -->
                    <div class="tv-tt-head">
                        <span class="tv-tt-table-badge"><i class="fas fa-table"></i> टेबल ${s.table} • बूथ ${s.booth_no}</span>
                        <span class="tv-tt-cu-badge">CU: ${s.cu_id}</span>
                        <span class="tv-tt-status-pill ${isDone ? 'completed' : (psTot > 0 ? 'counting' : 'pending')}">
                            ${isDone ? '🟢 पूर्ण' : (psTot > 0 ? '🟡 जारी' : '⚪ शेष')}
                        </span>
                    </div>

                    <!-- 2. GP & Location -->
                    <div class="tv-tt-gp" title="${s.gp_name} - ${s.location}">
                        <i class="fas fa-location-dot" style="color:#f59e0b; font-size:10.5px; margin-right:3px;"></i>${s.gp_name} <small>(${s.location || ''})</small>
                    </div>

                    <!-- 3. Dual PS & ZP Rows (Punchy & High Visibility) -->
                    <div class="tv-tt-dual-strip">
                        <!-- PS Row -->
                        <div class="tv-tt-leader-box ps">
                            <div class="tv-tt-leader-top">
                                <span class="tv-tt-ward-tag ps"><i class="fas fa-landmark"></i> पं.स. ${s.ps_ward}</span>
                                <b class="tv-tt-vote-pill">${psTot > 0 ? psTot + ' मत' : 'प्रतीक्षारत'}</b>
                            </div>
                            ${psLeader ? `
                                <div class="tv-tt-lead-detail">
                                    <span class="party-tag ${(psLeader.party || '').toLowerCase()}">${psLeader.party}</span>
                                    <span class="tv-tt-cand-name" title="${psLeader.name}">${psLeader.name}</span>
                                    <span class="tv-tt-cand-vote">${psLeader.votes}</span>
                                    <span class="tv-tt-cand-margin">+${psLeader.margin}</span>
                                </div>
                            ` : `
                                <div class="tv-tt-lead-detail waiting">
                                    ${pw.leader?.name ? `लीड: ${pw.leader.name} (${pw.leader.party} +${pw.margin})` : 'मतगणना शेष'}
                                </div>
                            `}
                        </div>

                        <!-- ZP Row -->
                        <div class="tv-tt-leader-box zp">
                            <div class="tv-tt-leader-top">
                                <span class="tv-tt-ward-tag zp"><i class="fas fa-building-columns"></i> जि.प. ${s.zp_ward}</span>
                                <b class="tv-tt-vote-pill">${zpTot > 0 ? zpTot + ' मत' : 'प्रतीक्षारत'}</b>
                            </div>
                            ${zpLeader ? `
                                <div class="tv-tt-lead-detail">
                                    <span class="party-tag ${(zpLeader.party || '').toLowerCase()}">${zpLeader.party}</span>
                                    <span class="tv-tt-cand-name" title="${zpLeader.name}">${zpLeader.name}</span>
                                    <span class="tv-tt-cand-vote">${zpLeader.votes}</span>
                                    <span class="tv-tt-cand-margin">+${zpLeader.margin}</span>
                                </div>
                            ` : `
                                <div class="tv-tt-lead-detail waiting">
                                    ${zw.leader?.name ? `लीड: ${zw.leader.name} (${zw.leader.party} +${zw.margin})` : 'मतगणना शेष'}
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- 4. Footer: EVM & Progress -->
                    <div class="tv-tt-foot">
                        <span class="tv-tt-foot-evm">EVM: <b>${polled}</b> मत</span>
                        <div class="tv-tt-mini-progress">
                            <div class="tv-tt-mini-bar ${isDone ? 'completed' : 'counting'}" style="width:${countedProgress}%;"></div>
                        </div>
                        <span class="tv-tt-foot-counted">गिने: <b style="color:${isDone ? '#4ade80' : (psTot > 0 ? '#38bdf8' : '#9ca3af')};">${psTot}</b> (${countedProgress}%)</span>
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

    // VIEW 3: ZILA PARISHAD (2 columns x 2 rows = 4 Wards Clean Zero-Scroll TV Fit)
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
            const hasCounted = totCounted > 0 && leader.votes > 0;
            const leadingParty = leader.party ? leader.party.toLowerCase() : '';

            let statusClass = 'pending';
            let statusBadge = '<span class="tw-status-badge pending"><i class="fas fa-hourglass-start"></i> प्रतीक्षारत</span>';
            if (isDeclared) {
                statusClass = 'declared';
                statusBadge = '<span class="tw-status-badge won"><i class="fas fa-trophy"></i> परिणाम घोषित</span>';
            } else if (hasCounted) {
                statusClass = 'counting';
                statusBadge = `<span class="tw-status-badge lead"><i class="fas fa-bolt"></i> लीड (${zw.completedBooths}/${zw.totalBooths} बूथ)</span>`;
            }

            const isZpHotSeat = hasCounted && !isDeclared && zw.margin > 0 && zw.margin <= 100;

            html += `
                <div class="tv-zp-card ${statusClass} party-${leadingParty}">
                    <!-- 1. Header: Ward Tag & Status -->
                    <div class="tz-card-head">
                        <div class="tz-ward-pill">
                            <span class="tz-ward-name"><i class="fas fa-building-columns" style="color:#c084fc; margin-right:4px;"></i>जि.प. वार्ड ${zw.wardNo || zKey}</span>
                            ${isZpHotSeat ? `<span class="tw-hot-pill" title="अंतर 100 मतों से कम है"><i class="fas fa-fire"></i> कड़ी टक्कर (+${zw.margin} मत)</span>` : ''}
                        </div>
                        ${statusBadge}
                    </div>

                    <!-- 2. Hero Section: Winner / Leader (Clean, Punchy & High-Impact) -->
                    ${hasCounted ? `
                        <div class="tz-hero-body">
                            <!-- Winner/Leader Name & Party Badge -->
                            <div class="tz-lead-row">
                                <span class="tz-party-tag ${leadingParty}">${leader.party}</span>
                                <span class="tz-lead-name" title="${leader.name}">${leader.name}</span>
                            </div>

                            <!-- Big Vote Count & Margin Strip -->
                            <div class="tz-metric-row">
                                <div class="tz-vote-box">
                                    <span class="tz-vote-val">${Number(leader.votes).toLocaleString('en-IN')}</span>
                                    <span class="tz-vote-unit">मत</span>
                                </div>
                                <div class="tz-margin-badge ${isDeclared ? 'won' : (isZpHotSeat ? 'hot' : 'lead')}">
                                    <i class="fas ${isDeclared ? 'fa-check' : 'fa-arrow-up'}"></i>
                                    <span>+${Number(zw.margin).toLocaleString('en-IN')} ${isDeclared ? 'मत से जीत 🏆' : 'लीड ⚡'}</span>
                                </div>
                            </div>

                            <!-- Runner-up Line (Clean, Single Line) -->
                            <div class="tz-runner-strip">
                                <span class="tz-rn-label">🥈 पीछे:</span>
                                <span class="tz-rn-name" title="${runnerUp ? runnerUp.name : '-'}">${runnerUp ? runnerUp.name : '-'}</span>
                                <span class="tz-rn-party">(${runnerUp?.party || '-'})</span>
                                <span class="tz-rn-val">${runnerUp ? Number(runnerUp.votes).toLocaleString('en-IN') : 0} मत</span>
                                ${runnerUp && zw.margin > 0 ? `<span class="tz-rn-diff">(-${Number(zw.margin).toLocaleString('en-IN')})</span>` : ''}
                            </div>

                            <!-- Candidate Breakdown Progress Bars -->
                            <div class="tz-cand-bars">
                                ${candList.map(c => {
                                    const votes = Number(candVotes[c.key]) || 0;
                                    const pct = totPolled > 0 ? ((votes / totPolled) * 100) : 0;
                                    const isWinner = isDeclared && c.key === leader.key;
                                    const isLeading = !isDeclared && hasCounted && c.key === leader.key;
                                    const isTrailing = hasCounted && runnerUp && c.key === runnerUp.key;
                                    const pClass = (c.party || 'IND').toLowerCase();

                                    return `
                                        <div class="tz-cand-bar-item">
                                            <div class="tz-cbi-top">
                                                <div class="tz-cbi-name">
                                                    <span class="tz-cbi-tag ${pClass}">${c.party || 'IND'}</span>
                                                    <span class="tz-cbi-cname" title="${c.name}">${c.name}</span>
                                                    ${isWinner ? '<span class="tz-cbi-pill won"><i class="fas fa-check"></i> विजेता</span>' : 
                                                      isLeading ? '<span class="tz-cbi-pill lead"><i class="fas fa-bolt"></i> आगे</span>' : 
                                                      isTrailing ? '<span class="tz-cbi-pill trail">पीछे</span>' : ''}
                                                </div>
                                                <div class="tz-cbi-votes">
                                                    <b>${votes.toLocaleString('en-IN')} मत</b>
                                                    <small>(${pct.toFixed(1)}%)</small>
                                                </div>
                                            </div>
                                            <div class="tz-cbi-track">
                                                <div class="tz-cbi-fill ${pClass} ${isWinner ? 'winner' : ''}" style="width:${Math.max(2, Math.min(100, pct))}%;"></div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : `
                        <!-- Pending State: Clean contestants preview -->
                        <div class="tz-pending-body">
                            <div class="tz-pending-banner">
                                <i class="fas fa-clock"></i> मतगणना प्रतीक्षारत • सुमेरपुर ब्लॉक क्षेत्र
                            </div>
                            <div class="tz-pending-cands">
                                ${candList.map(c => `
                                    <div class="tz-pcand-item">
                                        <span class="tz-pcand-party ${(c.party || 'IND').toLowerCase()}">${c.party || 'IND'}</span>
                                        <span class="tz-pcand-name">${c.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `}

                    <!-- 3. Bottom Footer: Progress & Booths -->
                    <div class="tz-card-foot">
                        <div class="tz-foot-stats">
                            <span><i class="fas fa-box-archive" style="color:#60a5fa;"></i> EVM: <b>${totPolled.toLocaleString('en-IN')}</b></span>
                            <span><i class="fas fa-building" style="color:#fde047;"></i> बूथ: <b>${zw.completedBooths || 0}/${zw.totalBooths || 0} पूर्ण</b></span>
                            <span><i class="fas fa-check-double" style="color:#4ade80;"></i> गिने: <b>${totCounted.toLocaleString('en-IN')} (${progress}%)</b></span>
                        </div>
                        <div class="tz-progress-track">
                            <div class="tz-progress-fill ${isDeclared ? 'declared' : 'counting'}" style="width:${Math.min(100, Number(progress))}%;"></div>
                        </div>
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


// =============================================================
// POSTAL BALLOT (डाक मतपत्र) MANAGEMENT FUNCTIONS
// =============================================================

function renderPostalBallotView() {
    if (!countingData) return;
    const k = countingData.kpi || {};
    const pbKpi = k.postalKPI || { totalReceived: 0, totalValid: 0, totalRejected: 0, completedWards: 0 };

    // Update KPI Boxes
    const elRec = document.getElementById('pbKpiTotalReceived');
    if (elRec) elRec.textContent = (pbKpi.totalReceived || 0).toLocaleString('en-IN');

    const elVal = document.getElementById('pbKpiTotalValid');
    if (elVal) elVal.textContent = (pbKpi.totalValid || 0).toLocaleString('en-IN');

    const elRej = document.getElementById('pbKpiTotalRejected');
    if (elRej) elRej.textContent = (pbKpi.totalRejected || 0).toLocaleString('en-IN');

    const elComp = document.getElementById('pbKpiCompletedWards');
    if (elComp) elComp.textContent = `${pbKpi.completedWards || 0} / 25`;

    // Ensure Ward Dropdown is Populated
    populatePBWardDropdown();

    // Render Current Selected Ward in Form
    onPBWardChange();

    // Render Summary Table
    renderPBWardSummaryTable();
}

function setPBType(type) {
    activePBType = type;
    const btnPS = document.getElementById('pbTypePSBtn');
    const btnZP = document.getElementById('pbTypeZPBtn');
    if (btnPS && btnZP) {
        if (type === 'ps') {
            btnPS.style.background = '#2563eb';
            btnPS.style.color = '#ffffff';
            btnPS.style.border = 'none';
            btnZP.style.background = '#f1f5f9';
            btnZP.style.color = '#475569';
            btnZP.style.border = '1px solid #cbd5e1';
        } else {
            btnZP.style.background = '#2563eb';
            btnZP.style.color = '#ffffff';
            btnZP.style.border = 'none';
            btnPS.style.background = '#f1f5f9';
            btnPS.style.color = '#475569';
            btnPS.style.border = '1px solid #cbd5e1';
        }
    }
    populatePBWardDropdown();
    onPBWardChange();
}

function populatePBWardDropdown() {
    const sel = document.getElementById('pbWardSelect');
    if (!sel) return;
    const currentVal = sel.value;

    let optionsHtml = '';
    if (activePBType === 'ps') {
        for (let w = 1; w <= 21; w++) {
            const wKey = `W-${w}`;
            const pb = countingData?.postal_ballots?.ps?.[wKey] || {};
            const isDone = (pb.total_received || 0) > 0;
            optionsHtml += `<option value="${wKey}">वार्ड ${wKey} ${isDone ? '✔ (दर्ज)' : '• (प्रतीक्षारत)'}</option>`;
        }
    } else {
        ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
            const pb = countingData?.postal_ballots?.zp?.[zKey] || {};
            const isDone = (pb.total_received || 0) > 0;
            optionsHtml += `<option value="${zKey}">जि.प. वार्ड ${zKey} ${isDone ? '✔ (दर्ज)' : '• (प्रतीक्षारत)'}</option>`;
        });
    }
    sel.innerHTML = optionsHtml;

    if (currentVal && Array.from(sel.options).some(o => o.value === currentVal)) {
        sel.value = currentVal;
    }
}

function onPBWardChange() {
    const sel = document.getElementById('pbWardSelect');
    if (!sel) return;
    const wardKey = sel.value;
    if (!wardKey) return;

    let cands = [];
    let pb = {};
    if (activePBType === 'ps') {
        cands = (countingData?.ps_wards?.[wardKey]?.candidates) || (countingData?.candidates?.[wardKey]) || [];
        pb = countingData?.postal_ballots?.ps?.[wardKey] || {};
    } else {
        cands = (countingData?.zp_wards?.[wardKey]?.candidates) || (countingData?.zp_candidates?.[wardKey]?.candidates) || [];
        pb = countingData?.postal_ballots?.zp?.[wardKey] || {};
    }

    const container = document.getElementById('pbCandidateInputsContainer');
    if (!container) return;

    let html = '';
    cands.forEach(c => {
        let pColor = '#64748b';
        if (c.party === 'BJP') pColor = '#ea580c';
        else if (c.party === 'INC') pColor = '#0284c7';
        else if (c.party === 'IND') pColor = '#9333ea';

        const val = pb[c.key] !== undefined ? pb[c.key] : 0;
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 6px; border-bottom:1px solid #e2e8f0;">
                <div style="flex:1; min-width:0; padding-right:10px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="party-badge" style="background:${pColor}15; color:${pColor}; border:1px solid ${pColor}30; font-size:11px; padding:2px 6px;">${c.party || 'IND'}</span>
                        <b style="font-size:13.5px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</b>
                    </div>
                    <small style="color:#64748b; font-size:11px;">चुनाव चिन्ह: ${c.symbol || 'स्वतंत्र'}</small>
                </div>
                <div style="width:110px;">
                    <input type="number" class="pb-cand-input" data-key="${c.key}" min="0" value="${val}" oninput="calculatePBLiveTotal()" style="width:100%; padding:7px 10px; font-size:15px; font-weight:800; border:1.5px solid #cbd5e1; border-radius:6px; text-align:right; color:#0f172a; background:#ffffff;">
                </div>
            </div>
        `;
    });
    container.innerHTML = html;

    const inpTotRec = document.getElementById('pbInputTotalReceived');
    if (inpTotRec) inpTotRec.value = pb.total_received || 0;

    const inpNota = document.getElementById('pbInputNota');
    if (inpNota) inpNota.value = pb.nota || 0;

    const inpRej = document.getElementById('pbInputRejected');
    if (inpRej) inpRej.value = pb.rejected || 0;

    const inpRem = document.getElementById('pbInputRemark');
    if (inpRem) inpRem.value = pb.remark || '';

    const badge = document.getElementById('pbFormModeBadge');
    if (badge) {
        if ((pb.total_received || 0) > 0) {
            badge.textContent = `संशोधन (पूर्व दर्ज: ${pb.total_received} मत)`;
            badge.style.background = '#dcfce7';
            badge.style.color = '#15803d';
        } else {
            badge.textContent = 'नया दर्ज करें';
            badge.style.background = '#e0f2fe';
            badge.style.color = '#0369a1';
        }
    }

    calculatePBLiveTotal(true);
}

function calculatePBLiveTotal(isFromTotalReceived) {
    let validSum = 0;
    document.querySelectorAll('.pb-cand-input').forEach(inp => {
        validSum += Number(inp.value) || 0;
    });
    const nota = Number(document.getElementById('pbInputNota')?.value) || 0;
    validSum += nota;

    const rej = Number(document.getElementById('pbInputRejected')?.value) || 0;
    const inpTotalRec = document.getElementById('pbInputTotalReceived');
    let totalRec = Number(inpTotalRec?.value) || 0;

    // If user entered candidate votes/rejected and total received was not set, auto-set it
    if (!isFromTotalReceived && totalRec === 0 && (validSum > 0 || rej > 0)) {
        totalRec = validSum + rej;
        if (inpTotalRec) inpTotalRec.value = totalRec;
    }

    const targetValid = Math.max(0, totalRec - rej);
    const targetDisp = document.getElementById('pbTargetValidDisplay');
    if (targetDisp) {
        targetDisp.textContent = `${targetValid.toLocaleString('en-IN')} मत`;
    }

    const counter = document.getElementById('pbCandTallyCounter');
    if (counter) {
        counter.textContent = `विधिमान्य दर्ज: ${validSum.toLocaleString('en-IN')} मत`;
    }

    const elValid = document.getElementById('pbLiveValid');
    if (elValid) elValid.textContent = validSum.toLocaleString('en-IN');

    const elRej = document.getElementById('pbLiveRejected');
    if (elRej) elRej.textContent = rej.toLocaleString('en-IN');

    const elTotal = document.getElementById('pbLiveTotal');
    if (elTotal) elTotal.textContent = totalRec.toLocaleString('en-IN');

    // Reconciliation / Tally status indicator
    const reconBox = document.getElementById('pbLiveReconciliationStatus');
    if (reconBox) {
        if (totalRec === 0 && validSum === 0 && rej === 0) {
            reconBox.style.background = '#1e293b';
            reconBox.style.color = '#94a3b8';
            reconBox.innerHTML = `⚪ गणना प्रविष्टि प्रतीक्षारत`;
        } else if (totalRec === (validSum + rej)) {
            reconBox.style.background = '#14532d';
            reconBox.style.color = '#86efac';
            reconBox.innerHTML = `✔ 100% मिलान पूर्ण (कुल ${totalRec} = ${validSum} विधिमान्य + ${rej} निरस्त)`;
        } else if (totalRec > (validSum + rej)) {
            const diff = totalRec - (validSum + rej);
            reconBox.style.background = '#78350f';
            reconBox.style.color = '#fde047';
            reconBox.innerHTML = `⚠️ अंतर: ${diff} मत अभी दर्ज होने शेष हैं (दर्ज: ${validSum + rej} / प्राप्त: ${totalRec})`;
        } else {
            const over = (validSum + rej) - totalRec;
            reconBox.style.background = '#7f1d1d';
            reconBox.style.color = '#fca5a5';
            reconBox.innerHTML = `❌ त्रुटि: दर्ज मत (${validSum + rej}) कुल प्राप्त मतों (${totalRec}) से ${over} अधिक हैं`;
        }
    }
}

async function savePostalBallotEntry() {
    const sel = document.getElementById('pbWardSelect');
    if (!sel) return;
    const ward = sel.value;
    if (!ward) return;

    const votes = {};
    let validSum = 0;
    document.querySelectorAll('.pb-cand-input').forEach(inp => {
        const v = Number(inp.value) || 0;
        votes[inp.dataset.key] = v;
        validSum += v;
    });
    votes.nota = Number(document.getElementById('pbInputNota')?.value) || 0;
    validSum += votes.nota;

    const rejected = Number(document.getElementById('pbInputRejected')?.value) || 0;
    let total_received = Number(document.getElementById('pbInputTotalReceived')?.value) || 0;
    if (total_received === 0 && (validSum > 0 || rejected > 0)) {
        total_received = validSum + rejected;
    }

    const remark = (document.getElementById('pbInputRemark')?.value || '').trim();

    const alertBox = document.getElementById('pbSaveAlert');
    if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#e0f2fe';
        alertBox.style.color = '#0369a1';
        alertBox.textContent = 'डाक मतपत्र सुरक्षित किए जा रहे हैं...';
    }

    try {
        const res = await fetch('/api/counting/postal-ballot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: activePBType,
                ward,
                votes,
                total_received,
                rejected,
                remark
            })
        });
        const data = await res.json();
        if (data.success) {
            countingData = data;
            if (alertBox) {
                alertBox.style.background = '#dcfce7';
                alertBox.style.color = '#15803d';
                alertBox.textContent = `✔ ${data.message || 'डाक मतपत्र सफलतापूर्वक सुरक्षित किए गए।'}`;
                setTimeout(() => { alertBox.style.display = 'none'; }, 3500);
            }
            renderAll();
            renderPostalBallotView();
        } else {
            if (alertBox) {
                alertBox.style.background = '#fee2e2';
                alertBox.style.color = '#b91c1c';
                alertBox.textContent = `⚠ त्रुटि: ${data.message || 'डाटा सुरक्षित नहीं हो सका।'}`;
            }
        }
    } catch (err) {
        if (alertBox) {
            alertBox.style.background = '#fee2e2';
            alertBox.style.color = '#b91c1c';
            alertBox.textContent = `⚠ नेटवर्क त्रुटि: ${err.message}`;
        }
    }
}

function resetPBForm() {
    const inpTot = document.getElementById('pbInputTotalReceived');
    if (inpTot) inpTot.value = 0;
    document.querySelectorAll('.pb-cand-input').forEach(inp => inp.value = 0);
    const inpNota = document.getElementById('pbInputNota');
    if (inpNota) inpNota.value = 0;
    const inpRej = document.getElementById('pbInputRejected');
    if (inpRej) inpRej.value = 0;
    const inpRem = document.getElementById('pbInputRemark');
    if (inpRem) inpRem.value = '';
    calculatePBLiveTotal(true);
}

function filterPBTable(type) {
    activePBTableFilter = type;
    const btnPS = document.getElementById('pbTableFilterPS');
    const btnZP = document.getElementById('pbTableFilterZP');
    if (btnPS && btnZP) {
        if (type === 'ps') {
            btnPS.style.background = '#2563eb';
            btnPS.style.color = '#ffffff';
            btnZP.style.background = '#f8fafc';
            btnZP.style.color = '#475569';
        } else {
            btnZP.style.background = '#2563eb';
            btnZP.style.color = '#ffffff';
            btnPS.style.background = '#f8fafc';
            btnPS.style.color = '#475569';
        }
    }
    renderPBWardSummaryTable();
}

function renderPBWardSummaryTable() {
    const tbody = document.getElementById('pbWardSummaryTableBody');
    if (!tbody || !countingData) return;

    let html = '';
    if (activePBTableFilter === 'ps') {
        for (let w = 1; w <= 21; w++) {
            const wKey = `W-${w}`;
            const wm = countingData.ps_wards?.[wKey] || {};
            const cands = wm.candidates || [];
            const pb = wm.postalBallots || countingData?.postal_ballots?.ps?.[wKey] || {};

            const isDone = (pb.total_received || 0) > 0;
            const valid = pb.total_valid || 0;
            const rej = pb.rejected || 0;
            const total = pb.total_received || 0;
            const nota = pb.nota || 0;

            const candsBreakdown = cands.map(c => {
                const cv = pb[c.key] || 0;
                let col = '#475569';
                if (c.party === 'BJP') col = '#ea580c';
                else if (c.party === 'INC') col = '#0284c7';
                return `<span style="margin-right:8px; display:inline-block; font-size:12px;"><b style="color:${col};">${c.name} [${c.party}]:</b> ${cv}</span>`;
            }).join(' | ');

            html += `
                <tr>
                    <td style="text-align:center; font-weight:900;">
                        <span class="ward-title-pill">${wKey}</span>
                    </td>
                    <td>${candsBreakdown || '<span style="color:#94a3b8;">-</span>'}</td>
                    <td style="text-align:right; color:#64748b;">${nota}</td>
                    <td style="text-align:right; font-weight:700; color:#dc2626;">${rej}</td>
                    <td style="text-align:right; font-weight:900; color:#166534; background:#f0fdf4;">${valid}</td>
                    <td style="text-align:right; font-weight:800; color:#1e40af; background:#eff6ff;">${total}</td>
                    <td style="text-align:center;">
                        <span class="status-pill ${isDone ? 'declared' : 'pending'}">${isDone ? '🟢 दर्ज' : '⚪ शेष'}</span>
                    </td>
                    <td style="text-align:center;">
                        <button class="btn-xs btn-outline" onclick="editPostalBallotWard('${wKey}')" title="इस वार्ड के डाक मतपत्र संपादित करें">
                            <i class="fas fa-edit"></i> दर्ज
                        </button>
                    </td>
                </tr>
            `;
        }
    } else {
        ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
            const zw = countingData.zp_wards?.[zKey] || {};
            const cands = zw.candidates || [];
            const pb = zw.postalBallots || countingData?.postal_ballots?.zp?.[zKey] || {};

            const isDone = (pb.total_received || 0) > 0;
            const valid = pb.total_valid || 0;
            const rej = pb.rejected || 0;
            const total = pb.total_received || 0;
            const nota = pb.nota || 0;

            const candsBreakdown = cands.map(c => {
                const cv = pb[c.key] || 0;
                let col = '#475569';
                if (c.party === 'BJP') col = '#ea580c';
                else if (c.party === 'INC') col = '#0284c7';
                return `<span style="margin-right:8px; display:inline-block; font-size:12px;"><b style="color:${col};">${c.name} [${c.party}]:</b> ${cv}</span>`;
            }).join(' | ');

            html += `
                <tr>
                    <td style="text-align:center; font-weight:900;">
                        <span class="ward-title-pill" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;">${zKey}</span>
                    </td>
                    <td>${candsBreakdown || '<span style="color:#94a3b8;">-</span>'}</td>
                    <td style="text-align:right; color:#64748b;">${nota}</td>
                    <td style="text-align:right; font-weight:700; color:#dc2626;">${rej}</td>
                    <td style="text-align:right; font-weight:900; color:#166534; background:#f0fdf4;">${valid}</td>
                    <td style="text-align:right; font-weight:800; color:#1e40af; background:#eff6ff;">${total}</td>
                    <td style="text-align:center;">
                        <span class="status-pill ${isDone ? 'declared' : 'pending'}">${isDone ? '🟢 दर्ज' : '⚪ शेष'}</span>
                    </td>
                    <td style="text-align:center;">
                        <button class="btn-xs btn-outline" onclick="editPostalBallotWard('${zKey}')" title="इस वार्ड के डाक मतपत्र संपादित करें">
                            <i class="fas fa-edit"></i> दर्ज
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    tbody.innerHTML = html;
}

function editPostalBallotWard(wardKey) {
    const isZP = wardKey.startsWith('Z-');
    setPBType(isZP ? 'zp' : 'ps');
    const sel = document.getElementById('pbWardSelect');
    if (sel) {
        sel.value = wardKey;
        onPBWardChange();
        sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function exportPostalBallotsExcel() {
    if (!window.XLSX || !countingData) {
        alert('Excel library not loaded.');
        return;
    }

    const rows = [
        ['पंचायती राज आम चुनाव 2026 - सुमेरपुर'],
        ['आधिकारिक डाक मतपत्र (Postal Ballot) संकलन विवरण'],
        [''],
        ['चुनाव प्रकार', 'वार्ड', 'प्रत्याशी-वार विवरण', 'नोटा', 'निरस्त मत', 'कुल विधिमान्य मत', 'कुल प्राप्त डाक मतपत्र', 'स्थिति']
    ];

    // PS Wards
    for (let w = 1; w <= 21; w++) {
        const wKey = `W-${w}`;
        const wm = countingData.ps_wards?.[wKey] || {};
        const cands = wm.candidates || [];
        const pb = wm.postalBallots || {};
        const candStr = cands.map(c => `${c.name} (${c.party}): ${pb[c.key] || 0}`).join(', ');
        rows.push([
            'पंचायत समिति',
            wKey,
            candStr,
            pb.nota || 0,
            pb.rejected || 0,
            pb.total_valid || 0,
            pb.total_received || 0,
            (pb.total_received || 0) > 0 ? 'दर्ज' : 'प्रतीक्षारत'
        ]);
    }

    // ZP Wards
    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const zw = countingData.zp_wards?.[zKey] || {};
        const cands = zw.candidates || [];
        const pb = zw.postalBallots || {};
        const candStr = cands.map(c => `${c.name} (${c.party}): ${pb[c.key] || 0}`).join(', ');
        rows.push([
            'जिला परिषद',
            zKey,
            candStr,
            pb.nota || 0,
            pb.rejected || 0,
            pb.total_valid || 0,
            pb.total_received || 0,
            (pb.total_received || 0) > 0 ? 'दर्ज' : 'प्रतीक्षारत'
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Postal_Ballots');
    XLSX.writeFile(wb, `Postal_Ballots_Sumerpur_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// =============================================================
// 7. OFFICIAL REPORTS & OPERATOR WORKBOOK GENERATOR
// =============================================================
let currentReportType = 'ps_form19';

function selectReport(type) {
    currentReportType = type;
    document.querySelectorAll('.report-select-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-report') === type);
    });
    renderReportsTab();
}

function renderReportsTab() {
    const container = document.getElementById('reportPrintableDocument');
    if (!container || !countingData) return;
    container.innerHTML = renderReportDocument(currentReportType);
}

function renderReportDocument(type) {
    if (!countingData) return '<div style="text-align:center; padding:40px; color:#64748b;">डेटा लोड हो रहा है...</div>';

    const psWards = countingData.ps_wards || {};
    const zpWards = countingData.zp_wards || {};
    const rounds = countingData.rounds || {};
    const slots = countingData.slots || {};
    const dateStr = '22 अक्टूबर 2026';
    const nowStr = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });

    if (type === 'ps_form19') {
        let rowsHtml = '';
        let sElectors = 0, sPolled = 0, sPB = 0, sTotal = 0, sBjp = 0, sInc = 0, sInd = 0, sNota = 0;

        for (let w = 1; w <= 21; w++) {
            const wKey = 'W-' + w;
            const wm = psWards[wKey] || {};
            const cands = wm.candidates || [];
            const cv = wm.candVotes || {};
            const pb = wm.postalBallots || {};

            let bjpCand = '-', incCand = '-', indCand = '-';
            let bVotes = 0, iVotes = 0, oVotes = 0;

            cands.forEach(c => {
                const v = cv[c.key] || 0;
                if (c.party === 'BJP') { bjpCand = `${c.name} (${v})`; bVotes += v; sBjp += v; }
                else if (c.party === 'INC') { incCand = `${c.name} (${v})`; iVotes += v; sInc += v; }
                else { indCand = `${c.name} (${v})`; oVotes += v; sInd += v; }
            });

            const nota = cv.nota || 0;
            const pbVal = wm.postalCountedVotes || 0;
            const tot = wm.totalCountedVotes || 0;
            const polled = wm.totalPolledVotes || 0;
            const electors = wm.totalElectors || 0;

            sElectors += electors;
            sPolled += polled;
            sPB += pbVal;
            sTotal += tot;
            sNota += nota;

            const leaderName = wm.leader?.name && wm.leader.name !== '-' ? wm.leader.name : '-';
            const leaderParty = wm.leader?.party || '-';
            const marginStr = wm.margin ? '+' + wm.margin : '0';
            const statusBadge = wm.status === 'DECLARED'
                ? '<strong style="color:#16a34a;">विजयी घोषित</strong>'
                : (wm.status === 'COUNTING' ? '<strong style="color:#d97706;">गणना जारी</strong>' : '<span style="color:#64748b;">प्रतीक्षारत</span>');

            rowsHtml += `
                <tr>
                    <td class="fw-bold">${w}</td>
                    <td class="fw-bold">${wKey}</td>
                    <td>${electors.toLocaleString('en-IN')}</td>
                    <td>${polled.toLocaleString('en-IN')}</td>
                    <td style="color:#2563eb; font-weight:700;">${pbVal}</td>
                    <td class="fw-bold" style="color:#0f172a; font-size:12px;">${tot.toLocaleString('en-IN')}</td>
                    <td class="text-left" style="color:#ea580c; font-weight:600;">${bjpCand}</td>
                    <td class="text-left" style="color:#16a34a; font-weight:600;">${incCand}</td>
                    <td class="text-left" style="color:#475569;">${indCand}</td>
                    <td>${nota}</td>
                    <td class="fw-bold text-left" style="color:#1e1b4b;">${leaderName}</td>
                    <td class="fw-bold">${leaderParty}</td>
                    <td class="fw-bold" style="color:#16a34a;">${marginStr}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }

        return `
            <div class="report-doc-sheet">
                <div class="report-doc-header">
                    <div style="font-size:12px; font-weight:800; color:#475569; letter-spacing:0.8px;">राज्य निर्वाचन आयोग, राजस्थान</div>
                    <div class="gov-title">प्ररूप-19 [नियम 64 देखिए] - निर्वाचन परिणाम का विवरण</div>
                    <div class="form-name">पंचायत समिति सदस्य निर्वाचन - सुमेरपुर (जिला: पाली) • कुल 21 वार्ड</div>
                    <div class="sub-title">मतगणना स्थल: राजकीय उच्च माध्यमिक विद्यालय, सुमेरपुर | अद्यतन समय: ${nowStr} | दिनांक: ${dateStr}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">[नोट: कुल विधिमान्य मत = 152 बूथ EVM मत (Form 17C) + डाक मतपत्र (Postal Ballot)]</div>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th rowspan="2">क्र.</th>
                            <th rowspan="2">वार्ड नं.</th>
                            <th rowspan="2">कुल मतदाता</th>
                            <th rowspan="2">EVM मत (17C)</th>
                            <th rowspan="2">डाक मत (PB)</th>
                            <th rowspan="2">कुल गिने मत</th>
                            <th colspan="4">प्रत्याशी-वार प्राप्त विधिमान्य मत</th>
                            <th colspan="3">परिणाम / बढ़त</th>
                            <th rowspan="2">स्थिति</th>
                        </tr>
                        <tr>
                            <th>BJP प्रत्याशी</th>
                            <th>INC प्रत्याशी</th>
                            <th>निर्दलीय/अन्य</th>
                            <th>नोटा</th>
                            <th>विजेता / अग्रणी</th>
                            <th>पार्टी</th>
                            <th>मार्जिन</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr style="background:#e2e8f0; font-weight:800;">
                            <td colspan="2">सुमेरपुर पं.स. महायोग</td>
                            <td>${sElectors.toLocaleString('en-IN')}</td>
                            <td>${sPolled.toLocaleString('en-IN')}</td>
                            <td style="color:#2563eb;">${sPB}</td>
                            <td style="color:#0f172a;">${sTotal.toLocaleString('en-IN')}</td>
                            <td class="text-left" style="color:#ea580c;">BJP कुल: ${sBjp.toLocaleString('en-IN')}</td>
                            <td class="text-left" style="color:#16a34a;">INC कुल: ${sInc.toLocaleString('en-IN')}</td>
                            <td class="text-left" style="color:#475569;">IND कुल: ${sInd.toLocaleString('en-IN')}</td>
                            <td>${sNota}</td>
                            <td colspan="3">-</td>
                            <td>-</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="report-sign-grid">
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">हस्ताक्षर निर्वाचन पर्यवेक्षक</div>
                        <div class="report-sign-sub">राज्य निर्वाचन आयोग, राजस्थान</div>
                    </div>
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">हस्ताक्षर रिटर्निंग ऑफिसर (RO)</div>
                        <div class="report-sign-sub">उपखंड अधिकारी, सुमेरपुर (पाली)</div>
                    </div>
                </div>
            </div>
        `;
    }

    if (type === 'zp_form19') {
        let rowsHtml = '';
        ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach((zKey, idx) => {
            const zw = zpWards[zKey] || {};
            const cands = zw.candidates || [];
            const cv = zw.candVotes || {};
            const candStr = cands.map(c => `<strong>${c.name}</strong> [${c.party}]: ${cv[c.key] || 0}`).join(' &nbsp;|&nbsp; ');

            const leaderName = zw.leader?.name && zw.leader.name !== '-' ? zw.leader.name : '-';
            const leaderParty = zw.leader?.party || '-';
            const marginStr = zw.margin ? '+' + zw.margin : '0';
            const statusBadge = zw.status === 'DECLARED'
                ? '<strong style="color:#16a34a;">विजयी घोषित</strong>'
                : (zw.status === 'COUNTING' ? '<strong style="color:#d97706;">गणना जारी</strong>' : '<span style="color:#64748b;">प्रतीक्षारत</span>');

            rowsHtml += `
                <tr>
                    <td class="fw-bold">${idx + 1}</td>
                    <td class="fw-bold">${zKey}</td>
                    <td>${zw.completedBooths || 0} / ${zw.totalBooths || 0}</td>
                    <td>${(zw.totalPolledVotes || 0).toLocaleString('en-IN')}</td>
                    <td style="color:#2563eb; font-weight:700;">${zw.postalCountedVotes || 0}</td>
                    <td class="fw-bold" style="font-size:12px;">${(zw.totalCountedVotes || 0).toLocaleString('en-IN')}</td>
                    <td class="text-left" style="font-size:11.5px;">${candStr}</td>
                    <td>${cv.nota || 0}</td>
                    <td class="fw-bold text-left" style="color:#1e1b4b;">${leaderName}</td>
                    <td class="fw-bold">${leaderParty}</td>
                    <td class="fw-bold" style="color:#16a34a;">${marginStr}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });

        return `
            <div class="report-doc-sheet">
                <div class="report-doc-header">
                    <div style="font-size:12px; font-weight:800; color:#475569; letter-spacing:0.8px;">राज्य निर्वाचन आयोग, राजस्थान</div>
                    <div class="gov-title">प्ररूप-19 [नियम 64 देखिए] - निर्वाचन परिणाम का विवरण</div>
                    <div class="form-name">जिला परिषद सदस्य निर्वाचन - सुमेरपुर क्षेत्र (पाली) • वार्ड 7, 8, 9, 10</div>
                    <div class="sub-title">मतगणना स्थल: राजकीय उच्च माध्यमिक विद्यालय, सुमेरपुर | अद्यतन समय: ${nowStr} | दिनांक: ${dateStr}</div>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th>क्र.</th>
                            <th>जि.प. वार्ड नं.</th>
                            <th>बूथ प्रगति</th>
                            <th>EVM मत (17C)</th>
                            <th>डाक मत (PB)</th>
                            <th>कुल गिने मत</th>
                            <th>प्रत्याशी-वार प्राप्त विधिमान्य मत</th>
                            <th>नोटा</th>
                            <th>विजेता / अग्रणी</th>
                            <th>पार्टी</th>
                            <th>मार्जिन</th>
                            <th>स्थिति</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="report-sign-grid">
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">हस्ताक्षर निर्वाचन पर्यवेक्षक</div>
                        <div class="report-sign-sub">राज्य निर्वाचन आयोग, राजस्थान</div>
                    </div>
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">हस्ताक्षर रिटर्निंग ऑफिसर (RO)</div>
                        <div class="report-sign-sub">उपखंड अधिकारी, सुमेरपुर (पाली)</div>
                    </div>
                </div>
            </div>
        `;
    }

    if (type === 'round_summary') {
        let rowsHtml = '';
        let totTables = 0, totComp = 0, totPolled = 0, totCounted = 0;

        for (let r = 1; r <= 14; r++) {
            const rd = rounds[r] || {};
            const pct = rd.totalPolledVotes > 0 ? ((rd.totalVotes / rd.totalPolledVotes) * 100).toFixed(1) + '%' : '0.0%';
            totTables += (rd.totalBoothsInRound || 0);
            totComp += (rd.completedBoothsInRound || 0);
            totPolled += (rd.totalPolledVotes || 0);
            totCounted += (rd.totalVotes || 0);

            const statusBadge = rd.status === 'COMPLETED'
                ? '<strong style="color:#16a34a;">पूर्ण</strong>'
                : (rd.status === 'COUNTING' ? '<strong style="color:#d97706;">जारी</strong>' : '<span style="color:#64748b;">प्रतीक्षारत</span>');

            rowsHtml += `
                <tr>
                    <td class="fw-bold">राउंड ${r}</td>
                    <td>${rd.totalBoothsInRound || 0}</td>
                    <td class="fw-bold">${rd.completedBoothsInRound || 0}</td>
                    <td>${(rd.totalPolledVotes || 0).toLocaleString('en-IN')}</td>
                    <td class="fw-bold" style="color:#0f172a;">${(rd.totalVotes || 0).toLocaleString('en-IN')}</td>
                    <td class="fw-bold" style="color:#2563eb;">${pct}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }

        const grandPct = totPolled > 0 ? ((totCounted / totPolled) * 100).toFixed(1) + '%' : '0.0%';

        return `
            <div class="report-doc-sheet">
                <div class="report-doc-header">
                    <div style="font-size:12px; font-weight:800; color:#475569;">निर्वाचन अधिकारी कार्यालय, सुमेरपुर (पाली)</div>
                    <div class="gov-title">14-राउंड आधिकारिक मतगणना सारणी (EVM Progression Report)</div>
                    <div class="form-name">15 टेबल व्यवस्था • कुल 152 मतदान केंद्र • पं.स. व जि.प. मतगणना</div>
                    <div class="sub-title">अद्यतन समय: ${nowStr} | दिनांक: ${dateStr}</div>
                </div>

                <table class="report-table">
                    <thead>
                        <tr>
                            <th>राउंड संख्या</th>
                            <th>कुल टेबल/बूथ</th>
                            <th>पूर्ण बूथ</th>
                            <th>EVM डाले गए मत (17C)</th>
                            <th>गिने गए मत (EVM)</th>
                            <th>प्रगति प्रतिशत</th>
                            <th>राउंड स्थिति</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr style="background:#e2e8f0; font-weight:800;">
                            <td>कुल योग</td>
                            <td>${totTables}</td>
                            <td>${totComp}</td>
                            <td>${totPolled.toLocaleString('en-IN')}</td>
                            <td>${totCounted.toLocaleString('en-IN')}</td>
                            <td style="color:#2563eb;">${grandPct}</td>
                            <td>${totComp === totTables && totTables > 0 ? 'सम्पूर्ण संपन्न' : 'मतगणना प्रगति पर'}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="report-sign-grid">
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">नोडल अधिकारी (मतगणना)</div>
                        <div class="report-sign-sub">सुमेरपुर, पाली</div>
                    </div>
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">रिटर्निंग ऑफिसर (RO)</div>
                        <div class="report-sign-sub">उपखंड अधिकारी, सुमेरपुर</div>
                    </div>
                </div>
            </div>
        `;
    }

    if (type === 'master_matrix') {
        let matrixHtml = '';
        let roundSums = Array(15).fill(0);

        for (let t = 1; t <= 15; t++) {
            let rowCols = `<td class="fw-bold">टेबल ${t}</td>`;
            let tableTot = 0;
            for (let r = 1; r <= 14; r++) {
                const slot = Object.values(slots).find(s => Number(s.round) === r && Number(s.table) === t);
                if (slot) {
                    const votes = Number(slot.votes?.total) || 0;
                    tableTot += votes;
                    roundSums[r] += votes;
                    rowCols += `<td style="${votes > 0 ? 'font-weight:700; color:#15803d;' : 'color:#94a3b8;'}">${votes > 0 ? votes : '0'}<br><span style="font-size:9.5px; color:#64748b;">(बूथ ${slot.booth_no})</span></td>`;
                } else {
                    rowCols += `<td style="color:#cbd5e1;">-</td>`;
                }
            }
            rowCols += `<td class="fw-bold" style="background:#f1f5f9; color:#0f172a;">${tableTot.toLocaleString('en-IN')}</td>`;
            matrixHtml += `<tr>${rowCols}</tr>`;
        }

        let footerCols = `<td class="fw-bold">राउंड योग</td>`;
        let grandMatrixTot = 0;
        for (let r = 1; r <= 14; r++) {
            footerCols += `<td class="fw-bold">${roundSums[r].toLocaleString('en-IN')}</td>`;
            grandMatrixTot += roundSums[r];
        }
        footerCols += `<td class="fw-bold" style="color:#1d4ed8;">${grandMatrixTot.toLocaleString('en-IN')}</td>`;

        return `
            <div class="report-doc-sheet" style="font-size:10.5px;">
                <div class="report-doc-header">
                    <div style="font-size:12px; font-weight:800; color:#475569;">सुमेरपुर पंचायती राज चुनाव 2026</div>
                    <div class="gov-title">15 टेबल x 14 राउंड मास्टर मतगणना मैट्रिक्स (Form 17C Control Unit मत)</div>
                    <div class="sub-title">152 मतदान केंद्र कंट्रोल यूनिट मत मिलान चार्ट | अद्यतन: ${nowStr}</div>
                </div>

                <div style="overflow-x:auto;">
                    <table class="report-table" style="font-size:10px;">
                        <thead>
                            <tr>
                                <th>टेबल</th>
                                <th>R1</th><th>R2</th><th>R3</th><th>R4</th><th>R5</th><th>R6</th><th>R7</th>
                                <th>R8</th><th>R9</th><th>R10</th><th>R11</th><th>R12</th><th>R13</th><th>R14</th>
                                <th>टेबल कुल</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${matrixHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background:#e2e8f0; font-weight:800;">
                                ${footerCols}
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="report-sign-grid">
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">मतगणना प्रभारी</div>
                    </div>
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">रिटर्निंग ऑफिसर (RO)</div>
                    </div>
                </div>
            </div>
        `;
    }

    if (type === 'postal_ballot_report') {
        let psRows = '', zpRows = '';
        let totRec = 0, totVal = 0, totRej = 0;

        for (let w = 1; w <= 21; w++) {
            const wKey = 'W-' + w;
            const wm = psWards[wKey] || {};
            const cands = wm.candidates || [];
            const pb = wm.postalBallots || {};
            const candStr = cands.map(c => `${c.name} [${c.party}]: ${pb[c.key] || 0}`).join(' | ');

            const rec = Number(pb.total_received) || 0;
            const val = Number(pb.total_valid) || 0;
            const rej = Number(pb.rejected) || 0;

            totRec += rec; totVal += val; totRej += rej;

            psRows += `
                <tr>
                    <td class="fw-bold">${wKey}</td>
                    <td class="text-left">${candStr}</td>
                    <td>${pb.nota || 0}</td>
                    <td style="color:#ef4444; font-weight:700;">${rej}</td>
                    <td style="color:#16a34a; font-weight:700;">${val}</td>
                    <td class="fw-bold">${rec}</td>
                    <td>${rec > 0 ? '<strong style="color:#16a34a;">सत्यापित</strong>' : '<span style="color:#94a3b8;">शून्य/लंबित</span>'}</td>
                </tr>
            `;
        }

        ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
            const zw = zpWards[zKey] || {};
            const cands = zw.candidates || [];
            const pb = zw.postalBallots || {};
            const candStr = cands.map(c => `${c.name} [${c.party}]: ${pb[c.key] || 0}`).join(' | ');

            const rec = Number(pb.total_received) || 0;
            const val = Number(pb.total_valid) || 0;
            const rej = Number(pb.rejected) || 0;

            totRec += rec; totVal += val; totRej += rej;

            zpRows += `
                <tr>
                    <td class="fw-bold">${zKey}</td>
                    <td class="text-left">${candStr}</td>
                    <td>${pb.nota || 0}</td>
                    <td style="color:#ef4444; font-weight:700;">${rej}</td>
                    <td style="color:#16a34a; font-weight:700;">${val}</td>
                    <td class="fw-bold">${rec}</td>
                    <td>${rec > 0 ? '<strong style="color:#16a34a;">सत्यापित</strong>' : '<span style="color:#94a3b8;">शून्य/लंबित</span>'}</td>
                </tr>
            `;
        });

        return `
            <div class="report-doc-sheet">
                <div class="report-doc-header">
                    <div style="font-size:12px; font-weight:800; color:#475569;">रिटर्निंग ऑफिसर कार्यालय, सुमेरपुर</div>
                    <div class="gov-title">डाक मतपत्र (Postal Ballot) संकलन व सत्यापन आधिकारिक लेखा</div>
                    <div class="form-name">पंचायत समिति 21 वार्ड एवं जिला परिषद 4 वार्ड • डाक मत गणना प्रपत्र</div>
                    <div class="sub-title">अद्यतन समय: ${nowStr} | कुल प्राप्त: ${totRec} | कुल विधिमान्य: ${totVal} | निरस्त: ${totRej}</div>
                </div>

                <div style="font-size:13px; font-weight:800; color:#1e1b4b; margin:12px 0 6px 0;">१. पंचायत समिति (21 वार्ड) डाक मतपत्र लेखा:</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>वार्ड नं.</th>
                            <th>प्रत्याशी-वार प्राप्त मत</th>
                            <th>नोटा</th>
                            <th>निरस्त मत</th>
                            <th>विधिमान्य मत</th>
                            <th>कुल प्राप्त मतपत्र</th>
                            <th>स्थिति</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${psRows}
                    </tbody>
                </table>

                <div style="font-size:13px; font-weight:800; color:#1e1b4b; margin:18px 0 6px 0;">२. जिला परिषद (4 वार्ड) डाक मतपत्र लेखा:</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>वार्ड नं.</th>
                            <th>प्रत्याशी-वार प्राप्त मत</th>
                            <th>नोटा</th>
                            <th>निरस्त मत</th>
                            <th>विधिमान्य मत</th>
                            <th>कुल प्राप्त मतपत्र</th>
                            <th>स्थिति</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${zpRows}
                    </tbody>
                </table>

                <div class="report-sign-grid">
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">प्रभारी अधिकारी (डाक मतपत्र प्रकोष्ठ)</div>
                    </div>
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">रिटर्निंग ऑफिसर (RO)</div>
                    </div>
                </div>
            </div>
        `;
    }

    if (type === 'ro_bulletin') {
        const kpi = countingData.kpi || {};
        const psTally = kpi.psPartyTally || {};
        const zpTally = kpi.zpPartyTally || {};

        return `
            <div class="report-doc-sheet" style="max-width:800px; margin:0 auto; border:1px solid #cbd5e1; padding:25px; border-radius:8px;">
                <div class="report-doc-header" style="border-bottom:2px solid #0f172a;">
                    <div style="font-size:12px; font-weight:800; color:#475569;">प्रेस एवं सार्वजनिक सूचना विज्ञप्ति</div>
                    <div class="gov-title">सुमेरपुर पंचायती राज मतगणना आधिकारिक बुलेटिन</div>
                    <div class="form-name">सक्रिय राउंड: राउंड ${kpi.activeRound || 1} / 14 | कुल गिने गए मत: ${(kpi.totalCountedVotes || 0).toLocaleString('en-IN')}</div>
                    <div class="sub-title">प्रकाशन समय: ${nowStr} | दिनांक: ${dateStr}</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                        <div style="font-weight:800; font-size:14px; margin-bottom:6px; color:#1e1b4b;">पंचायत समिति (21 वार्ड) दलीय स्थिति:</div>
                        <div style="font-size:12.5px; line-height:1.7;">
                            • <strong>BJP:</strong> ${psTally.BJP?.won || 0} विजयी, ${psTally.BJP?.lead || 0} में आगे (कुल: ${psTally.BJP?.total || 0})<br>
                            • <strong>INC:</strong> ${psTally.INC?.won || 0} विजयी, ${psTally.INC?.lead || 0} में आगे (कुल: ${psTally.INC?.total || 0})<br>
                            • <strong>निर्दलीय/अन्य:</strong> ${psTally.IND?.won || 0} विजयी, ${psTally.IND?.lead || 0} में आगे (कुल: ${psTally.IND?.total || 0})
                        </div>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                        <div style="font-weight:800; font-size:14px; margin-bottom:6px; color:#1e1b4b;">जिला परिषद (4 वार्ड) दलीय स्थिति:</div>
                        <div style="font-size:12.5px; line-height:1.7;">
                            • <strong>BJP:</strong> ${zpTally.BJP?.won || 0} विजयी, ${zpTally.BJP?.lead || 0} में आगे<br>
                            • <strong>INC:</strong> ${zpTally.INC?.won || 0} विजयी, ${zpTally.INC?.lead || 0} में आगे<br>
                            • <strong>घोषित वार्ड:</strong> ${kpi.declaredWardsZP || 0} / 4 वार्ड
                        </div>
                    </div>
                </div>

                <div style="background:#f1f5f9; padding:10px 14px; border-left:4px solid #4f46e5; border-radius:4px; font-size:12px; margin-bottom:25px;">
                    यह बुलेटिन निर्वाचन अधिकारी कार्यालय द्वारा प्राधिकृत मतगणना प्रपत्रों एवं EVM कंट्रोल यूनिट सत्यापन उपरांत मीडिया तथा आमजन की त्वरित जानकारी हेतु जारी किया गया है।
                </div>

                <div class="report-sign-grid">
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">सहायक जनसंपर्क अधिकारी (PRO)</div>
                        <div class="report-sign-sub">सुमेरपुर, पाली</div>
                    </div>
                    <div class="report-sign-box">
                        <div class="report-sign-line"></div>
                        <div class="report-sign-title">रिटर्निंग ऑफिसर (RO)</div>
                        <div class="report-sign-sub">उपखंड मजिस्ट्रेट, सुमेरपुर</div>
                    </div>
                </div>
            </div>
        `;
    }

    return '';
}

// Download PDF Function using html2pdf with fallback to window.print
function downloadCurrentReportPDF() {
    const element = document.getElementById('reportPrintableDocument');
    if (!element) return;

    showToast('PDF संकलित की जा रही है...', 'कृपया प्रतीक्षा करें, दस्तावेज तैयार हो रहा है।', 'info', 3000);

    if (typeof html2pdf !== 'undefined') {
        const isLandscape = (currentReportType === 'master_matrix' || currentReportType === 'ps_form19' || currentReportType === 'zp_form19');
        const filename = `Sumerpur_${currentReportType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;

        const opt = {
            margin: [8, 8, 8, 8],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: isLandscape ? 'landscape' : 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            showToast('PDF डाउनलोड सफल!', `${filename} डाउनलोड हो गया है।`, 'success', 4000);
        }).catch(err => {
            console.error('PDF generation error:', err);
            showToast('प्रिंट डायलॉग खुला', 'कृपया Save as PDF चुनें।', 'info');
            window.print();
        });
    } else {
        window.print();
    }
}

function printCurrentReport() {
    window.print();
}

function exportCurrentReportExcel() {
    if (currentReportType === 'ps_form19') exportPSResultsExcel();
    else if (currentReportType === 'zp_form19') exportZPResultsExcel();
    else if (currentReportType === 'round_summary') exportCompleteMasterResultsExcel();
    else if (currentReportType === 'master_matrix') exportMatrixExcel();
    else if (currentReportType === 'postal_ballot_report') exportPostalBallotsExcel();
    else exportCompleteMasterResultsExcel();
}

// =============================================================
// OPERATOR 14-ROUND GOOGLE SHEET MASTER WORKBOOK GENERATOR
// =============================================================
function downloadOperatorWorkbook() {
    if (!window.XLSX || !countingData) {
        showToast('त्रुटि', 'Excel लाइब्रेरी लोड नहीं हो सकी।', 'error');
        return;
    }

    const wb = XLSX.utils.book_new();
    const slots = countingData.slots || {};
    const sortedSlots = Object.values(slots).sort((a, b) => Number(a.s_no) - Number(b.s_no));

    // Robust candidate lookups with fallback to ps_wards / zp_wards
    function getPsCandidates(wKey) {
        if (countingData.candidates && countingData.candidates[wKey] && countingData.candidates[wKey].length > 0) {
            return countingData.candidates[wKey];
        }
        if (countingData.ps_wards && countingData.ps_wards[wKey] && countingData.ps_wards[wKey].candidates) {
            return countingData.ps_wards[wKey].candidates;
        }
        return [];
    }

    function getZpCandidates(zKey) {
        if (countingData.zp_candidates && countingData.zp_candidates[zKey]) {
            const z = countingData.zp_candidates[zKey];
            const list = Array.isArray(z) ? z : (z.candidates || []);
            if (list.length > 0) return list;
        }
        if (countingData.zp_wards && countingData.zp_wards[zKey] && countingData.zp_wards[zKey].candidates) {
            return countingData.zp_wards[zKey].candidates;
        }
        return [];
    }

    // Helper functions for formula cells with cached value & type (avoids SheetJS dropping formula cells)
    function numForm(formula, defaultVal = 0) {
        return { f: formula, v: (typeof defaultVal === 'number' ? defaultVal : 0), t: 'n' };
    }
    function strForm(formula, defaultVal = '') {
        return { f: formula, v: String(defaultVal != null ? defaultVal : ''), t: 's' };
    }

    // =============================================================
    // SHEET 1: ROUND_WISE_ENTRY (राउंड-वार मुख्य डेटा प्रविष्टि - 152 बूथ)
    // Continuous rows: 1..15 (Round 1), 16..30 (Round 2), 31..45 (Round 3)...
    // AutoFilter enabled on Row 1 (ऑपरेटर 'राउंड' कॉलम पर फ़िल्टर से कोई भी राउंड चुन सकता है)
    // =============================================================
    const entryHeaders = [
        'क्र.सं.', 'राउंड', 'टेबल', 'बूथ नं.', 'सी.यू. नं. (CU ID)', 'ग्राम पंचायत', 'मतदान केंद्र भवन / स्थान', '17C कुल मत',
        'पं.स. वार्ड',
        'PS प्रत्याशी 1 [नाम व दल]', 'PS C1 मत',
        'PS प्रत्याशी 2 [नाम व दल]', 'PS C2 मत',
        'PS प्रत्याशी 3 [नाम व दल]', 'PS C3 मत',
        'PS प्रत्याशी 4/5 [नाम व दल]', 'PS C4/5 मत',
        'PS नोटा (NOTA)', 'PS कुल गिने मत', '17C मिलान जांच',
        'जि.प. वार्ड',
        'ZP प्रत्याशी 1 [नाम व दल]', 'ZP C1 मत',
        'ZP प्रत्याशी 2 [नाम व दल]', 'ZP C2 मत',
        'ZP प्रत्याशी 3 [नाम व दल]', 'ZP C3 मत',
        'ZP नोटा (NOTA)', 'जि.प. कुल गिने मत', 'जि.प. 17C मिलान',
        'स्थिति', 'टिप्पणी', 'LOOKUP_KEY'
    ];

    const entryRows = [entryHeaders];

    sortedSlots.forEach((s, idx) => {
        const rowNum = idx + 2; // Row number in Excel (header is row 1)
        const wKey = s.ps_ward || '';
        const zKey = s.zp_ward || '';
        const psList = getPsCandidates(wKey);
        const zpList = getZpCandidates(zKey);

        const psC1Name = psList[0] ? (psList[0].name + ' [' + psList[0].party + ']') : '-';
        const psC2Name = psList[1] ? (psList[1].name + ' [' + psList[1].party + ']') : '-';
        const psC3Name = psList[2] ? (psList[2].name + ' [' + psList[2].party + ']') : '-';
        const psC4Name = psList[3] ? (psList[3].name + ' [' + psList[3].party + ']') : (psList[4] ? (psList[4].name + ' [' + psList[4].party + ']') : '-');

        const zpC1Name = zpList[0] ? (zpList[0].name + ' [' + zpList[0].party + ']') : '-';
        const zpC2Name = zpList[1] ? (zpList[1].name + ' [' + zpList[1].party + ']') : '-';
        const zpC3Name = zpList[2] ? (zpList[2].name + ' [' + zpList[2].party + ']') : '-';

        // Live votes from slot
        const psC1Votes = (s.votes && s.votes.c1 != null) ? Number(s.votes.c1) : 0;
        const psC2Votes = (s.votes && s.votes.c2 != null) ? Number(s.votes.c2) : 0;
        const psC3Votes = (s.votes && s.votes.c3 != null) ? Number(s.votes.c3) : 0;
        const psC4Votes = (s.votes && s.votes.c4 != null) ? (Number(s.votes.c4) + Number(s.votes.c5 || 0)) : 0;
        const psNotaVotes = (s.votes && s.votes.nota != null) ? Number(s.votes.nota) : 0;
        const psTotalVotes = psC1Votes + psC2Votes + psC3Votes + psC4Votes + psNotaVotes;
        const polledVotes = Number(s.polled_votes) || 0;

        const psMatchCached = psTotalVotes === 0 ? '-' : (psTotalVotes === polledVotes ? '✓ OK (मिलान)' : ('अंतर: ' + (psTotalVotes - polledVotes)));

        const zpC1Votes = (s.zp_votes && s.zp_votes.c1 != null) ? Number(s.zp_votes.c1) : 0;
        const zpC2Votes = (s.zp_votes && s.zp_votes.c2 != null) ? Number(s.zp_votes.c2) : 0;
        const zpC3Votes = (s.zp_votes && s.zp_votes.c3 != null) ? Number(s.zp_votes.c3) : 0;
        const zpNotaVotes = (s.zp_votes && s.zp_votes.nota != null) ? Number(s.zp_votes.nota) : 0;
        const zpTotalVotes = zpC1Votes + zpC2Votes + zpC3Votes + zpNotaVotes;

        const zpMatchCached = zpTotalVotes === 0 ? '-' : (zpTotalVotes === polledVotes ? '✓ OK (मिलान)' : ('अंतर: ' + (zpTotalVotes - polledVotes)));

        const slotStatus = s.status || (psTotalVotes > 0 ? 'COMPLETED' : 'PENDING');
        const slotRemark = s.remark || '';

        entryRows.push([
            s.s_no,
            s.round,
            s.table,
            s.booth_no,
            s.cu_id || '',
            s.gp_name || '',
            s.location || '',
            polledVotes,
            wKey,
            psC1Name,
            psC1Votes,
            psC2Name,
            psC2Votes,
            psC3Name,
            psC3Votes,
            psC4Name,
            psC4Votes,
            psNotaVotes,
            numForm('K' + rowNum + '+M' + rowNum + '+O' + rowNum + '+Q' + rowNum + '+R' + rowNum, psTotalVotes),
            strForm('IF(S' + rowNum + '=0,"-",IF(S' + rowNum + '=H' + rowNum + ',"✓ OK (मिलान)","अंतर: "&(S' + rowNum + '-H' + rowNum + ')))', psMatchCached),
            zKey,
            zpC1Name,
            zpC1Votes,
            zpC2Name,
            zpC2Votes,
            zpC3Name,
            zpC3Votes,
            zpNotaVotes,
            numForm('W' + rowNum + '+Y' + rowNum + '+AA' + rowNum + '+AB' + rowNum, zpTotalVotes),
            strForm('IF(AC' + rowNum + '=0,"-",IF(AC' + rowNum + '=H' + rowNum + ',"✓ OK (मिलान)","अंतर: "&(AC' + rowNum + '-H' + rowNum + ')))', zpMatchCached),
            strForm('IF(S' + rowNum + '>0,"COMPLETED","PENDING")', slotStatus),
            slotRemark,
            s.round + '_' + s.table
        ]);
    });

    const wsEntry = XLSX.utils.aoa_to_sheet(entryRows);
    wsEntry['!autofilter'] = { ref: 'A1:AG153' };
    XLSX.utils.book_append_sheet(wb, wsEntry, 'ROUND_WISE_ENTRY');

    // =============================================================
    // SHEET 2: SYNC_MASTER (पोर्टल सिंक मास्टर - 152 बूथ)
    // =============================================================
    const syncHeaders = [
        'S.NO.', 'ROUND NO.', 'TABLE NO.', 'BOOTH NO.', 'CU ID', 'GP NAME', 'LOCATION',
        'PS WARD', 'ZP WARD', 'EVM POLLED (17C)',
        'PS C1', 'PS C2', 'PS C3', 'PS C4', 'PS C5', 'PS NOTA', 'PS TOTAL',
        'ZP C1', 'ZP C2', 'ZP C3', 'ZP NOTA', 'ZP TOTAL',
        'STATUS', 'REMARKS'
    ];

    const syncRows = [syncHeaders];
    sortedSlots.forEach((s, idx) => {
        const rowNum = idx + 2;
        const psC1Votes = (s.votes && s.votes.c1 != null) ? Number(s.votes.c1) : 0;
        const psC2Votes = (s.votes && s.votes.c2 != null) ? Number(s.votes.c2) : 0;
        const psC3Votes = (s.votes && s.votes.c3 != null) ? Number(s.votes.c3) : 0;
        const psC4Votes = (s.votes && s.votes.c4 != null) ? (Number(s.votes.c4) + Number(s.votes.c5 || 0)) : 0;
        const psNotaVotes = (s.votes && s.votes.nota != null) ? Number(s.votes.nota) : 0;
        const psTotalVotes = psC1Votes + psC2Votes + psC3Votes + psC4Votes + psNotaVotes;

        const zpC1Votes = (s.zp_votes && s.zp_votes.c1 != null) ? Number(s.zp_votes.c1) : 0;
        const zpC2Votes = (s.zp_votes && s.zp_votes.c2 != null) ? Number(s.zp_votes.c2) : 0;
        const zpC3Votes = (s.zp_votes && s.zp_votes.c3 != null) ? Number(s.zp_votes.c3) : 0;
        const zpNotaVotes = (s.zp_votes && s.zp_votes.nota != null) ? Number(s.zp_votes.nota) : 0;
        const zpTotalVotes = zpC1Votes + zpC2Votes + zpC3Votes + zpNotaVotes;

        const slotStatus = s.status || (psTotalVotes > 0 ? 'COMPLETED' : 'PENDING');
        const slotRemark = s.remark || '';

        syncRows.push([
            s.s_no,
            s.round,
            s.table,
            s.booth_no,
            s.cu_id || '',
            s.gp_name || '',
            s.location || '',
            s.ps_ward || '',
            s.zp_ward || '',
            s.polled_votes || 0,
            numForm('ROUND_WISE_ENTRY!K' + rowNum, psC1Votes),
            numForm('ROUND_WISE_ENTRY!M' + rowNum, psC2Votes),
            numForm('ROUND_WISE_ENTRY!O' + rowNum, psC3Votes),
            numForm('ROUND_WISE_ENTRY!Q' + rowNum, psC4Votes),
            0,
            numForm('ROUND_WISE_ENTRY!R' + rowNum, psNotaVotes),
            numForm('ROUND_WISE_ENTRY!S' + rowNum, psTotalVotes),
            numForm('ROUND_WISE_ENTRY!W' + rowNum, zpC1Votes),
            numForm('ROUND_WISE_ENTRY!Y' + rowNum, zpC2Votes),
            numForm('ROUND_WISE_ENTRY!AA' + rowNum, zpC3Votes),
            numForm('ROUND_WISE_ENTRY!AB' + rowNum, zpNotaVotes),
            numForm('ROUND_WISE_ENTRY!AC' + rowNum, zpTotalVotes),
            strForm('ROUND_WISE_ENTRY!AE' + rowNum, slotStatus),
            strForm('ROUND_WISE_ENTRY!AF' + rowNum, slotRemark)
        ]);
    });

    const wsSync = XLSX.utils.aoa_to_sheet(syncRows);
    XLSX.utils.book_append_sheet(wb, wsSync, 'SYNC_MASTER');

    // =============================================================
    // SHEET 3: SELECT_ROUND_VIEW (राउंड निरीक्षण व प्रमाणक दृश्य)
    // Standard INDEX-MATCH formulas with pre-populated Round 1 data
    // =============================================================
    const selectRoundRows = [
        ['सुमेरपुर पंचायती राज मतगणना - राउंड-वार टेबल दृश्य व प्रमाणक (Round Inspector View)'],
        ['राउंड नंबर चुनें या दर्ज करें (1 से 14):', 1, '', '← सेल B2 में 1 से 14 राउंड नंबर बदलें, सभी 16 टेबलें स्वतः अपडेट होंगी!'],
        [''],
        [
            'क्र.सं.', 'राउंड', 'टेबल', 'बूथ नं.', 'सी.यू. नं. (CU ID)', 'ग्राम पंचायत', 'मतदान केंद्र स्थान', '17C कुल मत',
            'पं.स. वार्ड', 'PS C1 प्रत्याशी', 'C1 मत', 'PS C2 प्रत्याशी', 'C2 मत', 'PS C3 प्रत्याशी', 'C3 मत',
            'PS C4 प्रत्याशी', 'C4 मत', 'PS नोटा', 'PS कुल मत', '17C मिलान',
            'जि.प. वार्ड', 'ZP C1 प्रत्याशी', 'ZP C1 मत', 'ZP C2 प्रत्याशी', 'ZP C2 मत', 'ZP C3 प्रत्याशी', 'ZP C3 मत',
            'ZP नोटा', 'जि.प. कुल मत', 'जि.प. मिलान', 'स्थिति', 'टिप्पणी'
        ]
    ];

    const round1Slots = sortedSlots.filter(s => Number(s.round) === 1).sort((a, b) => Number(a.table) - Number(b.table));
    let r1SumPolled = 0, r1SumPsC1 = 0, r1SumPsC2 = 0, r1SumPsC3 = 0, r1SumPsC4 = 0, r1SumPsNota = 0, r1SumPsTotal = 0;
    let r1SumZpC1 = 0, r1SumZpC2 = 0, r1SumZpC3 = 0, r1SumZpNota = 0, r1SumZpTotal = 0;

    for (let t = 1; t <= 16; t++) {
        const rIdx = t + 4; // Excel row 5 to 20
        const matchFormula = 'MATCH($B$2&"_"&' + t + ',ROUND_WISE_ENTRY!$AG$2:$AG$153,0)';

        const r1 = (t <= round1Slots.length) ? round1Slots[t - 1] : null;

        let dRound = 1, dBooth = '-', dCu = '-', dGp = '-', dLoc = '-', dPolled = 0;
        let dPsWard = '-', dPsC1Name = '-', dPsC1 = 0, dPsC2Name = '-', dPsC2 = 0, dPsC3Name = '-', dPsC3 = 0;
        let dPsC4Name = '-', dPsC4 = 0, dPsNota = 0, dPsTotal = 0, dPsMatch = '-';
        let dZpWard = '-', dZpC1Name = '-', dZpC1 = 0, dZpC2Name = '-', dZpC2 = 0, dZpC3Name = '-', dZpC3 = 0;
        let dZpNota = 0, dZpTotal = 0, dZpMatch = '-';
        let dStatus = 'PENDING', dRemark = '';

        if (r1) {
            dRound = Number(r1.round) || 1;
            dBooth = String(r1.booth_no || '');
            dCu = String(r1.cu_id || '');
            dGp = String(r1.gp_name || '');
            dLoc = String(r1.location || '');
            dPolled = Number(r1.polled_votes) || 0;
            dPsWard = String(r1.ps_ward || '');
            dZpWard = String(r1.zp_ward || '');

            const psList = getPsCandidates(dPsWard);
            const zpList = getZpCandidates(dZpWard);

            dPsC1Name = psList[0] ? (psList[0].name + ' [' + psList[0].party + ']') : '-';
            dPsC2Name = psList[1] ? (psList[1].name + ' [' + psList[1].party + ']') : '-';
            dPsC3Name = psList[2] ? (psList[2].name + ' [' + psList[2].party + ']') : '-';
            dPsC4Name = psList[3] ? (psList[3].name + ' [' + psList[3].party + ']') : (psList[4] ? (psList[4].name + ' [' + psList[4].party + ']') : '-');

            dZpC1Name = zpList[0] ? (zpList[0].name + ' [' + zpList[0].party + ']') : '-';
            dZpC2Name = zpList[1] ? (zpList[1].name + ' [' + zpList[1].party + ']') : '-';
            dZpC3Name = zpList[2] ? (zpList[2].name + ' [' + zpList[2].party + ']') : '-';

            dPsC1 = (r1.votes && r1.votes.c1 != null) ? Number(r1.votes.c1) : 0;
            dPsC2 = (r1.votes && r1.votes.c2 != null) ? Number(r1.votes.c2) : 0;
            dPsC3 = (r1.votes && r1.votes.c3 != null) ? Number(r1.votes.c3) : 0;
            dPsC4 = (r1.votes && r1.votes.c4 != null) ? (Number(r1.votes.c4) + Number(r1.votes.c5 || 0)) : 0;
            dPsNota = (r1.votes && r1.votes.nota != null) ? Number(r1.votes.nota) : 0;
            dPsTotal = dPsC1 + dPsC2 + dPsC3 + dPsC4 + dPsNota;
            dPsMatch = dPsTotal === 0 ? '-' : (dPsTotal === dPolled ? '✓ OK (मिलान)' : ('अंतर: ' + (dPsTotal - dPolled)));

            dZpC1 = (r1.zp_votes && r1.zp_votes.c1 != null) ? Number(r1.zp_votes.c1) : 0;
            dZpC2 = (r1.zp_votes && r1.zp_votes.c2 != null) ? Number(r1.zp_votes.c2) : 0;
            dZpC3 = (r1.zp_votes && r1.zp_votes.c3 != null) ? Number(r1.zp_votes.c3) : 0;
            dZpNota = (r1.zp_votes && r1.zp_votes.nota != null) ? Number(r1.zp_votes.nota) : 0;
            dZpTotal = dZpC1 + dZpC2 + dZpC3 + dZpNota;
            dZpMatch = dZpTotal === 0 ? '-' : (dZpTotal === dPolled ? '✓ OK (मिलान)' : ('अंतर: ' + (dZpTotal - dPolled)));

            dStatus = r1.status || (dPsTotal > 0 ? 'COMPLETED' : 'PENDING');
            dRemark = r1.remark || '';

            r1SumPolled += dPolled;
            r1SumPsC1 += dPsC1;
            r1SumPsC2 += dPsC2;
            r1SumPsC3 += dPsC3;
            r1SumPsC4 += dPsC4;
            r1SumPsNota += dPsNota;
            r1SumPsTotal += dPsTotal;
            r1SumZpC1 += dZpC1;
            r1SumZpC2 += dZpC2;
            r1SumZpC3 += dZpC3;
            r1SumZpNota += dZpNota;
            r1SumZpTotal += dZpTotal;
        }

        selectRoundRows.push([
            t,
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$B$2:$B$153,' + matchFormula + '),"-")', dRound),
            t,
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$D$2:$D$153,' + matchFormula + '),"-")', dBooth),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$E$2:$E$153,' + matchFormula + '),"-")', dCu),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$F$2:$F$153,' + matchFormula + '),"-")', dGp),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$G$2:$G$153,' + matchFormula + '),"-")', dLoc),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$H$2:$H$153,' + matchFormula + '),0)', dPolled),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$I$2:$I$153,' + matchFormula + '),"-")', dPsWard),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$J$2:$J$153,' + matchFormula + '),"-")', dPsC1Name),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$K$2:$K$153,' + matchFormula + '),0)', dPsC1),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$L$2:$L$153,' + matchFormula + '),"-")', dPsC2Name),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$M$2:$M$153,' + matchFormula + '),0)', dPsC2),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$N$2:$N$153,' + matchFormula + '),"-")', dPsC3Name),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$O$2:$O$153,' + matchFormula + '),0)', dPsC3),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$P$2:$P$153,' + matchFormula + '),"-")', dPsC4Name),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$Q$2:$Q$153,' + matchFormula + '),0)', dPsC4),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$R$2:$R$153,' + matchFormula + '),0)', dPsNota),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$S$2:$S$153,' + matchFormula + '),0)', dPsTotal),
            strForm('IF(H' + rIdx + '=0,"-",IF(S' + rIdx + '=H' + rIdx + ',"✓ OK (मिलान)","अंतर: "&(S' + rIdx + '-H' + rIdx + ')))', dPsMatch),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$U$2:$U$153,' + matchFormula + '),"-")', dZpWard),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$V$2:$V$153,' + matchFormula + '),"-")', dZpC1Name),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$W$2:$W$153,' + matchFormula + '),0)', dZpC1),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$X$2:$X$153,' + matchFormula + '),"-")', dZpC2Name),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$Y$2:$Y$153,' + matchFormula + '),0)', dZpC2),
            strForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$Z$2:$Z$153,' + matchFormula + '),"-")', dZpC3Name),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$AA$2:$AA$153,' + matchFormula + '),0)', dZpC3),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$AB$2:$AB$153,' + matchFormula + '),0)', dZpNota),
            numForm('IFERROR(INDEX(ROUND_WISE_ENTRY!$AC$2:$AC$153,' + matchFormula + '),0)', dZpTotal),
            strForm('IF(H' + rIdx + '=0,"-",IF(AC' + rIdx + '=H' + rIdx + ',"✓ OK (मिलान)","अंतर: "&(AC' + rIdx + '-H' + rIdx + ')))', dZpMatch),
            strForm('IF(S' + rIdx + '>0,"COMPLETED","PENDING")', dStatus),
            dRemark
        ]);
    }

    // Summary Row for Round Total
    const r1PsSummaryMatch = r1SumPsTotal === 0 ? '-' : (r1SumPsTotal === r1SumPolled ? '✓ राउंड मिलान पूर्ण' : ('अंतर: ' + (r1SumPsTotal - r1SumPolled)));
    const r1ZpSummaryMatch = r1SumZpTotal === 0 ? '-' : (r1SumZpTotal === r1SumPolled ? '✓ राउंड मिलान पूर्ण' : ('अंतर: ' + (r1SumZpTotal - r1SumPolled)));

    selectRoundRows.push([
        'कुल योग', '', '', '', '', '', 'इस राउंड का कुल योग:',
        numForm('SUM(H5:H20)', r1SumPolled),
        '', '',
        numForm('SUM(K5:K20)', r1SumPsC1), '',
        numForm('SUM(M5:M20)', r1SumPsC2), '',
        numForm('SUM(O5:O20)', r1SumPsC3), '',
        numForm('SUM(Q5:Q20)', r1SumPsC4),
        numForm('SUM(R5:R20)', r1SumPsNota),
        numForm('SUM(S5:S20)', r1SumPsTotal),
        strForm('IF(S21=0,"-",IF(S21=H21,"✓ राउंड मिलान पूर्ण","अंतर: "&(S21-H21)))', r1PsSummaryMatch),
        '', '',
        numForm('SUM(W5:W20)', r1SumZpC1), '',
        numForm('SUM(Y5:Y20)', r1SumZpC2), '',
        numForm('SUM(AA5:AA20)', r1SumZpC3),
        numForm('SUM(AB5:AB20)', r1SumZpNota),
        numForm('SUM(AC5:AC20)', r1SumZpTotal),
        strForm('IF(AC21=0,"-",IF(AC21=H21,"✓ राउंड मिलान पूर्ण","अंतर: "&(AC21-H21)))', r1ZpSummaryMatch),
        '', ''
    ]);

    const wsSelectRound = XLSX.utils.aoa_to_sheet(selectRoundRows);
    XLSX.utils.book_append_sheet(wb, wsSelectRound, 'SELECT_ROUND_VIEW');

    // =============================================================
    // SHEET 4: CANDIDATE_ROUNDWISE (प्रत्याशी-वार 14-राउंड संकलन)
    // =============================================================
    const candHeaders = [
        'चुनाव प्रकार', 'वार्ड क्र.', 'प्रत्याशी का नाम', 'पार्टी', 'चुनाव चिन्ह',
        'राउंड 1', 'राउंड 2', 'राउंड 3', 'राउंड 4', 'राउंड 5', 'राउंड 6', 'राउंड 7',
        'राउंड 8', 'राउंड 9', 'राउंड 10', 'राउंड 11', 'राउंड 12', 'राउंड 13', 'राउंड 14',
        'EVM कुल मत', 'डाक मत (PB)', 'महायोग (EVM+डाक)'
    ];

    const candRows = [candHeaders];
    let candRowNum = 2;

    // Helper to calculate EVM candidate votes per round from live data
    function getLiveCandRoundVotes(wardKey, candKey, roundNum, isZp = false) {
        return sortedSlots.filter(s => Number(s.round) === roundNum && (isZp ? s.zp_ward === wardKey : s.ps_ward === wardKey))
            .reduce((sum, s) => {
                const vObj = isZp ? s.zp_votes : s.votes;
                if (!vObj) return sum;
                if (candKey === 'c4_5') return sum + (Number(vObj.c4) || 0) + (Number(vObj.c5) || 0);
                return sum + (Number(vObj[candKey]) || 0);
            }, 0);
    }

    // PS Candidates
    for (let w = 1; w <= 21; w++) {
        const wKey = 'W-' + w;
        const cands = getPsCandidates(wKey);
        const pbWard = (countingData.postal_ballots && countingData.postal_ballots[wKey]) || {};
        const pbCandVotes = pbWard.candVotes || {};

        cands.forEach((c, cIdx) => {
            // In ROUND_WISE_ENTRY, C1 vote is K, C2 is M, C3 is O, C4 is Q
            const colLetter = cIdx === 0 ? 'K' : (cIdx === 1 ? 'M' : (cIdx === 2 ? 'O' : 'Q'));
            const candVoteKey = cIdx === 0 ? 'c1' : (cIdx === 1 ? 'c2' : (cIdx === 2 ? 'c3' : 'c4_5'));
            const row = [
                'पंचायत समिति',
                wKey,
                c.name,
                c.party || 'IND',
                c.symbol || '-'
            ];
            let evmSum = 0;
            for (let r = 1; r <= 14; r++) {
                const rVotes = getLiveCandRoundVotes(wKey, candVoteKey, r, false);
                evmSum += rVotes;
                row.push(numForm('SUMIFS(ROUND_WISE_ENTRY!' + colLetter + ':' + colLetter + ', ROUND_WISE_ENTRY!B:B, ' + r + ', ROUND_WISE_ENTRY!I:I, "' + wKey + '")', rVotes));
            }
            row.push(numForm('SUM(F' + candRowNum + ':S' + candRowNum + ')', evmSum));
            const pbVal = Number(pbCandVotes[c.key]) || 0;
            row.push(pbVal); // Postal Ballots live
            row.push(numForm('T' + candRowNum + '+U' + candRowNum, evmSum + pbVal));
            candRows.push(row);
            candRowNum++;
        });

        // PS NOTA row
        const notaRow = [
            'पंचायत समिति',
            wKey,
            'नोटा (NOTA)',
            'NOTA',
            '-'
        ];
        let notaSum = 0;
        for (let r = 1; r <= 14; r++) {
            const rVotes = getLiveCandRoundVotes(wKey, 'nota', r, false);
            notaSum += rVotes;
            notaRow.push(numForm('SUMIFS(ROUND_WISE_ENTRY!R:R, ROUND_WISE_ENTRY!B:B, ' + r + ', ROUND_WISE_ENTRY!I:I, "' + wKey + '")', rVotes));
        }
        notaRow.push(numForm('SUM(F' + candRowNum + ':S' + candRowNum + ')', notaSum));
        const pbNota = Number(pbCandVotes['nota']) || 0;
        notaRow.push(pbNota);
        notaRow.push(numForm('T' + candRowNum + '+U' + candRowNum, notaSum + pbNota));
        candRows.push(notaRow);
        candRowNum++;
    }

    // ZP Candidates
    ['Z-7', 'Z-8', 'Z-9', 'Z-10'].forEach(zKey => {
        const cands = getZpCandidates(zKey);
        const pbWard = (countingData.postal_ballots && countingData.postal_ballots[zKey]) || {};
        const pbCandVotes = pbWard.candVotes || {};

        cands.forEach((c, cIdx) => {
            // In ROUND_WISE_ENTRY, ZP C1 vote is W, C2 is Y, C3 is AA
            const colLetter = cIdx === 0 ? 'W' : (cIdx === 1 ? 'Y' : 'AA');
            const candVoteKey = cIdx === 0 ? 'c1' : (cIdx === 1 ? 'c2' : 'c3');
            const row = [
                'जिला परिषद',
                zKey,
                c.name,
                c.party || 'IND',
                c.symbol || '-'
            ];
            let evmSum = 0;
            for (let r = 1; r <= 14; r++) {
                const rVotes = getLiveCandRoundVotes(zKey, candVoteKey, r, true);
                evmSum += rVotes;
                row.push(numForm('SUMIFS(ROUND_WISE_ENTRY!' + colLetter + ':' + colLetter + ', ROUND_WISE_ENTRY!B:B, ' + r + ', ROUND_WISE_ENTRY!U:U, "' + zKey + '")', rVotes));
            }
            row.push(numForm('SUM(F' + candRowNum + ':S' + candRowNum + ')', evmSum));
            const pbVal = Number(pbCandVotes[c.key]) || 0;
            row.push(pbVal);
            row.push(numForm('T' + candRowNum + '+U' + candRowNum, evmSum + pbVal));
            candRows.push(row);
            candRowNum++;
        });

        // ZP NOTA row
        const notaRow = [
            'जिला परिषद',
            zKey,
            'नोटा (NOTA)',
            'NOTA',
            '-'
        ];
        let notaSum = 0;
        for (let r = 1; r <= 14; r++) {
            const rVotes = getLiveCandRoundVotes(zKey, 'nota', r, true);
            notaSum += rVotes;
            notaRow.push(numForm('SUMIFS(ROUND_WISE_ENTRY!AB:AB, ROUND_WISE_ENTRY!B:B, ' + r + ', ROUND_WISE_ENTRY!U:U, "' + zKey + '")', notaSum));
        }
        notaRow.push(numForm('SUM(F' + candRowNum + ':S' + candRowNum + ')', notaSum));
        const pbNota = Number(pbCandVotes['nota']) || 0;
        notaRow.push(pbNota);
        notaRow.push(numForm('T' + candRowNum + '+U' + candRowNum, notaSum + pbNota));
        candRows.push(notaRow);
        candRowNum++;
    });

    const wsCand = XLSX.utils.aoa_to_sheet(candRows);
    XLSX.utils.book_append_sheet(wb, wsCand, 'CANDIDATE_ROUNDWISE');

    // =============================================================
    // SHEET 5: HOW_TO_USE (उपयोग निर्देश)
    // =============================================================
    const guideRows = [
        ['सुमेरपुर पंचायती राज चुनाव 2026 - मतगणना Google Sheet ऑपरेटर निर्देशिका'],
        [''],
        ['क्रम', 'चरण', 'कार्य विवरण'],
        [1, 'Google Drive पर अपलोड', 'डाउनलोड की गई इस फाइल (.xlsx) को अपने Google Drive में अपलोड करें।'],
        [2, 'Google Sheets में खोलें', 'फाइल पर राइट-क्लिक करें और "Open with Google Sheets" चुनें।'],
        [3, 'शेयरिंग परमिशन सेट करें', 'ऊपर दाईं ओर नीला "Share" बटन दबाएं -> General access में "Anyone with the link" (Viewer) चुनें।'],
        [4, 'पोर्टल से लिंक करें', 'उस Google Sheet का लिंक कॉपी करके पोर्टल के टूल्स मेनू में "Google Sheet Sync" में पेस्ट करें।'],
        [5, 'मतगणना दिन प्रविष्टि', 'ऑपरेटर केवल "ROUND_WISE_ENTRY" शीट में टेबल-वार व राउंड-वार वोट दर्ज करेगा (1-15 राउंड 1, 16-30 राउंड 2...)।'],
        [6, 'राउंड चयन सुविधा (ऑटो-फ़िल्टर)', 'ऑपरेटर "ROUND_WISE_ENTRY" शीट में कॉलम B ("राउंड") के फ़िल्टर आइकन (▼) पर क्लिक करके केवल राउंड 1 या राउंड 2 चुन सकता है।'],
        [7, 'राउंड लाइव इंस्पेक्टर दृश्य', '"SELECT_ROUND_VIEW" शीट में सेल B2 में कोई भी राउंड नंबर (1 से 14) दर्ज करने पर उस राउंड की सभी टेबलें, कुल योग व 17C मिलान स्वतः लाइव दिखते हैं!'],
        [8, 'स्वतः सिंक व अपडेट', '"SYNC_MASTER" शीट में सभी सूत्र पहले से लगे हैं जो "ROUND_WISE_ENTRY" से स्वतः डेटा लेते हैं। पोर्टल पर "सिंक करें" दबाते ही सब लाइव हो जाएगा!'],
        [9, 'प्रत्याशी-वार राउंड डेटा', '"CANDIDATE_ROUNDWISE" शीट में प्रत्येक राउंड के बाद प्रत्याशी के मत स्वतः संकलित होते रहेंगे।'],
        [''],
        ['महत्वपूर्ण नोट:', 'SYNC_MASTER शीट के कॉलम या क्रम में कोई बदलाव न करें, ताकि पोर्टल सिंक 100% सुचारू रूप से कार्य करे।']
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
    XLSX.utils.book_append_sheet(wb, wsGuide, 'HOW_TO_USE');

    // Ensure full calculation on load
    wb.Workbook = {
        CalcPr: {
            fullCalcOnLoad: true
        }
    };

    // Download File
    XLSX.writeFile(wb, 'Sumerpur_Counting_Operator_Master_Template_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    showToast('मास्टर टेम्पलेट डाउनलोड सफल!', 'Sumerpur_Counting_Operator_Master_Template.xlsx सफलतापूर्वक डाउनलोड हो गया है।', 'success', 5000);
}

// =============================================================
// CLOUD PERSISTENCE & AUTO-RESTORE SHIELD (RENDER.COM COMPATIBLE)
// =============================================================

function saveLocalCountingSnapshot(data) {
    try {
        if (!data || !data.slots) return;
        const slots = Object.values(data.slots || {});
        const hasVotes = slots.some(s => (s.votes && Number(s.votes.total) > 0) || (s.zp_votes && Number(s.zp_votes.total) > 0));
        if (hasVotes) {
            localStorage.setItem('sumerpur_counting_local_backup', JSON.stringify({
                timestamp: new Date().toISOString(),
                savedAtText: new Date().toLocaleTimeString('en-IN') + ' (' + new Date().toLocaleDateString('en-IN') + ')',
                slotsCount: slots.length,
                totalCounted: data.kpi ? data.kpi.totalCounted : 0,
                slots: data.slots,
                postalBallot: data.postalBallot || null
            }));
        }
    } catch (e) {
        console.warn('Could not save local counting backup to localStorage:', e);
    }
}

function checkAndPromptLocalCountingRestore(currentData) {
    try {
        const raw = localStorage.getItem('sumerpur_counting_local_backup');
        if (!raw) return;
        const backup = JSON.parse(raw);
        if (!backup || !backup.slots) return;

        const currentSlots = Object.values(currentData.slots || {});
        const currentHasVotes = currentSlots.some(s => (s.votes && Number(s.votes.total) > 0) || (s.zp_votes && Number(s.zp_votes.total) > 0));

        // If server currently has 0 votes, but local backup has votes recorded
        if (!currentHasVotes && backup.totalCounted > 0) {
            showAutoRestoreNotificationBanner(backup);
        }
    } catch (e) {
        console.warn('Error checking local backup restore:', e);
    }
}

function showAutoRestoreNotificationBanner(backup) {
    if (document.getElementById('renderRestoreBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'renderRestoreBanner';
    banner.style.cssText = 'position:fixed; top:70px; left:50%; transform:translateX(-50%); width:94%; max-width:850px; background:#fef2f2; border:2px solid #ef4444; border-radius:12px; padding:14px 20px; z-index:999999; box-shadow:0 12px 30px rgba(239,68,68,0.25); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; animation:slideDown 0.3s ease;';
    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:280px;">
            <div style="width:38px; height:38px; border-radius:50%; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
                <i class="fas fa-triangle-exclamation"></i>
            </div>
            <div>
                <div style="font-weight:900; font-size:14px; color:#991b1b;">⚠️ सर्वर रीस्टार्ट / डेटा रीसेट डिटेक्ट हुआ!</div>
                <div style="font-size:12px; color:#b91c1c; margin-top:2px;">
                    सर्वर पर मत 0 हैं, लेकिन आपके ब्राउज़र में सुरक्षित बैकअप उपलब्ध है (दर्ज मत: <b>${backup.totalCounted}</b> • समय: ${backup.savedAtText})।
                </div>
            </div>
        </div>
        <div style="display:flex; gap:8px;">
            <button onclick="restoreFromLocalSnapshot()" style="background:#dc2626; color:#ffffff; border:none; padding:8px 16px; border-radius:8px; font-weight:800; font-size:12.5px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                <i class="fas fa-arrows-rotate"></i> तुरंत डेटा रीस्टोर करें
            </button>
            <button onclick="document.getElementById('renderRestoreBanner').remove()" style="background:#ffffff; color:#64748b; border:1px solid #cbd5e1; padding:8px 12px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">
                खारिज करें
            </button>
        </div>
    `;
    document.body.appendChild(banner);
}

async function restoreFromLocalSnapshot() {
    try {
        const raw = localStorage.getItem('sumerpur_counting_local_backup');
        if (!raw) return;
        const backup = JSON.parse(raw);
        showToast('डेटा रीस्टोर हो रहा है...', 'ब्राउज़र बैकअप से सर्वर पर डेटा भेजा जा रहा है...', 'info', 3000);

        const res = await fetch('/api/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                store: {
                    counting: {
                        slots: backup.slots,
                        postalBallot: backup.postalBallot
                    }
                }
            })
        });
        const result = await res.json();
        if (result.success) {
            showToast('सफलता!', 'डेटा सफलतापूर्वक सर्वर पर रीस्टोर हो गया!', 'success', 5000);
            const banner = document.getElementById('renderRestoreBanner');
            if (banner) banner.remove();
            await fetchCountingData(true);
        } else {
            showToast('रीस्टोर विफल', result.message || 'त्रुटि हुई', 'error', 5000);
        }
    } catch (e) {
        showToast('त्रुटि', e.message, 'error', 5000);
    }
}

// Modal UI Handlers for Counting Page
function openRestoreModal() {
    const modal = document.getElementById('restoreModal');
    if (modal) modal.style.display = 'flex';
}
function closeRestoreModal() {
    const modal = document.getElementById('restoreModal');
    if (modal) modal.style.display = 'none';
}

async function executeCountingRestore() {
    const fileInput = document.getElementById('countingRestoreFile');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('फ़ाइल चुनें', 'कृपया JSON बैकअप फ़ाइल का चयन करें।', 'warning', 4000);
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const parsed = JSON.parse(e.target.result);
            showToast('डेटा अपलोड हो रहा है...', 'सर्वर पर डेटा रीस्टोर किया जा रहा है...', 'info', 3000);
            const res = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store: parsed })
            });
            const result = await res.json();
            if (result.success) {
                showToast('रीस्टोर सफल!', result.message, 'success', 5000);
                closeRestoreModal();
                await fetchCountingData(true);
            } else {
                showToast('रीस्टोर त्रुटि', result.message || 'अमान्य डेटा', 'error', 5000);
            }
        } catch (err) {
            showToast('अमान्य JSON फ़ाइल', 'फ़ाइल को पार्स नहीं किया जा सका: ' + err.message, 'error', 5000);
        }
    };
    reader.readAsText(file);
}

function openCloudPersistenceModal() {
    const modal = document.getElementById('cloudPersistenceModal');
    const content = document.getElementById('cloudModalContent');
    if (modal) modal.style.display = 'flex';
    if (content) {
        content.innerHTML = '<i class="fas fa-spinner fa-spin"></i> स्थिति जांची जा रही है...';
        fetch('/api/system-status')
            .then(r => r.json())
            .then(data => {
                const p = data.persistence || {};
                const isCloud = p.isMongoConnected;
                content.innerHTML = `
                    <div style="background:${isCloud ? '#f0fdf4' : '#fffbeb'}; border:1.5px solid ${isCloud ? '#86efac' : '#fde68a'}; border-radius:10px; padding:14px; margin-bottom:14px;">
                        <div style="display:flex; align-items:center; gap:8px; font-weight:900; font-size:14px; color:${isCloud ? '#166534' : '#92400e'};">
                            <i class="fas ${isCloud ? 'fa-circle-check' : 'fa-circle-exclamation'}" style="color:${isCloud ? '#16a34a' : '#f59e0b'};"></i>
                            स्टोरेज मोड: ${isCloud ? 'MongoDB Atlas (क्लाउड सुरक्षित - परमानेंट)' : 'लोकल फ़ाइल मोड (Render पर स्लीप होने पर रीसेट हो सकता है)'}
                        </div>
                        <div style="font-size:12px; color:${isCloud ? '#15803d' : '#b45309'}; margin-top:4px;">
                            अंतिम डेटा सुरक्षित समय: <b>${p.lastSaved ? new Date(p.lastSaved).toLocaleTimeString('en-IN') : 'अभी'}</b>
                        </div>
                    </div>

                    ${isCloud ? `
                        <p style="color:#166534; font-weight:600;">
                            🎉 बधाई! आपका पोर्टल <b>MongoDB Atlas</b> से जुड़ा हुआ है। Render.com सर्वर स्लीप या रीस्टार्ट होने पर भी 1 भी वोट डिलीट नहीं होगा!
                        </p>
                    ` : `
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:12px;">
                            <b style="color:#0f172a;">Render.com पर डेटा सुरक्षित रखने के 3 आसान उपाय:</b>
                            <ol style="margin:8px 0 0 18px; padding:0; font-size:12px; line-height:1.7; color:#475569;">
                                <li><b>MongoDB Atlas (सर्वोत्तम):</b> Render Dashboard -> Environment Variables में <code>MONGODB_URI</code> जोड़ें (फ्री M0 क्लस्टर)।</li>
                                <li><b>1-क्लिक बैकअप डाउनलोड:</b> हर राउंड के बाद नीचे दिए गए बटन से बैकअप JSON डाउनलोड करके अपने फोन/लैपटॉप पर रख लें।</li>
                                <li><b>ब्राउज़र ऑटो-शील्ड:</b> आपके ब्राउज़र में डेटा का ऑटो-स्नैपशॉट रहता है; सर्वर रीस्टार्ट होने पर पोर्टल स्वतः 1-क्लिक रीस्टोर का विकल्प देगा।</li>
                            </ol>
                        </div>
                    `}
                `;
            })
            .catch(err => {
                content.innerHTML = `<div style="color:#ef4444;">सर्वर से कनेक्ट करने में त्रुटि: ${err.message}</div>`;
            });
    }
}
function closeCloudPersistenceModal() {
    const modal = document.getElementById('cloudPersistenceModal');
    if (modal) modal.style.display = 'none';
}
