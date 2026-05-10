// Configuration
// IMPORTANT: Replace this URL with your Google Apps Script Web App URL after deployment
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxgCiR9fwbnYCED9Znc_cgq5M34-d9AxDcLaspyF_ouyyBnieiVtX_-Cd0MVXWM3KeN/exec";

// Master Data for Printers
const MACHINE_MASTER = {
    "9173RB20165": { room: "วิชาการ (มัธยม)", baseModel: "IM C6010" },
    "9173RB20195": { room: "ห้องประชุมกลาง (ประถม)", baseModel: "IM C6010" },
    "9154R130684": { room: "อำนวยการ (มัธยม)", baseModel: "IM C3510" },
    "4443RC20088": { room: "ธุรการ (ประถม)", baseModel: "MP 6054S" },
    "4443RC20060": { room: "ห้องประชุมกลาง (ประถม)", baseModel: "31ST6054BLK" }
};

// DOM Elements
const navLinks = document.querySelectorAll('.nav-links li');
const pageSections = document.querySelectorAll('.page-section');
const themeToggle = document.getElementById('theme-toggle');
const refreshBtn = document.getElementById('refresh-btn');
const toast = document.getElementById('toast');
const loader = document.getElementById('global-loader');

// State
let inventoryData = [];

// Signature Pad State
let isDrawing = false;
let ctx;
let canvas;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupNavigation();
    setupForms();
    initSignaturePad();
    
    focusPrimaryInput('dashboard');
    setupSerialSuggestions();

    if (SCRIPT_URL && !SCRIPT_URL.includes("YOUR_GOOGLE_APPS_SCRIPT")) {
        fetchData();
    } else {
        showToast("Welcome! Please set your Google Apps Script URL in app.js", "info");
        renderMockData();
    }
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (icon) icon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
}

// Navigation
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            pageSections.forEach(s => s.classList.remove('active'));
            
            link.classList.add('active');
            const targetId = link.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            if (targetId === 'issue' && typeof window.resizeSignatureCanvas === 'function') {
                setTimeout(window.resizeSignatureCanvas, 50);
            }
            focusPrimaryInput(targetId);
        });
    });
}

function focusPrimaryInput(sectionId) {
    let targetInput = null;
    if (sectionId === 'receive') targetInput = document.getElementById('receive-serial');
    else if (sectionId === 'issue') targetInput = document.getElementById('issue-serial');
    if (targetInput) targetInput.focus();
}

