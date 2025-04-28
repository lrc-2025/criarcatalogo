// script.js
document.addEventListener('DOMContentLoaded', () => {
  const { jsPDF } = window.jspdf;
  const form = document.getElementById('catalogForm');
  const photosInput = document.getElementById('photos');
  const itemsContainer = document.getElementById('itemsContainer');
  const photoCount = document.getElementById('photoCount');
  const generateBtn = document.querySelector('.btn');

  let photoFiles = [];

  Sortable.create(itemsContainer, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: updateCounters
  });

  photosInput.addEventListener('change', () => {
    photoFiles = Array.from(photosInput.files);
    itemsContainer.innerHTML = '';
    photoFiles.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = e => {
        const div = document.createElement('div');
        div.className = 'item-form';
        div.dataset.idx = i;
        div.innerHTML = `
          <button type="button" class="remove-btn">&times;</button>
          <span class="photo-index">${i+1}</span>
          <img src="${e.target.result}">
          <input type="text" placeholder="Nome da peça" class="name" required>
          <input type="text" placeholder="Preço (ex: 59,90)" class="price" required>
        `;
        itemsContainer.appendChild(div);
        updateCounters();
      };
      reader.readAsDataURL(file);
    });
  });

  function updateCounters() {
    const total = itemsContainer.children.length;
    photoCount.innerText = `Total de peças: ${total}`;
    Array.from(itemsContainer.children).forEach((div, idx) => {
      const span = div.querySelector('.photo-index');
      if (span) span.innerText = `${idx+1}/${total}`;
    });
    attachRemoveEvents();
  }

  function attachRemoveEvents() {
    const removeButtons = document.querySelectorAll('.remove-btn');
    removeButtons.forEach(btn => {
      btn.onclick = () => {
        if (confirm('Tem certeza que deseja remover esta peça?')) {
          btn.parentElement.remove();
          updateCounters();
        }
      };
    });
  }

  const readDataURL = file => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const loadFadedLogo = async src => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return new Promise((res, rej) => {
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext('2d');
        ctx.globalAlpha = 0.20; // Agora 20% mais visível
        ctx.drawImage(img, 0, 0);
        res(cv.toDataURL('image/png'));
      };
      img.onerror = rej;
      img.src = src;
    });
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const colecao = document.getElementById('colecao').value.trim();
      const capaFile = document.getElementById('capa').files[0];
      if (!colecao || !capaFile || itemsContainer.children.length === 0) {
        return alert('Preencha todos os campos e selecione as fotos.');
      }

      generateBtn.disabled = true;
      generateBtn.innerText = 'Gerando...';

      const coverData = await readDataURL(capaFile);
      let logoData = null;
      try {
        logoData = await loadFadedLogo('logo.png');
      } catch {
        console.warn('Logo não carregada.');
      }

      const items = Array.from(itemsContainer.children).map(div => {
        const idx = parseInt(div.dataset.idx, 10);
        const file = photoFiles[idx];
        const name = div.querySelector('.name').value.trim();
        const price = div.querySelector('.price').value.trim();
        return { file, name, price };
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const W = 210, H = 297;

      pdf.addImage(coverData, 'JPEG', 0, 0, W, H);

      const pieceSize = 90;
      const innerSize = 86;
      const margin = 15;
      const footerMargin = 30;

      for (let i = 0; i < items.length; i += 2) {
        pdf.addPage();
        pdf.setFillColor(217,208,205).rect(0, 0, W, H, 'F');
        if (logoData) {
          pdf.addImage(logoData, 'PNG', (W-150)/2, (H-150)/2, 150, 150);
        }

        const coords = [
          { x: margin, y: margin },
          { x: W - margin - pieceSize, y: H - footerMargin - pieceSize }
        ];

        for (let j = 0; j < 2; j++) {
          const it = items[i+j];
          if (!it) break;
          const imgData = await readDataURL(it.file);
          const { x, y } = coords[j];
          pdf.setFillColor(255).roundedRect(x, y, pieceSize, pieceSize, 3, 3, 'F');
          pdf.addImage(imgData, 'JPEG', x+2, y+2, innerSize, innerSize);
          pdf.setFont('helvetica', 'bold').setFontSize(14).setTextColor('#5b3e31')
             .text(it.name, x + pieceSize/2, y + pieceSize + 5, { align: 'center' });
          pdf.setFont('helvetica', 'normal').setFontSize(12).setTextColor('#7a5b48')
             .text('R$ ' + it.price, x + pieceSize/2, y + pieceSize + 12, { align: 'center' });
        }

        pdf.setFontSize(10).setTextColor('#8c7362')
           .text(`Vanesa Pessanha Acessórios | ${colecao}`, W/2, H-10, { align: 'center' });
      }

      pdf.save(`Catálogo-${colecao}.pdf`);
    }
    catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar PDF. Veja o console.');
    }
    finally {
      generateBtn.disabled = false;
      generateBtn.innerText = 'Gerar PDF';
    }
  });
});
