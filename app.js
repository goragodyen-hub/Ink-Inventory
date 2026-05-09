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
    
    // Automatically focus on the appropriate input when tab changes
    focusPrimaryInput('dashboard');

    if (SCRIPT_URL !== "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
        fetchData();
    } else {
        // Mock data for display before setup
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
    if (theme === 'dark') {
        icon.className = 'ph ph-sun';
    } else {
        icon.className = 'ph ph-moon';
    }
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
            
            // If switching to issue tab, ensure canvas is resized properly
            if (targetId === 'issue' && typeof window.resizeSignatureCanvas === 'function') {
                setTimeout(window.resizeSignatureCanvas, 50);
            }
            
            focusPrimaryInput(targetId);
        });
    });
}

function focusPrimaryInput(sectionId) {
    if (sectionId === 'receive') {
        document.getElementById('receive-serial').focus();
    } else if (sectionId === 'issue') {
        document.getElementById('issue-serial').focus();
    }
}

// Forms Setup
function setupForms() {
    // === Receive Form ===
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
        
        // Reset state
        receiveModel.value = '';
        receiveModel.disabled = true;
        colorChips.classList.add('hidden');
        btnSubmitReceive.disabled = true;
        receiveMachineInfo.classList.add('hidden');
        
        if (serial.length > 3) {
            receiveDebounceTimer = setTimeout(() => {
                const machine = MACHINE_MASTER[serial];
                if (machine) {
                    // Found machine
                    receiveMachineInfo.classList.remove('hidden');
                    receiveRoomBadge.textContent = 'ห้อง: ' + machine.room;
                    receiveRoomBadge.className = 'badge receive';
                    receiveModelBadge.textContent = 'รุ่น: ' + machine.baseModel;
                    receiveModelBadge.className = 'badge';
                    
                    receiveModel.disabled = false;
                    receiveModel.value = machine.baseModel + ' '; // Auto fill base model
                    colorChips.classList.remove('hidden');
                    
                    receiveModel.focus();
                }
            }, 300);
        }
    });

    // Handle color chip clicks
    document.querySelectorAll('#color-suggestions .chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const color = e.target.getAttribute('data-color');
            const serial = receiveSerial.value.trim();
            const machine = MACHINE_MASTER[serial];
            if (machine) {
                receiveModel.value = machine.baseModel + ' ' + color;
                btnSubmitReceive.disabled = false;
            }
        });
    });

    receiveModel.addEventListener('input', (e) => {
        btnSubmitReceive.disabled = e.target.value.trim().length === 0 || !receiveReceiver.value;
    });

    // Receiver Chip Selection
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
        
        const machine = MACHINE_MASTER[serial];
        const room = machine ? machine.room : '';
        
        await submitReceive(model, serial, receiver, room);
    });

    // === Issue Form ===
    const issueSerial = document.getElementById('issue-serial');
    const issueModelSelect = document.getElementById('issue-model');
    const issueRoom = document.getElementById('issue-room');
    const btnSubmitIssue = document.getElementById('btn-submit-issue');
    const issueSerialStatus = document.getElementById('issue-serial-status');
    const issueForm = document.getElementById('issue-form');
    const issueMachineInfo = document.getElementById('issue-machine-info');
    const issueRoomBadge = document.getElementById('issue-room-badge');
    
    const signaturePadEl = document.getElementById('signature-pad');
    const btnClearSignature = document.getElementById('btn-clear-signature');

    let issueDebounceTimer;
    issueSerial.addEventListener('input', (e) => {
        clearTimeout(issueDebounceTimer);
        const serial = e.target.value.trim();
        
        // Reset state
        disableIssueForm();
        issueSerialStatus.textContent = '';
        issueSerialStatus.className = 'status-text';
        issueMachineInfo.classList.add('hidden');
        
        if (serial.length > 3) {
            issueDebounceTimer = setTimeout(() => {
                // Check Master Data first
                const machine = MACHINE_MASTER[serial];
                if (machine) {
                    issueMachineInfo.classList.remove('hidden');
                    issueRoomBadge.textContent = 'ห้อง: ' + machine.room;
                    issueRoomBadge.className = 'badge issue';
                    issueRoom.value = machine.room;
                }
                
                checkMachineStatus(serial);
            }, 800);
        }
    });

    issueModelSelect.addEventListener('change', () => {
        if (issueModelSelect.value) {
            checkSignatureAndEnableSubmit();
        }
    });

    issueForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const serial = issueSerial.value.trim();
        const model = issueModelSelect.value;
        const room = issueRoom.value.trim();
        
        // Ensure signature is not empty
        if (isCanvasEmpty(canvas)) {
            showToast("กรุณาเซ็นชื่อผู้เบิก", "error");
            return;
        }

        const signatureBase64 = canvas.toDataURL('image/png');

        if (!serial || !model || !room) return;
        await submitIssue(serial, model, room, signatureBase64);
    });

    refreshBtn.addEventListener('click', fetchData);
    
    document.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('show');
    });
}

