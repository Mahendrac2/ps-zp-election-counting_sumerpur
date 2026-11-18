// counting.js - Sumerpur Panchayat Samiti Election Counting System 2026
// 14 Rounds x 15 Tables x 21 PS Wards x 152 Booths

let countingData = null;
let selectedCountingRound = 1;
let countingSubtab = 'round_cards'; // 'round_cards', 'ward_results', 'master_matrix', 'manual_entry'
let countingAutoSyncTimer = null;
let isCountingWarRoomOpen = false;
let countingWarRoomView = 'wards'; // 'wards', 'current_round', 'tally'
let countingWarRoomTimer = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchCountingData();
});

// Fetch counting state from backend
async function fetchCountingData() {
    try {
        const res = await fetch('/api/counting');
        const data = await res.json();
        if (data.success) {
            countingData = data;
            // Set default selected round to active round
            if (data.kpi && data.kpi.activeRound && selectedCountingRound === 1 && data.kpi.activeRound > 1) {
                selectedCountingRound = data.kpi.activeRound;
            }
            if (currentTab === 'counting') {
                renderCountingTab();
            }
            if (isCountingWarRoomOpen) {
                renderCountingWarRoom();
            }
        }
    } catch (err) {
        console.error('Error fetching counting data:', err);
    }
}

// Switch Sub-tabs inside Counting view
function switchCountingSubtab(tab) {
    countingSubtab = tab;
    document.querySelectorAll('.counting-subtab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-subtab') === tab);
    });
    renderCountingActiveSubtab();
}

// Main render function for Counting tab
function renderCountingTab() {
    if (!countingData) {
        fetchCountingData();
        return;
    }
    renderCountingKPIs();
    renderCountingActiveSubtab();
}

// Render Top KPI Summary Bar
function renderCountingKPIs() {
    const k = countingData.kpi || {};
    const pt = k.partyTally || { BJP: { won: 0, lead: 0 }, INC: { won: 0, lead: 0 }, IND: { won: 0, lead: 0 } };

    const elActiveRound = document.getElementById('countingKpiActiveRound');
    if (elActiveRound) elActiveRound.textContent = `राउंड ${k.activeRound || 1} / ${k.totalRounds || 14}`;

    const elCountedBooths = document.getElementById('countingKpiCountedBooths');
    if (elCountedBooths) elCountedBooths.textContent = `${k.totalCompletedBooths || 0} / ${k.totalBooths || 152} (${k.progressPct || 0}%)`;

    const elTotalVotes = document.getElementById('countingKpiTotalVotes');
    if (elTotalVotes) elTotalVotes.textContent = (k.totalCountedVotes || 0).toLocaleString('en-IN');

    const elDeclaredWards = document.getElementById('countingKpiDeclaredWards');
    if (elDeclaredWards) elDeclaredWards.textContent = `${k.declaredWards || 0} / ${k.totalWards || 21}`;

    // Party Tally
    const elBjp = document.getElementById('countingTallyBjp');
    if (elBjp) elBjp.innerHTML = `<b>${(pt.BJP?.won || 0) + (pt.BJP?.lead || 0)}</b> <span style="font-size:11px; opacity:0.8;">(जीत: ${pt.BJP?.won || 0} | आगे: ${pt.BJP?.lead || 0})</span>`;

    const elInc = document.getElementById('countingTallyInc');
    if (elInc) elInc.innerHTML = `<b>${(pt.INC?.won || 0) + (pt.INC?.lead || 0)}</b> <span style="font-size:11px; opacity:0.8;">(जीत: ${pt.INC?.won || 0} | आगे: ${pt.INC?.lead || 0})</span>`;

    const elInd = document.getElementById('countingTallyInd');
    if (elInd) elInd.innerHTML = `<b>${(pt.IND?.won || 0) + (pt.IND?.lead || 0)}</b> <span style="font-size:11px; opacity:0.8;">(जीत: ${pt.IND?.won || 0} | आगे: ${pt.IND?.lead || 0})</span>`;

    // Progress bar
    const elBar = document.getElementById('countingProgressBar');
    if (elBar) elBar.style.width = `${k.progressPct || 0}%`;
}

// Render the active sub-tab view
function renderCountingActiveSubtab() {
    ['round_cards', 'ward_results', 'master_matrix', 'manual_entry'].forEach(t => {
        const el = document.getElementById(`countingView_${t}`);
        if (el) el.style.display = (countingSubtab === t) ? 'block' : 'none';
    });

    if (countingSubtab === 'round_cards') renderCountingRoundCards();
    else if (countingSubtab === 'ward_results') renderCountingWardResults();
    else if (countingSubtab === 'master_matrix') renderCountingMasterMatrix();
    else if (countingSubtab === 'manual_entry') renderCountingManualEntry();
}

// -------------------------------------------------------------
// SUB-TAB 1: ROUND-BY-ROUND 15 TABLES CARDS
// -------------------------------------------------------------
function selectCountingRound(r) {
    selectedCountingRound = r;
    renderCountingRoundCards();
}

