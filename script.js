// 信件数据存储
let letters = [];

// 画布/画笔相关（改进版：DPR 缩放 + pointer events + rAF 批量渲染 + 简单平滑）
let canvas, ctx;
let isDrawing = false;
let points = []; // 临时缓冲点
let strokes = []; // 完整的 stroke 列表（用于导出或重绘）
let drawingHistory = [];
let blankCanvasData = null;
let currentTool = 'pen';
let penColor = '#333333';
let penSize = 2;

// 放置图片相关（延迟插入到 paper，避免覆盖封面）
let pendingPlacedData = null; // 在打开信封前保留，不插入 DOM
let placedImageEl = null;

// 初始化
window.onload = function() {
  loadLetters();
  initializeHandwriteCanvas();
  createDebugUI();
};

// localStorage
function loadLetters() {
  try {
    const stored = localStorage.getItem('letters');
    if (stored) letters = JSON.parse(stored); else letters = [];
  } catch (e) { console.warn('解析 localStorage 出错，已重置 letters', e); letters = []; localStorage.removeItem('letters'); }
}
function saveLetters() { try { localStorage.setItem('letters', JSON.stringify(letters)); renderDebugPanel(); } catch(e){console.warn('保存失败',e);} }

// 模态框
function showModal(modalId) { const modal = document.getElementById(modalId); if(!modal) return; modal.style.display='block'; if(modalId==='accessModal'){ setTimeout(()=>{ const accessEl = document.getElementById('accessInput'); accessEl?.focus(); },120); } }
function closeModal(modalId){ const modal = document.getElementById(modalId); if(!modal) return; modal.style.display='none'; }
window.onclick = function(e){ if(e.target.classList && e.target.classList.contains('modal')) e.target.style.display='none'; }

// 标签页切换
function switchTab(tabName, evt){ document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); const tab=document.getElementById(tabName); if(tab) tab.classList.add('active'); if(evt && evt.currentTarget) evt.currentTarget.classList.add('active'); }

// Canvas 初始化与绘制
function initializeHandwriteCanvas(){
  canvas = document.getElementById('handwriteCanvas');
  if(!canvas) return;
  ctx = canvas.getContext('2d', { alpha: true });
  ctx.lineCap='round';
  ctx.lineJoin='round';
  // DPI 缩放
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  // 防止触摸滚动/缩放干扰绘制
  canvas.style.touchAction = 'none';

  // pointer events
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', resize);

  // 初始化历史
  saveDrawingState();
  blankCanvasData = drawingHistory[0] || null;

  // rAF 渲染队列
  let needsRender = false;
  function requestRender() {
    if (!needsRender) {
      needsRender = true;
      requestAnimationFrame(()=>{
        needsRender = false;
        drawBuffered();
      });
    }
  }

  function drawBuffered(){
    if(!points.length) return;
    ctx.save();
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = penColor;
    // 绘制连续点序列，使用 quadratic 平滑
    ctx.beginPath();
    for(let i=0;i<points.length-1;i++){
      const p0 = points[i];
      const p1 = points[i+1];
      const midX = (p0.x + p1.x)/2;
      const midY = (p0.y + p1.y)/2;
      ctx.lineWidth = (p1.pressure || 0.5) * (penSize || 2);
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      ctx.stroke();
    }
    ctx.restore();
    // keep last point as starting point for next batch
    if(points.length>1) points = [points[points.length-1]];
  }

  // 事件处理函数使用闭包 rAF
  function onPointerDown(e){
    // 只处理主按钮/手写笔/触摸
    if(e.button && e.button !== 0) return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
    points.push(p);
    // 新 stroke
    strokes.push({ tool: currentTool, color: penColor, size: penSize, points: [p] });
  }
  function onPointerMove(e){
    if(!isDrawing) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure || 0.5 };
    points.push(p);
    // append to current stroke
    if(strokes.length) strokes[strokes.length-1].points.push(p);
    requestRender();
  }
  function onPointerUp(e){
    if(!isDrawing) return;
    isDrawing = false;
    try{ canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); }catch(err){}
    // finalize: save stroke as an image snapshot for undo
    saveDrawingState();
    // 保持一个空的点以避免闪断
    points = [];
  }

  // 保存当前画布快照（dataURL）用于撤销
  function saveDrawingState(){ try{ drawingHistory.push(canvas.toDataURL('image/png')); if(drawingHistory.length>60) drawingHistory.shift(); }catch(e){console.warn('save failed',e);} }

  // 将函数暴露到外部作用域（替换原来定义的同名函数）
  window.saveDrawingState = saveDrawingState;
  window.clearCanvas = function(){ if(!ctx) return; ctx.clearRect(0,0,canvas.width,canvas.height); drawingHistory=[]; strokes=[]; saveDrawingState(); };
  window.undoCanvas = function(){ if(drawingHistory.length>1){ drawingHistory.pop(); const img=new Image(); img.src=drawingHistory[drawingHistory.length-1]; img.onload=function(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); } } };
}

