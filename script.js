/* ============================================
   Vanessa Pessanha Acessórios – Criar Catálogo
   script.js – versão melhorada
   ============================================ */

'use strict';

// ── Estado global ────────────────────────────
let items = []; // { file, dataUrl, nome, ref, preco }
let capaDataUrl = null;
let sortableInstance = null;

// ── Elementos ────────────────────────────────
const colecaoEl    = document.getElementById('colecao');
const capaInput    = document.getElementById('capa');
const capaPreview  = document.getElementById('capaPreview');
const photosInput  = document.getElementById('photos');
const itemsGrid    = document.getElementById('itemsContainer');
const photoCount   = document.getElementById('photoCount');
const sortHint     = document.getElementById('sortHint');
const loadingOver  = document.getElementById('loadingOverlay');
const loadingMsg   = document.getElementById('loadingMsg');

// ── Capa ─────────────────────────────────────
capaInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  capaDataUrl = await toDataUrl(file);
  capaPreview.innerHTML = `<img src="${capaDataUrl}" alt="Prévia da capa">`;
});

// ── Drag-and-drop zona da capa ───────────────
const capaZone = document.getElementById('capaZone');
capaZone.addEventListener('dragover',  (e) => { e.preventDefault(); capaZone.classList.add('drag-over'); });
capaZone.addEventListener('dragleave', ()  => capaZone.classList.remove('drag-over'));
capaZone.addEventListener('drop',      async (e) => {
  e.preventDefault();
  capaZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    capaDataUrl = await toDataUrl(file);
    capaPreview.innerHTML = `<img src="${capaDataUrl}" alt="Prévia da capa">`;
  }
});

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

    card.innerHTML = `
      <img class="card-img" src="${item.dataUrl}" alt="Peça ${idx + 1}">
      <div class="card-body">
        <div class="card-num">Peça #${idx + 1}</div>
        <input class="card-input" type="text" placeholder="Nome da peça"
               value="${escHtml(item.nome)}" data-field="nome" data-idx="${idx}">
        <input class="card-input" type="text" placeholder="Ref / Código"
               value="${escHtml(item.ref)}" data-field="ref" data-idx="${idx}">
        <input class="card-input" type="text" placeholder="Preço (R$)"
               value="${escHtml(item.preco)}" data-field="preco" data-idx="${idx}"
               inputmode="decimal">
        <button class="card-remove" data-idx="${idx}">✕ Remover</button>
      </div>
    `;

    // inputs: salvar no array
    card.querySelectorAll('.card-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        items[i][field] = e.target.value;
      });
    });

    // remover
    card.querySelector('.card-remove').addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.idx);
      items.splice(i, 1);
      renderItems();
    });

    itemsGrid.appendChild(card);
  });

  setupSortable();
  updateNumbers();
}