function renderCountingRoundCards() {
    if (!countingData) return;
    const rounds = countingData.rounds || {};
    const slots = countingData.slots || {};

    // 1. Render Round Selector Pills (1 to 14)
    const pillsContainer = document.getElementById('countingRoundPills');
    if (pillsContainer) {
        let pillsHtml = '';
        for (let r = 1; r <= 14; r++) {
            const rData = rounds[r] || { status: 'PENDING', completedTables: 0 };
            const isActive = (r === selectedCountingRound);
            let statusIcon = '⚪';
            let pillClass = 'status-pending';

            if (rData.status === 'COMPLETED' || rData.completedTables === 15) {
                statusIcon = '🟢';
                pillClass = 'status-completed';
            } else if (rData.status === 'COUNTING' || rData.completedTables > 0) {
                statusIcon = '🟡';
                pillClass = 'status-counting';
            }

            pillsHtml += `
                <button class="counting-round-pill ${isActive ? 'active' : ''} ${pillClass}" onclick="selectCountingRound(${r})">
                    <span class="round-num">राउंड ${r}</span>
                    <span class="round-status-tag">${statusIcon} ${rData.completedTables || 0}/15 मेज</span>
                </button>
            `;
        }
        pillsContainer.innerHTML = pillsHtml;
    }

    // 2. Round Summary Header
    const curRoundData = rounds[selectedCountingRound] || { completedTables: 0, totalVotes: 0, status: 'PENDING' };
    const rSummary = document.getElementById('countingSelectedRoundSummary');
    if (rSummary) {
        let statusBadge = `<span class="badge-status-pending">⚪ प्रतीक्षारत</span>`;
        if (curRoundData.status === 'COMPLETED' || curRoundData.completedTables === 15) {
            statusBadge = `<span class="badge-status-completed">🟢 पूर्ण (15/15 मेज)</span>`;
        } else if (curRoundData.status === 'COUNTING' || curRoundData.completedTables > 0) {
            statusBadge = `<span class="badge-status-counting">🟡 मतगणना प्रगति पर (${curRoundData.completedTables}/15)</span>`;
        }

        rSummary.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <h3 style="margin:0; font-size:18px; color:#0f172a; font-weight:800;">
                        <i class="fas fa-layer-group" style="color:#6366f1;"></i> राउंड ${selectedCountingRound} विवरण
                    </h3>
                    ${statusBadge}
                </div>
                <div style="display:flex; align-items:center; gap:16px; font-size:13px; font-weight:700;">
                    <span style="color:#475569;">पूर्ण मेज: <b style="color:#0f172a;">${curRoundData.completedTables || 0} / 15</b></span>
                    <span style="color:#475569;">गिने गए मत: <b style="color:#0f172a;">${(curRoundData.totalVotes || 0).toLocaleString('en-IN')}</b></span>
                    <button class="btn-secondary" style="padding:5px 10px; font-size:12px;" onclick="openRoundWhatsAppBulletin(${selectedCountingRound})">
                        <i class="fab fa-whatsapp" style="color:#16a34a;"></i> राउंड ${selectedCountingRound} बुलेटिन
                    </button>
                </div>
            </div>
        `;
    }

    // 3. Render 15 Table Cards Grid
    const cardsContainer = document.getElementById('countingTableCardsGrid');
    if (!cardsContainer) return;

    let cardsHtml = '';
    for (let t = 1; t <= 15; t++) {
        const slotKey = `${selectedCountingRound}_${t}`;
        const s = slots[slotKey] || {
            round: selectedCountingRound,
            table: t,
            booth_no: '',
            ps_ward: '',
            gp_name: 'आरक्षित',
            electors: 0,
            votes: { cand1: 0, cand2: 0, cand3: 0, nota: 0, total: 0 },
            status: 'PENDING'
        };

        const v = s.votes || { cand1: 0, cand2: 0, cand3: 0, nota: 0, total: 0 };
        const tot = Number(v.total) || 0;
        const wInfo = countingData.wards[s.ps_ward] || {};
        const candList = wInfo.candidates || [
            { key: 'cand1', name: 'प्रत्याशी 1 (भाजपा)', party: 'BJP' },
            { key: 'cand2', name: 'प्रत्याशी 2 (कांग्रेस)', party: 'INC' },
            { key: 'cand3', name: 'प्रत्याशी 3 (निर्दलीय)', party: 'IND' }
        ];

        // Determine leader in this booth
        const candVotesArray = [
            { name: candList[0]?.name || 'भाजपा', party: 'BJP', votes: v.cand1 || 0 },
            { name: candList[1]?.name || 'कांग्रेस', party: 'INC', votes: v.cand2 || 0 },
            { name: candList[2]?.name || 'निर्दलीय', party: 'IND', votes: v.cand3 || 0 }
        ].sort((a, b) => b.votes - a.votes);

        const leader = candVotesArray[0];
        const runner = candVotesArray[1] || { votes: 0 };
        const margin = (leader.votes || 0) - (runner.votes || 0);

        let statusClass = 'pending';
        let statusText = '⚪ प्रतीक्षारत';
        if (s.status === 'COMPLETED' || tot > 0) {
            statusClass = 'completed';
            statusText = '🟢 पूर्ण';
        } else if (s.status === 'COUNTING') {
            statusClass = 'counting';
            statusText = '🟡 गणना जारी';
        }

        cardsHtml += `
            <div class="counting-table-card ${statusClass}">
                <div class="card-head">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="table-badge">मेज ${t}</span>
                        ${s.booth_no ? `<span class="booth-badge" title="मतदान केंद्र संख्या">बूथ ${s.booth_no}</span>` : '<span class="booth-badge-reserved">आरक्षित / डाक</span>'}
                        ${s.ps_ward ? `<span class="ward-badge">${s.ps_ward}</span>` : ''}
                    </div>
                    <span class="status-tag ${statusClass}">${statusText}</span>
                </div>

                <div class="card-meta">
                    <div class="meta-title" title="${s.location || s.gp_name || ''}">${s.gp_name || 'विशेष गणना मेज'}</div>
                    <div class="meta-sub">कुल मतदाता: <b>${(s.electors || 0).toLocaleString('en-IN')}</b></div>
                </div>

                <div class="card-votes-list">
                    <div class="vote-row bjp">
                        <span class="cand-label"><i class="fas fa-sun" style="color:#ea580c;"></i> ${candList[0]?.name || 'भाजपा'}</span>
                        <div class="vote-bar-box">
                            <div class="vote-bar" style="width:${tot > 0 ? ((v.cand1 / tot) * 100) : 0}%; background:#ea580c;"></div>
                        </div>
                        <span class="cand-val">${v.cand1 || 0}</span>
                    </div>

                    <div class="vote-row inc">
                        <span class="cand-label"><i class="fas fa-hand" style="color:#0284c7;"></i> ${candList[1]?.name || 'कांग्रेस'}</span>
                        <div class="vote-bar-box">
                            <div class="vote-bar" style="width:${tot > 0 ? ((v.cand2 / tot) * 100) : 0}%; background:#0284c7;"></div>
                        </div>
                        <span class="cand-val">${v.cand2 || 0}</span>
                    </div>

                    <div class="vote-row ind">
                        <span class="cand-label"><i class="fas fa-user" style="color:#9333ea;"></i> ${candList[2]?.name || 'निर्दलीय'}</span>
                        <div class="vote-bar-box">
                            <div class="vote-bar" style="width:${tot > 0 ? ((v.cand3 / tot) * 100) : 0}%; background:#9333ea;"></div>
                        </div>
                        <span class="cand-val">${v.cand3 || 0}</span>
                    </div>

                    <div class="vote-row nota">
                        <span class="cand-label"><i class="fas fa-ban" style="color:#64748b;"></i> नोटा (NOTA)</span>
                        <div class="vote-bar-box">
                            <div class="vote-bar" style="width:${tot > 0 ? ((v.nota / tot) * 100) : 0}%; background:#64748b;"></div>
                        </div>
                        <span class="cand-val">${v.nota || 0}</span>
                    </div>
                </div>

                <div class="card-foot">
                    <div class="foot-total">
                        <span>कुल गिने गए मत:</span>
                        <b>${tot.toLocaleString('en-IN')}</b>
                    </div>
                    ${tot > 0 && leader.votes > 0 ? `
                        <div class="foot-lead" title="अग्रणी प्रत्याशी">
                            <i class="fas fa-arrow-trend-up"></i> ${leader.name}: <b>+${margin}</b> मतों से आगे
                        </div>
                    ` : ''}
                    <button class="btn-card-edit" onclick="openEditSlotModal(${selectedCountingRound}, ${t})">
                        <i class="fas fa-pencil"></i> मत दर्ज / संपादित करें
                    </button>
                </div>
            </div>
        `;
    }
    cardsContainer.innerHTML = cardsHtml;
}

// -------------------------------------------------------------
// SUB-TAB 2: 21 PS WARD RESULTS & SUMMARY TABLE
// -------------------------------------------------------------
function renderCountingWardResults() {
    if (!countingData) return;
    const wards = countingData.wards || {};
    const tbody = document.getElementById('countingWardResultsTbody');
    if (!tbody) return;

    let rowsHtml = '';
    for (let w = 1; w <= 21; w++) {
        const wKey = `W-${w}`;
        const wm = wards[wKey] || {
            ward: wKey,
            totalBooths: 0,
            completedBooths: 0,
            totalElectors: 0,
            totalVotes: 0,
            candVotes: { cand1: 0, cand2: 0, cand3: 0, nota: 0 },
            candidates: [],
            leader: { name: '-', party: '-', votes: 0 },
            runnerUp: { name: '-', party: '-', votes: 0 },
            margin: 0,
            status: 'PENDING'
        };

        const cand1Votes = wm.candVotes.cand1 || 0;
        const cand2Votes = wm.candVotes.cand2 || 0;
        const cand3Votes = wm.candVotes.cand3 || 0;
        const notaVotes = wm.candVotes.nota || 0;
        const totalVotes = wm.totalVotes || 0;

        let statusBadge = `<span class="status-pill pending">⚪ प्रतीक्षारत</span>`;
        if (wm.status === 'DECLARED') {
            statusBadge = `<span class="status-pill declared">🟢 विजयी घोषित</span>`;
        } else if (wm.status === 'COUNTING') {
            statusBadge = `<span class="status-pill counting">🟡 प्रगति पर (${wm.completedBooths}/${wm.totalBooths})</span>`;
        }

        let leaderHtml = '-';
        if (wm.completedBooths > 0 && wm.leader && wm.leader.votes > 0) {
            let pColor = '#64748b';
            if (wm.leader.party === 'BJP') pColor = '#ea580c';
            else if (wm.leader.party === 'INC') pColor = '#0284c7';
            else if (wm.leader.party === 'IND') pColor = '#9333ea';

            leaderHtml = `
                <div style="font-weight:700; color:${pColor}; display:flex; align-items:center; gap:6px;">
                    <span class="party-tag" style="background:${pColor}15; color:${pColor}; border:1px solid ${pColor}30;">${wm.leader.party}</span>
                    <span>${wm.leader.name}</span>
                </div>
            `;
        }

        const marginHtml = (wm.completedBooths > 0 && wm.margin > 0) ? `
            <span style="font-weight:800; color:#15803d; background:#ecfdf5; padding:3px 8px; border-radius:6px; border:1px solid #bbf7d0;">
                +${wm.margin.toLocaleString('en-IN')} मत
            </span>
        ` : (wm.completedBooths > 0 ? '<span style="color:#64748b;">बराबर</span>' : '-');

        rowsHtml += `
            <tr>
                <td style="font-weight:800; text-align:center; color:#1e1b4b; background:#f8fafc;">
                    <span style="font-size:14px; background:#e0e7ff; color:#3730a3; padding:4px 9px; border-radius:6px; border:1px solid #c7d2fe;">${wKey}</span>
                </td>
                <td style="text-align:center; font-weight:700;">
                    ${wm.completedBooths} / ${wm.totalBooths}
                    <div style="width:100%; height:4px; background:#e2e8f0; border-radius:2px; margin-top:4px; overflow:hidden;">
                        <div style="width:${wm.totalBooths > 0 ? ((wm.completedBooths / wm.totalBooths) * 100) : 0}%; height:100%; background:#10b981;"></div>
                    </div>
                </td>
                <td style="text-align:right; font-weight:700;">${(wm.totalElectors || 0).toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:800; color:#0f172a;">${totalVotes.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:700; color:#ea580c; background:#fffaf5;">${cand1Votes.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:700; color:#0284c7; background:#f0f9ff;">${cand2Votes.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:700; color:#9333ea; background:#faf5ff;">${cand3Votes.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:600; color:#64748b;">${notaVotes.toLocaleString('en-IN')}</td>
                <td>${leaderHtml}</td>
                <td style="text-align:center;">${marginHtml}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center;">
                    <button class="btn-secondary" style="padding:4px 8px; font-size:11.5px;" onclick="openWardBoothsModal('${wKey}')" title="इस वार्ड के सभी बूथ देखें">
                        <i class="fas fa-list-ol"></i> बूथ
                    </button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = rowsHtml;
}

// -------------------------------------------------------------
// SUB-TAB 3: 15 TABLES x 14 ROUNDS MASTER COUNTING MATRIX
// -------------------------------------------------------------
function renderCountingMasterMatrix() {
    if (!countingData) return;
    const slots = countingData.slots || {};
    const thead = document.getElementById('countingMatrixThead');
    const tbody = document.getElementById('countingMatrixTbody');
    if (!thead || !tbody) return;

    // Head
    let headHtml = '<tr><th style="position:sticky; left:0; z-index:20; background:#1e1b4b; color:#ffffff; min-width:80px; text-align:center;">राउंड</th>';
    for (let t = 1; t <= 15; t++) {
        headHtml += `<th style="text-align:center; min-width:110px;">मेज ${t}</th>`;
    }
    headHtml += '</tr>';
    thead.innerHTML = headHtml;

    // Body: 14 Rounds (Rows)
    let bodyHtml = '';
    for (let r = 1; r <= 14; r++) {
        bodyHtml += `<tr>`;
        bodyHtml += `
            <td style="position:sticky; left:0; z-index:10; background:#f8fafc; font-weight:800; text-align:center; color:#1e1b4b; border-right:2px solid #cbd5e1;">
                राउंड ${r}
            </td>
        `;

        for (let t = 1; t <= 15; t++) {
            const slotKey = `${r}_${t}`;
            const s = slots[slotKey] || {};
            const tot = s.votes ? Number(s.votes.total) || 0 : 0;
            let cellClass = 'matrix-pending';
            let statusText = 'प्रतीक्षारत';

            if (s.status === 'COMPLETED' || tot > 0) {
                cellClass = 'matrix-completed';
                statusText = `${tot} मत`;
            } else if (s.status === 'COUNTING') {
                cellClass = 'matrix-counting';
                statusText = 'गणना जारी';
            }

            bodyHtml += `
                <td class="matrix-cell ${cellClass}" onclick="openEditSlotModal(${r}, ${t})" title="राउंड ${r} - मेज ${t} | बूथ ${s.booth_no || 'आरक्षित'} | क्लिक कर मत देखें/संपादित करें">
                    <div class="m-booth">${s.booth_no ? `बूथ ${s.booth_no}` : 'आरक्षित'}</div>
                    <div class="m-ward">${s.ps_ward || '-'}</div>
                    <div class="m-votes">${statusText}</div>
                </td>
            `;
        }
        bodyHtml += `</tr>`;
    }
    tbody.innerHTML = bodyHtml;
}

// -------------------------------------------------------------
// SUB-TAB 4: QUICK MANUAL ENTRY FORM
// -------------------------------------------------------------
function renderCountingManualEntry() {
    if (!countingData) return;
    const rSelect = document.getElementById('manualRoundSelect');
    const tSelect = document.getElementById('manualTableSelect');
    if (!rSelect || !tSelect) return;

    // Fill round options 1 to 14 if empty
    if (rSelect.options.length === 0) {
        for (let r = 1; r <= 14; r++) {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = `राउंड ${r}`;
            rSelect.appendChild(opt);
        }
        rSelect.value = selectedCountingRound;
    }

    // Fill table options 1 to 15 if empty
    if (tSelect.options.length === 0) {
        for (let t = 1; t <= 15; t++) {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = `मेज ${t} (Table ${t})`;
            tSelect.appendChild(opt);
        }
        tSelect.value = 1;
    }

    onManualSlotChange();
}

function onManualSlotChange() {
    if (!countingData) return;
    const r = Number(document.getElementById('manualRoundSelect').value) || 1;
    const t = Number(document.getElementById('manualTableSelect').value) || 1;
    const slotKey = `${r}_${t}`;
    const s = countingData.slots[slotKey] || {};
    const v = s.votes || {};

    const elBooth = document.getElementById('manualSlotBooth');
    const elWard = document.getElementById('manualSlotWard');
    const elGp = document.getElementById('manualSlotGp');
    const elElectors = document.getElementById('manualSlotElectors');

    if (elBooth) elBooth.textContent = s.booth_no ? `बूथ नं. ${s.booth_no}` : 'आरक्षित / डाक मतपत्र';
    if (elWard) elWard.textContent = s.ps_ward || 'सामान्य';
    if (elGp) elGp.textContent = s.gp_name || '-';
    if (elElectors) elElectors.textContent = (s.electors || 0).toLocaleString('en-IN');

    // Candidates
    const wInfo = countingData.wards[s.ps_ward] || {};
    const candList = wInfo.candidates || [
        { key: 'cand1', name: 'प्रत्याशी 1 (भाजपा)', party: 'BJP' },
        { key: 'cand2', name: 'प्रत्याशी 2 (कांग्रेस)', party: 'INC' },
        { key: 'cand3', name: 'प्रत्याशी 3 (निर्दलीय)', party: 'IND' }
    ];

    const l1 = document.getElementById('manualLabelCand1');
    const l2 = document.getElementById('manualLabelCand2');
    const l3 = document.getElementById('manualLabelCand3');
    if (l1) l1.textContent = candList[0]?.name || 'भाजपा प्रत्याशी';
    if (l2) l2.textContent = candList[1]?.name || 'कांग्रेस प्रत्याशी';
    if (l3) l3.textContent = candList[2]?.name || 'निर्दलीय प्रत्याशी';

    document.getElementById('manualInputCand1').value = v.cand1 || 0;
    document.getElementById('manualInputCand2').value = v.cand2 || 0;
    document.getElementById('manualInputCand3').value = v.cand3 || 0;
    document.getElementById('manualInputNota').value = v.nota || 0;
    document.getElementById('manualInputRemark').value = s.remark || '';

    calcManualTotal();
}

function calcManualTotal() {
    const c1 = Number(document.getElementById('manualInputCand1').value) || 0;
    const c2 = Number(document.getElementById('manualInputCand2').value) || 0;
    const c3 = Number(document.getElementById('manualInputCand3').value) || 0;
    const nt = Number(document.getElementById('manualInputNota').value) || 0;
    const tot = c1 + c2 + c3 + nt;

    const elTot = document.getElementById('manualTotalVotesDisplay');
    if (elTot) elTot.textContent = tot.toLocaleString('en-IN');
}

async function saveManualCountingSlot() {
    const r = Number(document.getElementById('manualRoundSelect').value);
    const t = Number(document.getElementById('manualTableSelect').value);
    const c1 = Number(document.getElementById('manualInputCand1').value) || 0;
    const c2 = Number(document.getElementById('manualInputCand2').value) || 0;
    const c3 = Number(document.getElementById('manualInputCand3').value) || 0;
    const nt = Number(document.getElementById('manualInputNota').value) || 0;
    const remark = document.getElementById('manualInputRemark').value.trim();

    try {
        const res = await fetch('/api/counting/slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                round: r,
                table: t,
                cand1: c1,
                cand2: c2,
                cand3: c3,
                nota: nt,
                remark,
                status: (c1 + c2 + c3 + nt > 0) ? 'COMPLETED' : 'PENDING'
            })
        });

        const data = await res.json();
        if (data.success) {
            countingData = data;
            showToast('सफलता', `राउंड ${r} - मेज ${t} का मत विवरण सुरक्षित किया गया।`, 'success', 3000);
            renderCountingTab();
            // Advance to next table
            if (t < 15) {
                document.getElementById('manualTableSelect').value = t + 1;
                onManualSlotChange();
            }
        } else {
            showToast('त्रुटि', data.message || 'सुरक्षित करने में विफल', 'error', 4000);
        }
    } catch (err) {
        showToast('त्रुटि', err.message, 'error', 4000);
    }
}

