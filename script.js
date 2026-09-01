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

// 放置图片相关
let placedImageEl = null;
let placedImageData = null;
let dragState = null;

// 初始化
window.onload = function() {
    loadLetters();
    initializeHandwriteCanvas();
    createDebugUI(); // 调试面板（开发时可用）
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
        renderDebugPanel();
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
                accessEl.onkeydown = function(e) { if (e.key === 'Enter') accessLetter(); };
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
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.classList.remove('active'));
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const el = document.getElementById(tabName);
    if (el) el.classList.add('active');
    if (evt && evt.target) evt.target.classList.add('active');
    if (tabName === 'handwriteInput') setTimeout(resizeCanvas, 100);
}

// 手写画布初始化
function initializeHandwriteCanvas() {
    canvas = document.getElementById('handwriteCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    // 鼠标/触摸
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    // 保存初始状态
    saveDrawingState();
    blankCanvasData = drawingHistory[0] || null;
}

function resizeCanvas() {
    // 保持元素 CSS 大小即可；canvas 的绘制大小已设置在 HTML attrs
}

function startDrawing(e) {
    // 如果是触摸/笔，阻止页面滚动
    if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault();
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    // capture pointer to ensure we get pointerup
    canvas.setPointerCapture(e.pointerId);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
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
    lastX = x; lastY = y;
}

function stopDrawing(e) {
    if (isDrawing) {
        isDrawing = false;
        try{ if (e && e.pointerId) canvas.releasePointerCapture(e.pointerId); } catch(e){}
        saveDrawingState();
    }
}

function saveDrawingState() {
    try {
        drawingHistory.push(canvas.toDataURL('image/png'));
        if (drawingHistory.length > 60) drawingHistory.shift();
    } catch (e) { console.warn('保存画布状态失败', e); }
}

function clearCanvas() { if (!ctx) return; ctx.clearRect(0,0,canvas.width,canvas.height); drawingHistory = []; saveDrawingState(); }
function undoCanvas() { if (drawingHistory.length>1){ drawingHistory.pop(); const img = new Image(); img.src = drawingHistory[drawingHistory.length-1]; img.onload=function(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); }} else clearCanvas(); }

function setTool(tool){ currentTool=tool; document.getElementById('penBtn')?.classList.toggle('active', tool==='pen'); document.getElementById('eraserBtn')?.classList.toggle('active', tool==='eraser'); }
function setColor(c){ penColor=c; }
function setSize(s){ penSize=Number(s); }

function toggleCanvasFullscreen(){ const modal = document.getElementById('writeModal'); if(!modal) return; modal.style.display='block'; const canvasWrap = document.querySelector('.handwrite-area'); if(!canvasWrap) return; canvasWrap.requestFullscreen?.(); }

// 将手写作为图片（插入到 letter 内容中用于保存）
function useHandwritingAsContent(){ if(!canvas) return alert('无手写内容'); const data = canvas.toDataURL('image/png'); // mark placed
 placedImageData = data; alert('手写已准备，发送信件后可在信纸上查看并拖动/调整'); }

function handleUploadPaper(e){ const f = e.target.files && e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload=function(ev){ placedImageData = ev.target.result; alert('上传图片已准备，发送后可在信纸上查看并调整'); }; r.readAsDataURL(f); }

// 提交信件
function submitLetter(){
    const senderNameEl = document.getElementById('senderName');
    const recipientNameEl = document.getElementById('recipientName');
    const accessEl = document.getElementById('writeAccessCode');
    const senderName = senderNameEl ? senderNameEl.value.trim() : '';
    const recipientName = recipientNameEl ? recipientNameEl.value.trim() : '';
    const accessCode = accessEl ? accessEl.value.trim() : '';
    if(!senderName){ alert('请输入寄信人名字'); return; }
    if(!recipientName){ alert('请输入收信人名字'); return; }
    if(!accessCode){ alert('请设置取信码'); return; }
    if(letters.some(letter=>letter.accessCode && letter.accessCode.toLowerCase()===accessCode.toLowerCase())){ alert('此取信码已被使用，请设置其他取信码'); return; }
    const textContent = document.getElementById('letterContent')?.value.trim() || null;
    const textTabActive = document.getElementById('textInput')?.classList.contains('active');
    if(textTabActive && !textContent && !placedImageData){ alert('请输入信件内容或手写/上传图片作为内容'); return; }
    if(!textTabActive && !placedImageData){ alert('请手写或上传图片作为信件内容'); return; }

    const letter = { id: Date.now(), senderName, recipientName, content: textTabActive ? textContent : null, handwrittenContent: !textTabActive ? (placedImageData || null) : (placedImageData || null), accessCode, createdDate: new Date().toLocaleString('zh-CN'), createdTime: Date.now() };
    letters.push(letter); saveLetters(); alert(`信件已发送！\n\n收信人可以使用取信码 "${accessCode}" 来查看您的信件`);
    // reset
    clearLetterForm(); closeModal('writeModal'); placedImageData = null;
}

