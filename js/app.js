/* ================================================================
   KAM System — Application Logic
   ================================================================ */

// ── Data Store (localStorage) ──
let accounts = JSON.parse(localStorage.getItem('kam_accounts') || '[]');
let activities = JSON.parse(localStorage.getItem('kam_activities') || '[]');
let uploadBuffer = [];
const persist = () => {
  localStorage.setItem('kam_accounts', JSON.stringify(accounts));
  localStorage.setItem('kam_activities', JSON.stringify(activities));
};
const uid = () => '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const won = n => '₩' + Number(n || 0).toLocaleString('ko-KR');
const num = n => Number(n || 0).toLocaleString('ko-KR');

// ── Toast ──
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Modal Helpers ──
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
window.closeModal = closeModal;

function closeDrawer() { document.getElementById('drawer').classList.remove('show'); }
window.closeDrawer = closeDrawer;

// ── Navigation ──
const pageTitles = {
  dashboard: '대시보드', accounts: '거래처 관리', sales: '매출 관리',
  activities: '활동 내역', pipeline: '파이프라인',
  import: '데이터 가져오기', export: '데이터 내보내기'
};

document.getElementById('sideNav').addEventListener('click', e => {
  const item = e.target.closest('.nav-item');
  if (!item) return;
  const page = item.dataset.page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  item.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('pg-' + page).classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[page] || '';
  refreshPage(page);
});

function refreshPage(page) {
  if (page === 'dashboard') renderDashboard();
  if (page === 'accounts') renderAccounts();
  if (page === 'sales') renderSales();
  if (page === 'activities') renderActivities();
  if (page === 'pipeline') renderPipeline();
}

// Quick-link buttons
document.getElementById('btnBulkUpload')?.addEventListener('click', () => {
  document.querySelector('[data-page="import"]').click();
});

// ── Charts Store ──
const charts = {};
function makeChart(id, type, labels, datasets, opts = {}) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: opts.legend !== false, position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
      },
      scales: type === 'doughnut' || type === 'pie' ? {} : {
        y: { beginAtZero: true, ticks: { stepSize: opts.stepSize || undefined }, grid: { color: '#F2F3F5' } },
        x: { grid: { display: false } }
      },
      ...opts.extra
    }
  });
}

// ── Dashboard ──
function renderDashboard() {
  document.getElementById('dashDate').textContent =
    new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const total = accounts.length;
  const won_cnt = accounts.filter(a => a.stage === '수주').length;
  const lost = accounts.filter(a => a.stage === '실주').length;
  const open = total - won_cnt - lost;
  const totalRev = accounts.reduce((s, a) => s + (a.revenue || 0), 0);

  document.getElementById('dkTotal').textContent = total;
  document.getElementById('dkOpen').textContent = open;
  document.getElementById('dkWon').textContent = won_cnt;
  document.getElementById('dkLost').textContent = lost;
  document.getElementById('dkRevenue').textContent = won(totalRev);
  document.getElementById('navAccCnt').textContent = total;

  // Pipeline chart
  const stages = ['초기접촉', '니즈파악', '제안', '협상', '수주', '실주'];
  const stageCnt = stages.map(s => accounts.filter(a => a.stage === s).length);
  const stageColors = ['#1976D2', '#F57F17', '#7B1FA2', '#E65100', '#2E7D32', '#C62828'];
  makeChart('chPipe', 'bar', stages, [{
    label: '거래처 수', data: stageCnt, backgroundColor: stageColors, borderRadius: 6, barPercentage: 0.6
  }], { legend: false });

  // Monthly revenue
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i);
    months.push(d.toLocaleDateString('ko-KR', { month: 'short' }));
  }
  const monthlyAct = months.map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i);
    return activities.filter(a => {
      const ad = new Date(a.date);
      return ad.getMonth() === d.getMonth() && ad.getFullYear() === d.getFullYear();
    }).length;
  });
  makeChart('chRevenue', 'line', months, [{
    label: '활동 건수', data: monthlyAct,
    borderColor: '#A50034', backgroundColor: 'rgba(165,0,52,.08)',
    fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#A50034', borderWidth: 2
  }], { legend: false });

  // Industry
  const industries = [...new Set(accounts.map(a => a.industry || '미분류'))];
  const indCnt = industries.map(ind => accounts.filter(a => (a.industry || '미분류') === ind).length);
  const indColors = ['#A50034', '#1976D2', '#F57F17', '#7B1FA2', '#E65100', '#2E7D32', '#C62828', '#00838F'];
  makeChart('chIndustry', 'doughnut', industries, [{
    data: indCnt, backgroundColor: indColors.slice(0, industries.length)
  }]);

  // Owner
  const owners = [...new Set(accounts.map(a => a.manager || '미지정'))];
  const ownCnt = owners.map(o => accounts.filter(a => (a.manager || '미지정') === o).length);
  makeChart('chOwner', 'bar', owners, [{
    label: '거래처 수', data: ownCnt, backgroundColor: '#A50034', borderRadius: 6, barPercentage: 0.5
  }], { legend: false });

  // Activity stream
  const stream = document.getElementById('dashStream');
  const recent = activities.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (!recent.length) {
    stream.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>등록된 영업활동이 없습니다.</p></div>';
    return;
  }
  const typeColors = { 미팅: '#1976D2', 전화: '#2E7D32', 이메일: '#F57F17', 제안서: '#7B1FA2', 계약: '#A50034', 기타: '#767676' };
  stream.innerHTML = recent.map(a => {
    const acc = accounts.find(c => c.id === a.custId);
    return `<div class="timeline-item">
      <div class="tl-dot" style="background:${typeColors[a.type] || '#767676'}"></div>
      <div class="tl-body"><strong>${acc ? acc.company : '(삭제됨)'}</strong> — <span class="type-badge ${a.type}">${a.type}</span> ${a.content.slice(0, 80)}
      <div class="tl-date">${a.date} · ${a.manager || ''}</div></div>
    </div>`;
  }).join('');
}