// -------------------------------------------------------------
// GOOGLE SHEET AUTO-SYNC FOR COUNTING
// -------------------------------------------------------------
async function triggerCountingGoogleSheetSync() {
    const btnSync = document.getElementById('btnCountingSyncGoogle');
    if (btnSync) {
        btnSync.classList.add('spinning');
        btnSync.disabled = true;
    }

    const statusEl = document.getElementById('countingSyncStatusText');
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#6366f1;"></i> Google Sheet से मतगणना डेटा सिंक हो रहा है...';

    try {
        const res = await fetch('/api/counting/sync-google-sheet');
        const data = await res.json();

        if (data.success) {
            countingData = data;
            showToast('Google Sheet सिंक सफल!', data.message || 'मतगणना डेटा सफलतापूर्वक सिंक हुआ!', 'success', 5000);
            if (statusEl) statusEl.innerHTML = `<i class="fas fa-circle-check" style="color:#16a34a;"></i> सिंक सफल (${data.updatedCount} प्रविष्टियां अपडेट)`;
            renderCountingTab();
        } else if (data.error === 'UNAUTHORIZED') {
            showToast('परमिशन आवश्यक', data.message, 'warning', 7000);
            openCountingSheetModal();
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-triangle-exclamation" style="color:#f59e0b;"></i> शीट परमिशन आवश्यक (Share -> Anyone with link)';
        } else {
            showToast('सिंक त्रुटि', data.message || 'कनेक्ट नहीं हो सका', 'error', 5000);
            if (statusEl) statusEl.innerHTML = `<i class="fas fa-circle-xmark" style="color:#ef4444;"></i> सिंक विफल (${data.error || 'Error'})`;
        }
    } catch (err) {
        showToast('कनेक्शन त्रुटि', err.message, 'error', 4000);
        if (statusEl) statusEl.innerHTML = `<i class="fas fa-circle-xmark" style="color:#ef4444;"></i> नेटवर्क त्रुटि`;
    } finally {
        if (btnSync) {
            btnSync.classList.remove('spinning');
            btnSync.disabled = false;
        }
    }
}

