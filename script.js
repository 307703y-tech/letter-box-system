// 信件数据存储
let letters = [];

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
function switchTab(tabName) {
    // 隐藏所有标签内容
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    // 移除所有按钮的活跃状态
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // 显示选中的标签
    document.getElementById(tabName).classList.add('active');
    
    // 添加按钮活跃状态
    event.target.classList.add('active');
    
    // 如果切换到手写模式，重新调整画布
    if (tabName === 'handwriteInput') {
        setTimeout(resizeCanvas, 100);
    }
}

// 手写画布初始化
let canvas, ctx;
let isDrawing = false;
let lastX = 0, lastY = 0;
let drawingHistory = [];

function initializeHandwriteCanvas() {
    canvas = document.getElementById('handwriteCanvas');
    ctx = canvas.getContext('2d');
    
    // 设置画布大小
    resizeCanvas();
    
    // 设置画笔样式
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 鼠标事件
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 触摸事件（支持移动设备）
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    
    // 保存初始状态
    saveDrawingState();
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const maxWidth = Math.min(500, rect.width - 40);
    canvas.width = maxWidth;
    canvas.height = 400;
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
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
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastX = x;
    lastY = y;
}

function saveDrawingState() {
    drawingHistory.push(canvas.toDataURL());
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
            ctx.drawImage(img, 0, 0);
        };
    }
}

// 提交信件
function submitLetter() {
    const senderName = document.getElementById('senderName').value.trim();
    const recipientName = document.getElementById('recipientName').value.trim();
    const letterTitle = document.getElementById('letterTitle').value.trim();
    const accessCode = document.getElementById('accessCode').value.trim();
    
    // 验证
    if (!senderName) {
        alert('请输入寄信人名字');
        return;
    }
    if (!recipientName) {
        alert('请输入收信人名字');
        return;
    }
    if (!letterTitle) {
        alert('请输入信件标题');
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
    const isCanvasEmpty = canvasImageData === canvas.toDataURL('image/png');
    
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
    
    // 创建信件对象
    const letter = {
        id: Date.now(),
        senderName: senderName,
        recipientName: recipientName,
        title: letterTitle,
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
    document.getElementById('letterTitle').value = '';
    document.getElementById('letterContent').value = '';
    document.getElementById('accessCode').value = '';
    clearCanvas();
}

// 取信
function accessLetter() {
    const code = document.getElementById('accessCode').value.trim();
    
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
    document.getElementById('accessCode').value = '';
}

// 显示信件内容
function displayLetter(letter) {
    document.getElementById('displayTitle').textContent = letter.title;
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

// 支持回车键提交
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('accessCode').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            accessLetter();
        }
    });
});