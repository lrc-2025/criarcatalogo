/* ============================================
   Vanessa Pessanha Acessórios – Criar Catálogo
   ============================================ */

'use strict';

// ── Configuração do repositório de destino ───
const DEST_REPO   = 'lrc-2025/CatalogosVanessaPessanhaAcessorios';
const DEST_BRANCH = 'main';
const DEST_PDF_DIR  = 'catalogos/';
const DEST_JSON     = 'catalogos.json';
const GH_API        = 'https://api.github.com';

// ── Estado global ────────────────────────────
let items = [];          // { file, dataUrl, nome, ref, preco }
let capaDataUrl = null;
let sortableInstance = null;

// ── Elementos ────────────────────────────────
const colecaoEl   = document.getElementById('colecao');
const capaInput   = document.getElementById('capa');
const capaPreview = document.getElementById('capaPreview');
const photosInput = document.getElementById('photos');
const itemsGrid   = document.getElementById('itemsContainer');
const photoCount  = document.getElementById('photoCount');
const sortHint    = document.getElementById('sortHint');
const loadingOver = document.getElementById('loadingOverlay');
const loadingMsg  = document.getElementById('loadingMsg');

// ── Capa ─────────────────────────────────────
capaInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  capaDataUrl = await toDataUrl(file);
  renderCapaPreview();
});

const capaZone = document.getElementById('capaZone');
capaZone.addEventListener('dragover',  (e) => { e.preventDefault(); capaZone.classList.add('drag-over'); });
capaZone.addEventListener('dragleave', ()  => capaZone.classList.remove('drag-over'));
capaZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  capaZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    capaDataUrl = await toDataUrl(file);
    renderCapaPreview();
  }
});

function renderCapaPreview() {
  capaPreview.innerHTML = '';
  const img = document.createElement('img');
  img.src = capaDataUrl;
  img.alt = 'Prévia da capa';
  capaPreview.appendChild(img);
}

// ── Fotos das peças ──────────────────────────
photosInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  showLoading('Carregando fotos…');
  for (const file of files) {
    const dataUrl = await toDataUrl(file);
    items.push({ file, dataUrl, nome: '', ref: '', preco: '' });
  }
  renderItems();
  hideLoading();
});

// ── Renderizar cards ─────────────────────────
function renderItems() {
  itemsGrid.innerHTML = '';
  if (items.length === 0) {
    photoCount.textContent = '';
    sortHint.style.display = 'none';
    destroySortable();
    return;
  }

  photoCount.textContent = `${items.length} foto${items.length > 1 ? 's' : ''} selecionada${items.length > 1 ? 's' : ''}`;
  sortHint.style.display = 'block';

  items.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.idx = idx;

    const img = document.createElement('img');
    img.className = 'card-img';
    img.src = item.dataUrl;
    img.alt = `Peça ${idx + 1}`;

    const body = document.createElement('div');
    body.className = 'card-body';

    const num = document.createElement('div');
    num.className = 'card-num';
    num.textContent = `Peça #${idx + 1}`;

    const fields = [
      { field: 'nome',  placeholder: 'Nome da peça' },
      { field: 'ref',   placeholder: 'Ref / Código' },
      { field: 'preco', placeholder: 'Preço (R$)',  extra: { inputMode: 'decimal' } }
    ];

    const inputs = fields.map(({ field, placeholder, extra }) => {
      const inp = document.createElement('input');
      inp.className    = 'card-input';
      inp.type         = 'text';
      inp.placeholder  = placeholder;
      inp.value        = item[field];
      inp.dataset.field = field;
      inp.dataset.idx  = idx;
      if (extra?.inputMode) inp.inputMode = extra.inputMode;
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx);
        items[i][e.target.dataset.field] = e.target.value;
      });
      return inp;
    });

    const btnRemove = document.createElement('button');
    btnRemove.className   = 'card-remove';
    btnRemove.dataset.idx = idx;
    btnRemove.textContent = '✕ Remover';
    btnRemove.addEventListener('click', (e) => {
      items.splice(parseInt(e.target.dataset.idx), 1);
      renderItems();
    });

    body.appendChild(num);
    inputs.forEach(inp => body.appendChild(inp));
    body.appendChild(btnRemove);
    card.appendChild(img);
    card.appendChild(body);
    itemsGrid.appendChild(card);
  });

  setupSortable();
  updateNumbers();
}