function toggleCountingAutoSync(enabled) {
    if (countingAutoSyncTimer) {
        clearInterval(countingAutoSyncTimer);
        countingAutoSyncTimer = null;
    }

    if (enabled) {
        showToast('ऑटो-सिंक चालू', 'प्रत्येक 30 सेकंड में Google Sheet से मतगणना डेटा स्वतः सिंक होगा।', 'info', 4000);
        triggerCountingGoogleSheetSync();
        countingAutoSyncTimer = setInterval(() => {
            triggerCountingGoogleSheetSync();
        }, 30000);
    } else {
        showToast('ऑटो-सिंक बंद', 'स्वचालित सिंक रोक दिया गया है।', 'info', 2500);
    }
}

// -------------------------------------------------------------
// GOOGLE SHEET SETTINGS MODAL
// -------------------------------------------------------------
function openCountingSheetModal() {
    const modal = document.getElementById('countingSheetSettingsModal');
    if (!modal) return;
    const cfg = countingData?.config || {};

    const elId = document.getElementById('countingSettingSheetId');
    const elGid = document.getElementById('countingSettingGid');
    if (elId) elId.value = cfg.sheetId || '';
    if (elGid) elGid.value = cfg.gid || '0';

    modal.style.display = 'flex';
}

function closeCountingSheetModal() {
    const modal = document.getElementById('countingSheetSettingsModal');
    if (modal) modal.style.display = 'none';
}