function clearLetterForm(){ document.getElementById('senderName').value=''; document.getElementById('recipientName').value=''; document.getElementById('letterContent').value=''; document.getElementById('writeAccessCode').value=''; clearCanvas(); placedImageData=null; }

// 取信
function accessLetter(){ const accessEl = document.getElementById('accessInput'); const code = accessEl ? (accessEl.value||'').trim() : ''; if(!code){ alert('请输入取信码'); return; } const letter = letters.find(l=>l.accessCode && l.accessCode.toLowerCase()===code.toLowerCase()); if(!letter){ const count=letters.length; const lastCode=count? (letters[count-1].accessCode||'') : '(无)'; alert(`未找到对应的信件，请检查取信码是否正确。\n\n调试信息：本地信件数量 ${count}，最近一条取信码：${lastCode}`); console.log('accessLetter failed. letters:', letters); return; } displayLetter(letter); closeModal('accessModal'); showModal('letterModal'); if(accessEl) accessEl.value=''; }

// 展示信件
function displayLetter(letter){ document.getElementById('displayHeader').textContent='远方来信'; document.getElementById('displaySender').textContent = letter.senderName; document.getElementById('displayRecipient').textContent = letter.recipientName; document.getElementById('displayDate').textContent = letter.createdDate; const contentDiv = document.getElementById('displayContent'); contentDiv.innerHTML=''; // remove previous placed
 removePlaced(); if(letter.content){ contentDiv.textContent = letter.content; } else if(letter.handwrittenContent){ // insert image
 const img = document.createElement('img'); img.src = letter.handwrittenContent; img.className = 'placed-handwriting'; img.style.width = '60%'; img.style.position='absolute'; img.style.left='50%'; img.style.top='140px'; img.style.transform='translate(-50%,0)'; img.onload = ()=>{ makeElementDraggable(img); showPlaceControls(); };
 const paper = document.getElementById('paperContent'); paper.appendChild(img); placedImageEl = img; }
 // ensure envelope closed
 const env = document.getElementById('envelopeView'); env?.classList.remove('opened'); // show slider
 const slider = document.getElementById('openSlider'); if(slider) slider.style.display='flex'; }

function showPlaceControls(){ const pc = document.getElementById('placeControls'); if(pc) pc.style.display='flex'; }
function removePlaced(){ if(placedImageEl && placedImageEl.parentNode) placedImageEl.parentNode.removeChild(placedImageEl); placedImageEl = null; const pc = document.getElementById('placeControls'); if(pc) pc.style.display='none'; }
function resizePlaced(v){ if(placedImageEl) placedImageEl.style.width = v + '%'; }

// 可拖拽放置的简单实现
function makeElementDraggable(el){ let dragging=false; let startX=0, startY=0, origLeft=0, origTop=0; el.style.touchAction='none'; el.addEventListener('pointerdown', function(e){ dragging=true; startX=e.clientX; startY=e.clientY; const rect = el.getBoundingClientRect(); origLeft = rect.left; origTop = rect.top; el.setPointerCapture(e.pointerId); }); document.addEventListener('pointermove', function(e){ if(!dragging) return; const dx = e.clientX - startX; const dy = e.clientY - startY; el.style.left = (origLeft + dx + el.offsetWidth/2) + 'px'; el.style.top = (origTop + dy) + 'px'; el.style.transform = 'translate(-50%,0)'; }); document.addEventListener('pointerup', function(e){ if(dragging){ dragging=false; try{ el.releasePointerCapture(e.pointerId); }catch(e){} } }); }