// ── Sortable ─────────────────────────────────
function setupSortable() {
  destroySortable();
  sortableInstance = Sortable.create(itemsGrid, {
    animation: 180,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    delay: 150,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    onEnd(evt) {
      const moved = items.splice(evt.oldIndex, 1)[0];
      items.splice(evt.newIndex, 0, moved);
      updateNumbers();
    }
  });
}

function destroySortable() {
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null; }
}

function updateNumbers() {
  document.querySelectorAll('.item-card').forEach((card, i) => {
    card.dataset.idx = i;
    card.querySelector('.card-num').textContent = `Peça #${i + 1}`;
    card.querySelectorAll('.card-input[data-field]').forEach(inp => { inp.dataset.idx = i; });
    const removeBtn = card.querySelector('.card-remove');
    if (removeBtn) removeBtn.dataset.idx = i;
  });
}

// ── Validar entradas ─────────────────────────
function validarEntradas() {
  const colecao = colecaoEl.value.trim();
  if (!colecao) {
    alert('Por favor, informe o nome da coleção.');
    colecaoEl.focus();
    return null;
  }
  if (!capaDataUrl) {
    alert('Por favor, selecione a imagem de capa.');
    return null;
  }
  if (items.length === 0) {
    alert('Por favor, adicione pelo menos uma foto.');
    return null;
  }
  return colecao;
}