async function saveCountingSheetSettings() {
    const sheetId = document.getElementById('countingSettingSheetId').value.trim();
    const gid = document.getElementById('countingSettingGid').value.trim();

    try {
        const res = await fetch('/api/counting/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheetId, gid })
        });
        const data = await res.json();
        if (data.success) {
            showToast('सेटिंग्स सुरक्षित', 'Google Sheet ID व GID अपडेट कर दी गई है।', 'success', 3000);
            closeCountingSheetModal();
            triggerCountingGoogleSheetSync();
        }
    } catch (err) {
        showToast('त्रुटि', err.message, 'error', 3000);
    }
}

function downloadCountingTemplate() {
    window.location.href = '/api/counting/template-csv';
}

function exportCountingExcel() {
    window.location.href = '/api/counting/export-csv';
}

// -------------------------------------------------------------
// QUICK EDIT SLOT MODAL
// -------------------------------------------------------------
let editModalRound = 1;
let editModalTable = 1;

function openEditSlotModal(round, table) {
    editModalRound = round;
    editModalTable = table;
    const modal = document.getElementById('countingEditSlotModal');
    if (!modal || !countingData) return;

    const slotKey = `${round}_${table}`;
    const s = countingData.slots[slotKey] || {};
    const v = s.votes || {};

    document.getElementById('editSlotTitle').textContent = `राउंड ${round} — मेज ${table} (${s.booth_no ? `बूथ ${s.booth_no}` : 'आरक्षित'})`;
    document.getElementById('editSlotSubtitle').textContent = `${s.gp_name || ''} | ${s.ps_ward || ''} | कुल मतदाता: ${(s.electors || 0).toLocaleString('en-IN')}`;

    const wInfo = countingData.wards[s.ps_ward] || {};
    const candList = wInfo.candidates || [
        { key: 'cand1', name: 'प्रत्याशी 1 (भाजपा)', party: 'BJP' },
        { key: 'cand2', name: 'प्रत्याशी 2 (कांग्रेस)', party: 'INC' },
        { key: 'cand3', name: 'प्रत्याशी 3 (निर्दलीय)', party: 'IND' }
    ];

    document.getElementById('editLabelCand1').textContent = candList[0]?.name || 'भाजपा प्रत्याशी';
    document.getElementById('editLabelCand2').textContent = candList[1]?.name || 'कांग्रेस प्रत्याशी';
    document.getElementById('editLabelCand3').textContent = candList[2]?.name || 'निर्दलीय प्रत्याशी';

    document.getElementById('editInputCand1').value = v.cand1 || 0;
    document.getElementById('editInputCand2').value = v.cand2 || 0;
    document.getElementById('editInputCand3').value = v.cand3 || 0;
    document.getElementById('editInputNota').value = v.nota || 0;
    document.getElementById('editInputRemark').value = s.remark || '';

    calcEditModalTotal();
    modal.style.display = 'flex';
}

function closeEditSlotModal() {
    const modal = document.getElementById('countingEditSlotModal');
    if (modal) modal.style.display = 'none';
}

function calcEditModalTotal() {
    const c1 = Number(document.getElementById('editInputCand1').value) || 0;
    const c2 = Number(document.getElementById('editInputCand2').value) || 0;
    const c3 = Number(document.getElementById('editInputCand3').value) || 0;
    const nt = Number(document.getElementById('editInputNota').value) || 0;
    const tot = c1 + c2 + c3 + nt;

    const elTot = document.getElementById('editSlotTotalDisplay');
    if (elTot) elTot.textContent = tot.toLocaleString('en-IN');
}