// ── Accounts ──
function renderAccounts() {
  const q = (document.getElementById('accSearch')?.value || '').toLowerCase();
  const fs = document.getElementById('fltStage')?.value || '';
  const fi = document.getElementById('fltIndustry')?.value || '';
  const fo = document.getElementById('fltOwner')?.value || '';

  const filtered = accounts.filter(a => {
    const matchQ = !q || a.company.toLowerCase().includes(q) || (a.contact || '').toLowerCase().includes(q) || (a.manager || '').toLowerCase().includes(q);
    const matchS = !fs || a.stage === fs;
    const matchI = !fi || a.industry === fi;
    const matchO = !fo || a.manager === fo;
    return matchQ && matchS && matchI && matchO;
  });

  document.getElementById('accCount').textContent = filtered.length + '건';

  // Populate filter options
  populateFilterOptions();

  const tbody = document.getElementById('accTbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><i class="fas fa-building"></i><p>거래처가 없습니다. 새 거래처를 등록하세요.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const lastAct = activities.filter(x => x.custId === a.id).sort((x, y) => y.date.localeCompare(x.date))[0];
    const pColor = a.prob > 60 ? '#2E7D32' : a.prob > 30 ? '#F57F17' : '#C62828';
    return `<tr>
      <td><a href="#" class="acc-link" data-id="${a.id}" style="color:var(--lg-red);font-weight:600">${a.company}</a></td>
      <td>${a.contact || '-'}</td><td>${a.phone || '-'}</td><td>${a.industry || '-'}</td>
      <td><span class="badge ${a.stage}">${a.stage}</span></td>
      <td><div class="prob-bar"><div class="pb-track"><div class="pb-fill" style="width:${a.prob}%;background:${pColor}"></div></div><span class="pb-text">${a.prob}%</span></div></td>
      <td style="font-weight:500">${num(a.revenue)}</td>
      <td>${a.manager || '-'}</td>
      <td style="font-size:.82rem;color:var(--lg-gray-500)">${lastAct ? lastAct.date : '-'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-ghost btn-sm" onclick="editAccount('${a.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteAccount('${a.id}')" style="color:#C62828"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Kanban
  renderKanbanView(filtered, 'accKanban');
}

function populateFilterOptions() {
  const industries = [...new Set(accounts.map(a => a.industry).filter(Boolean))];
  const owners = [...new Set(accounts.map(a => a.manager).filter(Boolean))];
  const indSel = document.getElementById('fltIndustry');
  const ownSel = document.getElementById('fltOwner');
  if (indSel) {
    const val = indSel.value;
    indSel.innerHTML = '<option value="">전체 산업군</option>' + industries.map(i => `<option>${i}</option>`).join('');
    indSel.value = val;
  }
  if (ownSel) {
    const val = ownSel.value;
    ownSel.innerHTML = '<option value="">전체 담당자</option>' + owners.map(o => `<option>${o}</option>`).join('');
    ownSel.value = val;
  }
}

function renderKanbanView(list, containerId) {
  const stages = ['초기접촉', '니즈파악', '제안', '협상', '수주', '실주'];
  const headClass = { 초기접촉: 's1', 니즈파악: 's2', 제안: 's3', 협상: 's4', 수주: 's5', 실주: 's6' };
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = stages.map(s => {
    const items = list.filter(a => a.stage === s);
    return `<div class="kanban-col">
      <div class="kanban-col-head ${headClass[s]}">${s} <span class="cnt">${items.length}</span></div>
      ${items.length ? items.map(a => `
        <div class="kanban-card" onclick="openDetail('${a.id}')">
          <div class="kc-name">${a.company}</div>
          <div class="kc-info">${a.manager || '-'} · ${a.industry || '-'}</div>
          <div class="kc-revenue">${won(a.revenue)}</div>
        </div>`).join('') : '<div style="text-align:center;padding:20px;color:var(--lg-gray-300);font-size:.82rem">없음</div>'}
    </div>`;
  }).join('');
}

// Account CRUD
document.getElementById('btnNewAcc')?.addEventListener('click', () => {
  document.getElementById('accModalTitle').textContent = '새 거래처';
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
    created: id ? (accounts.find(a => a.id === id) || {}).created || today() : today(),
    updated: today()
  };

  if (id) {
    const idx = accounts.findIndex(a => a.id === id);
    accounts[idx] = obj;
    toast('거래처가 수정되었습니다.');
  } else {
    accounts.push(obj);
    toast('새 거래처가 등록되었습니다.');
  }
  persist();
  closeModal('accModal');
  renderAccounts();
  renderDashboard();
});

window.editAccount = function (id) {
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  document.getElementById('accModalTitle').textContent = '거래처 수정';
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
  openModal('accModal');
};

window.deleteAccount = function (id) {
  if (!confirm('이 거래처를 삭제하시겠습니까?\n관련 활동도 함께 삭제됩니다.')) return;
  accounts = accounts.filter(a => a.id !== id);
  activities = activities.filter(a => a.custId !== id);
  persist();
  renderAccounts();
  toast('거래처가 삭제되었습니다.');
};

// Detail Drawer
window.openDetail = function (id) {
  const a = accounts.find(x => x.id === id);
  if (!a) return;
  document.getElementById('drawerTitle').textContent = a.company;
  const acts = activities.filter(x => x.custId === id).sort((x, y) => y.date.localeCompare(x.date));
  const typeColors = { 미팅: '#1976D2', 전화: '#2E7D32', 이메일: '#F57F17', 제안서: '#7B1FA2', 계약: '#A50034', 기타: '#767676' };

  document.getElementById('drawerBody').innerHTML = `
    <div class="detail-section">
      <h4>기본 정보</h4>
      <div class="detail-row"><span class="dl">거래처명</span><span class="dv">${a.company}</span></div>
      <div class="detail-row"><span class="dl">담당자</span><span class="dv">${a.contact || '-'}</span></div>
      <div class="detail-row"><span class="dl">연락처</span><span class="dv">${a.phone || '-'}</span></div>
      <div class="detail-row"><span class="dl">이메일</span><span class="dv">${a.email || '-'}</span></div>
      <div class="detail-row"><span class="dl">산업군</span><span class="dv">${a.industry || '-'}</span></div>
      <div class="detail-row"><span class="dl">등급</span><span class="dv">${a.grade || '-'}</span></div>
    </div>
    <div class="detail-section">
      <h4>영업 정보</h4>
      <div class="detail-row"><span class="dl">영업단계</span><span class="dv"><span class="badge ${a.stage}">${a.stage}</span></span></div>
      <div class="detail-row"><span class="dl">수주확률</span><span class="dv">${a.prob}%</span></div>
      <div class="detail-row"><span class="dl">예상매출</span><span class="dv" style="color:var(--lg-red);font-weight:600">${won(a.revenue)}</span></div>
      <div class="detail-row"><span class="dl">가중매출</span><span class="dv">${won(Math.round(a.revenue * a.prob / 100))}</span></div>
      <div class="detail-row"><span class="dl">영업담당</span><span class="dv">${a.manager || '-'}</span></div>
      <div class="detail-row"><span class="dl">등록일</span><span class="dv">${a.created || '-'}</span></div>
    </div>
    ${a.notes ? `<div class="detail-section"><h4>비고</h4><p style="font-size:.88rem;color:var(--lg-gray-700)">${a.notes}</p></div>` : ''}
    <div class="detail-section">
      <h4>활동 이력 (${acts.length}건)</h4>
      ${acts.length ? acts.map(ac => `<div class="timeline-item">
        <div class="tl-dot" style="background:${typeColors[ac.type] || '#767676'}"></div>
        <div class="tl-body"><span class="type-badge ${ac.type}">${ac.type}</span> ${ac.content}
        ${ac.result ? '<br><small style="color:var(--lg-gray-500)">결과: ' + ac.result + '</small>' : ''}
        <div class="tl-date">${ac.date} · ${ac.manager || ''}</div></div>
      </div>`).join('') : '<p style="color:var(--lg-gray-300);font-size:.85rem">활동 내역이 없습니다.</p>'}
    </div>
    <div class="btn-group" style="margin-top:16px">
      <button class="btn btn-primary btn-sm" onclick="closeDrawer();editAccount('${a.id}')"><i class="fas fa-pen"></i>수정</button>
      <button class="btn btn-danger btn-sm" onclick="closeDrawer();deleteAccount('${a.id}')"><i class="fas fa-trash"></i>삭제</button>
    </div>
  `;
  document.getElementById('drawer').classList.add('show');
};

// Account link click
document.addEventListener('click', e => {
  const link = e.target.closest('.acc-link');
  if (link) { e.preventDefault(); openDetail(link.dataset.id); }
});

// View Toggle
document.querySelectorAll('.view-toggle').forEach(toggle => {
  toggle.addEventListener('click', e => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    toggle.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.getElementById('accTableView').style.display = view === 'table' ? '' : 'none';
    document.getElementById('accKanban').style.display = view === 'kanban' ? '' : 'none';
  });
});

// Filters
['accSearch', 'fltStage', 'fltIndustry', 'fltOwner'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', renderAccounts);
  document.getElementById(id)?.addEventListener('change', renderAccounts);
});

// ── Sales ──
function renderSales() {
  const totalRev = accounts.reduce((s, a) => s + (a.revenue || 0), 0);
  const wonRev = accounts.filter(a => a.stage === '수주').reduce((s, a) => s + (a.revenue || 0), 0);
  const pendingRev = accounts.filter(a => !['수주', '실주'].includes(a.stage)).reduce((s, a) => s + (a.revenue || 0), 0);
  const total = accounts.length;
  const wonCnt = accounts.filter(a => a.stage === '수주').length;
  const rate = total > 0 ? Math.round(wonCnt / total * 100) : 0;

  document.getElementById('skTotal').textContent = won(totalRev);
  document.getElementById('skWon').textContent = won(wonRev);
  document.getElementById('skPending').textContent = won(pendingRev);
  document.getElementById('skRate').textContent = rate + '%';

  // Stage revenue chart
  const stages = ['초기접촉', '니즈파악', '제안', '협상', '수주', '실주'];
  const stageRev = stages.map(s => accounts.filter(a => a.stage === s).reduce((sum, a) => sum + (a.revenue || 0), 0));
  const stageColors = ['#1976D2', '#F57F17', '#7B1FA2', '#E65100', '#2E7D32', '#C62828'];
  makeChart('chSalesStage', 'bar', stages, [{
    label: '매출', data: stageRev, backgroundColor: stageColors, borderRadius: 6, barPercentage: 0.6
  }], { legend: false });

  // Owner revenue
  const owners = [...new Set(accounts.map(a => a.manager || '미지정'))];
  const ownRev = owners.map(o => accounts.filter(a => (a.manager || '미지정') === o).reduce((s, a) => s + (a.revenue || 0), 0));
  makeChart('chSalesOwner', 'bar', owners, [{
    label: '매출', data: ownRev, backgroundColor: '#A50034', borderRadius: 6, barPercentage: 0.5
  }], { legend: false });

  // Sales table
  const tbody = document.getElementById('salesTbody');
  const sorted = [...accounts].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  tbody.innerHTML = sorted.map(a => {
    const weighted = Math.round((a.revenue || 0) * (a.prob || 0) / 100);
    return `<tr>
      <td><strong>${a.company}</strong></td><td>${a.industry || '-'}</td>
      <td><span class="badge ${a.stage}">${a.stage}</span></td>
      <td>${a.prob}%</td>
      <td style="font-weight:600">${num(a.revenue)}</td>
      <td style="color:var(--lg-red);font-weight:600">${num(weighted)}</td>
      <td>${a.manager || '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7"><div class="empty-state"><p>데이터가 없습니다.</p></div></td></tr>';
}

// ── Activities ──
function renderActivities() {
  const q = (document.getElementById('actSearch')?.value || '').toLowerCase();
  const tf = document.getElementById('fltActType')?.value || '';

  const filtered = activities.filter(a => {
    const acc = accounts.find(c => c.id === a.custId);
    const matchQ = !q || (acc && acc.company.toLowerCase().includes(q)) || a.content.toLowerCase().includes(q);
    const matchT = !tf || a.type === tf;
    return matchQ && matchT;
  }).sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById('actCount').textContent = filtered.length + '건';

  const tbody = document.getElementById('actTbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-clipboard-list"></i><p>활동 내역이 없습니다.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(a => {
    const acc = accounts.find(c => c.id === a.custId);
    return `<tr>
      <td>${a.date}</td>
      <td><strong>${acc ? acc.company : '(삭제됨)'}</strong></td>
      <td><span class="type-badge ${a.type}">${a.type}</span></td>
      <td>${a.content.length > 50 ? a.content.slice(0, 50) + '...' : a.content}</td>
      <td>${a.result || '-'}</td><td>${a.next || '-'}</td><td>${a.manager || '-'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-ghost btn-sm" onclick="editActivity('${a.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-ghost btn-sm" onclick="deleteActivity('${a.id}')" style="color:#C62828"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

['actSearch', 'fltActType'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', renderActivities);
  document.getElementById(id)?.addEventListener('change', renderActivities);
});

// Activity CRUD
function fillCustSelect() {
  const sel = document.getElementById('bf1');
  sel.innerHTML = '<option value="">선택하세요</option>' + accounts.map(a => `<option value="${a.id}">${a.company}</option>`).join('');
}

document.getElementById('btnNewAct')?.addEventListener('click', () => {
  document.getElementById('actModalTitle').textContent = '활동 기록';
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
    id: id || uid(),
    custId: document.getElementById('bf1').value,
    date: document.getElementById('bf2').value,
    type: document.getElementById('bf3').value,
    manager: document.getElementById('bf4').value,
    content: document.getElementById('bf5').value,
    result: document.getElementById('bf6').value,
    next: document.getElementById('bf7').value
  };

  if (id) {
    const idx = activities.findIndex(a => a.id === id);
    activities[idx] = obj;
    toast('활동이 수정되었습니다.');
  } else {
    activities.push(obj);
    toast('활동이 등록되었습니다.');
  }
  persist();
  closeModal('actModal');
  renderActivities();
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
  persist();
  renderActivities();
  toast('활동이 삭제되었습니다.');
};

// ── Pipeline (Kanban) ──
function renderPipeline() {
  renderKanbanView(accounts, 'pipeKanban');
}

// ── Import (Excel Upload) ──
window.goImportStep = function (step) {
  [1, 2, 3].forEach(i => {
    document.getElementById('is' + i).style.display = i === step ? '' : 'none';
    const si = document.getElementById('st' + i);
    si.classList.remove('active', 'done');
    if (i < step) si.classList.add('done');
    if (i === step) si.classList.add('active');
  });
};

// Drop zone
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
      id: uid(),
      company: r['기업명'] || r['거래처명'] || '',
      contact: r['담당자명'] || r['담당자'] || '',
      phone: String(r['연락처'] || ''),
      email: r['이메일'] || '',
      industry: r['산업군'] || '',
      revenue: +(r['예상매출'] || 0),
      manager: r['영업담당'] || '',
      notes: r['비고'] || '',
      grade: r['등급'] || 'B',
      stage: '초기접촉',
      prob: 10,
      created: today(),
      updated: today()
    })).filter(r => r.company);

    showPreview();
    goImportStep(3);
  };
  reader.readAsArrayBuffer(file);
}

function showPreview() {
  document.getElementById('pvCount').textContent = uploadBuffer.length + '건 감지';
  const thead = document.querySelector('#pvTable thead tr');
  const tbody = document.querySelector('#pvTable tbody');
  thead.innerHTML = '<th>기업명</th><th>담당자</th><th>연락처</th><th>이메일</th><th>산업군</th><th>예상매출</th><th>영업담당</th><th>비고</th>';
  tbody.innerHTML = uploadBuffer.map(a =>
    `<tr><td>${a.company}</td><td>${a.contact}</td><td>${a.phone}</td><td>${a.email}</td><td>${a.industry}</td><td>${num(a.revenue)}</td><td>${a.manager}</td><td>${a.notes}</td></tr>`
  ).join('');
}

document.getElementById('btnConfirmImport')?.addEventListener('click', () => {
  if (!uploadBuffer.length) return;
  accounts = accounts.concat(uploadBuffer);
  persist();
  toast(uploadBuffer.length + '개 거래처가 등록되었습니다.');
  uploadBuffer = [];
  goImportStep(1);
  fileInput.value = '';
  document.getElementById('navAccCnt').textContent = accounts.length;
});

// Template download
document.getElementById('dlTemplate')?.addEventListener('click', () => {
  const data = [{ 기업명: '', 담당자명: '', 연락처: '', 이메일: '', 산업군: '', 예상매출: '', 영업담당: '', 비고: '' }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '타겟리스트');
  XLSX.writeFile(wb, '타겟리스트_양식.xlsx');
});

// ── Export ──
function exportToExcel(data, headers, fileName) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, fileName);
  toast(fileName + ' 다운로드 완료');
}

document.getElementById('expAccounts')?.addEventListener('click', () => {
  const data = accounts.map(a => ({
    거래처명: a.company, 담당자명: a.contact, 연락처: a.phone, 이메일: a.email,
    산업군: a.industry, 영업단계: a.stage, 수주확률: a.prob, 예상매출: a.revenue,
    영업담당: a.manager, 등급: a.grade, 비고: a.notes, 등록일: a.created
  }));
  exportToExcel(data, null, '거래처목록.xlsx');
});

document.getElementById('expActivities')?.addEventListener('click', () => {
  const data = activities.map(a => {
    const acc = accounts.find(c => c.id === a.custId);
    return { 일자: a.date, 거래처: acc ? acc.company : '', 유형: a.type, 내용: a.content, 결과: a.result, 후속조치: a.next, 담당자: a.manager };
  });
  exportToExcel(data, null, '활동내역.xlsx');
});

document.getElementById('expSales')?.addEventListener('click', () => {
  const data = accounts.map(a => ({
    거래처명: a.company, 산업군: a.industry, 영업단계: a.stage, 수주확률: a.prob,
    예상매출: a.revenue, 가중매출: Math.round((a.revenue || 0) * (a.prob || 0) / 100), 영업담당: a.manager
  }));
  exportToExcel(data, null, '매출리포트.xlsx');
});

document.getElementById('expAll')?.addEventListener('click', () => {
  const wb = XLSX.utils.book_new();
  const accData = accounts.map(a => ({
    거래처명: a.company, 담당자명: a.contact, 연락처: a.phone, 이메일: a.email,
    산업군: a.industry, 영업단계: a.stage, 수주확률: a.prob, 예상매출: a.revenue,
    영업담당: a.manager, 등급: a.grade, 비고: a.notes
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accData), '거래처');
  const actData = activities.map(a => {
    const acc = accounts.find(c => c.id === a.custId);
    return { 일자: a.date, 거래처: acc ? acc.company : '', 유형: a.type, 내용: a.content, 결과: a.result, 후속조치: a.next, 담당자: a.manager };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actData), '활동');
  XLSX.writeFile(wb, '전체데이터.xlsx');
  toast('전체 데이터 다운로드 완료');
});

document.getElementById('btnExportSales')?.addEventListener('click', () => {
  document.getElementById('expSales')?.click();
});

// ── Global Search ──
document.getElementById('globalSearch')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  if (!q) return;
  // Navigate to accounts page and search
  document.querySelector('[data-page="accounts"]').click();
  document.getElementById('accSearch').value = q;
  renderAccounts();
});

// ── Opportunity page (alias for btnNewOpp) ──
document.getElementById('btnNewOpp')?.addEventListener('click', () => {
  document.getElementById('btnNewAcc')?.click();
});

// ── Init ──
renderDashboard();
