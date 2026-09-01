// 信件数据存储
let letters = [];

// 画布/画笔相关（平滑绘制）
let canvas, ctx;
let isDrawing = false;
let points = []; // for smoothing
let drawingHistory = [];
let blankCanvasData = null;
let currentTool = 'pen';
let penColor = '#333333';
let penSize = 2;

// 放置图片相关
let placedImageEl = null;
let placedImageData = null;

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
function showModal(modalId) { const modal = document.getElementById(modalId); if(!modal) return; modal.style.display='block'; if(modalId==='accessModal'){ setTimeout(()=>{ const accessEl = document.getElementById('accessInput'); if(accessEl){ accessEl.focus(); accessEl.onkeydown = e=>{ if(e.key==='Enter') accessLetter(); } } },80); } }
function closeModal(modalId){ const modal = document.getElementById(modalId); if(!modal) return; modal.style.display='none'; if(modalId==='accessModal'){ const accessEl = document.getElementById('accessInput'); if(accessEl) accessEl.onkeydown=null; } }
window.onclick = function(e){ if(e.target.classList.contains('modal')) e.target.style.display='none'; }

// 标签页切换
function switchTab(tabName, evt){ document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); const el=document.getElementById(tabName); if(el) el.classList.add('active'); if(evt&&evt.target) evt.target.classList.add('active'); if(tabName==='handwriteInput') setTimeout(resizeCanvas,100); }

// Canvas 初始化和平滑绘制（使用 quadraticCurveTo）
function initializeHandwriteCanvas(){ canvas = document.getElementById('handwriteCanvas'); if(!canvas) return; ctx = canvas.getContext('2d'); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle=penColor; ctx.lineWidth=penSize;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerout', onPointerUp);
    saveDrawingState(); blankCanvasData = drawingHistory[0] || null;
}

function onPointerDown(e){ if(e.pointerType==='touch' || e.pointerType==='pen') e.preventDefault(); isDrawing=true; points = []; const r=canvas.getBoundingClientRect(); points.push({x:e.clientX-r.left,y:e.clientY-r.top,pressure:e.pressure||0.5}); canvas.setPointerCapture(e.pointerId); }
function onPointerMove(e){ if(!isDrawing) return; e.preventDefault(); const r=canvas.getBoundingClientRect(); points.push({x:e.clientX-r.left,y:e.clientY-r.top,pressure:e.pressure||0.5}); drawSmooth(); }
function onPointerUp(e){ if(isDrawing){ isDrawing=false; try{ canvas.releasePointerCapture(e.pointerId);}catch(err){} saveDrawingState(); points=[]; } }

function drawSmooth(){ if(points.length<2) return; ctx.save(); ctx.globalCompositeOperation = currentTool==='eraser' ? 'destination-out' : 'source-over'; let p1 = points[0], p2 = points[1]; ctx.beginPath(); ctx.moveTo(p1.x,p1.y); for(let i=1;i<points.length;i++){ const midX = (p1.x + p2.x)/2; const midY = (p1.y + p2.y)/2; const pressure = p2.pressure || 0.5; const w = (currentTool==='eraser'? penSize*4 : penSize) * (0.6 + pressure); ctx.lineWidth = Math.max(1, w); ctx.strokeStyle = currentTool==='eraser' ? 'rgba(0,0,0,1)' : penColor; ctx.quadraticCurveTo(p1.x,p1.y,midX,midY); ctx.stroke(); p1 = p2; p2 = points[i+1] || points[i]; }
    ctx.restore(); }

function saveDrawingState(){ try{ drawingHistory.push(canvas.toDataURL('image/png')); if(drawingHistory.length>60) drawingHistory.shift(); }catch(e){console.warn('save failed',e);} }
function clearCanvas(){ if(!ctx) return; ctx.clearRect(0,0,canvas.width,canvas.height); drawingHistory=[]; saveDrawingState(); }
function undoCanvas(){ if(drawingHistory.length>1){ drawingHistory.pop(); const img=new Image(); img.src=drawingHistory[drawingHistory.length-1]; img.onload=function(){ ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); } } else clearCanvas(); }

function setTool(tool){ currentTool=tool; document.getElementById('penBtn')?.classList.toggle('active', tool==='pen'); document.getElementById('eraserBtn')?.classList.toggle('active', tool==='eraser'); }
function setColor(c){ penColor=c; }
function setSize(s){ penSize=Number(s); }
function toggleCanvasFullscreen(){ const canvasWrap=document.querySelector('.handwrite-area'); if(canvasWrap) canvasWrap.requestFullscreen?.(); }