async function saveEditSlotModal() {
    const c1 = Number(document.getElementById('editInputCand1').value) || 0;
    const c2 = Number(document.getElementById('editInputCand2').value) || 0;
    const c3 = Number(document.getElementById('editInputCand3').value) || 0;
    const nt = Number(document.getElementById('editInputNota').value) || 0;
    const remark = document.getElementById('editInputRemark').value.trim();

    try {
        const res = await fetch('/api/counting/slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                round: editModalRound,
                table: editModalTable,
                cand1: c1,
                cand2: c2,
                cand3: c3,
                nota: nt,
                remark,
                status: (c1 + c2 + c3 + nt > 0) ? 'COMPLETED' : 'PENDING'
            })
        });

        const data = await res.json();
        if (data.success) {
            countingData = data;
            showToast('सफलता', `राउंड ${editModalRound} - मेज ${editModalTable} सुरक्षित!`, 'success', 3000);
            closeEditSlotModal();
            renderCountingTab();
        }
    } catch (err) {
        showToast('त्रुटि', err.message, 'error', 3000);
    }
}

// -------------------------------------------------------------
// WHATSAPP COUNTING BULLETIN GENERATOR
// -------------------------------------------------------------
function openCountingWhatsAppModal() {
    openRoundWhatsAppBulletin(selectedCountingRound);
}