// ── Montar o documento PDF ───────────────────
async function buildPDF(colecao) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297;

  // Capa
  setLoadingMsg('Adicionando capa…');
  await addImgFull(doc, capaDataUrl, 0, 0, PW, PH);
  doc.setFillColor(26, 20, 16);
  doc.setGState(doc.GState({ opacity: 0.82 }));
  doc.rect(0, PH - 38, PW, 38, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(200, 151, 58);
  doc.text(colecao, PW / 2, PH - 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(180, 165, 150);
  doc.text('Vanessa Pessanha Acessórios', PW / 2, PH - 10, { align: 'center' });

  // Páginas de produtos
  const COLS = 2, ROWS = 3, ITEMS_PER_PAGE = 6;
  const MARGIN = 12, HEADER_H = 16, FOOTER_H = 10;
  const usableW = PW - MARGIN * 2;
  const usableH = PH - MARGIN * 2 - HEADER_H - FOOTER_H;
  const cellW = usableW / COLS;
  const cellH = usableH / ROWS;
  const IMG_RATIO = 0.72;
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  for (let pg = 0; pg < totalPages; pg++) {
    setLoadingMsg(`Montando página ${pg + 1} de ${totalPages}…`);
    doc.addPage();

    doc.setFillColor(247, 241, 232);
    doc.rect(0, 0, PW, PH, 'F');

    doc.setFillColor(26, 20, 16);
    doc.rect(0, 0, PW, HEADER_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(200, 151, 58);
    doc.text(colecao.toUpperCase(), PW / 2, HEADER_H - 4, { align: 'center' });

    const pageItems = items.slice(pg * ITEMS_PER_PAGE, (pg + 1) * ITEMS_PER_PAGE);
    for (let ci = 0; ci < pageItems.length; ci++) {
      const item = pageItems[ci];
      const col = ci % COLS;
      const row = Math.floor(ci / COLS);
      const x   = MARGIN + col * cellW;
      const y   = MARGIN + HEADER_H + row * cellH;
      const imgH = cellH * IMG_RATIO;
      const PAD  = 4;

      doc.setFillColor(255, 255, 255);
      roundedRect(doc, x + PAD, y + PAD, cellW - PAD * 2, cellH - PAD * 2, 3);

      await addImgContain(doc, item.dataUrl, x + PAD + 2, y + PAD + 2, cellW - PAD * 2 - 4, imgH - 4);

      const textY = y + PAD + imgH + 2;
      const nome = item.nome || `Peça ${pg * ITEMS_PER_PAGE + ci + 1}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(26, 20, 16);
      doc.text(truncate(nome, 30), x + cellW / 2, textY + 4, { align: 'center' });

      if (item.ref) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 100, 80);
        doc.text(`Ref: ${item.ref}`, x + cellW / 2, textY + 9, { align: 'center' });
      }
      if (item.preco) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(200, 151, 58);
        doc.text(`R$ ${item.preco}`, x + cellW / 2, textY + 14, { align: 'center' });
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 140, 120);
    doc.text(
      `Vanessa Pessanha Acessórios  •  ${colecao}  •  Pág. ${pg + 2}`,
      PW / 2, PH - 4, { align: 'center' }
    );
  }

  const fileName = `catalogo-${slugify(colecao)}.pdf`;
  return { doc, fileName };
}

// ── Só baixar PDF ────────────────────────────
async function gerarPDF() {
  const colecao = validarEntradas();
  if (!colecao) return;

  showLoading('Preparando PDF…');
  try {
    const { doc, fileName } = await buildPDF(colecao);
    setLoadingMsg('Salvando arquivo…');
    doc.save(fileName);
  } catch (err) {
    console.error(err);
    alert('Erro ao gerar PDF. Verifique o console para detalhes.');
  } finally {
    hideLoading();
  }
}
window.gerarPDF = gerarPDF;

// ── Publicar no site ─────────────────────────
async function publicarNoSite() {
  const colecao = validarEntradas();
  if (!colecao) return;

  const pat = getStoredToken();
  if (!pat) {
    showTokenForm('Configure o token para publicar no site.');
    return;
  }

  showLoading('Preparando PDF…');
  try {
    const { doc, fileName } = await buildPDF(colecao);

    // Baixar localmente também (backup)
    setLoadingMsg('Salvando cópia local…');
    doc.save(fileName);

    // Fazer upload para o GitHub
    setLoadingMsg('Enviando para o site…');
    const bytes = doc.output('arraybuffer');
    await uploadToSite(pat, colecao, fileName, bytes);

    setLoadingMsg('Publicado com sucesso! ✓');
    await delay(1400);

  } catch (err) {
    console.error(err);
    if (err.message === 'TOKEN_INVALIDO') {
      clearStoredToken();
      updateTokenBadge();
      alert('Token inválido ou sem permissão. Reconfigure o token e tente novamente.');
    } else {
      alert('Erro ao publicar: ' + err.message);
    }
  } finally {
    hideLoading();
  }
}

// ── GitHub API ───────────────────────────────
async function ghGet(path, pat) {
  const r = await fetch(`${GH_API}/repos/${DEST_REPO}/contents/${encodeURI(path)}`, {
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json'
    }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub API erro ${r.status} em GET ${path}`);
  return r.json();
}

async function ghPut(path, content64, sha, message, pat) {
  const body = { message, content: content64, branch: DEST_BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH_API}/repos/${DEST_REPO}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`Falha ao salvar ${path}: ${r.status} ${msg}`);
  }
}

async function uploadToSite(pat, title, fileName, pdfBuffer) {
  // Verificar permissão
  const repoInfo = await fetch(`${GH_API}/repos/${DEST_REPO}`, {
    headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github+json' }
  });
  if (repoInfo.status === 401 || repoInfo.status === 403) throw new Error('TOKEN_INVALIDO');
  if (!repoInfo.ok) throw new Error(`Erro ao acessar repositório: ${repoInfo.status}`);

  const repoData = await repoInfo.json();
  if (!repoData.permissions?.push && !repoData.permissions?.admin) {
    throw new Error('TOKEN_INVALIDO');
  }

  // Upload do PDF
  setLoadingMsg('Enviando PDF…');
  const pdfBase64 = arrayBufferToBase64(pdfBuffer);
  const existingPdf = await ghGet(DEST_PDF_DIR + fileName, pat);
  await ghPut(
    DEST_PDF_DIR + fileName,
    pdfBase64,
    existingPdf?.sha || null,
    `Publicar catálogo: ${title}`,
    pat
  );

  // Atualizar catalogos.json
  setLoadingMsg('Atualizando lista de catálogos…');
  const jsonFile = await ghGet(DEST_JSON, pat);
  let lista = [];
  if (jsonFile) {
    try {
      lista = JSON.parse(atob(jsonFile.content.replace(/\n/g, '')));
      if (!Array.isArray(lista)) lista = [];
    } catch { lista = []; }
  }

  // Remover duplicata e adicionar no início
  lista = lista.filter(c => c.file !== fileName);
  lista.unshift({ file: fileName, title });

  const jsonContent = btoa(unescape(encodeURIComponent(JSON.stringify(lista, null, 2))));
  await ghPut(
    DEST_JSON,
    jsonContent,
    jsonFile?.sha || null,
    `Adicionar "${title}" à lista`,
    pat
  );
}

// ── Token management ─────────────────────────
const TOKEN_KEY = 'vpa_publish_token';

function getStoredToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function clearStoredToken() { localStorage.removeItem(TOKEN_KEY); }

function updateTokenBadge() {
  const pat     = getStoredToken();
  const badge   = document.getElementById('tokenBadge');
  const icon    = document.getElementById('tokenBadgeIcon');
  const text    = document.getElementById('tokenBadgeText');
  const btnCfg  = document.getElementById('btnConfigToken');
  if (pat) {
    badge.className       = 'token-badge token-on';
    icon.textContent      = '🟢';
    text.textContent      = 'Conectado ao site';
    btnCfg.textContent    = 'Alterar';
  } else {
    badge.className       = 'token-badge token-off';
    icon.textContent      = '🔴';
    text.textContent      = 'Token não configurado';
    btnCfg.textContent    = 'Configurar';
  }
}

function showTokenForm(msg) {
  const form = document.getElementById('tokenForm');
  form.style.display = 'block';
  if (msg) {
    const el = document.getElementById('tokenFormMsg');
    el.textContent = msg;
    el.style.display = 'block';
  }
  document.getElementById('tokenInput').focus();
}

document.getElementById('btnConfigToken').addEventListener('click', () => {
  const form = document.getElementById('tokenForm');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') document.getElementById('tokenInput').focus();
});

document.getElementById('btnSaveToken').addEventListener('click', async () => {
  const input = document.getElementById('tokenInput');
  const pat   = input.value.trim();
  const msgEl = document.getElementById('tokenFormMsg');

  if (!pat) {
    msgEl.textContent = 'Informe o token.';
    msgEl.className   = 'token-form-msg error';
    msgEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btnSaveToken');
  btn.disabled    = true;
  btn.textContent = 'Verificando…';
  msgEl.style.display = 'none';

  try {
    const r = await fetch(`${GH_API}/repos/${DEST_REPO}`, {
      headers: { 'Authorization': `Bearer ${pat}`, 'Accept': 'application/vnd.github+json' }
    });
    if (!r.ok) throw new Error('Token inválido ou sem acesso ao repositório.');
    const data = await r.json();
    if (!data.permissions?.push && !data.permissions?.admin) {
      throw new Error('Token sem permissão de escrita. Use escopo "public_repo".');
    }
    localStorage.setItem(TOKEN_KEY, pat);
    input.value = '';
    document.getElementById('tokenForm').style.display = 'none';
    document.getElementById('tokenFormMsg').style.display = 'none';
    updateTokenBadge();
  } catch (err) {
    msgEl.textContent   = err.message;
    msgEl.className     = 'token-form-msg error';
    msgEl.style.display = 'block';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Salvar';
  }
});

document.getElementById('tokenInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnSaveToken').click();
});