// Forms Setup
function setupForms() {
    const receiveSerial = document.getElementById('receive-serial');
    const receiveModel = document.getElementById('receive-model');
    const colorChips = document.getElementById('color-suggestions');
    const btnSubmitReceive = document.getElementById('btn-submit-receive');
    const receiveForm = document.getElementById('receive-form');
    const receiveMachineInfo = document.getElementById('receive-machine-info');
    const receiveRoomBadge = document.getElementById('receive-room-badge');
    const receiveModelBadge = document.getElementById('receive-model-badge');
    const receiveReceiver = document.getElementById('receive-receiver');
    const receiverChips = document.querySelectorAll('.receiver-chip');

    let receiveDebounceTimer;
    receiveSerial.addEventListener('input', (e) => {
        clearTimeout(receiveDebounceTimer);
        const serial = e.target.value.trim();
        receiveModel.value = ''; receiveModel.disabled = true;
        colorChips.classList.add('hidden'); btnSubmitReceive.disabled = true;
        receiveMachineInfo.classList.add('hidden');
        
        if (serial.length >= 3) {
            receiveDebounceTimer = setTimeout(() => {
                const normalizedSerial = serial.toUpperCase();
                const machineKey = Object.keys(MACHINE_MASTER).find(k => k.toUpperCase() === normalizedSerial);
                const machine = machineKey ? MACHINE_MASTER[machineKey] : null;

                if (machine) {
                    receiveMachineInfo.classList.remove('hidden');
                    receiveRoomBadge.textContent = 'ห้อง: ' + machine.room;
                    receiveModelBadge.textContent = 'รุ่น: ' + machine.baseModel;
                    receiveModel.disabled = false;
                    receiveModel.value = machine.baseModel + ' ';
                    colorChips.classList.remove('hidden');
                    receiveModel.focus();
                }
            }, 300);
        }
    });

    document.querySelectorAll('#color-suggestions .chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const color = e.target.getAttribute('data-color');
            const serialInput = receiveSerial.value.trim().toUpperCase();
            const machineKey = Object.keys(MACHINE_MASTER).find(k => k.toUpperCase() === serialInput);
            if (machineKey) {
                receiveModel.value = MACHINE_MASTER[machineKey].baseModel + ' ' + color;
                btnSubmitReceive.disabled = false;
            }
        });
    });

    receiveModel.addEventListener('input', () => {
        btnSubmitReceive.disabled = receiveModel.value.trim().length === 0 || !receiveReceiver.value;
    });

    receiverChips.forEach(chip => {
        chip.addEventListener('click', () => {
            receiverChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            receiveReceiver.value = chip.dataset.value;
            btnSubmitReceive.disabled = receiveModel.value.trim().length === 0 || !receiveReceiver.value;
        });
    });

    receiveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const model = receiveModel.value.trim();
        const serial = receiveSerial.value.trim();
        const receiver = receiveReceiver.value.trim();
        if (!model || !serial || !receiver) return;
        const machineKey = Object.keys(MACHINE_MASTER).find(k => k.toUpperCase() === serial.toUpperCase());
        const room = machineKey ? MACHINE_MASTER[machineKey].room : '';
        await submitReceive(model, serial, receiver, room);
    });

    // Issue Form
    const issueSerial = document.getElementById('issue-serial');
    const issueModelSelect = document.getElementById('issue-model');
    const issueRoom = document.getElementById('issue-room');
    const btnSubmitIssue = document.getElementById('btn-submit-issue');
    const issueSerialStatus = document.getElementById('issue-serial-status');
    const issueForm = document.getElementById('issue-form');
    const issueMachineInfo = document.getElementById('issue-machine-info');
    const issueRoomBadge = document.getElementById('issue-room-badge');
    
    let issueDebounceTimer;
    issueSerial.addEventListener('input', (e) => {
        clearTimeout(issueDebounceTimer);
        const serial = e.target.value.trim();
        disableIssueForm();
        issueSerialStatus.textContent = '';
        issueMachineInfo.classList.add('hidden');
        
        if (serial.length >= 3) {
            issueDebounceTimer = setTimeout(() => {
                const normalizedSerial = serial.toUpperCase();
                const machineKey = Object.keys(MACHINE_MASTER).find(k => k.toUpperCase() === normalizedSerial);
                const machine = machineKey ? MACHINE_MASTER[machineKey] : null;

                if (machine) {
                    issueMachineInfo.classList.remove('hidden');
                    issueRoomBadge.textContent = 'ห้อง: ' + machine.room;
                    issueRoom.value = machine.room;
                    checkMachineStatus(machineKey);
                }
            }, 600);
        }
    });

    issueModelSelect.addEventListener('change', () => {
        if (issueModelSelect.value) checkSignatureAndEnableSubmit();
    });

    issueForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const serial = issueSerial.value.trim();
        const model = issueModelSelect.value;
        const room = issueRoom.value.trim();
        if (isCanvasEmpty(canvas)) {
            showToast("กรุณาเซ็นชื่อผู้เบิก", "error");
            return;
        }
        const signatureBase64 = canvas.toDataURL('image/png');
        if (!serial || !model || !room) return;
        await submitIssue(serial, model, room, signatureBase64);
    });

    refreshBtn.addEventListener('click', fetchData);
    if (document.querySelector('.toast-close')) {
        document.querySelector('.toast-close').addEventListener('click', () => toast.classList.remove('show'));
    }
}