// Signature Pad Logic
function initSignaturePad() {
    canvas = document.getElementById('signature-pad');
    const btnClear = document.getElementById('btn-clear-signature');
    ctx = canvas.getContext('2d');

    // Resize canvas properly based on display size
    window.resizeSignatureCanvas = function() {
        if (canvas.offsetWidth === 0) return; // Still hidden
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.scale(ratio, ratio);
        
        // Set stroke styles
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        ctx.strokeStyle = isDark ? '#f9fafb' : '#1f2937';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    // Call resize initially and on resize
    window.addEventListener('resize', window.resizeSignatureCanvas);
    
    // Defer the first resize to ensure CSS is applied
    setTimeout(window.resizeSignatureCanvas, 100);

    // Watch theme change for stroke color
    document.getElementById('theme-toggle').addEventListener('click', () => {
        setTimeout(() => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            ctx.strokeStyle = isDark ? '#f9fafb' : '#1f2937';
        }, 10);
    });

    // Drawing Events
    const getCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        if (canvas.classList.contains('disabled')) return;
        isDrawing = true;
        const { x, y } = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        e.preventDefault();
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        e.preventDefault();
        checkSignatureAndEnableSubmit();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            ctx.closePath();
            isDrawing = false;
        }
    };

    // Mouse Events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch Events
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    // Clear Button
    btnClear.addEventListener('click', () => {
        clearCanvas();
        checkSignatureAndEnableSubmit();
    });
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function isCanvasEmpty(canv) {
    const blank = document.createElement('canvas');
    blank.width = canv.width;
    blank.height = canv.height;
    return canv.toDataURL() === blank.toDataURL();
}

function checkSignatureAndEnableSubmit() {
    const btnSubmitIssue = document.getElementById('btn-submit-issue');
    const issueModelSelect = document.getElementById('issue-model');
    // Enable submit only if model is selected and signature is not empty
    if (issueModelSelect.value && !isCanvasEmpty(canvas)) {
        btnSubmitIssue.disabled = false;
    } else {
        btnSubmitIssue.disabled = true;
    }
}

// API Calls
async function fetchData() {
    if (SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") return;
    
    showLoader();
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getData`);
        const result = await response.json();
        
        if (result.status === 'success') {
            inventoryData = result.allRows;
            renderDashboard(result);
        } else {
            showToast("Failed to fetch data: " + result.message, "error");
        }
    } catch (error) {
        showToast("Network error. Could not fetch data.", "error");
        console.error(error);
    } finally {
        hideLoader();
    }
}

async function checkMachineStatus(serial) {
    if (SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
        // Mock behavior
        populateIssueModels(["IM C6010 M", "IM C6010 C"]);
        document.getElementById('issue-serial-status').textContent = "Mock: พบหมึก 2 รุ่น";
        document.getElementById('issue-serial-status').className = 'status-text success';
        return;
    }

    const statusEl = document.getElementById('issue-serial-status');
    statusEl.textContent = 'กำลังตรวจสอบสต๊อก...';
    statusEl.className = 'status-text';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=checkMachine&serial=${encodeURIComponent(serial)}`);
        const result = await response.json();
        
        if (result.status === 'success' && result.models.length > 0) {
            statusEl.textContent = `พบหมึกในสต๊อก ${result.models.length} รุ่น`;
            statusEl.className = 'status-text success';
            populateIssueModels(result.models);
            
            // Check for direct issue target model
            const issueSerialEl = document.getElementById('issue-serial');
            if (issueSerialEl.dataset.targetModel) {
                const selectEl = document.getElementById('issue-model');
                for (let i = 0; i < selectEl.options.length; i++) {
                    if (selectEl.options[i].value === issueSerialEl.dataset.targetModel) {
                        selectEl.selectedIndex = i;
                        selectEl.dispatchEvent(new Event('change'));
                        break;
                    }
                }
                delete issueSerialEl.dataset.targetModel;
            }
            
            // Update room if not found in master data but found in sheet
            if (result.room && !document.getElementById('issue-room').value) {
                document.getElementById('issue-room').value = result.room;
            }
        } else {
            statusEl.textContent = result.message || "ไม่พบหมึกในสต๊อก";
            statusEl.className = 'status-text error';
            disableIssueForm();
        }
    } catch (error) {
        statusEl.textContent = 'Network Error. Could not verify.';
        statusEl.className = 'status-text error';
    }
}