// 滑动解封功能（简单实现）
let unlocking = false; let startX=0; function startUnlock(e){ e.preventDefault(); unlocking=true; startX = (e.touches? e.touches[0].clientX : e.clientX); document.addEventListener('mousemove', onMoveUnlock); document.addEventListener('touchmove', onMoveUnlock,{passive:false}); document.addEventListener('mouseup', endUnlock); document.addEventListener('touchend', endUnlock); }
function onMoveUnlock(e){ if(!unlocking) return; const clientX = e.touches? e.touches[0].clientX : e.clientX; const slider = document.getElementById('openSlider'); const handle = document.getElementById('sliderHandle'); if(!slider||!handle) return; const rect = slider.getBoundingClientRect(); let pos = Math.min(Math.max(clientX - rect.left - 6, 0), rect.width - handle.offsetWidth - 6); handle.style.left = pos + 'px'; if(pos > rect.width - handle.offsetWidth - 20){ // unlocked
    unlocking=false; openEnvelope(); handle.style.left = '6px'; document.removeEventListener('mousemove', onMoveUnlock); document.removeEventListener('touchmove', onMoveUnlock); document.removeEventListener('mouseup', endUnlock); document.removeEventListener('touchend', endUnlock);
 }
}
function endUnlock(e){ unlocking=false; const handle = document.getElementById('sliderHandle'); if(handle) handle.style.left='6px'; document.removeEventListener('mousemove', onMoveUnlock); document.removeEventListener('touchmove', onMoveUnlock); document.removeEventListener('mouseup', endUnlock); document.removeEventListener('touchend', endUnlock); }
function openEnvelope(){ const env = document.getElementById('envelopeView'); if(env) env.classList.add('opened'); const slider = document.getElementById('openSlider'); if(slider) slider.style.display='none'; }

// 调试 UI
function createDebugUI(){ if(document.getElementById('__dbg_toggle')) return; const btn = document.createElement('button'); btn.id='__dbg_toggle'; btn.textContent='调试'; btn.onclick=toggleDebugPanel; document.body.appendChild(btn); const panel = document.createElement('div'); panel.id='__dbg_panel'; panel.style.display='none'; const title=document.createElement('div'); title.textContent='调试：localStorage letters'; title.style.fontWeight='bold'; title.style.marginBottom='8px'; panel.appendChild(title); const info=document.createElement('div'); info.id='__dbg_info'; info.style.fontSize='12px'; info.style.color='#444'; info.style.marginBottom='8px'; panel.appendChild(info); const list=document.createElement('pre'); list.id='__dbg_list'; list.style.whiteSpace='pre-wrap'; list.style.fontSize='12px'; list.style.margin=0; panel.appendChild(list); const actions=document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px'; actions.style.marginTop='8px'; const copyBtn=document.createElement('button'); copyBtn.textContent='复制取信码列表'; copyBtn.className='btn'; copyBtn.onclick=()=>{ const codes=letters.map(l=>l.accessCode||'').join('\n'); navigator.clipboard.writeText(codes).then(()=>alert('已复制取信码列表')); }; actions.appendChild(copyBtn); const clearBtn=document.createElement('button'); clearBtn.textContent='清空所有信（localStorage）'; clearBtn.className='btn btn-secondary'; clearBtn.onclick=()=>{ if(!confirm('确定要清空所有本地信件数据吗？此操作不可恢复。')) return; letters=[]; saveLetters(); renderDebugPanel(); alert('已清空本地信件'); }; actions.appendChild(clearBtn); panel.appendChild(actions); document.body.appendChild(panel); renderDebugPanel(); }
function toggleDebugPanel(){ const panel=document.getElementById('__dbg_panel'); if(!panel) return; panel.style.display = panel.style.display==='none'?'block':'none'; }
function renderDebugPanel(){ const info=document.getElementById('__dbg_info'); const list=document.getElementById('__dbg_list'); if(!info||!list) return; info.textContent=`本地信件数量：${letters.length} （最新一条取信码：${letters.length? (letters[letters.length-1].accessCode || '(空)') : '(无)'}）`; try{ list.textContent = JSON.stringify(letters.map(l=>({accessCode:l.accessCode,sender:l.senderName,recipient:l.recipientName,created:l.createdDate})),null,2); }catch(e){ list.textContent = String(letters); } }
function openRecentDebugInfo(){ const count=letters.length; const last= count? (letters[count-1].accessCode||'(空)') : '(无)'; alert(`本地信件数量：${count}\n最近一条取信码：${last}`); }

// 移除 placed image 按钮
function removePlaced(){ if(placedImageEl && placedImageEl.parentNode) placedImageEl.parentNode.removeChild(placedImageEl); placedImageEl=null; const pc=document.getElementById('placeControls'); if(pc) pc.style.display='none'; }