// Signature Pad Logic
function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const btnClear = document.getElementById('btn-clear-signature');
    ctx = canvas.getContext('2d');

    window.resizeSignatureCanvas = function() {
        if (canvas.offsetWidth === 0) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    window.addEventListener('resize', window.resizeSignatureCanvas);
    setTimeout(window.resizeSignatureCanvas, 100);

    const getCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e) => {
        if (canvas.classList.contains('disabled')) return;
        isDrawing = true;
        const { x, y } = getCoordinates(e);
        ctx.beginPath(); ctx.moveTo(x, y);
        if (e.touches) e.preventDefault();
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y); ctx.stroke();
        checkSignatureAndEnableSubmit();
        if (e.touches) e.preventDefault();
    };

    const stopDrawing = () => { if (isDrawing) { ctx.closePath(); isDrawing = false; } };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            clearCanvas();
            checkSignatureAndEnableSubmit();
        });
    }
}

function clearCanvas() { if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
function isCanvasEmpty(canv) {
    if (!canv) return true;
    const blank = document.createElement('canvas');
    blank.width = canv.width; blank.height = canv.height;
    return canv.toDataURL() === blank.toDataURL();
}

function checkSignatureAndEnableSubmit() {
    const btnSubmitIssue = document.getElementById('btn-submit-issue');
    const issueModelSelect = document.getElementById('issue-model');
    if (btnSubmitIssue && issueModelSelect) {
        btnSubmitIssue.disabled = !(issueModelSelect.value && !isCanvasEmpty(canvas));
    }
}

// API Calls
async function fetchData() {
    showLoader();
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getData`);
        const result = await response.json();
        if (result.status === 'success') {
            inventoryData = result.allRows;
            renderDashboard(result);
        } else {
            showToast("Failed: " + result.message, "error");
        }
    } catch (error) {
        showToast("Network error.", "error");
    } finally {
        hideLoader();
    }
}

async function checkMachineStatus(serial) {
    const statusEl = document.getElementById('issue-serial-status');
    if (statusEl) {
        statusEl.textContent = 'กำลังตรวจสอบสต๊อก...';
        statusEl.className = 'status-text';
    }
    try {
        const response = await fetch(`${SCRIPT_URL}?action=checkMachine&serial=${encodeURIComponent(serial)}`);
        const result = await response.json();
        if (result.status === 'success' && result.models.length > 0) {
            if (statusEl) {
                statusEl.textContent = `พบหมึกในสต๊อก ${result.models.length} รุ่น`;
                statusEl.className = 'status-text success';
            }
            populateIssueModels(result.models);
            
            // Auto-select model if passed from Stock Modal
            const issueSerial = document.getElementById('issue-serial');
            const targetModel = issueSerial.dataset.targetModel;
            if (targetModel) {
                const select = document.getElementById('issue-model');
                for (let i = 0; i < select.options.length; i++) {
                    if (select.options[i].value === targetModel) {
                        select.selectedIndex = i;
                        select.dispatchEvent(new Event('change'));
                        break;
                    }
                }
                // Clear it so it doesn't affect manual typing later
                delete issueSerial.dataset.targetModel;
            }
        } else {
            if (statusEl) {
                statusEl.textContent = result.message || "ไม่พบหมึกในสต๊อก";
                statusEl.className = 'status-text error';
            }
            disableIssueForm();
        }
    } catch (error) {
        if (statusEl) statusEl.textContent = 'Error';
    }
}

function populateIssueModels(models) {
    const select = document.getElementById('issue-model');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>เลือกรุ่นหมึกที่ต้องการเบิก...</option>';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model; option.textContent = model;
        select.appendChild(option);
    });
    select.disabled = false;
}

function disableIssueForm() {
    const select = document.getElementById('issue-model');
    if (select) {
        select.innerHTML = '<option value="" disabled selected>กรุณาระบุ Serial ก่อน...</option>';
        select.disabled = true;
    }
    const issueRoom = document.getElementById('issue-room');
    if (issueRoom) issueRoom.value = '';
    if (ctx) clearCanvas();
    const btnSubmitIssue = document.getElementById('btn-submit-issue');
    if (btnSubmitIssue) btnSubmitIssue.disabled = true;
}

async function submitReceive(model, serial, receiver, room) {
    showLoader();
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'receive', model, serial, receiver, room }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await response.json();
        if (result.status === 'success') {
            showToast(result.message, "success");
            resetReceiveForm();
            fetchData();
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        showToast("Error submitting.", "error");
    } finally {
        hideLoader();
    }
}

function resetReceiveForm() {
    const form = document.getElementById('receive-form');
    if (form) form.reset();
    const model = document.getElementById('receive-model');
    if (model) {
        model.disabled = true;
        document.getElementById('color-suggestions').classList.add('hidden');
        document.getElementById('receive-machine-info').classList.add('hidden');
    }
    document.querySelectorAll('.receiver-chip').forEach(c => c.classList.remove('active'));
    const rec = document.getElementById('receive-receiver');
    if (rec) rec.value = '';
    const btn = document.getElementById('btn-submit-receive');
    if (btn) btn.disabled = true;
}

async function submitIssue(serial, model, room, signatureBase64) {
    showLoader();
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'issue', serial, model, room, signatureBase64 }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await response.json();
        if (result.status === 'success') {
            showToast(result.message, "success");
            const form = document.getElementById('issue-form');
            if (form) form.reset();
            disableIssueForm();
            fetchData();
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        showToast("Error submitting.", "error");
    } finally {
        hideLoader();
    }
}

function showToast(message, type = 'success') {
    const title = document.getElementById('toast-title');
    const msg = document.getElementById('toast-message');
    if (toast) {
        toast.className = `toast show ${type}`;
        if (title) title.textContent = type === 'success' ? 'สำเร็จ' : 'ข้อผิดพลาด';
        if (msg) msg.textContent = message;
        setTimeout(() => toast.classList.remove('show'), 5000);
    }
}

function showLoader() { if (loader) loader.classList.remove('hidden'); }
function hideLoader() { if (loader) loader.classList.add('hidden'); }

// Rendering
function renderDashboard(data) {
    const grid = document.getElementById('stats-grid');
    const tableBody = document.getElementById('activity-table-body');
    if (!grid || !tableBody) return;
    
    const totalReceived = data.allRows.length;
    const totalIssued = data.allRows.filter(r => r.dateIssued !== "").length;
    const inStock = totalReceived - totalIssued;
    
    const stockByModel = {};
    data.allRows.forEach(r => {
        if (!stockByModel[r.model]) stockByModel[r.model] = { received: 0, issued: 0 };
        stockByModel[r.model].received++;
        if (r.dateIssued !== "") stockByModel[r.model].issued++;
    });

    let topModel = "N/A", topModelStock = 0;
    for (const [model, counts] of Object.entries(stockByModel)) {
        const stock = counts.received - counts.issued;
        if (stock > topModelStock) { topModelStock = stock; topModel = model; }
    }

    grid.innerHTML = `
        <div class="stat-card glass-panel" id="card-instock" style="cursor: pointer;">
            <div class="stat-title">คงเหลือในสต๊อก (รวม)</div>
            <div class="stat-value" style="color: var(--primary-color);">${inStock}</div>
        </div>
        <div class="stat-card glass-panel">
            <div class="stat-title">รับเข้าทั้งหมด</div>
            <div class="stat-value" style="color: var(--secondary-color);">${totalReceived}</div>
        </div>
        <div class="stat-card glass-panel">
            <div class="stat-title">เบิกออกทั้งหมด</div>
            <div class="stat-value" style="color: var(--warning-color);">${totalIssued}</div>
        </div>
        <div class="stat-card glass-panel">
            <div class="stat-title">รุ่นที่มีมากที่สุด</div>
            <div class="stat-value" style="font-size: 24px;">${topModel}</div>
            <div class="stat-title">คงเหลือ: ${topModelStock}</div>
        </div>
    `;

    if (data.recentActivity && data.recentActivity.length > 0) {
        window.currentRecentActivity = data.recentActivity;
        tableBody.innerHTML = data.recentActivity.map((row, index) => {
            const isIssued = row.dateIssued !== "";
            const date = isIssued ? row.dateIssued : row.dateReceived;
            const typeClass = isIssued ? 'issue' : 'receive';
            const typeText = isIssued ? 'เบิกออก' : 'รับเข้า';
            
            let signerHtml = '-';
            if (isIssued && row.signer) {
                if (row.signer.startsWith('http') || row.signer.startsWith('data:image')) {
                    signerHtml = `<img src="${row.signer}" alt="ลายเซ็นต์" onclick="window.open('${row.signer}', '_blank'); event.stopPropagation();">`;
                } else { signerHtml = row.signer; }
            } else if (!isIssued && row.receiver) {
                signerHtml = row.receiver;
            }

            return `<tr class="clickable-row" onclick="openTxModal(${index})">
                <td>${date}</td>
                <td><span class="badge ${typeClass}">${typeText}</span></td>
                <td>${row.model}</td>
                <td>${row.serial}</td>
                <td>${row.room || '-'}</td>
                <td>${signerHtml}</td>
            </tr>`;
        }).join('');
    } else {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">ไม่มีข้อมูล</td></tr>`;
    }

    const cardInstock = document.getElementById('card-instock');
    if (cardInstock) cardInstock.addEventListener('click', () => openStockModal(data.allRows));
}

