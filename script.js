// 信件数据存储
let letters = [];

// 画布/画笔相关
let canvas, ctx;
let isDrawing = false;
let lastX = 0, lastY = 0;
let drawingHistory = [];
let blankCanvasData = null;
let currentTool = 'pen'; // 'pen' or 'eraser'
let penColor = '#333333';
let penSize = 2;

// 初始化
window.onload = function() {
    loadLetters();
    initializeHandwriteCanvas();
};

// 从 localStorage 加载信件
function loadLetters() {
    try {
        const stored = localStorage.getItem('letters');
        if (stored) {
            letters = JSON.parse(stored);
        } else {
            letters = [];
        }
    } catch (e) {
        console.warn('解析 localStorage 出错，已重置 letters', e);
        letters = [];
        localStorage.removeItem('letters');
    }
}

// 保存信件到 localStorage
function saveLetters() {
    try {
        localStorage.setItem('letters', JSON.stringify(letters));
    } catch (e) {
        console.warn('保存到 localStorage 失败', e);
    }
}

// 模态框操作
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = 'block';

    // 特殊处理：打开取信框时自动聚焦输入并绑定回车事件
    if (modalId === 'accessModal') {
        setTimeout(() => {
            const accessEl = document.getElementById('accessInput');
            if (accessEl) {
                accessEl.focus();
                // 使用 onkeydown 覆盖以避免重复绑定
                accessEl.onkeydown = function(e) {
                    if (e.key === 'Enter') accessLetter();
                };
            }
        }, 80);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = 'none';

    // 清理访问框回车绑定，避免残留
    if (modalId === 'accessModal') {
        const accessEl = document.getElementById('accessInput');
        if (accessEl) accessEl.onkeydown = null;
    }
}

// 点击外部关闭模态框
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// 标签页切换
function switchTab(tabName, evt) {
    // 隐藏所有标签内容
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    // 移除所有按钮的活跃状态
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // 显示选中的标签
    const el = document.getElementById(tabName);
    if (el) el.classList.add('active');
    
    // 添加按钮活跃状态
    if (evt && evt.target) evt.target.classList.add('active');
    
    // 如果切换到手写模式，重新调整画布
    if (tabName === 'handwriteInput') {
        setTimeout(resizeCanvas, 100);
    }
}

// 手写画布初始化
function initializeHandwriteCanvas() {
    canvas = document.getElementById('handwriteCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    // 设置画布大小（保留原始宽高为默认）
    resizeCanvas();
    
    // 设置画笔样式
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    
    // 鼠标事件
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 触摸事件（支持移动设备）
    canvas.addEventListener('touchstart', handleTouchStart, {passive:false});
    canvas.addEventListener('touchmove', handleTouchMove, {passive:false});
    canvas.addEventListener('touchend', stopDrawing);
    
    // 保存初始状态
    saveDrawingState();
    blankCanvasData = drawingHistory[0] || null;
}

function resizeCanvas() {
    // 保持 canvas 元素尺寸并缩放 CSS 大小（如果需要）
    // 这里我们不改变画布实际像素尺寸，避免内容被清空
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    lastX = clientX - rect.left;
    lastY = clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);

    if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = penSize * 4; // 橡皮更粗
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = penSize;
        ctx.strokeStyle = penColor;
    }

    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
}

function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        saveDrawingState();
    }
}

function handleTouchStart(e) {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    isDrawing = true;
}

function handleTouchMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);

    if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = penSize * 4;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = penSize;
        ctx.strokeStyle = penColor;
    }

    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
}

function saveDrawingState() {
    try {
        drawingHistory.push(canvas.toDataURL());
        // 限制历史长度
        if (drawingHistory.length > 50) drawingHistory.shift();
    } catch (e) {
        console.warn('保存画布状态失败', e);
    }
}

function clearCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory = [];
    saveDrawingState();
}

function undoCanvas() {
    if (drawingHistory.length > 1) {
        drawingHistory.pop();
        const imageData = drawingHistory[drawingHistory.length - 1];
        const img = new Image();
        img.src = imageData;
        img.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
    } else {
        clearCanvas();
    }
}

function setTool(tool) {
    currentTool = tool;
    const penBtn = document.getElementById('penBtn');
    const eraserBtn = document.getElementById('eraserBtn');
    if (penBtn) penBtn.classList.toggle('active', tool === 'pen');
    if (eraserBtn) eraserBtn.classList.toggle('active', tool === 'eraser');
}

function setColor(color) {
    penColor = color;
}

function setSize(size) {
    penSize = Number(size);
}

