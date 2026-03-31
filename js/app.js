/* ================================================================
   KAM System — Customer Profile-Centric Application Logic
   ================================================================ */

// ── Data ──
let accounts = JSON.parse(localStorage.getItem('kam_accounts') || '[]');
let activities = JSON.parse(localStorage.getItem('kam_activities') || '[]');
let uploadBuffer = [];
const persist = () => { localStorage.setItem('kam_accounts', JSON.stringify(accounts)); localStorage.setItem('kam_activities', JSON.stringify(activities)); };
const uid = () => '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const won = n => '₩' + Number(n || 0).toLocaleString('ko-KR');
const num = n => Number(n || 0).toLocaleString('ko-KR');
const STAGES = ['초기접촉', '니즈파악', '제안', '협상', '수주', '실주'];
const STAGE_COLORS = { 초기접촉: '#1976D2', 니즈파악: '#F57F17', 제안: '#7B1FA2', 협상: '#E65100', 수주: '#2E7D32', 실주: '#C62828' };
const GRADE_COLORS = { A: '#A50034', B: '#1976D2', C: '#F57F17', D: '#767676' };
const TYPE_COLORS = { 미팅: '#1976D2', 전화: '#2E7D32', 이메일: '#F57F17', 제안서: '#7B1FA2', 계약: '#A50034', 기타: '#767676' };

// ── Helpers ──
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); }
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
window.closeModal = closeModal;

function getActCount(id) { return activities.filter(a => a.custId === id).length; }
function getLastAct(id) { return activities.filter(a => a.custId === id).sort((a, b) => b.date.localeCompare(a.date))[0]; }
function isDormant(acc) {
  const last = getLastAct(acc.id);
  if (!last) return true;
  const diff = (Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24);
  return diff > 30;
}

// ── Navigation ──
const pageTitles = {
  dashboard: '대시보드', profiles: '고객 프로파일', pipeline: '영업 파이프라인',
  grading: '고객 등급 관리', activities: '영업활동 내역', sales: '매출 분석',
  import: '데이터 가져오기', export: '데이터 내보내기', detail: '고객 상세'
};

document.getElementById('sideNav').addEventListener('click', e => {
  const item = e.target.closest('.nav-item');
  if (!item) return;
  navigateTo(item.dataset.page);
});

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('pg-' + page).classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[page] || '';
  refreshPage(page);
}

function refreshPage(page) {
  if (page === 'dashboard') renderDashboard();
  if (page === 'profiles') renderProfiles();
  if (page === 'pipeline') renderPipeline();
  if (page === 'grading') renderGrading();
  if (page === 'activities') renderActivities();
  if (page === 'sales') renderSales();
}

document.getElementById('btnBulkUpload')?.addEventListener('click', () => navigateTo('import'));

// ── Charts ──
const charts = {};
function makeChart(id, type, labels, datasets, opts = {}) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type, data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: opts.legend !== false, position: 'bottom', labels: { usePointStyle: true, padding: 14, font: { size: 11 } } } },
      scales: type === 'doughnut' || type === 'pie' ? {} : { y: { beginAtZero: true, grid: { color: '#F2F3F5' } }, x: { grid: { display: false } } },
    }
  });
}

/* ================================================================
   DASHBOARD — 고객 프로파일 중심
   ================================================================ */