function setupSerialSuggestions() {
    const datalist = document.getElementById('serial-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    Object.keys(MACHINE_MASTER).forEach(serial => {
        const option = document.createElement('option');
        option.value = serial;
        option.textContent = `${serial} - ${MACHINE_MASTER[serial].room}`;
        datalist.appendChild(option);
    });
}

// Stock Modal Logic
function openStockModal(allRows) {
    const modal = document.getElementById('stock-modal');
    const modalBody = document.getElementById('stock-modal-body');
    if (!modal || !modalBody) return;
    
    const unissued = allRows.filter(r => r.dateIssued === "" || r.dateIssued === null);
    const stockByRoom = {};
    
    unissued.forEach(item => {
        let room = item.room || (MACHINE_MASTER[item.serial] ? MACHINE_MASTER[item.serial].room : 'ไม่ระบุห้อง');
        if (!stockByRoom[room]) stockByRoom[room] = {};
        if (!stockByRoom[room][item.model]) stockByRoom[room][item.model] = { qty: 0, serial: item.serial };
        stockByRoom[room][item.model].qty++;
    });

    let html = '';
    const rooms = Object.keys(stockByRoom).sort();
    if (rooms.length === 0) {
        html = '<p style="text-align:center;">ไม่มีหมึกคงเหลือ</p>';
    } else {
        rooms.forEach(room => {
            html += `<div class="stock-room-group"><div class="stock-room-title">ห้อง: ${room}</div><ul class="stock-model-list">`;
            Object.keys(stockByRoom[room]).sort().forEach(model => {
                const stockData = stockByRoom[room][model];
                html += `<li><span>${model} <span class="stock-qty">${stockData.qty} กล่อง</span></span>
                <button class="btn-direct-issue" data-serial="${stockData.serial}" data-model="${model}">เบิก</button></li>`;
            });
            html += `</ul></div>`;
        });
    }
    modalBody.innerHTML = html;
    modal.classList.remove('hidden');

    document.querySelectorAll('.btn-direct-issue').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const serial = e.currentTarget.getAttribute('data-serial');
            const targetModel = e.currentTarget.getAttribute('data-model');
            modal.classList.add('hidden');
            const issueLink = document.querySelector('.nav-links li[data-target="issue"]');
            if (issueLink) issueLink.click();
            setTimeout(() => {
                const issueSerial = document.getElementById('issue-serial');
                if (issueSerial) {
                    issueSerial.value = serial;
                    issueSerial.dataset.targetModel = targetModel; // Pass the model
                    issueSerial.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 300);
        });
    });
}