// 提交信件
function submitLetter() {
    const senderNameEl = document.getElementById('senderName');
    const recipientNameEl = document.getElementById('recipientName');
    const accessEl = document.getElementById('writeAccessCode');
    const senderName = senderNameEl ? senderNameEl.value.trim() : '';
    const recipientName = recipientNameEl ? recipientNameEl.value.trim() : '';
    const accessCode = accessEl ? accessEl.value.trim() : '';
    
    // 验证
    if (!senderName) {
        alert('请输入寄信人名字');
        return;
    }
    if (!recipientName) {
        alert('请输入收信人名字');
        return;
    }
    if (!accessCode) {
        alert('请设置取信码');
        return;
    }
    
    // 检查取信码是否已存在（不区分大小写）
    if (letters.some(letter => letter.accessCode && letter.accessCode.toLowerCase() === accessCode.toLowerCase())) {
        alert('此取信码已被使用，请设置其他取信码');
        return;
    }
    
    // 检查是否有内容
    const textContentEl = document.getElementById('letterContent');
    const textContent = textContentEl ? textContentEl.value.trim() : '';
    const canvasImageData = canvas ? canvas.toDataURL() : '';
    const isCanvasEmpty = (blankCanvasData && canvasImageData === blankCanvasData) || (!blankCanvasData && drawingHistory.length <= 1);
    
    // 检查活跃的标签页内容
    const textTabActive = document.getElementById('textInput') && document.getElementById('textInput').classList.contains('active');
    
    if (textTabActive && !textContent) {
        alert('请输入信件内容或切换到手写模式');
        return;
    }
    
    if (!textTabActive && isCanvasEmpty) {
        alert('请手写信件内容或切换到文字模式');
        return;
    }
    
    // 创建信件对象（去掉标题）
    const letter = {
        id: Date.now(),
        senderName: senderName,
        recipientName: recipientName,
        content: textTabActive ? textContent : null,
        handwrittenContent: !textTabActive ? canvasImageData : null,
        accessCode: accessCode,
        createdDate: new Date().toLocaleString('zh-CN'),
        createdTime: new Date().getTime()
    };
    
    // 保存信件
    letters.push(letter);
    saveLetters();
    
    // 显示成功消息
    alert(`信件已发送！\n\n收信人可以使用取信码 "${accessCode}" 来查看您的信件`);
    
    // 清空表单
    clearLetterForm();
    closeModal('writeModal');
}

// 清空信件表单
function clearLetterForm() {
    const senderEl = document.getElementById('senderName');
    const recipientEl = document.getElementById('recipientName');
    const textEl = document.getElementById('letterContent');
    const accessEl = document.getElementById('writeAccessCode');
    if (senderEl) senderEl.value = '';
    if (recipientEl) recipientEl.value = '';
    if (textEl) textEl.value = '';
    if (accessEl) accessEl.value = '';
    clearCanvas();
}

// 取信
function accessLetter() {
    const accessEl = document.getElementById('accessInput');
    const code = accessEl ? (accessEl.value || '').trim() : '';
    
    if (!code) {
        alert('请输入取信码');
        return;
    }
    
    // 匹配时不区分大小写，容错更好
    const letter = letters.find(l => l.accessCode && l.accessCode.toLowerCase() === code.toLowerCase());
    
    if (!letter) {
        alert('未找到对应的信件，请检查取信码是否正确');
        return;
    }
    
    // 显示信件
    displayLetter(letter);
    closeModal('accessModal');
    showModal('letterModal');
    
    // 清空取信码输入框
    if (accessEl) accessEl.value = '';
}

// 显示信件内容
function displayLetter(letter) {
    // header 仍然显示固定文字或可自定义
    const displayHeader = document.getElementById('displayHeader');
    if (displayHeader) displayHeader.textContent = '远方来信';
    const ds = document.getElementById('displaySender');
    if (ds) ds.textContent = letter.senderName;
    const dr = document.getElementById('displayRecipient');
    if (dr) dr.textContent = letter.recipientName;
    const dd = document.getElementById('displayDate');
    if (dd) dd.textContent = letter.createdDate;
    
    const contentDiv = document.getElementById('displayContent');
    if (!contentDiv) return;
    contentDiv.innerHTML = '';
    
    if (letter.content) {
        contentDiv.textContent = letter.content;
    } else if (letter.handwrittenContent) {
        const img = document.createElement('img');
        img.src = letter.handwrittenContent;
        img.style.maxWidth = '100%';
        contentDiv.appendChild(img);
    }
}

// 字迹模仿（前端示例）
function submitImitate() {
    const fileInput = document.getElementById('handwritingFile');
    const preview = document.getElementById('imitatePreview');
    if (preview) preview.innerHTML = '';
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        alert('请选择一张图片上传');
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.style.maxWidth = '100%';
        preview.appendChild(img);

        const hint = document.createElement('p');
        hint.textContent = '（这是预览示例。要生成模仿结果，请接入后端/第三方 AI）';
        preview.appendChild(hint);
    };
    reader.readAsDataURL(file);
}