function renderDashboard() {
  document.getElementById('dashDate').textContent =
    new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const total = accounts.length;
  const vip = accounts.filter(a => a.grade === 'A').length;
  const active = accounts.filter(a => !['수주', '실주'].includes(a.stage)).length;
  const dormant = accounts.filter(a => isDormant(a) && !['수주', '실주'].includes(a.stage)).length;
  const totalRev = accounts.reduce((s, a) => s + (a.revenue || 0), 0);
  const wonCnt = accounts.filter(a => a.stage === '수주').length;
  const winRate = total > 0 ? Math.round(wonCnt / total * 100) : 0;
  const weightedRev = accounts.reduce((s, a) => s + Math.round((a.revenue || 0) * (a.prob || 0) / 100), 0);

  document.getElementById('dkTotal').textContent = total;
  document.getElementById('dkVip').textContent = vip;
  document.getElementById('dkActive').textContent = active;
  document.getElementById('dkDormant').textContent = dormant;
  document.getElementById('dkRevenue').textContent = won(totalRev);
  document.getElementById('dkWon').textContent = wonCnt;
  document.getElementById('dkWinRate').textContent = winRate + '%';
  document.getElementById('dkActTotal').textContent = activities.length;
  document.getElementById('dkWeighted').textContent = won(weightedRev);
  document.getElementById('navAccCnt').textContent = total;

  // Top 5 profiles
  const top5 = [...accounts].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 5);
  const topEl = document.getElementById('topProfiles');
  if (!top5.length) {
    topEl.innerHTML = '<div class="empty-state"><i class="fas fa-user-tie"></i><p>등록된 고객이 없습니다.</p></div>';
  } else {
    topEl.innerHTML = top5.map(a => `
      <div class="top-profile-card" onclick="openProfile('${a.id}')">
        <div class="tp-name"><span class="grade-badge ${a.grade || 'D'}">${a.grade || 'D'}</span>${a.company}</div>
        <div class="tp-info">${a.industry || '-'} · ${a.manager || '-'} · 활동 ${getActCount(a.id)}건</div>
        <div class="tp-revenue">${won(a.revenue)}</div>
      </div>`).join('');
  }

  const gradientColors = ['#6366F1', '#EC4899', '#F59E0B', '#94A3B8'];

  // 1. Pipeline (bar)
  const stageCnt = STAGES.map(s => accounts.filter(a => a.stage === s).length);
  const pipeColors = ['#6366F1', '#F59E0B', '#8B5CF6', '#F97316', '#10B981', '#EF4444'];
  makeChart('chPipe', 'bar', STAGES, [{
    label: '고객 수', data: stageCnt, backgroundColor: pipeColors, borderRadius: 8, barPercentage: 0.6
  }], { legend: false });

  // 2. Grade (doughnut)
  const grades = ['A', 'B', 'C', 'D'];
  const gradeCnt = grades.map(g => accounts.filter(a => (a.grade || 'D') === g).length);
  makeChart('chGrade', 'doughnut', grades.map(g => g + '등급'), [{
    data: gradeCnt, backgroundColor: gradientColors, borderWidth: 0, hoverOffset: 8
  }]);

  // 3. Stage revenue (polarArea)
  const stageRev = STAGES.map(s => accounts.filter(a => a.stage === s).reduce((sum, a) => sum + (a.revenue || 0), 0));
  makeChart('chStageRev', 'polarArea', STAGES, [{
    data: stageRev, backgroundColor: pipeColors.map(c => c + '99'), borderWidth: 0
  }]);

  // 4. Monthly activity trend (line)
  const months = []; const now = new Date();
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i); months.push(d.toLocaleDateString('ko-KR', { month: 'short' })); }
  const mCnt = months.map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i); return activities.filter(a => { const ad = new Date(a.date); return ad.getMonth() === d.getMonth() && ad.getFullYear() === d.getFullYear(); }).length; });
  makeChart('chMonthly', 'line', months, [{
    label: '활동 건수', data: mCnt,
    borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,.1)',
    fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#6366F1',
    pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 3
  }], { legend: false });

  // 5. Industry (doughnut)
  const industries = [...new Set(accounts.map(a => a.industry || '미분류'))];
  const indCnt = industries.map(i => accounts.filter(a => (a.industry || '미분류') === i).length);
  const indColors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EF4444', '#F97316'];
  makeChart('chIndustry', 'doughnut', industries, [{
    data: indCnt, backgroundColor: indColors.slice(0, industries.length), borderWidth: 0, hoverOffset: 8
  }]);

  // 6. Activity type (pie)
  const actTypes = ['미팅', '전화', '이메일', '제안서', '계약', '기타'];
  const atCnt = actTypes.map(t => activities.filter(a => a.type === t).length);
  makeChart('chActType', 'pie', actTypes, [{
    data: atCnt, backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#94A3B8'], borderWidth: 0, hoverOffset: 6
  }]);

  // 7. Owner revenue (horizontal bar)
  const owners = [...new Set(accounts.map(a => a.manager || '미지정'))];
  const ownRev = owners.map(o => accounts.filter(a => (a.manager || '미지정') === o).reduce((s, a) => s + (a.revenue || 0), 0));
  makeChart('chOwner', 'bar', owners, [{
    label: '매출', data: ownRev,
    backgroundColor: 'rgba(99,102,241,.7)', borderColor: '#6366F1', borderWidth: 1, borderRadius: 8, barPercentage: 0.5
  }], { legend: false });

  // 8. Grade revenue (bar)
  const gradeRev = grades.map(g => accounts.filter(a => (a.grade || 'D') === g).reduce((s, a) => s + (a.revenue || 0), 0));
  makeChart('chGradeRev', 'bar', grades.map(g => g + '등급'), [{
    label: '예상매출', data: gradeRev, backgroundColor: gradientColors.map(c => c + 'CC'), borderRadius: 8, barPercentage: 0.5
  }, {
    label: '가중매출', data: grades.map(g => accounts.filter(a => (a.grade || 'D') === g).reduce((s, a) => s + Math.round((a.revenue || 0) * (a.prob || 0) / 100), 0)),
    backgroundColor: gradientColors.map(c => c + '55'), borderRadius: 8, barPercentage: 0.5
  }]);

  // 9. Probability distribution (bar)
  const probRanges = ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'];
  const probCnt = probRanges.map((_, i) => accounts.filter(a => { const p = a.prob || 0; return p >= i * 20 + (i ? 1 : 0) && p <= (i + 1) * 20; }).length);
  makeChart('chProbDist', 'bar', probRanges, [{
    label: '고객수', data: probCnt,
    backgroundColor: ['#EF4444CC', '#F97316CC', '#F59E0BCC', '#10B981CC', '#6366F1CC'],
    borderRadius: 8, barPercentage: 0.6
  }], { legend: false });

  // 10. Company size (doughnut)
  const sizes = ['대기업', '중견기업', '중소기업', '스타트업'];
  const sizeCnt = sizes.map(s => accounts.filter(a => (a.companySize || '중소기업') === s).length);
  makeChart('chSize', 'doughnut', sizes, [{
    data: sizeCnt, backgroundColor: ['#6366F1', '#06B6D4', '#F59E0B', '#EC4899'], borderWidth: 0, hoverOffset: 8
  }]);

  // Activity stream
  const stream = document.getElementById('dashStream');
  const recent = activities.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  if (!recent.length) {
    stream.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>등록된 영업활동이 없습니다.</p></div>';
  } else {
    stream.innerHTML = recent.map(a => {
      const acc = accounts.find(c => c.id === a.custId);
      return `<div class="timeline-item">
        <div class="tl-dot" style="background:${TYPE_COLORS[a.type] || '#767676'}"></div>
        <div class="tl-body"><strong>${acc ? acc.company : '(삭제됨)'}</strong> — <span class="type-badge ${a.type}">${a.type}</span> ${a.content.slice(0, 80)}
        <div class="tl-date">${a.date} · ${a.manager || ''}</div></div>
      </div>`;
    }).join('');
  }
}