// ── Sortable (drag & drop) ───────────────────
function setupSortable() {
  destroySortable();
  sortableInstance = Sortable.create(itemsGrid, {
    animation: 180,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    delay: 150,         // delay para toques longos no mobile
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

// ── Gerar PDF ────────────────────────────────
async function gerarPDF() {
  const colecao = colecaoEl.value.trim();

  if (!colecao) {
    alert('Por favor, informe o nome da coleção.');
    colecaoEl.focus();
    return;
  }
  if (!capaDataUrl) {
    alert('Por favor, selecione a imagem de capa.');
    return;
  }
  if (items.length === 0) {
    alert('Por favor, adicione pelo menos uma foto.');
    return;
  }

  showLoading('Preparando PDF…');

  try {
    const { jsPDF } = window.jspdf;

    // A4 vertical: 210 x 297 mm
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PW = 210, PH = 297;

    // ── Página de capa ──────────────────────
    setLoadingMsg('Adicionando capa…');
    await addImgFull(doc, capaDataUrl, 0, 0, PW, PH);

    // Faixa inferior com nome da coleção
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

    // ── Páginas de produtos ─────────────────
    // Grid: 2 colunas × 3 linhas = 6 itens por página
    const COLS = 2, ROWS = 3;
    const ITEMS_PER_PAGE = COLS * ROWS;
    const MARGIN = 12;
    const HEADER_H = 16; // cabeçalho simples
    const FOOTER_H = 10;
    const usableW = PW - MARGIN * 2;
    const usableH = PH - MARGIN * 2 - HEADER_H - FOOTER_H;
    const cellW = usableW / COLS;
    const cellH = usableH / ROWS;
    const IMG_RATIO = 0.72; // imagem ocupa 72% da altura da célula

    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

    for (let pg = 0; pg < totalPages; pg++) {
      setLoadingMsg(`Montando página ${pg + 1} de ${totalPages}…`);
      doc.addPage();

      // Fundo
      doc.setFillColor(247, 241, 232);
      doc.rect(0, 0, PW, PH, 'F');

      // Cabeçalho
      doc.setFillColor(26, 20, 16);
      doc.rect(0, 0, PW, HEADER_H, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(200, 151, 58);
      doc.text(colecao.toUpperCase(), PW / 2, HEADER_H - 4, { align: 'center' });

      // Células
      const pageItems = items.slice(pg * ITEMS_PER_PAGE, (pg + 1) * ITEMS_PER_PAGE);

      for (let ci = 0; ci < pageItems.length; ci++) {
        const item = pageItems[ci];
        const col  = ci % COLS;
        const row  = Math.floor(ci / COLS);
        const x    = MARGIN + col * cellW;
        const y    = MARGIN + HEADER_H + row * cellH;
        const imgH = cellH * IMG_RATIO;
        const PAD  = 4;

        // Fundo do card
        doc.setFillColor(255, 255, 255);
        roundedRect(doc, x + PAD, y + PAD, cellW - PAD * 2, cellH - PAD * 2, 3);

        // Imagem centralizada
        await addImgContain(doc, item.dataUrl,
          x + PAD + 2, y + PAD + 2,
          cellW - PAD * 2 - 4, imgH - 4);

        // Texto
        const textY = y + PAD + imgH + 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(26, 20, 16);

        const nome = item.nome || `Peça ${pg * ITEMS_PER_PAGE + ci + 1}`;
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

      // Rodapé
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(160, 140, 120);
      doc.text(
        `Vanessa Pessanha Acessórios  •  ${colecao}  •  Pág. ${pg + 2}`,
        PW / 2, PH - 4, { align: 'center' }
      );
    }

    // Salvar
    setLoadingMsg('Salvando arquivo…');
    const fileName = `catalogo-${slugify(colecao)}.pdf`;
    doc.save(fileName);

  } catch (err) {
    console.error(err);
    alert('Erro ao gerar PDF. Verifique o console para detalhes.');
  } finally {
    hideLoading();
  }
}

// Expor para onclick no HTML
window.gerarPDF = gerarPDF;

// ── Helpers ──────────────────────────────────

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showLoading(msg) {
  loadingMsg.textContent = msg || 'Aguarde…';
  loadingOver.style.display = 'flex';
}

function setLoadingMsg(msg) {
  loadingMsg.textContent = msg;
}

function hideLoading() {
  loadingOver.style.display = 'none';
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function roundedRect(doc, x, y, w, h, r) {
  doc.setDrawColor(224, 213, 197);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, r, r, 'FD');
}

// Adiciona imagem cobrindo toda a área (cover)
function addImgFull(doc, dataUrl, x, y, w, h) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const iRatio = img.width / img.height;
      const bRatio = w / h;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (iRatio > bRatio) { sw = img.height * bRatio; sx = (img.width - sw) / 2; }
      else                 { sh = img.width / bRatio;  sy = (img.height - sh) / 2; }
      const tmp = document.createElement('canvas');
      tmp.width  = Math.round(sw);
      tmp.height = Math.round(sh);
      tmp.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
      doc.addImage(tmp.toDataURL('image/jpeg', 0.9), 'JPEG', x, y, w, h, undefined, 'FAST');
      resolve();
    };
    img.src = dataUrl;
  });
}

// Adiciona imagem contida (fit) dentro do box
function addImgContain(doc, dataUrl, x, y, maxW, maxH) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const iR = img.width / img.height;
      const bR = maxW / maxH;
      let dw, dh;
      if (iR > bR) { dw = maxW; dh = maxW / iR; }
      else         { dh = maxH; dw = maxH * iR;  }
      const dx = x + (maxW - dw) / 2;
      const dy = y + (maxH - dh) / 2;
      doc.addImage(dataUrl, 'JPEG', dx, dy, dw, dh, undefined, 'FAST');
      resolve();
    };
    img.src = dataUrl;
  });
}
