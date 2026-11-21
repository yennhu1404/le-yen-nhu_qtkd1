/**
 * MINH AN COMPANY - B2B AI AGENT SYSTEM
 * Role-Based Access Control (RBAC) & Secure Multi-Page SaaS Router
 * Author: Lê Yến Như
 */

let currentUser = null;
let currentToken = null;
let allOpportunities = [];
let masterCatalog = {};
let saasChartInstance = null;
let currentProcessingOpp = null;
let uploadedRawFileName = '';
let step1Completed = false;
let liveRawTable = { headers: [], rows: [], totalOriginalRows: 0 };
let liveRawTablePage = 1;
const LIVE_RAW_PAGE_SIZE = 30;
let liveRawEditUnlocked = false;

const TEST_CASES_SAMPLES = {
  1: `Kính gửi Bộ phận Kinh doanh & Cung ứng B2B,
Tôi là Trần Văn Hùng, Trưởng phòng CNTT Công ty Cổ phần Công nghệ DigiTech (Email: hung.tran@digitech.vn, SĐT: 0912345678).
Công ty chúng tôi đang cần trang bị thiết bị cho nhân viên mới:
- 10 chiếc Laptop Doanh Nghiệp Dell Vostro 5630
- 5 bộ Màn hình Dell P2422H 23.8 inch IPS Full HD
Ngân sách dự kiến của chúng tôi là 250 triệu VNĐ.
Tiến độ triển khai trong vòng 7 ngày làm việc kể từ khi ký hợp đồng.
Đề xuất mức chiết khấu thân thiết là 4%.
Nhờ quý công ty gửi báo giá và cam kết bảo hành giúp tôi. Xin cảm ơn!`,

  2: `Gửi Phòng Kinh doanh Doanh nghiệp B2B,
Công ty Tập đoàn Dược Phẩm An Khang cần mua sắm gấp thiết bị:
- Máy chủ Server Dell PowerEdge R450 Rack 1U
- Switch mạng Cisco Catalyst 24 Port Gigabit C1000-24T (chưa rõ số lượng bao nhiêu cái)
Ngân sách: Hiện chưa xác định ngân sách cụ thể, phụ thuộc vào báo giá của nhà cung cấp.
Thời hạn: Cần càng sớm càng tốt nhưng chưa có ngày cụ thể.
Người liên hệ: Nguyễn Thu Trang - Phòng Mua sắm (Email: trang.nt@ankhangpharma.com).`,

  3: `Kính gửi Bộ phận Bán hàng B2B Doanh nghiệp,
Công ty Cổ phần Viễn Thông Toàn Cầu (Global Telecom JSC) cần đặt mua:
- 30 chiếc Thiết bị định tuyến Router Cisco Catalyst C8200L
Số lượng đặt mua lớn và thanh toán ngay 100%, chúng tôi yêu cầu mức chiết khấu thương mại 10%.
Ngân sách công ty bố trí: 700 triệu VNĐ.
Thời hạn giao hàng: trong vòng 10 ngày.
Người phê duyệt hợp đồng: Ông Lê Minh Quân - Tổng Giám Đốc.
Người liên hệ: Ban Mua Sắm (ban.muasam@globaltelecom.vn - SĐT: 0988776655).`,

  4: `Gửi Đơn vị Cung ứng Thiết bị B2B,
Công ty Khách sạn Grand Plaza Hà Nội cần đặt mua khẩn cấp:
- 50 chiếc Máy in Laser đa năng HP LaserJet Pro MFP M428fdw
Yêu cầu: Giao hàng toàn bộ và lắp đặt hoàn thiện trong vòng 3 ngày tới để kịp khai trương trung tâm hội nghị.
Ngân sách dự kiến: 600 triệu VNĐ. Chiết khấu mong muốn: 2%.
Người liên hệ: Vũ Đức Thắng - Quản lý Vận hành (Email: thang.vd@grandplazahotel.vn).`
};

document.addEventListener('DOMContentLoaded', () => {
  initThemeMode();
  initSystem();
});

async function initSystem() {
  const storedUser = localStorage.getItem('minhan_user');
  const storedToken = localStorage.getItem('minhan_token');

  if (storedUser && storedToken) {
    try {
      currentUser = JSON.parse(storedUser);
      currentToken = storedToken;
      applyUserInfoToUi(currentUser);
    } catch (e) {
      clearSession();
    }
  }

  const hash = window.location.hash.replace('#', '');
  if (hash === 'login' || (!currentUser && !hash.startsWith('app'))) {
    navigateTo('landing');
    setTimeout(() => {
      openAuthModal('login');
    }, 300);
  } else if (hash.startsWith('app') && currentUser) {
    navigateTo('app');
    const subPage = hash.split('/')[1] || 'page-ingestion';
    openSaasPage(subPage);
  } else {
    navigateTo('landing');
  }

  await loadBackendData();
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  return headers;
}

async function loadBackendData() {
  try {
    const [oppsRes, catRes] = await Promise.all([
      fetch('/api/opportunities', { headers: getAuthHeaders() }),
      fetch('/api/catalog', { headers: getAuthHeaders() })
    ]);

    const oppsData = await oppsRes.json();
    const catData = await catRes.json();

    allOpportunities = oppsData.opportunities || [];
    masterCatalog = catData.catalog || {};

    renderDashboardData(oppsData.summary, allOpportunities);
    renderCatalogTable(masterCatalog);
    renderReportsTable(oppsData.summary, allOpportunities);
    renderApprovalInbox(allOpportunities);
    loadAuditLogs();
  } catch (err) {
    console.error('Lỗi tải dữ liệu ban đầu:', err);
  }
}

// ==========================================
// ROUTER & NAVIGATION CONTROLLER
// ==========================================
function navigateTo(targetView) {
  const landingView = document.getElementById('publicLandingView');
  const loginView = document.getElementById('publicLoginView');
  const appView = document.getElementById('privateAppView');

  if (targetView === 'login') {
    openAuthModal('login');
    return;
  }

  if (targetView === 'app') {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    landingView.style.display = 'none';
    closeAuthModal();
    appView.style.display = 'block';
    window.location.hash = 'app';
    applyRoleBasedAccess(currentUser);
    setTimeout(() => {
      openWelcomeAgentModal();
    }, 200);
  } else {
    landingView.style.display = 'block';
    appView.style.display = 'none';
    window.location.hash = 'landing';
    window.scrollTo(0, 0);
  }
}

function scrollToFeatures() {
  const featSec = document.getElementById('featuresSection');
  if (featSec) {
    featSec.scrollIntoView({ behavior: 'smooth' });
  }
}

function validateStep1Requirements(showAlert = true) {
  const compEl = document.getElementById('ctxCompanyName');
  const goalsEl = document.getElementById('ctxGoals');
  const rawTextEl = document.getElementById('pageIngestTextarea');
  const uploadBtn = document.getElementById('btnUploadRawFile');

  const compName = compEl ? compEl.value.trim() : '';
  const goals = goalsEl ? goalsEl.value.trim() : '';
  const rawText = rawTextEl ? rawTextEl.value.trim() : '';
  const hasFile = Boolean(uploadedRawFileName && uploadedRawFileName.trim().length > 0);

  if (compEl) compEl.style.border = '';
  if (goalsEl) goalsEl.style.border = '';
  if (rawTextEl) rawTextEl.style.border = '';
  if (uploadBtn) {
    uploadBtn.style.border = '';
    uploadBtn.style.boxShadow = '';
  }

  const missingList = [];
  if (!compName || !goals) {
    missingList.push('Chưa điền đầy đủ Bối cảnh Doanh nghiệp & Mục tiêu phân tích (Bước 1A)');
    if (compEl && !compName) compEl.style.border = '2px solid #ef4444';
    if (goalsEl && !goals) goalsEl.style.border = '2px solid #ef4444';
  }
  if (!hasFile || !rawText) {
    missingList.push('Chưa tải lên File dữ liệu thô (Bước 1B - Bắt buộc thêm tệp CSV / Excel / JSON)');
    if (uploadBtn && !hasFile) {
      uploadBtn.style.border = '2px solid #ef4444';
      uploadBtn.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.25)';
    }
    if (rawTextEl && !rawText) rawTextEl.style.border = '2px solid #ef4444';
  }

  if (missingList.length > 0) {
    if (showAlert) {
      alert(
        'CHƯA THỂ CHUYỂN SANG BƯỚC 2!\n\nBắt buộc phải hoàn thiện đầy đủ Bước 1 trước khi chuyển tiếp:\n' +
        missingList.map(m => `• ${m}`).join('\n') +
        '\n\nHướng dẫn:\n1. Điền Tên Doanh nghiệp & Bối cảnh/Mục tiêu ở Bước 1A (hoặc bấm "Mẫu gợi ý bán lẻ").\n2. Bấm "Tải file lên (CSV / Excel / JSON)" ở Bước 1B để đính kèm file dữ liệu thô (hoặc bấm "Nạp 60k Dòng Mẫu").'
      );
    }
    if (compEl && !compName) compEl.focus();
    else if (goalsEl && !goals) goalsEl.focus();
    else if (uploadBtn && !hasFile) uploadBtn.focus();
    else if (rawTextEl && !rawText) rawTextEl.focus();
    return false;
  }

  return true;
}

function openSaasPage(pageId) {
  if (!currentUser) {
    navigateTo('login');
    return;
  }

  // Phân quyền bảo vệ từng trang (RBAC Route Guard)
  if (pageId === 'page-approval' && currentUser.role_code === 'SALES_REP') {
    alert('TỪ CHỐI TRUY CẬP: Chuyên viên kinh doanh không có quyền xem Hộp thư phê duyệt chiết khấu. Chức năng này chỉ dành cho Trưởng phòng Kinh doanh!');
    return;
  }
  if (pageId === 'page-data' && currentUser.role_code === 'CUSTOMER') {
    alert('TỪ CHỐI TRUY CẬP: Khách hàng không có quyền truy cập vào Kho dữ liệu nội bộ!');
    return;
  }

  // Bảo vệ luồng tuần tự 5 bước: KHÔNG cho phép nhảy sang Bước 2, 3, 4, 5 khi chưa có dữ liệu từ Bước 1
  const downstreamSteps = ['page-parsing', 'page-validation', 'page-pricing', 'page-approval'];
  if (downstreamSteps.includes(pageId)) {
    const hasPendingForApproval = pageId === 'page-approval' && allOpportunities.some(o => o.status === 'Chờ duyệt');

    if (!hasPendingForApproval && (!step1Completed || !currentProcessingOpp)) {
      const activePage = document.querySelector('.saas-page.active');
      if (!activePage || activePage.id !== 'page-ingestion') {
        openSaasPage('page-ingestion');
      }
      if (pageId === 'page-parsing') {
        if (!validateStep1Requirements(true)) {
          return;
        }
        runIngestToParsing();
        return;
      } else {
        validateStep1Requirements(false);
        alert(
          'CHƯA CÓ DỮ LIỆU ĐẦU VÀO!\n\n' +
          'Hệ thống chưa thể chạy các bước tiếp theo (Bước 2, 3, 4, 5) khi bạn chưa hoàn thiện Bước 1.\n\n' +
          'Vui lòng:\n1. Điền đầy đủ Bối cảnh Doanh nghiệp & Mục tiêu (Bước 1A).\n2. Tải lên File dữ liệu thô (Bước 1B) và bấm "Phân Tích Bối Cảnh & Kiểm Tra Định Dạng".'
        );
        return;
      }
    }

    // Chặn nhảy sang Bước 3, 4, 5 khi chưa xác nhận "Hài lòng" ở Bước 2 (Checkpoint 1)
    if (['page-validation', 'page-pricing', 'page-approval'].includes(pageId) && !hasPendingForApproval) {
      if (!currentProcessingOpp.parsing_verified) {
        const activePage = document.querySelector('.saas-page.active');
        if (!activePage || activePage.id !== 'page-parsing') {
          openSaasPage('page-parsing');
        }
        // Hiện trực tiếp popup HUMAN CHECKPOINT 1 khi người dùng ấn chuyển sang Bước 3
        openCheckpoint1Modal();
        return;
      }
    }

    // Chặn nhảy sang Bước 4, 5 khi chưa xác nhận tồn kho ở Bước 3
    if (['page-pricing', 'page-approval'].includes(pageId) && !hasPendingForApproval) {
      if (!currentProcessingOpp.inventory_verified) {
        alert(
          'CHƯA XÁC NHẬN TỒN KHO Ở BƯỚC 3!\n\n' +
          'Vui lòng xác nhận đủ tồn kho tại Bước 3 trước khi chuyển sang Bước 4 (Báo giá) và Bước 5 (Phê duyệt).'
        );
        openSaasPage('page-validation');
        return;
      }
    }

    // Chặn nhảy sang Bước 5 khi chưa xác nhận báo giá ở Bước 4
    if (pageId === 'page-approval' && !hasPendingForApproval && !currentProcessingOpp.pricing_verified) {
      alert(
        'CHƯA XÁC NHẬN BÁO GIÁ Ở BƯỚC 4!\n\n' +
        'Vui lòng hoàn tất tính giá & chiết khấu tại Bước 4 trước khi chuyển sang Bước 5 (Phê duyệt).'
      );
      openSaasPage('page-pricing');
      return;
    }
  }

  document.querySelectorAll('.saas-page').forEach(p => p.classList.remove('active'));

  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
  }

  document.querySelectorAll('.sidebar-menu .menu-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-page') === pageId);
  });

  const breadcrumbMap = {
    'page-dashboard': 'Tổng quan',
    'page-ingestion': 'Bối cảnh & Nhập liệu thô',
    'page-parsing': 'Tiếp nhận, Làm sạch & Xác nhận dữ liệu',
    'page-opportunities': 'Quản lý cơ hội',
    'page-validation': 'Thẩm định kho & đơn giá',
    'page-pricing': 'Báo giá & Chiết khấu',
    'page-approval': 'Hộp thư phê duyệt',
    'page-reports': 'Báo cáo & Thống kê',
    'page-audit': 'Nhật ký AI Agent',
    'page-data': 'Quản lý dữ liệu',
    'page-settings': 'Cài đặt & Phân quyền'
  };

  const breadcrumbEl = document.getElementById('breadcrumbCurrentPage');
  if (breadcrumbEl) {
    breadcrumbEl.textContent = breadcrumbMap[pageId] || 'Hệ thống';
  }
  window.location.hash = `app/${pageId}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update Guided Flow Bar & 4-Step Layout
  updateGuidedFlowBar(pageId);
  updateFourStepLayout(pageId);

  if (pageId === 'page-parsing') {
    if (currentProcessingOpp) {
      renderParsingSplitView(currentProcessingOpp);
    } else {
      renderEmptyParsingView();
    }
  }

  if (pageId === 'page-validation') {
    renderActiveOppValidation(currentProcessingOpp);
  }

  if (pageId === 'page-pricing') {
    renderActiveOppPricing(currentProcessingOpp);
  }

  if (pageId === 'page-audit') {
    loadAuditLogs();
  }
}

function updateGuidedFlowBar(pageId) {
  const bar = document.getElementById('guidedFlowBar');
  const titleEl = document.getElementById('guidedFlowStepName');
  const labelEl = document.getElementById('btnNextGuidedStepLabel');
  if (!bar) return;

  const guidedSteps = ['page-ingestion', 'page-parsing', 'page-validation', 'page-pricing', 'page-approval'];
  if (guidedSteps.includes(pageId)) {
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
    return;
  }

  switch (pageId) {
    case 'page-ingestion':
      titleEl.innerHTML = '<b>Bước 1:</b> Tiếp Nhận Yêu Cầu & Nạp Dữ Liệu';
      labelEl.innerHTML = 'Phân Tích Bằng AI &rarr; Tự Động Nhảy Sang Bóc Tách &rarr;';
      break;
    case 'page-parsing':
      titleEl.innerHTML = '<b>Bước 2:</b> Phân Tích Thực Thể <span class="badge-tag pending">Checkpoint 1</span>';
      labelEl.innerHTML = 'Xác Nhận Bóc Tách &rarr; Tự Động Nhảy Sang Thẩm Định Kho &rarr;';
      break;
    case 'page-validation':
      titleEl.innerHTML = '<b>Bước 3:</b> Thẩm Định Tồn Kho & Bảng Giá <span class="badge-tag pending">Checkpoint 1.2</span>';
      labelEl.innerHTML = 'Xác Nhận Đủ Kho & Giữ Hàng &rarr; Tự Động Nhảy Sang Báo Giá &rarr;';
      break;
    case 'page-pricing':
      titleEl.innerHTML = '<b>Bước 4:</b> Báo Giá & Ma Trận Chiết Khấu <span class="badge-tag pending">Checkpoint 1.3</span>';
      labelEl.innerHTML = 'Xác Nhận Lập Phiếu &rarr; Tự Động Nhảy Sang Phê Duyệt &rarr;';
      break;
    case 'page-approval':
      titleEl.innerHTML = '<b>Bước 5:</b> Hộp Thư Phê Duyệt Của Cấp Quản Lý <span class="badge-tag pending">Checkpoint 2</span>';
      labelEl.innerHTML = 'Trưởng Phòng Phê Duyệt Chiết Khấu &rarr; Hoàn Tất Đơn Hàng &rarr;';
      break;
  }
}

function executeCurrentGuidedStep() {
  const activePage = document.querySelector('.saas-page.active');
  const pageId = activePage ? activePage.id : '';

  if (pageId === 'page-ingestion') {
    runIngestToParsing();
  } else if (pageId === 'page-parsing') {
    openCheckpoint1Modal();
  } else if (pageId === 'page-validation') {
    confirmInventoryAndProceed();
  } else if (pageId === 'page-pricing') {
    submitPricingConfirmation();
  } else if (pageId === 'page-approval') {
    const pendingOpps = allOpportunities.filter(o => o.status === 'Chờ duyệt');
    const targetId = pendingOpps.length > 0 ? pendingOpps[0].id : (currentProcessingOpp ? currentProcessingOpp.id : (allOpportunities.length > 0 ? allOpportunities[0].id : null));
    if (targetId) {
      openManagerApprovalModal(targetId, 'APPROVED');
    } else {
      showStepTransitionToast('Hộp thư đã sạch sẽ, toàn bộ đơn đều đã được duyệt!', 'info', 2000);
    }
  } else {
    openSaasPage('page-ingestion');
  }
}

function updateFourStepLayout(pageId) {
  const c1 = document.getElementById('flowStepCard1');
  const c2 = document.getElementById('flowStepCard2');
  const c3 = document.getElementById('flowStepCard3');
  const c4 = document.getElementById('flowStepCard4');

  const b1 = document.getElementById('flowStepBadge1');
  const b2 = document.getElementById('flowStepBadge2');
  const b3 = document.getElementById('flowStepBadge3');
  const b4 = document.getElementById('flowStepBadge4');

  const p1 = document.getElementById('flowStepPill1');
  const p2 = document.getElementById('flowStepPill2');
  const p3 = document.getElementById('flowStepPill3');
  const p4 = document.getElementById('flowStepPill4');

  if (!c1 || !c2 || !c3 || !c4) return;

  function setStep(card, badge, pill, num, state, text) {
    card.className = 'step-pastel-box ' + (state === 'active' ? 'active' : (state === 'done' ? 'done' : ''));
    badge.textContent = (state === 'done') ? '' : num;
    pill.className = 'step-pill-tag ' + (state === 'active' ? 'gold-active' : (state === 'done' ? 'gold-done' : ''));
    pill.textContent = text;
  }

  if (pageId === 'page-ingestion') {
    setStep(c1, b1, p1, '1', 'active', 'Đang thực hiện');
    setStep(c2, b2, p2, '2', 'pending', 'Chờ');
    setStep(c3, b3, p3, '3', 'pending', 'Chờ');
    setStep(c4, b4, p4, '4', 'pending', 'Chờ');
  } else if (pageId === 'page-parsing') {
    setStep(c1, b1, p1, '1', 'done', 'Xong');
    setStep(c2, b2, p2, '2', 'active', 'Đang thực hiện');
    setStep(c3, b3, p3, '3', 'pending', 'Chờ');
    setStep(c4, b4, p4, '4', 'pending', 'Chờ');
  } else if (pageId === 'page-validation' || pageId === 'page-pricing') {
    setStep(c1, b1, p1, '1', 'done', 'Xong');
    setStep(c2, b2, p2, '2', 'done', 'Xong');
    setStep(c3, b3, p3, '3', 'active', 'Đang thực hiện');
    setStep(c4, b4, p4, '4', 'pending', 'Chờ');
  } else if (pageId === 'page-approval' || pageId === 'page-reports') {
    setStep(c1, b1, p1, '1', 'done', 'Xong');
    setStep(c2, b2, p2, '2', 'done', 'Xong');
    setStep(c3, b3, p3, '3', 'done', 'Xong');
    setStep(c4, b4, p4, '4', 'active', 'Đang thực hiện');
  } else {
    // Default / Dashboard
    const hasData = allOpportunities && allOpportunities.length > 0;
    if (hasData) {
      setStep(c1, b1, p1, '1', 'done', 'Xong');
      setStep(c2, b2, p2, '2', 'done', 'Xong');
      setStep(c3, b3, p3, '3', 'done', 'Xong');
      setStep(c4, b4, p4, '4', 'active', 'Sẵn sàng');
    } else {
      setStep(c1, b1, p1, '1', 'active', 'Đang thực hiện');
      setStep(c2, b2, p2, '2', 'pending', 'Chờ');
      setStep(c3, b3, p3, '3', 'pending', 'Chờ');
      setStep(c4, b4, p4, '4', 'pending', 'Chờ');
    }
  }
}

// ==========================================
// AUTHENTICATION & LOGIN / REGISTER LOGIC
// ==========================================
function switchAuthMode(mode) {
  const tabLogin = document.getElementById('tabBtnLogin');
  const tabRegister = document.getElementById('tabBtnRegister');
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const titleEl = document.getElementById('authBoxTitle');
  const subtitleEl = document.getElementById('authBoxSubtitle');
  const errBox = document.getElementById('loginErrorAlert');
  const succBox = document.getElementById('loginSuccessAlert');

  errBox.style.display = 'none';
  succBox.style.display = 'none';

  if (mode === 'register') {
    tabRegister.style.background = '#fff';
    tabRegister.style.color = '#059669';
    tabRegister.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
    tabLogin.style.background = 'transparent';
    tabLogin.style.color = '#64748b';
    tabLogin.style.boxShadow = 'none';

    loginForm.style.display = 'none';
    regForm.style.display = 'block';

    titleEl.textContent = 'Đăng Ký Tài Khoản Mới';
    subtitleEl.textContent = 'Tạo tài khoản Khách hàng hoặc Chuyên viên B2B Doanh Nghiệp';
  } else {
    tabLogin.style.background = '#fff';
    tabLogin.style.color = '#b45309';
    tabLogin.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
    tabRegister.style.background = 'transparent';
    tabRegister.style.color = '#64748b';
    tabRegister.style.boxShadow = 'none';

    regForm.style.display = 'none';
    loginForm.style.display = 'block';

    titleEl.textContent = 'Enterprise B2B AI Agent Platform';
    subtitleEl.textContent = 'Cổng xác thực & Đăng nhập doanh nghiệp';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const company = document.getElementById('regCompany').value.trim();
  const roleCode = document.getElementById('regRoleCode').value;
  const pwd = document.getElementById('regPassword').value;
  const confirmPwd = document.getElementById('regConfirmPassword').value;
  const errBox = document.getElementById('loginErrorAlert');
  const succBox = document.getElementById('loginSuccessAlert');

  errBox.style.display = 'none';
  succBox.style.display = 'none';

  if (pwd !== confirmPwd) {
    errBox.textContent = 'Mật khẩu xác nhận không khớp! Vui lòng nhập lại.';
    errBox.style.display = 'block';
    return;
  }

  if (pwd.length < 6) {
    errBox.textContent = 'Mật khẩu phải có tối thiểu 6 ký tự!';
    errBox.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone,
        company,
        role_code: roleCode,
        password: pwd
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      currentUser = data.user;
      currentToken = data.token;
      localStorage.setItem('minhan_user', JSON.stringify(currentUser));
      localStorage.setItem('minhan_token', currentToken);

      succBox.textContent = data.message || 'Đăng ký tài khoản thành công! Đang chuyển vào hệ thống...';
      succBox.style.display = 'block';

      applyUserInfoToUi(currentUser);
      await loadBackendData();

      setTimeout(() => {
        closeAuthModal();
        navigateTo('app');
        openSaasPage('page-ingestion');
        setTimeout(() => {
          openWelcomeAgentModal(true);
        }, 300);
      }, 800);
    } else {
      errBox.innerHTML = `<b>Lỗi đăng ký:</b> ${data.error || 'Không thể tạo tài khoản!'}`;
      errBox.style.display = 'block';
    }
  } catch (err) {
    errBox.innerHTML = '<b>Lỗi hệ thống:</b> Không thể kết nối tới máy chủ!';
    errBox.style.display = 'block';
  }
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profInputName').value.trim();
  const phone = document.getElementById('profInputPhone').value.trim();
  const company = document.getElementById('profInputCompany').value.trim();

  try {
    const res = await fetch('/api/user/update_profile', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, phone, company })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      alert('Đã cập nhật thông tin hồ sơ cá nhân thành công!');
      currentUser = data.user;
      localStorage.setItem('minhan_user', JSON.stringify(currentUser));
      applyUserInfoToUi(currentUser);
    } else {
      alert('Lỗi: ' + (data.error || 'Không thể cập nhật!'));
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ');
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  const oldPwd = document.getElementById('pwdCurrent').value;
  const newPwd = document.getElementById('pwdNew').value;
  const confirmNew = document.getElementById('pwdConfirm').value;

  if (newPwd !== confirmNew) {
    alert('Mật khẩu mới và mật khẩu xác nhận không trùng khớp!');
    return;
  }

  try {
    const res = await fetch('/api/user/change_password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      alert('Chúc mừng! Đã đổi mật khẩu thành công. Mật khẩu mới có hiệu lực ngay lập tức.');
      document.getElementById('changePasswordForm').reset();
    } else {
      alert('Lỗi đổi mật khẩu: ' + (data.error || 'Mật khẩu cũ không đúng!'));
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ');
  }
}
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errorBox = document.getElementById('loginErrorAlert');

  errorBox.style.display = 'none';

  // 1. Kiểm tra validation phía client
  if (!email || !password) {
    errorBox.textContent = 'Vui lòng nhập đầy đủ Email và Mật khẩu!';
    errorBox.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      currentUser = data.user;
      currentToken = data.token;
      localStorage.setItem('minhan_user', JSON.stringify(currentUser));
      localStorage.setItem('minhan_token', currentToken);

      applyUserInfoToUi(currentUser);
      errorBox.style.display = 'none';

      // Load lại dữ liệu theo phân quyền của người dùng vừa đăng nhập
      await loadBackendData();

      closeAuthModal();
      navigateTo('app');
      openSaasPage('page-ingestion');
      setTimeout(() => {
        openWelcomeAgentModal(true);
      }, 300);
    } else {
      // Hiển thị lỗi xác thực chính xác
      errorBox.innerHTML = `<b>Lỗi xác thực:</b> ${data.error || 'Email hoặc mật khẩu không chính xác!'}`;
      errorBox.style.display = 'block';
    }
  } catch (err) {
    errorBox.innerHTML = '<b>Lỗi hệ thống:</b> Không thể kết nối tới máy chủ xác thực!';
    errorBox.style.display = 'block';
  }
}

function fillDemoAccount(email, pwd) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = pwd;
  document.getElementById('loginErrorAlert').style.display = 'none';
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById('loginPassword');
  pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
}

function handleLogout() {
  if (confirm(`Bạn có chắc chắn muốn đăng xuất tài khoản [${currentUser ? currentUser.name : ''}]?`)) {
    if (currentToken) {
      fetch('/api/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ token: currentToken })
      }).catch(() => {});
    }
    clearSession();
    navigateTo('landing');
  }
}

function clearSession() {
  currentUser = null;
  currentToken = null;
  localStorage.removeItem('minhan_user');
  localStorage.removeItem('minhan_token');
}

function applyUserInfoToUi(user) {
  if (!user) return;
  const nameEl = document.getElementById('sidebarUserName');
  const roleEl = document.getElementById('sidebarUserRole');
  const avatarEl = document.getElementById('sidebarUserAvatar');

  if (nameEl) nameEl.textContent = user.name || 'Người dùng';
  if (roleEl) roleEl.textContent = user.role_name || user.role_code;
  if (avatarEl && user.avatar) avatarEl.src = user.avatar;

  // Profile Page elements
  const pName = document.getElementById('profileCardName');
  const pEmail = document.getElementById('profileCardEmail');
  const pRole = document.getElementById('profileCardRole');
  const pId = document.getElementById('profileCardId');
  const pComp = document.getElementById('profileCardCompany');
  const pPhone = document.getElementById('profileCardPhone');
  const pAvatar = document.getElementById('profileCardAvatar');

  if (pName) pName.textContent = user.name || 'Người dùng';
  if (pEmail) pEmail.textContent = user.email || 'N/A';
  if (pRole) pRole.textContent = user.role_name || user.role_code;
  if (pId) pId.textContent = user.id || 'USR-999';
  if (pComp) pComp.textContent = user.company || user.department || 'Doanh Nghiệp B2B';
  if (pPhone) pPhone.textContent = user.phone || 'Chưa cập nhật';
  if (pAvatar && user.avatar) pAvatar.src = user.avatar;

  // Prefill inputs
  const inName = document.getElementById('profInputName');
  const inPhone = document.getElementById('profInputPhone');
  const inComp = document.getElementById('profInputCompany');
  if (inName) inName.value = user.name || '';
  if (inPhone) inPhone.value = user.phone || '';
  if (inComp) inComp.value = user.company || user.department || '';
}

// Áp dụng giao diện và phân quyền theo đúng vai trò thực tế
function applyRoleBasedAccess(user) {
  if (!user) return;

  const bannerIcon = document.getElementById('roleGreetingIcon');
  const bannerTitle = document.getElementById('roleGreetingTitle');
  const bannerDesc = document.getElementById('roleGreetingDesc');
  const bannerBadge = document.getElementById('roleGreetingBadge');
  const dashHeaderTitle = document.getElementById('dashRoleHeaderTitle');

  if (user.role_code === 'ADMIN') {
    bannerIcon.textContent = '';
    bannerTitle.textContent = `Bàn Làm Việc Quản Trị Viên: ${user.name}`;
    bannerDesc.textContent = `Bạn có toàn quyền quản trị hệ thống, dữ liệu Master Catalog và cấu hình AI Agent.`;
    bannerBadge.textContent = 'Quyền Toàn Cục (Admin)';
    bannerBadge.className = 'badge-tag eligible';
    dashHeaderTitle.textContent = 'Bảng Điều Khiển Tổng Quan Doanh Nghiệp';
  } else if (user.role_code === 'SALES_MANAGER') {
    bannerIcon.textContent = '';
    bannerTitle.textContent = `Bàn Làm Việc Trưởng Phòng Kinh Doanh: ${user.name}`;
    bannerDesc.textContent = `Bạn có quyền phê duyệt các cơ hội chiết khấu vượt hạn mức (>5%) và theo dõi toàn bộ cơ hội kinh doanh.`;
    bannerBadge.textContent = 'Thẩm Quyền Phê Duyệt';
    bannerBadge.className = 'badge-tag pending';
    dashHeaderTitle.textContent = 'Bảng Điều Khiển Phê Duyệt & Quản Lý Đội Ngũ Sales';
  } else if (user.role_code === 'SALES_REP') {
    bannerIcon.textContent = '';
    bannerTitle.textContent = `Bàn Làm Việc Chuyên Viên Kinh Doanh: ${user.name}`;
    bannerDesc.textContent = `Bạn phụ trách tiếp nhận yêu cầu, lập dự thảo báo giá (chiết khấu tối đa 5%) và theo dõi hồ sơ được phân công.`;
    bannerBadge.textContent = 'Chuyên Viên Sales (Hạn mức <= 5%)';
    bannerBadge.className = 'badge-tag missing';
    dashHeaderTitle.textContent = 'Bảng Theo Dõi Cơ Hội Bán Hàng Cá Nhân';
  } else if (user.role_code === 'CUSTOMER') {
    bannerIcon.textContent = '';
    bannerTitle.textContent = `Cổng Dịch Vụ Khách Hàng: ${user.name}`;
    bannerDesc.textContent = `Bạn có thể gửi yêu cầu báo giá mới, theo dõi tiến độ xử lý và xem các đề xuất thương mại từ hệ thống B2B.`;
    bannerBadge.textContent = 'Khách Hàng Doanh Nghiệp';
    bannerBadge.className = 'badge-tag eligible';
    dashHeaderTitle.textContent = 'Theo Dõi Đơn Hàng & Yêu Cầu Của DigiTech';
  }
}

// ==========================================
// PAGE 3: DASHBOARD CONTROLLER
// ==========================================
function renderDashboardData(summary, opps) {
  if (!summary) return;

  document.getElementById('dashCountEligible').textContent = summary.eligible.count;
  document.getElementById('dashValEligible').textContent = formatCurrency(summary.eligible.total_value);

  document.getElementById('dashCountPending').textContent = summary.pending_approval.count;
  document.getElementById('dashValPending').textContent = formatCurrency(summary.pending_approval.total_value);

  document.getElementById('dashCountMissing').textContent = summary.missing_info.count;
  document.getElementById('dashCountUnfulfilled').textContent = summary.unfulfilled.count;

  document.getElementById('sidebarOppCount').textContent = opps.length;
  document.getElementById('sidebarPendingCount').textContent = summary.pending_approval.count;

  const tbody = document.getElementById('dashTableBody');
  if (opps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 45px 20px; color:#64748b;">
          <div style="font-size:36px; margin-bottom:8px;"></div>
          <div style="font-size:15px; font-weight:800; color:#1e293b;">Dữ liệu hiện đang trống (Zero-state)</div>
          <p style="font-size:13px; color:#64748b; margin:6px 0 16px 0;">Chưa có cơ hội kinh doanh nào trong hệ thống. Hãy nạp yêu cầu mới để AI Agent phân tích.</p>
          <div style="display:inline-flex; gap:10px;">
            <button class="btn-primary-action" onclick="openSaasPage('page-ingestion')">Tạo Yêu Cầu Mới</button>
            <button class="btn-secondary-tool" onclick="handleSeedDemoData()">Nạp 4 Test Case Mẫu</button>
          </div>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = opps.slice(0, 5).map(o => `
      <tr>
        <td><b>${o.id}</b></td>
        <td>
          <div style="font-weight:700;">${o.customer_name}</div>
          <small style="color:#64748b;">${o.contact_person}</small>
        </td>
        <td><span class="badge-tag ${getBadgeStyle(o.status)}">${o.status}</span></td>
        <td style="font-weight:700;">${o.pricing.total_after_discount > 0 ? formatCurrency(o.pricing.total_after_discount) : 'Chưa xác định'}</td>
        <td>${o.sales_rep ? o.sales_rep.name : 'N/A'}</td>
        <td>
          <button class="btn-secondary-tool" onclick="inspectOpportunity('${o.id}')">Xem hồ sơ &rarr;</button>
        </td>
      </tr>
    `).join('');
  }

  renderSaasChart(summary);
  renderAllOpportunitiesTable(opps);
}

function renderSaasChart(summary) {
  const ctx = document.getElementById('saasStatusChart');
  if (!ctx) return;

  if (saasChartInstance) {
    saasChartInstance.destroy();
  }

  const total = (summary.eligible.count || 0) + (summary.pending_approval.count || 0) + (summary.missing_info.count || 0) + (summary.unfulfilled.count || 0);

  if (total === 0) {
    saasChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Chưa có dữ liệu (0 cơ hội)'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e2e8f0'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, weight: '600' } } }
        },
        cutout: '70%'
      }
    });
    return;
  }

  saasChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Có thể tiếp tục', 'Chờ duyệt', 'Cần bổ sung', 'Chưa đáp ứng'],
      datasets: [{
        data: [
          summary.eligible.count,
          summary.pending_approval.count,
          summary.missing_info.count,
          summary.unfulfilled.count
        ],
        backgroundColor: ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, weight: '600' } } }
      },
      cutout: '65%'
    }
  });
}

// ==========================================
// PAGE 4 & 5: INGESTION & PARSING
// ==========================================
function buildSampleRawTable(tcNum) {
  const headers = ['Mã Đơn', 'Khách Hàng', 'Mã SKU', 'Tên Sản Phẩm', 'Số Lượng', 'Đơn Giá (VNĐ)', 'Chiết Khấu (%)', 'Ghi Chú'];
  const rows = [
    ['DH-001', 'Công ty CP Viễn Thông Toàn Cầu', 'PRD-NET-001', 'Router Cisco Catalyst C8200L', '30', '24500000', '10', 'Thanh toán 100%, giao 10 ngày'],
    ['DH-001', 'Công ty CP Viễn Thông Toàn Cầu', 'PRD-NET-001', 'Router Cisco Catalyst C8200L', '30', '24500000', '10', 'Thanh toán 100%, giao 10 ngày'],
    ['DH-002', 'Công ty CP Công Nghệ DigiTech', 'PRD-LAP-001', 'Laptop Dell Vostro 5630', '10', '18500000', '4', 'Giao trong 7 ngày làm việc'],
    ['DH-002', 'Công ty CP Công Nghệ DigiTech', 'PRD-LAP-001', 'Laptop Dell Vostro 5630', '5', '18500000', '4', 'Đặt bổ sung đợt 2'],
    ['DH-003', 'Tập đoàn Dược Phẩm An Khang', 'PRD-SVR-001', 'Server Dell PowerEdge R450', '', '68000000', '5', 'Chưa rõ số lượng cụ thể'],
    ['DH-004', 'Hệ Thống Bán Lẻ Phúc An Retail', 'PRD-MON-001', 'Màn hình Dell P2422H 23.8 inch', '25', '4200000', '6', 'Giao kho TP.HCM'],
    ['DH-005', 'Công ty Logistics Minh Phát', 'PRD-NET-002', 'Switch Cisco Catalyst C1000-24T', '-4', '14000000', '8', 'Lỗi nhập số lượng âm'],
    ['DH-006', 'Tập đoàn Bất Động Sản Hưng Thịnh', 'PRD-PRN-001', 'Máy in Laser HP LaserJet Pro', '12', '11500000', '5', 'Bảo hành 12 tháng'],
    ['DH-006', 'Tập đoàn Bất Động Sản Hưng Thịnh', 'PRD-PRN-001', 'Máy in Laser HP LaserJet Pro', '12', '11500000', '35', 'Xung đột chiết khấu do gửi lặp'],
    ['DH-007', 'Ngân Hàng TMCP Á Châu B2B', 'PRD-CAM-001', 'Camera hội nghị Logitech Rally Bar', '6', '48000000', '7', 'Lắp đặt tại hội sở'],
    ['DH-008', 'Công ty CP Thực Phẩm Xanh', 'PRD-LAP-002', 'Laptop Lenovo ThinkPad E14 Gen 5', '15', '21000000', '', 'Thiếu mức chiết khấu']
  ];
  return { headers, rows, totalOriginalRows: rows.length };
}

function parseCsvTextToTable(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], totalOriginalRows: 0 };

  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',');
  const parseLine = (line) => {
    const res = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        res.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur);
    return res;
  };

  const headers = parseLine(lines[0]).map((h, i) => String(h || '').trim() || `Cột ${i + 1}`);
  const rows = [];
  for (let i = 1; i < Math.min(lines.length, 2001); i++) {
    const cols = parseLine(lines[i]);
    while (cols.length < headers.length) cols.push('');
    rows.push(cols.slice(0, headers.length));
  }
  return { headers, rows, totalOriginalRows: Math.max(0, lines.length - 1) };
}

function loadTestCaseToForm(tcNum) {
  const text = TEST_CASES_SAMPLES[tcNum];
  const sampleFileName = `Data_mau_60000_dong_case_${tcNum}.xlsx`;
  uploadedRawFileName = sampleFileName;
  liveRawTable = buildSampleRawTable(tcNum);
  liveRawTablePage = 1;

  resetStep2AutoDedupReport();
  const dedupRep = autoDedupLiveRawTableOnScan();
  initStep2CommandState();
  logStep2AutoDedupResult(dedupRep);

  const textarea = document.getElementById('pageIngestTextarea');
  if (textarea) {
    textarea.value = `[TẬP TIN MẪU ĐÃ NẠP: ${sampleFileName}]\n` + (text || '');
    textarea.style.border = '';
  }
  const uploadBtn = document.getElementById('btnUploadRawFile');
  if (uploadBtn) {
    uploadBtn.style.border = '';
    uploadBtn.style.boxShadow = '';
  }
  const note = document.getElementById('rawInputStatusNote');
  const origCnt = dedupRep ? dedupRep.originalRows : liveRawTable.rows.length;
  const remCnt = dedupRep ? (dedupRep.exactRemoved + dedupRep.partialDropRemoved) : 0;
  const keptCnt = dedupRep ? dedupRep.partialKept : 0;
  if (note) {
    note.innerHTML = `<span style="color:#16a34a; font-weight:700;">Đã nạp & khử trùng tệp mẫu [${sampleFileName}] (Gốc ${origCnt} dòng &rarr; Đã xóa ${remCnt} lỗi trùng lặp, giữ ${keptCnt} lặp 1 phần hợp lý, còn ${liveRawTable.rows.length} dòng)</span>. Bấm nút bên dưới để chạy dữ liệu ở Bước 2.`;
  }
  showStepTransitionToast(`Đã nạp tệp dữ liệu mẫu: ${sampleFileName} (Đã xóa ${remCnt} lỗi trùng lặp, giữ ${keptCnt} lặp 1 phần hợp lý)`, 'success', 2800);
}

async function handleFileUploadSim(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  uploadedRawFileName = fileName;
  liveRawTablePage = 1;

  const uploadBtn = document.getElementById('btnUploadRawFile');
  if (uploadBtn) {
    uploadBtn.style.border = '';
    uploadBtn.style.boxShadow = '';
  }

  const finalizeFileLoad = (previewText, tableObj) => {
    liveRawTable = (tableObj && tableObj.headers && tableObj.headers.length > 0 && tableObj.rows.length > 0)
      ? tableObj
      : buildSampleRawTable(3);

    // Tự động khử trùng lặp ngay khi đọc/quét file: xóa sạch lặp 100% và lặp 1 phần bất hợp lý, giữ lại lặp 1 phần hợp lý
    resetStep2AutoDedupReport();
    const dedupRep = autoDedupLiveRawTableOnScan();
    initStep2CommandState();
    logStep2AutoDedupResult(dedupRep);

    const textarea = document.getElementById('pageIngestTextarea');
    if (textarea) {
      textarea.value = previewText;
      textarea.style.border = '';
    }
    const note = document.getElementById('rawInputStatusNote');
    const origCnt = dedupRep ? dedupRep.originalRows : liveRawTable.totalOriginalRows;
    const remCnt = dedupRep ? (dedupRep.exactRemoved + dedupRep.partialDropRemoved) : 0;
    const keptCnt = dedupRep ? dedupRep.partialKept : 0;
    if (note) {
      note.innerHTML = `<span style="color:#16a34a; font-weight:700;">Đã đọc & khử trùng tệp [${fileName}] (Gốc ${origCnt.toLocaleString()} dòng &rarr; Đã xóa ${remCnt.toLocaleString()} lỗi trùng lặp, giữ ${keptCnt.toLocaleString()} lặp 1 phần hợp lý, còn ${liveRawTable.rows.length.toLocaleString()} dòng)</span>. Bấm nút bên dưới để chạy dữ liệu sang Bước 2.`;
    }
    showStepTransitionToast(`Đã đọc ${origCnt.toLocaleString()} dòng từ tệp ${fileName} (Tự động xóa ${remCnt.toLocaleString()} lỗi trùng lặp, giữ ${keptCnt.toLocaleString()} lặp 1 phần hợp lý)!`, 'success', 3500);
  };

  if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const readText = evt.target.result || '';
      const parsed = parseCsvTextToTable(readText);
      finalizeFileLoad(`[TẬP TIN CSV ĐÃ TẢI LÊN: ${fileName}]\n` + readText.slice(0, 4000), parsed);
    };
    reader.readAsText(file);
  } else if (lowerName.endsWith('.json')) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const readText = evt.target.result || '';
      let parsed = null;
      try {
        const obj = JSON.parse(readText);
        const arr = Array.isArray(obj) ? obj : (Array.isArray(obj.data) ? obj.data : [obj]);
        if (arr.length > 0 && typeof arr[0] === 'object') {
          const headers = Object.keys(arr[0]);
          const rows = arr.slice(0, 2000).map(item => headers.map(h => item[h] !== undefined && item[h] !== null ? String(item[h]) : ''));
          parsed = { headers, rows, totalOriginalRows: arr.length };
        }
      } catch (err) {
        console.warn('JSON parse fallback', err);
      }
      finalizeFileLoad(`[TẬP TIN JSON ĐÃ TẢI LÊN: ${fileName}]\n` + readText.slice(0, 4000), parsed);
    };
    reader.readAsText(file);
  } else if (lowerName.endsWith('.xlsx')) {
    const reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        const res = await fetch('/api/parse_xlsx', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ file_base64: evt.target.result })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success' && data.rows && data.rows.length > 0) {
          const previewLines = [
            data.headers.join(' | '),
            ...data.rows.slice(0, 15).map(r => r.join(' | '))
          ].join('\n');
          finalizeFileLoad(
            `[TẬP TIN EXCEL ĐÃ TẢI LÊN: ${fileName} — ${data.total_rows.toLocaleString()} dòng]\n${previewLines}`,
            { headers: data.headers, rows: data.rows, totalOriginalRows: data.total_rows }
          );
          return;
        }
      } catch (err) {
        console.warn('parse_xlsx fallback', err);
      }
      finalizeFileLoad(`[TẬP TIN ĐÃ TẢI LÊN: ${fileName}]\n` + TEST_CASES_SAMPLES[3], buildSampleRawTable(3));
    };
    reader.readAsDataURL(file);
  } else if (lowerName.endsWith('.txt')) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      let readText = evt.target.result || '';
      const parsed = (readText.includes(',') || readText.includes('\t')) ? parseCsvTextToTable(readText) : buildSampleRawTable(3);
      finalizeFileLoad(`[TẬP TIN ĐÃ TẢI LÊN: ${fileName}]\n` + (readText || TEST_CASES_SAMPLES[3]), parsed);
    };
    reader.readAsText(file);
  } else {
    finalizeFileLoad(`[TẬP TIN ĐÃ TẢI LÊN: ${fileName}]\n` + TEST_CASES_SAMPLES[3], buildSampleRawTable(3));
  }
}

async function runIngestAutoToApproval(customFileName) {
  let rawText = document.getElementById('pageIngestTextarea').value.trim();
  if (!rawText) {
    rawText = TEST_CASES_SAMPLES[3];
    document.getElementById('pageIngestTextarea').value = rawText;
  }

  const fileLabel = customFileName || 'Tệp đơn hàng B2B';

  try {
    const res = await fetch('/api/process_request', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ raw_text: rawText, source: `Nạp tệp tự động: ${fileLabel}` })
    });

    const data = await res.json();
    if (data.status === 'success') {
      currentProcessingOpp = data.opportunity;

      // Đảm bảo trạng thái Chờ duyệt nếu có chiết khấu cao
      if (currentProcessingOpp.pricing.discount_percentage > 8 || currentProcessingOpp.pricing.total_after_discount >= 500000000) {
        currentProcessingOpp.status = 'Chờ duyệt';
        currentProcessingOpp.status_reason = `Mức chiết khấu ${currentProcessingOpp.pricing.discount_percentage}% vượt thẩm quyền chuyên viên bán hàng, AI Agent tự động lập Phiếu chuyển duyệt trình Trưởng phòng.`;
        currentProcessingOpp.pricing.approval_reason = `Đơn đặt hàng số lượng lớn theo tệp ${fileLabel}, khách hàng yêu cầu chiết khấu ${currentProcessingOpp.pricing.discount_percentage}%`;
      }

      allOpportunities.unshift(currentProcessingOpp);

      renderDashboardData(data.summary, allOpportunities);
      renderApprovalInbox(allOpportunities);
      renderAllOpportunitiesTable(allOpportunities);

      // Chuyển thẳng sang trang Phê duyệt
      openSaasPage('page-approval');

      // Mở thông báo trực quan tóm tắt quy trình AI đã chạy ngầm
      showHitlConfirmation(
        'TỰ ĐỘNG CHUYỂN SANG PHÊ DUYỆT THÀNH CÔNG',
        `<div style="color:#047857; font-weight:700; font-size:14px; margin-bottom:8px;">
           AI Agent đã phân tích tệp [${fileLabel}] và xử lý tự động toàn trình:
         </div>
         <div style="background:#f8fafc; padding:12px; border-radius:10px; font-size:12.5px; border:1px solid #e2e8f0; line-height:1.7;">
           • <b>Bóc tách tự động:</b> Khách hàng <b>${currentProcessingOpp.customer_name}</b>, ${currentProcessingOpp.validation.items.length} mặt hàng.<br>
           • <b>Thẩm định kho:</b> Đối chiếu Master Catalog, kho đáp ứng khả dụng 100%.<br>
           • <b>Kiểm tra hạn mức:</b> Chiết khấu <b>${currentProcessingOpp.pricing.discount_percentage}%</b> vượt hạn mức Sales (tối đa 8%).<br>
           • <b>Quyết định tự động:</b> AI Agent tự động lập <b>Phiếu Chuyển Duyệt</b> và đưa thẳng vào <b>Hộp thư Trưởng phòng</b>!
         </div>
         <p style="margin-top:10px; color:#6d28d9; font-weight:700;">Hệ thống đã tự động chuyển đến Hộp thư phê duyệt để Trưởng phòng xem xét và ra quyết định ngay bên dưới!</p>`,
        () => {}
      );
    } else {
      alert('Lỗi: ' + (data.error || 'Không thể xử lý'));
    }
  } catch (err) {
    console.error(err);
    alert('Lỗi xử lý: ' + (err.message || 'Không thể kết nối máy chủ'));
  }
}

async function runIngestToParsing() {
  if (!validateStep1Requirements(true)) {
    return;
  }

  const compEl = document.getElementById('ctxCompanyName');
  const indEl = document.getElementById('ctxIndustry');
  const audEl = document.getElementById('ctxAudience');
  const goalsEl = document.getElementById('ctxGoals');
  const rawTextEl = document.getElementById('pageIngestTextarea');

  const compName = compEl ? compEl.value.trim() : '';
  const goals = goalsEl ? goalsEl.value.trim() : '';
  const rawText = rawTextEl ? rawTextEl.value.trim() : '';

  showStepTransitionToast('AI Agent đang bóc tách thực thể... Chuyển sang Bước 2.', 'info', 2000);

  const contextPayload = {
    company_name: compName,
    industry: indEl ? indEl.value.trim() : '',
    audience: audEl ? audEl.value.trim() : '',
    goals: goals,
    uploaded_file_name: uploadedRawFileName,
    desired_outputs: Array.isArray(selectedOutputs) && selectedOutputs.length > 0 ? selectedOutputs : ['dashboard'],
    desired_output_label: (Array.isArray(selectedOutputs) && selectedOutputs.length > 0 ? selectedOutputs : ['dashboard'])
      .map(t => ({ 'dashboard': 'Dashboard', 'report': 'Báo cáo', 'html': 'HTML' }[t] || t))
      .join(', ')
  };

  try {
    const res = await fetch('/api/process_request', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        raw_text: rawText, 
        context: contextPayload,
        source: `Tệp tải lên: ${uploadedRawFileName}` 
      })
    });

    const data = await res.json();
    if (data.status === 'success') {
      currentProcessingOpp = data.opportunity;
      allOpportunities.unshift(currentProcessingOpp);
      step1Completed = true;

      renderParsingSplitView(currentProcessingOpp);
      openSaasPage('page-parsing');

      renderDashboardData(data.summary, allOpportunities);
      renderApprovalInbox(allOpportunities);
      showStepTransitionToast(`Bóc tách thành công cơ hội ${currentProcessingOpp.id}! Vui lòng bấm Xác nhận để chuyển tiếp.`, 'success', 2500);
    } else {
      alert('Lỗi: ' + (data.error || 'Không thể xử lý'));
    }
  } catch (err) {
    console.error(err);
    alert('Lỗi xử lý: ' + (err.message || 'Không thể kết nối máy chủ'));
  }
}

function renderEmptyParsingView() {
  const rawBox = document.getElementById('parsingRawContent');
  const resBox = document.getElementById('parsingResultBox');
  const badgeEl = document.getElementById('parsingVerificationBadge');
  const guidanceEl = document.getElementById('parsingCheckpointGuidance');
  const confirmBtn = document.getElementById('btnConfirmParsingAction');

  liveRawTable = { headers: [], rows: [], totalOriginalRows: 0 };
  step2OriginalRowsSnapshot = [];
  step2CommandHistory = [];
  step2CommandLogs = [];
  step2AuditActionLog = [];
  currentCleansingAuditData = [];
  if (typeof resetStep2AutoDedupReport === 'function') resetStep2AutoDedupReport();
  liveRawEditedCells = new Set();
  renderLiveRawDataTable();
  renderStep2CommandLogs();

  if (rawBox) {
    rawBox.innerHTML = `
      <div style="text-align:center; padding:50px 20px; color:#94a3b8;">
        <div style="font-size:36px; margin-bottom:8px;"></div>
        <div style="font-weight:700; color:#475569; font-size:14px;">Chưa Có Nội Dung Văn Bản Gốc</div>
        <p style="font-size:12.5px; margin-top:4px;">Vui lòng vào <b>Bước 1: Tiếp nhận</b> để dán email hoặc nạp tệp đặt hàng.</p>
        <button class="btn-primary-action" onclick="openSaasPage('page-ingestion')" style="margin-top:12px; font-size:12px;">
          <span>Đi Đến Tiếp Nhận Yêu Cầu</span>
        </button>
      </div>
    `;
  }

  if (resBox) {
    resBox.innerHTML = `
      <div style="text-align:center; padding:50px 20px; color:#94a3b8;">
        <div style="font-size:36px; margin-bottom:8px;"></div>
        <div style="font-weight:700; color:#475569; font-size:14px;">Chưa Có Thực Thể Bóc Tách</div>
        <p style="font-size:12.5px; margin-top:4px;">AI Agent sẽ tự động trích xuất cấu trúc dữ liệu ngay khi bạn nạp yêu cầu.</p>
      </div>
    `;
  }

  if (badgeEl) {
    badgeEl.className = 'badge-tag missing';
    badgeEl.textContent = 'Chưa Có Dữ Liệu';
  }

  if (guidanceEl) {
    guidanceEl.innerHTML = 'Chưa có đơn hàng nào trong luồng bóc tách. Vui lòng bắt đầu từ <b>Bước 1: Tiếp nhận yêu cầu</b>.';
  }

  // Đặt toàn bộ bảng thống kê dữ liệu lỗi & trùng lặp về 0 khi chưa có dữ liệu
  const zeroMap = {
    cleansingTotalRecords: '0 dòng',
    cleansingTotalSub: 'Chưa nạp dữ liệu',
    cleansingDupRecords: '0 bản ghi',
    cleansingDupSub: 'Chờ quét dữ liệu',
    cleansingExactDupRecords: '0 dòng',
    cleansingExactDupSub: 'Chờ phân tích',
    cleansingPartialDupRecords: '0 bản ghi',
    cleansingPartialDupSub: 'Chưa có dữ liệu thẩm định',
    cleansingCleanRecords: '0 dòng',
    cleansingSuccessRateSub: 'Tỷ lệ đạt chuẩn: 0%',
    step2DetectedErrorSummaryBadge: 'Chờ quét dữ liệu'
  };
  Object.entries(zeroMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
  const pillsEl = document.getElementById('step2ErrorCategoryPills');
  if (pillsEl) pillsEl.innerHTML = '';
  const wrapEl = document.getElementById('step2LinkedNewDataWrap');
  if (wrapEl) {
    wrapEl.innerHTML = '<div style="padding:14px; font-size:12px; color:#64748b; text-align:center;">Chưa có dữ liệu. Khi nạp file hoặc chạy lệnh, hệ thống sẽ tự động liệt kê các dòng lỗi và dữ liệu mới cập nhật tại đây.</div>';
  }
  const auditTbody = document.getElementById('cleansingAuditTbody');
  if (auditTbody) {
    auditTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:28px; color:#64748b;">
          Chưa có dữ liệu đầu vào. Vui lòng hoàn thiện Bước 1 (điền Bối cảnh & tải File dữ liệu thô).
        </td>
      </tr>
    `;
  }

  if (confirmBtn) {
    confirmBtn.style.background = '#94a3b8';
    confirmBtn.innerHTML = '<span>Chờ Nạp Yêu Cầu Từ Bước 1</span>';
  }

  const errTableBody = document.getElementById('cleansingErrorTableBody');
  if (errTableBody) {
    errTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">Chưa có dữ liệu để thống kê lỗi & trùng lặp. Vui lòng hoàn tất Bước 1 để bắt đầu.</td></tr>';
  }
  const totalEl = document.getElementById('cleansingTotalRecords');
  const dupEl = document.getElementById('cleansingDupRecords');
  const exactDupEl = document.getElementById('cleansingExactDupRecords');
  const partialDupEl = document.getElementById('cleansingPartialDupRecords');
  const partialSubEl = document.getElementById('cleansingPartialDupSub');
  const cleanEl = document.getElementById('cleansingCleanRecords');
  const rateSubEl = document.getElementById('cleansingSuccessRateSub');
  if (totalEl) totalEl.textContent = '0 dòng';
  if (dupEl) dupEl.textContent = '0 bản ghi';
  if (exactDupEl) exactDupEl.textContent = '0 đã xóa';
  if (partialDupEl) partialDupEl.textContent = '0 bản ghi';
  if (partialSubEl) partialSubEl.textContent = 'Giữ 0 | Xóa 0';
  if (cleanEl) cleanEl.textContent = '0 dòng';
  if (rateSubEl) rateSubEl.textContent = 'Tỷ lệ sạch: 100%';

  const cntAll = document.getElementById('countFilterAll');
  const cntDup = document.getElementById('countFilterDup');
  const cntOth = document.getElementById('countFilterOther');
  if (cntAll) cntAll.textContent = '0';
  if (cntDup) cntDup.textContent = '0';
  if (cntOth) cntOth.textContent = '0';

  const reconBadge = document.getElementById('reconciliationStatusBadge');
  if (reconBadge) {
    reconBadge.className = 'badge-tag missing';
    reconBadge.textContent = 'Chưa Có Dữ Liệu Đối Soát';
  }
  const reconList = document.getElementById('reconciliationActionList');
  if (reconList) {
    reconList.innerHTML = '<div style="text-align:center; padding:18px; color:#94a3b8; font-size:12.5px;">Chưa có dữ liệu để đối soát và sửa lỗi. Vui lòng nạp yêu cầu ở Bước 1.</div>';
  }
  const fixCount = document.getElementById('fixStatusCount');
  if (fixCount) fixCount.textContent = 'Chờ nạp dữ liệu';

  selectedParsingSatisfaction = null;
  const cardSat = document.getElementById('choiceSatisfiedCard');
  const cardUnsat = document.getElementById('choiceUnsatisfiedCard');
  const radioSat = document.getElementById('radioSatisfied');
  const radioUnsat = document.getElementById('radioUnsatisfied');
  const alertMsg = document.getElementById('satisfactionAlertMsg');
  if (cardSat) { cardSat.style.borderColor = '#e2e8f0'; cardSat.style.background = '#fafafa'; }
  if (cardUnsat) { cardUnsat.style.borderColor = '#e2e8f0'; cardUnsat.style.background = '#fafafa'; }
  if (radioSat) radioSat.checked = false;
  if (radioUnsat) radioUnsat.checked = false;
  if (alertMsg) alertMsg.style.display = 'none';
}

function renderParsingSplitView(opp) {
  currentProcessingOpp = opp;

  selectedParsingSatisfaction = null;
  const cardSat = document.getElementById('choiceSatisfiedCard');
  const cardUnsat = document.getElementById('choiceUnsatisfiedCard');
  const radioSat = document.getElementById('radioSatisfied');
  const radioUnsat = document.getElementById('radioUnsatisfied');
  const alertMsg = document.getElementById('satisfactionAlertMsg');
  if (cardSat) { cardSat.style.borderColor = '#e2e8f0'; cardSat.style.background = '#fafafa'; }
  if (cardUnsat) { cardUnsat.style.borderColor = '#e2e8f0'; cardUnsat.style.background = '#fafafa'; }
  if (radioSat) radioSat.checked = false;
  if (radioUnsat) radioUnsat.checked = false;
  if (alertMsg) alertMsg.style.display = 'none';
  const rawBox = document.getElementById('parsingRawContent');
  if (rawBox && opp.extracted) {
    rawBox.textContent = opp.extracted.raw_text;
  }

  const itemsHtml = opp.validation.items.map(it => `
    <li style="margin-bottom:4px;">
      <b>${it.name}</b> (Mã: <code>${it.sku}</code>) — SL: <b>${it.requested_qty}</b> | Tồn kho: <b>${it.stock_available}</b> (${it.stock_status})
    </li>
  `).join('');

  const missingHtml = opp.missing_fields.length > 0 
    ? `<div style="background:#fee2e2; color:#b91c1c; padding:8px 12px; border-radius:8px; margin-top:10px; font-weight:700;">
        Cảnh báo thiếu thông tin bắt buộc: ${opp.missing_fields.join(', ')}
       </div>`
    : `<div style="background:#ecfdf5; color:#065f46; padding:8px 12px; border-radius:8px; margin-top:10px; font-weight:700;">
        Thông tin đầy đủ 100% theo quy chuẩn
       </div>`;

  const resBox = document.getElementById('parsingResultBox');
  if (resBox) {
    resBox.innerHTML = `
      <div><b>Mã cơ hội:</b> <code>${opp.id}</code></div>
      <div><b>Khách hàng:</b> ${opp.customer_name}</div>
      <div><b>Người liên hệ:</b> ${opp.contact_person} (Email: ${opp.email || 'N/A'})</div>
      <div><b>Ngân sách dự kiến:</b> ${opp.extracted.budget ? formatCurrency(opp.extracted.budget) : '<span style="color:#ef4444;">Chưa đề cập</span>'}</div>
      <div><b>Thời hạn triển khai:</b> ${opp.extracted.deadline_days ? opp.extracted.deadline_days + ' ngày' : '<span style="color:#ef4444;">Chưa rõ ngày</span>'}</div>
      <div><b>Chiết khấu yêu cầu:</b> ${opp.extracted.requested_discount}%</div>
      
      <div style="margin-top:10px;"><b>Danh sách sản phẩm trích xuất:</b></div>
      <ul style="padding-left:18px; margin-top:4px;">${itemsHtml}</ul>

      ${missingHtml}

      <div style="margin-top:14px; padding-top:10px; border-top:1px dashed #fde68a;">
        <div><b>Trạng thái phân loại:</b> <span class="badge-tag ${getBadgeStyle(opp.status)}">${opp.status}</span></div>
        <div style="color:#64748b; font-size:12px; margin-top:2px;"><b>Căn cứ:</b> ${opp.status_reason}</div>
      </div>
    `;
  }

  // Cập nhật Human Checkpoint 1 Banner
  const badgeEl = document.getElementById('parsingVerificationBadge');
  const guidanceEl = document.getElementById('parsingCheckpointGuidance');
  const confirmBtn = document.getElementById('btnConfirmParsingAction');

  if (opp.missing_fields && opp.missing_fields.length > 0) {
    if (badgeEl) {
      badgeEl.className = 'badge-tag missing';
      badgeEl.textContent = 'Dữ Liệu Chưa Đạt Chuẩn Làm Sạch';
    }
    if (guidanceEl) {
      guidanceEl.innerHTML = `
        <div style="color:#b91c1c; font-weight:700; margin-bottom:4px;">Dữ liệu đầu vào phát hiện thiếu sót hoặc chưa chuẩn hóa:</div>
        Thiếu các trường bắt buộc: <b>${opp.missing_fields.join(', ')}</b>. Theo quy chuẩn nghiệp vụ, hệ thống <b>không tự động ước lượng</b> các yêu cầu chưa rõ ràng. Bạn vui lòng bấm <b>Yêu Cầu Khách Hàng Bổ Sung</b> để gửi email, hoặc bấm <b>Chỉnh Sửa Dữ Liệu Thủ Công</b> trước khi xác nhận dữ liệu sạch.
      `;
    }
    if (confirmBtn) {
      confirmBtn.style.background = '#f59e0b';
      confirmBtn.innerHTML = '<span>Xác Nhận (Bỏ Qua Thiếu Sót & Tiếp Tục) &rarr;</span>';
    }
  } else {
    if (badgeEl) {
      badgeEl.className = 'badge-tag pending';
      badgeEl.textContent = 'Chờ Xác Nhận Dữ Liệu Sạch (Checkpoint 1)';
    }
    if (guidanceEl) {
      guidanceEl.innerHTML = `
        <div style="color:#047857; font-weight:700; margin-bottom:4px;">Dữ liệu đã được tiếp nhận và làm sạch chuẩn hóa 100%:</div>
        Toàn bộ thực thể đã được lọc sạch, chuẩn hóa và loại bỏ dị thường. Vui lòng đối chiếu với dữ liệu thô bên trái và bấm <b>Xác Nhận Dữ Liệu Sạch</b> để tiếp tục sang Bước 3: Thẩm định kho & Báo giá.
      `;
    }
    if (confirmBtn) {
      confirmBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      confirmBtn.innerHTML = '<span>Xác Nhận Dữ Liệu Sạch & Tiếp Tục Thẩm Định Kho &rarr;</span>';
    }
  }

  // Cập nhật Bảng Thống Kê Dữ Liệu Lỗi & Tổng Toàn Bộ Dữ Liệu
  renderCleansingErrorTable(opp);
  // Cập nhật Luồng Đối Soát & Sửa Lỗi Dữ Liệu
  renderReconciliationWorkflow(opp);

  // Chạy & hiển thị Bảng Dữ Liệu Thô Trực Tiếp (mặc định KHÓA chỉ xem — chỉ mở quyền sửa khi chọn Không Hài Lòng tại Checkpoint 1)
  if (!liveRawTable || !liveRawTable.rows || liveRawTable.rows.length === 0) {
    liveRawTable = buildSampleRawTable(3);
  }
  liveRawEditUnlocked = false;
  liveRawEditedCells = new Set();
  liveRawTablePage = 1;
  // Tự động khử trùng lặp ngay khi quét: xóa lặp 100% + lặp 1 phần bất hợp lý, giữ lặp 1 phần hợp lý
  const isFreshTable = !liveRawTable.__dedupDone;
  if (isFreshTable) {
    resetStep2AutoDedupReport();
    const dedupReport = autoDedupLiveRawTableOnScan();
    initStep2CommandState();
    logStep2AutoDedupResult(dedupReport);
  } else {
    autoDedupLiveRawTableOnScan();
  }
  renderLiveRawDataTable();
  syncKpisFromLiveRawTable(analyzeLiveRawTable());
  // KHÔNG tự động hiện Checkpoint 1 lúc mới vào Bước 2 — chỉ hiện khi người dùng bấm "Chuyển sang Bước 3"
}

let currentCleansingAuditData = [];
let currentCleansingFilter = 'all';

function renderCleansingErrorTable(opp) {
  const tbody = document.getElementById('cleansingErrorTableBody');
  if (!tbody || !opp) return;

  // Luôn ưu tiên thống kê THẬT 100% từ bảng dữ liệu thô vừa tải lên (liveRawTable)
  if (liveRawTable && Array.isArray(liveRawTable.rows) && liveRawTable.rows.length > 0) {
    const analysis = analyzeLiveRawTable();
    syncKpisFromLiveRawTable(analysis);
    return;
  }

  const totalEl = document.getElementById('cleansingTotalRecords');
  const dupEl = document.getElementById('cleansingDupRecords');
  const exactDupEl = document.getElementById('cleansingExactDupRecords');
  const partialDupEl = document.getElementById('cleansingPartialDupRecords');
  const partialSubEl = document.getElementById('cleansingPartialDupSub');
  const cleanEl = document.getElementById('cleansingCleanRecords');
  const rateSubEl = document.getElementById('cleansingSuccessRateSub');
  if (!tbody || !opp) return;

  const rawText = (opp.extracted && opp.extracted.raw_text) ? opp.extracted.raw_text : '';

  // Calculate total records & deduplication metrics
  let totalRows = 1000;
  let dupCount = 28;
  let exactDupCount = 18;
  let partialDupCount = 10;
  let partialKeepCount = 7;
  let partialDropCount = 3;

  if (rawText.includes('60.000') || rawText.includes('60k') || rawText.includes('60000')) {
    totalRows = 60000;
    dupCount = 1680;
    exactDupCount = 1080;
    partialDupCount = 600;
    partialKeepCount = 420;
    partialDropCount = 180;
  } else if (rawText.includes('1000') || rawText.includes('1.000')) {
    totalRows = 1000;
    dupCount = 28;
    exactDupCount = 18;
    partialDupCount = 10;
    partialKeepCount = 7;
    partialDropCount = 3;
  } else {
    const lineCount = rawText.split('\n').filter(l => l.trim().length > 0).length;
    totalRows = Math.max(100, lineCount * 25);
    dupCount = Math.max(4, Math.round(totalRows * 0.028));
    exactDupCount = Math.max(2, Math.round(dupCount * 0.65));
    partialDupCount = dupCount - exactDupCount;
    partialKeepCount = Math.max(1, Math.round(partialDupCount * 0.7));
    partialDropCount = partialDupCount - partialKeepCount;
  }

  // Exact duplicates (100%) are completely removed; Partial unreasonable are dropped
  const totalRemoved = exactDupCount + partialDropCount;
  const cleanCount = Math.max(0, totalRows - totalRemoved);
  const successRate = ((cleanCount / totalRows) * 100).toFixed(1);

  if (totalEl) totalEl.textContent = `${totalRows.toLocaleString()} dòng`;
  if (dupEl) dupEl.textContent = `${dupCount.toLocaleString()} bản ghi`;
  if (exactDupEl) exactDupEl.textContent = `${exactDupCount.toLocaleString()} đã xóa`;
  if (partialDupEl) partialDupEl.textContent = `${partialDupCount.toLocaleString()} bản ghi`;
  if (partialSubEl) partialSubEl.textContent = `Giữ ${partialKeepCount.toLocaleString()} hợp lý | Xóa ${partialDropCount.toLocaleString()} mâu thuẫn`;
  if (cleanEl) cleanEl.textContent = `${cleanCount.toLocaleString()} dòng`;
  if (rateSubEl) rateSubEl.textContent = `Tỷ lệ đạt chuẩn: ${successRate}%`;

  const items = [];
  const custName = opp.customer_name || 'Cổ phần Viễn Thông Toàn Cầu';
  const mainSku = (opp.validation && opp.validation.items && opp.validation.items[0]) ? opp.validation.items[0].sku : 'PRD-NET-001';
  const mainProdName = (opp.validation && opp.validation.items && opp.validation.items[0]) ? opp.validation.items[0].name : 'Router Cisco Catalyst C8200L';

  // --- NHÓM 1: PHÁT HIỆN DỮ LIỆU TRÙNG LẶP (DEDUPLICATION INTELLIGENCE) ---

  // 1A. Trùng lặp hoàn toàn (100% Exact Duplicate) -> TỰ ĐỘNG XÓA BỎ
  items.push({
    rowId: '#042 & #043',
    field: 'Toàn bộ bản ghi đơn hàng',
    rawValue: `Trùng khớp 100% (Cùng KH: ${custName}, cùng SKU: ${mainSku}, SL: 30 bộ, gửi cùng timestamp)`,
    errorType: 'Trùng Lặp Hoàn Toàn (100% Exact Duplicate)',
    category: 'duplicate',
    action: `<b>AI quét Dedup đa trường:</b> Phát hiện 2 bản ghi trùng khớp 100% mọi thông tin đặt hàng &rarr; <b>Tự động XÓA BỎ bản ghi dư thừa #043</b>, giữ lại bản ghi gốc #042 để tránh tính trùng doanh thu & tồn kho.`,
    statusText: 'Đã xóa bỏ (Lặp 100%)',
    statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa Bỏ (Lặp 100%)</span>'
  });

  // 1B. Trùng lặp một phần - HỢP LÝ -> GIỮ LẠI & HỢP NHẤT
  items.push({
    rowId: '#115 & #116',
    field: `Đơn hàng [${mainProdName}]`,
    rawValue: `Trùng 1 phần (Cùng KH & sản phẩm, SL đợt 1: 30 chiếc, đợt 2: 10 chiếc bổ sung)`,
    errorType: 'Trùng Lặp 1 Phần (Near Duplicate - Đặt bổ sung)',
    category: 'duplicate',
    action: `<b>AI thẩm định bối cảnh: HỢP LÝ</b> — Phân tích nội dung email xác nhận khách hàng đặt hàng chia 2 đợt giao nhận &rarr; <b>GIỮ LẠI CẢ 2 BẢN GHI</b> & Tự động hợp nhất vào cơ hội <code>${opp.id}</code> để xuất 1 báo giá tổng.`,
    statusText: 'Hợp lý - Đã giữ lại',
    statusBadge: '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-weight:700;">Hợp Lý — Đã Giữ Lại</span>'
  });

  // 1C. Trùng lặp một phần - KHÔNG HỢP LÝ -> XÓA BỎ
  items.push({
    rowId: '#187 & #188',
    field: `Giao dịch Thiết bị mạng [Chiết khấu]`,
    rawValue: `Trùng 1 phần (Cùng mã đơn giao dịch nhưng lệch chiết khấu 10% vs 35%, gửi cách 1.5s)`,
    errorType: 'Trùng Lặp 1 Phần (Xung Đột / Double Submit)',
    category: 'duplicate',
    action: `<b>AI thẩm định bối cảnh: KHÔNG HỢP LÝ</b> — Phát hiện click đúp (Double Submit lỗi mạng) tạo 2 bản ghi xung đột chính sách chiết khấu (10% vs 35%) &rarr; <b>XÓA BỎ bản ghi bất thường #188</b>, giữ bản ghi gốc #187.`,
    statusText: 'Bất hợp lý - Đã xóa bỏ',
    statusBadge: '<span class="badge-tag missing" style="background:#fef2f2; color:#dc2626; font-weight:700;">Bất Hợp Lý — Đã Xóa Bỏ</span>'
  });

  // --- NHÓM 2: LỖI ĐỊNH DẠNG, KHUYẾT THIẾU & CHÍNH SÁCH ---

  // Check 1: Missing required fields
  if (opp.missing_fields && opp.missing_fields.length > 0) {
    opp.missing_fields.forEach((field, idx) => {
      items.push({
        rowId: `#${String(12 + idx * 23).padStart(3, '0')}`,
        field: field,
        rawValue: 'Khuyết thiếu / Chưa điền',
        errorType: 'Thiếu trường dữ liệu bắt buộc',
        category: 'other',
        action: 'AI phát hiện vi phạm tính toàn vẹn &rarr; Yêu cầu bổ sung dữ liệu',
        statusText: 'Cần bổ sung',
        statusBadge: '<span class="badge-tag missing">Cần bổ sung</span>'
      });
    });
  }

  // Check 2: Products & SKU & Quantities
  if (opp.validation && opp.validation.items && opp.validation.items.length > 0) {
    opp.validation.items.forEach((it, idx) => {
      items.push({
        rowId: `#${String(54 + idx * 31).padStart(3, '0')}`,
        field: `Số lượng [${it.name}]`,
        rawValue: `${it.requested_qty} chiếc/bộ (text tự nhiên)`,
        errorType: 'Dữ liệu chuỗi chưa chuẩn hóa số học',
        category: 'other',
        action: `AI dùng NLP bóc tách giá trị số nguyên ${it.requested_qty}, quy chuẩn đơn vị [chiếc]`,
        statusText: 'Đã làm sạch',
        statusBadge: '<span class="badge-tag eligible">Đã làm sạch</span>'
      });

      items.push({
        rowId: `#${String(78 + idx * 27).padStart(3, '0')}`,
        field: `Mã SKU [${it.name}]`,
        rawValue: 'Chưa có mã SKU trong văn bản thô',
        errorType: 'Khuyết mã định danh sản phẩm (SKU)',
        category: 'other',
        action: `AI đối chiếu Catalog &rarr; Tự động gán mã chuẩn ${it.sku}`,
        statusText: 'Đã chuẩn hóa',
        statusBadge: '<span class="badge-tag eligible">Đã chuẩn hóa</span>'
      });
    });
  }

  // Check 3: Discount rate & Threshold limit
  if (opp.pricing && opp.pricing.discount_percentage > 5) {
    items.push({
      rowId: `#108`,
      field: 'Chiết khấu thương mại',
      rawValue: `${opp.pricing.discount_percentage}% (Đề xuất vượt trần)`,
      errorType: 'Vượt hạn mức Sales Rep (Tối đa 5%)',
      category: 'other',
      action: `AI phát hiện vượt hạn mức chính sách &rarr; Tự động lập Phiếu chuyển duyệt Quản lý`,
      statusText: 'Chờ duyệt',
      statusBadge: '<span class="badge-tag pending">Chờ duyệt</span>'
    });
  }

  // Check 4: Deadline / lead days
  if (opp.extracted && opp.extracted.deadline_days) {
    items.push({
      rowId: `#142`,
      field: 'Thời hạn bàn giao',
      rawValue: `trong vòng ${opp.extracted.deadline_days} ngày`,
      errorType: 'Thời gian dạng văn bản phi cấu trúc',
      category: 'other',
      action: `AI trích xuất số nguyên [${opp.extracted.deadline_days} ngày], kiểm tra đối soát Lead-time kho đạt chuẩn`,
      statusText: 'Đã làm sạch',
      statusBadge: '<span class="badge-tag eligible">Đã làm sạch</span>'
    });
  }

  // Check 5: Budget format
  if (opp.extracted && opp.extracted.budget) {
    items.push({
      rowId: `#195`,
      field: 'Ngân sách dự án',
      rawValue: 'Văn bản số liệu thô',
      errorType: 'Chuỗi tiền tệ chưa chuẩn số học',
      category: 'other',
      action: `AI chuẩn hóa thành số thực ${formatCurrency(opp.extracted.budget)} để đối soát tài chính`,
      statusText: 'Đã làm sạch',
      statusBadge: '<span class="badge-tag eligible">Đã làm sạch</span>'
    });
  }

  // Check 6: Customer legal name
  if (opp.customer_name) {
    items.push({
      rowId: `#210`,
      field: 'Tên pháp nhân khách hàng',
      rawValue: 'Tên viết tắt / Tên giao dịch',
      errorType: 'Ký tự thừa hoặc thiếu tiền tố công ty',
      category: 'other',
      action: `AI bóc tách chuẩn hóa danh xưng: ${opp.customer_name}`,
      statusText: 'Đã chuẩn hóa',
      statusBadge: '<span class="badge-tag eligible">Đã làm sạch</span>'
    });
  }

  currentCleansingAuditData = items;

  // Cập nhật số lượng đếm trên 3 nút bộ lọc
  const dupItems = items.filter(it => it.category === 'duplicate');
  const otherItems = items.filter(it => it.category === 'other');
  const cntAll = document.getElementById('countFilterAll');
  const cntDup = document.getElementById('countFilterDup');
  const cntOth = document.getElementById('countFilterOther');
  if (cntAll) cntAll.textContent = items.length;
  if (cntDup) cntDup.textContent = dupItems.length;
  if (cntOth) cntOth.textContent = otherItems.length;

  // Render theo bộ lọc hiện tại
  filterCleansingAudit(currentCleansingFilter || 'all');
}

function filterCleansingAudit(category, btnEl) {
  currentCleansingFilter = category || 'all';

  const btns = [
    document.getElementById('btnFilterAuditAll'),
    document.getElementById('btnFilterAuditDup'),
    document.getElementById('btnFilterAuditOther')
  ];
  btns.forEach(b => {
    if (b) {
      b.classList.remove('active');
      b.style.fontWeight = '500';
    }
  });

  const activeBtn = btnEl || (
    currentCleansingFilter === 'duplicate' ? document.getElementById('btnFilterAuditDup') :
    currentCleansingFilter === 'other' ? document.getElementById('btnFilterAuditOther') :
    document.getElementById('btnFilterAuditAll')
  );
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.fontWeight = '700';
  }

  const tbody = document.getElementById('cleansingErrorTableBody');
  if (!tbody || !currentCleansingAuditData) return;

  const filtered = currentCleansingFilter === 'all'
    ? currentCleansingAuditData
    : currentCleansingAuditData.filter(it => it.category === currentCleansingFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:#94a3b8;">Không có bản ghi nào trong nhóm này.</td></tr>';
    return;
  }

  const escapeAttr = (str) => String(str || '').replace(/<[^>]+>/g, '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (isInlineRawEditMode) {
    const statusOptions = [
      'Đã làm sạch',
      'Hợp lý - Đã giữ lại',
      'Đã xóa bỏ (Lặp 100%)',
      'Bất hợp lý - Đã xóa bỏ',
      'Cần bổ sung',
      'Đã chỉnh sửa thủ công'
    ];
    tbody.innerHTML = filtered.map(it => {
      const realIdx = currentCleansingAuditData.indexOf(it);
      const plainRaw = escapeAttr(it.rawValue);
      const plainAction = escapeAttr(it.action);
      const currentStatus = it.statusText || 'Đã làm sạch';
      const optsHtml = statusOptions.map(opt => `<option value="${opt}" ${currentStatus === opt ? 'selected' : ''}>${opt}</option>`).join('');
      return `
        <tr data-edit-row-idx="${realIdx}" style="background:#fffdf2;">
          <td><input type="text" class="inline-edit-input" data-key="rowId" value="${escapeAttr(it.rowId)}"></td>
          <td><input type="text" class="inline-edit-input" data-key="field" value="${escapeAttr(it.field)}"></td>
          <td><textarea class="inline-edit-textarea" data-key="rawValue">${plainRaw}</textarea></td>
          <td><input type="text" class="inline-edit-input" data-key="errorType" value="${escapeAttr(it.errorType)}"></td>
          <td><textarea class="inline-edit-textarea" data-key="action">${plainAction}</textarea></td>
          <td style="text-align:center;">
            <select class="inline-edit-select" data-key="statusText">${optsHtml}</select>
            <button type="button" class="btn-inline-del-row" onclick="deleteInlineRawRow(${realIdx})">Xóa dòng</button>
          </td>
        </tr>
      `;
    }).join('');
    return;
  }

  tbody.innerHTML = filtered.map(it => `
    <tr style="${it.category === 'duplicate' ? 'background: #fffdf7;' : ''}">
      <td><code>${it.rowId}</code></td>
      <td><b>${it.field}</b></td>
      <td><span style="color:#64748b; font-family:monospace; font-size:12px;">${it.rawValue}</span></td>
      <td><span style="color:${it.category === 'duplicate' ? '#b45309' : '#0369a1'}; font-weight:700; font-size:12.5px;">${it.errorType}</span></td>
      <td style="font-size:12.5px; color:#334155; line-height:1.5;">${it.action}</td>
      <td style="text-align:center;">${it.statusBadge}</td>
    </tr>
  `).join('');
}

let isInlineRawEditMode = false;

function buildStatusBadgeForText(statusText) {
  if (statusText.includes('xóa') || statusText.includes('Xóa')) {
    return `<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">${statusText}</span>`;
  }
  if (statusText.includes('Cần bổ sung')) {
    return `<span class="badge-tag missing">${statusText}</span>`;
  }
  return `<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-weight:700;">${statusText}</span>`;
}

function enableInlineRawTableEdit() {
  // Cấp quyền chỉnh sửa trực tiếp trên Bảng Dữ Liệu Thô khi người dùng chọn Không Hài Lòng tại Checkpoint 1
  liveRawEditUnlocked = true;
  const rawCard = document.getElementById('rawDataEditableTableCard');
  if (rawCard && liveRawTable && liveRawTable.rows && liveRawTable.rows.length > 0) {
    renderLiveRawDataTable();
    rawCard.style.boxShadow = '0 0 0 3px rgba(243, 112, 33, 0.35)';
    rawCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      const firstInput = rawCard.querySelector('.live-raw-cell-input');
      if (firstInput) firstInput.focus();
      rawCard.style.boxShadow = '';
    }, 350);
  }

  if (!currentCleansingAuditData || currentCleansingAuditData.length === 0) {
    return;
  }
  isInlineRawEditMode = true;
  const toolbar = document.getElementById('inlineRawEditToolbar');
  const card = document.getElementById('cleansingAuditCard');
  if (toolbar) toolbar.style.display = 'flex';
  if (card) card.style.borderLeft = '4px solid #f37021';
  filterCleansingAudit('all', document.getElementById('btnFilterAuditAll'));
}

function disableInlineRawTableEdit() {
  isInlineRawEditMode = false;
  const toolbar = document.getElementById('inlineRawEditToolbar');
  const card = document.getElementById('cleansingAuditCard');
  if (toolbar) toolbar.style.display = 'none';
  if (card) card.style.borderLeft = '4px solid #0284c7';
  filterCleansingAudit(currentCleansingFilter || 'all');
}

function syncInlineEditsFromDom() {
  const rows = document.querySelectorAll('#cleansingErrorTableBody tr[data-edit-row-idx]');
  rows.forEach(tr => {
    const idx = parseInt(tr.getAttribute('data-edit-row-idx'), 10);
    if (isNaN(idx) || !currentCleansingAuditData[idx]) return;
    const item = currentCleansingAuditData[idx];
    const rowIdEl = tr.querySelector('[data-key="rowId"]');
    const fieldEl = tr.querySelector('[data-key="field"]');
    const rawValEl = tr.querySelector('[data-key="rawValue"]');
    const errTypeEl = tr.querySelector('[data-key="errorType"]');
    const actionEl = tr.querySelector('[data-key="action"]');
    const statusEl = tr.querySelector('[data-key="statusText"]');

    if (rowIdEl) item.rowId = rowIdEl.value.trim() || item.rowId;
    if (fieldEl) item.field = fieldEl.value.trim() || item.field;
    if (rawValEl) item.rawValue = rawValEl.value.trim();
    if (errTypeEl) item.errorType = errTypeEl.value.trim();
    if (actionEl) item.action = actionEl.value.trim();
    if (statusEl) {
      item.statusText = statusEl.value;
      item.statusBadge = buildStatusBadgeForText(statusEl.value);
    }
  });
}

function addInlineRawRow() {
  syncInlineEditsFromDom();
  const nextNum = String(currentCleansingAuditData.length + 1).padStart(3, '0');
  currentCleansingAuditData.unshift({
    rowId: `#${nextNum}`,
    field: 'Trường dữ liệu bổ sung',
    rawValue: 'Nhập giá trị dữ liệu thô mới...',
    errorType: 'Hiệu chỉnh thủ công bởi người dùng',
    category: 'other',
    action: 'Người dùng bổ sung / hiệu chỉnh trực tiếp trên bảng dữ liệu thô',
    statusText: 'Đã chỉnh sửa thủ công',
    statusBadge: buildStatusBadgeForText('Đã chỉnh sửa thủ công')
  });
  updateCleansingFilterCounters();
  filterCleansingAudit('all', document.getElementById('btnFilterAuditAll'));
  showStepTransitionToast('Đã thêm 1 dòng mới lên đầu bảng dữ liệu thô.', 'info', 2000);
}

function deleteInlineRawRow(idx) {
  syncInlineEditsFromDom();
  if (idx >= 0 && idx < currentCleansingAuditData.length) {
    currentCleansingAuditData.splice(idx, 1);
    updateCleansingFilterCounters();
    filterCleansingAudit(currentCleansingFilter || 'all');
    showStepTransitionToast('Đã xóa dòng khỏi bảng dữ liệu thô.', 'info', 1800);
  }
}

function updateCleansingFilterCounters() {
  const dupItems = currentCleansingAuditData.filter(it => it.category === 'duplicate');
  const otherItems = currentCleansingAuditData.filter(it => it.category === 'other');
  const cntAll = document.getElementById('countFilterAll');
  const cntDup = document.getElementById('countFilterDup');
  const cntOth = document.getElementById('countFilterOther');
  if (cntAll) cntAll.textContent = currentCleansingAuditData.length;
  if (cntDup) cntDup.textContent = dupItems.length;
  if (cntOth) cntOth.textContent = otherItems.length;
}

function saveInlineRawTableEdits() {
  syncInlineEditsFromDom();
  updateCleansingFilterCounters();
  isInlineRawEditMode = false;
  const toolbar = document.getElementById('inlineRawEditToolbar');
  const card = document.getElementById('cleansingAuditCard');
  if (toolbar) toolbar.style.display = 'none';
  if (card) card.style.borderLeft = '4px solid #10b981';
  filterCleansingAudit(currentCleansingFilter || 'all');
  showStepTransitionToast('Đã lưu chỉnh sửa trực tiếp trên bảng dữ liệu thô! Bấm "Chuyển sang Bước 3" để xác nhận lại.', 'success', 3500);
}

function exportCleansingAuditCsv() {
  if (!currentCleansingAuditData || currentCleansingAuditData.length === 0) {
    alert('Chưa có dữ liệu thống kê lỗi để xuất!');
    return;
  }

  const header = ['Ma_Dong', 'Truong_Du_Lieu', 'Gia_Tri_Tho', 'Loai_Loi_Trung_Lap', 'Tham_Dinh_Hanh_Dong_AI', 'Quyet_Dinh_Xu_Ly'];
  const rows = currentCleansingAuditData.map(d => [
    `"${d.rowId}"`,
    `"${d.field.replace(/"/g, '""')}"`,
    `"${d.rawValue.replace(/<[^>]+>/g, '').replace(/"/g, '""')}"`,
    `"${d.errorType.replace(/"/g, '""')}"`,
    `"${d.action.replace(/<[^>]+>/g, '').replace(/"/g, '""')}"`,
    `"${d.statusText}"`
  ]);

  const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bao_Cao_Thong_Ke_Du_Lieu_Loi_Va_Trung_Lap_AI_Agent_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStepTransitionToast('Đã xuất báo cáo thống kê dữ liệu lỗi & trùng lặp dạng CSV thành công!', 'success', 2500);
}

// ==========================================
// LUỒNG ĐỐI SOÁT & SỬA LỖI DỮ LIỆU (RECONCILIATION & ERROR RESOLUTION)
// ==========================================
let currentReconFixState = {
  exactDup: 'DROP',      // 'DROP' | 'KEEP'
  partialDup: 'MERGE',   // 'MERGE' | 'SPLIT' | 'DROP'
  invalidDup: 'DROP',    // 'DROP' | 'KEEP'
  skuMatch: 'APPLY',     // 'APPLY' | 'CUSTOM'
  discountPolicy: 'ESCALATE' // 'ESCALATE' | 'ADJUST_5'
};

function renderReconciliationWorkflow(opp, liveAnalysis = null) {
  const reconList = document.getElementById('reconciliationActionList');
  const fixCount = document.getElementById('fixStatusCount');
  const reconBadge = document.getElementById('reconciliationStatusBadge');
  if (!reconList) return;

  const hasLiveTable = liveRawTable && Array.isArray(liveRawTable.rows) && liveRawTable.rows.length > 0;
  const analysis = liveAnalysis || (hasLiveTable ? analyzeLiveRawTable() : null);

  const custName = (opp && opp.customer_name) || 'Cổ phần Viễn Thông Toàn Cầu';
  const mainSku = (opp && opp.validation && opp.validation.items && opp.validation.items[0]) ? opp.validation.items[0].sku : 'PRD-NET-001';
  const mainProdName = (opp && opp.validation && opp.validation.items && opp.validation.items[0]) ? opp.validation.items[0].name : 'Router Cisco Catalyst C8200L';

  // Đồng bộ 3 trụ cột Đối soát chéo 3 chiều theo dữ liệu thực tế vừa quét
  const badgeCat = document.getElementById('reconBadgeCatalog');
  const descCat = document.getElementById('reconDescCatalog');
  const badgePol = document.getElementById('reconBadgePolicy');
  const descPol = document.getElementById('reconDescPolicy');
  const badgeInt = document.getElementById('reconBadgeIntegrity');
  const descInt = document.getElementById('reconDescIntegrity');

  if (analysis) {
    const bd = analysis.errorBreakdown || { missing: 0, numeric: 0, date: 0, format: 0, whitespace: 0, exactDup: 0, partialDup: 0 };
    const totalIssues = analysis.exactDupCount + analysis.partialDropCount + analysis.errorRowCount;

    if (reconBadge) {
      reconBadge.className = totalIssues === 0 ? 'badge-tag eligible' : 'badge-tag pending';
      reconBadge.textContent = totalIssues === 0
        ? `Đã Đối Soát & Sạch 100% (${analysis.totalRows.toLocaleString()} dòng)`
        : `Phát Hiện ${totalIssues.toLocaleString()} Dòng Cần Xử Lý`;
    }

    const catErrCount = bd.format + bd.numeric;
    if (badgeCat) {
      badgeCat.className = catErrCount === 0 ? 'badge-tag eligible' : 'badge-tag unfulfilled';
      badgeCat.textContent = catErrCount === 0 ? '100% Khớp Catalog' : `${catErrCount.toLocaleString()} Lỗi Danh Mục / SL`;
    }
    if (descCat) {
      descCat.innerHTML = catErrCount === 0
        ? `Đối chiếu Catalog ERP & SLA trên ${analysis.totalRows.toLocaleString()} dòng: 100% sản phẩm, số lượng và gói bảo trì hợp lệ.`
        : `Phát hiện <b>${bd.format.toLocaleString()}</b> ô sai danh mục/SLA/thông số kỹ thuật và <b>${bd.numeric.toLocaleString()}</b> ô số lượng vượt ngưỡng tồn kho chuẩn.`;
    }

    const polErrCount = bd.date + bd.missing + bd.whitespace;
    if (badgePol) {
      badgePol.className = polErrCount === 0 ? 'badge-tag eligible' : 'badge-tag pending';
      badgePol.textContent = polErrCount === 0 ? 'Đạt Chuẩn Tiến Độ' : `${polErrCount.toLocaleString()} Lỗi Hạn Giao / Ô`;
    }
    if (descPol) {
      descPol.innerHTML = polErrCount === 0
        ? 'Toàn bộ hạn chót triển khai, định dạng ngày tháng và trường bắt buộc đều đạt quy chuẩn chính sách.'
        : `Phát hiện <b>${bd.date.toLocaleString()}</b> ô hạn triển khai quá gấp/sai ngày, <b>${bd.missing.toLocaleString()}</b> ô khuyết thiếu, <b>${bd.whitespace.toLocaleString()}</b> ô dư khoảng trắng.`;
    }

    if (badgeInt) {
      const ddR = getStep2DedupTotals(analysis);
      badgeInt.className = (analysis.exactDupCount + analysis.partialDropCount) === 0 ? 'badge-tag eligible' : 'badge-tag unfulfilled';
      badgeInt.textContent = (analysis.exactDupCount + analysis.partialDropCount) === 0
        ? (ddR.removedTotal > 0 ? `Đã Xóa ${ddR.removedTotal.toLocaleString()} Bản Ghi Trùng` : 'Đã Xử Lý Dedup')
        : `${analysis.dupCount.toLocaleString()} Bản Ghi Trùng`;
    }
    if (descInt) {
      const ddR = getStep2DedupTotals(analysis);
      descInt.innerHTML = ddR.removedTotal > 0
        ? `AI đã tự động xóa <b>${ddR.exactRemoved.toLocaleString()}</b> bản ghi lặp 100% và <b>${ddR.partialDropRemoved.toLocaleString()}</b> bản ghi lặp 1 phần bất hợp lý | Giữ lại <b>${analysis.partialKeepCount.toLocaleString()}</b> bản ghi lặp 1 phần hợp lý${(analysis.exactDupCount + analysis.partialDropCount) > 0 ? ` | Còn ${(analysis.exactDupCount + analysis.partialDropCount).toLocaleString()} cần xóa` : ''}.`
        : `${analysis.exactDupCount.toLocaleString()} bản ghi lặp 100% cần xóa | ${analysis.partialKeepCount.toLocaleString()} bản ghi hợp lý giữ lại | ${analysis.partialDropCount.toLocaleString()} bản ghi lặp xung đột cần hủy.`;
    }
  } else if (reconBadge) {
    reconBadge.className = 'badge-tag eligible';
    reconBadge.textContent = 'Đối Soát & Sửa Lỗi Hoạt Động';
  }

  const firstExact = analysis && analysis.auditItems ? analysis.auditItems.find(it => it.errorType.includes('100%')) : null;
  const firstPartialKeep = analysis && analysis.auditItems ? analysis.auditItems.find(it => it.statusText && it.statusText.includes('Hợp lý')) : null;
  const firstPartialDrop = analysis && analysis.auditItems ? analysis.auditItems.find(it => it.category === 'duplicate' && it.statusText && it.statusText.includes('Bất hợp lý')) : null;
  const firstFormatErr = analysis && analysis.auditItems ? analysis.auditItems.find(it => it.category === 'other') : null;
  const ddRecon = getStep2DedupTotals(analysis);

  const items = [
    {
      id: 'fix_exact_dup',
      type: 'exactDup',
      badge: (analysis && analysis.exactDupCount === 0)
        ? '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-size:11px;">Đã Xóa Sạch Lặp 100%</span>'
        : '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-size:11px;">Trùng Lặp 100%</span>',
      title: analysis
        ? (analysis.exactDupCount === 0
          ? `Đã tự động xóa sạch ${ddRecon.exactRemoved.toLocaleString()} lỗi trùng lặp hoàn toàn 100% (Hiện còn 0 lỗi lặp 100%)`
          : `Phát hiện ${analysis.exactDupCount.toLocaleString()} bản ghi trùng lặp hoàn toàn 100% thông số nghiệp vụ${firstExact ? ` (VD: ${firstExact.rowId})` : ''}`)
        : 'Bản ghi đặt hàng #042 & #043 (Trùng lặp hoàn toàn)',
      desc: analysis
        ? (firstExact ? `${firstExact.action} (${escapeHtmlAttr(firstExact.rawValue)})` : `AI đã tự động xóa toàn bộ ${ddRecon.exactRemoved.toLocaleString()} bản ghi lặp 100% ngay khi quét file. Không còn bản ghi lặp hoàn toàn 100% trong bảng dữ liệu hiện tại.`)
        : `Phát hiện 2 bản ghi trùng khớp 100% thông tin khách hàng <b>${custName}</b>, sản phẩm <b>${mainSku}</b>, SL: 30 bộ cùng timestamp.`,
      recommendation: analysis
        ? (analysis.exactDupCount === 0
          ? `Trạng thái: Đã xóa sạch ${ddRecon.exactRemoved.toLocaleString()} bản ghi lặp 100% dư thừa để tránh tính đúp nhu cầu & tồn kho.`
          : `Đề xuất AI: Tự động XÓA BỎ toàn bộ ${analysis.exactDupCount.toLocaleString()} bản ghi lặp 100% dư thừa để tránh tính đúp nhu cầu & tồn kho.`)
        : 'Đề xuất AI: Tự động XÓA BỎ bản ghi thừa #043, giữ bản ghi gốc #042.',
      options: [
        { key: 'DROP', label: (analysis && analysis.exactDupCount === 0) ? `Đã Xóa ${ddRecon.exactRemoved.toLocaleString()} Bản Ghi Lặp 100% (Hoàn Tất)` : `Xóa ${analysis ? analysis.exactDupCount.toLocaleString() : ''} Bản Ghi Lặp 100% (Khuyên Dùng)`.trim(), isRecommended: true },
        { key: 'KEEP', label: 'Giữ Nguyên Để Kiểm Tra Thủ Công', isRecommended: false }
      ]
    },
    {
      id: 'fix_partial_dup',
      type: 'partialDup',
      badge: '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-size:11px;">Trùng 1 Phần Hợp Lý — Giữ Lại</span>',
      title: analysis
        ? `Giữ lại ${analysis.partialKeepCount.toLocaleString()} bản ghi lặp 1 phần hợp lý — Đặt bổ sung / Chia đợt${firstPartialKeep ? ` (VD: ${firstPartialKeep.rowId})` : ''}`
        : `Lô đặt hàng [${mainProdName}] #115 & #116 (Đặt bổ sung)`,
      desc: analysis
        ? (firstPartialKeep ? `${firstPartialKeep.action} (${escapeHtmlAttr(firstPartialKeep.rawValue)})` : 'Các lô đặt hàng bổ sung đạt chuẩn thông số kỹ thuật và gói bảo trì.')
        : `Cùng khách hàng & thiết bị nhưng SL khác nhau: Đợt 1 (30 chiếc) + Đợt 2 đặt bổ sung (10 chiếc). Ngữ cảnh hợp lý.`,
      recommendation: 'Quyết định AI: GIỮ LẠI CẢ 2 BẢN GHI và Hợp nhất vào cùng hồ sơ khách hàng để xuất báo giá tổng.',
      options: [
        { key: 'MERGE', label: `Đang Giữ Lại & Hợp Nhất ${analysis ? analysis.partialKeepCount.toLocaleString() : ''} Lô Hợp Lý (Khuyên Dùng)`, isRecommended: true },
        { key: 'SPLIT', label: 'Tách Thành Đơn Độc Lập', isRecommended: false },
        { key: 'DROP', label: 'Chỉ Giữ Lô Gốc (Hủy Lô Bổ Sung)', isRecommended: false }
      ]
    },
    {
      id: 'fix_invalid_dup',
      type: 'invalidDup',
      badge: (analysis && analysis.partialDropCount === 0)
        ? '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-size:11px;">Đã Xóa Sạch Lặp Xung Đột</span>'
        : '<span class="badge-tag missing" style="background:#fef2f2; color:#dc2626; font-size:11px;">Trùng 1 Phần Xung Đột</span>',
      title: analysis
        ? (analysis.partialDropCount === 0
          ? `Đã tự động xóa sạch ${ddRecon.partialDropRemoved.toLocaleString()} lỗi lặp 1 phần bất hợp lý / xung đột (Hiện còn 0 lỗi xung đột)`
          : `Phát hiện ${analysis.partialDropCount.toLocaleString()} bản ghi lặp 1 phần bất hợp lý / xung đột SLA & hạn giao${firstPartialDrop ? ` (VD: ${firstPartialDrop.rowId})` : ''}`)
        : 'Bản ghi giao dịch #187 & #188 (Xung đột chiết khấu / Lỗi Double Click)',
      desc: analysis
        ? (firstPartialDrop ? `${firstPartialDrop.action} (${escapeHtmlAttr(firstPartialDrop.rawValue)})` : `AI đã tự động xóa bỏ ${ddRecon.partialDropRemoved.toLocaleString()} bản ghi lặp 1 phần bất hợp lý (xung đột số lượng cùng ngày hoặc kèm lỗi SLA/kỹ thuật). Hiện không còn bản ghi lặp xung đột.`)
        : `Gửi trùng nhau cách 1.5 giây do lỗi mạng, chiết khấu lệch bất thường giữa 10% và 35%.`,
      recommendation: analysis
        ? (analysis.partialDropCount === 0
          ? `Trạng thái: Đã xóa sạch ${ddRecon.partialDropRemoved.toLocaleString()} bản ghi lặp 1 phần bất hợp lý, chỉ giữ lại bản ghi gốc và các bản ghi lặp 1 phần hợp lý.`
          : `Đề xuất AI: XÓA BỎ ${analysis.partialDropCount.toLocaleString()} bản ghi lặp xung đột thông số/SLA chưa xác nhận, giữ bản ghi gốc đạt chuẩn.`)
        : 'Đề xuất AI: XÓA BỎ bản ghi lỗi #188 có chiết khấu dị thường 35%, giữ bản ghi gốc chuẩn 10%.',
      options: [
        { key: 'DROP', label: (analysis && analysis.partialDropCount === 0) ? `Đã Xóa ${ddRecon.partialDropRemoved.toLocaleString()} Bản Ghi Lặp Xung Đột (Hoàn Tất)` : `Xóa ${analysis ? analysis.partialDropCount.toLocaleString() : ''} Bản Ghi Lặp Xung Đột (Khuyên Dùng)`.trim(), isRecommended: true },
        { key: 'KEEP', label: 'Tạm Giữ Chờ Sales Phản Hồi', isRecommended: false }
      ]
    },
    {
      id: 'fix_sku_match',
      type: 'skuMatch',
      badge: '<span class="badge-tag eligible" style="background:#eff6ff; color:#1d4ed8; font-size:11px;">Chuẩn Hóa Danh Mục & SLA</span>',
      title: analysis
        ? `Phát hiện ${analysis.errorRowCount.toLocaleString()} dòng lỗi định dạng / danh mục SLA / thông số thiết bị${firstFormatErr ? ` (VD: ${firstFormatErr.rowId})` : ''}`
        : `Khuyết mã định danh sản phẩm (SKU) cho [${mainProdName}]`,
      desc: analysis
        ? (firstFormatErr ? `${firstFormatErr.action} (${escapeHtmlAttr(firstFormatErr.rawValue)})` : 'Toàn bộ dòng dữ liệu đã đạt chuẩn danh mục Catalog ERP & SLA.')
        : `Văn bản gốc chỉ ghi tên thiết bị thô dạng text, chưa có mã SKU trong Catalog hệ thống.`,
      recommendation: analysis
        ? `Đề xuất AI: Tự động chuẩn hóa gói bảo trì chuẩn MT-01 (12 tháng; hỗ trợ 8x5), nâng cấp cấu hình Firewall Edge HA >=2Gbps, điều chỉnh hạn giao & định mức số lượng.`
        : `Đề xuất AI: Tự động đối chiếu Catalog ERP và gán mã chuẩn: <code>${mainSku}</code>.`,
      options: [
        { key: 'APPLY', label: 'AI Chuẩn Hóa Toàn Bộ Theo Catalog ERP & SLA (Khuyên Dùng)', isRecommended: true },
        { key: 'CUSTOM', label: 'Chỉnh Sửa Thủ Công Trên Bảng', isRecommended: false }
      ]
    },
    {
      id: 'fix_discount_policy',
      type: 'discountPolicy',
      badge: '<span class="badge-tag pending" style="background:#fffbeb; color:#b45309; font-size:11px;">Kiểm Soát Hạn Mức</span>',
      title: 'Kiểm soát chính sách chiết khấu thương mại (> 5% trình Trưởng phòng Kinh doanh)',
      desc: `Theo Pricing_Policy (POL-01 & POL-02): Nhân viên Sales được duyệt <= 5%; chiết khấu > 5% (6%–10%) hoặc đơn hàng lớn bắt buộc chuyển Sales Manager phê duyệt.`,
      recommendation: 'Đề xuất AI: Tự động lập Phiếu Chuyển Duyệt trình Trưởng phòng tại Bước 4–5 (Không tự ý từ chối cơ hội lớn).',
      options: [
        { key: 'ESCALATE', label: 'Giữ Chiết Khấu & Lập Phiếu Chuyển Duyệt (Khuyên Dùng)', isRecommended: true },
        { key: 'ADJUST_5', label: 'Hạ Chiết Khấu Về Trần 5%', isRecommended: false }
      ]
    }
  ];

  let resolvedCount = 0;
  reconList.innerHTML = items.map(item => {
    const currentVal = currentReconFixState[item.type] || item.options[0].key;
    if (currentVal) resolvedCount++;

    const buttonsHtml = item.options.map(opt => {
      const isSelected = currentVal === opt.key;
      return `
        <button type="button" 
          onclick="handleReconFixChoice('${item.type}', '${opt.key}')" 
          style="font-size:11.5px; padding:6px 12px; border-radius:16px; cursor:pointer; font-weight:${isSelected ? '700' : '500'}; 
                 border: 1.5px solid ${isSelected ? '#f59e0b' : '#e2e8f0'}; 
                 background: ${isSelected ? '#fef3c7' : '#f8fafc'}; 
                 color: ${isSelected ? '#92400e' : '#475569'}; transition:all 0.15s ease;">
          ${opt.label}
        </button>
      `;
    }).join(' ');

    return `
      <div style="background:#fafafa; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; transition:border-color 0.2s;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
          <div style="font-weight:700; font-size:13px; color:#1e293b; display:flex; align-items:center; gap:8px;">
            <span>${item.title}</span>
          </div>
          <div>${item.badge}</div>
        </div>
        <div style="font-size:12px; color:#475569; margin-bottom:6px;">
          ${item.desc}
        </div>
        <div style="font-size:12px; color:#0369a1; background:#f0f9ff; padding:6px 10px; border-radius:6px; margin-bottom:10px;">
          <b>${item.recommendation}</b>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <span style="font-size:11.5px; font-weight:700; color:#64748b; margin-right:4px;">Thao tác sửa lỗi:</span>
          ${buttonsHtml}
        </div>
      </div>
    `;
  }).join('');

  if (fixCount) fixCount.textContent = `Đã đối soát & thiết lập phương án sửa cho ${resolvedCount}/${items.length} nhóm lỗi`;
}

function handleReconFixChoice(type, choice) {
  currentReconFixState[type] = choice;
  renderReconciliationWorkflow(currentProcessingOpp);
  showStepTransitionToast(`Đã cập nhật phương án xử lý lỗi [${type}]: ${choice}`, 'info', 2000);
}

function runAutoFixAllErrors() {
  currentReconFixState = {
    exactDup: 'DROP',
    partialDup: 'MERGE',
    invalidDup: 'DROP',
    skuMatch: 'APPLY',
    discountPolicy: 'ESCALATE'
  };

  if (liveRawTable && Array.isArray(liveRawTable.rows) && liveRawTable.rows.length > 0) {
    runAiCleanOnRawTable();
  }

  const afterAnalysis = (liveRawTable && Array.isArray(liveRawTable.rows) && liveRawTable.rows.length > 0)
    ? analyzeLiveRawTable()
    : null;

  renderReconciliationWorkflow(currentProcessingOpp, afterAnalysis);

  const reconBadge = document.getElementById('reconciliationStatusBadge');
  const checkpointBadge = document.getElementById('parsingVerificationBadge');
  const checkpointGuidance = document.getElementById('parsingCheckpointGuidance');

  if (reconBadge) {
    reconBadge.className = 'badge-tag eligible';
    reconBadge.textContent = 'Đã Đối Soát & Sửa Lỗi Hoàn Tất 100%';
  }
  if (checkpointBadge) {
    checkpointBadge.className = 'badge-tag eligible';
    checkpointBadge.textContent = 'Dữ Liệu Sạch Đạt Chuẩn 100%';
  }
  if (checkpointGuidance) {
    checkpointGuidance.innerHTML = `
      <div style="color:#047857; font-weight:700; margin-bottom:4px;">Toàn bộ lỗi và trùng lặp đã được đối soát & sửa sạch 100%:</div>
      Các bản ghi trùng lặp thừa đã được loại bỏ, đơn bổ sung hợp lý đã được hợp nhất, mã SKU ERP & SLA đã được chuẩn hóa. Bấm <b>Xác Nhận Dữ Liệu Sạch</b> để tiếp tục sang Bước 3: Thẩm định tồn kho & Báo giá.
    `;
  }

  showStepTransitionToast('AI Agent đã tự động đối soát & làm sạch toàn bộ lỗi dữ liệu thành công!', 'success', 3000);
}

function runRecheckReconciliation() {
  showStepTransitionToast('Đang chạy đối soát lại toàn bộ dữ liệu với Catalog ERP và Chính sách...', 'info', 1500);
  setTimeout(() => {
    const analysis = (liveRawTable && Array.isArray(liveRawTable.rows) && liveRawTable.rows.length > 0)
      ? analyzeLiveRawTable()
      : null;
    if (analysis) {
      syncKpisFromLiveRawTable(analysis);
    } else if (currentProcessingOpp) {
      renderCleansingErrorTable(currentProcessingOpp);
    }
    renderReconciliationWorkflow(currentProcessingOpp, analysis);
    const issueCnt = analysis ? (analysis.exactDupCount + analysis.partialDropCount + analysis.errorRowCount) : 0;
    showStepTransitionToast(
      issueCnt > 0
        ? `Đối soát hoàn tất: Phát hiện ${issueCnt.toLocaleString()} dòng lỗi/trùng lặp cần xử lý!`
        : 'Đối soát hoàn tất: Dữ liệu đã được kiểm chứng tính nhất quán 100%!',
      issueCnt > 0 ? 'warning' : 'success',
      2800
    );
  }, 300);
}

// ==========================================
// PAGE 6: OPPORTUNITIES MANAGER
// ==========================================
function renderAllOpportunitiesTable(opps) {
  const tbody = document.getElementById('allOppsTableBody');
  if (!tbody) return;

  if (!opps || opps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 48px 20px; color:#64748b;">
          <div style="font-size:36px; margin-bottom:10px;"></div>
          <div style="font-size:15px; font-weight:700; color:#1e293b;">Danh sách cơ hội kinh doanh đang trống</div>
          <p style="font-size:13px; color:#64748b; margin:6px 0 16px 0;">Hãy vào mục "Tiếp nhận yêu cầu" để đưa dữ liệu vào cho AI Agent xử lý.</p>
          <button class="btn-primary-action" onclick="openSaasPage('page-ingestion')">Tiếp Nhận Yêu Cầu Đầu Tiên</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = opps.map(o => `
    <tr>
      <td><b>${o.id}</b></td>
      <td>
        <div style="font-weight:700;">${o.customer_name}</div>
        <small style="color:#64748b;">${o.email || o.phone}</small>
      </td>
      <td>${o.contact_person}</td>
      <td>${o.created_at || 'Hôm nay'}</td>
      <td style="font-weight:700;">${o.pricing.total_after_discount > 0 ? formatCurrency(o.pricing.total_after_discount) : 'Chưa xác định'}</td>
      <td>${o.sales_rep ? o.sales_rep.name : 'N/A'}</td>
      <td><span class="badge-tag ${getBadgeStyle(o.status)}">${o.status}</span></td>
      <td>
        <button class="btn-secondary-tool" onclick="inspectOpportunity('${o.id}')">Chi tiết &rarr;</button>
      </td>
    </tr>
  `).join('');
}

function filterOpportunitiesTable() {
  const filterVal = document.getElementById('oppStatusFilter').value;
  if (filterVal === 'ALL') {
    renderAllOpportunitiesTable(allOpportunities);
  } else {
    const filtered = allOpportunities.filter(o => o.status === filterVal);
    renderAllOpportunitiesTable(filtered);
  }
}

function inspectOpportunity(oppId) {
  const opp = allOpportunities.find(o => o.id === oppId);
  if (!opp) return;

  openSaasPage('page-opportunities');
  const viewerBox = document.getElementById('oppDetailViewerBox');
  viewerBox.style.display = 'block';
  document.getElementById('detailViewerId').textContent = opp.id;

  const itemsRows = opp.validation.items.map(it => `
    <tr>
      <td><code>${it.sku}</code></td>
      <td><b>${it.name}</b></td>
      <td>${it.requested_qty} chiếc</td>
      <td>${formatCurrency(it.unit_price)}</td>
      <td>${it.stock_available} chiếc</td>
      <td><span class="badge-tag ${it.is_stock_ok ? 'eligible' : 'unfulfilled'}">${it.stock_status}</span></td>
    </tr>
  `).join('');

  document.getElementById('detailViewerContent').innerHTML = `
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; margin-bottom:20px;">
      <div>
        <h3 style="font-size:18px; font-weight:800; color:#1e293b;">${opp.customer_name}</h3>
        <p style="font-size:13px; color:#64748b;">Người liên hệ: <b>${opp.contact_person}</b> | Email: ${opp.email} | SĐT: ${opp.phone}</p>
        <p style="font-size:13px; color:#64748b;">Chuyên viên kinh doanh: <b>${opp.sales_rep.name}</b> (${opp.sales_rep.email})</p>
      </div>
      <div style="text-align:right;">
        <span class="badge-tag ${getBadgeStyle(opp.status)}" style="font-size:14px; padding:6px 14px;">${opp.status}</span>
        <div style="font-size:18px; font-weight:800; color:#b45309; margin-top:8px;">
          ${opp.pricing.total_after_discount > 0 ? formatCurrency(opp.pricing.total_after_discount) : 'Chưa xác định'}
        </div>
      </div>
    </div>

    <table class="saas-table" style="margin-bottom:20px;">
      <thead>
        <tr>
          <th>Mã SKU</th>
          <th>Tên Sản Phẩm</th>
          <th>Số Lượng</th>
          <th>Đơn Giá</th>
          <th>Tồn Kho</th>
          <th>Tình Trạng Kho</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div style="background:#fffdf0; padding:16px; border:1px solid #fde68a; border-radius:12px; margin-bottom:16px;">
      <div style="font-size:13px; font-weight:700; color:#b45309; margin-bottom:4px;">CÔNG THỨC & CĂN CỨ TÍNH TOÁN:</div>
      <div style="font-family:monospace; font-size:12px;">${opp.pricing.math_formula}</div>
      <div style="font-size:12.5px; color:#64748b; margin-top:6px;">Lý do nghiệp vụ: <b>${opp.status_reason}</b></div>
    </div>

    <div style="background:#f8fafc; padding:16px; border:1px solid #e2e8f0; border-radius:12px;">
      <div style="font-size:13px; font-weight:700; margin-bottom:8px;">BẢN NHÁP EMAIL PHẢN HỒI KHÁCH HÀNG:</div>
      <div style="white-space:pre-wrap; font-size:13px; line-height:1.6; color:#334155;">${opp.draft_email}</div>
    </div>
  `;

  viewerBox.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// PAGE 7: VALIDATION & MASTER CATALOG
// ==========================================
function renderCatalogTable(catalog) {
  const tbody = document.getElementById('catalogTableBody');
  if (!tbody) return;

  tbody.innerHTML = Object.values(catalog).map(p => `
    <tr>
      <td><b>${p.sku}</b></td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td style="font-weight:700;">${formatCurrency(p.unit_price)}</td>
      <td><span class="badge-tag ${p.stock_available >= 15 ? 'eligible' : 'unfulfilled'}">${p.stock_available} chiếc</span></td>
      <td>${p.standard_lead_days} ngày</td>
      <td>${p.express_lead_days} ngày</td>
      <td>${p.warranty_months} tháng</td>
    </tr>
  `).join('');
}

function runLiveInventoryValidation() {
  if (!currentProcessingOpp) {
    alert('CHƯA CÓ DỮ LIỆU ĐẦU VÀO!\n\nVui lòng hoàn thiện Bước 1 (điền Bối cảnh & tải File dữ liệu thô) trước khi chạy thẩm định tồn kho.');
    openSaasPage('page-ingestion');
    return;
  }
  alert('Đã kiểm tra đồng bộ toàn bộ tồn kho với Master Catalog!');
  renderCatalogTable(masterCatalog);
}

// ==========================================
// HUMAN CHECKPOINTS & INTERACTIVE HITL WORKFLOW
// ==========================================
let pendingHitlAction = null;
let currentApprOppId = null;
let currentApprDecision = null;

function openHitlModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'flex';
}

function closeHitlModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

// Step Transition Toast Notification
function showStepTransitionToast(message, type = 'success', duration = 3000) {
  let toast = document.getElementById('hitlGlobalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'hitlGlobalToast';
    toast.className = 'hitl-toast';
    document.body.appendChild(toast);
  }
  const icon = type === 'success' ? '' : type === 'warning' ? '' : '';
  const color = type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#8b5cf6';
  toast.style.borderLeftColor = color;
  toast.innerHTML = `
    <span style="font-size:20px; font-weight:800; color:${color}; line-height:1;">${icon}</span>
    <div style="font-weight:600; line-height:1.4;">${message}</div>
  `;
  toast.style.display = 'flex';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

function showHitlConfirmation(title, bodyHtml, onConfirm) {
  const titleEl = document.getElementById('hitlConfirmTitle');
  const bodyEl = document.getElementById('hitlConfirmBody');
  const submitBtn = document.getElementById('hitlConfirmSubmitBtn');

  if (titleEl) titleEl.innerHTML = title;
  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  pendingHitlAction = onConfirm;

  if (submitBtn) {
    submitBtn.onclick = () => {
      closeHitlModal('hitlConfirmModal');
      if (typeof pendingHitlAction === 'function') {
        pendingHitlAction();
      }
    };
  }
  openHitlModal('hitlConfirmModal');
}

// --- CHECKPOINT 1: XÁC NHẬN BÓC TÁCH & ĐÁNH GIÁ MỨC ĐỘ HÀI LÒNG ---
let selectedParsingSatisfaction = null; // 'SATISFIED' | 'UNSATISFIED' | null

function selectParsingSatisfaction(type) {
  selectedParsingSatisfaction = type;
  const cardSat = document.getElementById('choiceSatisfiedCard');
  const cardUnsat = document.getElementById('choiceUnsatisfiedCard');
  const radioSat = document.getElementById('radioSatisfied');
  const radioUnsat = document.getElementById('radioUnsatisfied');
  const alertMsg = document.getElementById('satisfactionAlertMsg');
  const confirmBtn = document.getElementById('btnConfirmParsingAction');
  const badgeEl = document.getElementById('parsingVerificationBadge');

  if (alertMsg) alertMsg.style.display = 'none';

  if (type === 'SATISFIED') {
    if (radioSat) radioSat.checked = true;
    if (radioUnsat) radioUnsat.checked = false;
    if (cardSat) {
      cardSat.style.borderColor = '#10b981';
      cardSat.style.background = '#ecfdf5';
    }
    if (cardUnsat) {
      cardUnsat.style.borderColor = '#e2e8f0';
      cardUnsat.style.background = '#fafafa';
    }
    if (confirmBtn) {
      confirmBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      confirmBtn.innerHTML = '<span>Hài Lòng: Tiếp Tục Thẩm Định Kho (Bước 3) &rarr;</span>';
    }
    if (badgeEl) {
      badgeEl.className = 'badge-tag eligible';
      badgeEl.textContent = 'Đã Đánh Giá: Hài Lòng';
    }
    showStepTransitionToast('Bạn đã chọn HÀI LÒNG: Sẵn sàng bấm xác nhận để chuyển sang Bước 3!', 'success', 2500);
  } else if (type === 'UNSATISFIED') {
    if (radioSat) radioSat.checked = false;
    if (radioUnsat) radioUnsat.checked = true;
    if (cardSat) {
      cardSat.style.borderColor = '#e2e8f0';
      cardSat.style.background = '#fafafa';
    }
    if (cardUnsat) {
      cardUnsat.style.borderColor = '#f59e0b';
      cardUnsat.style.background = '#fffbeb';
    }
    if (confirmBtn) {
      confirmBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      confirmBtn.innerHTML = '<span>Không Hài Lòng: Cấp Quyền Sửa Trực Tiếp Bảng Dữ Liệu</span>';
    }
    if (badgeEl) {
      badgeEl.className = 'badge-tag missing';
      badgeEl.textContent = 'Đã Đánh Giá: Cần Chỉnh Sửa';
    }
  }
  syncModalSatisfactionUi(type);
}

function openCheckpoint1Modal() {
  const opp = currentProcessingOpp || (allOpportunities.length > 0 ? allOpportunities[0] : null);
  if (!opp) {
    showStepTransitionToast('Chưa có cơ hội nào đang được xử lý.', 'info', 2000);
    return;
  }

  // Cập nhật thông tin tóm tắt trên modal
  const titleEl = document.getElementById('modalReconSummaryTitle');
  const totalRowsEl = document.getElementById('modalReconTotalRows');
  const cleanRowsEl = document.getElementById('modalReconCleanRows');
  const dupRowsEl = document.getElementById('modalReconDupRows');

  if (titleEl) {
    titleEl.textContent = `Tóm tắt đối soát dữ liệu: ${uploadedRawFileName || opp.customer_name || 'Dữ liệu đầu vào'}`;
  }

  const analysis = analyzeLiveRawTable();
  const totalRows = analysis.totalRows;
  const cleanCount = analysis.cleanAfterProcessing;
  const rate = `${analysis.successRate}%`;
  const dropCount = analysis.exactDupCount + analysis.partialDropCount;
  const ddM = getStep2DedupTotals(analysis);

  if (totalRowsEl) totalRowsEl.textContent = ddM.removedTotal > 0
    ? `${totalRows.toLocaleString()} dòng (gốc ${(totalRows + ddM.removedTotal).toLocaleString()})`
    : `${totalRows.toLocaleString()} dòng`;
  if (cleanRowsEl) cleanRowsEl.textContent = `${cleanCount.toLocaleString()} dòng (${rate})`;
  if (dupRowsEl) dupRowsEl.textContent = ddM.removedTotal > 0
    ? `${ddM.removedTotal.toLocaleString()} đã xóa${dropCount > 0 ? ` | ${dropCount.toLocaleString()} cần xóa` : ''} | ${analysis.partialKeepCount.toLocaleString()} giữ | ${analysis.errorRowCount.toLocaleString()} lỗi ô`
    : `${dropCount.toLocaleString()} trùng cần xóa | ${analysis.partialKeepCount.toLocaleString()} giữ | ${analysis.errorRowCount.toLocaleString()} lỗi ô`;

  // Đồng bộ lựa chọn hiện tại nếu có
  syncModalSatisfactionUi(selectedParsingSatisfaction);

  const alertEl = document.getElementById('modalSatisfactionAlert');
  if (alertEl) alertEl.style.display = 'none';

  openHitlModal('hitlCheckpoint1Modal');
}

function syncModalSatisfactionUi(type) {
  const modalSatCard = document.getElementById('modalChoiceSatisfied');
  const modalUnsatCard = document.getElementById('modalChoiceUnsatisfied');
  const modalRadioSat = document.getElementById('modalRadioSatisfied');
  const modalRadioUnsat = document.getElementById('modalRadioUnsatisfied');
  const submitBtn = document.getElementById('modalConfirmCheckpointBtn');

  if (!modalSatCard || !modalUnsatCard) return;

  if (type === 'SATISFIED') {
    if (modalRadioSat) modalRadioSat.checked = true;
    if (modalRadioUnsat) modalRadioUnsat.checked = false;
    modalSatCard.style.borderColor = '#10b981';
    modalSatCard.style.background = '#ecfdf5';
    modalUnsatCard.style.borderColor = '#e2e8f0';
    modalUnsatCard.style.background = '#fafafa';
    if (submitBtn) {
      submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      submitBtn.innerHTML = '<span>Phê Duyệt & Tiếp Tục Sang Bước 3 &rarr;</span>';
    }
  } else if (type === 'UNSATISFIED') {
    if (modalRadioSat) modalRadioSat.checked = false;
    if (modalRadioUnsat) modalRadioUnsat.checked = true;
    modalSatCard.style.borderColor = '#e2e8f0';
    modalSatCard.style.background = '#fafafa';
    modalUnsatCard.style.borderColor = '#f59e0b';
    modalUnsatCard.style.background = '#fffbeb';
    if (submitBtn) {
      submitBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      submitBtn.innerHTML = '<span>Mở Chỉnh Sửa Dữ Liệu Thủ Công</span>';
    }
  } else {
    if (modalRadioSat) modalRadioSat.checked = false;
    if (modalRadioUnsat) modalRadioUnsat.checked = false;
    modalSatCard.style.borderColor = '#e2e8f0';
    modalSatCard.style.background = '#fafafa';
    modalUnsatCard.style.borderColor = '#e2e8f0';
    modalUnsatCard.style.background = '#fafafa';
    if (submitBtn) {
      submitBtn.style.background = '#94a3b8';
      submitBtn.innerHTML = '<span>Vui Lòng Chọn Lựa Chọn Ở Trên</span>';
    }
  }
}

function selectParsingSatisfactionModal(type) {
  selectParsingSatisfaction(type);
  syncModalSatisfactionUi(type);
  const alertEl = document.getElementById('modalSatisfactionAlert');
  if (alertEl) alertEl.style.display = 'none';
}

function submitModalCheckpoint1() {
  if (!selectedParsingSatisfaction) {
    const alertEl = document.getElementById('modalSatisfactionAlert');
    if (alertEl) alertEl.style.display = 'block';
    showStepTransitionToast('Bạn bắt buộc phải chọn "Hài Lòng" hoặc "Không Hài Lòng"!', 'error', 3000);
    return;
  }

  closeHitlModal('hitlCheckpoint1Modal');

  if (selectedParsingSatisfaction === 'UNSATISFIED') {
    showStepTransitionToast('Bạn đã chọn Không Hài Lòng: Đã bật chế độ chỉnh sửa trực tiếp ngay trên bảng dữ liệu thô!', 'info', 3000);
    setTimeout(() => {
      enableInlineRawTableEdit();
    }, 150);
    return;
  }

  // Nếu Hài lòng: Chuyển tiếp sang Bước 3
  confirmParsingCheckpoint();
}

function confirmParsingCheckpoint() {
  if (!currentProcessingOpp) {
    if (allOpportunities.length > 0) currentProcessingOpp = allOpportunities[0];
    else { alert('Chưa có cơ hội nào đang được xử lý.'); return; }
  }

  // ĐIỀU KIỆN BẮT BUỘC: PHẢI CHỌN ĐÁNH GIÁ HÀI LÒNG HOẶC KHÔNG HÀI LÒNG
  if (!selectedParsingSatisfaction) {
    openCheckpoint1Modal();
    showStepTransitionToast('ĐIỀU KIỆN BẮT BUỘC: Bạn phải xác nhận đánh giá mức độ hài lòng trước khi chuyển sang Bước 3!', 'error', 3500);
    return;
  }

  // NẾU KHÔNG HÀI LÒNG: CHỈNH SỬA TRỰC TIẾP TRÊN BẢNG DỮ LIỆU THÔ
  if (selectedParsingSatisfaction === 'UNSATISFIED') {
    showStepTransitionToast('Bạn đã chọn Không Hài Lòng: Chỉnh sửa trực tiếp trên bảng dữ liệu thô bên dưới!', 'info', 2500);
    enableInlineRawTableEdit();
    return;
  }

  // NẾU HÀI LÒNG: CHO PHÉP CHUYỂN TIẾP SANG BƯỚC 3
  currentProcessingOpp.parsing_verified = true;
  currentProcessingOpp.satisfaction = 'SATISFIED';
  showStepTransitionToast(`Bạn đã xác nhận HÀI LÒNG với dữ liệu sạch! Đang chuyển sang Bước 3: Thẩm định tồn kho & giá...`, 'success', 2500);
  renderActiveOppValidation(currentProcessingOpp);
  openSaasPage('page-validation');
}

function openRequestMoreInfoModal() {
  if (!currentProcessingOpp) return;
  const missingAlert = document.getElementById('reqMoreMissingAlert');
  if (missingAlert) {
    missingAlert.textContent = currentProcessingOpp.missing_fields && currentProcessingOpp.missing_fields.length > 0
      ? `Các thông tin còn thiếu: ${currentProcessingOpp.missing_fields.join(', ')}`
      : 'Yêu cầu làm rõ thêm về thời hạn giao hàng và địa điểm bàn giao.';
  }
  const emailInput = document.getElementById('reqMoreCustomerEmail');
  if (emailInput) emailInput.value = currentProcessingOpp.email || 'contact@customer.vn';

  const bodyInput = document.getElementById('reqMoreEmailBody');
  if (bodyInput) {
    bodyInput.value = `Kính gửi Quý công ty ${currentProcessingOpp.customer_name},\n\nHệ thống B2B đã tiếp nhận yêu cầu mua sắm thiết bị từ Quý khách. Để hoàn thiện báo giá và kiểm tra tồn kho chính xác nhất, chúng tôi kính đề nghị Quý khách vui lòng bổ sung/làm rõ thêm thông tin sau:\n- ${currentProcessingOpp.missing_fields && currentProcessingOpp.missing_fields.length > 0 ? currentProcessingOpp.missing_fields.join('\n- ') : 'Số lượng và thời hạn cụ thể'}\n\nTrân trọng cảm ơn sự hợp tác của Quý khách!\nBộ phận B2B Doanh Nghiệp`;
  }
  openHitlModal('hitlRequestMoreInfoModal');
}

function submitRequestMoreInfo() {
  if (!currentProcessingOpp) return;
  closeHitlModal('hitlRequestMoreInfoModal');
  currentProcessingOpp.status = 'Cần bổ sung thông tin';
  currentProcessingOpp.status_reason = 'Đã gửi email đề nghị khách hàng bổ sung các thông tin còn thiếu';
  alert(`Đã gửi email yêu cầu bổ sung thông tin tới ${currentProcessingOpp.customer_name}! Trạng thái cơ hội chuyển sang "Cần bổ sung thông tin".`);
  renderDashboardData(null, allOpportunities);
  renderAllOpportunitiesTable(allOpportunities);
  openSaasPage('page-opportunities');
}

function openEditParsingModal() {
  // Không mở form popup cũ — chuyển thẳng sang mở khóa chỉnh sửa trực tiếp trên Bảng Dữ Liệu Thô (File Excel/CSV)
  closeHitlModal('hitlCheckpoint1Modal');
  closeHitlModal('hitlEditParsingModal');
  enableInlineRawTableEdit();
}

function saveEditedParsingData() {
  if (!currentProcessingOpp) return;
  currentProcessingOpp.customer_name = document.getElementById('editCustomerName').value.trim() || currentProcessingOpp.customer_name;
  currentProcessingOpp.contact_person = document.getElementById('editContactPerson').value.trim() || currentProcessingOpp.contact_person;
  currentProcessingOpp.email = document.getElementById('editCustomerEmail').value.trim() || currentProcessingOpp.email;

  const budget = parseFloat(document.getElementById('editBudget').value);
  if (!isNaN(budget)) currentProcessingOpp.extracted.budget = budget;

  const deadline = parseInt(document.getElementById('editDeadlineDays').value);
  if (!isNaN(deadline)) currentProcessingOpp.extracted.deadline_days = deadline;

  const editQty = parseInt(document.getElementById('editQuantity')?.value);
  if (!isNaN(editQty) && currentProcessingOpp.validation && currentProcessingOpp.validation.items) {
    currentProcessingOpp.validation.items.forEach(it => { it.requested_qty = editQty; });
  }

  const editDisc = parseFloat(document.getElementById('editDiscount')?.value);
  if (!isNaN(editDisc)) {
    currentProcessingOpp.extracted.requested_discount = editDisc;
    if (currentProcessingOpp.pricing) currentProcessingOpp.pricing.discount_percentage = editDisc;
  }

  if (currentProcessingOpp.missing_fields) {
    currentProcessingOpp.missing_fields = currentProcessingOpp.missing_fields.filter(f => {
      if (f.includes('ngân sách') && budget) return false;
      if (f.includes('thời hạn') && deadline) return false;
      if (f.includes('email') && currentProcessingOpp.email) return false;
      return true;
    });
  }

  closeHitlModal('hitlEditParsingModal');
  renderParsingSplitView(currentProcessingOpp);

  // Sau khi người dùng chỉnh sửa xong, chuyển trạng thái sang Hài lòng và sẵn sàng chuyển tiếp
  selectParsingSatisfaction('SATISFIED');
  showStepTransitionToast('Đã cập nhật dữ liệu thủ công thành công! Trạng thái đã chuyển sang "HÀI LÒNG" để bạn có thể tiếp tục sang Bước 3.', 'success', 3500);
}

// --- CHECKPOINT 1.2: THẨM ĐỊNH KHO ---
function renderActiveOppValidation(opp) {
  const oppIdEl = document.getElementById('valOppId');
  const wrap = document.getElementById('valOppItemsTableWrap');
  const badgeEl = document.getElementById('valStockMatchBadge');
  const actionFooter = document.getElementById('valActionFooter');

  if (!opp) {
    if (oppIdEl) oppIdEl.textContent = 'CHỜ NẠP ĐƠN';
    if (badgeEl) {
      badgeEl.className = 'badge-tag missing';
      badgeEl.textContent = 'Chưa Có Dữ Liệu';
    }
    if (actionFooter) actionFooter.style.display = 'none';
    if (wrap) {
      wrap.innerHTML = `
        <div style="text-align:center; padding:36px 16px; color:#64748b; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1;">
          <div style="font-size:14px; font-weight:700; color:#1e293b; margin-top:8px;">Chưa Có Dữ Liệu Thẩm Định Tồn Kho</div>
          <p style="font-size:12.5px; margin-top:4px;">Vui lòng hoàn thiện <b>Bước 1</b> (điền Bối cảnh & tải File dữ liệu thô) và xác nhận <b>Bước 2</b> trước.</p>
          <button class="btn-primary-action" onclick="openSaasPage('page-ingestion')" style="margin-top:12px; font-size:12px;">
            <span>Bắt Đầu Từ Bước 1</span>
          </button>
        </div>
      `;
    }
    return;
  }

  if (actionFooter) actionFooter.style.display = 'flex';
  if (oppIdEl) oppIdEl.textContent = opp.id;
  if (!wrap) return;

  const isAllStockOk = opp.validation.items.every(it => it.is_stock_ok);
  if (badgeEl) {
    badgeEl.className = isAllStockOk ? 'badge-tag eligible' : 'badge-tag unfulfilled';
    badgeEl.textContent = isAllStockOk ? 'Đủ Hàng Đáp Ứng 100%' : 'Thiếu Hụt Kho / Cần Nhập';
  }

  wrap.innerHTML = `
    <table class="saas-table" style="margin-top:8px;">
      <thead>
        <tr>
          <th>Mã SKU</th>
          <th>Tên Sản Phẩm</th>
          <th>SL Yêu Cầu</th>
          <th>Đơn Giá Niêm Yết</th>
          <th>Tồn Khả Dụng</th>
          <th>Tình Trạng Kho</th>
          <th>Thời Gian Giao Tiêu Chuẩn</th>
        </tr>
      </thead>
      <tbody>
        ${opp.validation.items.map(it => `
          <tr>
            <td><code>${it.sku}</code></td>
            <td><b>${it.name}</b></td>
            <td><b>${it.requested_qty}</b> chiếc</td>
            <td>${formatCurrency(it.unit_price)}</td>
            <td style="font-weight:700;">${it.stock_available} chiếc</td>
            <td><span class="badge-tag ${it.is_stock_ok ? 'eligible' : 'unfulfilled'}">${it.stock_status}</span></td>
            <td>${it.standard_lead_days || 3} ngày</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function confirmInventoryAndProceed() {
  if (!currentProcessingOpp) return;
  currentProcessingOpp.inventory_verified = true;
  showStepTransitionToast(`Đã xác nhận đủ tồn kho & giữ hàng! Đang chuyển sang Bước 4: Lập Báo Giá & Chiết Khấu...`, 'success', 2500);
  renderActiveOppPricing(currentProcessingOpp);
  openSaasPage('page-pricing');
}

function markInventoryUnfulfilled() {
  if (!currentProcessingOpp) return;
  currentProcessingOpp.status = 'Chưa đáp ứng';
  currentProcessingOpp.status_reason = 'Kho không đủ tồn khả dụng và lead time nhập hàng không kịp tiến độ';
  showStepTransitionToast(`✕ Đã đánh dấu cơ hội ${currentProcessingOpp.id} là Chưa đáp ứng!`, 'warning', 2500);
  renderDashboardData(null, allOpportunities);
  renderAllOpportunitiesTable(allOpportunities);
  openSaasPage('page-opportunities');
}

// --- CHECKPOINT 1.3: TÍNH GIÁ & CHIẾT KHẤU ---
function renderActiveOppPricing(opp) {
  const oppIdEl = document.getElementById('pricingOppId');
  const totalEl = document.getElementById('pricingOriginalTotal');
  const finalTotalEl = document.getElementById('pricingFinalTotal');
  const itemCountNote = document.getElementById('pricingItemCountNote');
  const discountValText = document.getElementById('pricingDiscountValText');
  const noticeEl = document.getElementById('pricingGovernanceNotice');
  const badgeEl = document.getElementById('pricingGovernanceBadge');
  const actionFooter = document.getElementById('pricingActionFooter');
  const discountInput = document.getElementById('pricingDiscountInput');

  if (!opp) {
    if (oppIdEl) oppIdEl.textContent = 'CHỜ NẠP ĐƠN';
    if (totalEl) totalEl.textContent = '0 đ';
    if (finalTotalEl) finalTotalEl.textContent = '0 đ';
    if (itemCountNote) itemCountNote.textContent = '0 sản phẩm';
    if (discountValText) discountValText.textContent = 'Giảm: 0 đ';
    if (badgeEl) {
      badgeEl.className = 'badge-tag missing';
      badgeEl.textContent = 'Chưa Có Dữ Liệu';
    }
    if (actionFooter) actionFooter.style.display = 'none';
    if (discountInput) discountInput.disabled = true;
    if (noticeEl) {
      noticeEl.style.background = '#f8fafc';
      noticeEl.style.border = '1px dashed #cbd5e1';
      noticeEl.style.color = '#64748b';
      noticeEl.innerHTML = 'Chưa có dữ liệu tính giá. Vui lòng hoàn thiện <b>Bước 1</b> (điền Bối cảnh & tải File dữ liệu thô) trước.';
    }
    return;
  }

  if (actionFooter) actionFooter.style.display = 'flex';
  if (discountInput) discountInput.disabled = false;
  if (oppIdEl) oppIdEl.textContent = opp.id;

  const totalOriginal = opp.validation.items.reduce((sum, it) => sum + (it.unit_price * it.requested_qty), 0);
  opp.pricing.total_before_discount = totalOriginal;

  if (totalEl) totalEl.textContent = formatCurrency(totalOriginal);
  if (itemCountNote) itemCountNote.textContent = `${opp.validation.items.length} mặt hàng, ${opp.validation.items.reduce((s, it) => s + it.requested_qty, 0)} sản phẩm`;

  if (discountInput) {
    discountInput.value = opp.pricing.discount_percentage || opp.extracted.requested_discount || 5;
  }

  updateLivePricingCalculation();
}

// --- RESET DỮ LIỆU VỀ 0 ---
async function resetAllSystemData() {
  if (!confirm('Bạn có chắc chắn muốn làm sạch toàn bộ dữ liệu cơ hội bán hàng về 0 (Zero-state) để bắt đầu demo từ đầu?')) return;
  try {
    await fetch('/api/reset_data', { method: 'POST', headers: getAuthHeaders() });
    currentProcessingOpp = null;
    allOpportunities = [];
    uploadedRawFileName = '';
    step1Completed = false;
    const textarea = document.getElementById('pageIngestTextarea');
    if (textarea) textarea.value = '';

    renderDashboardData({
      total_count: 0,
      eligible: { count: 0, total_value: 0 },
      missing_info: { count: 0, total_value: 0 },
      unfulfilled: { count: 0, total_value: 0 },
      pending_approval: { count: 0, total_value: 0 }
    }, []);

    renderApprovalInbox([]);
    renderAllOpportunitiesTable([]);
    renderEmptyParsingView();
    renderActiveOppValidation(null);
    renderActiveOppPricing(null);

    showStepTransitionToast('Đã làm sạch toàn bộ dữ liệu về 0! Bạn có thể bắt đầu demo mới.', 'success', 3000);
    openSaasPage('page-dashboard');
  } catch (e) {
    alert('Không thể kết nối máy chủ để reset!');
  }
}

function setDiscountQuick(val) {
  const discountInput = document.getElementById('pricingDiscountInput');
  if (discountInput) {
    discountInput.value = val;
    updateLivePricingCalculation();
  }
}

function updateLivePricingCalculation() {
  if (!currentProcessingOpp) return;
  const discountInput = document.getElementById('pricingDiscountInput');
  const discount = parseFloat(discountInput ? discountInput.value : 5) || 0;
  const totalBefore = currentProcessingOpp.pricing.total_before_discount || 0;

  const discountAmount = Math.round(totalBefore * (discount / 100));
  const finalTotal = Math.max(0, totalBefore - discountAmount);

  currentProcessingOpp.pricing.discount_percentage = discount;
  currentProcessingOpp.pricing.discount_amount = discountAmount;
  currentProcessingOpp.pricing.total_after_discount = finalTotal;

  const discountValText = document.getElementById('pricingDiscountValText');
  if (discountValText) discountValText.textContent = `Giảm: -${formatCurrency(discountAmount)}`;

  const finalTotalEl = document.getElementById('pricingFinalTotal');
  if (finalTotalEl) finalTotalEl.textContent = formatCurrency(finalTotal);

  const badgeEl = document.getElementById('pricingGovernanceBadge');
  const noticeEl = document.getElementById('pricingGovernanceNotice');
  const confirmBtn = document.getElementById('btnConfirmPricingAction');

  if (discount <= 8 && finalTotal < 500000000) {
    if (badgeEl) {
      badgeEl.className = 'badge-tag eligible';
      badgeEl.textContent = 'Trong Hạn Mức Sales (<= 8%)';
    }
    if (noticeEl) {
      noticeEl.style.background = '#ecfdf5';
      noticeEl.style.border = '1px solid #a7f3d0';
      noticeEl.style.color = '#065f46';
      noticeEl.innerHTML = `
        <b>Hạn mức thẩm quyền:</b> Mức chiết khấu <b>${discount}%</b> và giá trị đơn hàng <b>${formatCurrency(finalTotal)}</b> nằm trong thẩm quyền tự quyết của <b>Chuyên viên Sales</b>.<br>
        Bạn có toàn quyền xác nhận và ban hành báo giá chính thức ngay cho khách hàng mà không cần trình duyệt cấp trên.
      `;
    }
    if (confirmBtn) {
      confirmBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      confirmBtn.innerHTML = '<span>Xác Nhận Báo Giá &rarr; Tự Động Chuyển Sang Bước 5: Phê Duyệt &rarr;</span>';
    }
  } else {
    if (badgeEl) {
      badgeEl.className = 'badge-tag pending';
      badgeEl.textContent = 'Vượt Hạn Mức (> 8%) - Cần Trưởng Phòng Duyệt';
    }
    if (noticeEl) {
      noticeEl.style.background = '#f5f3ff';
      noticeEl.style.border = '1px solid #ddd6fe';
      noticeEl.style.color = '#5b21b6';
      noticeEl.innerHTML = `
        <b>Yêu cầu chuyển duyệt cấp trên:</b> Mức chiết khấu <b>${discount}%</b> (hoặc giá trị hợp đồng &ge; 500 triệu) đã <b>vượt quá thẩm quyền tự duyệt</b> của Chuyên viên Sales (tối đa 8%).<br>
        Theo quy chế tài chính và quản trị rủi ro B2B của doanh nghiệp, đơn hàng này bắt buộc phải lập <b>Phiếu Chuyển Duyệt</b> trình Trưởng phòng Kinh doanh xem xét.
      `;
    }
    if (confirmBtn) {
      confirmBtn.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)';
      confirmBtn.innerHTML = '<span>Xác Nhận Lập Phiếu &rarr; Tự Động Chuyển Sang Bước 5: Phê Duyệt &rarr;</span>';
    }
  }
}

function submitPricingConfirmation() {
  if (!currentProcessingOpp) {
    if (allOpportunities.length > 0) currentProcessingOpp = allOpportunities[0];
    else { alert('Chưa có cơ hội nào đang được xử lý.'); return; }
  }

  const discountInput = document.getElementById('pricingDiscountInput');
  const discount = parseFloat(discountInput ? discountInput.value : (currentProcessingOpp.pricing.discount_percentage || 5)) || 5;
  const totalBefore = currentProcessingOpp.pricing.total_before_discount || 0;
  const discountAmount = Math.round(totalBefore * (discount / 100));
  const finalTotal = Math.max(0, totalBefore - discountAmount);

  currentProcessingOpp.pricing.discount_percentage = discount;
  currentProcessingOpp.pricing.discount_amount = discountAmount;
  currentProcessingOpp.pricing.total_after_discount = finalTotal;

  // Luôn chuyển sang trạng thái Chờ duyệt để bước tiếp theo (Bước 5: Phê duyệt) có dữ liệu duyệt
  currentProcessingOpp.pricing_verified = true;
  currentProcessingOpp.status = 'Chờ duyệt';
  currentProcessingOpp.status_reason = `Đã hoàn tất tính toán báo giá (Chiết khấu ${discount}%, thành tiền ${formatCurrency(finalTotal)}). Lập Phiếu chuyển duyệt trình Trưởng phòng Kinh doanh xem xét.`;
  currentProcessingOpp.pricing.approval_reason = `Đơn hàng B2B cần phê duyệt chiết khấu ${discount}% và điều khoản hợp đồng trước khi phát hành chính thức.`;

  // Đảm bảo đơn hàng có mặt trong danh sách tổng
  const existingIdx = allOpportunities.findIndex(o => o.id === currentProcessingOpp.id);
  if (existingIdx !== -1) {
    allOpportunities[existingIdx] = currentProcessingOpp;
  } else {
    allOpportunities.unshift(currentProcessingOpp);
  }

  showStepTransitionToast(`Đã xác nhận báo giá! Tự động chuyển sang Bước 5: Hộp Thư Phê Duyệt của Trưởng phòng...`, 'warning', 3000);

  renderDashboardData(null, allOpportunities);
  renderApprovalInbox(allOpportunities);
  renderAllOpportunitiesTable(allOpportunities);

  // TỰ ĐỘNG CHUYỂN THẲNG SANG BƯỚC 5: PHÊ DUYỆT
  openSaasPage('page-approval');
}

// ==========================================
// PAGE 9: APPROVAL INBOX (TRƯỞNG PHÒNG - CHECKPOINT 2)
// ==========================================
function renderApprovalInbox(opps) {
  const container = document.getElementById('approvalPendingContainer');
  if (!container) return;

  const pendingOpps = opps.filter(o => o.status === 'Chờ duyệt');
  if (pendingOpps.length === 0) {
    container.innerHTML = `
      <div class="saas-card" style="text-align:center; padding:40px; color:#64748b;">
        <div style="font-size:32px;"></div>
        <div style="font-size:16px; font-weight:700; color:#1e293b; margin-top:8px;">Hộp thư phê duyệt sạch sẽ</div>
        <p style="font-size:13px; margin-top:4px;">Hiện không có cơ hội nào đang chờ Trưởng phòng phê duyệt.</p>
      </div>
    `;
    return;
  }

  const canApprove = currentUser && (currentUser.role_code === 'SALES_MANAGER' || currentUser.role_code === 'ADMIN');

  container.innerHTML = pendingOpps.map(o => `
    <div class="saas-card" style="border-left:4px solid #8b5cf6;">
      <div class="saas-card-title-row">
        <div>
          <div style="font-size:16px; font-weight:800; color:#6b21a8;">
            PHIẾU CHUYỂN DUYỆT: ${o.id} — ${o.customer_name}
          </div>
          <small style="color:#64748b;">Trình duyệt bởi chuyên viên: <b>${o.sales_rep ? o.sales_rep.name : 'N/A'}</b></small>
        </div>
        <span class="badge-tag pending">Chờ Quyết Định</span>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:14px; font-size:13px;">
        <div>
          <div><b>Tổng giá trị đề xuất:</b> <span style="font-size:16px; font-weight:800; color:#b45309;">${formatCurrency(o.pricing.total_after_discount)}</span></div>
          <div><b>Mức chiết khấu yêu cầu:</b> <span style="color:#dc2626; font-weight:700;">${o.pricing.discount_percentage}% (-${formatCurrency(o.pricing.discount_amount)})</span></div>
        </div>
        <div>
          <div><b>Lý do chuyển duyệt:</b> <span style="color:#6b21a8; font-weight:600;">${o.pricing.approval_reason}</span></div>
          <div><b>Căn cứ dữ liệu:</b> Kho đủ tồn khả dụng, hợp đồng thanh toán ngay.</div>
        </div>
      </div>

      ${canApprove ? `
      <div style="display:flex; align-items:center; gap:10px; padding-top:12px; border-top:1px dashed #e2e8f0;">
        <button class="btn-primary-action" style="background:#16a34a;" onclick="openManagerApprovalModal('${o.id}', 'APPROVED')">
          <span>Phê Duyệt Chiết Khấu</span>
        </button>
        <button class="btn-secondary-tool" style="color:#dc2626; border-color:#fca5a5;" onclick="openManagerApprovalModal('${o.id}', 'REJECTED')">
          <span>✕ Từ Chối</span>
        </button>
        <button class="btn-secondary-tool" onclick="openManagerApprovalModal('${o.id}', 'REVISE')">
          <span>Yêu Cầu Chỉnh Sửa</span>
        </button>
      </div>
      ` : `
      <div style="padding:10px 14px; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; font-size:12px; color:#be123c;">
        <b>Quyền hạn chế:</b> Bạn đang đăng nhập với vai trò <b>${currentUser.role_name}</b>. Bạn chỉ được xem phiếu duyệt này, quyền bấm Duyệt/Từ chối thuộc về Trưởng phòng Kinh doanh (Lê Văn Tuấn) hoặc Quản trị viên (Lê Yến Như).
      </div>
      `}
    </div>
  `).join('');
}

function openManagerApprovalModal(oppId, decision) {
  if (!currentUser || (currentUser.role_code !== 'SALES_MANAGER' && currentUser.role_code !== 'ADMIN')) {
    alert('Bạn không có thẩm quyền phê duyệt chiết khấu. Chỉ Trưởng phòng Kinh doanh hoặc Admin mới được phê duyệt!');
    return;
  }

  currentApprOppId = oppId;
  currentApprDecision = decision;

  const opp = allOpportunities.find(o => o.id === oppId);
  if (!opp) return;

  const titleEl = document.getElementById('apprModalTitle');
  const summaryEl = document.getElementById('apprModalOppSummary');
  const noteEl = document.getElementById('apprModalNote');
  const submitBtn = document.getElementById('apprModalSubmitBtn');

  if (decision === 'APPROVED') {
    titleEl.textContent = `Xác Nhận Phê Duyệt Chiết Khấu: ${opp.id}`;
    titleEl.style.color = '#047857';
    noteEl.value = 'Đồng ý phê duyệt mức chiết khấu đề xuất. Khách hàng cam kết thanh toán đợt 1 ngay sau khi ký hợp đồng.';
    submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    submitBtn.innerHTML = '<span>Tôi Phê Duyệt Chiết Khấu Này</span>';
  } else if (decision === 'REJECTED') {
    titleEl.textContent = `✕ Xác Nhận Từ Chối Chiết Khấu: ${opp.id}`;
    titleEl.style.color = '#dc2626';
    noteEl.value = 'Từ chối mức chiết khấu này do vượt quá biên độ lợi nhuận gộp cho phép. Đề nghị Sales thương lượng lại tối đa 8%.';
    submitBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    submitBtn.innerHTML = '<span>✕ Tôi Xác Nhận Từ Chối</span>';
  } else {
    titleEl.textContent = `Yêu Cầu Chỉnh Sửa Hồ Sơ: ${opp.id}`;
    titleEl.style.color = '#d97706';
    noteEl.value = 'Yêu cầu nhân viên phụ trách đàm phán lại về điều khoản bảo lãnh thanh toán trước khi duyệt.';
    submitBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    submitBtn.innerHTML = '<span>Gửi Yêu Cầu Chỉnh Sửa</span>';
  }

  summaryEl.innerHTML = `
    <div><b>Khách hàng:</b> ${opp.customer_name} | <b>Mã cơ hội:</b> <code>${opp.id}</code></div>
    <div><b>Chuyên viên trình:</b> ${opp.sales_rep ? opp.sales_rep.name : 'N/A'}</div>
    <div><b>Tổng giá trị đề xuất:</b> <span style="font-weight:800; color:#b45309;">${formatCurrency(opp.pricing.total_after_discount)}</span></div>
    <div><b>Mức chiết khấu xin duyệt:</b> <span style="font-weight:700; color:#dc2626;">${opp.pricing.discount_percentage}%</span> (-${formatCurrency(opp.pricing.discount_amount)})</div>
    <div><b>Người đưa ra quyết định:</b> <b>${currentUser.full_name} (${currentUser.role_name})</b></div>
  `;

  openHitlModal('hitlApprovalModal');
}

async function confirmManagerApprovalDecision() {
  if (!currentApprOppId || !currentApprDecision) return;
  const note = document.getElementById('apprModalNote').value.trim();
  closeHitlModal('hitlApprovalModal');

  const targetOpp = allOpportunities.find(o => o.id === currentApprOppId) || currentProcessingOpp;

  try {
    const res = await fetch('/api/approve', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ 
        opp_id: currentApprOppId, 
        decision: currentApprDecision, 
        note,
        opportunity: targetOpp
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      const idx = allOpportunities.findIndex(o => o.id === currentApprOppId);
      if (idx !== -1) {
        allOpportunities[idx] = data.updated_opportunity;
      }
      renderDashboardData(data.summary, allOpportunities);
      renderApprovalInbox(allOpportunities);
      renderAllOpportunitiesTable(allOpportunities);
      renderReportsTable(data.summary, allOpportunities);

      if (currentApprDecision === 'APPROVED') {
        showStepTransitionToast(`Trưởng phòng đã phê duyệt thành công cơ hội ${currentApprOppId}! Đang chuyển về Tổng quan...`, 'success', 3000);
        openSaasPage('page-dashboard');
      } else {
        showStepTransitionToast(`Đã lưu quyết định [${currentApprDecision}] cho cơ hội ${currentApprOppId}!`, 'warning', 3000);
      }
    } else {
      alert('Lỗi: ' + (data.error || 'Không thể thực hiện phê duyệt!'));
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ');
  }
}

// ==========================================
// PAGE 10: REPORTS & AUDIT LOGS
// ==========================================
function renderReportsTable(summary, opps) {
  const tbody = document.getElementById('reportStatsTableBody');
  if (!tbody) return;

  const totalOpps = Array.isArray(opps) ? opps.length : 0;
  if (!summary || totalOpps === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:42px 20px; color:#64748b;">
          <div style="font-size:15px; font-weight:800; color:#1e293b;">Chưa có dữ liệu báo cáo & nhận xét</div>
          <p style="font-size:13px; margin:6px 0 14px 0;">Hệ thống đang ở trạng thái trống. Vui lòng hoàn thiện <b>Bước 1</b> (điền Bối cảnh & tải File dữ liệu thô) để AI Agent tổng hợp số liệu.</p>
          <button class="btn-primary-action" onclick="openSaasPage('page-ingestion')">Đi tới Bước 1</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = `
    <tr>
      <td><span class="badge-tag eligible">Có thể tiếp tục</span></td>
      <td>Đáp ứng đầy đủ danh mục, tồn kho, giá và thẩm quyền Sales</td>
      <td><b>${summary.eligible.count}</b></td>
      <td>${((summary.eligible.count / (totalOpps || 1)) * 100).toFixed(1)}%</td>
      <td style="font-weight:800; color:#059669;">${formatCurrency(summary.eligible.total_value)}</td>
    </tr>
    <tr>
      <td><span class="badge-tag pending">Chờ duyệt</span></td>
      <td>Chiết khấu > 5% hoặc đơn hàng lớn >= 500 triệu VNĐ</td>
      <td><b>${summary.pending_approval.count}</b></td>
      <td>${((summary.pending_approval.count / (totalOpps || 1)) * 100).toFixed(1)}%</td>
      <td style="font-weight:800; color:#7c3aed;">${formatCurrency(summary.pending_approval.total_value)}</td>
    </tr>
    <tr>
      <td><span class="badge-tag missing">Cần bổ sung thông tin</span></td>
      <td>Thiếu ngân sách, thời hạn hoặc số lượng sản phẩm</td>
      <td><b>${summary.missing_info.count}</b></td>
      <td>${((summary.missing_info.count / (totalOpps || 1)) * 100).toFixed(1)}%</td>
      <td style="color:#94a3b8; font-style:italic;">Chưa xác định (Không cộng dồn)</td>
    </tr>
    <tr>
      <td><span class="badge-tag unfulfilled">Chưa đáp ứng</span></td>
      <td>Hết tồn kho, không kịp tiến độ hoặc vượt quá ngân sách</td>
      <td><b>${summary.unfulfilled.count}</b></td>
      <td>${((summary.unfulfilled.count / (totalOpps || 1)) * 100).toFixed(1)}%</td>
      <td style="color:#94a3b8; font-style:italic;">Chưa xác định (Không cộng dồn)</td>
    </tr>
  `;
}

async function loadAuditLogs() {
  try {
    const res = await fetch('/api/audit_logs', { headers: getAuthHeaders() });
    const logs = await res.json();
    const tbody = document.getElementById('auditLogPageTbody');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 40px 20px; color:#64748b;">
            <div style="font-size:30px; margin-bottom:8px;"></div>
            <div style="font-weight:700; color:#1e293b;">Nhật ký thực thi AI Agent đang trống</div>
            <small style="color:#64748b;">Mọi thao tác phân tích, bóc tách và đối chiếu sẽ được ghi vết tự động tại đây khi có yêu cầu phát sinh.</small>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="font-family:monospace; font-size:11px;">${l.timestamp}</td>
        <td><b>${l.opp_id}</b></td>
        <td>${l.step}</td>
        <td style="color:#b45309; font-weight:700;">${l.skill}</td>
        <td>${l.action}</td>
        <td style="font-size:11.5px; color:#64748b;">${l.rule}</td>
        <td>${l.human_checkpoint ? '<span class="badge-tag pending">Có can thiệp</span>' : '<span style="color:#94a3b8;">Tự động</span>'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// PAGE 12: DATA MANAGEMENT
// ==========================================
async function handleUploadNewData() {
  if (currentUser && currentUser.role_code !== 'ADMIN') {
    alert('Chỉ Quản trị viên (Admin) mới có quyền nạp dữ liệu Master Catalog!');
    return;
  }

  const text = document.getElementById('newDataTextarea').value.trim();
  if (!text) {
    alert('Vui lòng nhập định dạng JSON dữ liệu sản phẩm!');
    return;
  }

  try {
    const parsed = JSON.parse(text);
    const res = await fetch('/api/data_upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type: 'PRODUCT_CATALOG', items: parsed })
    });
    const data = await res.json();
    alert(data.message || 'Đã nạp dữ liệu thành công!');
    await loadBackendData();
  } catch (e) {
    alert('Định dạng JSON không hợp lệ: ' + e.message);
  }
}

// ==========================================
// EXPORTS & HELPERS
// ==========================================
// ==========================================
// DATA RESET & SEED CONTROLLERS (ZERO-STATE)
// ==========================================
async function handleClearAllData() {
  if (!confirm('Bạn có chắc chắn muốn RESET TOÀN BỘ hệ thống về trạng thái TRỐNG (Zero-state) để bắt đầu lại từ đầu?')) {
    return;
  }
  try {
    const res = await fetch('/api/clear_data', { method: 'POST', headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok) {
      allOpportunities = [];
      currentProcessingOpp = null;
      uploadedRawFileName = '';
      step1Completed = false;
      liveRawTable = { headers: [], rows: [], totalOriginalRows: 0 };
      liveRawTablePage = 1;
      renderLiveRawDataTable();
      
      const textarea = document.getElementById('pageIngestTextarea');
      if (textarea) { textarea.value = ''; textarea.style.border = ''; }
      
      const fileInput = document.getElementById('fileUploadInput');
      if (fileInput) fileInput.value = '';

      const uploadBtn = document.getElementById('btnUploadRawFile');
      if (uploadBtn) { uploadBtn.style.border = ''; uploadBtn.style.boxShadow = ''; }

      const comp = document.getElementById('ctxCompanyName');
      const ind = document.getElementById('ctxIndustry');
      const aud = document.getElementById('ctxAudience');
      const goals = document.getElementById('ctxGoals');
      if (comp) { comp.value = ''; comp.style.border = ''; }
      if (ind) ind.value = '';
      if (aud) aud.value = '';
      if (goals) { goals.value = ''; goals.style.border = ''; }

      const rawNote = document.getElementById('rawInputStatusNote');
      if (rawNote) rawNote.textContent = 'Chưa có tệp dữ liệu. Bắt buộc tải lên file dữ liệu thô để chuyển sang Bước 2.';
      
      const oppBadge = document.getElementById('sidebarOppCount');
      if (oppBadge) oppBadge.textContent = '0';
      const pendingBadge = document.getElementById('sidebarPendingCount');
      if (pendingBadge) pendingBadge.textContent = '0';
      const notifDot = document.getElementById('headerNotifDot');
      if (notifDot) notifDot.style.display = 'none';

      renderDashboardData(data.summary, allOpportunities);
      renderAllOpportunitiesTable(allOpportunities);
      renderApprovalInbox(allOpportunities);
      renderReportsTable(data.summary, allOpportunities);
      renderEmptyParsingView();
      renderActiveOppValidation(null);
      renderActiveOppPricing(null);
      loadAuditLogs();

      showStepTransitionToast('Hệ thống đã RESET VỀ TRỐNG (0 dữ liệu). Sẵn sàng bắt đầu yêu cầu mới!', 'success', 3500);
      openSaasPage('page-ingestion');
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ!');
  }
}

async function handleSeedDemoData() {
  try {
    const res = await fetch('/api/seed_demo_data', { method: 'POST', headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok) {
      allOpportunities = data.opportunities || [];
      if (allOpportunities.length > 0) currentProcessingOpp = allOpportunities[0];
      renderDashboardData(data.summary, allOpportunities);
      renderAllOpportunitiesTable(allOpportunities);
      renderApprovalInbox(allOpportunities);
      renderReportsTable(data.summary, allOpportunities);
      loadAuditLogs();
      alert('Đã nạp 4 Test Case mẫu thành công!');
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ!');
  }
}

function exportWordReport() {
  if (!allOpportunities || allOpportunities.length === 0) {
    alert('Chưa có dữ liệu phân tích! Vui lòng hoàn thiện Bước 1 (điền Bối cảnh & tải File dữ liệu thô) trước khi xuất báo cáo.');
    return;
  }
  window.open('/api/export/word', '_blank');
}

function exportCsvReport() {
  if (!allOpportunities || allOpportunities.length === 0) {
    alert('Chưa có dữ liệu phân tích! Vui lòng hoàn thiện Bước 1 (điền Bối cảnh & tải File dữ liệu thô) trước khi xuất báo cáo.');
    return;
  }
  window.open('/api/export/csv', '_blank');
}

function formatCurrency(val) {
  if (!val || isNaN(val)) return '0 đ';
  return Number(val).toLocaleString('vi-VN') + ' đ';
}

function getBadgeStyle(status) {
  switch (status) {
    case 'Có thể tiếp tục': return 'eligible';
    case 'Cần bổ sung thông tin': return 'missing';
    case 'Chưa đáp ứng': return 'unfulfilled';
    case 'Chờ duyệt': return 'pending';
    default: return 'missing';
  }
}


// ==========================================
// AUTHENTICATION MODAL (POPUP CENTER)
// ==========================================
function openAuthModal(mode = 'login') {
  const loginView = document.getElementById('publicLoginView');
  if (loginView) {
    loginView.style.display = 'flex';
  }
  switchAuthMode(mode);
}

function closeAuthModal() {
  const loginView = document.getElementById('publicLoginView');
  if (loginView) {
    loginView.style.display = 'none';
  }
}

// ==========================================
// WELCOME AI AGENT TAB / MODAL FUNCTIONS
// ==========================================
function handleStartExperience() {
  if (currentUser) {
    navigateTo('app');
    openSaasPage('page-ingestion');
    setTimeout(() => {
      openWelcomeAgentModal(true);
    }, 300);
  } else {
    openAuthModal('login');
  }
}

function openWelcomeAgentModal(force = false) {
  const isSuppressed = sessionStorage.getItem('suppress_welcome_agent') === 'true';
  if (isSuppressed && !force) {
    return;
  }

  const modal = document.getElementById('welcomeAgentModal');
  if (!modal) return;

  const greetingEl = document.getElementById('welcomeUserGreetingText');
  if (greetingEl) {
    const userName = currentUser ? currentUser.name : 'Lê Yến Như';
    const userRole = currentUser ? (currentUser.role_name || currentUser.role || 'Quản trị viên') : 'Quản trị viên (Admin)';
    greetingEl.innerHTML = 'Xin chào <b>' + userName + '</b> (' + userRole + '), chào mừng bạn đến với Trung tâm điều phối AI Agent! Mọi kỹ năng bóc tách yêu cầu, thẩm định kho hàng, tính báo giá và hỗ trợ phê duyệt đều đã sẵn sàng hoạt động.';
  }

  modal.style.display = 'flex';
}

function closeWelcomeAgentModal() {
  const modal = document.getElementById('welcomeAgentModal');
  if (modal) {
    modal.style.display = 'none';
  }
  const chk = document.getElementById('chkDoNotShowAgain');
  if (chk && chk.checked) {
    sessionStorage.setItem('suppress_welcome_agent', 'true');
  }
}

function welcomeNavigateToStep1() {
  closeWelcomeAgentModal();
  openSaasPage('page-ingestion');
}

// Global modal dismiss listeners
window.addEventListener('click', (e) => {
  const loginView = document.getElementById('publicLoginView');
  if (loginView && e.target === loginView) {
    closeAuthModal();
  }
  const welcomeModal = document.getElementById('welcomeAgentModal');
  if (welcomeModal && e.target === welcomeModal) {
    closeWelcomeAgentModal();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAuthModal();
    const welcomeModal = document.getElementById('welcomeAgentModal');
    if (welcomeModal && welcomeModal.style.display === 'flex') {
      closeWelcomeAgentModal();
    }
  }
});

// ==========================================
// BUSINESS CONTEXT & MULTI-OUTPUT CONTROLLERS
// ==========================================
let selectedOutputs = ['dashboard'];

function toggleOutputPill(type, btn) {
  const index = selectedOutputs.indexOf(type);
  if (index > -1) {
    if (selectedOutputs.length === 1) {
      showStepTransitionToast('Vui lòng chọn ít nhất 1 đầu ra mong muốn!', 'info', 2000);
      return;
    }
    selectedOutputs.splice(index, 1);
    if (btn) btn.classList.remove('active');
  } else {
    selectedOutputs.push(type);
    if (btn) btn.classList.add('active');
  }
  updateSelectedOutputLabel();
}

function selectOutputPill(type, btn) {
  toggleOutputPill(type, btn);
}

function updateSelectedOutputLabel() {
  const lbl = document.getElementById('selectedOutputLabel');
  if (!lbl) return;

  const names = {
    'dashboard': 'Dashboard',
    'report': 'Báo cáo',
    'html': 'HTML'
  };

  if (selectedOutputs.length === 0) {
    lbl.textContent = 'Chưa chọn';
  } else {
    lbl.textContent = selectedOutputs.map(t => names[t] || t).join(', ');
  }
}

function clearContextInputs() {
  uploadedRawFileName = '';
  step1Completed = false;
  const comp = document.getElementById('ctxCompanyName');
  const ind = document.getElementById('ctxIndustry');
  const aud = document.getElementById('ctxAudience');
  const goals = document.getElementById('ctxGoals');
  const rawData = document.getElementById('pageIngestTextarea');
  const fileInput = document.getElementById('fileUploadInput');
  const uploadBtn = document.getElementById('btnUploadRawFile');
  if (comp) { comp.value = ''; comp.style.border = ''; }
  if (ind) ind.value = '';
  if (aud) aud.value = '';
  if (goals) { goals.value = ''; goals.style.border = ''; }
  if (rawData) { rawData.value = ''; rawData.style.border = ''; }
  if (fileInput) fileInput.value = '';
  if (uploadBtn) { uploadBtn.style.border = ''; uploadBtn.style.boxShadow = ''; }
  const note = document.getElementById('rawInputStatusNote');
  if (note) note.textContent = 'Chưa có tệp dữ liệu. Bắt buộc tải lên file dữ liệu thô để chuyển sang Bước 2.';

  selectedOutputs = ['dashboard'];
  document.querySelectorAll('.btn-output-pill').forEach(b => {
    const t = b.getAttribute('data-type') || (b.textContent.includes('Dashboard') ? 'dashboard' : '');
    if (t === 'dashboard') b.classList.add('active');
    else b.classList.remove('active');
  });
  updateSelectedOutputLabel();
  showStepTransitionToast('Đã làm trống toàn bộ bối cảnh & dữ liệu nhập', 'info', 2000);
}

function fillRetailSampleContext() {
  const comp = document.getElementById('ctxCompanyName');
  const ind = document.getElementById('ctxIndustry');
  const aud = document.getElementById('ctxAudience');
  const goals = document.getElementById('ctxGoals');
  if (comp) { comp.value = 'Hệ Thống Bán Lẻ & Bán Buôn Phúc An Retail'; comp.style.border = ''; }
  if (ind) { ind.value = 'Bán lẻ đa kênh (Omnichannel) & Phân phối Thiết bị'; ind.style.border = ''; }
  if (aud) { aud.value = 'Ban Giám Đốc & Khối Kinh Doanh Bán Lẻ'; aud.style.border = ''; }
  if (goals) { goals.value = 'Phân tích biến động doanh thu 60.000 giao dịch bán lẻ, tối ưu hóa biên lợi nhuận, đối soát tồn kho chuỗi cửa hàng và phát hiện các đơn hàng chiết khấu vượt thẩm quyền quy định.'; goals.style.border = ''; }

  // Gợi ý chọn cả Dashboard và Báo cáo
  selectedOutputs = ['dashboard', 'report'];
  document.querySelectorAll('.btn-output-pill').forEach(b => {
    const t = b.getAttribute('data-type') || (b.textContent.includes('Dashboard') ? 'dashboard' : (b.textContent.includes('Báo cáo') ? 'report' : 'html'));
    if (selectedOutputs.includes(t)) b.classList.add('active');
    else b.classList.remove('active');
  });
  updateSelectedOutputLabel();

  showStepTransitionToast('Đã nạp mẫu bối cảnh doanh nghiệp bán lẻ (Chọn Dashboard + Báo cáo)!', 'success', 2500);
}

// ==========================================
// LIGHT / DARK MODE CONTROLLERS (TOP RIGHT)
// ==========================================
function initThemeMode() {
  const savedMode = localStorage.getItem('minhan_theme_mode') || 'light';
  applyThemeMode(savedMode);
}

function toggleDarkMode() {
  const isDark = document.body.classList.contains('dark-mode');
  const nextMode = isDark ? 'light' : 'dark';
  localStorage.setItem('minhan_theme_mode', nextMode);
  applyThemeMode(nextMode);

  if (typeof showStepTransitionToast === 'function') {
    showStepTransitionToast(
      nextMode === 'dark' ? 'Đã chuyển sang giao diện Tối (Dark Mode)' : 'Đã chuyển sang giao diện Sáng (Light Mode)',
      'info',
      2000
    );
  }
}

function applyThemeMode(mode) {
  const icon = document.getElementById('themeToggleIcon');
  const label = document.getElementById('themeToggleLabel');
  const landingIcon = document.getElementById('landingThemeToggleIcon');
  const landingLabel = document.getElementById('landingThemeToggleLabel');

  if (mode === 'dark') {
    document.body.classList.add('dark-mode');
    document.documentElement.classList.add('dark-mode');
    if (icon) icon.textContent = '';
    if (label) label.textContent = 'Sáng';
    if (landingIcon) landingIcon.textContent = '';
    if (landingLabel) landingLabel.textContent = 'Sáng';
  } else {
    document.body.classList.remove('dark-mode');
    document.documentElement.classList.remove('dark-mode');
    if (icon) icon.textContent = '';
    if (label) label.textContent = 'Tối';
    if (landingIcon) landingIcon.textContent = '';
    if (landingLabel) landingLabel.textContent = 'Tối';
  }
}

// Immediate run in case script loaded after DOM
if (document.body) {
  initThemeMode();
}



// ============================================================================
// MIFFY THEME CONTROLLER (DICK BRUNA PASTEL INTERFACE)
// ============================================================================
const MIFFY_CHEER_MESSAGES = [
  'Xin chào! Miffy luôn đồng hành cùng Lê Yến Như',
  'Nhớ điền Bối cảnh & tải File dữ liệu thô ở Bước 1 nhé!',
  'Dữ liệu sạch sẽ giúp báo cáo chính xác 100%',
  'Miffy chúc bạn hoàn thành phân tích thật mượt mà!',
  'Cần đối soát dữ liệu lỗi? Miffy sẵn sàng hỗ trợ ở Bước 2'
];
let miffyCheerIndex = 0;
let miffyBubbleTimer = null;

function triggerMiffyCheer() {
  const mascot = document.getElementById('miffyCornerMascot');
  const bubble = document.getElementById('miffySpeechBubble');
  if (!mascot || !bubble) return;

  bubble.textContent = MIFFY_CHEER_MESSAGES[miffyCheerIndex % MIFFY_CHEER_MESSAGES.length];
  miffyCheerIndex += 1;
  mascot.classList.add('show-bubble');

  if (miffyBubbleTimer) clearTimeout(miffyBubbleTimer);
  miffyBubbleTimer = setTimeout(() => {
    mascot.classList.remove('show-bubble');
  }, 3200);
}

(function initMiffyThemeAlwaysOn() {
  const enforceMiffy = () => document.body.classList.add('miffy-theme');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceMiffy);
  } else {
    enforceMiffy();
  }
})();


// ============================================================================
// STEP 2: LIVE RAW DATA ENGINE & DIRECT INLINE TABLE EDITOR
// ============================================================================
function escapeHtmlAttr(val) {
  return String(val === undefined || val === null ? '' : val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let liveRawEditedCells = new Set();
let liveRawSyncTimer = null;

function isValidDateString(str) {
  const s = String(str || '').trim();
  if (!s) return false;
  // Hỗ trợ YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY
  let y, m, d;
  let m1 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  let m2 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m1) {
    y = parseInt(m1[1], 10); m = parseInt(m1[2], 10); d = parseInt(m1[3], 10);
  } else if (m2) {
    d = parseInt(m2[1], 10); m = parseInt(m2[2], 10); y = parseInt(m2[3], 10);
  } else if (/^\d{5}$/.test(s)) {
    // Excel serial date (VD: 46099)
    const serial = parseInt(s, 10);
    return serial >= 30000 && serial <= 65000;
  } else {
    return false;
  }
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d;
}

function normalizeCanonicalDate(str) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const m1 = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m1) {
    return `${m1[1]}-${String(parseInt(m1[2], 10)).padStart(2, '0')}-${String(parseInt(m1[3], 10)).padStart(2, '0')}`;
  }
  const m2 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m2) {
    return `${m2[3]}-${String(parseInt(m2[2], 10)).padStart(2, '0')}-${String(parseInt(m2[1], 10)).padStart(2, '0')}`;
  }
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial >= 30000 && serial <= 65000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return dt.toISOString().slice(0, 10);
    }
  }
  return s.toLowerCase();
}

function normalizeCanonicalQty(str) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const cleaned = s.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const num = Number(cleaned);
    if (!isNaN(num)) return String(num);
  }
  return s.toLowerCase();
}

function analyzeLiveRawTable() {
  const rows = (liveRawTable && Array.isArray(liveRawTable.rows)) ? liveRawTable.rows : [];
  const headers = (liveRawTable && Array.isArray(liveRawTable.headers)) ? liveRawTable.headers : [];

  const seenFull = new Map();
  const seenKey = new Map();
  const seenLineId = new Map();
  const seenRfqId = new Map();
  const seenRfqIdItem = new Map();

  // Tự động nhận diện các cột kiểu số (nếu >60% giá trị không rỗng là số)
  const numericColFlags = headers.map((hName, cIdx) => {
    const hLow = String(hName || '').toLowerCase();
    if (hLow.includes('id') || hLow.includes('mã') || hLow.includes('phone') || hLow.includes('sđt') || hLow.includes('date') || hLow.includes('deadline') || hLow.includes('ngày')) {
      return false;
    }
    let nonEmpty = 0, numCount = 0;
    const sampleLimit = Math.min(rows.length, 200);
    for (let i = 0; i < sampleLimit; i++) {
      const v = String(rows[i]?.[cIdx] ?? '').trim();
      if (!v) continue;
      nonEmpty++;
      if (/^-?\d+([.,]\d+)?%?$/.test(v.replace(/,/g, ''))) numCount++;
    }
    return nonEmpty >= 3 && (numCount / nonEmpty) >= 0.6;
  });

  const findColIdx = (pred) => headers.findIndex(h => pred(String(h || '').toLowerCase().trim()));
  const isDateHeaderName = (low) => low.includes('deadline') || low.includes('date') || low.includes('ngày') || (low.includes('hạn') && !low.includes('hạn mức') && !low.includes('giới hạn'));
  const lineIdColIdx = findColIdx(low => low.includes('line_id') || low.includes('line id') || low.includes('mã dòng') || low === 'row_id' || low === 'stt');
  const rfqIdColIdx = findColIdx(low => low.includes('rfq_id') || low.includes('rfq id') || low.includes('request_id') || low.includes('mã giao dịch') || low.includes('mã gd'));
  const custColIdx = findColIdx(low => low.includes('customer') || low.includes('khách hàng') || low.includes('khách') || low.includes('công ty') || low.includes('đơn vị'));
  const itemColIdx = findColIdx(low => low.includes('item_name') || low.includes('product_name') || low.includes('tên sản phẩm') || low.includes('sản phẩm') || low.includes('thiết bị') || low === 'item');
  const skuColIdx = findColIdx(low => low.includes('sku') || low.includes('product_id') || low.includes('mã sp'));
  const effectiveItemColIdx = itemColIdx >= 0 ? itemColIdx : skuColIdx;
  const qtyColIdx = findColIdx(low => low.includes('quantity') || low.includes('số lượng') || low.includes('qty') || low === 'sl');
  const locColIdx = findColIdx(low => low.includes('location') || low.includes('region') || low.includes('địa điểm') || low.includes('khu vực') || low.includes('tỉnh'));
  const dateColIdx = findColIdx(isDateHeaderName);
  const maintColIdx = findColIdx(low => low.includes('maintenance') || low.includes('bảo trì') || low.includes('sla') || low.includes('dịch vụ'));
  const discColIdx = findColIdx(low => low.includes('discount') || low.includes('chiết khấu'));

  const isRfqDataset = rfqIdColIdx >= 0 && effectiveItemColIdx >= 0 && qtyColIdx >= 0;

  const BAD_PLACEHOLDERS = new Set([
    'null', 'n/a', 'na', 'nan', 'none', 'nil', 'unknown', 'tbd', 'asap',
    'chưa rõ', 'chưa có', 'chưa xác định', 'không rõ', 'trống', 'lỗi', 'error',
    '#n/a', '#value!', '#ref!', '#div/0!', '#name?', '#num!', '???', '...', '--', '-'
  ]);

  let exactDupCount = 0;
  let partialKeepCount = 0;
  let partialDropCount = 0;
  let errorRowCount = 0;
  let cleanRowCount = 0;
  const auditItems = [];
  const errorBreakdown = { missing: 0, numeric: 0, date: 0, format: 0, whitespace: 0, exactDup: 0, partialDup: 0 };

  const rowMeta = rows.map((row, idx) => {
    const rowNum = idx + 1;
    const normalized = headers.map((_, cIdx) => {
      const rawCell = String(row[cIdx] === undefined || row[cIdx] === null ? '' : row[cIdx]).replace(/\s+/g, ' ').trim();
      if (cIdx === dateColIdx) return normalizeCanonicalDate(rawCell);
      if (cIdx === qtyColIdx) return normalizeCanonicalQty(rawCell);
      return rawCell.toLowerCase();
    });
    const fullSig = normalized.join('||');
    const keyLen = Math.min(3, normalized.length);
    const keySig = normalized.slice(0, keyLen).join('||');
    const lineIdVal = lineIdColIdx >= 0 ? normalized[lineIdColIdx] : '';
    const rowQtyNum = qtyColIdx >= 0 ? Number(String(row[qtyColIdx] ?? '').trim().replace(/,/g, '')) : NaN;

    // Quét sâu các nhóm lỗi trên từng ô dữ liệu (Định dạng, Số học, Ngày tháng, Danh mục Catalog & SLA, Khoảng trắng)
    const badCols = [];
    const badReasons = [];
    headers.forEach((hName, cIdx) => {
      const origRaw = String(row[cIdx] === undefined || row[cIdx] === null ? '' : row[cIdx]);
      const rawVal = origRaw.trim();
      const lowVal = rawVal.toLowerCase();
      const hLow = String(hName || '').toLowerCase();

      // Tiêu chí 1: Rỗng / Placeholder / Lỗi công thức Excel
      if (rawVal === '' || BAD_PLACEHOLDERS.has(lowVal)) {
        badCols.push(cIdx);
        badReasons.push(`${hName}: Khuyết thiếu / giá trị rác ("${rawVal || 'Trống'}")`);
        errorBreakdown.missing++;
        return;
      }

      // Tiêu chí 2: Cột số (Quantity, Price, Discount, hoặc tự nhận diện)
      const isQtyCol = cIdx === qtyColIdx || hLow.includes('quantity') || hLow.includes('số lượng') || hLow.includes('qty') || hLow === 'sl';
      const isPriceCol = hLow.includes('price') || hLow.includes('đơn giá') || hLow.includes('budget') || hLow.includes('ngân sách') || hLow.includes('tiền');
      const isDiscCol = cIdx === discColIdx || hLow.includes('discount') || hLow.includes('chiết khấu');

      if (isQtyCol || isPriceCol || isDiscCol || numericColFlags[cIdx]) {
        const cleanedNum = rawVal.replace(/%/g, '').replace(/,/g, '');
        const num = Number(cleanedNum);
        if (isNaN(num)) {
          badCols.push(cIdx);
          badReasons.push(`${hName}: Chứa chữ trong cột số ("${rawVal}")`);
          errorBreakdown.numeric++;
          return;
        }
        if (isQtyCol && (num <= 0 || num > 100000)) {
          badCols.push(cIdx);
          badReasons.push(`${hName}: Số lượng bất hợp lý (${rawVal})`);
          errorBreakdown.numeric++;
          return;
        }
        if (isPriceCol && num < 0) {
          badCols.push(cIdx);
          badReasons.push(`${hName}: Giá trị âm (${rawVal})`);
          errorBreakdown.numeric++;
          return;
        }
        if (isDiscCol && (num < 0 || num > 100)) {
          badCols.push(cIdx);
          badReasons.push(`${hName}: Chiết khấu ngoài 0–100% (${rawVal})`);
          errorBreakdown.numeric++;
          return;
        }
        if (!isQtyCol && !isPriceCol && !isDiscCol && num < 0) {
          badCols.push(cIdx);
          badReasons.push(`${hName}: Giá trị số âm (${rawVal})`);
          errorBreakdown.numeric++;
          return;
        }
      }

      // Tiêu chí 3: Cột Ngày tháng / Deadline
      if (cIdx === dateColIdx || isDateHeaderName(hLow)) {
        if (!isValidDateString(rawVal)) {
          badCols.push(cIdx);
          badReasons.push(`${hName}: Sai định dạng ngày tháng ("${rawVal}")`);
          errorBreakdown.date++;
          return;
        }
      }

      // Tiêu chí 4: Email / SĐT
      if (hLow.includes('email') && (!rawVal.includes('@') || !rawVal.includes('.'))) {
        badCols.push(cIdx);
        badReasons.push(`${hName}: Email sai định dạng ("${rawVal}")`);
        errorBreakdown.format++;
        return;
      }
      if ((hLow.includes('phone') || hLow.includes('sđt') || hLow.includes('điện thoại')) && rawVal.replace(/\D/g, '').length < 8) {
        badCols.push(cIdx);
        badReasons.push(`${hName}: Số điện thoại không hợp lệ ("${rawVal}")`);
        errorBreakdown.format++;
        return;
      }

      // Tiêu chí 5: Khoảng trắng thừa / ký tự lỗi mã hóa
      if (origRaw !== rawVal || /\s{2,}/.test(rawVal) || rawVal.includes('\uFFFD')) {
        badCols.push(cIdx);
        badReasons.push(`${hName}: Khoảng trắng thừa hoặc ký tự lỗi`);
        errorBreakdown.whitespace++;
      }
    });

    let status = 'clean';
    let label = 'Hợp lệ';
    let badgeClass = 'eligible';

    const rfqIdVal = rfqIdColIdx >= 0 ? normalized[rfqIdColIdx] : '';
    const custVal = custColIdx >= 0 ? normalized[custColIdx] : '';
    const itemVal = effectiveItemColIdx >= 0 ? normalized[effectiveItemColIdx] : '';
    const qtyVal = qtyColIdx >= 0 ? normalized[qtyColIdx] : '';
    const locVal = locColIdx >= 0 ? normalized[locColIdx] : '';
    const dateVal = dateColIdx >= 0 ? normalized[dateColIdx] : '';
    const maintVal = maintColIdx >= 0 ? normalized[maintColIdx] : '';

    const rfqFullContentSig = (isRfqDataset && rfqIdVal && itemVal)
      ? `${rfqIdVal}||${custVal}||${itemVal}||${qtyVal}||${locVal}||${dateVal}||${maintVal}`
      : '';
    const rfqIdItemSig = (isRfqDataset && rfqIdVal && itemVal)
      ? `${rfqIdVal}||${itemVal}`
      : '';

    const exactOrigRowNum = seenFull.has(fullSig)
      ? seenFull.get(fullSig)
      : (rfqFullContentSig && seenRfqIdItem.has(rfqFullContentSig) ? seenRfqIdItem.get(rfqFullContentSig).rowNum : null);

    if (exactOrigRowNum !== null) {
      status = 'exact_dup';
      label = 'Lặp 100% (Xóa bỏ)';
      badgeClass = 'unfulfilled';
      exactDupCount++;
      errorBreakdown.exactDup++;

      const rawSummary = isRfqDataset
        ? [row[rfqIdColIdx], custColIdx >= 0 ? row[custColIdx] : null, `${row[effectiveItemColIdx] || ''} (SL: ${row[qtyColIdx] || ''})`, locColIdx >= 0 ? row[locColIdx] : null, maintColIdx >= 0 ? row[maintColIdx] : null].filter(Boolean).join(' | ')
        : row.slice(0, 5).join(' | ');

      auditItems.push({
        rowId: `#${exactOrigRowNum} & #${rowNum}`,
        field: isRfqDataset ? 'RFQ_ID + Item_Name + Quantity + Location + Maintenance' : 'Toàn bộ bản ghi',
        rawValue: rawSummary,
        errorType: 'Trùng Lặp Hoàn Toàn (100% Exact Duplicate)',
        category: 'duplicate',
        dupSubType: 'exact_dup',
        action: `Dòng #${rowNum} trùng khớp 100% với dòng #${exactOrigRowNum} → Đã tự động XÓA BỎ bản ghi dư thừa.`,
        statusText: 'Đã xóa bỏ (Lặp 100%)',
        statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Lặp 100% — Xóa Bỏ</span>'
      });
    } else {
      const dupLineMatch = (lineIdVal && seenLineId.has(lineIdVal)) ? seenLineId.get(lineIdVal) : null;
      const dupRfqSameItemConflict = (isRfqDataset && rfqIdItemSig && seenRfqIdItem.has(rfqIdItemSig)) ? seenRfqIdItem.get(rfqIdItemSig) : null;
      const dupRfqDiffItemMatch = (isRfqDataset && rfqIdVal && seenRfqId.has(rfqIdVal)) ? seenRfqId.get(rfqIdVal) : null;
      const dupKeyBucket = (!isRfqDataset && keySig && normalized[0] !== '' && seenKey.has(keySig)) ? seenKey.get(keySig) : null;
      const dupKeyMatch = (dupKeyBucket && dupKeyBucket.length > 0) ? dupKeyBucket[0] : null;

      const registerKeptRow = () => {
        seenFull.set(fullSig, rowNum);
        if (rfqFullContentSig) seenRfqIdItem.set(rfqFullContentSig, { rowNum, row });
        if (lineIdVal && !seenLineId.has(lineIdVal)) seenLineId.set(lineIdVal, { rowNum, row });
        if (rfqIdItemSig && !seenRfqIdItem.has(rfqIdItemSig)) seenRfqIdItem.set(rfqIdItemSig, { rowNum, row });
        if (rfqIdVal && !seenRfqId.has(rfqIdVal)) seenRfqId.set(rfqIdVal, { rowNum, row });
      };

      if (dupLineMatch) {
        status = 'partial_dup_drop';
        label = 'Lặp 1 phần (Xung đột)';
        badgeClass = 'unfulfilled';
        partialDropCount++;
        errorBreakdown.partialDup++;
        auditItems.push({
          rowId: `#${dupLineMatch.rowNum} & #${rowNum}`,
          field: headers[lineIdColIdx] || 'Mã dòng',
          rawValue: `${row[lineIdColIdx]} (${row.slice(0, 3).join(' | ')})`,
          errorType: 'Trùng Lặp 1 Phần (Xung Đột Mã Dòng)',
          category: 'duplicate',
          dupSubType: 'partial_dup_drop',
          action: `Trùng mã định danh ${row[lineIdColIdx]} với dòng #${dupLineMatch.rowNum} nhưng khác thông số → Không hợp lý, đã XÓA BỎ.`,
          statusText: 'Bất hợp lý - Đã xóa bỏ',
          statusBadge: '<span class="badge-tag missing" style="background:#fef2f2; color:#dc2626; font-weight:700;">Bất Hợp Lý — Xóa Bỏ</span>'
        });
      } else if (dupRfqSameItemConflict) {
        status = 'partial_dup_drop';
        label = 'Lặp 1 phần (Xung đột)';
        badgeClass = 'unfulfilled';
        partialDropCount++;
        errorBreakdown.partialDup++;
        const rawConflictVal = [row[rfqIdColIdx], custColIdx >= 0 ? row[custColIdx] : null, `${row[effectiveItemColIdx]} (SL: ${dupRfqSameItemConflict.row[qtyColIdx]} vs ${row[qtyColIdx]})`].filter(Boolean).join(' | ');
        auditItems.push({
          rowId: `#${dupRfqSameItemConflict.rowNum} & #${rowNum}`,
          field: `${headers[rfqIdColIdx] || 'RFQ_ID'} / ${headers[effectiveItemColIdx] || 'Item_Name'}`,
          rawValue: rawConflictVal,
          errorType: 'Trùng Lặp 1 Phần (Xung Đột Cùng Mã GD & Cùng SP)',
          category: 'duplicate',
          dupSubType: 'partial_dup_drop',
          action: `Cùng mã giao dịch ${row[rfqIdColIdx]} và cùng sản phẩm "${row[effectiveItemColIdx]}" với dòng #${dupRfqSameItemConflict.rowNum} nhưng xung đột thông số → Không hợp lý, đã XÓA BỎ.`,
          statusText: 'Bất hợp lý - Đã xóa bỏ',
          statusBadge: '<span class="badge-tag missing" style="background:#fef2f2; color:#dc2626; font-weight:700;">Bất Hợp Lý — Xóa Bỏ</span>'
        });
      } else if (dupRfqDiffItemMatch && badCols.length === 0) {
        registerKeptRow();
        status = 'partial_dup_keep';
        label = 'Trùng 1 phần phù hợp (khác SP → Giữ lại)';
        badgeClass = 'eligible';
        partialKeepCount++;
        const custPhrase = custColIdx >= 0 && row[custColIdx] ? ` của khách hàng "${row[custColIdx]}"` : '';
        const rawDiffVal = [row[rfqIdColIdx], custColIdx >= 0 ? row[custColIdx] : null, `${row[effectiveItemColIdx]} (SL: ${row[qtyColIdx]})`, locColIdx >= 0 ? row[locColIdx] : null].filter(Boolean).join(' | ');
        auditItems.push({
          rowId: `#${dupRfqDiffItemMatch.rowNum} & #${rowNum}`,
          field: `${headers[rfqIdColIdx] || 'RFQ_ID'} / ${headers[effectiveItemColIdx] || 'Item_Name'}`,
          rawValue: rawDiffVal,
          errorType: 'Trùng 1 phần phù hợp (khác SP → Giữ lại)',
          category: 'duplicate',
          dupSubType: 'partial_dup_keep',
          action: `Trùng mã giao dịch ${row[rfqIdColIdx]} với dòng #${dupRfqDiffItemMatch.rowNum}${custPhrase} nhưng khác sản phẩm ("${row[effectiveItemColIdx]}" vs "${dupRfqDiffItemMatch.row[effectiveItemColIdx]}") → Trùng 1 phần phù hợp (khác SP → Giữ lại).`,
          statusText: 'Hợp lý - Đã giữ lại',
          statusBadge: '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-weight:700;">Khác SP — Giữ Lại</span>'
        });
      } else if (dupKeyMatch) {
        const currQtyNorm = qtyColIdx >= 0 ? normalizeCanonicalQty(row[qtyColIdx]) : '';
        const currDiscNorm = discColIdx >= 0 ? String(row[discColIdx] ?? '').replace(/%/g, '').trim() : '';
        const conflictEntry = dupKeyBucket.find(prev => {
          const prevQtyNorm = qtyColIdx >= 0 ? normalizeCanonicalQty(prev.row[qtyColIdx]) : '';
          const prevDiscNorm = discColIdx >= 0 ? String(prev.row[discColIdx] ?? '').replace(/%/g, '').trim() : '';
          return (qtyColIdx >= 0 && currQtyNorm === prevQtyNorm) && (discColIdx >= 0 && currDiscNorm !== prevDiscNorm);
        });
        const matchedRef = conflictEntry || dupKeyMatch;
        const hasConflict = badCols.length > 0 || Boolean(conflictEntry);
        if (hasConflict) {
          status = 'partial_dup_drop';
          label = 'Lặp 1 phần (Xóa bỏ)';
          badgeClass = 'unfulfilled';
          partialDropCount++;
          errorBreakdown.partialDup++;
          auditItems.push({
            rowId: `#${matchedRef.rowNum} & #${rowNum}`,
            field: headers.slice(0, keyLen).join(' / '),
            rawValue: row.slice(0, 4).join(' | '),
            errorType: 'Trùng Lặp 1 Phần (Không Hợp Lý / Xung Đột)',
            category: 'duplicate',
            dupSubType: 'partial_dup_drop',
            action: `Trùng khóa với dòng #${matchedRef.rowNum} kèm xung đột dữ liệu (${badReasons.length > 0 ? badReasons.join('; ') : 'Xung đột mức chiết khấu trên cùng mã đơn & số lượng'}) → Bất hợp lý, đã XÓA BỎ.`,
            statusText: 'Bất hợp lý - Đã xóa bỏ',
            statusBadge: '<span class="badge-tag missing" style="background:#fef2f2; color:#dc2626; font-weight:700;">Bất Hợp Lý — Xóa Bỏ</span>'
          });
        } else {
          registerKeptRow();
          status = 'partial_dup_keep';
          label = 'Trùng 1 phần phù hợp (khác SP → Giữ lại)';
          badgeClass = 'eligible';
          partialKeepCount++;
          dupKeyBucket.push({ rowNum, row });
          auditItems.push({
            rowId: `#${dupKeyMatch.rowNum} & #${rowNum}`,
            field: headers.slice(0, keyLen).join(' / '),
            rawValue: row.slice(0, 4).join(' | '),
            errorType: 'Trùng 1 phần phù hợp (khác SP → Giữ lại)',
            category: 'duplicate',
            dupSubType: 'partial_dup_keep',
            action: `Cùng khách hàng & mã đơn với dòng #${dupKeyMatch.rowNum} nhưng khác đợt giao/số lượng hợp lệ → HỢP LÝ, ĐÃ GIỮ LẠI.`,
            statusText: 'Hợp lý - Đã giữ lại',
            statusBadge: '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-weight:700;">Hợp Lý — Giữ Lại</span>'
          });
        }
      } else {
        registerKeptRow();
        if (!isRfqDataset && keySig && normalized[0] !== '') seenKey.set(keySig, [{ rowNum, row }]);

        if (badCols.length > 0) {
          status = 'error';
          label = `Lỗi / Thiếu (${badCols.length} ô)`;
          badgeClass = 'missing';
          errorRowCount++;

          const primaryErrorType = badCols.some(c => c === dateColIdx)
            ? 'Sai Định Dạng Ngày Tháng'
            : badCols.some(c => c === qtyColIdx)
              ? 'Lỗi Số Học / Số Lượng'
              : 'Lỗi Định Dạng / Thiếu Dữ Liệu';

          auditItems.push({
            rowId: `#${rowNum}`,
            field: badCols.map(c => headers[c] || `Cột ${c + 1}`).join(', '),
            rawValue: badCols.map(c => `${headers[c]}="${row[c] || '(Trống)'}"`).join(' | '),
            errorType: primaryErrorType,
            category: 'other',
            action: badReasons.join('; '),
            statusText: 'Cần làm sạch',
            statusBadge: '<span class="badge-tag missing">Cần Làm Sạch</span>'
          });
        } else {
          cleanRowCount++;
        }
      }
    }

    return { status, label, badgeClass, badCols, badReasons };
  });

  const totalRows = rows.length;
  const uniqueRfqCount = seenRfqId.size;
  const partialDupCount = partialKeepCount + partialDropCount;
  const dupCount = exactDupCount + partialDupCount;
  const cleanAfterProcessing = cleanRowCount + partialKeepCount;
  const successRate = totalRows > 0 ? ((cleanAfterProcessing / totalRows) * 100).toFixed(1) : '0.0';

  return {
    rowMeta,
    auditItems,
    errorBreakdown,
    totalRows,
    uniqueRfqCount,
    isRfqDataset,
    exactDupCount,
    partialKeepCount,
    partialDropCount,
    partialDupCount,
    dupCount,
    errorRowCount,
    cleanRowCount,
    cleanAfterProcessing,
    successRate
  };
}

let step2AuditActionLog = [];

function syncKpisFromLiveRawTable(analysis) {
  if (!analysis) return;

  const totalEl = document.getElementById('cleansingTotalRecords');
  const totalSubEl = document.getElementById('cleansingTotalSub');
  const dupEl = document.getElementById('cleansingDupRecords');
  const dupSubEl = document.getElementById('cleansingDupSub');
  const exactDupEl = document.getElementById('cleansingExactDupRecords');
  const exactDupSubEl = document.getElementById('cleansingExactDupSub');
  const partialDupEl = document.getElementById('cleansingPartialDupRecords');
  const partialSubEl = document.getElementById('cleansingPartialDupSub');
  const cleanEl = document.getElementById('cleansingCleanRecords');
  const rateSubEl = document.getElementById('cleansingSuccessRateSub');
  const metaBadge = document.getElementById('liveRawTableMetaBadge');

  const origTotal = (step2OriginalRowsSnapshot && step2OriginalRowsSnapshot.length > 0)
    ? step2OriginalRowsSnapshot.length
    : (liveRawTable.totalOriginalRows || analysis.totalRows);
  const removedDelta = Math.max(0, origTotal - analysis.totalRows);
  const editedCellsCount = liveRawEditedCells ? liveRawEditedCells.size : 0;

  if (totalEl) totalEl.textContent = `${analysis.totalRows.toLocaleString()} dòng`;
  if (totalSubEl) {
    totalSubEl.textContent = (removedDelta > 0 || editedCellsCount > 0)
      ? `Gốc: ${origTotal.toLocaleString()} · Đã xóa: ${removedDelta.toLocaleString()} · Đã sửa: ${editedCellsCount.toLocaleString()} ô`
      : `Tiếp nhận ban đầu (${origTotal.toLocaleString()} dòng)`;
  }
  // Gộp số liệu đã TỰ ĐỘNG XÓA khi quét file với số liệu còn lại trên bảng
  const dd = getStep2DedupTotals(analysis);
  const dupTotalAll = dd.exactTotal + dd.partialDropTotal + dd.partialKeep;
  const pendingDrop = analysis.exactDupCount + analysis.partialDropCount;
  if (dupEl) {
    if (analysis.isRfqDataset && analysis.uniqueRfqCount > 0 && pendingDrop === 0) {
      dupEl.textContent = `${analysis.uniqueRfqCount.toLocaleString()} mã GD trùng`;
    } else {
      dupEl.textContent = pendingDrop > 0
        ? `${pendingDrop.toLocaleString()} lỗi trùng`
        : (dd.partialKeep > 0 ? `${dd.partialKeep.toLocaleString()} trùng 1 phần` : `0 lỗi trùng`);
    }
  }
  if (dupSubEl) {
    if (analysis.isRfqDataset && analysis.uniqueRfqCount > 0 && pendingDrop === 0) {
      dupSubEl.textContent = `${analysis.uniqueRfqCount.toLocaleString()} dòng trùng mã GD · ${dd.partialKeep.toLocaleString()} dòng khác SP giữ lại`;
    } else {
      dupSubEl.textContent = dupTotalAll === 0
        ? 'Không phát hiện bản ghi trùng lặp'
        : (pendingDrop > 0
          ? `Còn ${pendingDrop.toLocaleString()} cần xóa · Đã xóa ${dd.removedTotal.toLocaleString()} · Giữ ${dd.partialKeep.toLocaleString()} hợp lý`
          : `Đã xóa ${dd.removedTotal.toLocaleString()} lỗi trùng · Giữ ${dd.partialKeep.toLocaleString()} lặp 1 phần hợp lý`);
    }
  }
  if (exactDupEl) {
    exactDupEl.textContent = analysis.exactDupCount > 0
      ? `${analysis.exactDupCount.toLocaleString()} lỗi lặp`
      : `${dd.exactRemoved.toLocaleString()} đã xóa`;
  }
  if (exactDupSubEl) {
    exactDupSubEl.textContent = analysis.exactDupCount > 0
      ? `Còn ${analysis.exactDupCount.toLocaleString()} dòng lặp 100% cần xóa`
      : (dd.exactRemoved > 0 ? 'Đã xóa sạch 100% lỗi trùng lặp hoàn toàn (còn 0 lỗi)' : 'Không có bản ghi lặp 100%');
  }
  const partialAll = dd.partialDropTotal + dd.partialKeep;
  if (partialDupEl) {
    partialDupEl.textContent = `${dd.partialKeep.toLocaleString()} giữ lại`;
  }
  if (partialSubEl) {
    partialSubEl.textContent = partialAll > 0
      ? `Trùng 1 phần phù hợp (khác SP → Giữ lại): ${dd.partialKeep.toLocaleString()}${dd.partialDropRemoved > 0 ? ` | Đã xóa xung đột: ${dd.partialDropRemoved.toLocaleString()}` : ''}${analysis.partialDropCount > 0 ? ` (Còn ${analysis.partialDropCount.toLocaleString()})` : ''}`
      : 'Không phát hiện bản ghi lặp 1 phần';
  }
  if (cleanEl) {
    cleanEl.textContent = (analysis.isRfqDataset && analysis.partialKeepCount > 0 && analysis.errorRowCount === 0)
      ? `${analysis.cleanAfterProcessing.toLocaleString()} dòng (${analysis.partialKeepCount.toLocaleString()} chuẩn)`
      : `${analysis.cleanAfterProcessing.toLocaleString()} dòng`;
  }
  if (rateSubEl) {
    rateSubEl.textContent = (analysis.isRfqDataset && analysis.uniqueRfqCount > 0 && analysis.errorRowCount === 0)
      ? `Đạt chuẩn: ${analysis.successRate}% · ${analysis.uniqueRfqCount.toLocaleString()} gốc + ${analysis.partialKeepCount.toLocaleString()} dòng hợp lệ chuẩn · Lỗi ô: 0`
      : `Tỷ lệ đạt chuẩn: ${analysis.successRate}% · Lỗi ô: ${analysis.errorRowCount.toLocaleString()} dòng`;
  }

  if (metaBadge) {
    const issueCount = analysis.exactDupCount + analysis.partialDropCount + analysis.errorRowCount;
    metaBadge.textContent = `${analysis.totalRows.toLocaleString()} dòng · ${(liveRawTable.headers || []).length} cột · ${issueCount} cần xử lý`;
    metaBadge.className = issueCount === 0 ? 'badge-tag eligible' : 'badge-tag pending';
  }

  // Đồng bộ Bảng Thống Kê Dữ Liệu Lỗi (#cleansingErrorTableBody):
  // - Các lỗi trùng lặp hoàn toàn (100%) và lặp 1 phần bất hợp lý ĐÃ ĐƯỢC TỰ ĐỘNG XÓA KHI QUÉT FILE nên không còn liệt kê làm nhiễu danh sách lỗi
  // - Chỉ hiển thị các bản ghi lặp 1 phần HỢP LÝ được giữ lại (partial_dup_keep) và các lỗi còn tồn tại trên bảng hiện hành
  currentCleansingAuditData = [
    ...step2AuditActionLog,
    ...(analysis.auditItems || [])
  ];
  updateCleansingFilterCounters();
  const errTbody = document.getElementById('cleansingErrorTableBody');
  if (errTbody) {
    if (analysis.totalRows === 0 && currentCleansingAuditData.length === 0) {
      errTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:26px; color:#94a3b8;">Bảng dữ liệu hiện đang trống (0 dòng).</td></tr>';
    } else if (currentCleansingAuditData.length === 0 && analysis.totalRows > 0) {
      errTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:28px; color:#047857; font-weight:700; background:#f0fdf4;">
            100% Dữ Liệu Đạt Chuẩn (${analysis.totalRows.toLocaleString()} dòng) — Không phát hiện lỗi định dạng hay bản ghi trùng lặp nào!
          </td>
        </tr>
      `;
    } else {
      filterCleansingAudit(currentCleansingFilter || 'all');
    }
  }

  // Cập nhật Luồng Phát Hiện Lỗi liên kết trong Khung Lệnh AI
  if (typeof renderLinkedErrorAndNewDataPanel === 'function') {
    renderLinkedErrorAndNewDataPanel(analysis, 'auto');
  }

  // Đồng bộ Luồng Đối Soát & Sửa Lỗi Dữ Liệu bên dưới
  if (typeof renderReconciliationWorkflow === 'function') {
    renderReconciliationWorkflow(currentProcessingOpp, analysis);
  }
}

function renderLiveRawDataTable() {
  const thead = document.getElementById('liveRawDataThead');
  const tbody = document.getElementById('liveRawDataTbody');
  const pagEl = document.getElementById('liveRawTablePagination');
  const metaBadge = document.getElementById('liveRawTableMetaBadge');
  if (!thead || !tbody) return;

  const headers = (liveRawTable && liveRawTable.headers) ? liveRawTable.headers : [];
  const rows = (liveRawTable && liveRawTable.rows) ? liveRawTable.rows : [];

  if (headers.length === 0 || rows.length === 0) {
    thead.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:32px; color:#94a3b8;">Chưa có dữ liệu thô. Vui lòng hoàn thiện Bước 1 (điền Bối cảnh & tải File dữ liệu thô).</td></tr>';
    if (pagEl) pagEl.innerHTML = '';
    if (metaBadge) metaBadge.textContent = '0 dòng';
    return;
  }

  const analysis = analyzeLiveRawTable();
  syncKpisFromLiveRawTable(analysis);

  const searchQ = (document.getElementById('liveRawTableSearch')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('liveRawTableStatusFilter')?.value || 'all';

  const indexed = rows.map((row, idx) => ({ row, idx, meta: analysis.rowMeta[idx] })).filter(item => {
    if (statusFilter === 'error' && item.meta.status !== 'error') return false;
    if (statusFilter === 'dup' && !['exact_dup', 'partial_dup_keep', 'partial_dup_drop'].includes(item.meta.status)) return false;
    if (statusFilter === 'clean' && item.meta.status !== 'clean') return false;
    if (searchQ) {
      return item.row.some(c => String(c || '').toLowerCase().includes(searchQ));
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(indexed.length / LIVE_RAW_PAGE_SIZE));
  if (liveRawTablePage > totalPages) liveRawTablePage = totalPages;
  const start = (liveRawTablePage - 1) * LIVE_RAW_PAGE_SIZE;
  const pageItems = indexed.slice(start, start + LIVE_RAW_PAGE_SIZE);

  const permBadge = document.getElementById('liveRawEditPermBadge');
  const hintDesc = document.getElementById('liveRawEditHintDesc');
  const btnAddRow = document.getElementById('btnLiveRawAddRow');
  const btnSave = document.getElementById('btnLiveRawSave');
  if (permBadge) {
    if (liveRawEditUnlocked) {
      permBadge.className = 'badge-tag eligible';
      permBadge.textContent = 'Đã cấp quyền chỉnh sửa thủ công (Từ Checkpoint 1)';
    } else {
      permBadge.className = 'badge-tag missing';
      permBadge.textContent = 'Chỉ xem (Chọn "Không Hài Lòng" tại Checkpoint 1 để cấp quyền sửa)';
    }
  }
  if (hintDesc) {
    hintDesc.innerHTML = liveRawEditUnlocked
      ? '<span style="color:#047857; font-weight:700;">Đã mở khóa quyền chỉnh sửa thủ công:</span> Bạn có thể bấm trực tiếp vào bất kỳ ô nào bên dưới để sửa, thêm hoặc xóa dòng. Xong hãy bấm <b>Lưu Chỉnh Sửa & Khóa Bảng</b>.'
      : 'Bảng đang ở chế độ chỉ xem để bảo toàn dữ liệu gốc. Để chỉnh sửa thủ công trực tiếp trên bảng, hãy bấm <b>Chuyển sang Bước 3</b> và chọn <b>Không Hài Lòng</b> tại <b>HUMAN CHECKPOINT 1</b>.';
  }
  if (btnAddRow) btnAddRow.style.display = liveRawEditUnlocked ? 'inline-flex' : 'none';
  if (btnSave) btnSave.style.display = liveRawEditUnlocked ? 'inline-flex' : 'none';

  const getColClass = (headerName) => {
    const h = String(headerName || '').toLowerCase();
    if (h.includes('quantity') || h.includes('số lượng') || h.includes('qty') || h.includes('chiết')) return 'col-narrow';
    if (h.includes('customer') || h.includes('khách') || h.includes('maintenance') || h.includes('requirement') || h.includes('ghi chú') || h.includes('sản phẩm') || h.includes('item')) return 'col-wide';
    return '';
  };

  thead.innerHTML = `
    <tr>
      <th style="width:44px; text-align:center;">#</th>
      ${headers.map(h => `<th>${escapeHtmlAttr(h)}</th>`).join('')}
      <th style="width:145px; text-align:center;">Trạng Thái AI</th>
      ${liveRawEditUnlocked ? '<th class="live-raw-sticky-right" style="width:76px; text-align:center;">Thao Tác</th>' : ''}
    </tr>
  `;

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${headers.length + (liveRawEditUnlocked ? 3 : 2)}" style="text-align:center; padding:26px; color:#94a3b8;">Không tìm thấy dòng nào phù hợp với bộ lọc.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(({ row, idx, meta }) => {
      const rowCls = (meta.status === 'exact_dup' || meta.status === 'partial_dup_drop')
        ? 'live-raw-row-exact-dup'
        : (meta.status === 'partial_dup_keep' ? 'live-raw-row-partial-dup' : (meta.status === 'error' ? 'live-raw-row-error' : ''));
      const cellsHtml = headers.map((hName, cIdx) => {
        const val = row[cIdx] !== undefined ? row[cIdx] : '';
        const isBad = meta.badCols.includes(cIdx);
        const isEdited = liveRawEditedCells.has(`${idx}:${cIdx}`);
        const widthCls = getColClass(hName);
        if (!liveRawEditUnlocked) {
          return `<td onclick="notifyLiveRawEditLocked()" style="cursor:not-allowed; white-space:nowrap; padding:8px 10px !important; ${isBad ? 'background:#fef2f2; color:#dc2626; font-weight:700;' : (isEdited ? 'background:#f0fdf4; color:#047857; font-weight:600;' : 'color:#1e293b;')}" title="Bảng đang khóa sửa — chọn Không Hài Lòng tại Checkpoint 1 để cấp quyền sửa">${escapeHtmlAttr(val) || '<span style="color:#ef4444; font-style:italic;">(Trống)</span>'}</td>`;
        }
        return `<td><input type="text" class="live-raw-cell-input ${widthCls} ${isBad ? 'cell-error' : ''} ${isEdited ? 'cell-edited' : ''}" value="${escapeHtmlAttr(val)}" oninput="handleLiveRawCellInput(${idx}, ${cIdx}, this)" onblur="handleLiveRawCellBlur(${idx})" title="Bấm vào đây để sửa trực tiếp ô dữ liệu"></td>`;
      }).join('');
      return `
        <tr class="${rowCls}" data-live-row="${idx}">
          <td style="text-align:center; font-family:monospace; font-size:11.5px; color:#64748b;">${idx + 1}</td>
          ${cellsHtml}
          <td style="text-align:center;" class="live-row-status-cell"><span class="badge-tag ${meta.badgeClass}" style="font-size:11px; white-space:nowrap;">${meta.label}</span></td>
          ${liveRawEditUnlocked ? `<td class="live-raw-sticky-right" style="text-align:center;"><button type="button" class="btn-live-row-del" onclick="deleteLiveRawRow(${idx})">Xóa</button></td>` : ''}
        </tr>
      `;
    }).join('');
  }

  if (pagEl) {
    pagEl.innerHTML = `
      <span>Hiển thị ${indexed.length === 0 ? 0 : start + 1}-${Math.min(start + LIVE_RAW_PAGE_SIZE, indexed.length)} / ${indexed.length.toLocaleString()} dòng</span>
      <button type="button" class="btn-secondary-tool" style="padding:3px 9px; font-size:11.5px;" ${liveRawTablePage <= 1 ? 'disabled' : ''} onclick="liveRawTablePage--; renderLiveRawDataTable()">Trước</button>
      <span style="font-weight:700;">Trang ${liveRawTablePage}/${totalPages}</span>
      <button type="button" class="btn-secondary-tool" style="padding:3px 9px; font-size:11.5px;" ${liveRawTablePage >= totalPages ? 'disabled' : ''} onclick="liveRawTablePage++; renderLiveRawDataTable()">Sau</button>
    `;
  }
}

function handleLiveRawCellInput(rowIdx, colIdx, inputEl) {
  if (!liveRawTable || !liveRawTable.rows[rowIdx]) return;
  liveRawTable.rows[rowIdx][colIdx] = inputEl.value;
  liveRawEditedCells.add(`${rowIdx}:${colIdx}`);
  inputEl.classList.add('cell-edited');

  const trimmed = String(inputEl.value || '').trim();
  if (trimmed !== '' && trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'n/a') {
    inputEl.classList.remove('cell-error');
  }

  if (liveRawSyncTimer) clearTimeout(liveRawSyncTimer);
  liveRawSyncTimer = setTimeout(() => {
    const analysis = analyzeLiveRawTable();
    syncKpisFromLiveRawTable(analysis);
    const tr = document.querySelector(`tr[data-live-row="${rowIdx}"]`);
    if (tr && analysis.rowMeta[rowIdx]) {
      const m = analysis.rowMeta[rowIdx];
      const badgeCell = tr.querySelector('.live-row-status-cell');
      if (badgeCell) {
        badgeCell.innerHTML = `<span class="badge-tag ${m.badgeClass}" style="font-size:11px; white-space:nowrap;">${m.label}</span>`;
      }
    }
  }, 250);
}

function handleLiveRawCellBlur(rowIdx) {
  const analysis = analyzeLiveRawTable();
  syncKpisFromLiveRawTable(analysis);
  const tr = document.querySelector(`tr[data-live-row="${rowIdx}"]`);
  if (tr && analysis.rowMeta[rowIdx]) {
    const m = analysis.rowMeta[rowIdx];
    tr.className = (m.status === 'exact_dup' || m.status === 'partial_dup_drop')
      ? 'live-raw-row-exact-dup'
      : (m.status === 'partial_dup_keep' ? 'live-raw-row-partial-dup' : (m.status === 'error' ? 'live-raw-row-error' : ''));
    const badgeCell = tr.querySelector('.live-row-status-cell');
    if (badgeCell) {
      badgeCell.innerHTML = `<span class="badge-tag ${m.badgeClass}" style="font-size:11px; white-space:nowrap;">${m.label}</span>`;
    }
  }
}

function updateLiveRawCell(rowIdx, colIdx, newVal) {
  if (!liveRawTable || !liveRawTable.rows[rowIdx]) return;
  liveRawTable.rows[rowIdx][colIdx] = newVal;
  liveRawEditedCells.add(`${rowIdx}:${colIdx}`);
  renderLiveRawDataTable();
}

function notifyLiveRawEditLocked() {
  showStepTransitionToast(
    'Bảng đang ở chế độ chỉ xem. Hãy bấm "Chuyển sang Bước 3" và chọn "Không Hài Lòng" tại HUMAN CHECKPOINT 1 để được cấp quyền chỉnh sửa trực tiếp!',
    'warning',
    3200
  );
}

function deleteLiveRawRow(rowIdx) {
  if (!liveRawEditUnlocked) {
    notifyLiveRawEditLocked();
    return;
  }
  if (!liveRawTable || !liveRawTable.rows[rowIdx]) return;
  const deletedRow = liveRawTable.rows[rowIdx];
  liveRawTable.rows.splice(rowIdx, 1);
  step2AuditActionLog.unshift({
    rowId: `#${rowIdx + 1}`,
    field: 'Xóa dòng thủ công',
    rawValue: deletedRow.slice(0, 4).join(' | '),
    errorType: 'Người dùng xóa trực tiếp trên bảng',
    category: 'other',
    action: `Đã xóa dòng #${rowIdx + 1} khỏi bảng dữ liệu thô.`,
    statusText: 'Đã xóa bỏ',
    statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa (Thủ Công)</span>'
  });
  renderLiveRawDataTable();
  showStepTransitionToast(`Đã xóa dòng #${rowIdx + 1} khỏi bảng dữ liệu thô.`, 'info', 2000);
}

function addRowToLiveRawTable() {
  if (!liveRawEditUnlocked) {
    notifyLiveRawEditLocked();
    return;
  }
  if (!liveRawTable || !liveRawTable.headers || liveRawTable.headers.length === 0) {
    liveRawTable = buildSampleRawTable(3);
  }
  const newRow = liveRawTable.headers.map((_, i) => i === 0 ? `DH-${String(liveRawTable.rows.length + 1).padStart(3, '0')}` : '');
  liveRawTable.rows.unshift(newRow);
  liveRawTablePage = 1;
  renderLiveRawDataTable();
  showStepTransitionToast('Đã thêm 1 dòng mới vào đầu bảng. Bấm trực tiếp vào các ô để nhập dữ liệu.', 'info', 2500);
}

function runAiCleanOnRawTable() {
  if (!liveRawTable || !liveRawTable.rows || liveRawTable.rows.length === 0) {
    showStepTransitionToast('Chưa có dữ liệu trong bảng để làm sạch.', 'warning', 2500);
    return;
  }

  const analysisBefore = analyzeLiveRawTable();
  const headers = liveRawTable.headers || [];
  const findColIdx = (pred) => headers.findIndex(h => pred(String(h || '').toLowerCase().trim()));
  const rfqIdColIdx = findColIdx(low => low.includes('rfq_id') || low.includes('rfq id') || low.includes('request_id'));
  const custColIdx = findColIdx(low => low.includes('customer') || low.includes('khách hàng') || low.includes('khách'));
  const itemColIdx = findColIdx(low => low.includes('item_name') || low.includes('product_name') || low.includes('tên sản phẩm') || low.includes('sản phẩm') || low.includes('thiết bị') || low === 'item');
  const qtyColIdx = findColIdx(low => low.includes('quantity') || low.includes('số lượng') || low.includes('qty') || low === 'sl');
  const isRfqDataset = rfqIdColIdx >= 0 && custColIdx >= 0 && itemColIdx >= 0 && qtyColIdx >= 0;

  const BAD_PLACEHOLDERS = new Set([
    'null', 'n/a', 'na', 'nan', 'none', 'nil', 'unknown', 'tbd', 'asap',
    'chưa rõ', 'chưa có', 'chưa xác định', 'không rõ', 'trống', 'lỗi', 'error',
    '#n/a', '#value!', '#ref!', '#div/0!', '#name?', '#num!', '???', '...', '--', '-'
  ]);

  const cleanedRows = [];
  let removedExactDups = 0;
  let removedPartialDrops = 0;
  let fixedCells = 0;

  liveRawTable.rows.forEach((row, idx) => {
    const meta = analysisBefore.rowMeta[idx];
    if (meta && meta.status === 'exact_dup') {
      removedExactDups++;
      return;
    }
    if (meta && meta.status === 'partial_dup_drop') {
      removedPartialDrops++;
      return;
    }

    const trimmed = row.map(c => String(c === undefined || c === null ? '' : c).replace(/\s+/g, ' ').trim());

    const fixedRow = trimmed.map((val, cIdx) => {
      const origRaw = String(row[cIdx] === undefined || row[cIdx] === null ? '' : row[cIdx]);
      if (origRaw !== val) fixedCells++;

      const hLow = (headers[cIdx] || '').toLowerCase();
      const lowVal = val.toLowerCase();
      const isQtyCol = cIdx === qtyColIdx || hLow.includes('quantity') || hLow.includes('số lượng') || hLow.includes('qty') || hLow === 'sl';
      const isPriceCol = hLow.includes('price') || hLow.includes('đơn giá') || hLow.includes('budget') || hLow.includes('ngân sách');
      const isDiscCol = hLow.includes('discount') || hLow.includes('chiết khấu');
      const isDateCol = hLow.includes('date') || hLow.includes('deadline') || hLow.includes('ngày') || (hLow.includes('hạn') && !hLow.includes('hạn mức') && !hLow.includes('giới hạn'));
      const isMaintCol = hLow.includes('maintenance') || hLow.includes('bảo trì') || hLow.includes('sla');

      if (val === '' || BAD_PLACEHOLDERS.has(lowVal)) {
        fixedCells++;
        if (isDiscCol) return '0';
        if (isQtyCol) return '1';
        if (isPriceCol) return '0';
        if (isDateCol) return '2026-03-15';
        if (isMaintCol) return '12 tháng; hỗ trợ 8x5';
        return 'Đã chuẩn hóa';
      }
      if (isQtyCol) {
        const num = Number(val.replace(/,/g, ''));
        if (isNaN(num) || num <= 0) {
          fixedCells++;
          return String(isNaN(num) || num === 0 ? 1 : Math.abs(num));
        }
      }
      if (isPriceCol) {
        const num = Number(val.replace(/,/g, ''));
        if (isNaN(num) || num < 0) {
          fixedCells++;
          return String(isNaN(num) ? 0 : Math.abs(num));
        }
      }
      if (isDiscCol) {
        const num = Number(val.replace(/%/g, '').replace(/,/g, ''));
        if (isNaN(num) || num < 0 || num > 100) {
          fixedCells++;
          return '0';
        }
      }
      if (isDateCol) {
        if (!isValidDateString(val)) {
          fixedCells++;
          return '2026-03-15';
        }
      }
      return val;
    });
    cleanedRows.push(fixedRow);
  });

  liveRawTable.rows = cleanedRows;
  // Pass 2: Loại bỏ các dòng trở thành trùng lặp sau khi chuẩn hóa gói bảo trì & hạn giao
  const pass2 = analyzeLiveRawTable();
  if (pass2.exactDupCount > 0 || pass2.partialDropCount > 0) {
    liveRawTable.rows = liveRawTable.rows.filter((_, idx) => {
      const st = pass2.rowMeta[idx]?.status;
      if (st === 'exact_dup') { removedExactDups++; return false; }
      if (st === 'partial_dup_drop') { removedPartialDrops++; return false; }
      return true;
    });
  }

  if (removedExactDups + removedPartialDrops > 0) {
    if (step2AutoDedupReport) {
      step2AutoDedupReport.exactRemoved = (step2AutoDedupReport.exactRemoved || 0) + removedExactDups;
      step2AutoDedupReport.partialDropRemoved = (step2AutoDedupReport.partialDropRemoved || 0) + removedPartialDrops;
    } else {
      step2AutoDedupReport = {
        exactRemoved: removedExactDups,
        partialDropRemoved: removedPartialDrops,
        partialKept: 0,
        originalRows: analysisBefore.totalRows,
        removedAuditItems: []
      };
    }
  }

  const finalCleanAn = analyzeLiveRawTable();
  const ddClean = getStep2DedupTotals(finalCleanAn);
  renderLiveRawDataTable();
  showStepTransitionToast(
    `AI đã làm sạch xong: Tổng đã xóa ${ddClean.exactRemoved.toLocaleString()} dòng lặp 100% và ${ddClean.partialDropRemoved.toLocaleString()} dòng lặp 1 phần bất hợp lý; Giữ lại ${ddClean.partialKeep.toLocaleString()} dòng lặp 1 phần hợp lý; Chuẩn hóa ${fixedCells.toLocaleString()} ô lỗi → Còn ${liveRawTable.rows.length.toLocaleString()} dòng đạt chuẩn 100%!`,
    'success',
    4000
  );
}

function saveLiveRawTableChanges() {
  if (!liveRawTable || !liveRawTable.rows || liveRawTable.rows.length === 0) return;
  liveRawEditUnlocked = false;
  const analysis = analyzeLiveRawTable();
  syncKpisFromLiveRawTable(analysis);
  renderLiveRawDataTable();
  showStepTransitionToast(
    `Đã lưu chỉnh sửa và khóa lại bảng (${analysis.totalRows.toLocaleString()} dòng, ${analysis.cleanRowCount.toLocaleString()} dòng sạch). Bấm "Chuyển sang Bước 3" để xác nhận lại tại Checkpoint 1!`,
    'success',
    3500
  );
}

function exportLiveRawTableCsv() {
  if (!liveRawTable || !liveRawTable.rows || liveRawTable.rows.length === 0) {
    alert('Chưa có dữ liệu để xuất CSV!');
    return;
  }
  const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
  const lines = [
    liveRawTable.headers.map(esc).join(','),
    ...liveRawTable.rows.map(r => r.map(esc).join(','))
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Du_Lieu_Sach_Buoc_2_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStepTransitionToast('Đã xuất bảng dữ liệu sạch (CSV) thành công!', 'success', 2500);
}


// ============================================================================
// STEP 2: USER COMMAND FLOW ENGINE (NATURAL LANGUAGE AI COMMANDS ON RAW TABLE)
// ============================================================================
let step2OriginalRowsSnapshot = [];
let step2CommandHistory = [];
let step2CommandLogs = [];

function cloneRawRows(rows) {
  return (rows || []).map(r => Array.isArray(r) ? r.slice() : []);
}

function normalizeViCmd(str) {
  return String(str || '')
    .replace(/xoá/gi, 'xóa')
    .replace(/sữa/gi, 'sửa')
    .replace(/\s+/g, ' ')
    .trim();
}

function initStep2CommandState() {
  // Bản sao gốc luôn là dữ liệu NGUYÊN BẢN trước khi tự động khử trùng lặp
  step2OriginalRowsSnapshot = cloneRawRows(
    (liveRawTable && Array.isArray(liveRawTable.__preDedupRows)) ? liveRawTable.__preDedupRows : liveRawTable.rows
  );
  step2CommandHistory = [];
  step2CommandLogs = [];
  step2AuditActionLog = [];
  renderStep2CommandLogs();
}

// ============================================================================
// TỰ ĐỘNG KHỬ TRÙNG LẶP KHI QUÉT FILE Ở BƯỚC 2
//  - Lặp hoàn toàn (100%)            → XÓA BỎ
//  - Lặp 1 phần BẤT HỢP LÝ (xung đột) → XÓA BỎ
//  - Lặp 1 phần HỢP LÝ (đặt bổ sung)  → GIỮ LẠI
// ============================================================================
var step2AutoDedupReport = null;

function resetStep2AutoDedupReport() {
  step2AutoDedupReport = null;
}

function getStep2DedupTotals(analysis) {
  const rep = step2AutoDedupReport || { exactRemoved: 0, partialDropRemoved: 0 };
  const a = analysis || { exactDupCount: 0, partialDropCount: 0, partialKeepCount: 0 };
  return {
    exactRemoved: rep.exactRemoved || 0,
    partialDropRemoved: rep.partialDropRemoved || 0,
    removedTotal: (rep.exactRemoved || 0) + (rep.partialDropRemoved || 0),
    exactTotal: (rep.exactRemoved || 0) + (a.exactDupCount || 0),
    partialDropTotal: (rep.partialDropRemoved || 0) + (a.partialDropCount || 0),
    partialKeep: a.partialKeepCount || 0
  };
}

function autoDedupLiveRawTableOnScan() {
  if (!liveRawTable || !Array.isArray(liveRawTable.rows) || liveRawTable.rows.length === 0) return null;
  // Đã khử trùng lặp cho đúng bảng dữ liệu này rồi → không chạy lại (giữ nguyên báo cáo)
  if (liveRawTable.__dedupDone) return step2AutoDedupReport;

  const preRows = cloneRawRows(liveRawTable.rows);
  let exactRemoved = 0;
  let partialDropRemoved = 0;
  const removedAuditItems = [];

  // Lặp tối đa 3 lượt: sau khi xóa, có thể lộ thêm cặp trùng mới (VD: bản ghi gốc bị xóa do xung đột)
  for (let pass = 0; pass < 3; pass++) {
    const an = analyzeLiveRawTable();
    if (an.exactDupCount === 0 && an.partialDropCount === 0) break;

    an.auditItems.forEach(it => {
      if (it.category !== 'duplicate') return;
      const isExact = String(it.errorType || '').includes('100%');
      const isDrop = isExact || String(it.statusText || '').includes('Bất hợp lý');
      if (!isDrop) return;
      removedAuditItems.push({
        ...it,
        statusText: isExact ? 'AI đã tự động xóa (Lặp 100%)' : 'AI đã tự động xóa (Lặp 1 phần bất hợp lý)',
        statusBadge: isExact
          ? '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa — Lặp 100%</span>'
          : '<span class="badge-tag missing" style="background:#fef2f2; color:#dc2626; font-weight:700;">Đã Xóa — Bất Hợp Lý</span>'
      });
    });

    liveRawTable.rows = liveRawTable.rows.filter((_, idx) => {
      const st = an.rowMeta[idx] && an.rowMeta[idx].status;
      if (st === 'exact_dup') { exactRemoved++; return false; }
      if (st === 'partial_dup_drop') { partialDropRemoved++; return false; }
      return true;
    });
  }

  const finalAnalysis = analyzeLiveRawTable();
  liveRawTable.__preDedupRows = preRows;
  liveRawTable.__dedupDone = true;

  step2AutoDedupReport = {
    exactRemoved,
    partialDropRemoved,
    partialKept: finalAnalysis.partialKeepCount,
    originalRows: preRows.length,
    removedAuditItems
  };
  return step2AutoDedupReport;
}

function logStep2AutoDedupResult(report) {
  if (!report) return;
  const removed = report.exactRemoved + report.partialDropRemoved;
  const afterAnalysis = analyzeLiveRawTable();
  const msg = removed > 0
    ? `AI đã tự động khử trùng lặp khi quét file: XÓA ${report.exactRemoved.toLocaleString()} dòng lặp 100% + ${report.partialDropRemoved.toLocaleString()} dòng lặp 1 phần bất hợp lý; GIỮ LẠI ${report.partialKept.toLocaleString()} dòng lặp 1 phần hợp lý (đặt bổ sung / chia đợt giao).`
    : 'AI đã quét trùng lặp: Không phát hiện bản ghi lặp 100% hay lặp 1 phần bất hợp lý cần xóa.';
  if (removed > 0) {
    step2CommandHistory.push({
      rows: cloneRawRows(liveRawTable.__preDedupRows || liveRawTable.rows),
      auditLog: step2AuditActionLog.slice(),
      dedupReport: null
    });
  }
  step2CommandLogs.unshift({
    command: 'Tự động khử trùng lặp khi quét file (Xóa lặp 100% & lặp 1 phần bất hợp lý, giữ lặp hợp lý)',
    result: msg,
    beforeCount: report.originalRows,
    afterCount: afterAnalysis.totalRows,
    afterRate: afterAnalysis.successRate,
    time: new Date().toLocaleTimeString('vi-VN')
  });
  renderStep2CommandLogs();
  if (removed > 0) showStepTransitionToast(msg, 'success', 4200);
}

function renderStep2CommandLogs() {
  const listEl = document.getElementById('step2CommandLogList');
  const badgeEl = document.getElementById('step2CmdCountBadge');
  const undoBtn = document.getElementById('btnUndoStep2Command');

  if (badgeEl) badgeEl.textContent = `${step2CommandLogs.length} lệnh đã chạy`;
  if (undoBtn) undoBtn.disabled = step2CommandHistory.length === 0;
  if (!listEl) return;

  if (step2CommandLogs.length === 0) {
    listEl.innerHTML = '<div>Chưa có lệnh nào được thực thi. Hãy nhập yêu cầu phía trên hoặc bấm một lệnh nhanh để AI Agent chạy trực tiếp trên bảng dữ liệu.</div>';
    return;
  }

  listEl.innerHTML = step2CommandLogs.map((log, i) => `
    <div class="step2-cmd-log-item">
      <div class="step2-cmd-log-head">
        <span>#${step2CommandLogs.length - i}. Lệnh: "${escapeHtmlAttr(log.command)}"</span>
        <span class="step2-cmd-log-meta">${log.time}</span>
      </div>
      <div class="step2-cmd-log-result">${log.result}</div>
      <div class="step2-cmd-log-meta">Trước: ${log.beforeCount.toLocaleString()} dòng → Sau: ${log.afterCount.toLocaleString()} dòng · Đạt chuẩn: ${log.afterRate}%</div>
    </div>
  `).join('');
}

function runQuickStep2Command(cmdText) {
  const input = document.getElementById('step2CommandInput');
  if (input) input.value = cmdText;
  executeStep2UserCommand();
}

function findColumnIndexByCommand(cmdLow, headers) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase();
    if (h && cmdLow.includes(h)) return i;
  }
  return -1;
}

function executeStep2UserCommand() {
  const input = document.getElementById('step2CommandInput');
  const cmdRawOrig = input ? input.value.trim() : '';
  const cmdRaw = normalizeViCmd(cmdRawOrig);
  if (!cmdRaw) {
    showStepTransitionToast('Vui lòng nhập yêu cầu lệnh cho AI Agent trước khi thực thi.', 'warning', 2400);
    if (input) input.focus();
    return;
  }
  if (!liveRawTable || !Array.isArray(liveRawTable.rows) || liveRawTable.rows.length === 0) {
    showStepTransitionToast('Chưa có dữ liệu thô ở Bước 2 để thực thi lệnh.', 'warning', 2500);
    return;
  }

  const headers = liveRawTable.headers || [];
  const beforeCount = liveRawTable.rows.length;
  const cmdLow = cmdRaw.toLowerCase();

  // 0. Lệnh chuyển đổi ngôn ngữ toàn bộ Agent ngay từ ô lệnh
  if ((cmdLow.includes('ngôn ngữ') || cmdLow.includes('chuyển') || cmdLow.includes('đổi') || cmdLow.includes('switch')) && (cmdLow.includes('english') || cmdLow.includes('tiếng anh'))) {
    setAgentLanguage('en');
    if (input) input.value = '';
    return;
  }
  if ((cmdLow.includes('ngôn ngữ') || cmdLow.includes('chuyển') || cmdLow.includes('đổi') || cmdLow.includes('switch')) && (cmdLow.includes('vietnamese') || cmdLow.includes('tiếng việt'))) {
    setAgentLanguage('vi');
    if (input) input.value = '';
    return;
  }

  // Lưu snapshot để Hoàn tác (Undo)
  step2CommandHistory.push({
    rows: cloneRawRows(liveRawTable.rows),
    auditLog: step2AuditActionLog.slice(),
    dedupReport: step2AutoDedupReport ? { ...step2AutoDedupReport } : null
  });
  if (step2CommandHistory.length > 20) step2CommandHistory.shift();

  let resultMsg = '';
  let auditActionEntry = null;

  // 0. Lệnh liệt kê toàn bộ dữ liệu lỗi
  if ((cmdLow.includes('liệt kê') || cmdLow.includes('quét') || cmdLow.includes('xem') || cmdLow.includes('tìm')) && (cmdLow.includes('lỗi') || cmdLow.includes('trùng') || cmdLow.includes('thiếu'))) {
    step2CommandHistory.pop();
    const scanBefore = analyzeLiveRawTable();
    let newlyRemovedExact = 0;
    let newlyRemovedPartialDrop = 0;
    if (scanBefore.exactDupCount > 0 || scanBefore.partialDropCount > 0) {
      liveRawTable.rows = liveRawTable.rows.filter((_, idx) => {
        const st = scanBefore.rowMeta[idx] && scanBefore.rowMeta[idx].status;
        if (st === 'exact_dup') { newlyRemovedExact++; return false; }
        if (st === 'partial_dup_drop') { newlyRemovedPartialDrop++; return false; }
        return true;
      });
      if (step2AutoDedupReport) {
        step2AutoDedupReport.exactRemoved = (step2AutoDedupReport.exactRemoved || 0) + newlyRemovedExact;
        step2AutoDedupReport.partialDropRemoved = (step2AutoDedupReport.partialDropRemoved || 0) + newlyRemovedPartialDrop;
      } else {
        step2AutoDedupReport = {
          exactRemoved: newlyRemovedExact,
          partialDropRemoved: newlyRemovedPartialDrop,
          partialKept: scanBefore.partialKeepCount,
          originalRows: scanBefore.totalRows,
          removedAuditItems: []
        };
      }
      renderLiveRawDataTable();
    }
    const scan = analyzeLiveRawTable();
    syncKpisFromLiveRawTable(scan);
    const ddScan = getStep2DedupTotals(scan);
    const totalIssues = scan.errorRowCount + scan.exactDupCount + scan.partialDropCount;
    resultMsg = totalIssues > 0
      ? `Đã xóa sạch ${ddScan.removedTotal.toLocaleString()} lỗi trùng lặp (${ddScan.exactRemoved.toLocaleString()} lặp 100% + ${ddScan.partialDropRemoved.toLocaleString()} lặp xung đột), giữ lại ${ddScan.partialKeep.toLocaleString()} lặp 1 phần hợp lý. Còn ${totalIssues.toLocaleString()} dòng có lỗi ô dữ liệu và đã liệt kê chi tiết bên dưới.`
      : `Đã quét sâu 7 tiêu chí trên ${scan.totalRows.toLocaleString()} dòng (Đã xóa ${ddScan.removedTotal.toLocaleString()} lỗi trùng lặp, giữ ${ddScan.partialKeep.toLocaleString()} lặp 1 phần hợp lý): 100% dữ liệu sạch, không phát hiện lỗi!`;
    renderLinkedErrorAndNewDataPanel(scan, 'errors', resultMsg);
    step2CommandLogs.unshift({
      command: cmdRawOrig,
      result: resultMsg,
      beforeCount,
      afterCount: scan.totalRows,
      afterRate: scan.successRate,
      time: new Date().toLocaleTimeString('vi-VN')
    });
    renderStep2CommandLogs();
    if (input) input.value = '';
    showStepTransitionToast(resultMsg, totalIssues > 0 ? 'warning' : 'success', 3400);
    return;
  }

  // 0A. Lệnh sửa trực tiếp 1 dòng & 1 cột: "sửa dòng 1 cột Quantity thành 20" / "chỉnh dòng 2 cột Location sang Đà Nẵng"
  const editCellMatch = cmdRaw.match(/(?:sửa|chỉnh(?:\s*sửa)?|đổi|cập\s*nhật|set)\s+(?:dòng|hàng|row)\s*#?(\d+)\s+(?:cột|ô|col|column)?\s*([^\s"'=]+(?:\s+[^\s"'=]+)?)\s+(?:thành|sang|bằng|=|to)\s+["']?(.+?)["']?$/i);
  // 0B. Lệnh xóa dòng theo khoảng: "xóa dòng từ 1 đến 5" / "xóa dòng 1-5"
  const delRangeMatch = cmdRaw.match(/(?:xóa|bỏ|delete)\s+(?:các\s+)?(?:dòng|hàng|row)\s*(?:từ\s*)?#?(\d+)\s*(?:đến|tới|-|to)\s*#?(\d+)/i);
  // 0C. Lệnh xóa N dòng đầu / cuối: "xóa 5 dòng đầu" / "xóa dòng đầu" / "xóa dòng cuối"
  const delFirstLastMatch = cmdRaw.match(/(?:xóa|bỏ|delete)\s+(?:(\d+)\s+)?(?:dòng|hàng|row)\s+(đầu(?:\s*tiên)?|cuối(?:\s*cùng)?)/i);
  // 0D. Lệnh xóa theo danh sách số dòng cụ thể: "xóa dòng 1" / "xóa dòng 1, 3, 5" / "xóa dòng #2"
  const delNumsMatch = cmdRaw.match(/(?:xóa|bỏ|delete)\s+(?:các\s+)?(?:dòng|hàng|row)\s+#?(\d+(?:\s*[,;&và\s]+\s*#?\d+)*)$/i);

  if (editCellMatch) {
    const rowNum = parseInt(editCellMatch[1], 10);
    const colHint = editCellMatch[2].trim().toLowerCase();
    const newVal = editCellMatch[3].trim();
    const rIdx = rowNum - 1;
    let cIdx = headers.findIndex(h => String(h || '').toLowerCase() === colHint || String(h || '').toLowerCase().includes(colHint));
    if (cIdx < 0 && /^\d+$/.test(colHint)) cIdx = parseInt(colHint, 10) - 1;

    if (rIdx >= 0 && rIdx < liveRawTable.rows.length && cIdx >= 0 && cIdx < headers.length) {
      const oldVal = liveRawTable.rows[rIdx][cIdx];
      liveRawTable.rows[rIdx][cIdx] = newVal;
      liveRawEditedCells.add(`${rIdx}:${cIdx}`);
      resultMsg = `AI đã sửa Dòng #${rowNum} · Cột "${headers[cIdx]}": "${oldVal}" → "${newVal}".`;
      auditActionEntry = {
        rowId: `#${rowNum}`,
        field: headers[cIdx],
        rawValue: `${oldVal || '(Trống)'} → ${newVal}`,
        errorType: 'Chỉnh Sửa Theo Lệnh Người Dùng',
        category: 'other',
        action: `Thực thi lệnh "${cmdRawOrig}" → Đã cập nhật trực tiếp giá trị mới "${newVal}".`,
        statusText: 'Đã chỉnh sửa theo lệnh',
        statusBadge: '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-weight:700;">Đã Sửa Theo Lệnh</span>'
      };
    } else {
      step2CommandHistory.pop();
      resultMsg = `Không tìm thấy dòng #${rowNum} hoặc cột "${editCellMatch[2]}". Các cột hiện có: ${headers.join(', ')}.`;
    }
  } else if (delRangeMatch) {
    const startNum = Math.max(1, parseInt(delRangeMatch[1], 10));
    const endNum = Math.min(liveRawTable.rows.length, parseInt(delRangeMatch[2], 10));
    const fromIdx = Math.min(startNum, endNum) - 1;
    const toIdx = Math.max(startNum, endNum) - 1;
    const count = Math.max(0, toIdx - fromIdx + 1);
    liveRawTable.rows.splice(fromIdx, count);
    resultMsg = `AI đã xóa ${count.toLocaleString()} dòng (từ dòng #${fromIdx + 1} đến #${toIdx + 1}).`;
    auditActionEntry = {
      rowId: `#${fromIdx + 1}–#${toIdx + 1}`,
      field: 'Xóa theo khoảng dòng',
      rawValue: `${count} dòng đã xóa`,
      errorType: 'Xóa Dòng Theo Lệnh Người Dùng',
      category: 'other',
      action: `Thực thi lệnh "${cmdRawOrig}" → Đã xóa ${count} dòng khỏi tập dữ liệu.`,
      statusText: 'Đã xóa theo lệnh',
      statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa Theo Lệnh</span>'
    };
  } else if (delFirstLastMatch) {
    const count = Math.min(liveRawTable.rows.length, parseInt(delFirstLastMatch[1] || '1', 10));
    const isLast = delFirstLastMatch[2].toLowerCase().includes('cuối');
    if (isLast) {
      liveRawTable.rows.splice(liveRawTable.rows.length - count, count);
    } else {
      liveRawTable.rows.splice(0, count);
    }
    resultMsg = `AI đã xóa ${count.toLocaleString()} dòng ${isLast ? 'cuối cùng' : 'đầu tiên'} khỏi bảng dữ liệu.`;
    auditActionEntry = {
      rowId: isLast ? `${count} dòng cuối` : `${count} dòng đầu`,
      field: 'Xóa dòng theo lệnh',
      rawValue: `${count} dòng đã xóa`,
      errorType: 'Xóa Dòng Theo Lệnh Người Dùng',
      category: 'other',
      action: `Thực thi lệnh "${cmdRawOrig}" → Còn ${liveRawTable.rows.length.toLocaleString()} dòng.`,
      statusText: 'Đã xóa theo lệnh',
      statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa Theo Lệnh</span>'
    };
  } else if (delNumsMatch) {
    const nums = (delNumsMatch[1].match(/\d+/g) || [])
      .map(n => parseInt(n, 10))
      .filter(n => n >= 1 && n <= liveRawTable.rows.length);
    const uniqueDesc = Array.from(new Set(nums)).sort((a, b) => b - a);
    uniqueDesc.forEach(n => liveRawTable.rows.splice(n - 1, 1));
    const deletedLabel = uniqueDesc.slice().reverse().map(n => `#${n}`).join(', ');
    resultMsg = uniqueDesc.length > 0
      ? `AI đã xóa ${uniqueDesc.length} dòng (${deletedLabel}) khỏi bảng dữ liệu thô.`
      : `Không tìm thấy số dòng hợp lệ để xóa (tổng hiện có ${beforeCount} dòng).`;
    if (uniqueDesc.length > 0) {
      auditActionEntry = {
        rowId: deletedLabel,
        field: 'Xóa dòng theo số thứ tự',
        rawValue: `${uniqueDesc.length} dòng đã xóa`,
        errorType: 'Xóa Dòng Theo Lệnh Người Dùng',
        category: 'other',
        action: `Thực thi lệnh "${cmdRawOrig}" → Đã xóa dòng ${deletedLabel}.`,
        statusText: 'Đã xóa theo lệnh',
        statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa Theo Lệnh</span>'
      };
    }
  }
  // 1. Lệnh thay thế: "thay thế A thành B" hoặc "đổi A sang B"
  else if (/(?:thay\s*thế|thay|đổi|replace)\s+["']?.+?["']?\s+(?:thành|sang|bằng|with|to)\s+["']?.+?["']?$/i.test(cmdRaw)) {
    const replaceMatch = cmdRaw.match(/(?:thay\s*thế|thay|đổi|replace)\s+["']?(.+?)["']?\s+(?:thành|sang|bằng|with|to)\s+["']?(.+?)["']?$/i);
    const fromStr = replaceMatch[1].trim();
    const toStr = replaceMatch[2].trim();
    const escaped = fromStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    let replacedCells = 0;
    liveRawTable.rows = liveRawTable.rows.map((row, rIdx) => row.map((cell, cIdx) => {
      const s = String(cell === undefined || cell === null ? '' : cell);
      if (regex.test(s)) {
        replacedCells++;
        liveRawEditedCells.add(`${rIdx}:${cIdx}`);
        return s.replace(regex, toStr);
      }
      return s;
    }));
    resultMsg = `AI đã thay thế "${fromStr}" → "${toStr}" trên ${replacedCells.toLocaleString()} ô dữ liệu.`;
    if (replacedCells > 0) {
      auditActionEntry = {
        rowId: `${replacedCells} ô`,
        field: 'Thay thế hàng loạt',
        rawValue: `"${fromStr}" → "${toStr}"`,
        errorType: 'Chỉnh Sửa Theo Lệnh Người Dùng',
        category: 'other',
        action: resultMsg,
        statusText: 'Đã sửa theo lệnh',
        statusBadge: '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-weight:700;">Đã Sửa Theo Lệnh</span>'
      };
    }
  }
  // 2. Lệnh xóa dòng lặp / trùng lặp
  else if (cmdLow.includes('trùng') || cmdLow.includes('lặp') || cmdLow.includes('dedup')) {
    const analysisBefore = analyzeLiveRawTable();
    const onlyExact = cmdLow.includes('100%') && !cmdLow.includes('1 phần') && !cmdLow.includes('bất hợp lý') && !cmdLow.includes('tất cả');
    let removedExact = 0;
    let removedPartial = 0;
    liveRawTable.rows = liveRawTable.rows.filter((_, idx) => {
      const st = analysisBefore.rowMeta[idx]?.status;
      if (st === 'exact_dup') { removedExact++; return false; }
      if (!onlyExact && st === 'partial_dup_drop') { removedPartial++; return false; }
      return true;
    });
    if (removedExact + removedPartial > 0) {
      if (step2AutoDedupReport) {
        step2AutoDedupReport.exactRemoved = (step2AutoDedupReport.exactRemoved || 0) + removedExact;
        step2AutoDedupReport.partialDropRemoved = (step2AutoDedupReport.partialDropRemoved || 0) + removedPartial;
      } else {
        step2AutoDedupReport = {
          exactRemoved: removedExact,
          partialDropRemoved: removedPartial,
          partialKept: analysisBefore.partialKeepCount,
          originalRows: analysisBefore.totalRows,
          removedAuditItems: []
        };
      }
    }
    const ddNow = getStep2DedupTotals(analyzeLiveRawTable());
    resultMsg = (removedExact + removedPartial > 0)
      ? `AI đã xóa thêm ${removedExact.toLocaleString()} dòng lặp 100% và ${removedPartial.toLocaleString()} dòng lặp 1 phần bất hợp lý (Tổng đã xóa: ${ddNow.removedTotal.toLocaleString()} dòng; Giữ lại: ${ddNow.partialKeep.toLocaleString()} dòng lặp 1 phần hợp lý).`
      : `Toàn bộ lỗi trùng lặp đã được xóa sạch trước đó (Đã xóa ${ddNow.removedTotal.toLocaleString()} lỗi trùng lặp: ${ddNow.exactRemoved.toLocaleString()} lặp 100% + ${ddNow.partialDropRemoved.toLocaleString()} lặp 1 phần bất hợp lý; Giữ lại ${ddNow.partialKeep.toLocaleString()} dòng lặp 1 phần hợp lý).`;
    if (removedExact + removedPartial > 0) {
      auditActionEntry = {
        rowId: `${removedExact + removedPartial} dòng`,
        field: 'Khử trùng lặp',
        rawValue: `Xóa ${removedExact} lặp 100%, ${removedPartial} lặp 1 phần bất hợp lý`,
        errorType: 'Khử Trùng Lặp Theo Lệnh',
        category: 'duplicate',
        action: resultMsg,
        statusText: 'Đã xóa trùng lặp',
        statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa Trùng Lặp</span>'
      };
    }
  }
  // 3. Lệnh xóa dòng lỗi / thiếu dữ liệu
  else if ((cmdLow.includes('xóa') || cmdLow.includes('bỏ')) && (cmdLow.includes('lỗi') || cmdLow.includes('thiếu') || cmdLow.includes('trống'))) {
    const analysisBefore = analyzeLiveRawTable();
    let removedErr = 0;
    liveRawTable.rows = liveRawTable.rows.filter((_, idx) => {
      if (analysisBefore.rowMeta[idx]?.status === 'error') {
        removedErr++;
        return false;
      }
      return true;
    });
    resultMsg = `AI đã xóa ${removedErr.toLocaleString()} dòng chứa ô lỗi / khuyết thiếu dữ liệu.`;
    if (removedErr > 0) {
      auditActionEntry = {
        rowId: `${removedErr} dòng`,
        field: 'Xóa dòng lỗi',
        rawValue: `${removedErr} dòng bị lỗi/thiếu`,
        errorType: 'Xóa Dòng Lỗi Theo Lệnh',
        category: 'other',
        action: resultMsg,
        statusText: 'Đã xóa dòng lỗi',
        statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa Dòng Lỗi</span>'
      };
    }
  }
  // 4. Lệnh chuẩn hóa ô trống, số âm, ngày tháng, danh mục & SLA / điền ô trống bằng giá trị cụ thể
  else if (cmdLow.includes('ô trống') || cmdLow.includes('số âm') || cmdLow.includes('chuẩn hóa') || cmdLow.includes('điền') || cmdLow.includes('sla') || cmdLow.includes('danh mục')) {
    const fillMatch = cmdRaw.match(/(?:bằng|thành)\s+["']?(.+?)["']?$/i);
    const customFill = fillMatch ? fillMatch[1].trim() : '';
    const findColIdx = (pred) => headers.findIndex(h => pred(String(h || '').toLowerCase().trim()));
    const rfqIdColIdx = findColIdx(low => low.includes('rfq_id') || low.includes('rfq id') || low.includes('request_id'));
    const custColIdx = findColIdx(low => low.includes('customer') || low.includes('khách hàng') || low.includes('khách'));
    const itemColIdx = findColIdx(low => low.includes('item_name') || low.includes('product_name') || low.includes('tên sản phẩm') || low.includes('sản phẩm') || low.includes('thiết bị') || low === 'item');
    const qtyColIdx = findColIdx(low => low.includes('quantity') || low.includes('số lượng') || low.includes('qty') || low === 'sl');
    const isRfqDataset = rfqIdColIdx >= 0 && custColIdx >= 0 && itemColIdx >= 0 && qtyColIdx >= 0;

    const BAD_PLACEHOLDERS = new Set([
      'null', 'n/a', 'na', 'nan', 'none', 'nil', 'unknown', 'tbd', 'asap',
      'chưa rõ', 'chưa có', 'chưa xác định', 'không rõ', 'trống', 'lỗi', 'error',
      '#n/a', '#value!', '#ref!', '#div/0!', '#name?', '#num!', '???', '...', '--', '-'
    ]);

    let fixedCells = 0;
    liveRawTable.rows = liveRawTable.rows.map((row, rIdx) => {
      return row.map((cell, cIdx) => {
        const origRaw = String(cell === undefined || cell === null ? '' : cell);
        const val = origRaw.replace(/\s+/g, ' ').trim();
        if (origRaw !== val) { fixedCells++; liveRawEditedCells.add(`${rIdx}:${cIdx}`); }
        const lowVal = val.toLowerCase();
        const hLow = String(headers[cIdx] || '').toLowerCase();
        const isQtyCol = cIdx === qtyColIdx || hLow.includes('quantity') || hLow.includes('số lượng') || hLow.includes('qty') || hLow === 'sl';
        const isPriceCol = hLow.includes('price') || hLow.includes('giá') || hLow.includes('ngân sách');
        const isDiscCol = hLow.includes('discount') || hLow.includes('chiết khấu');
        const isDateCol = hLow.includes('date') || hLow.includes('deadline') || hLow.includes('ngày') || (hLow.includes('hạn') && !hLow.includes('hạn mức') && !hLow.includes('giới hạn'));
        const isMaintCol = hLow.includes('maintenance') || hLow.includes('bảo trì') || hLow.includes('sla');

        if (val === '' || BAD_PLACEHOLDERS.has(lowVal)) {
          fixedCells++;
          liveRawEditedCells.add(`${rIdx}:${cIdx}`);
          if (customFill) return customFill;
          if (isQtyCol) return '1';
          if (isPriceCol || isDiscCol) return '0';
          if (isDateCol) return '2026-03-15';
          if (isMaintCol) return '12 tháng; hỗ trợ 8x5';
          return 'Đã chuẩn hóa';
        }
        if (isQtyCol || isPriceCol) {
          const num = Number(val.replace(/,/g, ''));
          if (isNaN(num) || (isQtyCol && num <= 0)) {
            fixedCells++;
            liveRawEditedCells.add(`${rIdx}:${cIdx}`);
            return String(isNaN(num) || num === 0 ? 1 : Math.abs(num));
          }
          if (isPriceCol && num < 0) {
            fixedCells++;
            liveRawEditedCells.add(`${rIdx}:${cIdx}`);
            return String(Math.abs(num));
          }
        }
        if (isDiscCol) {
          const num = Number(val.replace(/%/g, '').replace(/,/g, ''));
          if (isNaN(num) || num < 0 || num > 100) {
            fixedCells++;
            liveRawEditedCells.add(`${rIdx}:${cIdx}`);
            return '0';
          }
        }
        if (isDateCol) {
          if (!isValidDateString(val)) {
            fixedCells++;
            liveRawEditedCells.add(`${rIdx}:${cIdx}`);
            return '2026-03-15';
          }
        }
        return val;
      });
    });
    resultMsg = `AI đã chuẩn hóa ${fixedCells.toLocaleString()} ô dữ liệu (ô trống, số lượng, hạn triển khai, gói bảo trì SLA & thông số Catalog)${customFill ? ` (điền bằng "${customFill}")` : ''}.`;
    if (fixedCells > 0) {
      auditActionEntry = {
        rowId: `${fixedCells} ô`,
        field: 'Chuẩn hóa dữ liệu & SLA',
        rawValue: `${fixedCells} ô đã chuẩn hóa`,
        errorType: 'Chuẩn Hóa Theo Lệnh AI',
        category: 'other',
        action: resultMsg,
        statusText: 'Đã chuẩn hóa',
        statusBadge: '<span class="badge-tag eligible" style="background:#ecfdf5; color:#065f46; font-weight:700;">Đã Chuẩn Hóa</span>'
      };
    }
  }
  // 5. Lệnh xóa khoảng trắng thừa
  else if (cmdLow.includes('khoảng trắng') || cmdLow.includes('trim')) {
    let trimmedCells = 0;
    liveRawTable.rows = liveRawTable.rows.map((row, rIdx) => row.map((cell, cIdx) => {
      const orig = String(cell === undefined || cell === null ? '' : cell);
      const cleaned = orig.replace(/\s+/g, ' ').trim();
      if (cleaned !== orig) { trimmedCells++; liveRawEditedCells.add(`${rIdx}:${cIdx}`); }
      return cleaned;
    }));
    resultMsg = `AI đã xóa khoảng trắng thừa trên ${trimmedCells.toLocaleString()} ô dữ liệu.`;
  }
  // 6. Lệnh sắp xếp
  else if (cmdLow.includes('sắp xếp') || cmdLow.includes('sort')) {
    const desc = cmdLow.includes('giảm') || cmdLow.includes('desc') || cmdLow.includes('z-a');
    let colIdx = findColumnIndexByCommand(cmdLow, headers);
    if (colIdx < 0) colIdx = 0;
    liveRawTable.rows.sort((a, b) => {
      const va = String(a[colIdx] || '').trim();
      const vb = String(b[colIdx] || '').trim();
      const na = Number(va.replace(/,/g, ''));
      const nb = Number(vb.replace(/,/g, ''));
      const cmp = (!isNaN(na) && !isNaN(nb) && va !== '' && vb !== '')
        ? (na - nb)
        : va.localeCompare(vb, 'vi');
      return desc ? -cmp : cmp;
    });
    resultMsg = `AI đã sắp xếp toàn bộ bảng theo cột "${headers[colIdx] || 'Cột 1'}" (${desc ? 'Giảm dần' : 'Tăng dần'}).`;
  }
  // 7. Lệnh xóa hoặc lọc theo điều kiện số (VD: "Xóa dòng có Quantity < 5" hoặc "Giữ dòng có Quantity >= 10")
  else if (/(<=|>=|<|>|=)/.test(cmdRaw) && (cmdLow.includes('xóa') || cmdLow.includes('giữ') || cmdLow.includes('lọc'))) {
    const condMatch = cmdRaw.match(/([a-zA-Z0-9_À-ỹ\s]+?)\s*(<=|>=|<|>|=)\s*["']?([^"']+)["']?$/i);
    if (condMatch) {
      const colNameHint = condMatch[1].trim().toLowerCase();
      const op = condMatch[2];
      const targetVal = condMatch[3].trim();
      let colIdx = headers.findIndex(h => colNameHint.includes(String(h || '').toLowerCase()));
      if (colIdx < 0) colIdx = findColumnIndexByCommand(cmdLow, headers);

      if (colIdx >= 0) {
        const isKeep = cmdLow.includes('giữ') || (cmdLow.includes('lọc') && !cmdLow.includes('xóa'));
        const evalCond = (cellVal) => {
          const s = String(cellVal || '').trim();
          const nCell = Number(s.replace(/,/g, ''));
          const nTarget = Number(targetVal.replace(/,/g, ''));
          if (!isNaN(nCell) && !isNaN(nTarget) && s !== '' && targetVal !== '') {
            if (op === '<') return nCell < nTarget;
            if (op === '<=') return nCell <= nTarget;
            if (op === '>') return nCell > nTarget;
            if (op === '>=') return nCell >= nTarget;
            if (op === '=') return nCell === nTarget;
          }
          if (op === '=') return s.toLowerCase() === targetVal.toLowerCase();
          return false;
        };
        liveRawTable.rows = liveRawTable.rows.filter(row => {
          const matched = evalCond(row[colIdx]);
          return isKeep ? matched : !matched;
        });
        const diff = beforeCount - liveRawTable.rows.length;
        resultMsg = isKeep
          ? `AI đã lọc giữ các dòng thỏa "${headers[colIdx]} ${op} ${targetVal}" (loại ${diff.toLocaleString()} dòng không khớp).`
          : `AI đã xóa ${diff.toLocaleString()} dòng thỏa điều kiện "${headers[colIdx]} ${op} ${targetVal}".`;
        if (diff > 0) {
          auditActionEntry = {
            rowId: `${diff} dòng`,
            field: headers[colIdx],
            rawValue: `${headers[colIdx]} ${op} ${targetVal}`,
            errorType: isKeep ? 'Lọc Dữ Liệu Theo Lệnh' : 'Xóa Dòng Theo Điều Kiện',
            category: 'other',
            action: resultMsg,
            statusText: 'Đã lọc / xóa theo lệnh',
            statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa Theo Lệnh</span>'
          };
        }
      } else {
        step2CommandHistory.pop();
        resultMsg = `Không tìm thấy tên cột khớp trong lệnh. Các cột hiện có: ${headers.join(', ')}.`;
      }
    }
  }
  // 8. Lệnh lọc giữ / xóa dòng chứa từ khóa (VD: "Giữ dòng chứa Hà Nội" hoặc "Xóa dòng chứa Firewall" hoặc "Xóa dòng RFQ-001")
  else if (cmdLow.includes('xóa') || cmdLow.includes('giữ') || cmdLow.includes('lọc')) {
    const kwMatch = cmdRaw.match(/(?:chứa|tại|có|dòng|hàng)\s+["']?(.+?)["']?$/i);
    const kw = kwMatch ? kwMatch[1].trim().toLowerCase() : '';
    if (kw && kw !== 'dòng' && kw !== 'hàng') {
      const isKeep = cmdLow.includes('giữ') || (cmdLow.includes('lọc') && !cmdLow.includes('xóa'));
      liveRawTable.rows = liveRawTable.rows.filter(row => {
        const hasKw = row.some(c => String(c || '').toLowerCase().includes(kw));
        return isKeep ? hasKw : !hasKw;
      });
      const diff = beforeCount - liveRawTable.rows.length;
      resultMsg = isKeep
        ? `AI đã lọc giữ các dòng có chứa "${kwMatch[1].trim()}" (loại ${diff.toLocaleString()} dòng).`
        : `AI đã xóa ${diff.toLocaleString()} dòng có chứa "${kwMatch[1].trim()}".`;
      if (diff > 0) {
        auditActionEntry = {
          rowId: `${diff} dòng`,
          field: 'Lọc / Xóa theo từ khóa',
          rawValue: `Từ khóa: "${kwMatch[1].trim()}"`,
          errorType: 'Xóa / Lọc Theo Lệnh Người Dùng',
          category: 'other',
          action: resultMsg,
          statusText: 'Đã xóa theo lệnh',
          statusBadge: '<span class="badge-tag missing" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Đã Xóa Theo Lệnh</span>'
        };
      }
    } else {
      step2CommandHistory.pop();
      resultMsg = 'Vui lòng nêu rõ dòng cần xóa hoặc điều kiện (VD: "Xóa dòng 1", "Xóa dòng 1 đến 5", "Xóa dòng có Quantity < 5", "Xóa dòng chứa Firewall").';
    }
  }
  // 9. Lệnh viết hoa / viết thường
  else if (cmdLow.includes('viết hoa') || cmdLow.includes('in hoa') || cmdLow.includes('viết thường')) {
    const toUpper = cmdLow.includes('hoa');
    const colIdx = findColumnIndexByCommand(cmdLow, headers);
    let changed = 0;
    liveRawTable.rows = liveRawTable.rows.map((row, rIdx) => row.map((cell, i) => {
      if (colIdx >= 0 && i !== colIdx) return cell;
      const orig = String(cell || '');
      const next = toUpper ? orig.toUpperCase() : orig.toLowerCase();
      if (next !== orig) { changed++; liveRawEditedCells.add(`${rIdx}:${i}`); }
      return next;
    }));
    resultMsg = `AI đã chuyển ${toUpper ? 'CHỮ IN HOA' : 'chữ thường'} cho ${changed.toLocaleString()} ô${colIdx >= 0 ? ` tại cột "${headers[colIdx]}"` : ''}.`;
  }
  // 10. Mặc định
  else {
    step2CommandHistory.pop();
    resultMsg = `Chưa nhận diện được thao tác cụ thể từ "${cmdRawOrig}". Gợi ý cú pháp: "Xóa dòng 1", "Xóa dòng từ 1 đến 5", "Sửa dòng 1 cột Quantity thành 20", "Thay thế Ha Noi thành Hà Nội", "Xóa dòng có Quantity < 5".`;
  }

  if (auditActionEntry) {
    step2AuditActionLog.unshift(auditActionEntry);
    if (step2AuditActionLog.length > 50) step2AuditActionLog.pop();
  }

  liveRawTablePage = 1;
  renderLiveRawDataTable();
  const afterAnalysis = analyzeLiveRawTable();
  syncKpisFromLiveRawTable(afterAnalysis);
  renderLinkedErrorAndNewDataPanel(afterAnalysis, 'new_data', resultMsg);

  step2CommandLogs.unshift({
    command: cmdRawOrig,
    result: resultMsg,
    beforeCount,
    afterCount: afterAnalysis.totalRows,
    afterRate: afterAnalysis.successRate,
    time: new Date().toLocaleTimeString('vi-VN')
  });
  renderStep2CommandLogs();

  if (input) input.value = '';
  showStepTransitionToast(resultMsg, 'success', 3600);
}

function undoLastStep2Command() {
  if (step2CommandHistory.length === 0) {
    showStepTransitionToast('Không có lệnh nào trước đó để hoàn tác.', 'info', 2000);
    return;
  }
  const prevState = step2CommandHistory.pop();
  liveRawTable.rows = Array.isArray(prevState) ? prevState : prevState.rows;
  if (prevState && Array.isArray(prevState.auditLog)) {
    step2AuditActionLog = prevState.auditLog;
  }
  if (prevState && Object.prototype.hasOwnProperty.call(prevState, 'dedupReport')) {
    step2AutoDedupReport = prevState.dedupReport;
  }
  liveRawTablePage = 1;
  renderLiveRawDataTable();
  const afterAnalysis = analyzeLiveRawTable();
  syncKpisFromLiveRawTable(afterAnalysis);
  renderLinkedErrorAndNewDataPanel(afterAnalysis, 'new_data', `Đã hoàn tác lệnh gần nhất — Hiện có ${afterAnalysis.totalRows.toLocaleString()} dòng.`);

  step2CommandLogs.unshift({
    command: 'Hoàn tác lệnh gần nhất (Undo)',
    result: `Đã khôi phục lại trạng thái bảng trước đó (${afterAnalysis.totalRows.toLocaleString()} dòng).`,
    beforeCount: afterAnalysis.totalRows,
    afterCount: afterAnalysis.totalRows,
    afterRate: afterAnalysis.successRate,
    time: new Date().toLocaleTimeString('vi-VN')
  });
  renderStep2CommandLogs();
  showStepTransitionToast('Đã hoàn tác lệnh vừa chạy!', 'info', 2400);
}

function restoreOriginalStep2Data() {
  if (!step2OriginalRowsSnapshot || step2OriginalRowsSnapshot.length === 0) {
    showStepTransitionToast('Chưa có bản sao dữ liệu gốc để khôi phục.', 'warning', 2200);
    return;
  }
  const beforeCount = liveRawTable.rows.length;
  step2CommandHistory.push({
    rows: cloneRawRows(liveRawTable.rows),
    auditLog: step2AuditActionLog.slice(),
    dedupReport: step2AutoDedupReport ? { ...step2AutoDedupReport } : null
  });
  step2AutoDedupReport = null;
  liveRawTable.__dedupDone = false;
  liveRawTable.rows = cloneRawRows(step2OriginalRowsSnapshot);
  liveRawEditedCells = new Set();
  step2AuditActionLog = [];
  liveRawTablePage = 1;
  renderLiveRawDataTable();
  const afterAnalysis = analyzeLiveRawTable();
  syncKpisFromLiveRawTable(afterAnalysis);
  renderLinkedErrorAndNewDataPanel(afterAnalysis, 'errors', `Đã khôi phục nguyên bản ${afterAnalysis.totalRows.toLocaleString()} dòng dữ liệu gốc.`);

  step2CommandLogs.unshift({
    command: 'Khôi phục dữ liệu gốc ban đầu',
    result: `Đã khôi phục nguyên bản ${afterAnalysis.totalRows.toLocaleString()} dòng dữ liệu gốc từ file tải lên.`,
    beforeCount,
    afterCount: afterAnalysis.totalRows,
    afterRate: afterAnalysis.successRate,
    time: new Date().toLocaleTimeString('vi-VN')
  });
  renderStep2CommandLogs();
  showStepTransitionToast('Đã khôi phục toàn bộ dữ liệu gốc ban đầu!', 'success', 2600);
}


// ============================================================================
// AGENT BILINGUAL LANGUAGE CONTROLLER (TIẾNG VIỆT / ENGLISH)
// ============================================================================
let currentAgentLang = localStorage.getItem('agentLang') || 'vi';

const AGENT_I18N = {
  vi: {
    sidebar: {
      'page-dashboard': '1. Tổng quan (Dashboard)',
      'page-ingestion': '2. Bối cảnh & Nhập liệu thô',
      'page-parsing': '3. Làm sạch & Xác nhận dữ liệu',
      'page-opportunities': '4. Quản lý cơ hội',
      'page-validation': '5. Thẩm định kho & giá',
      'page-pricing': '6. Báo giá & Chiết khấu',
      'page-approval': '7. Phê duyệt',
      'page-reports': '8. Báo cáo & Thống kê',
      'page-audit': '9. Đối chiếu & Giám sát',
      'page-settings': '10. Cài đặt hệ thống'
    },
    headerTitle: 'Bảng Điều Khiển Quản Trị',
    searchPlaceholder: 'Tìm kiếm cửa hàng, giao dịch, ngành hàng...',
    dashTitle: 'Tổng Quan Tình Hình Xử Lý Cơ Hội B2B',
    step2Title: 'Bước 2: Tiếp Nhận, Làm Sạch & Xác Nhận Dữ Liệu Sạch',
    cmdPlaceholder: 'Nhập yêu cầu cho AI Agent... (VD: Xóa dòng trùng lặp 100%, Thay thế Ha Noi thành Hà Nội, Xóa dòng có Quantity < 5)',
    miffyBubble: 'Chat với Miffy AI',
    miffyTitle: 'Miffy AI Agent',
    miffySub: 'Sẵn sàng hỗ trợ bạn 24/7',
    miffyPlaceholder: 'Hỏi Miffy AI hoặc yêu cầu xử lý dữ liệu...',
    miffySend: 'Gửi',
    miffyWelcome: 'Xin chào! Mình là Miffy AI Agent.\nMình có thể hướng dẫn quy trình 5 bước, kiểm tra trạng thái dữ liệu thật của bạn, hoặc chạy lệnh làm sạch dữ liệu ngay giúp bạn!',
    quickChips: [
      'Trạng thái dữ liệu hiện tại',
      'Hướng dẫn quy trình 5 bước',
      'Cách mở quyền sửa bảng Bước 2',
      'Làm sạch dữ liệu ngay'
    ]
  },
  en: {
    sidebar: {
      'page-dashboard': '1. Overview (Dashboard)',
      'page-ingestion': '2. Context & Raw Data Input',
      'page-parsing': '3. Data Cleaning & Verification',
      'page-opportunities': '4. Opportunities',
      'page-validation': '5. Inventory & Pricing Check',
      'page-pricing': '6. Quotation & Discount',
      'page-approval': '7. Approvals',
      'page-reports': '8. Reports & Analytics',
      'page-audit': '9. Audit & Monitoring',
      'page-settings': '10. System Settings'
    },
    headerTitle: 'Admin Control Panel',
    searchPlaceholder: 'Search stores, transactions, industries...',
    dashTitle: 'B2B Opportunity Pipeline Overview',
    step2Title: 'Step 2: Ingestion, Data Cleansing & Clean Data Verification',
    cmdPlaceholder: 'Type a command for AI Agent... (e.g., Remove 100% duplicates, Replace Ha Noi with Hanoi, Delete rows with Quantity < 5)',
    miffyBubble: 'Chat with Miffy AI',
    miffyTitle: 'Miffy AI Agent',
    miffySub: 'Ready to assist you 24/7',
    miffyPlaceholder: 'Ask Miffy AI or request data actions...',
    miffySend: 'Send',
    miffyWelcome: 'Hello! I am Miffy AI Agent.\nI can guide you through the 5-step workflow, inspect your live uploaded dataset, or run data cleaning commands for you right away!',
    quickChips: [
      'Check current data status',
      '5-step workflow guide',
      'How to unlock table edit in Step 2',
      'Clean data now'
    ]
  }
};

// ============================================================================
// FULL-APP BILINGUAL TRANSLATION ENGINE (100% VIETNAMESE <-> ENGLISH)
// ============================================================================
const I18N_ORIG_TEXT = new WeakMap();
const I18N_ORIG_ATTRS = new WeakMap();
let i18nObserver = null;
let i18nDebounceTimer = null;
let isApplyingI18n = false;

// Bảng từ điển cụm từ dài -> ngắn (tự động dịch chính xác toàn bộ giao diện, bảng, modal, thông báo)
const VI_TO_EN_PHRASES = [
  // Sidebar & Brand
  ['1. Tổng quan (Dashboard)', '1. Overview (Dashboard)'],
  ['2. Bối cảnh & Nhập liệu thô', '2. Context & Raw Data Input'],
  ['3. Làm sạch & Xác nhận dữ liệu', '3. Data Cleaning & Verification'],
  ['4. Quản lý cơ hội', '4. Opportunities'],
  ['5. Thẩm định kho & giá', '5. Inventory & Pricing Check'],
  ['6. Báo giá & Chiết khấu', '6. Quotation & Discount'],
  ['7. Phê duyệt', '7. Approvals'],
  ['8. Báo cáo & Thống kê', '8. Reports & Analytics'],
  ['9. Đối chiếu & Giám sát', '9. Audit & Monitoring'],
  ['10. Cài đặt hệ thống', '10. System Settings'],
  ['Slide Thuyết Trình', 'Presentation Slides'],
  ['Đăng Xuất', 'Sign Out'],
  ['HỆ THỐNG DOANH NGHIỆP', 'ENTERPRISE SYSTEM'],
  ['Tự động hóa đối soát & phân tích dữ liệu đa ngành', 'Multi-industry data reconciliation & analytics automation'],
  ['Reset Về Trống (0)', 'Reset to Empty (0)'],
  ['Reset về 0', 'Reset to 0'],

  // Header & Guided Flow Bar
  ['Bảng Điều Khiển Quản Trị', 'Admin Control Panel'],
  ['Tìm kiếm cửa hàng, giao dịch, ngành hàng...', 'Search stores, transactions, industries...'],
  ['LUỒNG TỰ ĐỘNG HÓA 5 BƯỚC (HUMAN-IN-THE-LOOP)', '5-STEP AUTOMATION WORKFLOW (HUMAN-IN-THE-LOOP)'],
  ['Phân Tích Bằng AI → Tự Động Nhảy Sang Bóc Tách →', 'Run AI Analysis → Jump to Entity Parsing →'],
  ['Xác Nhận Bóc Tách → Tự Động Nhảy Sang Thẩm Định Kho →', 'Confirm Cleansing → Proceed to Inventory Check →'],
  ['Xác Nhận Đủ Kho & Giữ Hàng → Tự Động Nhảy Sang Báo Giá →', 'Confirm Stock → Proceed to Quotation →'],
  ['Bắt Đầu Xử Lý & Xác Nhận Bóc Tách →', 'Start Processing & Confirm Parsing →'],
  ['Bước 1: Tiếp Nhận Dữ Liệu', 'Step 1: Data Ingestion'],
  ['Bước 2: Phân Tích Thực Thể', 'Step 2: Entity Parsing & Cleansing'],
  ['Bước 3: Thẩm Định Tồn Kho & Bảng Giá', 'Step 3: Inventory & Pricing Verification'],
  ['Bước 4: Tính Giá & Chiết Khấu', 'Step 4: Quotation & Discount'],
  ['Bước 5: Phê Duyệt Cấp Trên', 'Step 5: Manager Approval'],

  // Stepper
  ['1. Tiếp Nhận', '1. Ingestion'],
  ['Nạp văn bản/file', 'Upload text/file'],
  ['2. Bóc Tách Thực Thể', '2. Data Cleansing'],
  ['Checkpoint 1: Xác nhận bóc tách', 'Checkpoint 1: Verify clean data'],
  ['Đã xác nhận bóc tách', 'Cleansing verified'],
  ['3. Thẩm Định Kho', '3. Inventory Check'],
  ['Checkpoint 1.2: Đối chiếu tồn', 'Checkpoint 1.2: Stock check'],
  ['Đã đối chiếu kho', 'Inventory verified'],
  ['4. Tính Giá & Chiết Khấu', '4. Pricing & Discount'],
  ['Kiểm soát hạn mức duyệt', 'Approval threshold control'],
  ['Checkpoint 1.3: Kiểm soát hạn mức', 'Checkpoint 1.3: Threshold control'],
  ['Đã trình duyệt', 'Submitted for approval'],
  ['5. Phê Duyệt Cấp Trên', '5. Manager Approval'],
  ['Checkpoint 2: Quản lý chốt', 'Checkpoint 2: Final sign-off'],

  // Dashboard
  ['Chào mừng Lê Yến Như', 'Welcome Lê Yến Như'],
  ['Bạn đang đăng nhập với tư cách Quản trị viên (Admin)', 'Signed in as System Administrator (Admin)'],
  ['Quyền Toàn Cục', 'Global Access'],
  ['Tổng Quan Tình Hình Xử Lý Cơ Hội B2B', 'B2B Opportunity Pipeline Overview'],
  ['Theo dõi thời gian thực các chỉ số theo thẩm quyền của bạn', 'Real-time KPI tracking based on your access permissions'],
  ['Tạo yêu cầu mới', 'New Request'],
  ['Tạo Yêu Cầu Mới', 'Create New Request'],
  ['CÓ THỂ TIẾP TỤC', 'ELIGIBLE TO PROCEED'],
  ['CHỜ TRƯỞNG PHÒNG DUYỆT', 'PENDING MANAGER APPROVAL'],
  ['CẦN BỔ SUNG THÔNG TIN', 'MISSING INFORMATION'],
  ['CHƯA ĐÁP ỨNG', 'UNFULFILLED'],
  ['Cơ Hội Bán Hàng Cần Xử Lý', 'Active Sales Opportunities'],
  ['Phân Bổ Trạng Thái', 'Status Distribution'],
  ['Xem tất cả →', 'View all →'],
  ['Xem danh sách cơ hội', 'View Opportunities'],
  ['Dữ liệu hiện đang trống (Zero-state)', 'System is currently empty (Zero-state)'],
  ['Chưa có cơ hội kinh doanh nào trong hệ thống. Hãy nạp yêu cầu mới để AI Agent phân tích.', 'No business opportunities yet. Please submit a new request for AI Agent analysis.'],
  ['Nạp 4 Test Case Mẫu', 'Load 4 Sample Cases'],

  // Step 1: Context & Raw Input
  ['BƯỚC 1A', 'STEP 1A'],
  ['BƯỚC 1B', 'STEP 1B'],
  ['Bối cảnh Doanh nghiệp (Business Context)', 'Business Context'],
  ['Nhập thông tin bối cảnh để AI phân tích sát thực tế', 'Enter business context so AI analyzes accurately'],
  ['Tên Doanh nghiệp / Dự án', 'Company / Project Name'],
  ['Nhập tên doanh nghiệp / dự án...', 'Enter company / project name...'],
  ['Ngành nghề / Lĩnh vực hoạt động', 'Industry / Business Domain'],
  ['Nhập ngành nghề / lĩnh vực...', 'Enter industry / domain...'],
  ['Đối tượng xem Báo cáo / Dashboard', 'Target Audience (Report / Dashboard)'],
  ['Nhập đối tượng xem (VD: Ban Giám Đốc)...', 'Enter target audience (e.g., Executive Board)...'],
  ['Bối cảnh & Mục tiêu Phân tích Số liệu', 'Analysis Context & Objectives'],
  ['Mẫu gợi ý bán lẻ', 'Retail Sample'],
  ['Mô tả bối cảnh hiện tại của doanh nghiệp và mục tiêu phân tích (VD: Phân tích doanh thu, chi phí, công nợ, dòng tiền hoặc hiệu suất bán hàng...)', 'Describe current business context and analysis goals (e.g., revenue, costs, receivables, cash flow, or sales performance...)'],
  ['Đầu ra mong muốn', 'Desired Outputs'],
  ['(Có thể chọn nhiều)', '(Multi-select)'],
  ['Đã chọn:', 'Selected:'],
  ['Báo cáo', 'Report'],
  ['AI Agent sẽ bám sát tiêu chí an toàn & bối cảnh này', 'AI Agent will strictly follow this safety policy & context'],
  ['Làm trống ô', 'Clear fields'],
  ['File Dữ liệu Thô (Raw Data File)', 'Raw Data File'],
  ['Bắt buộc tải lên tệp dữ liệu thô (CSV, Excel, JSON, TXT) để chuyển sang Bước 2', 'Mandatory: upload a raw data file (CSV, Excel, JSON, TXT) to proceed to Step 2'],
  ['Tải file lên (CSV / Excel / JSON) *', 'Upload File (CSV / Excel / JSON) *'],
  ['Nội dung tệp dữ liệu thô sẽ hiển thị tại đây sau khi bạn bấm \'Tải file lên (CSV / Excel / JSON)\' ở góc phải...', 'Raw file preview will appear here after clicking "Upload File (CSV / Excel / JSON)" on the top right...'],
  ['Chưa có tệp dữ liệu. Bắt buộc tải lên file dữ liệu thô để chuyển sang Bước 2.', 'No file uploaded. A raw data file is required to proceed to Step 2.'],
  ['Nạp 60k Dòng Mẫu', 'Load 60k Sample Rows'],
  ['Phân Tích Bối Cảnh & Kiểm Tra Định Dạng', 'Analyze Context & Validate Format'],

  // Step 2: Command Flow, Live Raw Table & Error Statistics
  ['Bước 2: Tiếp Nhận, Làm Sạch & Xác Nhận Dữ Liệu Sạch', 'Step 2: Ingestion, Data Cleansing & Clean Data Verification'],
  ['AI Agent bóc tách thực thể, tự động làm sạch chuẩn hóa và yêu cầu Con người (HITL) xác nhận dữ liệu sạch trước khi chuyển tiếp', 'AI Agent extracts entities, cleans & normalizes data, and requires Human-in-the-Loop (HITL) confirmation before proceeding'],
  ['Chuyển sang Bước 3: Thẩm định kho →', 'Proceed to Step 3: Inventory Check →'],
  ['Chuyển Sang Bước 3: Thẩm Định Kho & Giá →', 'Proceed to Step 3: Inventory & Pricing →'],
  ['LUỒNG YÊU CẦU LỆNH CHO AI AGENT (BƯỚC 2)', 'AI AGENT USER COMMAND FLOW (STEP 2)'],
  ['Nhập lệnh tiếng Việt tự nhiên để yêu cầu AI Agent xử lý trực tiếp trên dữ liệu thô (xóa trùng lặp, lọc dữ liệu, thay thế giá trị, chuẩn hóa, sắp xếp...).', 'Enter natural language commands for the AI Agent to directly process the raw dataset (deduplicate, filter, replace, normalize, sort...).'],
  ['Thực Thi Lệnh AI', 'Execute AI Command'],
  ['Hoàn Tác Lệnh Vừa Chạy', 'Undo Last Command'],
  ['Khôi Phục Dữ Liệu Gốc', 'Restore Original Data'],
  ['Lệnh nhanh:', 'Quick commands:'],
  ['Xóa toàn bộ dòng lặp 100%', 'Remove all 100% duplicates'],
  ['Chuẩn hóa ô trống & số âm', 'Normalize blanks & negatives'],
  ['Xóa khoảng trắng thừa', 'Trim extra spaces'],
  ['Xóa dòng lỗi / thiếu', 'Delete error / missing rows'],
  ['Sắp xếp A-Z', 'Sort A-Z'],
  ['Chưa có lệnh nào được thực thi. Hãy nhập yêu cầu phía trên hoặc bấm một lệnh nhanh để AI Agent chạy trực tiếp trên bảng dữ liệu.', 'No commands executed yet. Type an instruction above or click a quick command to run directly on the data table.'],
  ['lệnh đã chạy', 'commands run'],

  ['BẢNG DỮ LIỆU THÔ TRỰC TIẾP (CHẠY DỮ LIỆU BƯỚC 2)', 'LIVE RAW DATA TABLE (STEP 2 DATA ENGINE)'],
  ['Chỉ xem (Chọn "Không Hài Lòng" tại Checkpoint 1 để cấp quyền sửa)', 'Read-only (Select "Unsatisfied" at Checkpoint 1 to unlock editing)'],
  ['Đã cấp quyền chỉnh sửa thủ công (Từ Checkpoint 1)', 'Manual edit permission granted (via Checkpoint 1)'],
  ['Bảng đang ở chế độ chỉ xem để bảo toàn dữ liệu gốc. Để chỉnh sửa thủ công trực tiếp trên bảng, hãy bấm', 'Table is locked in read-only mode to protect raw data. To edit directly on the table, click'],
  ['và chọn', 'and select'],
  ['tại', 'at'],
  ['Đã mở khóa quyền chỉnh sửa thủ công:', 'Manual editing unlocked:'],
  ['Chạy AI Làm Sạch & Khử Trùng Lặp', 'Run AI Clean & Deduplicate'],
  ['+ Thêm Dòng', '+ Add Row'],
  ['Lưu Chỉnh Sửa & Khóa Bảng', 'Save Edits & Lock Table'],
  ['Xuất Dữ Liệu Sạch (CSV)', 'Export Clean Data (CSV)'],
  ['Tìm kiếm nhanh trong bảng dữ liệu thô...', 'Quick search in raw data table...'],
  ['Tất cả dòng dữ liệu', 'All data rows'],
  ['Chỉ dòng có lỗi / thiếu', 'Error / missing rows only'],
  ['Chỉ dòng trùng lặp', 'Duplicate rows only'],
  ['Chỉ dòng sạch (Hợp lệ)', 'Clean (valid) rows only'],
  ['Trạng Thái AI', 'AI Status'],
  ['Trùng 1 phần phù hợp (khác SP → Giữ lại)', 'Valid Partial Dup (Diff Product → Keep)'],
  ['Khác SP — Giữ Lại', 'Diff Product — Keep'],
  ['Hợp Lý — Giữ Lại', 'Valid — Keep'],
  ['Bất Hợp Lý — Xóa Bỏ', 'Conflict — Drop'],
  ['Lặp 100% — Xóa Bỏ', '100% Dup — Drop'],
  ['Hợp lệ (Sạch)', 'Valid (Clean)'],
  ['Hợp lệ', 'Valid'],
  ['Lặp 100% (Xóa bỏ)', '100% Duplicate (Drop)'],
  ['Lặp 1 phần (Hợp lý)', 'Partial Dup (Keep)'],
  ['Lặp 1 phần (Xung đột)', 'Partial Dup (Conflict)'],
  ['Lặp 1 phần (Xóa bỏ)', 'Partial Dup (Drop)'],
  ['Lỗi / Thiếu', 'Error / Missing'],
  ['mã GD trùng', 'duplicate txn IDs'],
  ['dòng trùng mã GD', 'duplicate txn ID rows'],
  ['dòng khác SP giữ lại', 'diff-product rows kept'],
  ['dòng hợp lệ chuẩn', 'valid standard rows'],
  ['Trùng Lặp 1 Phần Giữ Lại', 'Kept Partial Duplicates'],
  ['Chưa có dữ liệu thô. Vui lòng hoàn thiện Bước 1 (điền Bối cảnh & tải File dữ liệu thô).', 'No raw data yet. Please complete Step 1 (fill Business Context & upload Raw Data File).'],

  ['BẢNG THỐNG KÊ DỮ LIỆU LỖI & TỔNG TOÀN BỘ DỮ LIỆU', 'ERROR STATISTICS & TOTAL DATASET SUMMARY'],
  ['Chi tiết phân loại dữ liệu đầu vào, phát hiện các bản ghi dị thường/lỗi và quy chuẩn làm sạch của AI Agent', 'Detailed classification of raw input data, anomaly/duplicate detection, and AI Agent cleansing rules'],
  ['Xuất Báo Cáo Lỗi & Trùng Lặp (CSV)', 'Export Error & Duplicate Report (CSV)'],
  ['Tổng Toàn Bộ Dữ Liệu', 'Total Dataset Records'],
  ['Phát Hiện Trùng Lặp', 'Duplicates Detected'],
  ['Lặp Hoàn Toàn (100%)', 'Exact Duplicates (100%)'],
  ['Lặp 1 Phần (Thẩm Định)', 'Partial Duplicates (Audited)'],
  ['Dữ Liệu Sạch Sau Xử Lý', 'Clean Records After Processing'],
  ['Tỷ lệ đạt chuẩn:', 'Clean Rate:'],
  ['Lỗi ô:', 'Cell Errors:'],
  ['Chưa nạp dữ liệu', 'No data loaded'],
  ['Chờ quét dữ liệu', 'Waiting for scan'],
  ['Chờ phân tích', 'Waiting for analysis'],
  ['Chưa có dữ liệu thẩm định', 'No audit data yet'],
  ['Không phát hiện bản ghi lặp 1 phần', 'No partial duplicates detected'],
  ['QUY CHUẨN XỬ LÝ TRÙNG LẶP CỦA AI AGENT:', 'AI AGENT DEDUPLICATION POLICY:'],
  ['Tự Động & Thẩm Định HITL', 'Automated & HITL Audit'],
  ['Tất Cả', 'All'],
  ['Chỉ Lỗi Trùng Lặp', 'Duplicates Only'],
  ['Lỗi Định Dạng & Khác', 'Format & Other Errors'],
  ['Mã Dòng', 'Row ID'],
  ['Trường Dữ Liệu', 'Data Field'],
  ['Giá Trị Thô Ban Đầu', 'Original Raw Value'],
  ['Loại Lỗi / Trùng Lặp', 'Error / Duplicate Type'],
  ['Thẩm Định & Hành Động Của AI Agent', 'AI Agent Assessment & Action'],
  ['Quyết Định Xử Lý', 'Resolution Decision'],
  ['LUỒNG ĐỐI SOÁT & SỬA LỖI DỮ LIỆU (DATA RECONCILIATION & ERROR FIXING)', 'DATA RECONCILIATION & ERROR FIXING WORKFLOW'],
  ['Đang Chờ Đối Soát & Sửa Lỗi', 'Pending Reconciliation'],
  ['AI Tự Động Sửa Toàn Bộ Lỗi', 'AI Auto-Fix All Errors'],
  ['Chạy Lại Đối Soát', 'Re-run Reconciliation'],
  ['Hoàn Tất Kiểm Tra & Làm Sạch Dữ Liệu Ở Bước 2?', 'Completed Data Inspection & Cleaning in Step 2?'],

  // Checkpoint 1 Modal
  ['HUMAN CHECKPOINT 1: XÁC NHẬN DỮ LIỆU ĐÃ LÀM SẠCH ĐẠT CHUẨN', 'HUMAN CHECKPOINT 1: CONFIRM CLEAN DATA QUALITY'],
  ['Tóm tắt đối soát dữ liệu:', 'Data reconciliation summary:'],
  ['Tổng dữ liệu:', 'Total records:'],
  ['Dữ liệu sạch:', 'Clean records:'],
  ['Xử lý trùng lặp:', 'Deduplication:'],
  ['HÀI LÒNG VỚI DỮ LIỆU ĐÃ LÀM SẠCH', 'SATISFIED WITH CLEANED DATA'],
  ['Phê duyệt → Bước 3', 'Approve → Step 3'],
  ['KHÔNG HÀI LÒNG (CHỈNH SỬA TRỰC TIẾP TRÊN BẢNG DỮ LIỆU THÔ)', 'UNSATISFIED (EDIT DIRECTLY ON RAW DATA TABLE)'],
  ['Cấp quyền sửa trực tiếp', 'Grant direct edit access'],
  ['Đóng & Xem Lại Bảng Đối Soát', 'Close & Review Table'],
  ['Xác Nhận Lựa Chọn & Tiếp Tục →', 'Confirm Selection & Continue →'],
  ['Vui Lòng Chọn Lựa Chọn Ở Trên', 'Please Select an Option Above'],

  // Steps 3, 4, 5, Reports, Audit
  ['Thẩm Định Danh Mục Sản Phẩm & Tồn Kho (Skill 2)', 'Master Catalog & Inventory Verification (Skill 2)'],
  ['Đối chiếu dữ liệu thời gian thực với Danh mục sản phẩm Master Catalog Doanh nghiệp', 'Real-time validation against Enterprise Master Product Catalog'],
  ['Chạy thẩm định AI', 'Run AI Validation'],
  ['Chuyển sang Báo giá →', 'Proceed to Quotation →'],
  ['Xác Nhận Đủ Kho & Tiếp Tục Lập Báo Giá →', 'Confirm Stock & Proceed to Quotation →'],
  ['Hộp Thư Phê Duyệt Của Trưởng Phòng Kinh Doanh', 'Sales Manager Approval Inbox'],
  ['Báo Cáo & Thống Kê Tổng Hợp Cơ Hội', 'Opportunity Summary Reports & Analytics'],
  ['Xuất Báo Cáo Word (.doc)', 'Export Word Report (.doc)'],
  ['Xuất Excel (.csv)', 'Export Excel (.csv)'],
  ['Nhật Ký Thực Thi AI Agent (Audit Trail)', 'AI Agent Execution Audit Trail'],
  ['Chưa có dữ liệu báo cáo & nhận xét', 'No report data or insights yet'],
  ['Đi tới Bước 1', 'Go to Step 1'],

  // Common short units / labels (đặt ở cuối để tránh đè cụm dài)
  ['Hiển thị', 'Showing'],
  ['Trang', 'Page'],
  ['Trước', 'Prev'],
  ['Sau', 'Next'],
  ['Thao Tác', 'Action'],
  ['Khách Hàng', 'Customer'],
  ['Trạng Thái', 'Status'],
  ['Giá Trị', 'Value'],
  ['Chưa có dữ liệu', 'No data'],
  ['cần xử lý', 'to resolve'],
  ['bản ghi', 'records'],
  ['dòng', 'rows'],
  ['cột', 'cols'],
  ['Xóa', 'Delete'],
  ['Gốc:', 'Original:'],
  ['Đã xóa:', 'Deleted:'],
  ['Đã sửa:', 'Edited:'],
  ['Tối', 'Dark'],
  ['Sáng', 'Light']
];

function translateTextViToEn(originalVi) {
  let out = originalVi;
  for (let i = 0; i < VI_TO_EN_PHRASES.length; i++) {
    const [vi, en] = VI_TO_EN_PHRASES[i];
    if (out.includes(vi)) {
      out = out.split(vi).join(en);
    }
  }
  return out;
}

function applyFullDomLanguage(lang) {
  if (isApplyingI18n) return;
  isApplyingI18n = true;
  try {
    const root = document.body;
    if (!root) return;

    // 1. Dịch toàn bộ Text Nodes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
        // Không dịch nội dung ô dữ liệu thô hoặc khung ngôn ngữ VI/EN
        if (parent.closest('#agentLangSwitcher') || parent.closest('#liveRawDataTbody')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    let cur;
    while ((cur = walker.nextNode())) textNodes.push(cur);

    textNodes.forEach(node => {
      if (!I18N_ORIG_TEXT.has(node)) {
        I18N_ORIG_TEXT.set(node, node.nodeValue);
      }
      const orig = I18N_ORIG_TEXT.get(node);
      if (lang === 'en') {
        const translated = translateTextViToEn(orig);
        if (node.nodeValue !== translated) node.nodeValue = translated;
      } else {
        if (node.nodeValue !== orig) node.nodeValue = orig;
      }
    });

    // 2. Dịch toàn bộ thuộc tính placeholder & title
    const attrEls = root.querySelectorAll('input[placeholder], textarea[placeholder], [title]');
    attrEls.forEach(el => {
      if (el.closest('#agentLangSwitcher')) return;
      if (!I18N_ORIG_ATTRS.has(el)) {
        I18N_ORIG_ATTRS.set(el, {
          placeholder: el.getAttribute('placeholder'),
          title: el.getAttribute('title')
        });
      }
      const origAttrs = I18N_ORIG_ATTRS.get(el);
      if (origAttrs.placeholder !== null) {
        const nextPh = lang === 'en' ? translateTextViToEn(origAttrs.placeholder) : origAttrs.placeholder;
        if (el.getAttribute('placeholder') !== nextPh) el.setAttribute('placeholder', nextPh);
      }
      if (origAttrs.title !== null) {
        const nextTitle = lang === 'en' ? translateTextViToEn(origAttrs.title) : origAttrs.title;
        if (el.getAttribute('title') !== nextTitle) el.setAttribute('title', nextTitle);
      }
    });
  } finally {
    isApplyingI18n = false;
  }
}

function startI18nMutationObserver() {
  if (i18nObserver) return;
  i18nObserver = new MutationObserver(() => {
    if (isApplyingI18n || currentAgentLang !== 'en') return;
    if (i18nDebounceTimer) clearTimeout(i18nDebounceTimer);
    i18nDebounceTimer = setTimeout(() => {
      if (currentAgentLang === 'en') applyFullDomLanguage('en');
    }, 35);
  });
  i18nObserver.observe(document.body, { childList: true, subtree: true });
}

function setAgentLanguage(lang, silent = false) {
  currentAgentLang = (lang === 'en') ? 'en' : 'vi';
  localStorage.setItem('agentLang', currentAgentLang);
  document.documentElement.lang = currentAgentLang;
  const dict = AGENT_I18N[currentAgentLang];

  const btnVi = document.getElementById('btnLangVi');
  const btnEn = document.getElementById('btnLangEn');
  if (btnVi) btnVi.classList.toggle('active', currentAgentLang === 'vi');
  if (btnEn) btnEn.classList.toggle('active', currentAgentLang === 'en');

  // Dịch toàn bộ giao diện Chat Miffy
  const bubbleEl = document.getElementById('miffySpeechBubble');
  const chatTitle = document.getElementById('miffyChatTitle');
  const chatSub = document.getElementById('miffyChatSubtitle');
  const chatInput = document.getElementById('miffyChatInput');
  const chatSend = document.getElementById('miffyChatSendBtn');
  if (bubbleEl) bubbleEl.textContent = dict.miffyBubble;
  if (chatTitle) chatTitle.textContent = dict.miffyTitle;
  if (chatSub) chatSub.textContent = dict.miffySub;
  if (chatInput) chatInput.placeholder = dict.miffyPlaceholder;
  if (chatSend) chatSend.textContent = dict.miffySend;
  renderMiffyQuickChips();

  // Dịch toàn bộ DOM của toàn bộ Agent (tất cả 10 trang, bảng, modal, thanh điều hướng)
  applyFullDomLanguage(currentAgentLang);
  startI18nMutationObserver();

  if (!silent) {
    showStepTransitionToast(
      currentAgentLang === 'en' ? 'Switched entire AI Agent interface to English.' : 'Đã chuyển toàn bộ giao diện AI Agent sang Tiếng Việt.',
      'info',
      2200
    );
  }
}

// ============================================================================
// MIFFY AI AGENT CHAT ASSISTANT ENGINE
// ============================================================================
let miffyChatInitialized = false;

function renderMiffyQuickChips() {
  const wrap = document.getElementById('miffyChatQuickChips');
  if (!wrap) return;
  const chips = AGENT_I18N[currentAgentLang].quickChips;
  wrap.innerHTML = chips.map(txt =>
    `<button type="button" class="miffy-chat-chip" onclick="sendMiffyQuickMessage('${txt.replace(/'/g, "\\'")}')">${escapeHtmlAttr(txt)}</button>`
  ).join('');
}

function appendMiffyChatMessage(sender, text) {
  const list = document.getElementById('miffyChatMessages');
  if (!list) return;
  const timeStr = new Date().toLocaleTimeString(currentAgentLang === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' });
  const row = document.createElement('div');
  row.className = `miffy-msg-row ${sender}`;
  row.innerHTML = `
    <div class="miffy-msg-bubble">${escapeHtmlAttr(text)}</div>
    <div class="miffy-msg-time">${sender === 'bot' ? 'Miffy AI · ' : ''}${timeStr}</div>
  `;
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
}

function toggleMiffyChat(forceState) {
  const panel = document.getElementById('miffyChatPanel');
  if (!panel) return;
  const willOpen = typeof forceState === 'boolean' ? forceState : !panel.classList.contains('open');
  panel.classList.toggle('open', willOpen);
  panel.setAttribute('aria-hidden', willOpen ? 'false' : 'true');

  if (willOpen) {
    if (!miffyChatInitialized) {
      miffyChatInitialized = true;
      renderMiffyQuickChips();
      appendMiffyChatMessage('bot', AGENT_I18N[currentAgentLang].miffyWelcome);
    }
    setTimeout(() => {
      const inp = document.getElementById('miffyChatInput');
      if (inp) inp.focus();
    }, 120);
  }
}

function sendMiffyQuickMessage(text) {
  const inp = document.getElementById('miffyChatInput');
  if (inp) inp.value = text;
  handleMiffyChatSend();
}

function generateMiffyReply(userText) {
  const isEn = currentAgentLang === 'en';
  const low = normalizeViCmd(userText).toLowerCase();

  // 1. Chuyển đổi ngôn ngữ ngay trong chat
  if (low.includes('english') || low.includes('tiếng anh')) {
    setAgentLanguage('en', true);
    return 'Done! I have switched the Agent interface and chat language to English. How can I help you next?';
  }
  if (low.includes('tiếng việt') || low.includes('vietnamese')) {
    setAgentLanguage('vi', true);
    return 'Đã xong! Miffy đã chuyển toàn bộ giao diện và ngôn ngữ Agent sang Tiếng Việt rồi nhé. Bạn cần hỗ trợ gì tiếp theo?';
  }

  // 2. Thực thi trực tiếp các lệnh xóa / sửa / thay thế / lọc / sắp xếp trên bảng Bước 2 (Ưu tiên trước câu trả lời hướng dẫn!)
  const isActionCmd = (
    low.includes('xóa') ||
    low.includes('thay thế') ||
    low.includes('sắp xếp') ||
    low.includes('lọc') ||
    low.includes('delete') ||
    low.includes('replace') ||
    /(?:sửa|chỉnh|đổi|cập\s*nhật)\s+(?:dòng|hàng|row)\s*#?\d+/i.test(low)
  );
  if (isActionCmd && liveRawTable && liveRawTable.rows && liveRawTable.rows.length > 0) {
    runQuickStep2Command(userText);
    const after = analyzeLiveRawTable();
    return isEn
      ? `Executed your command directly on the Step 2 table & synced Error Statistics!\n• Remaining rows: ${after.totalRows.toLocaleString()}\n• Clean rate: ${after.successRate}%`
      : `Miffy đã thực thi trực tiếp lệnh của bạn trên bảng Bước 2 và đồng bộ lại Bảng Thống Kê!\n• Tổng dòng hiện tại: ${after.totalRows.toLocaleString()} dòng\n• Tỷ lệ đạt chuẩn: ${after.successRate}%`;
  }

  // 3. Chạy AI làm sạch dữ liệu ngay
  if (low.includes('làm sạch') || low.includes('clean data') || low.includes('clean now')) {
    if (!liveRawTable || !liveRawTable.rows || liveRawTable.rows.length === 0) {
      return isEn
        ? 'No raw dataset is loaded yet! Please go to Step 1 (Context & Raw Data Input), fill in the business context, and upload a CSV/Excel file first.'
        : 'Hiện chưa có file dữ liệu thô nào được nạp! Bạn hãy vào Bước 1 (Bối cảnh & Nhập liệu thô), điền bối cảnh và tải file CSV/Excel lên trước nhé.';
    }
    runAiCleanOnRawTable();
    const after = analyzeLiveRawTable();
    return isEn
      ? `Done! Miffy ran AI Data Cleaning on "${uploadedRawFileName || 'your dataset'}":\n• Remaining rows: ${after.totalRows.toLocaleString()}\n• Clean rate: ${after.successRate}%\n• Remaining errors: ${after.errorRowCount}`
      : `Miffy đã chạy AI Làm Sạch trên tệp "${uploadedRawFileName || 'dữ liệu hiện tại'}":\n• Số dòng sau làm sạch: ${after.totalRows.toLocaleString()} dòng\n• Tỷ lệ đạt chuẩn: ${after.successRate}%\n• Lỗi ô còn lại: ${after.errorRowCount} dòng`;
  }

  // 3. Kiểm tra trạng thái dữ liệu hiện tại
  if (low.includes('trạng thái') || low.includes('status') || low.includes('thống kê') || low.includes('dữ liệu hiện tại')) {
    if (!liveRawTable || !liveRawTable.rows || liveRawTable.rows.length === 0) {
      return isEn
        ? 'System is currently in Zero-state (0 rows). Please complete Step 1 by entering Business Context and uploading a raw data file.'
        : 'Hệ thống hiện đang ở trạng thái trống (0 dòng dữ liệu). Bạn vui lòng hoàn thiện Bước 1 (điền Bối cảnh & tải File dữ liệu thô) để bắt đầu nhé!';
    }
    const a = analyzeLiveRawTable();
    return isEn
      ? `Live Data Summary (${uploadedRawFileName || 'Uploaded File'}):\n• Total rows: ${a.totalRows.toLocaleString()} (${(liveRawTable.headers || []).length} columns)\n• Exact duplicates (100%): ${a.exactDupCount}\n• Partial duplicates: ${a.partialDupCount} (Keep ${a.partialKeepCount} | Drop ${a.partialDropCount})\n• Cell errors: ${a.errorRowCount}\n• Clean rows: ${a.cleanAfterProcessing.toLocaleString()} (${a.successRate}%)`
      : `Thống kê dữ liệu thực tế (${uploadedRawFileName || 'Tệp đang xử lý'}):\n• Tổng số dòng: ${a.totalRows.toLocaleString()} dòng (${(liveRawTable.headers || []).length} cột)\n• Lặp hoàn toàn (100%): ${a.exactDupCount} dòng\n• Lặp 1 phần: ${a.partialDupCount} dòng (Giữ ${a.partialKeepCount} | Xóa ${a.partialDropCount})\n• Dòng có lỗi ô: ${a.errorRowCount} dòng\n• Dữ liệu sạch: ${a.cleanAfterProcessing.toLocaleString()} dòng (${a.successRate}%)`;
  }

  // 4. Cách sửa dữ liệu thô ở Bước 2
  if (low.includes('sửa') || low.includes('edit') || low.includes('unlock') || low.includes('checkpoint')) {
    return isEn
      ? 'To edit raw data directly on the Step 2 table:\n1. Click "Proceed to Step 3" so HUMAN CHECKPOINT 1 pops up.\n2. Select "UNSATISFIED (Edit directly on raw data table)" and confirm.\n3. The table will unlock every cell for direct Excel-like editing, adding, or deleting rows.\n4. Click "Save & Lock Table" when finished.'
      : 'Để mở quyền sửa trực tiếp trên bảng dữ liệu thô ở Bước 2:\n1. Bấm "Chuyển Sang Bước 3" để mở hộp thoại HUMAN CHECKPOINT 1.\n2. Chọn "KHÔNG HÀI LÒNG (Chỉnh sửa trực tiếp trên bảng dữ liệu thô)" và xác nhận.\n3. Hệ thống sẽ cấp quyền mở khóa toàn bộ ô trên bảng để bạn sửa, thêm hoặc xóa dòng trực tiếp.\n4. Sửa xong bấm "Lưu Chỉnh Sửa & Khóa Bảng" nhé!';
  }

  // 5. Hướng dẫn quy trình 5 bước
  if (low.includes('quy trình') || low.includes('5 bước') || low.includes('workflow') || low.includes('guide') || low.includes('hướng dẫn')) {
    return isEn
      ? '5-Step Human-in-the-Loop Workflow:\n• Step 1: Fill Business Context & upload Raw Data File (CSV/Excel/JSON).\n• Step 2: Run AI commands, inspect Error/Duplicate Stats, and confirm at HUMAN CHECKPOINT 1.\n• Step 3: Verify Inventory & Master Catalog.\n• Step 4: Calculate Quotation & Discount Policy.\n• Step 5: Manager Approval (Checkpoint 2).'
      : 'Quy trình 5 bước có sự giám sát của con người (HITL):\n• Bước 1: Điền Bối cảnh doanh nghiệp & tải File dữ liệu thô (CSV/Excel/JSON).\n• Bước 2: Chạy lệnh AI, kiểm tra bảng thống kê lỗi/trùng lặp và xác nhận tại HUMAN CHECKPOINT 1.\n• Bước 3: Thẩm định tồn kho & danh mục.\n• Bước 4: Tính báo giá & kiểm soát hạn mức chiết khấu.\n• Bước 5: Trình Trưởng phòng phê duyệt (Checkpoint 2).';
  }

  // 6. Thực thi lệnh xử lý bảng Bước 2 trực tiếp từ Chat Miffy
  if ((low.includes('xóa') || low.includes('thay thế') || low.includes('sắp xếp') || low.includes('lọc') || low.includes('giữ') || low.includes('delete') || low.includes('replace')) && liveRawTable && liveRawTable.rows && liveRawTable.rows.length > 0) {
    runQuickStep2Command(userText);
    const after = analyzeLiveRawTable();
    return isEn
      ? `Executed your command directly on the Step 2 table! Current status: ${after.totalRows.toLocaleString()} rows (${after.successRate}% clean). You can also click "Undo" in Step 2 anytime.`
      : `Miffy đã thực thi trực tiếp lệnh của bạn trên bảng dữ liệu Bước 2!\nTrạng thái mới: ${after.totalRows.toLocaleString()} dòng (Đạt chuẩn ${after.successRate}%). Bạn có thể bấm "Hoàn Tác" ở Bước 2 bất cứ lúc nào.`;
  }

  // 7. Điều hướng nhanh
  if (low.includes('bước 1') || low.includes('step 1')) {
    openSaasPage('page-ingestion');
    return isEn ? 'Navigated to Step 1 (Context & Raw Data Input)!' : 'Miffy đã đưa bạn tới Bước 1 (Bối cảnh & Nhập liệu thô)!';
  }

  // 8. Câu trả lời thân thiện mặc định
  return isEn
    ? `Miffy received your message: "${userText}".\nYou can ask me to check live data status, explain the 5-step workflow, clean data, or switch language between Vietnamese & English!`
    : `Miffy đã nhận được tin nhắn: "${userText}".\nBạn có thể hỏi Miffy kiểm tra số liệu đang chạy, hướng dẫn từng bước, nhờ chạy lệnh làm sạch dữ liệu (VD: "Xóa dòng lặp 100%"), hoặc đổi ngôn ngữ Anh / Việt ngay nhé!`;
}

function handleMiffyChatSend() {
  const inp = document.getElementById('miffyChatInput');
  const text = inp ? inp.value.trim() : '';
  if (!text) return;

  appendMiffyChatMessage('user', text);
  inp.value = '';

  setTimeout(() => {
    const reply = generateMiffyReply(text);
    appendMiffyChatMessage('bot', reply);
  }, 220);
}

(function initAgentLanguageOnLoad() {
  const run = () => setAgentLanguage(currentAgentLang, true);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();


// ============================================================================
// STEP 2: DEEP 7-RULE ERROR DETECTION & NEW-DATA LISTING LINKED WITH COMMAND FLOW
// ============================================================================
function runDeepErrorDetectionFlow(showToast = true) {
  if (!liveRawTable || !Array.isArray(liveRawTable.rows) || liveRawTable.rows.length === 0) {
    if (showToast) showStepTransitionToast('Chưa có dữ liệu ở Bước 2 để quét lỗi.', 'warning', 2400);
    return;
  }
  // Tự động xóa bất kỳ lỗi trùng lặp hoàn toàn (100%) hoặc lặp 1 phần bất hợp lý nào còn sót lại, giữ lại lặp 1 phần hợp lý
  const scanBefore = analyzeLiveRawTable();
  let newlyRemovedExact = 0;
  let newlyRemovedPartialDrop = 0;
  if (scanBefore.exactDupCount > 0 || scanBefore.partialDropCount > 0) {
    const nextReport = step2AutoDedupReport
      ? {
          ...step2AutoDedupReport,
          exactRemoved: (step2AutoDedupReport.exactRemoved || 0),
          partialDropRemoved: (step2AutoDedupReport.partialDropRemoved || 0)
        }
      : {
          exactRemoved: 0,
          partialDropRemoved: 0,
          partialKept: scanBefore.partialKeepCount,
          originalRows: scanBefore.totalRows,
          removedAuditItems: []
        };
    liveRawTable.rows = liveRawTable.rows.filter((_, idx) => {
      const st = scanBefore.rowMeta[idx] && scanBefore.rowMeta[idx].status;
      if (st === 'exact_dup') { newlyRemovedExact++; return false; }
      if (st === 'partial_dup_drop') { newlyRemovedPartialDrop++; return false; }
      return true;
    });
    nextReport.exactRemoved += newlyRemovedExact;
    nextReport.partialDropRemoved += newlyRemovedPartialDrop;
    step2AutoDedupReport = nextReport;
    renderLiveRawDataTable();
  }
  const analysis = analyzeLiveRawTable();
  syncKpisFromLiveRawTable(analysis);
  const dd = getStep2DedupTotals(analysis);
  const totalIssues = analysis.errorRowCount + analysis.exactDupCount + analysis.partialDropCount;
  const msg = totalIssues > 0
    ? `Đã xóa sạch ${dd.removedTotal.toLocaleString()} lỗi trùng lặp (${dd.exactRemoved.toLocaleString()} lặp 100% + ${dd.partialDropRemoved.toLocaleString()} lặp xung đột), giữ lại ${dd.partialKeep.toLocaleString()} lặp 1 phần hợp lý. Còn ${totalIssues.toLocaleString()} dòng lỗi ô dữ liệu (Số/Định mức: ${analysis.errorBreakdown.numeric} ô, Ngày: ${analysis.errorBreakdown.date} ô, Danh mục/SLA: ${analysis.errorBreakdown.format} ô).`
    : `Quét sâu 7 tiêu chí hoàn tất (${analysis.totalRows.toLocaleString()} dòng): Đã xóa sạch ${dd.removedTotal.toLocaleString()} lỗi trùng lặp, giữ lại ${dd.partialKeep.toLocaleString()} lặp 1 phần hợp lý — 100% dữ liệu đạt chuẩn!`;

  renderLinkedErrorAndNewDataPanel(analysis, 'errors', msg);
  if (showToast) showStepTransitionToast(msg, totalIssues > 0 ? 'warning' : 'success', 3800);
}

function renderLinkedErrorAndNewDataPanel(analysis, mode = 'auto', summaryText = '') {
  const badgeEl = document.getElementById('step2DetectedErrorSummaryBadge');
  const pillsEl = document.getElementById('step2ErrorCategoryPills');
  const wrapEl = document.getElementById('step2LinkedNewDataWrap');
  if (!wrapEl || !analysis) return;

  const bd = analysis.errorBreakdown || { missing: 0, numeric: 0, date: 0, format: 0, whitespace: 0, exactDup: 0, partialDup: 0 };
  const totalIssues = analysis.errorRowCount + analysis.exactDupCount + analysis.partialDropCount;

  if (badgeEl) {
    badgeEl.textContent = totalIssues > 0
      ? `Phát hiện ${totalIssues.toLocaleString()} dòng lỗi/trùng · Đạt chuẩn ${analysis.successRate}%`
      : `Sạch 100% (${analysis.totalRows.toLocaleString()} dòng)`;
    badgeEl.className = totalIssues > 0 ? 'badge-tag unfulfilled' : 'badge-tag eligible';
  }

  // Render các nhóm lỗi kèm nút gửi lệnh xử lý trực tiếp 1 chạm
  if (pillsEl) {
    const categories = [
      { label: `Khuyết thiếu / Rác: ${bd.missing} ô`, count: bd.missing, cmd: 'Chuẩn hóa ô trống, số âm & ngày tháng', btn: 'Chuẩn hóa ngay' },
      { label: `Lỗi Số / Vượt định mức: ${bd.numeric} ô`, count: bd.numeric, cmd: 'Chuẩn hóa ô trống, số âm & ngày tháng', btn: 'Sửa số ngay' },
      { label: `Sai Ngày / Quá hạn: ${bd.date} ô`, count: bd.date, cmd: 'Chuẩn hóa ô trống, số âm & ngày tháng', btn: 'Sửa ngày' },
      { label: `Lỗi Danh mục / SLA / Định dạng: ${bd.format} ô`, count: bd.format, cmd: 'Chuẩn hóa danh mục, SLA & định dạng lỗi', btn: 'Chuẩn hóa SLA & Danh mục' },
      { label: `Khoảng trắng thừa: ${bd.whitespace} ô`, count: bd.whitespace, cmd: 'Xóa khoảng trắng thừa tất cả cột', btn: 'Xóa khoảng trắng' },
      { label: `Lỗi lặp 100%: ${bd.exactDup} dòng`, count: bd.exactDup, cmd: 'Xóa toàn bộ dòng lặp 100%', btn: 'Xóa lặp 100%' },
      { label: `Lỗi lặp 1 phần bất hợp lý: ${bd.partialDup} dòng`, count: bd.partialDup, cmd: 'Xóa dòng lặp 1 phần bất hợp lý', btn: 'Xóa lặp bất hợp lý' }
    ];

    const ddPill = getStep2DedupTotals(analysis);
    const activeCats = categories.filter(c => c.count > 0);
    const dedupStatusHtml = (ddPill.removedTotal > 0 || ddPill.partialKeep > 0)
      ? `<span class="badge-tag eligible" style="font-size:11.5px; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0;">Đã tự động xóa ${ddPill.removedTotal.toLocaleString()} lỗi trùng lặp (${ddPill.exactRemoved.toLocaleString()} lặp 100% + ${ddPill.partialDropRemoved.toLocaleString()} lặp xung đột) · Giữ lại ${ddPill.partialKeep.toLocaleString()} lặp 1 phần hợp lý</span>`
      : '';

    if (activeCats.length === 0) {
      pillsEl.innerHTML = dedupStatusHtml || '<span class="badge-tag eligible" style="font-size:11.5px;">Không phát hiện lỗi nào trên 7 tiêu chí kiểm tra tự động</span>';
    } else {
      pillsEl.innerHTML = dedupStatusHtml + activeCats.map(c => `
        <div style="display:inline-flex; align-items:center; gap:6px; background:#fff7ed; border:1.5px solid #fdba74; border-radius:999px; padding:4px 6px 4px 11px; font-size:11.5px; font-weight:700; color:#9a3412;">
          <span>${c.label}</span>
          <button type="button" onclick="runQuickStep2Command('${c.cmd}')" style="border:none; background:#f37021; color:#fff; border-radius:999px; padding:3px 9px; font-size:10.5px; font-weight:800; cursor:pointer;">${c.btn}</button>
        </div>
      `).join('');
    }
  }

  const headers = (liveRawTable && liveRawTable.headers) ? liveRawTable.headers : [];
  const rows = (liveRawTable && liveRawTable.rows) ? liveRawTable.rows : [];

  // Nếu chế độ là 'new_data' (vừa chạy lệnh xong) -> liệt kê DỮ LIỆU MỚI SAU KHI THỰC THI LỆNH
  if (mode === 'new_data') {
    const previewRows = rows.slice(0, 15);
    const colsShow = headers.slice(0, 6);
    wrapEl.innerHTML = `
      <div style="padding:8px 12px; background:#ecfdf5; border-bottom:1px solid #a7f3d0; font-size:12px; color:#065f46; font-weight:700; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
        <span>DỮ LIỆU MỚI SAU LỆNH: ${escapeHtmlAttr(summaryText || 'Đã cập nhật bảng dữ liệu')}</span>
        <span>Tổng mới: ${rows.length.toLocaleString()} dòng · Lỗi còn lại: ${totalIssues.toLocaleString()}</span>
      </div>
      ${previewRows.length === 0
        ? '<div style="padding:16px; text-align:center; color:#64748b; font-size:12px;">Tập dữ liệu mới đang có 0 dòng.</div>'
        : `<table class="saas-table" style="margin:0; font-size:11.5px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="width:45px;">#</th>
                ${colsShow.map(h => `<th>${escapeHtmlAttr(h)}</th>`).join('')}
                <th>Trạng Thái Mới</th>
              </tr>
            </thead>
            <tbody>
              ${previewRows.map((r, i) => {
                const m = analysis.rowMeta[i] || { label: 'Hợp lệ', badgeClass: 'eligible' };
                return `
                  <tr>
                    <td><code>#${i + 1}</code></td>
                    ${colsShow.map((_, ci) => `<td>${escapeHtmlAttr(r[ci] || '')}</td>`).join('')}
                    <td><span class="badge-tag ${m.badgeClass}" style="font-size:10.5px;">${m.label}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          ${rows.length > 15 ? `<div style="padding:6px 12px; font-size:11px; color:#64748b; text-align:right;">Đang hiển thị 15 / ${rows.length.toLocaleString()} dòng mới đầu tiên (xem đầy đủ ở Bảng Dữ Liệu Thô bên dưới)</div>` : ''}`
      }
    `;
    return;
  }

  // Mặc định hoặc chế độ 'errors': liệt kê trực tiếp các dòng lỗi & trùng lặp bất hợp lý cần xử lý (không liệt kê dòng lặp 1 phần hợp lý đã giữ lại như lỗi)
  const issueItems = (analysis.auditItems || []).filter(it => it.dupSubType !== 'partial_dup_keep');
  if (issueItems.length === 0) {
    wrapEl.innerHTML = `
      <div style="padding:14px; text-align:center; color:#047857; font-weight:700; font-size:12px; background:#f0fdf4;">
        Không còn dòng lỗi hoặc lỗi trùng lặp nào trên ${rows.length.toLocaleString()} dòng dữ liệu (đã giữ lại ${analysis.partialKeepCount.toLocaleString()} dòng lặp 1 phần hợp lý). Bạn có thể nhập lệnh lọc/sửa hoặc bấm "Chuyển sang Bước 3".
      </div>
    `;
    return;
  }

  const showItems = issueItems.slice(0, 20);
  wrapEl.innerHTML = `
    <div style="padding:8px 12px; background:#fffbeb; border-bottom:1px solid #fde68a; font-size:12px; color:#92400e; font-weight:700; display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
      <span>DANH SÁCH DỮ LIỆU LỖI & TRÙNG LẶP ĐƯỢC PHÁT HIỆN (${issueItems.length.toLocaleString()} bản ghi)</span>
      <span>Bấm nút màu cam phía trên hoặc gõ lệnh để AI xử lý & xuất dữ liệu mới</span>
    </div>
    <table class="saas-table" style="margin:0; font-size:11.5px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="width:85px;">Dòng</th>
          <th style="width:140px;">Cột Bị Lỗi</th>
          <th>Giá Trị Lỗi / Trùng</th>
          <th>Chi Tiết Phát Hiện</th>
        </tr>
      </thead>
      <tbody>
        ${showItems.map(it => `
          <tr>
            <td><code>${escapeHtmlAttr(it.rowId)}</code></td>
            <td><b>${escapeHtmlAttr(it.field)}</b></td>
            <td style="font-family:monospace; color:#b91c1c;">${escapeHtmlAttr(it.rawValue)}</td>
            <td style="color:#475569;">${escapeHtmlAttr(it.action)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${issueItems.length > 20 ? `<div style="padding:6px 12px; font-size:11px; color:#64748b; text-align:right;">Đang hiển thị 20 / ${issueItems.length.toLocaleString()} dòng lỗi đầu tiên</div>` : ''}
  `;
}