// 将手写作为图片
function useHandwritingAsContent(){ if(!canvas) return alert('无手写内容'); placedImageData = canvas.toDataURL('image/png'); alert('手写已准备，发送信件后可在信纸上查看并拖动/调整'); }
function handleUploadPaper(e){ const f=e.target.files && e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=function(ev){ placedImageData = ev.target.result; alert('上传图片已准备，发送后可在信纸上查看并调整'); }; r.readAsDataURL(f); }

// 发送信件
function submitLetter(){ const sender=document.getElementById('senderName')?.value.trim()||''; const recipient=document.getElementById('recipientName')?.value.trim()||''; const access=document.getElementById('writeAccessCode')?.value.trim()||''; const font=document.getElementById('textFont')?.value||'Roboto, sans-serif'; const textSize=document.getElementById('textSize')?.value||16; const paperStyle=document.getElementById('paperStyle')?.value||'default'; if(!sender){alert('请输入寄信人名字');return;} if(!recipient){alert('请输入收信人名字');return;} if(!access){alert('请设置取信码');return;} if(letters.some(l=>l.accessCode && l.accessCode.toLowerCase()===access.toLowerCase())){alert('此取信码已被使用，请设置其他取信码');return;} const textTabActive = document.getElementById('textInput')?.classList.contains('active'); const textContent = textTabActive? (document.getElementById('letterContent')?.value.trim()||null) : null; if(textTabActive && !textContent && !placedImageData){ alert('请输入信件内容或手写/上传图片作为内容'); return; } if(!textTabActive && !placedImageData){ alert('请手写或上传图片作为信件内容'); return; }
    const letter = { id:Date.now(), senderName:sender, recipientName:recipient, content:textContent, handwrittenContent: placedImageData || null, accessCode:access, createdDate:new Date().toLocaleString('zh-CN'), createdTime:Date.now(), textFont:font, textSize: textSize, paperStyle: paperStyle };
    letters.push(letter); saveLetters(); alert(`信件已发送！\n\n收信人可以使用取信码 "${access}" 来查看您的信件`); clearLetterForm(); closeModal('writeModal'); placedImageData=null; }

function clearLetterForm(){ document.getElementById('senderName').value=''; document.getElementById('recipientName').value=''; document.getElementById('letterContent').value=''; document.getElementById('writeAccessCode').value=''; clearCanvas(); placedImageData=null; }

// 取信 -> 显示封好的信（用户点击封面打开）
function accessLetter(){ const code=document.getElementById('accessInput')?.value.trim()||''; if(!code){ alert('请输入取信码'); return; } const letter = letters.find(l=>l.accessCode && l.accessCode.toLowerCase()===code.toLowerCase()); if(!letter){ const count=letters.length; const lastCode = count? (letters[count-1].accessCode||'') : '(无)'; alert(`未找到对应的信件，请检查取信码是否正确。\n\n调试信息：本地信件数量 ${count}，最近一条取信码：${lastCode}`); console.log('accessLetter failed. letters:', letters); return; } // 展示信封但不自动开封
    displayLetter(letter); closeModal('accessModal'); showModal('letterModal'); // keep envelope closed
}

function displayLetter(letter){ document.getElementById('displayHeader').textContent='远方来信'; document.getElementById('displaySender').textContent=letter.senderName; document.getElementById('displayRecipient').textContent=letter.recipientName; document.getElementById('displayDate').textContent=letter.createdDate; const contentDiv=document.getElementById('displayContent'); contentDiv.innerHTML=''; removePlaced(); // set paper style
    const paper = document.getElementById('paperContent'); paper.classList.remove('style-lined','style-grid','style-kraft'); if(letter.paperStyle === 'lined') paper.classList.add('style-lined'); else if(letter.paperStyle==='grid') paper.classList.add('style-grid'); else if(letter.paperStyle==='kraft') paper.classList.add('style-kraft'); // insert text
    if(letter.content){ const textEl = document.createElement('div'); textEl.textContent = letter.content; textEl.style.fontFamily = letter.textFont || 'Roboto, sans-serif'; textEl.style.fontSize = (letter.textSize || 16) + 'px'; contentDiv.appendChild(textEl); }
    // insert handwritten or uploaded image as placed image
    if(letter.handwrittenContent){ const img = document.createElement('img'); img.src = letter.handwrittenContent; img.className = 'placed-handwriting'; img.style.width = '60%'; img.style.position='absolute'; img.style.left='50%'; img.style.top='140px'; img.style.transform='translate(-50%,0)'; img.onload = ()=>{ makeElementDraggable(img); showPlaceControls(); }; const paperInner = document.getElementById('paperInner'); paperInner.appendChild(img); placedImageEl = img; }
    // ensure envelope closed
    const env = document.getElementById('envelopeView'); env?.classList.remove('opened'); // show click hint
    const slider = document.getElementById('openSlider'); if(slider) slider.style.display='none'; // user clicks cover to open
}