/* ================================================================
   PROFILES — 고객 프로파일 카드/테이블/칸반
   ================================================================ */
function getFilteredAccounts() {
  const q = (document.getElementById('accSearch')?.value || '').toLowerCase();
  const fg = document.getElementById('fltGrade')?.value || '';
  const fs = document.getElementById('fltStage')?.value || '';
  const fi = document.getElementById('fltIndustry')?.value || '';
  const fo = document.getElementById('fltOwner')?.value || '';
  return accounts.filter(a => {
    const matchQ = !q || a.company.toLowerCase().includes(q) || (a.contact || '').toLowerCase().includes(q) || (a.manager || '').toLowerCase().includes(q) || (a.industry || '').toLowerCase().includes(q);
    return matchQ && (!fg || (a.grade || 'D') === fg) && (!fs || a.stage === fs) && (!fi || a.industry === fi) && (!fo || a.manager === fo);
  });
}

function renderProfiles() {
  populateFilterOptions();
  const list = getFilteredAccounts();
  document.getElementById('accCount').textContent = list.length + '건';

  // Card View
  const cardEl = document.getElementById('profileCardView');
  if (!list.length) {
    cardEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-id-card-alt"></i><p>등록된 고객이 없습니다. 새 고객을 등록하세요.</p></div>';
  } else {
    cardEl.innerHTML = list.map(a => {
      const actCnt = getActCount(a.id);
      const lastAct = getLastAct(a.id);
      return `<div class="profile-card" onclick="openProfile('${a.id}')">
        <div class="profile-card-top">
          <div class="profile-avatar ${a.grade || 'D'}">${(a.grade || 'D')}</div>
          <div class="profile-info">
            <div class="company">${a.company}</div>
            <div class="contact">${a.contact || '-'}${a.position ? ' · ' + a.position : ''}</div>
            ${a.industry ? `<span class="industry-tag">${a.industry}</span>` : ''}
          </div>
        </div>
        <div class="profile-card-body">
          <div class="profile-stat"><span class="stat-label">예상매출</span><span class="stat-value" style="color:var(--lg-red)">${won(a.revenue)}</span></div>
          <div class="profile-stat"><span class="stat-label">수주확률</span><span class="stat-value">${a.prob || 0}%</span></div>
          <div class="profile-stat"><span class="stat-label">영업담당</span><span class="stat-value">${a.manager || '-'}</span></div>
          <div class="profile-stat"><span class="stat-label">최근활동</span><span class="stat-value">${lastAct ? lastAct.date : '-'}</span></div>
        </div>
        <div class="profile-card-footer">
          <span class="badge ${a.stage}">${a.stage}</span>
          <span class="activity-count"><i class="fas fa-clipboard-list"></i> ${actCnt}건</span>
        </div>
      </div>`;
    }).join('');
  }

  // Table View
  const tbody = document.getElementById('accTbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="12"><div class="empty-state"><p>고객이 없습니다.</p></div></td></tr>';
  } else {
    tbody.innerHTML = list.map(a => {
      const actCnt = getActCount(a.id);
      const lastAct = getLastAct(a.id);
      const pColor = a.prob > 60 ? '#2E7D32' : a.prob > 30 ? '#F57F17' : '#C62828';
      return `<tr>
        <td><span class="grade-badge ${a.grade || 'D'}">${a.grade || 'D'}</span></td>
        <td><a href="#" class="acc-link" data-id="${a.id}" style="color:var(--lg-red);font-weight:600">${a.company}</a></td>
        <td>${a.contact || '-'}${a.position ? '<br><small style="color:var(--lg-gray-300)">' + a.position + '</small>' : ''}</td>
        <td>${a.phone || '-'}</td><td>${a.industry || '-'}</td>
        <td><span class="badge ${a.stage}">${a.stage}</span></td>
        <td><div class="prob-bar"><div class="pb-track"><div class="pb-fill" style="width:${a.prob}%;background:${pColor}"></div></div><span class="pb-text">${a.prob}%</span></div></td>
        <td style="font-weight:500">${num(a.revenue)}</td>
        <td>${a.manager || '-'}</td>
        <td>${actCnt}건</td>
        <td style="font-size:.82rem;color:var(--lg-gray-500)">${lastAct ? lastAct.date : '-'}</td>
        <td><div class="btn-group">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();editAccount('${a.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteAccount('${a.id}')" style="color:#C62828"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  }

  // Kanban
  renderKanbanView(list, 'accKanban');
}

function populateFilterOptions() {
  const inds = [...new Set(accounts.map(a => a.industry).filter(Boolean))];
  const owrs = [...new Set(accounts.map(a => a.manager).filter(Boolean))];
  const iSel = document.getElementById('fltIndustry');
  const oSel = document.getElementById('fltOwner');
  if (iSel) { const v = iSel.value; iSel.innerHTML = '<option value="">전체 산업군</option>' + inds.map(i => `<option>${i}</option>`).join(''); iSel.value = v; }
  if (oSel) { const v = oSel.value; oSel.innerHTML = '<option value="">전체 담당자</option>' + owrs.map(o => `<option>${o}</option>`).join(''); oSel.value = v; }
}

function renderKanbanView(list, containerId) {
  const headClass = { 초기접촉: 's1', 니즈파악: 's2', 제안: 's3', 협상: 's4', 수주: 's5', 실주: 's6' };
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = STAGES.map(s => {
    const items = list.filter(a => a.stage === s);
    const rev = items.reduce((sum, a) => sum + (a.revenue || 0), 0);
    return `<div class="kanban-col">
      <div class="kanban-col-head ${headClass[s]}">${s} <span class="cnt">${items.length}</span></div>
      ${items.length ? items.map(a => `
        <div class="kanban-card" onclick="openProfile('${a.id}')">
          <div class="kc-name"><span class="grade-badge ${a.grade || 'D'}" style="width:20px;height:20px;font-size:.65rem;border-radius:4px">${a.grade || 'D'}</span> ${a.company}</div>
          <div class="kc-info">${a.manager || '-'} · ${a.industry || '-'}</div>
          <div class="kc-revenue">${won(a.revenue)}</div>
        </div>`).join('') : '<div style="text-align:center;padding:20px;color:var(--lg-gray-300);font-size:.82rem">없음</div>'}
    </div>`;
  }).join('');
}

// View Toggle
document.querySelectorAll('.view-toggle').forEach(toggle => {
  toggle.addEventListener('click', e => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    toggle.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.view;
    const cardView = document.getElementById('profileCardView');
    const tableView = document.getElementById('accTableView');
    const kanbanView = document.getElementById('accKanban');
    if (cardView) cardView.style.display = v === 'card' ? '' : 'none';
    if (tableView) tableView.style.display = v === 'table' ? '' : 'none';
    if (kanbanView) kanbanView.style.display = v === 'kanban' ? '' : 'none';
  });
});

// Filters
['accSearch', 'fltGrade', 'fltStage', 'fltIndustry', 'fltOwner'].forEach(id => {
  const el = document.getElementById(id);
  if (el) { el.addEventListener('input', renderProfiles); el.addEventListener('change', renderProfiles); }
});

// Click account link in table
document.addEventListener('click', e => {
  const link = e.target.closest('.acc-link');
  if (link) { e.preventDefault(); openProfile(link.dataset.id); }
});

/* ================================================================
   CUSTOMER DETAIL — 프로파일 상세 페이지
   ================================================================ */
let currentProfileId = null;

window.openProfile = function (id) {
  currentProfileId = id;
  const a = accounts.find(x => x.id === id);
  if (!a) return;

  // Navigate
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('pg-detail').classList.add('active');
  document.getElementById('pageTitle').textContent = a.company + ' — 고객 프로파일';

  // Header
  document.getElementById('detailCompanyName').textContent = a.company;
  const stageBadge = document.getElementById('detailStageBadge');
  stageBadge.textContent = a.stage;
  stageBadge.className = 'badge ' + a.stage;
  const gradeBadge = document.getElementById('detailGradeBadge');
  gradeBadge.textContent = (a.grade || 'D') + '등급';
  gradeBadge.className = 'grade-badge ' + (a.grade || 'D');

  // Summary bar
  const actCnt = getActCount(id);
  const weighted = Math.round((a.revenue || 0) * (a.prob || 0) / 100);
  document.getElementById('profileSummary').innerHTML = `
    <div class="ps-item"><div class="ps-label">등급</div><div class="ps-value"><span class="grade-badge grade-badge-lg ${a.grade || 'D'}">${a.grade || 'D'}</span></div></div>
    <div class="ps-item"><div class="ps-label">영업단계</div><div class="ps-value">${a.stage}</div></div>
    <div class="ps-item"><div class="ps-label">수주확률</div><div class="ps-value">${a.prob}%</div></div>
    <div class="ps-item"><div class="ps-label">예상매출</div><div class="ps-value" style="color:var(--lg-red)">${won(a.revenue)}</div></div>
    <div class="ps-item"><div class="ps-label">가중매출</div><div class="ps-value">${won(weighted)}</div></div>
    <div class="ps-item"><div class="ps-label">활동수</div><div class="ps-value">${actCnt}건</div></div>
  `;

  // Tabs
  renderDetailTabs(a);

  // Reset to first tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="tab-info"]').classList.add('active');
  document.getElementById('tab-info').classList.add('active');
};

function renderDetailTabs(a) {
  const acts = activities.filter(x => x.custId === a.id).sort((x, y) => y.date.localeCompare(x.date));

  // Tab 1: 기본정보
  document.getElementById('tab-info').innerHTML = `
    <div class="card"><div class="card-header"><h3>기업 정보</h3></div><div class="card-body">
      <div class="detail-section">
        <div class="detail-row"><span class="dl">기업명</span><span class="dv">${a.company}</span></div>
        <div class="detail-row"><span class="dl">산업군</span><span class="dv">${a.industry || '-'}</span></div>
        <div class="detail-row"><span class="dl">기업규모</span><span class="dv">${a.companySize || '-'}</span></div>
        <div class="detail-row"><span class="dl">등급</span><span class="dv"><span class="grade-badge ${a.grade || 'D'}">${a.grade || 'D'}</span></span></div>
        <div class="detail-row"><span class="dl">등록일</span><span class="dv">${a.created || '-'}</span></div>
      </div>
      <div class="detail-section">
        <h4>Key Contact (핵심 담당자)</h4>
        <div class="detail-row"><span class="dl">담당자명</span><span class="dv">${a.contact || '-'}</span></div>
        <div class="detail-row"><span class="dl">직책</span><span class="dv">${a.position || '-'}</span></div>
        <div class="detail-row"><span class="dl">연락처</span><span class="dv">${a.phone || '-'}</span></div>
        <div class="detail-row"><span class="dl">이메일</span><span class="dv">${a.email || '-'}</span></div>
      </div>
      <div class="detail-section">
        <h4>영업 담당</h4>
        <div class="detail-row"><span class="dl">영업담당자</span><span class="dv">${a.manager || '-'}</span></div>
      </div>
    </div></div>`;

  // Tab 2: 영업/매출
  document.getElementById('tab-sales').innerHTML = `
    <div class="card"><div class="card-header"><h3>영업 & 매출 정보</h3></div><div class="card-body">
      <div class="detail-row"><span class="dl">영업단계</span><span class="dv"><span class="badge ${a.stage}">${a.stage}</span></span></div>
      <div class="detail-row"><span class="dl">수주확률</span><span class="dv">${a.prob}%</span></div>
      <div class="detail-row"><span class="dl">예상매출</span><span class="dv" style="color:var(--lg-red);font-weight:700;font-size:1.1rem">${won(a.revenue)}</span></div>
      <div class="detail-row"><span class="dl">가중매출 (매출 × 확률)</span><span class="dv">${won(Math.round((a.revenue || 0) * (a.prob || 0) / 100))}</span></div>
    </div></div>`;

  // Tab 3: 활동이력
  document.getElementById('tab-activity').innerHTML = `
    <div class="card"><div class="card-header"><h3>영업활동 이력 (${acts.length}건)</h3>
      <button class="btn btn-primary btn-sm" onclick="openActModalFor('${a.id}')"><i class="fas fa-plus"></i>활동 추가</button>
    </div><div class="card-body">
      ${acts.length ? acts.map(ac => `<div class="timeline-item">
        <div class="tl-dot" style="background:${TYPE_COLORS[ac.type] || '#767676'}"></div>
        <div class="tl-body"><span class="type-badge ${ac.type}">${ac.type}</span> ${ac.content}
        ${ac.result ? '<br><small style="color:var(--lg-gray-500)">결과: ' + ac.result + '</small>' : ''}
        ${ac.next ? '<br><small style="color:var(--lg-gray-500)">후속: ' + ac.next + '</small>' : ''}
        <div class="tl-date">${ac.date} · ${ac.manager || ''}</div></div>
      </div>`).join('') : '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>활동 내역이 없습니다.</p></div>'}
    </div></div>`;

  // Tab 4: 메모
  document.getElementById('tab-notes').innerHTML = `
    <div class="card"><div class="card-header"><h3>메모 / 비고</h3></div><div class="card-body">
      <p style="font-size:.92rem;color:var(--lg-gray-700);white-space:pre-wrap;min-height:80px">${a.notes || '등록된 메모가 없습니다.'}</p>
    </div></div>`;
}

// Tab switching
document.querySelector('.detail-tabs')?.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).classList.add('active');
});

// Detail page buttons
document.getElementById('detailEditBtn')?.addEventListener('click', () => { if (currentProfileId) editAccount(currentProfileId); });
document.getElementById('detailDelBtn')?.addEventListener('click', () => { if (currentProfileId) { deleteAccount(currentProfileId); navigateTo('profiles'); } });
document.getElementById('detailActBtn')?.addEventListener('click', () => { if (currentProfileId) openActModalFor(currentProfileId); });

window.openActModalFor = function (custId) {
  document.getElementById('actModalTitle').textContent = '영업활동 기록';
  document.getElementById('actForm').reset();
  document.getElementById('actFormId').value = '';
  document.getElementById('bf2').value = today();
  fillCustSelect();
  document.getElementById('bf1').value = custId;
  openModal('actModal');
};

/* ================================================================
   ACCOUNT CRUD
   ================================================================ */
document.getElementById('btnNewAcc')?.addEventListener('click', () => {
  document.getElementById('accModalTitle').textContent = '고객 프로파일 등록';
  document.getElementById('accForm').reset();
  document.getElementById('accId').value = '';
  openModal('accModal');
});

document.getElementById('btnSaveAcc')?.addEventListener('click', () => {
  const form = document.getElementById('accForm');
  if (!form.reportValidity()) return;
  const id = document.getElementById('accId').value;
  const obj = {
    id: id || uid(),
    company: document.getElementById('af1').value,
    contact: document.getElementById('af2').value,
    phone: document.getElementById('af3').value,
    email: document.getElementById('af4').value,
    industry: document.getElementById('af5').value,
    stage: document.getElementById('af6').value,
    prob: +document.getElementById('af7').value,
    revenue: +document.getElementById('af8').value,
    manager: document.getElementById('af9').value,
    notes: document.getElementById('af10').value,
    grade: document.getElementById('af11').value,
    companySize: document.getElementById('af12').value,
    position: document.getElementById('af13').value,
    created: id ? (accounts.find(a => a.id === id) || {}).created || today() : today(),
    updated: today()
  };
  if (id) { const idx = accounts.findIndex(a => a.id === id); accounts[idx] = obj; toast('고객 프로파일이 수정되었습니다.'); }
  else { accounts.push(obj); toast('새 고객이 등록되었습니다.'); }
  persist(); closeModal('accModal');
  renderProfiles(); renderDashboard();
  if (currentProfileId === id) openProfile(id);
});

window.editAccount = function (id) {
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  document.getElementById('accModalTitle').textContent = '고객 프로파일 수정';
  document.getElementById('accId').value = a.id;
  document.getElementById('af1').value = a.company;
  document.getElementById('af2').value = a.contact || '';
  document.getElementById('af3').value = a.phone || '';
  document.getElementById('af4').value = a.email || '';
  document.getElementById('af5').value = a.industry || '';
  document.getElementById('af6').value = a.stage;
  document.getElementById('af7').value = a.prob;
  document.getElementById('af8').value = a.revenue;
  document.getElementById('af9').value = a.manager || '';
  document.getElementById('af10').value = a.notes || '';
  document.getElementById('af11').value = a.grade || 'A';
  document.getElementById('af12').value = a.companySize || '대기업';
  document.getElementById('af13').value = a.position || '';
  openModal('accModal');
};

window.deleteAccount = function (id) {
  if (!confirm('이 고객을 삭제하시겠습니까?\n관련 활동도 함께 삭제됩니다.')) return;
  accounts = accounts.filter(a => a.id !== id);
  activities = activities.filter(a => a.custId !== id);
  persist(); renderProfiles(); toast('고객이 삭제되었습니다.');
};

/* ================================================================
   GRADING — 고객 등급 관리
   ================================================================ */
function renderGrading() {
  const grades = ['A', 'B', 'C', 'D'];
  const descs = { A: '핵심 고객 (VIP)', B: '주요 고객', C: '일반 고객', D: '관리 대상' };
  const overview = document.getElementById('gradeOverview');
  overview.innerHTML = grades.map(g => {
    const list = accounts.filter(a => (a.grade || 'D') === g);
    const rev = list.reduce((s, a) => s + (a.revenue || 0), 0);
    return `<div class="grade-card">
      <div class="grade-letter" style="color:${GRADE_COLORS[g]}">${g}</div>
      <div class="grade-count">${list.length}개사</div>
      <div class="grade-desc">${descs[g]}</div>
      <div class="grade-rev">${won(rev)}</div>
    </div>`;
  }).join('');

  const flt = document.getElementById('fltGradeView')?.value || '';
  const list = accounts.filter(a => !flt || (a.grade || 'D') === flt);
  const tbody = document.getElementById('gradeTbody');
  tbody.innerHTML = list.map(a => `<tr>
    <td><span class="grade-badge grade-badge-lg ${a.grade || 'D'}">${a.grade || 'D'}</span></td>
    <td><a href="#" class="acc-link" data-id="${a.id}" style="color:var(--lg-red);font-weight:600">${a.company}</a></td>
    <td>${a.industry || '-'}</td>
    <td><span class="badge ${a.stage}">${a.stage}</span></td>
    <td>${num(a.revenue)}</td>
    <td>${getActCount(a.id)}건</td>
    <td>${a.manager || '-'}</td>
    <td><select class="filter-select" style="padding:5px 8px;font-size:.82rem" onchange="changeGrade('${a.id}',this.value)">
      ${grades.map(g => `<option ${(a.grade || 'D') === g ? 'selected' : ''}>${g}</option>`).join('')}
    </select></td>
  </tr>`).join('') || '<tr><td colspan="8"><div class="empty-state"><p>고객이 없습니다.</p></div></td></tr>';
}

document.getElementById('fltGradeView')?.addEventListener('change', renderGrading);

window.changeGrade = function (id, grade) {
  const a = accounts.find(x => x.id === id);
  if (a) { a.grade = grade; a.updated = today(); persist(); renderGrading(); toast(`${a.company} → ${grade}등급 변경`); }
};

/* ================================================================
   PIPELINE
   ================================================================ */
function renderPipeline() {
  // Summary
  const summary = document.getElementById('pipelineSummary');
  const stageColors = ['#1976D2', '#F57F17', '#7B1FA2', '#E65100', '#2E7D32', '#C62828'];
  summary.innerHTML = STAGES.map((s, i) => {
    const list = accounts.filter(a => a.stage === s);
    const rev = list.reduce((sum, a) => sum + (a.revenue || 0), 0);
    return `<div class="pipeline-stage" style="background:${stageColors[i]}">
      <div class="ps-cnt">${list.length}</div>
      <div class="ps-lbl">${s}</div>
      <div class="ps-rev">${won(rev)}</div>
    </div>`;
  }).join('');

  renderKanbanView(accounts, 'pipeKanban');
}

/* ================================================================
   ACTIVITIES
   ================================================================ */
function fillCustSelect() {
  const sel = document.getElementById('bf1');
  sel.innerHTML = '<option value="">선택하세요</option>' + accounts.map(a => `<option value="${a.id}">${a.company}</option>`).join('');
}

function renderActivities() {
  const q = (document.getElementById('actSearch')?.value || '').toLowerCase();
  const tf = document.getElementById('fltActType')?.value || '';
  const list = activities.filter(a => {
    const acc = accounts.find(c => c.id === a.custId);
    return (!q || (acc && acc.company.toLowerCase().includes(q)) || a.content.toLowerCase().includes(q)) && (!tf || a.type === tf);
  }).sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('actCount').textContent = list.length + '건';
  const tbody = document.getElementById('actTbody');
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-clipboard-list"></i><p>활동 내역이 없습니다.</p></div></td></tr>'; return; }
  tbody.innerHTML = list.map(a => {
    const acc = accounts.find(c => c.id === a.custId);
    return `<tr>
      <td>${a.date}</td>
      <td><a href="#" class="acc-link" data-id="${a.custId}" style="color:var(--lg-red);font-weight:600">${acc ? acc.company : '(삭제됨)'}</a></td>
      <td><span class="type-badge ${a.type}">${a.type}</span></td>
      <td>${a.content.length > 50 ? a.content.slice(0, 50) + '...' : a.content}</td>
      <td>${a.result || '-'}</td><td>${a.next || '-'}</td><td>${a.manager || '-'}</td>
      <td><div class="btn-group">
        <button class="btn btn-ghost btn-sm" onclick="editActivity('${a.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="deleteActivity('${a.id}')" style="color:#C62828"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

['actSearch', 'fltActType'].forEach(id => {
  const el = document.getElementById(id);
  if (el) { el.addEventListener('input', renderActivities); el.addEventListener('change', renderActivities); }
});

document.getElementById('btnNewAct')?.addEventListener('click', () => {
  document.getElementById('actModalTitle').textContent = '영업활동 기록';
  document.getElementById('actForm').reset();
  document.getElementById('actFormId').value = '';
  document.getElementById('bf2').value = today();
  fillCustSelect();
  openModal('actModal');
});

document.getElementById('btnSaveAct')?.addEventListener('click', () => {
  const form = document.getElementById('actForm');
  if (!form.reportValidity()) return;
  const id = document.getElementById('actFormId').value;
  const obj = {
    id: id || uid(), custId: document.getElementById('bf1').value,
    date: document.getElementById('bf2').value, type: document.getElementById('bf3').value,
    manager: document.getElementById('bf4').value, content: document.getElementById('bf5').value,
    result: document.getElementById('bf6').value, next: document.getElementById('bf7').value
  };
  if (id) { const idx = activities.findIndex(a => a.id === id); activities[idx] = obj; toast('활동이 수정되었습니다.'); }
  else { activities.push(obj); toast('활동이 등록되었습니다.'); }
  persist(); closeModal('actModal'); renderActivities();
  if (currentProfileId) { const a = accounts.find(x => x.id === currentProfileId); if (a) renderDetailTabs(a); }
});

window.editActivity = function (id) {
  const a = activities.find(x => x.id === id);
  if (!a) return;
  document.getElementById('actModalTitle').textContent = '활동 수정';
  document.getElementById('actFormId').value = a.id;
  fillCustSelect();
  document.getElementById('bf1').value = a.custId;
  document.getElementById('bf2').value = a.date;
  document.getElementById('bf3').value = a.type;
  document.getElementById('bf4').value = a.manager || '';
  document.getElementById('bf5').value = a.content;
  document.getElementById('bf6').value = a.result || '';
  document.getElementById('bf7').value = a.next || '';
  openModal('actModal');
};

window.deleteActivity = function (id) {
  if (!confirm('이 활동을 삭제하시겠습니까?')) return;
  activities = activities.filter(a => a.id !== id);
  persist(); renderActivities(); toast('활동이 삭제되었습니다.');
};

/* ================================================================
   SALES
   ================================================================ */
function renderSales() {
  const totalRev = accounts.reduce((s, a) => s + (a.revenue || 0), 0);
  const wonRev = accounts.filter(a => a.stage === '수주').reduce((s, a) => s + (a.revenue || 0), 0);
  const pendRev = accounts.filter(a => !['수주', '실주'].includes(a.stage)).reduce((s, a) => s + (a.revenue || 0), 0);
  const total = accounts.length;
  const wonCnt = accounts.filter(a => a.stage === '수주').length;
  const rate = total > 0 ? Math.round(wonCnt / total * 100) : 0;

  document.getElementById('skTotal').textContent = won(totalRev);
  document.getElementById('skWon').textContent = won(wonRev);
  document.getElementById('skPending').textContent = won(pendRev);
  document.getElementById('skRate').textContent = rate + '%';

  // Grade revenue
  const grades = ['A', 'B', 'C', 'D'];
  const gradeRev = grades.map(g => accounts.filter(a => (a.grade || 'D') === g).reduce((s, a) => s + (a.revenue || 0), 0));
  makeChart('chSalesGrade', 'bar', grades.map(g => g + '등급'), [{
    label: '매출', data: gradeRev, backgroundColor: grades.map(g => GRADE_COLORS[g]), borderRadius: 6, barPercentage: 0.5
  }], { legend: false });

  // Owner
  const owners = [...new Set(accounts.map(a => a.manager || '미지정'))];
  const ownRev = owners.map(o => accounts.filter(a => (a.manager || '미지정') === o).reduce((s, a) => s + (a.revenue || 0), 0));
  makeChart('chSalesOwner', 'bar', owners, [{
    label: '매출', data: ownRev, backgroundColor: '#A50034', borderRadius: 6, barPercentage: 0.5
  }], { legend: false });

  // Table
  const sorted = [...accounts].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  document.getElementById('salesTbody').innerHTML = sorted.map(a => {
    const w = Math.round((a.revenue || 0) * (a.prob || 0) / 100);
    return `<tr>
      <td><span class="grade-badge ${a.grade || 'D'}">${a.grade || 'D'}</span></td>
      <td><a href="#" class="acc-link" data-id="${a.id}" style="color:var(--lg-red);font-weight:600">${a.company}</a></td>
      <td>${a.industry || '-'}</td>
      <td><span class="badge ${a.stage}">${a.stage}</span></td>
      <td>${a.prob}%</td>
      <td style="font-weight:600">${num(a.revenue)}</td>
      <td style="color:var(--lg-red);font-weight:600">${num(w)}</td>
      <td>${a.manager || '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="8"><div class="empty-state"><p>데이터가 없습니다.</p></div></td></tr>';
}

document.getElementById('btnExportSales')?.addEventListener('click', () => document.getElementById('expSales')?.click());

/* ================================================================
   IMPORT / EXPORT
   ================================================================ */
window.goImportStep = function (step) {
  [1, 2, 3].forEach(i => {
    document.getElementById('is' + i).style.display = i === step ? '' : 'none';
    const si = document.getElementById('st' + i);
    si.classList.remove('active', 'done');
    if (i < step) si.classList.add('done');
    if (i === step) si.classList.add('active');
  });
};

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
if (dropZone) {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragging'); processFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', e => processFile(e.target.files[0]));
}

function processFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(e.target.result, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws);
    if (!json.length) { toast('데이터가 없습니다.'); return; }
    uploadBuffer = json.map(r => ({
      id: uid(), company: r['기업명'] || r['거래처명'] || '',
      contact: r['담당자명'] || r['담당자'] || '',
      position: r['직책'] || '',
      phone: String(r['연락처'] || ''), email: r['이메일'] || '',
      industry: r['산업군'] || '', revenue: +(r['예상매출'] || 0),
      manager: r['영업담당'] || '', notes: r['비고'] || '',
      grade: (['A', 'B', 'C', 'D'].includes(String(r['등급']).toUpperCase()) ? String(r['등급']).toUpperCase() : 'B'),
      companySize: r['기업규모'] || '중소기업',
      stage: '초기접촉', prob: 10, created: today(), updated: today()
    })).filter(r => r.company);
    showPreview(); goImportStep(3);
  };
  reader.readAsArrayBuffer(file);
}

function showPreview() {
  document.getElementById('pvCount').textContent = uploadBuffer.length + '건';
  const thead = document.querySelector('#pvTable thead tr');
  const tbody = document.querySelector('#pvTable tbody');
  thead.innerHTML = '<th>기업명</th><th>담당자</th><th>직책</th><th>연락처</th><th>산업군</th><th>예상매출</th><th>영업담당</th><th>등급</th>';
  tbody.innerHTML = uploadBuffer.map(a =>
    `<tr><td>${a.company}</td><td>${a.contact}</td><td>${a.position}</td><td>${a.phone}</td><td>${a.industry}</td><td>${num(a.revenue)}</td><td>${a.manager}</td><td><span class="grade-badge ${a.grade}">${a.grade}</span></td></tr>`
  ).join('');
}

document.getElementById('btnConfirmImport')?.addEventListener('click', () => {
  if (!uploadBuffer.length) return;
  accounts = accounts.concat(uploadBuffer);
  persist(); toast(uploadBuffer.length + '개 고객이 등록되었습니다.');
  uploadBuffer = []; goImportStep(1); fileInput.value = '';
  document.getElementById('navAccCnt').textContent = accounts.length;
});

document.getElementById('dlTemplate')?.addEventListener('click', () => {
  const data = [{ 기업명: '', 담당자명: '', 직책: '', 연락처: '', 이메일: '', 산업군: '', 예상매출: '', 영업담당: '', '등급(A/B/C/D)': '', 비고: '' }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '타겟리스트');
  XLSX.writeFile(wb, '고객_타겟리스트_양식.xlsx');
});

// Exports
function exportToExcel(data, fileName) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, fileName);
  toast(fileName + ' 다운로드 완료');
}

document.getElementById('expAccounts')?.addEventListener('click', () => {
  exportToExcel(accounts.map(a => ({
    등급: a.grade, 기업명: a.company, 담당자명: a.contact, 직책: a.position,
    연락처: a.phone, 이메일: a.email, 산업군: a.industry, 기업규모: a.companySize,
    영업단계: a.stage, 수주확률: a.prob, 예상매출: a.revenue,
    영업담당: a.manager, 비고: a.notes, 등록일: a.created
  })), '고객_프로파일.xlsx');
});

document.getElementById('expActivities')?.addEventListener('click', () => {
  exportToExcel(activities.map(a => {
    const acc = accounts.find(c => c.id === a.custId);
    return { 일자: a.date, 고객명: acc ? acc.company : '', 유형: a.type, 내용: a.content, 결과: a.result, 후속조치: a.next, 담당자: a.manager };
  }), '영업활동_내역.xlsx');
});

document.getElementById('expSales')?.addEventListener('click', () => {
  exportToExcel(accounts.map(a => ({
    등급: a.grade, 고객명: a.company, 산업군: a.industry, 영업단계: a.stage,
    수주확률: a.prob, 예상매출: a.revenue,
    가중매출: Math.round((a.revenue || 0) * (a.prob || 0) / 100), 영업담당: a.manager
  })), '매출_리포트.xlsx');
});

document.getElementById('expAll')?.addEventListener('click', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accounts.map(a => ({
    등급: a.grade, 기업명: a.company, 담당자명: a.contact, 직책: a.position,
    연락처: a.phone, 이메일: a.email, 산업군: a.industry, 영업단계: a.stage,
    수주확률: a.prob, 예상매출: a.revenue, 영업담당: a.manager, 비고: a.notes
  }))), '고객프로파일');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(activities.map(a => {
    const acc = accounts.find(c => c.id === a.custId);
    return { 일자: a.date, 고객명: acc ? acc.company : '', 유형: a.type, 내용: a.content, 결과: a.result, 후속조치: a.next, 담당자: a.manager };
  })), '영업활동');
  XLSX.writeFile(wb, '전체데이터.xlsx');
  toast('전체 데이터 다운로드 완료');
});

// Global search
document.getElementById('globalSearch')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  if (!q) return;
  navigateTo('profiles');
  document.getElementById('accSearch').value = q;
  renderProfiles();
});

// ── Init ──
renderDashboard();