if (document.getElementById('btn-close-modal')) {
    document.getElementById('btn-close-modal').onclick = () => document.getElementById('stock-modal').classList.add('hidden');
}

// Transaction Modal Logic
function openTxModal(index) {
    if (!window.currentRecentActivity || !window.currentRecentActivity[index]) return;
    const row = window.currentRecentActivity[index];
    const modal = document.getElementById('tx-modal');
    const modalBody = document.getElementById('tx-modal-body');
    if (!modal || !modalBody) return;
    
    const isIssued = row.dateIssued !== "";
    const statusText = isIssued ? 'เบิกออกแล้ว' : 'อยู่ในสต๊อก (รับเข้าใหม่)';
    const statusClass = isIssued ? 'issue' : 'receive';
    
    let issuerHtml = '-';
    if (row.signer) {
        if (row.signer.startsWith('http') || row.signer.startsWith('data:image')) {
            issuerHtml = `<img src="${row.signer}" alt="ลายเซ็นต์" class="tx-signature-img" onclick="window.open('${row.signer}', '_blank')">`;
        } else {
            issuerHtml = row.signer;
        }
    }

    modalBody.innerHTML = `
        <div class="tx-details">
            <div class="tx-detail-item">
                <span class="tx-label">สถานะปัจจุบัน:</span>
                <span class="badge ${statusClass}">${statusText}</span>
            </div>
            <div class="tx-detail-item">
                <span class="tx-label">รุ่นหมึก:</span>
                <span class="tx-value">${row.model}</span>
            </div>
            <div class="tx-detail-item">
                <span class="tx-label">Serial Number:</span>
                <span class="tx-value">${row.serial}</span>
            </div>
            <div class="tx-detail-item">
                <span class="tx-label">ห้อง:</span>
                <span class="tx-value">${row.room || '-'}</span>
            </div>
            <hr class="tx-divider">
            <div class="tx-detail-group">
                <h4 style="margin-bottom: 12px; color: var(--secondary-color); display: flex; align-items: center; gap: 6px;">
                    <i class="ph ph-box-arrow-down"></i> ข้อมูลการรับเข้า
                </h4>
                <div class="tx-detail-item">
                    <span class="tx-label">วันที่รับเข้า:</span>
                    <span class="tx-value">${row.dateReceived || '-'}</span>
                </div>
                <div class="tx-detail-item">
                    <span class="tx-label">ผู้รับเข้า:</span>
                    <span class="tx-value font-medium">${row.receiver || '-'}</span>
                </div>
            </div>
            <hr class="tx-divider">
            <div class="tx-detail-group">
                <h4 style="margin-bottom: 12px; color: var(--warning-color); display: flex; align-items: center; gap: 6px;">
                    <i class="ph ph-box-arrow-up"></i> ข้อมูลการเบิกออก
                </h4>
                <div class="tx-detail-item">
                    <span class="tx-label">วันที่เบิกออก:</span>
                    <span class="tx-value">${row.dateIssued || '-'}</span>
                </div>
                <div class="tx-detail-item" style="align-items: flex-start;">
                    <span class="tx-label" style="margin-top: 4px;">ผู้เบิก/ลายเซ็นต์:</span>
                    <span class="tx-value">${issuerHtml}</span>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

if (document.getElementById('btn-close-tx-modal')) {
    document.getElementById('btn-close-tx-modal').onclick = () => document.getElementById('tx-modal').classList.add('hidden');
}

function renderMockData() {
    renderDashboard({
        allRows: [
            { model: "IM C6010 M", serial: "9173RB20165", dateReceived: "10/05/2026", dateIssued: "", room: "" },
            { model: "IM C6010 C", serial: "9173RB20165", dateReceived: "10/05/2026", dateIssued: "11/05/2026", room: "วิชาการ", signer: "สมชาย" }
        ],
        recentActivity: [
            { model: "IM C6010 C", serial: "9173RB20165", dateReceived: "10/05/2026", dateIssued: "11/05/2026", room: "วิชาการ", signer: "สมชาย" }
        ]
    });
}