function setTool(tool){ currentTool=tool; document.getElementById('penBtn')?.classList.toggle('active', tool==='pen'); document.getElementById('eraserBtn')?.classList.toggle('active', tool==='eraser'); }
function setColor(c){ penColor=c; }
function setSize(s){ penSize=Number(s); }
function toggleCanvasFullscreen(){ const canvasWrap=document.querySelector('.handwrite-area'); if(canvasWrap) canvasWrap.requestFullscreen?.(); }

// 将手写作为图片 - 不直接插入到信纸 DOM，而是保存为 pendingPlacedData
function useHandwritingAsContent(){ if(!canvas) return alert('无手写内容'); try{ pendingPlacedData = canvas.toDataURL('image/png'); alert('手写已准备，发送信件后可在信纸上查看。'); }catch(e){ alert('导出手写失败'); } }
function handleUploadPaper(e){ const f=e.target.files && e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=function(ev){ pendingPlacedData = ev.target.result; alert('上传图片已准备，发送后可查看。'); } ; r.readAsDataURL(f); }

// 发送信件
function submitLetter(){ const sender=document.getElementById('senderName')?.value.trim()||''; const recipient=document.getElementById('recipientName')?.value.trim()||''; const access=document.getElementById('writeAccessCode')?.value.trim()||''; const textContent=document.getElementById('letterContent')?.value||''; const textFont=document.getElementById('textFont')?.value||'Roboto, sans-serif'; const textSize=document.getElementById('textSize')?.value||16; const paperStyle=document.getElementById('paperStyle')?.value||'default';
  if(!access) return alert('请设置取信码');
  const letter = { id:Date.now(), senderName:sender, recipientName:recipient, content:textContent, textFont:textFont, textSize:textSize, handwrittenContent: pendingPlacedData || null, accessCode:access, createdDate:new Date().toLocaleString(), paperStyle:paperStyle };
  letters.push(letter);
  saveLetters();
  alert(`信件已发送！\n\n收信人可以使用取信码 "${access}" 来查看您的信件`);
  clearLetterForm();
  closeModal('writeModal');
  // reset pendingPlacedData after sending
  pendingPlacedData = null;
}

function clearLetterForm(){ document.getElementById('senderName').value=''; document.getElementById('recipientName').value=''; document.getElementById('letterContent').value=''; document.getElementById('penColor').value='#333333'; document.getElementById('penSize').value=2; try{ clearCanvas(); }catch(e){} pendingPlacedData=null; }

// 取信 -> 显示封好的信（默认保留封面，不自动展开）
function accessLetter(){ const code=document.getElementById('accessInput')?.value.trim()||''; if(!code){ alert('请输入取信码'); return; } const letter = letters.find(l=>l.accessCode && l.accessCode === code); if(!letter){ alert('未找到对应信件'); return; } displayLetter(letter); closeModal('accessModal'); showModal('letterModal'); }

function displayLetter(letter){ document.getElementById('displayHeader').textContent='远方来信'; document.getElementById('displaySender').textContent=letter.senderName; document.getElementById('displayRecipient').textContent=letter.recipientName; document.getElementById('displayDate').textContent=letter.createdDate || '';
  const paper = document.getElementById('paperContent'); paper.classList.remove('style-lined','style-grid','style-kraft'); if(letter.paperStyle === 'lined') paper.classList.add('style-lined'); else if(letter.paperStyle==='grid') paper.classList.add('style-grid'); else if(letter.paperStyle==='kraft') paper.classList.add('style-kraft');
  // 清空旧内容
  const displayContent = document.getElementById('displayContent'); displayContent.innerHTML='';
  if(letter.content){ const textEl = document.createElement('div'); textEl.textContent = letter.content; textEl.style.fontFamily = letter.textFont || 'Roboto, sans-serif'; textEl.style.fontSize = (letter.textSize || 16) + 'px'; displayContent.appendChild(textEl); }
  // 不在此刻插入 handwrittenContent，以避免覆盖封面或阻塞交互
  pendingPlacedData = letter.handwrittenContent || null;
  // 移除曾经残留的 placed image
  removePlaced(true);
  // 确保 envelope 处于 closed 状态
  const env = document.getElementById('envelopeView'); env?.classList.remove('opened');
  const slider = document.getElementById('openSlider'); if(slider) slider.style.display='none';
}