function populateIssueModels(models) {
    const select = document.getElementById('issue-model');
    select.innerHTML = '<option value="" disabled selected>เลือกรุ่นหมึกที่ต้องการเบิก...</option>';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        select.appendChild(option);
    });
    select.disabled = false;
    // Don't enable submit yet, need to choose model first
}

function disableIssueForm() {
    const select = document.getElementById('issue-model');
    select.innerHTML = '<option value="" disabled selected>กรุณาระบุ Serial ก่อน...</option>';
    select.disabled = true;
    document.getElementById('issue-room').value = '';
    
    if (ctx) clearCanvas();
    
    document.getElementById('btn-submit-issue').disabled = true;
}

async function submitReceive(model, serial, receiver, room) {
    if (SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
        showToast("Mock: Received " + model + " for " + serial + " by " + receiver, "success");
        resetReceiveForm();
        return;
    }

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
            fetchData(); // Refresh data
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        showToast("Network error. Could not submit.", "error");
        console.error(error);
    } finally {
        hideLoader();
    }
}

function resetReceiveForm() {
    document.getElementById('receive-form').reset();
    document.getElementById('receive-model').disabled = true;
    document.getElementById('color-suggestions').classList.add('hidden');
    document.getElementById('receive-machine-info').classList.add('hidden');
    
    // Reset receiver chips
    document.querySelectorAll('.receiver-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('receive-receiver').value = '';
    
    document.getElementById('btn-submit-receive').disabled = true;
    document.getElementById('receive-serial').focus();
}

async function submitIssue(serial, model, room, signatureBase64) {
    if (SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL") {
        showToast("Mock: Issued " + model + " for " + serial, "success");
        document.getElementById('issue-form').reset();
        disableIssueForm();
        return;
    }

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
            document.getElementById('issue-form').reset();
            disableIssueForm();
            document.getElementById('issue-serial').focus();
            fetchData(); // Refresh data
        } else {
            showToast(result.message, "error");
        }
    } catch (error) {
        showToast("Network error. Could not submit.", "error");
        console.error(error);
    } finally {
        hideLoader();
    }
}