// ── Botões de ação ───────────────────────────
document.getElementById('btnPublicar').addEventListener('click', publicarNoSite);
document.getElementById('btnBaixar').addEventListener('click', gerarPDF);

// ── Init ─────────────────────────────────────
updateTokenBadge();

// ── Helpers ──────────────────────────────────
function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showLoading(msg) {
  loadingMsg.textContent = msg || 'Aguarde…';
  loadingOver.style.display = 'flex';
}
function setLoadingMsg(msg) { loadingMsg.textContent = msg; }
function hideLoading() { loadingOver.style.display = 'none'; }

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function slugify(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function roundedRect(doc, x, y, w, h, r) {
  doc.setDrawColor(224, 213, 197);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, r, r, 'FD');
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function addImgFull(doc, dataUrl, x, y, w, h) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const iR = img.width / img.height, bR = w / h;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (iR > bR) { sw = img.height * bR; sx = (img.width - sw) / 2; }
      else         { sh = img.width / bR;  sy = (img.height - sh) / 2; }
      const tmp = document.createElement('canvas');
      tmp.width = Math.round(sw); tmp.height = Math.round(sh);
      tmp.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
      doc.addImage(tmp.toDataURL('image/jpeg', 0.9), 'JPEG', x, y, w, h, undefined, 'FAST');
      resolve();
    };
    img.src = dataUrl;
  });
}

function addImgContain(doc, dataUrl, x, y, maxW, maxH) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const iR = img.width / img.height, bR = maxW / maxH;
      let dw, dh;
      if (iR > bR) { dw = maxW; dh = maxW / iR; }
      else         { dh = maxH; dw = maxH * iR;  }
      const dx = x + (maxW - dw) / 2, dy = y + (maxH - dh) / 2;
      doc.addImage(dataUrl, 'JPEG', dx, dy, dw, dh, undefined, 'FAST');
      resolve();
    };
    img.src = dataUrl;
  });
}
