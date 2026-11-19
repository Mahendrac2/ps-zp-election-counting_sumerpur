// Sumerpur Panchayati Raj Election 2026 - Control Room App
// Based on the architecture of https://election-sumerpur2026.onrender.com

let currentUser = null; // null = guest, or { username, name, role, zone }
let selectedDate = '22-10-2026';
let currentTab = 'dashboard';
let reportsSubtab = 'zp'; // 'zp' or 'ps' for Day 22; 'sarpanch_ps' or 'sarpanch_gp' for Day 24
let pendingSlot = '10';
let pendingZone = 'ALL';
let liveData = null;
let chartInstance = null;
let liveEventSource = null;

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    checkSavedSession();
    handleHashNavigation();
    window.addEventListener('hashchange', handleHashNavigation);
    fetchData();
    initLiveStream();
});

// Clock
function initClock() {
    const update = () => {
        const now = new Date();
        const str = now.toLocaleTimeString('en-IN', { hour12: true });
        const pClock = document.getElementById('portalClock');
        const tvClock = document.getElementById('tvClock');
        const bsClock = document.getElementById('bsClock');
        if (pClock) pClock.textContent = str;
        if (tvClock) tvClock.textContent = str;
        if (bsClock) bsClock.textContent = str;
    };
    update();
    setInterval(update, 1000);
}

// Session
// Session: Direct RO Control Room Access (Login Barrier Removed)
function checkSavedSession() {
    currentUser = { username: 'ro_sumerpur', name: 'कंट्रोल रूम (SDM सुमेरपुर)', role: 'RO', zone: 'ALL' };
    localStorage.setItem('panchayat_user_session', JSON.stringify(currentUser));
    updateUserUI();
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
}

function updateUserUI() {
    const nameEl = document.getElementById('currentUserName');
    const adminLink = document.getElementById('navAdminLink');
    if (nameEl) nameEl.textContent = 'कंट्रोल रूम (SDM सुमेरपुर)';
    if (adminLink) adminLink.style.display = 'inline-flex';
}

// Auth Tabs
function switchAuthTab(tab) {
    document.getElementById('opLoginFormContainer').style.display = tab === 'op_login' ? 'block' : 'none';
    document.getElementById('opRegisterFormContainer').style.display = tab === 'op_register' ? 'block' : 'none';
    document.getElementById('roLoginFormContainer').style.display = tab === 'ro_login' ? 'block' : 'none';

    document.getElementById('authTabOpLoginBtn').className = tab === 'op_login' ? 'btn-primary' : 'btn-secondary';
    document.getElementById('authTabOpRegBtn').className = tab === 'op_register' ? 'btn-primary' : 'btn-secondary';
    document.getElementById('authTabRoLoginBtn').className = tab === 'ro_login' ? 'btn-primary' : 'btn-secondary';
}

async function attemptOpLogin() {
    const u = document.getElementById('opUsername').value.trim();
    const p = document.getElementById('opPassword').value.trim();
    if (!u || !p) { alert('कृपया यूज़रनेम एवं पासवर्ड दर्ज करें।'); return; }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const d = await res.json();
        if (d.success) {
            currentUser = d.user;
            localStorage.setItem('panchayat_user_session', JSON.stringify(currentUser));
            updateUserUI();
            document.getElementById('loginOverlay').style.display = 'none';
            fetchData();
        } else {
            alert(d.message || 'लॉगिन असफल');
        }
    } catch (e) {
        alert('सर्वर से संपर्क नहीं हो सका: ' + e.message);
    }
}

async function attemptRoLogin() {
    const u = document.getElementById('roUsername').value.trim();
    const p = document.getElementById('roPassword').value.trim();
    if (!u || !p) { alert('कृपया RO यूज़रनेम एवं पासवर्ड दर्ज करें।'); return; }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const d = await res.json();
        if (d.success) {
            currentUser = d.user;
            localStorage.setItem('panchayat_user_session', JSON.stringify(currentUser));
            updateUserUI();
            document.getElementById('loginOverlay').style.display = 'none';
            fetchData();
        } else {
            alert(d.message || 'RO लॉगिन असफल');
        }
    } catch (e) {
        alert('सर्वर से संपर्क नहीं हो सका: ' + e.message);
    }
}

async function attemptRegister() {
    const name = document.getElementById('regName').value.trim();
    const mobile = document.getElementById('regMobile').value.trim();
    const designation = document.getElementById('regDesignation').value.trim();
    const role = document.getElementById('regRole').value;
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();

    if (!name || !username || !password) {
        alert('कृपया समस्त आवश्यक जानकारी भरें।');
        return;
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, mobile, designation, role, username, password })
        });
        const d = await res.json();
        if (d.success) {
            alert('पंजीयन सफल! स्वतः लॉगिन किया जा रहा है...');
            currentUser = d.user;
            localStorage.setItem('panchayat_user_session', JSON.stringify(currentUser));
            updateUserUI();
            document.getElementById('loginOverlay').style.display = 'none';
            fetchData();
        } else {
            alert(d.message || 'पंजीयन असफल');
        }
    } catch (e) {
        alert('त्रुटि: ' + e.message);
    }
}

function enterPublicGuestMode() {
    currentUser = null;
    localStorage.removeItem('panchayat_user_session');
    updateUserUI();
    document.getElementById('loginOverlay').style.display = 'none';
    fetchData();
}

function handleHeaderAuthAction() {
    if (currentUser) {
        currentUser = null;
        localStorage.removeItem('panchayat_user_session');
        updateUserUI();
        document.getElementById('loginOverlay').style.display = 'flex';
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
    }
}

// Navigation
function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
}

function navigateTo(tab) {
    currentTab = tab;
    window.location.hash = '#' + tab;

    document.querySelectorAll('.page-view').forEach(v => v.style.display = 'none');
    const target = document.getElementById('view_' + tab);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-tab') === tab);
    });

    if (liveData) renderCurrentTab();
    if (tab === 'admin') checkCloudStatus();
}

function switchElectionDate(date) {
    selectedDate = date;
    document.getElementById('btnDay22').classList.toggle('active', date === '22-10-2026');
    document.getElementById('btnDay24').classList.toggle('active', date === '24-10-2026');

    const mainT = document.getElementById('headerMainTitle');
    const subT = document.getElementById('headerSubTitle');
    const annSub = document.getElementById('announcementSubtitle');

    if (date === '22-10-2026') {
        reportsSubtab = 'zp';
        mainT.textContent = 'रिटर्निंग ऑफिसर (SDM) सुमेरपुर — पंचायत समिति व जिला परिषद सदस्य चुनाव 2026';
        subT.textContent = 'मतदान नियंत्रण — 22-10-2026 लाइव मॉनिटरिंग एवं कंट्रोल रूम (152 बूथ | 21 PS वार्ड | 4 ZP वार्ड)';
        if (annSub) annSub.textContent = '22-10-2026: पं.स. एवं जिला परिषद सदस्य चुनाव';
    } else {
        reportsSubtab = 'sarpanch_ps';
        mainT.textContent = 'रिटर्निंग ऑफिसर (SDM) सुमेरपुर — सरपंच एवं वार्ड पंच चुनाव 2026';
        subT.textContent = 'मतदान नियंत्रण — 24-10-2026 लाइव मॉनिटरिंग एवं कंट्रोल रूम (152 बूथ | 34 ग्राम पंचायतें)';
        if (annSub) annSub.textContent = '24-10-2026: सरपंच एवं वार्ड पंच आम चुनाव';
    }

    fetchData();
}

// Data Fetch & SSE
async function fetchData() {
    try {
        const res = await fetch(`/api/data?date=${selectedDate}`);
        const d = await res.json();
        if (d.success) {
            liveData = d;
            document.getElementById('syncStatusText').textContent = 'लाइव सिंक सक्रिय';
            renderCurrentTab();
            savePollSnapshot(d);
            checkPollRestore(d);
        }
    } catch (e) {
        document.getElementById('syncStatusText').textContent = 'ऑफ़लाइन / पुनः प्रयास...';
        console.warn('API error:', e);
    }
}

function savePollSnapshot(data) {
    try {
        if (!data || !data.booths) return;
        const totalVotes = data.kpi ? data.kpi.totalVotes : 0;
        if (totalVotes > 0) {
            localStorage.setItem('sumerpur_poll_local_backup_' + selectedDate, JSON.stringify({
                date: selectedDate,
                timestamp: new Date().toISOString(),
                totalVotes: totalVotes,
                booths: data.booths
            }));
        }
    } catch (e) {}
}

