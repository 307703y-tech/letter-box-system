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
    const stored = localStorage.getItem('letters');
    if (stored) {
        letters = JSON.parse(stored);
    }
}

// 保存信件到 localStorage
function saveLetters() {
    localStorage.setItem('letters', JSON.stringify(letters));
}

// 模态框操作
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
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
    document.getElementById(tabName).classList.add('active');
    
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
    blankCanvasData = drawingHistory[0];
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
    document.getElementById('penBtn').classList.toggle('active', tool === 'pen');
    document.getElementById('eraserBtn').classList.toggle('active', tool === 'eraser');
}

function setColor(color) {
    penColor = color;
}

function setSize(size) {
    penSize = Number(size);
}

// 提交信件
function submitLetter() {
    const senderName = document.getElementById('senderName').value.trim();
    const recipientName = document.getElementById('recipientName').value.trim();
    const accessCode = document.getElementById('writeAccessCode').value.trim();
    
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
    
    // 检查取信码是否已存在
    if (letters.some(letter => letter.accessCode === accessCode)) {
        alert('此取信码已被使用，请设置其他取信码');
        return;
    }
    
    // 检查是否有内容
    const textContent = document.getElementById('letterContent').value.trim();
    const canvasImageData = canvas.toDataURL();
    const isCanvasEmpty = (blankCanvasData && canvasImageData === blankCanvasData) || (!blankCanvasData && drawingHistory.length <= 1);
    
    // 检查活跃的标签页内容
    const textTabActive = document.getElementById('textInput').classList.contains('active');
    
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
    document.getElementById('senderName').value = '';
    document.getElementById('recipientName').value = '';
    document.getElementById('letterContent').value = '';
    document.getElementById('writeAccessCode').value = '';
    clearCanvas();
}

// 取信
function accessLetter() {
    const code = document.getElementById('accessInput').value.trim();
    
    if (!code) {
        alert('请输入取信码');
        return;
    }
    
    const letter = letters.find(l => l.accessCode === code);
    
    if (!letter) {
        alert('未找到对应的信件，请检查取信码是否正确');
        return;
    }
    
    // 显示信件
    displayLetter(letter);
    closeModal('accessModal');
    showModal('letterModal');
    
    // 清空取信码输入框
    document.getElementById('accessInput').value = '';
}

// 显示信件内容
function displayLetter(letter) {
    // header 仍然显示固定文字或可自定义
    document.getElementById('displayHeader').textContent = '远方来信';
    document.getElementById('displaySender').textContent = letter.senderName;
    document.getElementById('displayRecipient').textContent = letter.recipientName;
    document.getElementById('displayDate').textContent = letter.createdDate;
    
    const contentDiv = document.getElementById('displayContent');
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

// 支持回车键提交（取信框）
document.addEventListener('DOMContentLoaded', function() {
    const accessEl = document.getElementById('accessInput');
    if (accessEl) {
        accessEl.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                accessLetter();
            }
        });
    }
});

// 字迹模仿（前端示例）
function submitImitate() {
    const fileInput = document.getElementById('handwritingFile');
    const preview = document.getElementById('imitatePreview');
    preview.innerHTML = '';
    if (!fileInput.files || !fileInput.files[0]) {
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

        // 示例：这里应该调用后端或第三方 AI 服务来识别并生成模仿结果。
        // 前端示例只做简单的预览；真正要做到“模仿字迹”需后端服务：
        // 1) 将图片发送给 ML 模型（例如调用自托管的模型或第三方API，如 Replicate、OpenAI 的图像/模型等）
        // 2) 接收生成的字体样式或笔迹参数，或直接接收用于绘制的矢量数据/样本
        // 3) 在前端用 canvas 或 font-face 来展示模仿结果
        
        // 下面是一个伪调用示例（需要后端支持）：
        // fetch('/api/imitate-handwriting', { method: 'POST', body: formData })
        //   .then(res => res.json())
        //   .then(data => show imitation ...)
        
        const hint = document.createElement('p');
        hint.textContent = '（这是预览示例。要生成模仿结果，请接入后端/第三方 AI）';
        preview.appendChild(hint);
    };
    reader.readAsDataURL(file);
}