// UI Helpers
function showToast(message, type = 'success') {
    const title = document.getElementById('toast-title');
    const msg = document.getElementById('toast-message');
    const iconContainer = document.querySelector('.toast-icon');
    
    toast.className = `toast show ${type}`;
    title.textContent = type === 'success' ? 'สำเร็จ (Success)' : 'ข้อผิดพลาด (Error)';
    msg.textContent = message;
    
    iconContainer.innerHTML = type === 'success' 
        ? '<i class="ph-fill ph-check-circle"></i>' 
        : '<i class="ph-fill ph-warning-circle"></i>';
        
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

function showLoader() {
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

// Rendering
function renderDashboard(data) {
    const grid = document.getElementById('stats-grid');
    const tableBody = document.getElementById('activity-table-body');
    
    const totalReceived = data.allRows.length;
    const totalIssued = data.allRows.filter(r => r.dateIssued !== "").length;
    const inStock = totalReceived - totalIssued;
    
    const stockByModel = {};
    data.allRows.forEach(r => {
        if (!stockByModel[r.model]) stockByModel[r.model] = { received: 0, issued: 0 };
        stockByModel[r.model].received++;
        if (r.dateIssued !== "") stockByModel[r.model].issued++;
    });

    let topModel = "N/A";
    let topModelStock = 0;
    
    for (const [model, counts] of Object.entries(stockByModel)) {
        const stock = counts.received - counts.issued;
        if (stock > topModelStock) {
            topModelStock = stock;
            topModel = model;
        }
    }

    grid.innerHTML = `
        <div class="stat-card glass-panel" id="card-instock" style="cursor: pointer;" title="คลิกเพื่อดูรายละเอียด">
            <div class="stat-title">คงเหลือในสต๊อก (รวม) <span><i class="ph ph-hand-pointing"></i></span></div>
            <div class="stat-value" style="color: var(--primary-color);">${inStock}</div>
        </div>
        <div class="stat-card glass-panel">
            <div class="stat-title">รับเข้าทั้งหมด (รายการ)</div>
            <div class="stat-value" style="color: var(--secondary-color);">${totalReceived}</div>
        </div>
        <div class="stat-card glass-panel">
            <div class="stat-title">เบิกออกทั้งหมด (รายการ)</div>
            <div class="stat-value" style="color: var(--warning-color);">${totalIssued}</div>
        </div>
        <div class="stat-card glass-panel">
            <div class="stat-title">รุ่นที่มีมากที่สุด</div>
            <div class="stat-value" style="font-size: 24px;">${topModel}</div>
            <div class="stat-title" style="margin-top:-5px">คงเหลือ: ${topModelStock}</div>
        </div>
    `;

    if (data.recentActivity && data.recentActivity.length > 0) {
        tableBody.innerHTML = data.recentActivity.map(row => {
            const isIssued = row.dateIssued !== "";
            const date = isIssued ? row.dateIssued : row.dateReceived;
            const typeClass = isIssued ? 'issue' : 'receive';
            const typeText = isIssued ? 'เบิกออก' : 'รับเข้า';
            const roomText = row.room || '-';
            
            return `
                <tr>
                    <td>${date}</td>
                    <td><span class="badge ${typeClass}">${typeText}</span></td>
                    <td>${row.model}</td>
                    <td>${row.serial}</td>
                    <td>${roomText}</td>
                </tr>
            `;
        }).join('');
    } else {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">ไม่มีข้อมูล</td></tr>`;
    }

    // Attach listener for Stock Modal
    const cardInstock = document.getElementById('card-instock');
    if (cardInstock) {
        cardInstock.addEventListener('click', () => {
            openStockModal(data.allRows);
        });
    }
}

// Stock Modal Logic
function openStockModal(allRows) {
    const modal = document.getElementById('stock-modal');
    const modalBody = document.getElementById('stock-modal-body');
    const btnClose = document.getElementById('btn-close-modal');

    // Filter only unissued stock
    const unissued = allRows.filter(r => r.dateIssued === "" || r.dateIssued === null);
    
    // Group by room -> model -> count
    const stockByRoom = {};
    
    unissued.forEach(item => {
        // Find room (fallback to machine master or "ไม่ระบุห้อง")
        let room = item.room;
        if (!room) {
            const machine = MACHINE_MASTER[item.serial];
            room = machine ? machine.room : 'ไม่ระบุห้อง';
        }
        
        if (!stockByRoom[room]) {
            stockByRoom[room] = {};
        }
        
        if (!stockByRoom[room][item.model]) {
            stockByRoom[room][item.model] = { qty: 0, serial: item.serial };
        }
        
        stockByRoom[room][item.model].qty++;
    });

    // Generate HTML
    let html = '';
    const rooms = Object.keys(stockByRoom).sort();
    
    if (rooms.length === 0) {
        html = '<p style="text-align:center; color:var(--text-light);">ไม่มีหมึกคงเหลือในสต๊อก</p>';
    } else {
        rooms.forEach(room => {
            html += `<div class="stock-room-group">
                <div class="stock-room-title"><i class="ph-fill ph-door"></i> ห้อง: ${room}</div>
                <ul class="stock-model-list">`;
                
            const models = Object.keys(stockByRoom[room]).sort();
            models.forEach(model => {
                const stockData = stockByRoom[room][model];
                html += `<li style="align-items: center;">
                    <span>${model} <span class="stock-qty" style="margin-left: 8px;">${stockData.qty} กล่อง</span></span>
                    <button class="btn-direct-issue" data-serial="${stockData.serial}" data-model="${model}">เบิก <i class="ph ph-arrow-right"></i></button>
                </li>`;
            });
            
            html += `</ul></div>`;
        });
    }

    modalBody.innerHTML = html;
    modal.classList.remove('hidden');

    // Direct issue listeners
    document.querySelectorAll('.btn-direct-issue').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const serial = e.currentTarget.getAttribute('data-serial');
            const targetModel = e.currentTarget.getAttribute('data-model');
            
            // Close modal
            modal.classList.add('hidden');
            
            // Switch to Issue tab
            const issueLink = document.querySelector('.nav-links li[data-target="issue"]');
            if (issueLink) issueLink.click();
            
            // Populate and trigger serial input
            setTimeout(() => {
                const issueSerial = document.getElementById('issue-serial');
                issueSerial.value = serial;
                issueSerial.dataset.targetModel = targetModel;
                issueSerial.focus();
                // Trigger the input event to fetch machine status automatically
                issueSerial.dispatchEvent(new Event('input', { bubbles: true }));
            }, 300);
        });
    });

    // Close listeners
    btnClose.onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    };
}

function renderMockData() {
    renderDashboard({
        allRows: [
            { model: "IM C6010 M", serial: "9173RB20165", dateReceived: "10/05/2026", dateIssued: "", room: "", signer: "" },
            { model: "IM C6010 C", serial: "9173RB20165", dateReceived: "10/05/2026", dateIssued: "11/05/2026", room: "วิชาการ (มัธยม)", signer: "สมชาย" }
        ],
        recentActivity: [
            { model: "IM C6010 C", serial: "9173RB20165", dateReceived: "10/05/2026", dateIssued: "11/05/2026", room: "วิชาการ (มัธยม)", signer: "สมชาย" },
            { model: "IM C6010 M", serial: "9173RB20165", dateReceived: "10/05/2026", dateIssued: "", room: "", signer: "" }
        ]
    });
}