// 点击封面打开信纸
function openEnvelope(){ const env = document.getElementById('envelopeView'); if(!env) return; env.classList.add('opened'); const slider = document.getElementById('openSlider'); if(slider) slider.style.display='none'; }

// placed controls
function showPlaceControls(){ const pc=document.getElementById('placeControls'); if(pc) pc.style.display='flex'; }
function removePlaced(){ if(placedImageEl && placedImageEl.parentNode) placedImageEl.parentNode.removeChild(placedImageEl); placedImageEl=null; const pc=document.getElementById('placeControls'); if(pc) pc.style.display='none'; }
function resizePlaced(v){ if(placedImageEl) placedImageEl.style.width = v + '%'; }

function makeElementDraggable(el){ let dragging=false; let startX=0, startY=0, origLeft=0, origTop=0; el.style.touchAction='none'; el.addEventListener('pointerdown', function(e){ dragging=true; startX=e.clientX; startY=e.clientY; const rect=el.getBoundingClientRect(); // compute center-based coords
    origLeft = rect.left; origTop = rect.top; el.setPointerCapture(e.pointerId); }); document.addEventListener('pointermove', function(e){ if(!dragging) return; const dx = e.clientX - startX; const dy = e.clientY - startY; el.style.left = (origLeft + dx + el.offsetWidth/2) + 'px'; el.style.top = (origTop + dy) + 'px'; el.style.transform = 'translate(-50%,0)'; }); document.addEventListener('pointerup', function(e){ if(dragging){ dragging=false; try{ el.releasePointerCapture(e.pointerId);}catch(e){} } }); }

// 简化的滑动解封备用（保留但默认隐藏）
let unlocking=false; function startUnlock(e){ e.preventDefault(); unlocking=true; }
function onMoveUnlock(e){}
function endUnlock(e){ unlocking=false; }

// 调试 UI
function createDebugUI(){ if(document.getElementById('__dbg_toggle')) return; const btn=document.createElement('button'); btn.id='__dbg_toggle'; btn.textContent='调试'; btn.onclick=toggleDebugPanel; document.body.appendChild(btn); const panel=document.createElement('div'); panel.id='__dbg_panel'; panel.style.display='none'; const title=document.createElement('div'); title.textContent='调试：localStorage letters'; title.style.fontWeight='bold'; title.style.marginBottom='8px'; panel.appendChild(title); const info=document.createElement('div'); info.id='__dbg_info'; info.style.fontSize='12px'; info.style.color='#444'; info.style.marginBottom='8px'; panel.appendChild(info); const list=document.createElement('pre'); list.id='__dbg_list'; list.style.whiteSpace='pre-wrap'; list.style.fontSize='12px'; list.style.margin=0; panel.appendChild(list); const actions=document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px'; actions.style.marginTop='8px'; const copyBtn=document.createElement('button'); copyBtn.textContent='复制取信码列表'; copyBtn.className='btn'; copyBtn.onclick=()=>{ const codes=letters.map(l=>l.accessCode||'').join('\n'); navigator.clipboard.writeText(codes).then(()=>alert('已复制取信码列表')); }; actions.appendChild(copyBtn); const clearBtn=document.createElement('button'); clearBtn.textContent='清空所有信（localStorage）'; clearBtn.className='btn btn-secondary'; clearBtn.onclick=()=>{ if(!confirm('确定要清空所有本地信件数据吗？此操作不可恢复。')) return; letters=[]; saveLetters(); renderDebugPanel(); alert('已清空本地信件'); }; actions.appendChild(clearBtn); panel.appendChild(actions); document.body.appendChild(panel); renderDebugPanel(); }
function toggleDebugPanel(){ const panel=document.getElementById('__dbg_panel'); if(!panel) return; panel.style.display=panel.style.display==='none'?'block':'none'; }
function renderDebugPanel(){ const info=document.getElementById('__dbg_info'); const list=document.getElementById('__dbg_list'); if(!info||!list) return; info.textContent=`本地信件数量：${letters.length} （最新一条取信码：${letters.length? (letters[letters.length-1].accessCode || '(空)') : '(无)'}）`; try{ list.textContent = JSON.stringify(letters.map(l=>({accessCode:l.accessCode,sender:l.senderName,recipient:l.recipientName,created:l.createdDate})),null,2); }catch(e){ list.textContent = String(letters); } }
function openRecentDebugInfo(){ const count=letters.length; const last=count? (letters[count-1].accessCode||'(空)') : '(无)'; alert(`本地信件数量：${count}\n最近一条取信码：${last}`); }