function checkPollRestore(data) {
    try {
        const raw = localStorage.getItem('sumerpur_poll_local_backup_' + selectedDate);
        if (!raw) return;
        const backup = JSON.parse(raw);
        const currentVotes = data.kpi ? data.kpi.totalVotes : 0;
        if (currentVotes === 0 && backup.totalVotes > 0 && !document.getElementById('pollRestoreBanner')) {
            const banner = document.createElement('div');
            banner.id = 'pollRestoreBanner';
            banner.style.cssText = 'position:fixed; top:70px; left:50%; transform:translateX(-50%); width:94%; max-width:850px; background:#fef2f2; border:2px solid #ef4444; border-radius:12px; padding:12px 18px; z-index:999999; box-shadow:0 12px 30px rgba(239,68,68,0.25); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;';
            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fas fa-triangle-exclamation" style="color:#dc2626; font-size:22px;"></i>
                    <div>
                        <b style="color:#991b1b; font-size:13px;">सर्वर रीस्टार्ट डिटेक्ट हुआ (मतदान डेटा शून्य है)।</b>
                        <div style="font-size:12px; color:#b91c1c;">ब्राउज़र में कुल <b>${backup.totalVotes}</b> मतों का बैकअप मौजूद है।</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button onclick="restorePollFromLocal('${selectedDate}')" style="background:#dc2626; color:#fff; border:none; padding:7px 14px; border-radius:6px; font-weight:800; font-size:12px; cursor:pointer;">
                        तुरंत रिस्टोर करें
                    </button>
                    <button onclick="document.getElementById('pollRestoreBanner').remove()" style="background:#fff; color:#475569; border:1px solid #cbd5e1; padding:7px 10px; border-radius:6px; font-size:12px; cursor:pointer;">
                        खारिज करें
                    </button>
                </div>
            `;
            document.body.appendChild(banner);
        }
    } catch (e) {}
}

async function restorePollFromLocal(date) {
    try {
        const raw = localStorage.getItem('sumerpur_poll_local_backup_' + date);
        if (!raw) return;
        const backup = JSON.parse(raw);
        const boothMap = {};
        (backup.booths || []).forEach(b => {
            boothMap[b.id] = b;
        });
        const res = await fetch('/api/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                store: {
                    dates: {
                        [date]: boothMap
                    }
                }
            })
        });
        const resData = await res.json();
        if (resData.success) {
            alert('डेटा सफलतापूर्वक रिस्टोर हो गया!');
            const banner = document.getElementById('pollRestoreBanner');
            if (banner) banner.remove();
            fetchData();
        }
    } catch (e) {
        alert('त्रुटि: ' + e.message);
    }
}

function initLiveStream() {
    if (liveEventSource) liveEventSource.close();
    liveEventSource = new EventSource('/api/live-stream');
    liveEventSource.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        fetchData();
        if (typeof fetchCountingData === 'function') fetchCountingData();
    };
    liveEventSource.onerror = () => {
        setTimeout(initLiveStream, 5000);
    };
}

function renderCurrentTab() {
    if (!liveData) return;
    renderTopKPIs();

    if (currentTab === 'dashboard') renderDashboard();
    else if (currentTab === 'booths') renderBoothsTable();
    else if (currentTab === 'entry') renderEntryTable();
    else if (currentTab === 'stats') renderStatsPage();
    else if (currentTab === 'zones') renderZonesPage();
    else if (currentTab === 'reports') renderReportsPage();
    else if (currentTab === 'livedisplay') renderLiveDisplay();
    else if (currentTab === 'whatsapp') generateWhatsappMessage('10');
    else if (currentTab === 'counting' && typeof renderCountingTab === 'function') renderCountingTab();

    if (typeof renderBigScreenStats === 'function' && isBigScreenOpen) {
        renderBigScreenStats();
    }
}

// Top KPIs
function renderTopKPIs() {
    const k = liveData.kpi;
    document.getElementById('kpiTotalElectors').textContent = k.totalElectors.toLocaleString('en-IN');
    document.getElementById('kpiMock').textContent = `${k.mockDone} / 152`;
    document.getElementById('kpiStarted').textContent = `${k.started} / 152`;
    document.getElementById('kpiVotes').textContent = k.totalVotes.toLocaleString('en-IN');
    document.getElementById('kpiTurnout').textContent = `${k.turnoutPct}%`;

    // Slot Strip
    const s = k.slots;
    document.getElementById('slotSum10').textContent = s.s10.count.toLocaleString('en-IN');
    document.getElementById('slotPct10').textContent = `${s.s10.pct}%`;

    document.getElementById('slotSum13').textContent = s.s13.count.toLocaleString('en-IN');
    document.getElementById('slotPct13').textContent = `${s.s13.pct}%`;

    document.getElementById('slotSum15').textContent = s.s15.count.toLocaleString('en-IN');
    document.getElementById('slotPct15').textContent = `${s.s15.pct}%`;

    document.getElementById('slotSum18').textContent = s.s18.count.toLocaleString('en-IN');
    document.getElementById('slotPct18').textContent = `${s.s18.pct}%`;

    document.getElementById('slotSumQueue').textContent = s.queue.count.toLocaleString('en-IN');
    document.getElementById('slotSumFinal').textContent = s.final.count.toLocaleString('en-IN');
    document.getElementById('slotPctFinal').textContent = `${s.final.pct}%`;

    // Highlights (Highest & Slowest)
    const validBooths = liveData.booths.filter(b => b.electors > 0 && b.turnoutPct > 0);
    if (validBooths.length > 0) {
        validBooths.sort((a,b) => b.turnoutPct - a.turnoutPct);
        const top = validBooths[0];
        const low = validBooths[validBooths.length - 1];

        document.getElementById('hiVotingBooth').textContent = `बूथ ${top.id} (${top.gp_name})`;
        document.getElementById('hiVotingPct').textContent = `मतदान: ${top.turnoutPct}% (${top.latestVotes}/${top.electors})`;

        document.getElementById('loVotingBooth').textContent = `बूथ ${low.id} (${low.gp_name})`;
        document.getElementById('loVotingPct').textContent = `मतदान: ${low.turnoutPct}% (${low.latestVotes}/${low.electors})`;
    } else {
        document.getElementById('hiVotingBooth').textContent = 'मतदान प्रारंभ...';
        document.getElementById('hiVotingPct').textContent = '0.00%';
        document.getElementById('loVotingBooth').textContent = 'मतदान प्रारंभ...';
        document.getElementById('loVotingPct').textContent = '0.00%';
    }
}

// -------------------------------------------------------------
// DASHBOARD
// -------------------------------------------------------------
function renderDashboard() {
    renderTurnoutChart();
    renderPendingTracker();
    renderRankingMiniLists();

    // Quick Summary Table
    const tbody = document.getElementById('dashSummaryTbody');
    let rowsHtml = '';
    liveData.booths.slice(0, 15).forEach(b => {
        rowsHtml += `
            <tr>
                <td style="font-weight:bold;">${b.id}</td>
                <td>${b.zone}</td>
                <td><strong>${b.gp_name}</strong></td>
                <td class="cell-location" style="text-align:left; font-size:12.5px; line-height:1.35; white-space:normal; min-width:240px;" title="${b.location}">${b.location}</td>
                <td style="text-align:right;">${b.electors.toLocaleString('en-IN')}</td>
                <td>${b.started ? '✓ हाँ' : '✗'}</td>
                <td style="text-align:right;">${b.v10 || '-'}</td>
                <td style="text-align:right; background:#fef9c3;">${b.v13 || '-'}</td>
                <td style="text-align:right;">${b.v15 || '-'}</td>
                <td style="text-align:right;">${b.v18 || '-'}</td>
                <td style="text-align:right; font-weight:bold;">${b.v_final || b.latestVotes || '-'}</td>
                <td style="font-weight:bold; color:#1e40af;">${b.turnoutPct}%</td>
                <td style="font-size:11.5px;">${b.magistrate}<br><a href="tel:${b.magistrate_mob}">📞 ${b.magistrate_mob}</a></td>
            </tr>
        `;
    });
    tbody.innerHTML = rowsHtml;
}

// Turnout Chart (Chart.js)
function renderTurnoutChart() {
    const ctx = document.getElementById('turnoutChart');
    if (!ctx) return;

    const s = liveData.kpi.slots;
    const labels = ['10:00 AM', '01:00 PM', '03:00 PM', '06:00 PM', 'Final (अंतिम)'];
    const dataVals = [s.s10.pct, s.s13.pct, s.s15.pct, s.s18.pct, s.final.pct];

    if (chartInstance) {
        chartInstance.data.datasets[0].data = dataVals;
        chartInstance.update();
        return;
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'कुल मतदान प्रतिशत (%)',
                data: dataVals,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                fill: true,
                tension: 0.35,
                pointRadius: 6,
                pointBackgroundColor: '#1d4ed8',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });
}

// PENDING TRACKER
function setPendingTrackerSlot(slot) {
    pendingSlot = slot;
    document.querySelectorAll('#pendingSlotTabs .slot-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-slot') === slot);
    });
    renderPendingTracker();
}

function renderPendingTracker() {
    const zoneSel = document.getElementById('pendingZoneFilter');
    pendingZone = zoneSel ? zoneSel.value : 'ALL';

    const booths = liveData.booths;
    let pendingBooths = [];
    let receivedCount = 0;

    // Check slot completion
    booths.forEach(b => {
        let isFilled = false;
        if (pendingSlot === '10') isFilled = b.v10 !== '' && b.v10 !== undefined;
        else if (pendingSlot === '13') isFilled = b.v13 !== '' && b.v13 !== undefined;
        else if (pendingSlot === '15') isFilled = b.v15 !== '' && b.v15 !== undefined;
        else if (pendingSlot === '18') isFilled = b.v18 !== '' && b.v18 !== undefined;
        else if (pendingSlot === 'Final') isFilled = b.v_final !== '' && b.v_final !== undefined;
        else if (pendingSlot === 'mock') isFilled = b.mock_done === true;
        else if (pendingSlot === 'started') isFilled = b.started === true;

        if (isFilled) receivedCount++;
        else pendingBooths.push(b);
    });

    // Update badges
    const totalB = booths.length;
    const missingCount = totalB - receivedCount;

    document.getElementById('pendingReceivedCount').textContent = receivedCount;
    document.getElementById('pendingReceivedPct').textContent = `${((receivedCount / totalB) * 100).toFixed(0)}%`;
    document.getElementById('pendingMissingCount').textContent = missingCount;
    document.getElementById('pendingMissingPct').textContent = `${((missingCount / totalB) * 100).toFixed(0)}%`;

    document.getElementById('pendingBarReceived').style.width = `${((receivedCount / totalB) * 100)}%`;
    document.getElementById('pendingBarMissing').style.width = `${((missingCount / totalB) * 100)}%`;

    // Filter by Zone
    let filteredList = pendingBooths;
    if (pendingZone !== 'ALL') {
        filteredList = pendingBooths.filter(b => b.zone === pendingZone);
    }

    const tbody = document.getElementById('pendingBoothsTbody');
    if (filteredList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding:24px; color:#15803d; font-weight:bold;">
                    <i class="fas fa-check-circle" style="font-size:24px;"></i><br>
                    बधाई! इस समय स्लॉट पर समस्त ${pendingZone !== 'ALL' ? pendingZone : '152'} मतदान केंद्रों की प्रविष्टि प्राप्त हो चुकी है।
                </td>
            </tr>
        `;
        return;
    }

    let rows = '';
    filteredList.forEach(b => {
        rows += `
            <tr>
                <td style="font-weight:bold; color:#dc2626;">${b.id}</td>
                <td><span class="badge-zone">${b.zone}</span></td>
                <td><strong>${b.gp_name}</strong></td>
                <td style="text-align:left; font-size:12px;">${b.location}</td>
                <td style="text-align:right;">${b.electors.toLocaleString('en-IN')}</td>
                <td>${b.magistrate}</td>
                <td style="text-align:left; font-size:12px;">
                    ${b.praganak_name}<br>
                    <a href="tel:${b.praganak_mob}" style="color:#2563eb; font-weight:bold;">📞 ${b.praganak_mob || 'उपलब्ध नहीं'}</a>
                </td>
                <td>
                    ${b.praganak_mob ? `<a href="tel:${b.praganak_mob}" class="btn-primary" style="padding:4px 8px; font-size:11px; text-decoration:none;"><i class="fas fa-phone"></i> कॉल</a>` : '-'}
                </td>
                <td>
                    <button class="btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="navigateTo('entry')">
                        <i class="fas fa-pen"></i> प्रविष्टि
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rows;
}

function copyPendingBoothsList() {
    const booths = liveData.booths;
    let missing = [];
    booths.forEach(b => {
        let isFilled = false;
        if (pendingSlot === '10') isFilled = b.v10 !== '' && b.v10 !== undefined;
        else if (pendingSlot === '13') isFilled = b.v13 !== '' && b.v13 !== undefined;
        else if (pendingSlot === '15') isFilled = b.v15 !== '' && b.v15 !== undefined;
        else if (pendingSlot === '18') isFilled = b.v18 !== '' && b.v18 !== undefined;
        else if (pendingSlot === 'Final') isFilled = b.v_final !== '' && b.v_final !== undefined;
        if (!isFilled) missing.push(b);
    });

    let msg = `⚠️ *अति आवश्यक: लंबित मतदान रिपोर्ट (${pendingSlot} बजे)*\n`;
    msg += `📍 कार्यालय SDM / RO सुमेरपुर - पंचायती राज चुनाव 2026\n`;
    msg += `दिनांक: ${selectedDate} | कुल लंबित बूथ: ${missing.length}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    missing.forEach(b => {
        msg += `• बूथ ${b.id} (${b.gp_name}) - BLO: ${b.praganak_mob || b.magistrate_mob}\n`;
    });
    msg += `━━━━━━━━━━━━━━━━━━━━━\nकृपया तुरंत कंट्रोल रूम में मत दर्ज करवाएं।`;

    navigator.clipboard.writeText(msg).then(() => {
        alert("लंबित बूथों की WhatsApp सूची कॉपी हो गई!");
    });
}

function exportPendingCsv() {
    window.location.href = `/api/export/csv?date=${selectedDate}`;
}

// RANKINGS
function renderRankingMiniLists() {
    const validBooths = liveData.booths.filter(b => b.electors > 0 && b.turnoutPct > 0);
    validBooths.sort((a,b) => b.turnoutPct - a.turnoutPct);

    const top5 = validBooths.slice(0, 5);
    const low5 = validBooths.slice(-5).reverse();

    const topCont = document.getElementById('topHighListContainer');
    let tHtml = '';
    top5.forEach((b, idx) => {
        tHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:12.5px;">
                <span><b>${idx+1}. बूथ ${b.id}</b> — ${b.gp_name}</span>
                <span class="pct-badge pct-high">${b.turnoutPct}%</span>
            </div>
        `;
    });
    topCont.innerHTML = tHtml || '<div style="font-size:12px; color:#64748b;">मतदान डेटा प्रतीक्षित</div>';

    const lowCont = document.getElementById('topLowListContainer');
    let lHtml = '';
    low5.forEach((b, idx) => {
        lHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:12.5px;">
                <span><b>${idx+1}. बूथ ${b.id}</b> — ${b.gp_name}</span>
                <span class="pct-badge pct-low">${b.turnoutPct}%</span>
            </div>
        `;
    });
    lowCont.innerHTML = lHtml || '<div style="font-size:12px; color:#64748b;">मतदान डेटा प्रतीक्षित</div>';
}

function openRankingsModal(type) {
    const modal = document.getElementById('rankingsModal');
    const title = document.getElementById('rankingsModalTitle');
    const content = document.getElementById('rankingsModalContent');

    const validBooths = liveData.booths.filter(b => b.electors > 0);
    if (type === 'high') {
        validBooths.sort((a,b) => b.turnoutPct - a.turnoutPct);
        title.innerHTML = '🟢 सर्वाधिक मतदान केंद्र रैंकिंग (Highest Turnout)';
    } else {
        validBooths.sort((a,b) => a.turnoutPct - b.turnoutPct);
        title.innerHTML = '🔴 धीमे / न्यूनतम मतदान केंद्र रैंकिंग (Slowest Turnout)';
    }

    let h = '<table class="data-table"><thead><tr><th>रैंक</th><th>बूथ</th><th>ज़ोन</th><th>ग्राम पंचायत</th><th>मतदाता</th><th>पड़े मत</th><th>प्रतिशत</th></tr></thead><tbody>';
    validBooths.forEach((b, i) => {
        h += `<tr><td>${i+1}</td><td><b>${b.id}</b></td><td>${b.zone}</td><td>${b.gp_name}</td><td>${b.electors}</td><td>${b.latestVotes}</td><td><b>${b.turnoutPct}%</b></td></tr>`;
    });
    h += '</tbody></table>';
    content.innerHTML = h;
    modal.style.display = 'flex';
}

function closeRankingsModal() {
    document.getElementById('rankingsModal').style.display = 'none';
}

// -------------------------------------------------------------
// 152 BOOTHS MONITORING GRID
// -------------------------------------------------------------
function renderBoothsTable() {
    const s = (document.getElementById('searchBoothInput').value || '').toLowerCase();
    const zF = document.getElementById('filterZoneSelect').value;
    const gpF = document.getElementById('filterGpSelect').value;

    const tbody = document.getElementById('allBoothsTbody');
    let rows = '';

    liveData.booths.forEach(b => {
        if (zF !== 'ALL' && b.zone !== zF) return;
        if (gpF !== 'ALL' && b.gp_name !== gpF) return;

        if (s) {
            const m = b.id.toLowerCase().includes(s) || b.gp_name.toLowerCase().includes(s) || b.location.toLowerCase().includes(s) || b.magistrate.toLowerCase().includes(s);
            if (!m) return;
        }

        const wardInfo = selectedDate === '22-10-2026' ? `${b.ps_ward} / ${b.zp_ward}` : b.gp_name;

        rows += `
            <tr>
                <td style="font-weight:bold;">${b.id}</td>
                <td><span class="badge-zone">${b.zone}</span></td>
                <td><strong>${b.gp_name}</strong></td>
                <td style="text-align:left; font-size:12px;">${b.location}</td>
                <td>${wardInfo}</td>
                <td style="text-align:right;">${b.electors.toLocaleString('en-IN')}</td>
                <td>${b.started ? '✓' : '✗'}</td>
                <td style="text-align:right;">${b.v10 || '-'}</td>
                <td style="text-align:right; background:#fef9c3;">${b.v13 || '-'}</td>
                <td style="text-align:right;">${b.v15 || '-'}</td>
                <td style="text-align:right;">${b.v18 || '-'}</td>
                <td style="text-align:right; font-weight:bold;">${b.v_final || b.latestVotes || '-'}</td>
                <td style="font-weight:bold; color:#1d4ed8;">${b.turnoutPct}%</td>
                <td>${b.magistrate} (${b.magistrate_mob})</td>
            </tr>
        `;
    });
    tbody.innerHTML = rows;
}

// -------------------------------------------------------------
// DATA ENTRY
// -------------------------------------------------------------
// DATA ENTRY (ZONE-WISE SYSTEM)
// -------------------------------------------------------------
let currentEntryZone = 'ALL';

function selectEntryZone(zoneId) {
    currentEntryZone = zoneId;
    document.querySelectorAll('.entry-zone-pill').forEach(pill => {
        pill.classList.toggle('active', pill.id === `ezPill_${zoneId}`);
    });
    updateEntryZoneBanner(zoneId);
    renderEntryTable();
}

function updateEntryZoneBanner(zoneId) {
    const titleEl = document.getElementById('ezbTitle');
    const magEl = document.getElementById('ezbMagistrate');
    const mobEl = document.getElementById('ezbMobile');
    const bvEl = document.getElementById('ezbBoothsVoters');

    if (!titleEl || !liveData) return;

    if (zoneId === 'ALL') {
        titleEl.innerHTML = '<i class="fas fa-location-dot"></i> <span>समस्त 10 ज़ोन (सुमेरपुर क्षेत्र)</span>';
        magEl.innerHTML = '<i class="fas fa-user-tie" style="color:#0284c7;"></i> <b>ज़ोनल मजिस्ट्रेट:</b> <span>10 मजिस्ट्रेट फील्ड में सक्रिय</span>';
        mobEl.innerHTML = '<i class="fas fa-phone" style="color:#10b981;"></i> <b>कंट्रोल रूम:</b> <span>02933-258322</span>';
        bvEl.innerHTML = `<i class="fas fa-users" style="color:#8b5cf6;"></i> <b>बूथ व मतदाता:</b> <span>${liveData.booths.length} केंद्र | ${liveData.kpi.totalElectors.toLocaleString('en-IN')} मतदाता</span>`;
    } else {
        const z = liveData.zones ? liveData.zones.find(x => x.zone_id === zoneId) : null;
        const zBooths = liveData.booths.filter(b => b.zone === zoneId);
        let zElectors = 0;
        let zVotes = 0;
        zBooths.forEach(b => { zElectors += b.electors; zVotes += (b.latestVotes || 0); });
        const zPct = zElectors > 0 ? ((zVotes / zElectors) * 100).toFixed(2) : '0.00';

        const magName = z ? z.magistrate : 'जोनल मजिस्ट्रेट';
        const magMob = z ? z.mobile : '';
        const zName = z ? z.name : zoneId;

        titleEl.innerHTML = `<i class="fas fa-location-dot"></i> <span>${zoneId} : ${zName}</span>`;
        magEl.innerHTML = `<i class="fas fa-user-tie" style="color:#0284c7;"></i> <b>ज़ोनल मजिस्ट्रेट:</b> <span>${magName}</span>`;
        mobEl.innerHTML = `<i class="fas fa-phone" style="color:#10b981;"></i> <b>मोबाइल:</b> ${magMob ? `<a href="tel:${magMob}" style="color:#0284c7; font-weight:700;">📞 ${magMob}</a>` : 'कंट्रोल रूम'}`;
        bvEl.innerHTML = `<i class="fas fa-chart-line" style="color:#8b5cf6;"></i> <b>प्रगति:</b> <span>${zBooths.length} केंद्र | ${zElectors.toLocaleString('en-IN')} मतदाता | <b>${zPct}% मतदान</b></span>`;
    }
}

function prevEntryZone() {
    const zones = ['ALL', 'Zone-1', 'Zone-2', 'Zone-3', 'Zone-4', 'Zone-5', 'Zone-6', 'Zone-7', 'Zone-8', 'Zone-9', 'Zone-10'];
    let idx = zones.indexOf(currentEntryZone);
    idx = (idx - 1 + zones.length) % zones.length;
    selectEntryZone(zones[idx]);
}

function nextEntryZone() {
    const zones = ['ALL', 'Zone-1', 'Zone-2', 'Zone-3', 'Zone-4', 'Zone-5', 'Zone-6', 'Zone-7', 'Zone-8', 'Zone-9', 'Zone-10'];
    let idx = zones.indexOf(currentEntryZone);
    idx = (idx + 1) % zones.length;
    selectEntryZone(zones[idx]);
}

function renderEntryTable() {
    const tbody = document.getElementById('entryBoothsTbody');
    const notice = document.getElementById('entryRoleNotice');
    if (!tbody || !liveData || !liveData.booths) return;

    let boothsToDisplay = liveData.booths;
    if (currentEntryZone !== 'ALL') {
        boothsToDisplay = boothsToDisplay.filter(b => b.zone === currentEntryZone);
    }

    // Populate GP dropdown if needed
    const gpSelect = document.getElementById('entryGpSelect');
    if (gpSelect && gpSelect.options.length <= 1) {
        const uniqueGps = [...new Set(liveData.booths.map(b => b.gp_name))].sort();
        uniqueGps.forEach(gp => {
            const opt = document.createElement('option');
            opt.value = gp;
            opt.textContent = gp;
            gpSelect.appendChild(opt);
        });
    }

    const selectedGp = gpSelect ? gpSelect.value : 'ALL';
    if (selectedGp !== 'ALL') {
        boothsToDisplay = boothsToDisplay.filter(b => b.gp_name === selectedGp);
    }

    const searchInput = document.getElementById('entrySearchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (searchTerm) {
        boothsToDisplay = boothsToDisplay.filter(b => 
            String(b.id).toLowerCase().includes(searchTerm) ||
            (b.gp_name && b.gp_name.toLowerCase().includes(searchTerm)) ||
            (b.location && b.location.toLowerCase().includes(searchTerm)) ||
            (b.magistrate && b.magistrate.toLowerCase().includes(searchTerm))
        );
    }

    const countEl = document.getElementById('entryFilteredCountText');
    if (countEl) {
        countEl.textContent = `प्रदर्शित: ${boothsToDisplay.length} / ${liveData.booths.length} मतदान केंद्र`;
    }

    if (notice) {
        if (currentEntryZone === 'ALL') {
            notice.textContent = `समस्त 10 ज़ोन के ${boothsToDisplay.length} मतदान केंद्र प्रदर्शित हैं।`;
        } else {
            notice.textContent = `${currentEntryZone} के ${boothsToDisplay.length} मतदान केंद्र प्रदर्शित हैं।`;
        }
    }

    let rows = '';
    boothsToDisplay.forEach(b => {
        rows += `
            <tr data-booth="${b.id}" id="zoneRow_${b.id}">
                <td style="font-weight:bold; color:#1e3a8a;">${b.id}</td>
                <td><strong>${b.gp_name}</strong><br><small class="text-muted">${b.zone}</small></td>
                <td class="cell-location" style="text-align:left; font-size:12.5px; line-height:1.4; white-space:normal; min-width:260px; word-break:break-word;" title="${b.location}">
                    <strong>${b.location}</strong>
                    <div style="font-size:11px; color:#64748b; margin-top:2px;">वार्ड: ${b.ps_ward || ''} / ${b.zp_ward || ''}</div>
                </td>
                <td style="text-align:right; font-weight:bold;">${b.electors.toLocaleString('en-IN')}</td>
                <td>
                    <input type="checkbox" id="start_${b.id}" ${b.started ? 'checked' : ''} onchange="updateBoothInputsLock('${b.id}'); validateLiveBoothRow('${b.id}');">
                </td>
                <td><input type="number" class="vote-input" id="v10_${b.id}" value="${b.v10 || ''}" min="0" max="${b.electors}" style="width:70px;" oninput="validateLiveBoothRow('${b.id}', 'v10')"></td>
                <td style="background:#fef9c3;"><input type="number" class="vote-input" id="v13_${b.id}" value="${b.v13 || ''}" min="0" max="${b.electors}" style="width:70px;" oninput="validateLiveBoothRow('${b.id}', 'v13')"></td>
                <td><input type="number" class="vote-input" id="v15_${b.id}" value="${b.v15 || ''}" min="0" max="${b.electors}" style="width:70px;" oninput="validateLiveBoothRow('${b.id}', 'v15')"></td>
                <td><input type="number" class="vote-input" id="v18_${b.id}" value="${b.v18 || ''}" min="0" max="${b.electors}" style="width:70px;" oninput="validateLiveBoothRow('${b.id}', 'v18')"></td>
                <td><input type="number" class="vote-input" id="vq_${b.id}" value="${b.v_queue || ''}" min="0" style="width:55px;" oninput="validateLiveBoothRow('${b.id}', 'vq')"></td>
                <td><input type="number" class="vote-input" id="vfin_${b.id}" value="${b.v_final || ''}" min="0" max="${b.electors}" style="width:70px;" oninput="validateLiveBoothRow('${b.id}', 'vfin')"></td>
                <td style="font-weight:bold; color:#1d4ed8;" id="turnout_${b.id}">${b.turnoutPct}%</td>
                <td><input type="text" id="rem_${b.id}" value="${b.remark || ''}" style="width:90px; padding:4px;"></td>
                <td>
                    <button class="btn-primary" style="padding:4px 8px; font-size:11px;" onclick="saveSingleBoothEntry('${b.id}')" title="सुरक्षित करें">
                        <i class="fas fa-save"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = rows;

    boothsToDisplay.forEach(b => {
        updateBoothInputsLock(b.id);
        validateLiveBoothRow(b.id);
    });
}

// -------------------------------------------------------------
// DEDICATED VOTING STATS (ZP & PS WARD WISE)
// -------------------------------------------------------------
let currentStatsCategory = 'zp';

function switchStatsCategory(cat) {
    currentStatsCategory = cat;
    ['zp', 'ps', 'zones', 'gps'].forEach(c => {
        const btn = document.getElementById(`btnStats${c.charAt(0).toUpperCase() + c.slice(1)}`);
        const cont = document.getElementById(`stats${c.charAt(0).toUpperCase() + c.slice(1)}Container`);
        if (btn) btn.className = c === cat ? 'btn-primary' : 'btn-secondary';
        if (cont) cont.style.display = c === cat ? 'block' : 'none';
    });
    renderStatsPage();
}

function getZpWardStats() {
    if (!liveData || !liveData.booths) return [];
    const zpDefs = [
        { id: 'Z-7', name: 'जिला परिषद वार्ड संख्या 7 (चाणौद, अनोपपुरा, बड़गावड़ा, पावा)' },
        { id: 'Z-8', name: 'जिला परिषद वार्ड संख्या 8 (साण्डेराव, कोसेलाव, बिरामी, देवतरा)' },
        { id: 'Z-9', name: 'जिला परिषद वार्ड संख्या 9 (खिवांदी, पालड़ी, दुजाना, खिमाड़ा)' },
        { id: 'Z-10', name: 'जिला परिषद वार्ड संख्या 10 (भारून्दा, नोवी, बांकली, कोरटा)' }
    ];
    const zpMap = {};
    zpDefs.forEach(d => {
        zpMap[d.id] = { id: d.id, name: d.name, electors: 0, votes: 0, booths: [], gps: new Set() };
    });

    liveData.booths.forEach(b => {
        const zw = b.zp_ward || 'Z-7';
        if (!zpMap[zw]) {
            zpMap[zw] = { id: zw, name: `जिला परिषद वार्ड ${zw}`, electors: 0, votes: 0, booths: [], gps: new Set() };
        }
        zpMap[zw].electors += b.electors;
        zpMap[zw].votes += (b.latestVotes || 0);
        zpMap[zw].booths.push(b);
        if (b.gp_name) zpMap[zw].gps.add(b.gp_name);
    });

    return Object.values(zpMap).map(w => ({
        ...w,
        boothCount: w.booths.length,
        turnoutPct: w.electors > 0 ? Number(((w.votes / w.electors) * 100).toFixed(2)) : 0,
        gpsList: Array.from(w.gps).join(', ')
    }));
}

function getPsWardStats() {
    if (!liveData || !liveData.booths) return [];
    const psMap = {};
    for (let i = 1; i <= 21; i++) {
        const wid = `W-${i}`;
        psMap[wid] = { id: wid, num: i, name: `पं.स. वार्ड संख्या ${i}`, electors: 0, votes: 0, booths: [], gps: new Set() };
    }

    liveData.booths.forEach(b => {
        const pw = b.ps_ward || 'W-1';
        if (!psMap[pw]) {
            const num = parseInt(pw.replace(/\D/g, '')) || 0;
            psMap[pw] = { id: pw, num: num, name: `पं.स. वार्ड ${num}`, electors: 0, votes: 0, booths: [], gps: new Set() };
        }
        psMap[pw].electors += b.electors;
        psMap[pw].votes += (b.latestVotes || 0);
        psMap[pw].booths.push(b);
        if (b.gp_name) psMap[pw].gps.add(b.gp_name);
    });

    return Object.values(psMap)
        .sort((a,b) => a.num - b.num)
        .map(w => ({
            ...w,
            boothCount: w.booths.length,
            turnoutPct: w.electors > 0 ? Number(((w.votes / w.electors) * 100).toFixed(2)) : 0,
            gpsList: Array.from(w.gps).join(', ')
        }));
}

function renderStatsPage() {
    if (!liveData) return;
    if (currentStatsCategory === 'zp') renderStatsZp();
    else if (currentStatsCategory === 'ps') renderStatsPs();
    else if (currentStatsCategory === 'zones') renderStatsZones();
    else if (currentStatsCategory === 'gps') renderStatsGpsTable();
}

function renderStatsZp() {
    const container = document.getElementById('zpWardsGridContainer');
    if (!container) return;
    const zpStats = getZpWardStats();
    let html = '';
    zpStats.forEach(z => {
        html += `
            <div class="ward-stats-card zp-card">
                <div class="wsc-header">
                    <div>
                        <div class="wsc-title"><i class="fas fa-landmark" style="color:#7c3aed;"></i> ${z.id} : ${z.name}</div>
                        <div class="wsc-sub">${z.boothCount} मतदान केंद्र | सुमेरपुर क्षेत्र</div>
                    </div>
                    <div class="wsc-pct">${z.turnoutPct}%</div>
                </div>
                <div class="wsc-bar-bg">
                    <div class="wsc-bar-fill" style="width: ${Math.min(100, Math.max(2, z.turnoutPct))}%; background: linear-gradient(90deg, #7c3aed 0%, #10b981 100%);"></div>
                </div>
                <div class="wsc-stats-row">
                    <div class="wsc-stats-col">
                        <span>कुल मतदाता</span>
                        <b>${z.electors.toLocaleString('en-IN')}</b>
                    </div>
                    <div class="wsc-stats-col">
                        <span>डाले गए मत</span>
                        <b style="color:#7c3aed;">${z.votes.toLocaleString('en-IN')}</b>
                    </div>
                    <div class="wsc-stats-col">
                        <span>मतदान प्रतिशत</span>
                        <b style="color:#059669;">${z.turnoutPct}%</b>
                    </div>
                </div>
                <div class="wsc-gps">
                    <b>शामिल पंचायतें:</b> ${z.gpsList || 'समस्त संबंधित पंचायतें'}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderStatsPs() {
    const container = document.getElementById('psWardsGridContainer');
    if (!container) return;
    const psStats = getPsWardStats();
    let html = '';
    psStats.forEach(p => {
        html += `
            <div class="ward-stats-card ps-card">
                <div class="wsc-header">
                    <div>
                        <div class="wsc-title"><i class="fas fa-building-columns" style="color:#0284c7;"></i> ${p.name}</div>
                        <div class="wsc-sub">${p.boothCount} बूथ | पं.स. सुमेरपुर</div>
                    </div>
                    <div class="wsc-pct">${p.turnoutPct}%</div>
                </div>
                <div class="wsc-bar-bg">
                    <div class="wsc-bar-fill" style="width: ${Math.min(100, Math.max(2, p.turnoutPct))}%;"></div>
                </div>
                <div class="wsc-stats-row">
                    <div class="wsc-stats-col">
                        <span>वोटर</span>
                        <b>${p.electors.toLocaleString('en-IN')}</b>
                    </div>
                    <div class="wsc-stats-col">
                        <span>मत</span>
                        <b style="color:#0284c7;">${p.votes.toLocaleString('en-IN')}</b>
                    </div>
                    <div class="wsc-stats-col">
                        <span>प्रतिशत</span>
                        <b style="color:#059669;">${p.turnoutPct}%</b>
                    </div>
                </div>
                <div class="wsc-gps">
                    <b>ग्राम पंचायत:</b> ${p.gpsList}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderStatsZones() {
    const container = document.getElementById('statsZonesGridContainer');
    if (!container || !liveData || !liveData.zones) return;
    let html = '';
    liveData.zones.forEach(z => {
        html += `
            <div class="ward-stats-card" style="border-top: 4px solid #10b981;">
                <div class="wsc-header">
                    <div>
                        <div class="wsc-title">📍 ${z.zone_id} : ${z.name}</div>
                        <div class="wsc-sub"><i class="fas fa-user-shield"></i> ${z.magistrate} (📞 ${z.mobile})</div>
                    </div>
                    <div class="wsc-pct" style="color:#059669;">${z.turnoutPct}%</div>
                </div>
                <div class="wsc-bar-bg">
                    <div class="wsc-bar-fill" style="width: ${Math.min(100, Math.max(2, parseFloat(z.turnoutPct) || 0))}%; background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%);"></div>
                </div>
                <div class="wsc-stats-row">
                    <div class="wsc-stats-col">
                        <span>मतदाता</span>
                        <b>${z.electors.toLocaleString('en-IN')}</b>
                    </div>
                    <div class="wsc-stats-col">
                        <span>डाले गए मत</span>
                        <b>${z.votes.toLocaleString('en-IN')}</b>
                    </div>
                    <div class="wsc-stats-col">
                        <span>बूथ</span>
                        <b>${z.booth_count || 15}</b>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderStatsGpsTable() {
    const tbody = document.getElementById('statsGpsTbody');
    if (!tbody || !liveData || !liveData.booths) return;

    const searchTerm = (document.getElementById('statsGpSearch')?.value || '').trim().toLowerCase();

    const gpMap = {};
    liveData.booths.forEach(b => {
        if (!gpMap[b.gp_name]) {
            gpMap[b.gp_name] = {
                name: b.gp_name,
                zone: b.zone,
                zp_ward: b.zp_ward,
                ps_ward: b.ps_ward,
                boothCount: 0,
                electors: 0,
                votes: 0
            };
        }
        gpMap[b.gp_name].boothCount++;
        gpMap[b.gp_name].electors += b.electors;
        gpMap[b.gp_name].votes += (b.latestVotes || 0);
    });

    let gps = Object.values(gpMap);
    if (searchTerm) {
        gps = gps.filter(g => g.name.toLowerCase().includes(searchTerm) || g.zone.toLowerCase().includes(searchTerm));
    }

    gps.sort((a,b) => {
        const pa = a.electors > 0 ? (a.votes / a.electors) : 0;
        const pb = b.electors > 0 ? (b.votes / b.electors) : 0;
        return pb - pa;
    });

    let html = '';
    gps.forEach((g, idx) => {
        const pct = g.electors > 0 ? ((g.votes / g.electors) * 100).toFixed(2) : '0.00';
        html += `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${g.name}</strong></td>
                <td><span class="badge-zone">${g.zone}</span></td>
                <td><span style="font-weight:600; color:#7c3aed;">${g.zp_ward || '-'}</span></td>
                <td><span style="font-weight:600; color:#0284c7;">${g.ps_ward || '-'}</span></td>
                <td>${g.boothCount}</td>
                <td style="text-align:right;">${g.electors.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:bold;">${g.votes.toLocaleString('en-IN')}</td>
                <td style="text-align:right; font-weight:bold; color:#1e40af;">${pct}%</td>
                <td>
                    <div style="background:#e2e8f0; height:6px; width:80px; border-radius:3px; overflow:hidden;">
                        <div style="background:#2563eb; height:100%; width:${Math.min(100, parseFloat(pct) || 0)}%;"></div>
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function updateBoothInputsLock(boothId) {
    const startEl = document.getElementById(`start_${boothId}`);
    if (!startEl) return;
    const isStarted = startEl.checked;
    const ids = [`v10_${boothId}`, `v13_${boothId}`, `v15_${boothId}`, `v18_${boothId}`, `vq_${boothId}`, `vfin_${boothId}`];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (isStarted) {
            el.classList.remove('input-locked-mock');
            el.disabled = false;
            el.placeholder = '0';
        } else {
            el.classList.add('input-locked-mock');
            el.disabled = true;
            el.placeholder = '🔒 Start';
            el.title = "कृपया पहले मतदान प्रारंभ चेक करें।";
        }
    });
}

function validateLiveBoothRow(boothId, changedField) {
    const booth = liveData && liveData.booths ? liveData.booths.find(b => String(b.id) === String(boothId)) : null;
    if (!booth) return;
    const electors = booth.electors;

    const startEl = document.getElementById(`start_${boothId}`);
    const el10 = document.getElementById(`v10_${boothId}`);
    const el13 = document.getElementById(`v13_${boothId}`);
    const el15 = document.getElementById(`v15_${boothId}`);
    const el18 = document.getElementById(`v18_${boothId}`);
    const elQ = document.getElementById(`vq_${boothId}`);
    const elFin = document.getElementById(`vfin_${boothId}`);
    const turnoutEl = document.getElementById(`turnout_${boothId}`);

    const isStarted = startEl ? startEl.checked : true;
    const num10 = el10 && el10.value !== '' ? parseInt(el10.value, 10) : null;
    const num13 = el13 && el13.value !== '' ? parseInt(el13.value, 10) : null;
    const num15 = el15 && el15.value !== '' ? parseInt(el15.value, 10) : null;
    const num18 = el18 && el18.value !== '' ? parseInt(el18.value, 10) : null;
    const numQ = elQ && elQ.value !== '' ? parseInt(elQ.value, 10) : 0;
    let numFin = elFin && elFin.value !== '' ? parseInt(elFin.value, 10) : null;

    if (changedField === 'v18' && num18 !== null && (numFin === null || (elFin && elFin.value === ''))) {
        if (elFin) {
            elFin.value = num18 + (numQ || 0);
            numFin = num18 + (numQ || 0);
        }
    }

    if (turnoutEl && electors > 0) {
        const latest = numFin !== null ? numFin : (num18 !== null ? num18 : (num15 !== null ? num15 : (num13 !== null ? num13 : (num10 !== null ? num10 : 0))));
        const pct = ((latest / electors) * 100).toFixed(2);
        turnoutEl.textContent = `${pct}%`;
    }

    const slots = [
        { name: '10:00 AM', el: el10, val: num10 },
        { name: '01:00 PM', el: el13, val: num13 },
        { name: '03:00 PM', el: el15, val: num15 },
        { name: '06:00 PM', el: el18, val: num18 },
        { name: 'अंतिम मत', el: elFin, val: numFin }
    ];

    slots.forEach(s => {
        if (s.el) {
            s.el.classList.remove('input-invalid');
            s.el.title = '';
        }
    });

    const hasVotes = slots.some(s => s.val !== null);
    if (hasVotes && !isStarted) {
        slots.forEach(s => {
            if (s.el && s.val !== null) {
                s.el.classList.add('input-invalid');
                s.el.title = `त्रुटि: कृपया पहले 07:15 AM मतदान प्रारंभ चेक करें!`;
            }
        });
    }

    slots.forEach(s => {
        if (s.el && s.val !== null) {
            if (isNaN(s.val) || s.val < 0) {
                s.el.classList.add('input-invalid');
                s.el.title = `त्रुटि: ${s.name} में अमान्य संख्या!`;
            } else if (s.val > electors) {
                s.el.classList.add('input-invalid');
                s.el.title = `त्रुटि: ${s.name} के मत (${s.val}) कुल मतदाताओं (${electors}) से अधिक हैं!`;
            }
        }
    });

    let prev = null;
    for (const s of slots) {
        if (s.val !== null && !isNaN(s.val)) {
            if (prev !== null && s.val < prev.val) {
                if (s.el) {
                    s.el.classList.add('input-invalid');
                    s.el.title = `त्रुटि: ${s.name} के मत (${s.val}) पिछले स्लॉट ${prev.name} (${prev.val}) से कम नहीं हो सकते!`;
                }
            }
            prev = s;
        }
    }
}

function validateSingleBoothEntry(boothId) {
    const booth = liveData && liveData.booths ? liveData.booths.find(b => String(b.id) === String(boothId)) : null;
    if (!booth) return { valid: true };
    const electors = booth.electors;

    const startEl = document.getElementById(`start_${boothId}`);
    const el10 = document.getElementById(`v10_${boothId}`);
    const el13 = document.getElementById(`v13_${boothId}`);
    const el15 = document.getElementById(`v15_${boothId}`);
    const el18 = document.getElementById(`v18_${boothId}`);
    const elFin = document.getElementById(`vfin_${boothId}`);

    const isStarted = startEl ? startEl.checked : true;
    const num10 = el10 && el10.value !== '' ? parseInt(el10.value, 10) : null;
    const num13 = el13 && el13.value !== '' ? parseInt(el13.value, 10) : null;
    const num15 = el15 && el15.value !== '' ? parseInt(el15.value, 10) : null;
    const num18 = el18 && el18.value !== '' ? parseInt(el18.value, 10) : null;
    const numFin = elFin && elFin.value !== '' ? parseInt(elFin.value, 10) : null;

    const hasVotes = (num10 !== null || num13 !== null || num15 !== null || num18 !== null || numFin !== null);

    if (hasVotes && !isStarted) {
        return {
            valid: false,
            message: `⛔ बूथ संख्या ${boothId} (${booth.name || booth.gp_name}):\n\nकृपया पहले '07:15 AM मतदान प्रारंभ' चेक करें!\n\nजब तक मतदान प्रारंभ नहीं होता, तब तक आगे के समय स्लॉट का डेटा दर्ज नहीं किया जा सकता।`,
            focusEl: startEl
        };
    }

    const slots = [
        { name: '10:00 AM', el: el10, val: num10 },
        { name: '01:00 PM', el: el13, val: num13 },
        { name: '03:00 PM', el: el15, val: num15 },
        { name: '06:00 PM', el: el18, val: num18 },
        { name: 'अंतिम मत', el: elFin, val: numFin }
    ];

    for (const s of slots) {
        if (s.val !== null) {
            if (isNaN(s.val) || s.val < 0) {
                return {
                    valid: false,
                    message: `⛔ बूथ संख्या ${boothId}:\n\n${s.name} में दर्ज संख्या अमान्य है!`,
                    focusEl: s.el
                };
            }
            if (s.val > electors) {
                return {
                    valid: false,
                    message: `⛔ बूथ संख्या ${boothId} (${booth.gp_name}):\n\n${s.name} के मत (${s.val}) कुल मतदाताओं (${electors}) से अधिक नहीं हो सकते!`,
                    focusEl: s.el
                };
            }
        }
    }

    let lastFilled = null;
    for (const s of slots) {
        if (s.val !== null) {
            if (lastFilled !== null && s.val < lastFilled.val) {
                return {
                    valid: false,
                    message: `⛔ बूथ संख्या ${boothId} (${booth.gp_name}):\n\n${s.name} के मत (${s.val}) पिछले स्लॉट ${lastFilled.name} के मतों (${lastFilled.val}) से कम नहीं हो सकते!\n\n(मतदान के आंकड़े क्रमानुसार बराबर या बढ़ते क्रम में होने चाहिए)`,
                    focusEl: s.el
                };
            }
            lastFilled = s;
        }
    }

    return { valid: true };
}

async function saveSingleBoothEntry(boothId) {
    const valRes = validateSingleBoothEntry(boothId);
    if (!valRes.valid) {
        alert(valRes.message);
        if (valRes.focusEl) {
            valRes.focusEl.focus();
            if (valRes.focusEl.select) valRes.focusEl.select();
        }
        return;
    }

    const started = document.getElementById(`start_${boothId}`).checked;
    const v10 = document.getElementById(`v10_${boothId}`).value;
    const v13 = document.getElementById(`v13_${boothId}`).value;
    const v15 = document.getElementById(`v15_${boothId}`).value;
    const v18 = document.getElementById(`v18_${boothId}`).value;
    const v_queue = document.getElementById(`vq_${boothId}`).value;
    const v_final = document.getElementById(`vfin_${boothId}`).value;
    const remark = document.getElementById(`rem_${boothId}`).value;

    const payload = {
        date: selectedDate,
        updated_by: currentUser ? currentUser.name : 'Operator',
        started,
        v10: v10 === '' ? '' : parseInt(v10, 10),
        v13: v13 === '' ? '' : parseInt(v13, 10),
        v15: v15 === '' ? '' : parseInt(v15, 10),
        v18: v18 === '' ? '' : parseInt(v18, 10),
        v_queue: v_queue === '' ? '' : parseInt(v_queue, 10),
        v_final: v_final === '' ? '' : parseInt(v_final, 10),
        remark
    };

    try {
        const res = await fetch(`/api/booth/${boothId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        if (d.success) {
            const row = document.getElementById(`zoneRow_${boothId}`);
            if (row) {
                row.style.background = '#dcfce7';
                setTimeout(() => { row.style.background = ''; }, 2000);
            }
            showToast(`बूथ ${boothId} सुरक्षित`, `मतदान केंद्र संख्या ${boothId} का मतदान विवरण सफलतापूर्वक सेव हो गया है!`, 'success', 3500);
            fetchData();
        } else {
            showToast('सेव असफल', d.message || 'त्रुटि उत्पन्न हुई', 'error', 4000);
        }
    } catch (e) {
        showToast('डेटा सेव असफल', e.message, 'error', 4000);
    }
}

async function saveAllEntryRows() {
    // Validate all rows first
    const rows = document.querySelectorAll('#entryBoothsTbody tr');
    for (const tr of rows) {
        const bid = tr.getAttribute('data-booth');
        if (!bid) continue;
        const valRes = validateSingleBoothEntry(bid);
        if (!valRes.valid) {
            showToast('सत्यापन त्रुटि', valRes.message.replace(/\n\n/g, ' — '), 'warning', 6000);
            if (valRes.focusEl) {
                valRes.focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                valRes.focusEl.focus();
                if (valRes.focusEl.select) valRes.focusEl.select();
            }
            return;
        }
    }

    const updates = [];
    rows.forEach(tr => {
        const bid = tr.getAttribute('data-booth');
        if (!bid) return;
        updates.push({
            id: bid,
            started: document.getElementById(`start_${bid}`).checked,
            v10: document.getElementById(`v10_${bid}`).value === '' ? '' : parseInt(document.getElementById(`v10_${bid}`).value, 10),
            v13: document.getElementById(`v13_${bid}`).value === '' ? '' : parseInt(document.getElementById(`v13_${bid}`).value, 10),
            v15: document.getElementById(`v15_${bid}`).value === '' ? '' : parseInt(document.getElementById(`v15_${bid}`).value, 10),
            v18: document.getElementById(`v18_${bid}`).value === '' ? '' : parseInt(document.getElementById(`v18_${bid}`).value, 10),
            v_queue: document.getElementById(`vq_${bid}`).value === '' ? '' : parseInt(document.getElementById(`vq_${bid}`).value, 10),
            v_final: document.getElementById(`vfin_${bid}`).value === '' ? '' : parseInt(document.getElementById(`vfin_${bid}`).value, 10),
            remark: document.getElementById(`rem_${bid}`).value
        });
    });

    try {
        const res = await fetch('/api/booths/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate, updates })
        });
        const d = await res.json();
        if (d.success) {
            showToast('समस्त प्रविष्टियाँ सुरक्षित!', `सफलतापूर्वक प्रदर्शित सभी ${d.count} बूथों का डेटा सुरक्षित (Saved) कर दिया गया!`, 'success', 4500);
            fetchData();
        } else {
            showToast('सेव असफल', d.message || 'त्रुटि उत्पन्न हुई', 'error', 4000);
        }
    } catch (e) {
        showToast('त्रुटि', e.message, 'error', 4000);
    }
}

// -------------------------------------------------------------
// TOAST NOTIFICATIONS
// -------------------------------------------------------------
function showToast(title, message = '', type = 'success', duration = 4000) {
    if (['success', 'error', 'info', 'warning'].includes(message)) {
        type = message;
        message = '';
    }
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation'
    };

    const icon = icons[type] || icons.success;

    const toast = document.createElement('div');
    toast.className = `toast-card toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${icon}"></i></div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-msg">${message}</div>` : ''}
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// -------------------------------------------------------------
// GOOGLE SHEET AUTO-SYNC & AUTO-FILL SYSTEM
// -------------------------------------------------------------
let googleAutoSyncTimer = null;
const CURRENT_GOOGLE_SHEET_ID = '1akpSIbiSWMT5XahHoZnCZiCS_yFrBThkoI_Ltys2tGY';
const CURRENT_GOOGLE_SHEET_GID = '1529625107';

async function triggerGoogleSheetSync() {
    const btnHeader = document.getElementById('btnHeaderSyncGoogle');
    const btnEntry = document.getElementById('btnEntrySyncGoogle');
    [btnHeader, btnEntry].forEach(b => {
        if (b) {
            b.classList.add('spinning');
            b.disabled = true;
        }
    });

    const statusEl = document.getElementById('entrySyncStatusText');
    const timeEl = document.getElementById('entrySyncTimeText');
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin" style="color:#0284c7;"></i> Google Sheet से डेटा लाया जा रहा है...';

    try {
        const res = await fetch(`/api/sync-google-sheet?sheetId=${CURRENT_GOOGLE_SHEET_ID}&gid=${CURRENT_GOOGLE_SHEET_GID}&date=${selectedDate}`);
        const data = await res.json();

        if (data.success) {
            showToast('Google Sheet सिंक सफल!', data.message, 'success', 5000);
            if (statusEl) statusEl.innerHTML = `<i class="fas fa-circle-check" style="color:#16a34a;"></i> 10 AM, 1 PM, 3 PM, 6 PM सिंक (${data.updatedCount}/152 बूथ)`;
            if (timeEl) timeEl.textContent = `अंतिम सिंक: ${new Date().toLocaleTimeString('en-IN')}`;
            fetchData();
        } else if (data.error === 'UNAUTHORIZED') {
            showToast('Google Sheet परमिशन आवश्यक', 'Google Sheet Restricted है। कृपया "Share" दबाकर "Anyone with the link can view" करें।', 'warning', 7000);
            openGoogleSheetHelpModal();
            if (statusEl) statusEl.innerHTML = '<i class="fas fa-triangle-exclamation" style="color:#f59e0b;"></i> शीट परमिशन आवश्यक (Share -> Anyone with link)';
        } else {
            showToast('सिंक त्रुटि', data.message || 'Google Sheet कनेक्ट नहीं हो सकी', 'error', 5000);
            if (statusEl) statusEl.innerHTML = `<i class="fas fa-circle-xmark" style="color:#ef4444;"></i> सिंक विफल (${data.error || 'Error'})`;
        }
    } catch (err) {
        showToast('कनेक्शन त्रुटि', err.message, 'error', 4000);
        if (statusEl) statusEl.innerHTML = `<i class="fas fa-circle-xmark" style="color:#ef4444;"></i> नेटवर्क त्रुटि`;
    } finally {
        [btnHeader, btnEntry].forEach(b => {
            if (b) {
                b.classList.remove('spinning');
                b.disabled = false;
            }
        });
    }
}

function toggleGoogleAutoSync(enabled) {
    const entryToggle = document.getElementById('entryAutoSyncToggle');
    if (entryToggle) entryToggle.checked = enabled;

    if (googleAutoSyncTimer) {
        clearInterval(googleAutoSyncTimer);
        googleAutoSyncTimer = null;
    }

    if (enabled) {
        showToast('ऑटो-सिंक सक्रिय', 'अब प्रत्येक 30 सेकंड में Google Sheet से डेटा (1 PM, 3 PM, 6 PM, Final) स्वतः ऑटो-फ़िल होगा।', 'info', 4000);
        triggerGoogleSheetSync();
        googleAutoSyncTimer = setInterval(() => {
            triggerGoogleSheetSync();
        }, 30000);
    } else {
        showToast('ऑटो-सिंक बंद', 'स्वचालित सिंक रोक दिया गया है।', 'info', 2500);
    }
}

function openGoogleSheetHelpModal() {
    const modal = document.getElementById('googleSheetHelpModal');
    if (modal) modal.style.display = 'flex';
}

function closeGoogleSheetHelpModal() {
    const modal = document.getElementById('googleSheetHelpModal');
    if (modal) modal.style.display = 'none';
}

async function handleExcelFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showToast('फ़ाइल प्रोसेस हो रही है...', `${file.name} से डेटा लोड किया जा रहा है`, 'info', 3000);

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let csvText = '';
            if (file.name.endsWith('.csv')) {
                csvText = e.target.result;
            } else {
                if (typeof XLSX === 'undefined') {
                    showToast('XLSX लाइब्रेरी लोड नहीं हुई', 'कृपया CSV फ़ाइल का उपयोग करें या पेज रिफ्रेश करें।', 'error', 4000);
                    return;
                }
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames.find(n => n.includes('BOOTH_ENTRY') || n.includes('22-OCT')) || workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                csvText = XLSX.utils.sheet_to_csv(worksheet);
            }

            const res = await fetch('/api/sync-csv-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ csvText, dateKey: selectedDate })
            });
            const d = await res.json();
            if (d.success) {
                showToast('फ़ाइल सिंक सफल!', `${file.name} से ${d.updatedCount} बूथों का डेटा (10 AM, 1 PM, 3 PM, 6 PM, Final) स्वतः भर दिया गया!`, 'success', 5000);
                fetchData();
            } else {
                showToast('फ़ाइल सिंक त्रुटि', d.message || 'डेटा प्रोसेस नहीं हो सका', 'error', 4000);
            }
        } catch (err) {
            showToast('फ़ाइल प्रोसेसिंग त्रुटि', err.message, 'error', 4000);
        }
    };

    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
}


function markAllZoneStarted() {
    document.querySelectorAll('#entryBoothsTbody input[type="checkbox"]').forEach(cb => cb.checked = true);
    saveAllEntryRows();
}

// -------------------------------------------------------------
// 10 ZONES
// -------------------------------------------------------------
function renderZonesPage() {
    const grid = document.getElementById('zonesCardsGrid');
    let html = '';

    liveData.zones.forEach(z => {
        html += `
            <div style="background:#ffffff; border:1px solid var(--border); border-radius:10px; padding:16px; box-shadow:var(--shadow-sm);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="badge-zone" style="font-size:13px; font-weight:bold;">${z.zone_id}</span>
                    <span class="pct-badge pct-high" style="font-size:13px;">${z.turnoutPct}%</span>
                </div>
                <h4 style="margin:0 0 6px; font-size:15px;">${z.name}</h4>
                <div style="font-size:12.5px; color:#475569; line-height:1.6;">
                    • <b>ज़ोनल मजिस्ट्रेट:</b> ${z.magistrate}<br>
                    • <b>मोबाइल:</b> <a href="tel:${z.mobile}" style="color:#2563eb; font-weight:bold;">📞 ${z.mobile}</a><br>
                    • <b>मतदान केंद्र:</b> ${z.booth_count} (${z.booths_range})<br>
                    • <b>मतदाता:</b> ${z.voters.toLocaleString('en-IN')} | <b>पड़े मत:</b> ${z.votes.toLocaleString('en-IN')}
                </div>
                <div style="background:#e2e8f0; border-radius:6px; height:8px; margin-top:10px; overflow:hidden;">
                    <div style="background:#2563eb; width:${z.turnoutPct}%; height:100%;"></div>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// -------------------------------------------------------------
// OFFICIAL ST. FORMAT-11 REPORTS
// -------------------------------------------------------------
function renderReportsPage() {
    const subtabsCont = document.getElementById('reportsSubtabs');
    const is22 = selectedDate === '22-10-2026';

    if (is22) {
        subtabsCont.innerHTML = `
            <button class="btn-${reportsSubtab === 'zp' ? 'primary' : 'secondary'}" onclick="setReportsSubtab('zp')">
                🏛️ ZP Member (जिला परिषद सदस्य प्रारूप-11)
            </button>
            <button class="btn-${reportsSubtab === 'ps' ? 'primary' : 'secondary'}" onclick="setReportsSubtab('ps')">
                🏢 PS Member (पंचायत समिति सदस्य प्रारूप-11)
            </button>
        `;
    } else {
        subtabsCont.innerHTML = `
            <button class="btn-${reportsSubtab === 'sarpanch_ps' ? 'primary' : 'secondary'}" onclick="setReportsSubtab('sarpanch_ps')">
                🏛️ सरपंच - पं.स. स्तर प्रारूप-11
            </button>
            <button class="btn-${reportsSubtab === 'sarpanch_gp' ? 'primary' : 'secondary'}" onclick="setReportsSubtab('sarpanch_gp')">
                📋 समस्त 34 ग्राम पंचायत वार सरपंच प्रगति
            </button>
        `;
    }

    const titleEl = document.getElementById('reportGovTitle');
    const subTitleEl = document.getElementById('reportGovSubtitle');
    const container = document.getElementById('reportFormatTableContainer');

    const booths = liveData.booths;

    if (is22 && reportsSubtab === 'zp') {
        titleEl.textContent = 'PANCHAYAT GENERAL ELECTION, 2026';
        subTitleEl.textContent = 'POLLING PERCENTAGE FOR ZP MEMBER';

        const zpGroups = [
            { code: 'Z-7', name: 'जिला परिषद वार्ड सं. 07 (चाणौद)', booths: [], voters: 0 },
            { code: 'Z-8', name: 'जिला परिषद वार्ड सं. 08 (सुमेरपुर)', booths: [], voters: 0 },
            { code: 'Z-9', name: 'जिला परिषद वार्ड सं. 09 (साण्डेराव)', booths: [], voters: 0 },
            { code: 'Z-10', name: 'जिला परिषद वार्ड सं. 10 (भारून्दा)', booths: [], voters: 0 }
        ];

        booths.forEach(b => {
            const g = zpGroups.find(x => x.code === b.zp_ward);
            if (g) { g.booths.push(b); g.voters += b.electors; }
        });

        let rowsHtml = '';
        let totV = 0, s10 = 0, s13 = 0, s15 = 0, s18 = 0, sFin = 0;

        zpGroups.forEach((g, idx) => {
            totV += g.voters;
            let v10 = 0, v13 = 0, v15 = 0, v18 = 0, vFin = 0;
            g.booths.forEach(b => {
                v10 += Number(b.v10) || 0;
                v13 += Number(b.v13) || 0;
                v15 += Number(b.v15) || 0;
                v18 += Number(b.v18) || 0;
                vFin += Number(b.v_final || b.latestVotes) || 0;
            });
            s10 += v10; s13 += v13; s15 += v15; s18 += v18; sFin += vFin;

            const p10 = g.voters > 0 && v10 > 0 ? ((v10/g.voters)*100).toFixed(2) : '0.00';
            const p13 = g.voters > 0 && v13 > 0 ? ((v13/g.voters)*100).toFixed(2) : '0.00';
            const p15 = g.voters > 0 && v15 > 0 ? ((v15/g.voters)*100).toFixed(2) : '0.00';
            const p18 = g.voters > 0 && v18 > 0 ? ((v18/g.voters)*100).toFixed(2) : '0.00';
            const pFin = g.voters > 0 && vFin > 0 ? ((vFin/g.voters)*100).toFixed(2) : '0.00';

            rowsHtml += `
                <tr>
                    <td>${idx+1}</td>
                    <td style="text-align:left;">PALI - ${g.code} (${g.name})</td>
                    <td>1</td>
                    <td style="text-align:right;">${g.voters.toLocaleString('en-IN')}</td>
                    <td>हाँ</td>
                    <td style="text-align:right;">${v10 || '-'}</td>
                    <td><b>${p10}%</b></td>
                    <td style="text-align:right; background:#ffff00;">${v13 || '-'}</td>
                    <td style="background:#ffff00;"><b>${p13}%</b></td>
                    <td style="text-align:right;">${v15 || '-'}</td>
                    <td><b>${p15}%</b></td>
                    <td style="text-align:right;">${v18 || '-'}</td>
                    <td><b>${p18}%</b></td>
                    <td style="text-align:right;">${vFin || '-'}</td>
                    <td><b>${pFin}%</b></td>
                    <td>शांतिपूर्ण</td>
                </tr>
            `;
        });

        const tp10 = totV > 0 && s10 > 0 ? ((s10/totV)*100).toFixed(2) : '0.00';
        const tp13 = totV > 0 && s13 > 0 ? ((s13/totV)*100).toFixed(2) : '0.00';
        const tp15 = totV > 0 && s15 > 0 ? ((s15/totV)*100).toFixed(2) : '0.00';
        const tp18 = totV > 0 && s18 > 0 ? ((s18/totV)*100).toFixed(2) : '0.00';
        const tpFin = totV > 0 && sFin > 0 ? ((sFin/totV)*100).toFixed(2) : '0.00';

        container.innerHTML = `
            <table class="gov-format-table" id="exportableFormatTable">
                <thead>
                    <tr>
                        <th rowspan="2">S.N.</th>
                        <th rowspan="2">DISTRICT/ZP</th>
                        <th rowspan="2">Total<br>Constituencies</th>
                        <th rowspan="2">Total Voters</th>
                        <th rowspan="2">7.15 A.M.<br>Start Peaceful</th>
                        <th colspan="2">10 A.M.</th>
                        <th colspan="2" class="highlight-yellow">01.00 P.M.</th>
                        <th colspan="2">3.00 P.M.</th>
                        <th colspan="2">6.00 P.M.</th>
                        <th colspan="2">Final</th>
                        <th rowspan="2">Important Info</th>
                    </tr>
                    <tr>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th class="highlight-yellow">Votes Polled</th><th class="highlight-yellow">Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                    </tr>
                    <tr class="col-num-row">
                        <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td class="highlight-yellow">8</td><td class="highlight-yellow">9</td><td>10</td><td>11</td><td>12</td><td>13</td><td>14</td><td>15</td><td>16</td>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr class="total-row">
                        <td>-</td>
                        <td style="text-align:left;">PALI (ZP CONSTITUENCIES TOTAL)</td>
                        <td>4</td>
                        <td style="text-align:right;">${totV.toLocaleString('en-IN')}</td>
                        <td>100% शांतिपूर्ण</td>
                        <td style="text-align:right;">${s10.toLocaleString('en-IN')}</td><td>${tp10}%</td>
                        <td style="text-align:right; background:#ffff00;">${s13.toLocaleString('en-IN')}</td><td style="background:#ffff00;">${tp13}%</td>
                        <td style="text-align:right;">${s15.toLocaleString('en-IN')}</td><td>${tp15}%</td>
                        <td style="text-align:right;">${s18.toLocaleString('en-IN')}</td><td>${tp18}%</td>
                        <td style="text-align:right;">${sFin.toLocaleString('en-IN')}</td><td>${tpFin}%</td>
                        <td>समस्त शांतिपूर्ण</td>
                    </tr>
                </tbody>
            </table>
        `;
    } else if (is22 && reportsSubtab === 'ps') {
        titleEl.textContent = 'PANCHAYAT GENERAL ELECTION(PS MEMBERS), 2026';
        subTitleEl.textContent = 'POLLING PERCENTAGE (PANCHAYAT SAMITI WISE )';

        const wardMap = {};
        let totV = 0, s10 = 0, s13 = 0, s15 = 0, s18 = 0, sFin = 0;

        booths.forEach(b => {
            totV += b.electors;
            if (!wardMap[b.ps_ward]) wardMap[b.ps_ward] = { ward: b.ps_ward, voters: 0, booths: [] };
            wardMap[b.ps_ward].voters += b.electors;
            wardMap[b.ps_ward].booths.push(b);

            s10 += Number(b.v10) || 0;
            s13 += Number(b.v13) || 0;
            s15 += Number(b.v15) || 0;
            s18 += Number(b.v18) || 0;
            sFin += Number(b.v_final || b.latestVotes) || 0;
        });

        const tp10 = totV > 0 && s10 > 0 ? ((s10/totV)*100).toFixed(2) : '0.00';
        const tp13 = totV > 0 && s13 > 0 ? ((s13/totV)*100).toFixed(2) : '0.00';
        const tp15 = totV > 0 && s15 > 0 ? ((s15/totV)*100).toFixed(2) : '0.00';
        const tp18 = totV > 0 && s18 > 0 ? ((s18/totV)*100).toFixed(2) : '0.00';
        const tpFin = totV > 0 && sFin > 0 ? ((sFin/totV)*100).toFixed(2) : '0.00';

        const sortedWards = Object.keys(wardMap).sort((a,b) => parseInt(a.replace('W-','')) - parseInt(b.replace('W-','')));

        let rowsHtml = '';
        sortedWards.forEach((w, idx) => {
            const wo = wardMap[w];
            let v10 = 0, v13 = 0, v15 = 0, v18 = 0, vFin = 0;
            wo.booths.forEach(b => {
                v10 += Number(b.v10) || 0;
                v13 += Number(b.v13) || 0;
                v15 += Number(b.v15) || 0;
                v18 += Number(b.v18) || 0;
                vFin += Number(b.v_final || b.latestVotes) || 0;
            });
            const p10 = wo.voters > 0 && v10 > 0 ? ((v10/wo.voters)*100).toFixed(2) : '0.00';
            const p13 = wo.voters > 0 && v13 > 0 ? ((v13/wo.voters)*100).toFixed(2) : '0.00';
            const p15 = wo.voters > 0 && v15 > 0 ? ((v15/wo.voters)*100).toFixed(2) : '0.00';
            const p18 = wo.voters > 0 && v18 > 0 ? ((v18/wo.voters)*100).toFixed(2) : '0.00';
            const pFin = wo.voters > 0 && vFin > 0 ? ((vFin/wo.voters)*100).toFixed(2) : '0.00';

            rowsHtml += `
                <tr>
                    <td>${idx+1}</td>
                    <td>PALI</td>
                    <td style="text-align:left;">SUMERPUR (${w})</td>
                    <td>1</td>
                    <td style="text-align:right;">${wo.voters.toLocaleString('en-IN')}</td>
                    <td>हाँ</td>
                    <td style="text-align:right;">${v10 || '-'}</td><td><b>${p10}%</b></td>
                    <td style="text-align:right; background:#ffff00;">${v13 || '-'}</td><td style="background:#ffff00;"><b>${p13}%</b></td>
                    <td style="text-align:right;">${v15 || '-'}</td><td><b>${p15}%</b></td>
                    <td style="text-align:right;">${v18 || '-'}</td><td><b>${p18}%</b></td>
                    <td style="text-align:right;">${vFin || '-'}</td><td><b>${pFin}%</b></td>
                    <td>शांतिपूर्ण</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <table class="gov-format-table" id="exportableFormatTable">
                <thead>
                    <tr>
                        <th rowspan="2">S.N.</th>
                        <th rowspan="2">DISTRICT</th>
                        <th rowspan="2">NAME OF<br>PANCHAYAT SAMITI</th>
                        <th rowspan="2">TOTAL<br>CONSTITUENCIES</th>
                        <th rowspan="2">TOTAL VOTERS</th>
                        <th rowspan="2">7.15 A.M.<br>Start Peaceful</th>
                        <th colspan="2">10.00 A.M.</th>
                        <th colspan="2" class="highlight-yellow">01.00 P.M.</th>
                        <th colspan="2">3.00 P.M.</th>
                        <th colspan="2">6.00 P.M.</th>
                        <th colspan="2">Final</th>
                        <th rowspan="2">Important Info</th>
                    </tr>
                    <tr>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th class="highlight-yellow">Votes Polled</th><th class="highlight-yellow">Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                    </tr>
                    <tr class="col-num-row">
                        <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td class="highlight-yellow">9</td><td class="highlight-yellow">10</td><td>11</td><td>12</td><td>13</td><td>14</td><td>15</td><td>16</td><td>17</td>
                    </tr>
                </thead>
                <tbody>
                    <tr class="total-row" style="background:#e6f4ea;">
                        <td>1</td>
                        <td>PALI</td>
                        <td style="text-align:left;"><strong>SUMERPUR (CONSOLIDATED)</strong></td>
                        <td>21</td>
                        <td style="text-align:right;"><strong>${totV.toLocaleString('en-IN')}</strong></td>
                        <td><strong>हाँ (152 बूथ)</strong></td>
                        <td style="text-align:right;"><strong>${s10.toLocaleString('en-IN')}</strong></td><td><strong>${tp10}%</strong></td>
                        <td style="text-align:right; background:#ffff00;"><strong>${s13.toLocaleString('en-IN')}</strong></td><td style="background:#ffff00;"><strong>${tp13}%</strong></td>
                        <td style="text-align:right;"><strong>${s15.toLocaleString('en-IN')}</strong></td><td><strong>${tp15}%</strong></td>
                        <td style="text-align:right;"><strong>${s18.toLocaleString('en-IN')}</strong></td><td><strong>${tp18}%</strong></td>
                        <td style="text-align:right;"><strong>${sFin.toLocaleString('en-IN')}</strong></td><td><strong>${tpFin}%</strong></td>
                        <td>शांतिपूर्ण</td>
                    </tr>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    } else {
        // Sarpanch Formats
        titleEl.textContent = 'PANCHAYAT GENERAL ELECTION, 2026';
        subTitleEl.textContent = 'POLLING PERCENTAGE FOR SARPANCH (PANCHAYAT SAMITI WISE)';

        const gpMap = {};
        let totV = 0, s10 = 0, s13 = 0, s15 = 0, s18 = 0, sFin = 0;

        booths.forEach(b => {
            totV += b.electors;
            if (!gpMap[b.gp_name]) gpMap[b.gp_name] = { gp: b.gp_name, voters: 0, booths: [] };
            gpMap[b.gp_name].voters += b.electors;
            gpMap[b.gp_name].booths.push(b);

            s10 += Number(b.v10) || 0;
            s13 += Number(b.v13) || 0;
            s15 += Number(b.v15) || 0;
            s18 += Number(b.v18) || 0;
            sFin += Number(b.v_final || b.latestVotes) || 0;
        });

        const tp10 = totV > 0 && s10 > 0 ? ((s10/totV)*100).toFixed(2) : '0.00';
        const tp13 = totV > 0 && s13 > 0 ? ((s13/totV)*100).toFixed(2) : '0.00';
        const tp15 = totV > 0 && s15 > 0 ? ((s15/totV)*100).toFixed(2) : '0.00';
        const tp18 = totV > 0 && s18 > 0 ? ((s18/totV)*100).toFixed(2) : '0.00';
        const tpFin = totV > 0 && sFin > 0 ? ((sFin/totV)*100).toFixed(2) : '0.00';

        let rowsHtml = '';
        Object.keys(gpMap).sort().forEach((gp, idx) => {
            const go = gpMap[gp];
            let v10 = 0, v13 = 0, v15 = 0, v18 = 0, vFin = 0;
            go.booths.forEach(b => {
                v10 += Number(b.v10) || 0;
                v13 += Number(b.v13) || 0;
                v15 += Number(b.v15) || 0;
                v18 += Number(b.v18) || 0;
                vFin += Number(b.v_final || b.latestVotes) || 0;
            });
            const p10 = go.voters > 0 && v10 > 0 ? ((v10/go.voters)*100).toFixed(2) : '0.00';
            const p13 = go.voters > 0 && v13 > 0 ? ((v13/go.voters)*100).toFixed(2) : '0.00';
            const p15 = go.voters > 0 && v15 > 0 ? ((v15/go.voters)*100).toFixed(2) : '0.00';
            const p18 = go.voters > 0 && v18 > 0 ? ((v18/go.voters)*100).toFixed(2) : '0.00';
            const pFin = go.voters > 0 && vFin > 0 ? ((vFin/go.voters)*100).toFixed(2) : '0.00';

            rowsHtml += `
                <tr>
                    <td>${idx+1}</td>
                    <td>PALI</td>
                    <td style="text-align:left;"><b>${gp}</b> (${go.booths.length} बूथ)</td>
                    <td>1</td>
                    <td style="text-align:right;">${go.voters.toLocaleString('en-IN')}</td>
                    <td>हाँ</td>
                    <td style="text-align:right;">${v10 || '-'}</td><td><b>${p10}%</b></td>
                    <td style="text-align:right; background:#ffff00;">${v13 || '-'}</td><td style="background:#ffff00;"><b>${p13}%</b></td>
                    <td style="text-align:right;">${v15 || '-'}</td><td><b>${p15}%</b></td>
                    <td style="text-align:right;">${v18 || '-'}</td><td><b>${p18}%</b></td>
                    <td style="text-align:right;">${vFin || '-'}</td><td><b>${pFin}%</b></td>
                    <td>शांतिपूर्ण</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <table class="gov-format-table" id="exportableFormatTable">
                <thead>
                    <tr>
                        <th rowspan="2">S.N.</th>
                        <th rowspan="2">DISTRICT</th>
                        <th rowspan="2">Name of Panchayat samiti / GP</th>
                        <th rowspan="2">TOTAL NO. OF GP</th>
                        <th rowspan="2">Total Voters</th>
                        <th rowspan="2">7.15 A.M.<br>Start Peaceful</th>
                        <th colspan="2">10 A.M.</th>
                        <th colspan="2" class="highlight-yellow">01.00 P.M.</th>
                        <th colspan="2">3.00 P.M.</th>
                        <th colspan="2">6.00 P.M.</th>
                        <th colspan="2">Final</th>
                        <th rowspan="2">Important Info</th>
                    </tr>
                    <tr>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th class="highlight-yellow">Votes Polled</th><th class="highlight-yellow">Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                        <th>Votes Polled</th><th>Percentage</th>
                    </tr>
                    <tr class="col-num-row">
                        <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td><td class="highlight-yellow">9</td><td class="highlight-yellow">10</td><td>11</td><td>12</td><td>13</td><td>14</td><td>15</td><td>16</td><td>17</td>
                    </tr>
                </thead>
                <tbody>
                    <tr class="total-row" style="background:#e6f4ea;">
                        <td>1</td>
                        <td>PALI</td>
                        <td style="text-align:left;"><strong>SUMERPUR (34 GPs TOTAL)</strong></td>
                        <td>34</td>
                        <td style="text-align:right;"><strong>${totV.toLocaleString('en-IN')}</strong></td>
                        <td><strong>हाँ (100% प्रारंभ)</strong></td>
                        <td style="text-align:right;"><strong>${s10.toLocaleString('en-IN')}</strong></td><td><strong>${tp10}%</strong></td>
                        <td style="text-align:right; background:#ffff00;"><strong>${s13.toLocaleString('en-IN')}</strong></td><td style="background:#ffff00;"><strong>${tp13}%</strong></td>
                        <td style="text-align:right;"><strong>${s15.toLocaleString('en-IN')}</strong></td><td><strong>${tp15}%</strong></td>
                        <td style="text-align:right;"><strong>${s18.toLocaleString('en-IN')}</strong></td><td><strong>${tp18}%</strong></td>
                        <td style="text-align:right;"><strong>${sFin.toLocaleString('en-IN')}</strong></td><td><strong>${tpFin}%</strong></td>
                        <td>शांतिपूर्ण</td>
                    </tr>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    }
}

function setReportsSubtab(sub) {
    reportsSubtab = sub;
    renderReportsPage();
}

// -------------------------------------------------------------
// UNIVERSAL EXCEL & PDF EXPORT SYSTEM
// -------------------------------------------------------------
function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 600);
}

function saveWorkbook(wb, filename) {
    if (typeof XLSX === 'undefined') {
        showToast('त्रुटि', 'XLSX लाइब्रेरी लोड नहीं है', 'error');
        return false;
    }
    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
        showToast('Excel डाउनलोड सफल!', `${filename} सफलतापूर्वक सुरक्षित कर ली गई है।`, 'success', 4000);
        return true;
    } catch (err) {
        console.error('saveWorkbook error:', err);
        try {
            XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
            showToast('Excel डाउनलोड सफल!', `${filename} सफलतापूर्वक सुरक्षित कर ली गई है।`, 'success', 4000);
            return true;
        } catch (e) {
            showToast('Excel निर्यात त्रुटि', e.message, 'error', 4000);
            return false;
        }
    }
}

function exportFormat11ToExcel() {
    const table = document.getElementById('exportableFormatTable');
    if (!table) {
        showToast('त्रुटि', 'रिपोर्ट टेबल उपलब्ध नहीं है', 'error');
        return;
    }
    try {
        const wb = XLSX.utils.table_to_book(table, { sheet: "ST_FORMAT_11", raw: true });
        saveWorkbook(wb, `ST_FORMAT_11_${selectedDate}_${reportsSubtab}.xlsx`);
    } catch (e) {
        console.error('exportFormat11ToExcel error:', e);
        showToast('निर्यात त्रुटि', e.message, 'error');
    }
}

function exportReportsToExcel() {
    exportFormat11ToExcel();
}

function exportFormat11ToPdf() {
    const element = document.getElementById('printableFormatArea');
    if (!element) {
        showToast('त्रुटि', 'रिपोर्ट फॉर्मेट नहीं मिला', 'error');
        return;
    }
    const filename = `ST_FORMAT_11_${selectedDate}_${reportsSubtab}.pdf`;
    showToast('PDF जनरेट हो रहा है...', 'कृपया 1-2 सेकंड प्रतीक्षा करें...', 'info', 3000);

    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin: [6, 6, 6, 6],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        html2pdf().set(opt).from(element).save().then(() => {
            showToast('PDF डाउनलोड सफल!', `${filename} डाउनलोड हो गया है।`, 'success', 4000);
        }).catch(err => {
            console.error('html2pdf error:', err);
            showToast('प्रिंट डायलॉग खुला', 'कृपया Save as PDF चुनें', 'info');
            window.print();
        });
    } else {
        window.print();
    }
}

function printOfficialReport() {
    window.print();
}

function exportStatsToExcel() {
    if (!liveData) {
        showToast('त्रुटि', 'लाइव डेटा उपलब्ध नहीं है', 'error');
        return;
    }
    const wb = XLSX.utils.book_new();
    let sheetData = [];
    let sheetName = 'Voting_Stats';

    if (currentStatsCategory === 'zp') {
        sheetName = 'ZP_Wards';
        sheetData.push(['क्र.सं.', 'जिला परिषद (ZP) वार्ड', 'बूथ संख्या', 'कुल मतदाता', '10:00 AM मत', '10:00 AM %', '01:00 PM मत', '01:00 PM %', '03:00 PM मत', '03:00 PM %', '06:00 PM मत', '06:00 PM %', 'Final मत', 'अंतिम मतदान %']);
        (liveData.zpWards || []).forEach((w, idx) => {
            sheetData.push([
                idx + 1,
                w.ward_id,
                w.boothsCount,
                w.electors,
                w.v10 || 0,
                `${w.p10 || 0}%`,
                w.v13 || 0,
                `${w.p13 || 0}%`,
                w.v15 || 0,
                `${w.p15 || 0}%`,
                w.v18 || 0,
                `${w.p18 || 0}%`,
                w.v_final || 0,
                `${w.turnoutPct || 0}%`
            ]);
        });
    } else if (currentStatsCategory === 'ps') {
        sheetName = 'PS_Wards';
        sheetData.push(['क्र.सं.', 'पंचायत समिति (PS) वार्ड', 'बूथ संख्या', 'कुल मतदाता', '10:00 AM मत', '10:00 AM %', '01:00 PM मत', '01:00 PM %', '03:00 PM मत', '03:00 PM %', '06:00 PM मत', '06:00 PM %', 'Final मत', 'अंतिम मतदान %']);
        (liveData.psWards || []).forEach((w, idx) => {
            sheetData.push([
                idx + 1,
                w.ward_id,
                w.boothsCount,
                w.electors,
                w.v10 || 0,
                `${w.p10 || 0}%`,
                w.v13 || 0,
                `${w.p13 || 0}%`,
                w.v15 || 0,
                `${w.p15 || 0}%`,
                w.v18 || 0,
                `${w.p18 || 0}%`,
                w.v_final || 0,
                `${w.turnoutPct || 0}%`
            ]);
        });
    } else if (currentStatsCategory === 'zones') {
        sheetName = '10_Zones';
        sheetData.push(['क्र.सं.', 'ज़ोन', 'मुख्यालय / नाम', 'ज़ोनल मजिस्ट्रेट', 'मोबाइल', 'बूथ संख्या', 'कुल मतदाता', '10:00 AM मत', '01:00 PM मत', '03:00 PM मत', '06:00 PM मत', 'Final मत', 'अंतिम मतदान %']);
        (liveData.zones || []).forEach((z, idx) => {
            sheetData.push([
                idx + 1,
                z.zone_id,
                z.name,
                z.magistrate,
                z.magistrate_mob,
                z.boothsCount,
                z.electors,
                z.v10 || 0,
                z.v13 || 0,
                z.v15 || 0,
                z.v18 || 0,
                z.votes || 0,
                `${z.turnoutPct || 0}%`
            ]);
        });
    } else {
        sheetName = '34_GPs';
        sheetData.push(['क्र.सं.', 'ग्राम पंचायत', 'ज़ोन', 'जि.प. वार्ड', 'पं.स. वार्ड', 'बूथ संख्या', 'कुल मतदाता', 'डाले गए मत', 'मतदान %']);
        (liveData.gps || []).forEach((gp, idx) => {
            sheetData.push([
                idx + 1,
                gp.name,
                gp.zone,
                gp.zp_ward,
                gp.ps_ward,
                gp.boothsCount,
                gp.electors,
                gp.votes,
                `${gp.turnoutPct || 0}%`
            ]);
        });
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    saveWorkbook(wb, `Sumerpur_Stats_${currentStatsCategory.toUpperCase()}_${selectedDate}.xlsx`);
}

function exportStatsToPdf() {
    if (!liveData) return;
    showToast('सांख्यिकी PDF तैयार हो रहा है...', 'कृपया 1-2 सेकंड प्रतीक्षा करें...', 'info', 3000);

    let sub = '';
    let headers = [];
    let rows = [];

    if (currentStatsCategory === 'zp') {
        sub = 'जिला परिषद (ZP) वार्ड वार लाइव मतदान सांख्यिकी (4 वार्ड)';
        headers = ['क्र.', 'ZP वार्ड', 'बूथ', 'कुल मतदाता', '10 AM मत', '1 PM मत', '3 PM मत', '6 PM मत', 'Final मत', 'मतदान %'];
        (liveData.zpWards || []).forEach((w, i) => {
            rows.push([i+1, w.ward_id, w.boothsCount, (w.electors||0).toLocaleString('en-IN'), w.v10||0, w.v13||0, w.v15||0, w.v18||0, w.v_final||0, `${w.turnoutPct||0}%`]);
        });
    } else if (currentStatsCategory === 'ps') {
        sub = 'पंचायत समिति (PS) वार्ड वार लाइव मतदान सांख्यिकी (21 वार्ड)';
        headers = ['क्र.', 'PS वार्ड', 'बूथ', 'कुल मतदाता', '10 AM मत', '1 PM मत', '3 PM मत', '6 PM मत', 'Final मत', 'मतदान %'];
        (liveData.psWards || []).forEach((w, i) => {
            rows.push([i+1, w.ward_id, w.boothsCount, (w.electors||0).toLocaleString('en-IN'), w.v10||0, w.v13||0, w.v15||0, w.v18||0, w.v_final||0, `${w.turnoutPct||0}%`]);
        });
    } else if (currentStatsCategory === 'zones') {
        sub = 'प्रशासनिक ज़ोन वार लाइव मतदान प्रगति (10 ज़ोन)';
        headers = ['क्र.', 'ज़ोन', 'मजिस्ट्रेट', 'मोबाइल', 'बूथ', 'कुल मतदाता', '10 AM', '1 PM', '3 PM', '6 PM', 'Final', '%'];
        (liveData.zones || []).forEach((z, i) => {
            rows.push([i+1, z.zone_id, z.magistrate, z.magistrate_mob, z.boothsCount, (z.electors||0).toLocaleString('en-IN'), z.v10||0, z.v13||0, z.v15||0, z.v18||0, z.votes||0, `${z.turnoutPct||0}%`]);
        });
    } else {
        sub = 'ग्राम पंचायत वार लाइव मतदान विवरण (34 ग्राम पंचायतें)';
        headers = ['क्र.', 'ग्राम पंचायत', 'ज़ोन', 'ZP वार्ड', 'PS वार्ड', 'बूथ', 'कुल मतदाता', 'डाले गए मत', 'मतदान %'];
        (liveData.gps || []).forEach((gp, i) => {
            rows.push([i+1, gp.name, gp.zone, gp.zp_ward, gp.ps_ward, gp.boothsCount, (gp.electors||0).toLocaleString('en-IN'), (gp.votes||0).toLocaleString('en-IN'), `${gp.turnoutPct||0}%`]);
        });
    }

    const tempDiv = document.createElement('div');
    tempDiv.style.padding = '20px';
    tempDiv.style.background = '#ffffff';
    tempDiv.style.color = '#000000';
    tempDiv.style.fontFamily = 'Arial, sans-serif';

    let rowsHtml = rows.map(r => `<tr>${r.map((c, idx) => `<td style="border:1px solid #333; padding:5px 6px; text-align:${idx === 1 ? 'left' : 'center'}; font-size:11px;">${c}</td>`).join('')}</tr>`).join('');

    tempDiv.innerHTML = `
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <h2 style="margin:0; font-size:16px; text-transform:uppercase;">राजस्थान पंचायती राज चुनाव 2026</h2>
            <h3 style="margin:4px 0 0; font-size:14px; color:#1e293b;">कार्यालय रिटर्निंग ऑफिसर (SDM) सुमेरपुर (पाली)</h3>
            <div style="font-size:12px; margin-top:4px; font-weight:bold; color:#0369a1;">${sub}</div>
            <div style="font-size:11px; color:#475569; margin-top:2px;">दिनांक: ${selectedDate} | समय: ${new Date().toLocaleTimeString('en-IN')} | कुल मतदाता: 1,44,905 | कुल केंद्र: 152</div>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top:8px;">
            <thead>
                <tr style="background:#f1f5f9;">
                    ${headers.map(h => `<th style="border:1px solid #333; padding:6px; font-size:11px;">${h}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
        <div style="margin-top:35px; display:flex; justify-content:space-between; font-size:12px; font-weight:bold; padding:0 30px;">
            <div>प्रभारी अधिकारी / सहायक रिटर्निंग ऑफिसर</div>
            <div>रिटर्निंग ऑफिसर (SDM) सुमेरपुर</div>
        </div>
    `;

    if (typeof html2pdf !== 'undefined') {
        const opt = {
            margin: [6, 6, 6, 6],
            filename: `Sumerpur_Stats_${currentStatsCategory.toUpperCase()}_${selectedDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(tempDiv).save().then(() => {
            showToast('PDF डाउनलोड सफल!', `Sumerpur_Stats_${currentStatsCategory.toUpperCase()}_${selectedDate}.pdf डाउनलोड हो गया!`, 'success', 4000);
        }).catch(e => {
            console.error('html2pdf error:', e);
            window.print();
        });
    } else {
        window.print();
    }
}

function printStatsReport() {
    window.print();
}

function exportAllBoothsToExcel() {
    if (!liveData || !liveData.booths) {
        showToast('त्रुटि', 'बूथ डेटा उपलब्ध नहीं है', 'error');
        return;
    }
    const wb = XLSX.utils.book_new();
    const headers = [
        'क्र.सं.',
        'बूथ नं.',
        'ज़ोन',
        'ग्राम पंचायत',
        'मतदान केंद्र भवन / स्थल',
        'पं.स. वार्ड',
        'जि.प. वार्ड',
        'कुल मतदाता',
        'मॉक पोल',
        '7:15 AM प्रारंभ',
        '10:00 AM मत',
        '10:00 AM %',
        '01:00 PM मत',
        '01:00 PM %',
        '03:00 PM मत',
        '03:00 PM %',
        '06:00 PM मत',
        '06:00 PM %',
        '6 PM कतार',
        'Final मत',
        'अंतिम मतदान %',
        'टिप्पणी',
        'ज़ोनल मजिस्ट्रेट',
        'मोबाइल'
    ];

    const rows = [headers];
    liveData.booths.forEach((b, idx) => {
        const electors = b.electors || 0;
        const p10 = electors > 0 && b.v10 !== '' ? ((b.v10 / electors) * 100).toFixed(2) + '%' : '0.00%';
        const p13 = electors > 0 && b.v13 !== '' ? ((b.v13 / electors) * 100).toFixed(2) + '%' : '0.00%';
        const p15 = electors > 0 && b.v15 !== '' ? ((b.v15 / electors) * 100).toFixed(2) + '%' : '0.00%';
        const p18 = electors > 0 && b.v18 !== '' ? ((b.v18 / electors) * 100).toFixed(2) + '%' : '0.00%';
        const finalV = b.v_final !== '' && b.v_final !== undefined ? b.v_final : b.v18 || 0;
        const finalPct = electors > 0 ? ((finalV / electors) * 100).toFixed(2) + '%' : '0.00%';

        rows.push([
            idx + 1,
            b.id,
            b.zone,
            b.gp_name,
            b.location || b.name,
            b.ps_ward,
            b.zp_ward,
            electors,
            b.mock_done ? 'हाँ' : 'नहीं',
            b.started ? 'हाँ' : 'नहीं',
            b.v10 === '' ? 0 : b.v10,
            p10,
            b.v13 === '' ? 0 : b.v13,
            p13,
            b.v15 === '' ? 0 : b.v15,
            p15,
            b.v18 === '' ? 0 : b.v18,
            p18,
            b.v_queue || 0,
            finalV,
            finalPct,
            b.remark || 'शांतिपूर्ण',
            b.magistrate || '',
            b.magistrate_mob || ''
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, '152_Booths_Progress');
    saveWorkbook(wb, `Sumerpur_152_Booths_Poll_Progress_${selectedDate}.xlsx`);
}

function exportAllBoothsToPdf() {
    showToast('152 बूथ PDF तैयार हो रहा है...', 'कृपया प्रतीक्षा करें...', 'info', 4000);
    window.location.href = `/api/export/csv?date=${selectedDate}`;
    showToast('CSV / Excel रिपोर्ट डाउनलोड प्रारंभ', 'समस्त 152 बूथों का डेटा डाउनलोड हो रहा है। PDF हेतु Ctrl+P प्रिंट का उपयोग करें।', 'success', 5000);
}

// -------------------------------------------------------------
// LIVE DISPLAY (TV MODE)
// -------------------------------------------------------------
function renderLiveDisplay() {
    const k = liveData.kpi;
    document.getElementById('tvElectors').textContent = k.totalElectors.toLocaleString('en-IN');
    document.getElementById('tvVotes').textContent = k.totalVotes.toLocaleString('en-IN');
    document.getElementById('tvTurnout').textContent = `${k.turnoutPct}%`;
    document.getElementById('liveDisplaySubtitle').textContent = `सुमेरपुर पंचायती राज चुनाव 2026 | दिनांक: ${selectedDate} | लाइव नियंत्रण कक्ष`;

    const grid = document.getElementById('tvZonesGrid');
    let html = '';
    liveData.zones.forEach(z => {
        html += `
            <div style="background:#1e293b; padding:14px; border-radius:8px; border:1px solid #334155;">
                <div style="display:flex; justify-content:space-between; font-size:15px; margin-bottom:6px;">
                    <span style="font-weight:bold; color:white;">${z.zone_id} : ${z.name}</span>
                    <span style="font-weight:bold; color:#38bdf8;">${z.turnoutPct}% (${z.votes}/${z.electors})</span>
                </div>
                <div style="background:#0f172a; height:12px; border-radius:6px; overflow:hidden;">
                    <div style="background:#38bdf8; width:${z.turnoutPct}%; height:100%;"></div>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

// -------------------------------------------------------------
// WHATSAPP BULLETIN
// -------------------------------------------------------------
function generateWhatsappMessage(slot) {
    const k = liveData.kpi;
    let slotTitle = `${slot}:00 बजे तक`;
    let polled = k.totalVotes;
    let pct = k.turnoutPct;

    if (slot === '7.15') slotTitle = '07:15 AM (शांतिपूर्ण मतदान प्रारंभ)';
    else if (slot === '10') { polled = k.slots.s10.count; pct = k.slots.s10.pct; slotTitle = '10:00 AM'; }
    else if (slot === '13') { polled = k.slots.s13.count; pct = k.slots.s13.pct; slotTitle = '01:00 PM (विशिष्ट बुलेटिन)'; }
    else if (slot === '15') { polled = k.slots.s15.count; pct = k.slots.s15.pct; slotTitle = '03:00 PM'; }
    else if (slot === '18') { polled = k.slots.s18.count; pct = k.slots.s18.pct; slotTitle = '06:00 PM'; }
    else if (slot === 'Final') { polled = k.slots.final.count; pct = k.slots.final.pct; slotTitle = 'अंतिम मतदान प्रतिशत (Final)'; }

    const is22 = selectedDate === '22-10-2026';
    const electionName = is22 ? 'पंचायत समिति एवं जिला परिषद सदस्य आम चुनाव 2026' : 'सरपंच एवं वार्ड पंच आम चुनाव 2026';

    let msg = `🗳️ *राजस्थान पंचायती राज आम चुनाव 2026*\n`;
    msg += `📍 *कार्यालय निर्वाचक रजिस्ट्रीकरण अधिकारी (SDM), सुमेरपुर (पाली)*\n`;
    msg += `📅 दिनांक: *${selectedDate}* | चुनाव: *${electionName}*\n`;
    msg += `⏰ रिपोर्टिंग स्लॉट: *${slotTitle}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *समग्र मतदान रिपोर्ट*:\n`;
    msg += `• कुल मतदान केंद्र (बूथ): *152*\n`;
    msg += `• कुल पंजीकृत मतदाता: *${k.totalElectors.toLocaleString('en-IN')}*\n`;

    if (slot === '7.15') {
        msg += `• शांतिपूर्ण मतदान प्रारंभ रिपोर्ट: *${k.started} / 152 बूथ (100%)*\n`;
        msg += `• समस्त मतदान केंद्रों पर मॉक पोल पूर्ण कर मतदान शांतिपूर्ण प्रारंभ हो चुका है।\n`;
    } else {
        msg += `• डाले गए कुल मत: *${polled.toLocaleString('en-IN')}*\n`;
        msg += `• समग्र मतदान प्रतिशत: *${pct}%*\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🏛️ *प्रमुख ज़ोन वार मतदान प्रतिशत*:\n`;
        liveData.zones.slice(0, 5).forEach(z => {
            msg += `  🟢 ${z.zone_id} (${z.name}): *${z.turnoutPct}%*\n`;
        });
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `नोट: यह अधिकृत सूचना नियंत्रण कक्ष, सुमेरपुर (पाली) द्वारा जारी की गई है।\n`;
    msg += `🙏 जय हिन्द | निर्वाचन विभाग राजस्थान`;

    const box = document.getElementById('whatsappBox');
    if (box) box.textContent = msg;
}

function copyWhatsappBulletin() {
    const text = document.getElementById('whatsappBox').textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert("WhatsApp संदेश क्लिपबोर्ड पर कॉपी हो गया!");
    });
}

// -------------------------------------------------------------
// ADMIN TOOLS
// -------------------------------------------------------------
async function seedMockData() {
    if (!confirm(`क्या आप ${selectedDate} हेतु 152 बूथों पर रिहर्सल / मॉक टेस्ट डेटा भरना चाहते हैं?`)) return;
    try {
        const res = await fetch('/api/admin/seed-demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate })
        });
        const d = await res.json();
        alert(d.message);
        fetchData();
    } catch (e) {
        alert('त्रुटि: ' + e.message);
    }
}

async function resetElectionData() {
    if (!confirm(`चेतावनी: क्या आप वास्तव में दिनांक ${selectedDate} का समस्त मतदान डेटा खाली (Reset) करना चाहते हैं?`)) return;
    try {
        const res = await fetch('/api/admin/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: selectedDate })
        });
        const d = await res.json();
        alert(d.message);
        fetchData();
    } catch (e) {
        alert('त्रुटि: ' + e.message);
    }
}

function downloadBackupJson() {
    window.location.href = '/api/backup';
}

async function uploadAndRestoreBackup() {
    const fileInput = document.getElementById('restoreFileInput');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert('कृपया JSON बैकअप फ़ाइल का चयन करें।');
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!confirm('क्या आप सुनिश्चित हैं कि इस बैकअप फ़ाइल से समस्त चुनाव एवं मतगणना डेटा पुनर्स्थापित (Restore) करना चाहते हैं?')) {
                return;
            }
            showToast('डेटा रीस्टोर हो रहा है...', 'info');
            const res = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store: parsed })
            });
            const data = await res.json();
            if (data.success) {
                alert('सफलता: ' + data.message);
                fetchData();
            } else {
                alert('त्रुटि: ' + (data.message || 'अमान्य डेटा'));
            }
        } catch (err) {
            alert('अमान्य JSON बैकअप फ़ाइल: ' + err.message);
        }
    };
    reader.readAsText(file);
}

async function checkCloudStatus() {
    const badge = document.getElementById('cloudStatusBadge');
    const desc = document.getElementById('cloudStatusDescText');
    if (!badge || !desc) return;

    try {
        const res = await fetch('/api/system-status');
        const data = await res.json();
        const p = data.persistence || {};
        if (p.isMongoConnected) {
            badge.style.background = '#dcfce7';
            badge.style.color = '#15803d';
            badge.style.border = '1.5px solid #86efac';
            badge.innerHTML = '<i class="fas fa-circle-check"></i> MongoDB Atlas सक्रिय (100% परमानेंट क्लाउड स्टोरेज)';
            desc.innerHTML = `क्लाउड डेटाबेस से कनेक्टेड है। Render.com रीस्टार्ट या स्लीप होने पर भी डेटा पूरी तरह सुरक्षित रहेगा। अंतिम सेव: <b>${new Date(p.lastSaved).toLocaleTimeString('en-IN')}</b>`;
        } else {
            badge.style.background = '#fef3c7';
            badge.style.color = '#92400e';
            badge.style.border = '1.5px solid #fde68a';
            badge.innerHTML = '<i class="fas fa-triangle-exclamation"></i> लोकल फ़ाइल स्टोरेज (Render फ्री टियर पर स्लीप होने पर रीसेट का जोखिम)';
            desc.innerHTML = `सलाह: Render.com पर डेटा स्थायी रखने के लिए Environment Variables में <code>MONGODB_URI</code> जोड़ें, या ऊपर दिए गए <b>JSON बैकअप</b> का उपयोग करें।`;
        }
    } catch (e) {
        badge.innerHTML = '<i class="fas fa-circle-xmark"></i> स्थिति अज्ञात';
    }
}

// -------------------------------------------------------------
// =============================================================
// BADE SCREEN PAR STATES (BIG SCREEN / TV WALLBOARD STATS LOGIC)
// =============================================================
// -------------------------------------------------------------
let isBigScreenOpen = false;
let bsSubView = 'zones'; // 'zones', 'rankings', 'gps'
let bsSlot = '10'; // '7.15', '10', '13', '15', '18', 'Final'
let bsAutoCycleInterval = null;

function openBigScreenModal() {
    isBigScreenOpen = true;
    const modal = document.getElementById('badeScreenModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    renderBigScreenStats();

    if (!document.fullscreenElement && modal) {
        try {
            if (modal.requestFullscreen) {
                modal.requestFullscreen().catch(() => {});
            }
        } catch (e) {}
    }
}

function closeBigScreenModal() {
    isBigScreenOpen = false;
    const modal = document.getElementById('badeScreenModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    if (bsAutoCycleInterval) {
        clearInterval(bsAutoCycleInterval);
        bsAutoCycleInterval = null;
        const txt = document.getElementById('bsAutoCycleText');
        if (txt) txt.textContent = 'टीवी रोटेशन: बंद';
    }
}

function toggleBsFullscreen() {
    const modal = document.getElementById('badeScreenModal') || document.documentElement;
    const fsText = document.getElementById('bsFsText');

    if (!document.fullscreenElement) {
        if (modal.requestFullscreen) {
            modal.requestFullscreen().then(() => {
                if (fsText) fsText.textContent = 'सामान्य स्क्रीन (F11)';
            }).catch(err => {
                console.warn('Fullscreen request failed:', err);
            });
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => {
                if (fsText) fsText.textContent = 'पूर्ण स्क्रीन (F11)';
            }).catch(() => {});
        }
    }
}

document.addEventListener('fullscreenchange', () => {
    const fsText = document.getElementById('bsFsText');
    if (fsText) {
        fsText.textContent = document.fullscreenElement ? 'सामान्य स्क्रीन (F11)' : 'पूर्ण स्क्रीन (F11)';
    }
});

// Keyboard shortcuts for Big Screen
document.addEventListener('keydown', (e) => {
    if (!isBigScreenOpen) return;
    if (e.key === 'Escape') {
        closeBigScreenModal();
    } else if (e.key === 'f' || e.key === 'F') {
        toggleBsFullscreen();
    } else if (e.code === 'Space') {
        e.preventDefault();
        toggleBsAutoCycle();
    }
});

function toggleBsElectionDate() {
    const newDate = selectedDate === '22-10-2026' ? '24-10-2026' : '22-10-2026';
    switchElectionDate(newDate);
}

function setBsSlot(slot) {
    bsSlot = slot;
    renderBigScreenStats();
}

function switchBsSubView(view) {
    bsSubView = view;
    const btnZones = document.getElementById('bsTabZonesBtn');
    const btnZp = document.getElementById('bsTabZpWardsBtn');
    const btnPs = document.getElementById('bsTabPsWardsBtn');
    const btnRanks = document.getElementById('bsTabRankingsBtn');
    const btnGps = document.getElementById('bsTabGpsBtn');

    if (btnZones) btnZones.classList.toggle('active', view === 'zones');
    if (btnZp) btnZp.classList.toggle('active', view === 'zp_wards');
    if (btnPs) btnPs.classList.toggle('active', view === 'ps_wards');
    if (btnRanks) btnRanks.classList.toggle('active', view === 'rankings');
    if (btnGps) btnGps.classList.toggle('active', view === 'gps');

    const vZones = document.getElementById('bsViewZones');
    const vZp = document.getElementById('bsViewZpWards');
    const vPs = document.getElementById('bsViewPsWards');
    const vRanks = document.getElementById('bsViewRankings');
    const vGps = document.getElementById('bsViewGps');

    if (vZones) vZones.style.display = view === 'zones' ? 'grid' : 'none';
    if (vZp) vZp.style.display = view === 'zp_wards' ? 'grid' : 'none';
    if (vPs) vPs.style.display = view === 'ps_wards' ? 'grid' : 'none';
    if (vRanks) vRanks.style.display = view === 'rankings' ? 'grid' : 'none';
    if (vGps) vGps.style.display = view === 'gps' ? 'grid' : 'none';
}

function toggleBsAutoCycle() {
    const txt = document.getElementById('bsAutoCycleText');
    if (bsAutoCycleInterval) {
        clearInterval(bsAutoCycleInterval);
        bsAutoCycleInterval = null;
        if (txt) txt.textContent = 'टीवी रोटेशन: बंद';
    } else {
        const views = ['zones', 'zp_wards', 'ps_wards', 'rankings', 'gps'];
        let idx = views.indexOf(bsSubView);
        if (idx === -1) idx = 0;
        bsAutoCycleInterval = setInterval(() => {
            idx = (idx + 1) % views.length;
            switchBsSubView(views[idx]);
        }, 12000); // 12 seconds per slide
        if (txt) txt.textContent = '🔄 टीवी रोटेशन: सक्रिय (12s)';
    }
}

// Comprehensive Big Screen Stats Renderer using liveData
function renderBigScreenStats() {
    if (!liveData) return;
    const k = liveData.kpi;
    const is22 = selectedDate === '22-10-2026';

    // Subtitle & Header Texts
    const subTitle = is22
        ? 'पंचायत समिति एवं जिला परिषद सदस्य आम चुनाव 2026 — दिनांक: 22-10-2026 | सुमेरपुर (पाली)'
        : 'सरपंच एवं वार्ड पंच आम चुनाव 2026 — दिनांक: 24-10-2026 | सुमेरपुर (पाली)';
    const subEl = document.getElementById('bsSubtitleDisplay');
    if (subEl) subEl.textContent = subTitle;

    const dateBtnText = document.getElementById('bsDateBtnText');
    if (dateBtnText) {
        dateBtnText.textContent = is22 ? '22-10-2026 (PS व ZP)' : '24-10-2026 (सरपंच)';
    }

    const roundText = document.getElementById('bsCurrentRoundText');
    if (roundText) roundText.textContent = `${bsSlot}:00 AM/PM`;

    // Ribbon slot chips
    const slots = k.slots || {};
    const elC10 = document.getElementById('bsSlotVal_10');
    const elC1 = document.getElementById('bsSlotVal_1');
    const elC3 = document.getElementById('bsSlotVal_3');
    const elC6 = document.getElementById('bsSlotVal_6');
    const elCFin = document.getElementById('bsSlotVal_Final');

    if (elC10 && slots.s10) elC10.textContent = `${slots.s10.pct}% (${slots.s10.count.toLocaleString('en-IN')})`;
    if (elC1 && slots.s13) elC1.textContent = `${slots.s13.pct}% (${slots.s13.count.toLocaleString('en-IN')})`;
    if (elC3 && slots.s15) elC3.textContent = `${slots.s15.pct}% (${slots.s15.count.toLocaleString('en-IN')})`;
    if (elC6 && slots.s18) elC6.textContent = `${slots.s18.pct}% (${slots.s18.count.toLocaleString('en-IN')})`;
    if (elCFin && slots.final) elCFin.textContent = `${slots.final.pct}% (${slots.final.count.toLocaleString('en-IN')})`;

    // Hero Cards
    const elTotVoters = document.getElementById('bsTotalVoters');
    const elPolled = document.getElementById('bsTotalPolledVotes');
    const elPct = document.getElementById('bsTurnoutPercentage');
    const elMock = document.getElementById('bsMockPollCount');
    const elStart = document.getElementById('bsPeacefulStartCount');
    const elReportedRatio = document.getElementById('bsReportedRatio');

    if (elTotVoters) elTotVoters.textContent = k.totalElectors.toLocaleString('en-IN');
    if (elPolled) elPolled.textContent = k.totalVotes.toLocaleString('en-IN');
    if (elPct) elPct.textContent = `${k.turnoutPct}%`;
    if (elMock) elMock.textContent = `${k.mockDone} / 152`;
    if (elStart) elStart.textContent = `${k.started} / 152`;

    // Reported count calculation
    let reportedCount = 0;
    if (liveData.booths) {
        liveData.booths.forEach(b => {
            if (b.latestVotes > 0 || b.v10 !== '') reportedCount++;
        });
    }
    if (elReportedRatio) elReportedRatio.textContent = `रिपोर्ट प्राप्त: ${reportedCount} / 152 बूथ`;

    // Sub-View 1: 10 Zones Grid
    const zonesGrid = document.getElementById('bsViewZones');
    if (zonesGrid && liveData.zones) {
        let zonesHtml = '';
        liveData.zones.forEach(z => {
            const pctNum = parseFloat(z.turnoutPct) || 0;
            let badgeClass = 'mid';
            if (pctNum >= 65) badgeClass = 'high';
            else if (pctNum < 35 && pctNum > 0) badgeClass = 'low';

            zonesHtml += `
                <div class="bs-zone-card">
                    <div class="bs-zone-card-top">
                        <div>
                            <div class="bs-zone-title">📍 ${z.zone_id} : ${z.name}</div>
                            <div class="bs-zone-magistrate">
                                <i class="fas fa-user-shield"></i> ${z.magistrate || 'जोनल मजिस्ट्रेट'} 
                                ${z.mobile ? ` | 📞 ${z.mobile}` : ''}
                            </div>
                        </div>
                        <div class="bs-zone-pct-badge ${badgeClass}">${z.turnoutPct}%</div>
                    </div>

                    <div class="bs-progress-bar-wrap">
                        <div class="bs-progress-bar-fill" style="width: ${Math.min(100, Math.max(3, pctNum))}%;"></div>
                    </div>

                    <div class="bs-zone-card-bottom">
                        <span>🗳️ मत: <b>${z.votes.toLocaleString('en-IN')}</b> / ${z.electors.toLocaleString('en-IN')}</span>
                        <span>🏛️ ${z.booth_count || 15} बूथ</span>
                    </div>
                </div>
            `;
        });
        zonesGrid.innerHTML = zonesHtml;
    }

    // Sub-View 2: 4 Zilla Parishad (ZP) Wards Grid
    const zpGrid = document.getElementById('bsViewZpWards');
    if (zpGrid && liveData.booths) {
        const zpStats = getZpWardStats();
        let zpHtml = '';
        zpStats.forEach(z => {
            zpHtml += `
                <div class="bs-zp-card">
                    <div class="bs-zp-head">
                        <div>
                            <div class="bs-zp-title">🏛️ ${z.id} : ${z.name}</div>
                            <div style="font-size:0.8rem; color:#94a3b8; margin-top:2px;">${z.boothCount} बूथ | कुल मतदाता: ${z.electors.toLocaleString('en-IN')}</div>
                        </div>
                        <div class="bs-zp-pct">${z.turnoutPct}%</div>
                    </div>
                    <div class="bs-zp-bar-bg">
                        <div class="bs-zp-bar-fill" style="width: ${Math.min(100, Math.max(3, z.turnoutPct))}%;"></div>
                    </div>
                    <div class="bs-zp-metrics">
                        <div>
                            <span>कुल मतदाता:</span>
                            <b>${z.electors.toLocaleString('en-IN')}</b>
                        </div>
                        <div>
                            <span>डाले गए मत:</span>
                            <b style="color:#a78bfa;">${z.votes.toLocaleString('en-IN')}</b>
                        </div>
                    </div>
                    <div style="font-size:0.75rem; color:#cbd5e1; margin-top:8px; line-height:1.3;">
                        <b>शामिल पंचायतें:</b> ${z.gpsList}
                    </div>
                </div>
            `;
        });
        zpGrid.innerHTML = zpHtml;
    }

    // Sub-View 3: 21 Panchayat Samiti (PS) Wards Grid
    const psGrid = document.getElementById('bsViewPsWards');
    if (psGrid && liveData.booths) {
        const psStats = getPsWardStats();
        let psHtml = '';
        psStats.forEach(p => {
            psHtml += `
                <div class="bs-ps-card">
                    <div class="bs-ps-head">
                        <div class="bs-ps-name">🏢 ${p.name}</div>
                        <div class="bs-ps-pct">${p.turnoutPct}%</div>
                    </div>
                    <div class="bs-ps-bar-bg">
                        <div class="bs-ps-bar-fill" style="width: ${Math.min(100, Math.max(3, p.turnoutPct))}%;"></div>
                    </div>
                    <div class="bs-ps-meta">
                        <span>${p.boothCount} बूथ | ${p.gpsList}</span>
                        <span><b>${p.votes.toLocaleString('en-IN')}</b> / ${p.electors.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            `;
        });
        psGrid.innerHTML = psHtml;
    }

    // Sub-View 4: Top & Slowest Booths Rankings
    const topListEl = document.getElementById('bsTopBoothsList');
    const slowListEl = document.getElementById('bsSlowBoothsList');

    if (topListEl && slowListEl && liveData.booths) {
        const sortedBooths = [...liveData.booths].sort((a, b) => b.turnoutPct - a.turnoutPct);
        const top5 = sortedBooths.slice(0, 5);
        const slow5 = [...sortedBooths].reverse().slice(0, 5);

        let topHtml = '';
        top5.forEach((b, idx) => {
            topHtml += `
                <div class="bs-rank-item">
                    <div>
                        <div class="bs-rank-booth">#${idx + 1}. बूथ ${b.id} : ${b.gp_name}</div>
                        <div class="bs-rank-sub" style="white-space:normal; line-height:1.3; font-size:0.8rem;">${b.location || ''} (${b.zone})</div>
                    </div>
                    <div class="bs-rank-val green">${b.turnoutPct}% <small style="font-size:0.75rem; color:#94a3b8;">(${b.latestVotes}/${b.electors})</small></div>
                </div>
            `;
        });
        topListEl.innerHTML = topHtml;

        let slowHtml = '';
        slow5.forEach((b, idx) => {
            slowHtml += `
                <div class="bs-rank-item">
                    <div>
                        <div class="bs-rank-booth">#${idx + 1}. बूथ ${b.id} : ${b.gp_name}</div>
                        <div class="bs-rank-sub" style="white-space:normal; line-height:1.3; font-size:0.8rem;">${b.location || ''} (${b.zone})</div>
                    </div>
                    <div class="bs-rank-val red">${b.turnoutPct}% <small style="font-size:0.75rem; color:#94a3b8;">(${b.latestVotes}/${b.electors})</small></div>
                </div>
            `;
        });
        slowListEl.innerHTML = slowHtml;
    }

    // Sub-View 5: 34 Gram Panchayats Grid
    const gpsGrid = document.getElementById('bsViewGps');
    if (gpsGrid && liveData.booths) {
        const gpMap = {};
        liveData.booths.forEach(b => {
            if (!gpMap[b.gp_name]) {
                gpMap[b.gp_name] = { gp: b.gp_name, zone: b.zone, voters: 0, polled: 0, booths: 0 };
            }
            gpMap[b.gp_name].booths++;
            gpMap[b.gp_name].voters += b.electors;
            gpMap[b.gp_name].polled += b.latestVotes;
        });

        const sortedGps = Object.values(gpMap).sort((a,b) => {
            const pa = a.voters > 0 ? (a.polled / a.voters) : 0;
            const pb = b.voters > 0 ? (b.polled / b.voters) : 0;
            return pb - pa;
        });

        let gpHtml = '';
        sortedGps.forEach((g, idx) => {
            const gPct = g.voters > 0 && g.polled > 0 ? ((g.polled / g.voters) * 100).toFixed(1) : '0.0';
            gpHtml += `
                <div class="bs-gp-chip">
                    <div>
                        <div class="bs-gp-name">${idx + 1}. ${g.gp}</div>
                        <div class="bs-gp-sub">${g.zone} | ${g.booths} बूथ | ${g.polled}/${g.voters} मत</div>
                    </div>
                    <div class="bs-gp-pct">${gPct}%</div>
                </div>
            `;
        });
        gpsGrid.innerHTML = gpHtml;
    }
}