// 点击封面打开信纸（在打开时再插入手写图片并启用拖拽）
function openEnvelope(){ const env = document.getElementById('envelopeView'); if(!env) return; // 如果已经打开则不重复处理
  if(env.classList.contains('opened')) return;
  env.classList.add('opened');
  // 如果有 pendingPlacedData，则插入到 paperInner
  if(pendingPlacedData){ const paperInner = document.getElementById('paperInner'); const img = document.createElement('img'); img.src = pendingPlacedData; img.className = 'placed-handwriting'; img.style.width = document.getElementById('placedSize')?.value + '%'; img.setAttribute('draggable','false'); // we implement pointer drag
    paperInner.appendChild(img); placedImageEl = img; makeElementDraggable(img); showPlaceControls(); // 一旦插入，清空 pending
    pendingPlacedData = null;
  }
}

// placed controls
function showPlaceControls(){ const pc=document.getElementById('placeControls'); if(pc) pc.style.display='flex'; }
function removePlaced(hideControls){ if(placedImageEl && placedImageEl.parentNode) placedImageEl.parentNode.removeChild(placedImageEl); placedImageEl=null; if(hideControls){ const pc=document.getElementById('placeControls'); if(pc) pc.style.display='none'; } }
function resizePlaced(v){ if(placedImageEl) placedImageEl.style.width = v + '%'; }

function makeElementDraggable(el){ if(!el) return; let dragging=false; let startX=0,startY=0,origX=0,origY=0; el.style.touchAction='none'; el.addEventListener('pointerdown', function(e){ e.preventDefault(); dragging=true; const rect=el.getBoundingClientRect(); startX=e.clientX; startY=e.clientY; origX=rect.left; origY=rect.top; el.setPointerCapture && el.setPointerCapture(e.pointerId); });
  document.addEventListener('pointermove', function(e){ if(!dragging || !placedImageEl) return; e.preventDefault(); const dx = e.clientX - startX; const dy = e.clientY - startY; // position relative to paperInner
    const parent = placedImageEl.parentElement; const parentRect = parent.getBoundingClientRect(); placedImageEl.style.position='absolute'; placedImageEl.style.left = Math.min(Math.max((origX - parentRect.left + dx), 0), parentRect.width - placedImageEl.offsetWidth) + 'px'; placedImageEl.style.top = Math.min(Math.max((origY - parentRect.top + dy), 0), parentRect.height - placedImageEl.offsetHeight) + 'px'; });
  document.addEventListener('pointerup', function(e){ if(dragging){ dragging=false; try{ el.releasePointerCapture && el.releasePointerCapture(e.pointerId); }catch(err){} } }); }

// 简化的滑动解封备用（保留但默认隐藏）
let unlocking=false; function startUnlock(e){ e.preventDefault(); unlocking=true; } function onMoveUnlock(e){} function endUnlock(e){ unlocking=false; }

// 调试 UI
function createDebugUI(){ if(document.getElementById('__dbg_toggle')) return; const btn=document.createElement('button'); btn.id='__dbg_toggle'; btn.textContent='调试'; btn.onclick=toggleDebugPanel; document.body.appendChild(btn); const panel=document.createElement('div'); panel.id='__dbg_panel'; panel.style.display='none'; panel.innerHTML = ` <div id="__dbg_info"></div><div id="__dbg_list"></div>`; document.body.appendChild(panel); renderDebugPanel(); }
function toggleDebugPanel(){ const panel=document.getElementById('__dbg_panel'); if(!panel) return; panel.style.display=panel.style.display==='none'?'block':'none'; }
function renderDebugPanel(){ const info=document.getElementById('__dbg_info'); const list=document.getElementById('__dbg_list'); if(!info||!list) return; info.textContent=`本地信件数量：${letters.length}`; list.innerHTML = letters.map(l=>`<div style="padding:6px;border-bottom:1px solid #eee">${l.accessCode||'(空)'} — ${l.senderName||'(匿名)'} — ${l.createdDate||''}</div>`).join(''); }
function openRecentDebugInfo(){ const count=letters.length; const last=count? (letters[count-1].accessCode||'(空)') : '(无)'; alert(`本地信件数量：${count}\n最近一条取信码：${last}`); }