function openRoundWhatsAppBulletin(roundNum) {
    if (!countingData) return;
    const modal = document.getElementById('countingWhatsAppModal');
    if (!modal) return;

    const textEl = document.getElementById('countingWhatsAppText');
    const titleEl = document.getElementById('countingWhatsAppModalTitle');
    if (titleEl) titleEl.textContent = `📢 राउंड ${roundNum} WhatsApp बुलेटिन`;

    const rData = countingData.rounds[roundNum] || { completedTables: 0, totalVotes: 0 };
    const k = countingData.kpi || {};
    const pt = k.partyTally || {};

    let msg = `🗳️ *पंचायती राज आम चुनाव 2026 — सुमेरपुर*\n`;
    msg += `🏛️ *कार्यालय निर्वाचक रजिस्ट्रीकरण अधिकारी (SDM) सुमेरपुर*\n`;
    msg += `📊 *पंचायत समिति सदस्य मतगणना बुलेटिन — राउंड ${roundNum}*\n`;
    msg += `🕒 समय: ${new Date().toLocaleTimeString('en-IN')} | दिनांक: 22-10-2026\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📌 *राउंड ${roundNum} सारांश (15 मेज):*\n`;
    msg += `• पूर्ण मेज: ${rData.completedTables || 0} / 15 मेज\n`;
    msg += `• राउंड में गिने गए मत: ${(rData.totalVotes || 0).toLocaleString('en-IN')}\n`;
    msg += `• समग्र प्रगति: ${k.totalCompletedBooths || 0} / 152 बूथ (${k.progressPct || 0}%)\n`;
    msg += `• कुल गिने गए मत: ${(k.totalCountedVotes || 0).toLocaleString('en-IN')}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🚩 *21 पं.स. वार्ड ताज़ा रुझान / बढ़त:*\n`;

    // Add ward leads
    for (let w = 1; w <= 21; w++) {
        const wm = countingData.wards[`W-${w}`];
        if (wm && wm.completedBooths > 0 && wm.leader && wm.leader.votes > 0) {
            const statusEmoji = wm.status === 'DECLARED' ? '✅ [घोषित]' : '⏳ [आगे]';
            msg += `• *वार्ड ${w}:* ${wm.leader.name} (${wm.leader.party}) +${wm.margin} मतों से ${statusEmoji}\n`;
        }
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📈 *पार्टी स्थिति (21 वार्ड):*\n`;
    msg += `• भाजपा: ${(pt.BJP?.won || 0) + (pt.BJP?.lead || 0)} (जीत: ${pt.BJP?.won || 0} | आगे: ${pt.BJP?.lead || 0})\n`;
    msg += `• कांग्रेस: ${(pt.INC?.won || 0) + (pt.INC?.lead || 0)} (जीत: ${pt.INC?.won || 0} | आगे: ${pt.INC?.lead || 0})\n`;
    msg += `• निर्दलीय: ${(pt.IND?.won || 0) + (pt.IND?.lead || 0)} (जीत: ${pt.IND?.won || 0} | आगे: ${pt.IND?.lead || 0})\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `_— कंट्रोल रूम, निर्वाचक रजिस्ट्रीकरण अधिकारी (SDM), सुमेरपुर_`;

    if (textEl) textEl.value = msg;
    modal.style.display = 'flex';
}

function closeCountingWhatsAppModal() {
    const modal = document.getElementById('countingWhatsAppModal');
    if (modal) modal.style.display = 'none';
}

function copyCountingWhatsAppText() {
    const textEl = document.getElementById('countingWhatsAppText');
    if (textEl) {
        textEl.select();
        navigator.clipboard.writeText(textEl.value).then(() => {
            showToast('कॉपी हुआ!', 'WhatsApp बुलेटिन क्लिपबोर्ड पर कॉपी कर लिया गया है।', 'success', 3000);
        });
    }
}

// -------------------------------------------------------------
// WARD BOOTHS BREAKDOWN MODAL
// -------------------------------------------------------------
function openWardBoothsModal(wardKey) {
    if (!countingData) return;
    const modal = document.getElementById('countingWardBoothsModal');
    if (!modal) return;

    const wm = countingData.wards[wardKey];
    if (!wm) return;

    document.getElementById('wardBoothsModalTitle').textContent = `वार्ड ${wardKey} — बूथ-वार मतगणना विवरण`;
    document.getElementById('wardBoothsModalSubtitle').textContent = `कुल बूथ: ${wm.totalBooths} | गिने गए: ${wm.completedBooths} | कुल मत: ${(wm.totalVotes || 0).toLocaleString('en-IN')}`;

    const candList = wm.candidates || [];
    const thead = document.getElementById('wardBoothsModalThead');
    const tbody = document.getElementById('wardBoothsModalTbody');

    thead.innerHTML = `
        <tr>
            <th>राउंड</th>
            <th>मेज</th>
            <th>बूथ सं.</th>
            <th>ग्राम पंचायत / स्थल</th>
            <th style="color:#ea580c;">${candList[0]?.name || 'भाजपा'}</th>
            <th style="color:#0284c7;">${candList[1]?.name || 'कांग्रेस'}</th>
            <th style="color:#9333ea;">${candList[2]?.name || 'निर्दलीय'}</th>
            <th>नोटा</th>
            <th>कुल</th>
            <th>स्थिति</th>
        </tr>
    `;

    let rowsHtml = '';
    wm.booths.forEach(s => {
        const v = s.votes || {};
        rowsHtml += `
            <tr>
                <td style="text-align:center; font-weight:700;">राउंड ${s.round}</td>
                <td style="text-align:center; font-weight:700;">मेज ${s.table}</td>
                <td style="font-weight:800; text-align:center;">${s.booth_no || '-'}</td>
                <td>${s.gp_name} - <small style="color:#64748b;">${s.location || ''}</small></td>
                <td style="text-align:right; font-weight:700; color:#ea580c;">${v.cand1 || 0}</td>
                <td style="text-align:right; font-weight:700; color:#0284c7;">${v.cand2 || 0}</td>
                <td style="text-align:right; font-weight:700; color:#9333ea;">${v.cand3 || 0}</td>
                <td style="text-align:right; color:#64748b;">${v.nota || 0}</td>
                <td style="text-align:right; font-weight:800;">${v.total || 0}</td>
                <td style="text-align:center;">
                    <span class="status-pill ${s.status === 'COMPLETED' ? 'declared' : 'pending'}">
                        ${s.status === 'COMPLETED' ? 'पूर्ण' : 'प्रतीक्षारत'}
                    </span>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;

    modal.style.display = 'flex';
}

function closeWardBoothsModal() {
    const modal = document.getElementById('countingWardBoothsModal');
    if (modal) modal.style.display = 'none';
}

// -------------------------------------------------------------
// FULLSCREEN WAR ROOM / BIG TV COUNTING DISPLAY
// -------------------------------------------------------------
function openCountingWarRoomModal() {
    isCountingWarRoomOpen = true;
    const modal = document.getElementById('countingWarRoomModal');
    if (modal) {
        modal.style.display = 'flex';
        renderCountingWarRoom();
        if (!countingWarRoomTimer) {
            countingWarRoomTimer = setInterval(() => {
                countingWarRoomView = (countingWarRoomView === 'wards') ? 'current_round' : 'wards';
                renderCountingWarRoom();
            }, 12000);
        }
    }
}

function closeCountingWarRoomModal() {
    isCountingWarRoomOpen = false;
    if (countingWarRoomTimer) {
        clearInterval(countingWarRoomTimer);
        countingWarRoomTimer = null;
    }
    const modal = document.getElementById('countingWarRoomModal');
    if (modal) modal.style.display = 'none';
}

function renderCountingWarRoom() {
    if (!countingData) return;
    const k = countingData.kpi || {};
    const pt = k.partyTally || {};

    const elTime = document.getElementById('warRoomClock');
    if (elTime) elTime.textContent = new Date().toLocaleTimeString('en-IN');

    const elTally = document.getElementById('warRoomPartyTally');
    if (elTally) {
        elTally.innerHTML = `
            <div class="tv-party-chip bjp">
                <span class="p-lbl">भाजपा (BJP)</span>
                <span class="p-val">${(pt.BJP?.won || 0) + (pt.BJP?.lead || 0)}</span>
                <span class="p-sub">जीत: ${pt.BJP?.won || 0} | आगे: ${pt.BJP?.lead || 0}</span>
            </div>
            <div class="tv-party-chip inc">
                <span class="p-lbl">कांग्रेस (INC)</span>
                <span class="p-val">${(pt.INC?.won || 0) + (pt.INC?.lead || 0)}</span>
                <span class="p-sub">जीत: ${pt.INC?.won || 0} | आगे: ${pt.INC?.lead || 0}</span>
            </div>
            <div class="tv-party-chip ind">
                <span class="p-lbl">निर्दलीय (IND)</span>
                <span class="p-val">${(pt.IND?.won || 0) + (pt.IND?.lead || 0)}</span>
                <span class="p-sub">जीत: ${pt.IND?.won || 0} | आगे: ${pt.IND?.lead || 0}</span>
            </div>
        `;
    }

    const container = document.getElementById('warRoomTilesGrid');
    if (!container) return;

    if (countingWarRoomView === 'wards') {
        // 21 Ward Tiles View
        let html = '';
        for (let w = 1; w <= 21; w++) {
            const wm = countingData.ps_wards ? (countingData.ps_wards[`W-${w}`] || {}) : (countingData.wards ? (countingData.wards[`W-${w}`] || {}) : {});
            const isDeclared = wm.status === 'DECLARED';
            const leader = wm.leader || { name: '-', party: '-', votes: 0 };
            const runnerUp = wm.runnerUp;
            const hasCounted = wm.completedBooths > 0 && leader.votes > 0;
            const leadingParty = leader.party ? leader.party.toLowerCase() : '';

            let statusClass = 'pending';
            let statusBadge = '<span class="tv-wt-status pending">⚪ प्रतीक्षारत</span>';
            if (isDeclared) {
                statusClass = 'declared';
                statusBadge = '<span class="tv-wt-status declared">🟢 घोषित</span>';
            } else if (hasCounted) {
                statusClass = 'counting';
                statusBadge = `<span class="tv-wt-status counting">🟡 लीड (${wm.completedBooths}/${wm.totalBooths})</span>`;
            }

            const isHotSeat = hasCounted && !isDeclared && wm.margin > 0 && wm.margin <= 100;
            const totPolled = Number(wm.totalPolledVotes) || 0;
            const totCounted = Number(wm.totalCountedVotes) || 0;
            const wardProgressPct = totPolled > 0 ? ((totCounted / totPolled) * 100).toFixed(0) : '0';

            html += `
                <div class="tv-ward-tile ${statusClass} ${hasCounted ? 'party-' + leadingParty : ''}">
                    <div class="tv-wt-head">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span class="tv-wt-ward">वार्ड W-${w}</span>
                            ${isHotSeat ? `<span class="hot-contest-badge" title="अंतर 100 मतों से कम है"><i class="fas fa-fire"></i> कड़ी टक्कर (${wm.margin})</span>` : ''}
                        </div>
                        ${statusBadge}
                    </div>

                    ${hasCounted ? `
                        <div class="tv-wt-lead-box">
                            ${isDeclared ? `
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1px;">
                                    <span style="color:#6ee7b7; font-weight:900; font-size:13px;"><i class="fas fa-trophy"></i> विजेता (जीता):</span>
                                    <span class="tv-wt-party-badge party-${leadingParty}">${leader.party}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:baseline;">
                                    <span class="tv-wt-lead-name" title="${leader.name}" style="font-size:16px; font-weight:900; color:#ffffff;">${leader.name}</span>
                                    <span style="font-size:16px; font-weight:900; color:#6ee7b7; white-space:nowrap;">${Number(leader.votes).toLocaleString('en-IN')} <small style="font-size:11px; color:#cbd5e1;">मत</small></span>
                                </div>
                                <div style="margin:3px 0; background:rgba(16, 185, 129, 0.15); border:1px solid #10b981; border-radius:6px; padding:3px 8px; display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:#a7f3d0; font-size:11.5px; font-weight:800;">🎯 जीत का अंतर:</span>
                                    <span style="color:#34d399; font-size:13.5px; font-weight:900;">+${wm.margin} मतों से विजयी</span>
                                </div>
                                <div class="tv-wt-runner-row">
                                    <div style="display:flex; align-items:center; gap:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:68%;">
                                        <span style="color:#94a3b8; font-weight:800; font-size:12px;">🥈 पीछे:</span>
                                        <span style="color:#cbd5e1; font-weight:800; font-size:12px;" title="${runnerUp ? runnerUp.name : '-'}">${runnerUp ? runnerUp.name : '-'}</span>
                                        <span style="font-size:10px; color:#94a3b8; font-weight:700;">[${runnerUp?.party || '-'}]</span>
                                    </div>
                                    <span style="color:#ffffff; font-weight:900; font-size:13px; white-space:nowrap;">${runnerUp ? Number(runnerUp.votes).toLocaleString('en-IN') : 0} <small style="font-size:10px; color:#94a3b8;">मत</small></span>
                                </div>
                            ` : `
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1px;">
                                    <span style="color:#fde047; font-weight:900; font-size:13px;"><i class="fas fa-crown"></i> आगे (लीड):</span>
                                    <span class="tv-wt-party-badge party-${leadingParty}">${leader.party}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:baseline;">
                                    <span class="tv-wt-lead-name" title="${leader.name}" style="font-size:16px; font-weight:900; color:#ffffff;">${leader.name}</span>
                                    <span style="font-size:16px; font-weight:900; color:#fde047; white-space:nowrap;">${Number(leader.votes).toLocaleString('en-IN')} <small style="font-size:11px; color:#cbd5e1;">मत</small></span>
                                </div>
                                <div style="margin:3px 0; background:${isHotSeat ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.12)'}; border:1px solid ${isHotSeat ? '#ef4444' : '#0284c7'}; border-radius:6px; padding:3px 8px; display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:${isHotSeat ? '#fca5a5' : '#7dd3fc'}; font-size:11.5px; font-weight:800;">📈 वर्तमान बढ़त:</span>
                                    <span style="color:${isHotSeat ? '#f87171' : '#38bdf8'}; font-size:13.5px; font-weight:900;">+${wm.margin} मतों से आगे</span>
                                </div>
                                <div class="tv-wt-runner-row">
                                    <div style="display:flex; align-items:center; gap:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:68%;">
                                        <span style="color:#94a3b8; font-weight:800; font-size:12px;">🥈 पीछे:</span>
                                        <span style="color:#cbd5e1; font-weight:800; font-size:12px;" title="${runnerUp ? runnerUp.name : '-'}">${runnerUp ? runnerUp.name : '-'}</span>
                                        <span style="font-size:10px; color:#94a3b8; font-weight:700;">[${runnerUp?.party || '-'}]</span>
                                    </div>
                                    <span style="color:#ffffff; font-weight:900; font-size:13px; white-space:nowrap;">${runnerUp ? Number(runnerUp.votes).toLocaleString('en-IN') : 0} <small style="font-size:10px; color:#94a3b8;">मत</small></span>
                                </div>
                            `}
                            <div style="width:100%; height:4px; background:#0f172a; border-radius:3px; overflow:hidden; margin-top:3px;">
                                <div style="width:${wardProgressPct}%; height:100%; background:${isDeclared ? '#10b981' : '#38bdf8'}; transition:width 0.4s ease;"></div>
                            </div>
                        </div>
                    ` : `
                        <div class="tv-wt-pending-box">
                            <div style="font-size:12px; font-weight:800; color:#fde047; margin-bottom:2px;">प्रत्याशी:</div>
                            ${(wm.candidates || []).map(c => `
                                <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; font-weight:800; color:#ffffff; padding:1px 0;">
                                    <span>${c.name}</span>
                                    <span class="tv-wt-party-badge party-${(c.party || 'IND').toLowerCase()}">${c.party || 'IND'}</span>
                                </div>
                            `).join('')}
                            <div style="font-size:12px; color:#9ca3af; display:flex; justify-content:space-between; margin-top:4px; border-top:1px dashed #374151; padding-top:3px;">
                                <span>कुल EVM: <b style="color:#38bdf8;">${(wm.totalPolledVotes || 0).toLocaleString('en-IN')}</b></span>
                                <span>${wm.totalBooths} बूथ</span>
                            </div>
                        </div>
                    `}

                    <div class="tv-wt-foot">
                        <span>गिने: <b style="color:#ffffff; font-size:13px;">${totCounted.toLocaleString('en-IN')}</b> / ${totPolled.toLocaleString('en-IN')}</span>
                        <span style="color:#38bdf8; font-weight:900; font-size:12.5px;">बूथ: <b>${wm.completedBooths}/${wm.totalBooths}</b></span>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } else {
        // Current Round 15 Tables View
        const actR = k.activeRound || 1;
        let html = '';
        for (let t = 1; t <= 15; t++) {
            const s = countingData.slots[`${actR}_${t}`] || {};
            const tot = s.votes ? Number(s.votes.total) || 0 : 0;
            html += `
                <div class="tv-table-tile ${s.status === 'COMPLETED' ? 'completed' : 'counting'}">
                    <div class="tv-tt-head">
                        <span>राउंड ${actR} • मेज ${t}</span>
                        <span class="booth-tag">${s.booth_no ? `बूथ ${s.booth_no}` : 'आरक्षित'}</span>
                    </div>
                    <div class="tv-tt-gp">${s.gp_name || '-'} (${s.ps_ward || '-'})</div>
                    <div class="tv-tt-votes">
                        <span style="color:#ea580c;">भाजपा: ${s.votes?.cand1 || 0}</span>
                        <span style="color:#0284c7;">कांग्रेस: ${s.votes?.cand2 || 0}</span>
                        <span style="color:#9333ea;">निर्दलीय: ${s.votes?.cand3 || 0}</span>
                    </div>
                    <div class="tv-tt-foot">
                        <span>कुल गिने गए मत: <b>${tot}</b></span>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }
}
