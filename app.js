const preview = document.getElementById('preview');
const htmlInput = document.getElementById('htmlInput');
const renderBtn = document.getElementById('renderBtn');
const clearBtn = document.getElementById('clearBtn');
const editToggle = document.getElementById('editToggle');
const previewScale = document.getElementById('previewScale');
const fontSizeInput = document.getElementById('fontSizeInput');
const fontColorInput = document.getElementById('fontColorInput');
const applyFontSizeBtn = document.getElementById('applyFontSizeBtn');
const applyFontColorBtn = document.getElementById('applyFontColorBtn');
const colorScale = document.getElementById('colorScale');
const exportImagesBtn = document.getElementById('exportImagesBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const geminiUrlInput = document.getElementById('geminiUrl');
const saveGeminiBtn = document.getElementById('saveGeminiBtn');
const openGeminiBtn = document.getElementById('openGeminiBtn');
const geminiModal = document.getElementById('geminiModal');
const modalCopyPromptBtn = document.getElementById('modalCopyPromptBtn');
const modalGeminiUrl = document.getElementById('modalGeminiUrl');
const modalSaveGeminiBtn = document.getElementById('modalSaveGeminiBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const toast = document.getElementById('toast');

let promptText = '';

const COLOR_SWATCHES = [
  '#111111', '#333333', '#6b7280', '#9ca3af', '#e5e7eb',
  '#002f5d', '#036ad1', '#1a237e', '#3949ab', '#5c6bc0',
  '#8e24aa', '#ab47bc', '#ba68c8', '#4285F4', '#EA4335',
  '#FBBC05', '#FF0000', '#000000'
];

const STORAGE_KEYS = {
  html: 'html-slide-tool:html',
  geminiUrl: 'html-slide-tool:geminiUrl'
};

function loadPrompt() {
  fetch('prompt_spec.txt')
    .then(res => res.text())
    .then(text => {
      promptText = text;
    })
    .catch(() => {
      promptText = '';
    });
}

function sanitizeHtml(doc) {
  doc.querySelectorAll('script').forEach(el => el.remove());
  return doc;
}

function extractSlides(html) {
  const parser = new DOMParser();
  const doc = sanitizeHtml(parser.parseFromString(html, 'text/html'));
  const slides = Array.from(doc.querySelectorAll('.slide'));
  if (slides.length > 0) return slides;
  const body = doc.body;
  if (!body) return [];
  const wrapper = doc.createElement('div');
  wrapper.innerHTML = body.innerHTML;
  return [wrapper];
}

function renderSlides() {
  const html = htmlInput.value.trim();
  preview.innerHTML = '';
  if (!html) return;

  const slides = extractSlides(html);
  slides.forEach((slide, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'slide-wrap';

    const slideNode = slide.cloneNode(true);
    slideNode.classList.add('slide-editor');
    slideNode.dataset.slideIndex = String(idx + 1);
    wrap.appendChild(slideNode);
    preview.appendChild(wrap);
  });

  applyEditMode();
}

function applyEditMode() {
  const editable = editToggle.checked;
  preview.querySelectorAll('.slide-editor').forEach(slide => {
    slide.contentEditable = editable ? 'true' : 'false';
  });
}

function applyPreviewScale() {
  preview.style.setProperty('--preview-scale', previewScale.value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

async function exportImages() {
  const zip = new window.JSZip();
  const slides = Array.from(preview.querySelectorAll('.slide-editor'));
  for (let i = 0; i < slides.length; i++) {
    const canvas = await renderSlideCanvas(slides[i]);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob);
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = 'slides.zip';
  link.click();
}

async function exportPdf() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'px', format: [1280, 720] });
  const slides = Array.from(preview.querySelectorAll('.slide-editor'));
  for (let i = 0; i < slides.length; i++) {
    const canvas = await renderSlideCanvas(slides[i]);
    const imgData = canvas.toDataURL('image/png');
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, 0, 1280, 720);
  }
  pdf.save('slides.pdf');
}

async function renderSlideCanvas(slide) {
  const temp = document.createElement('div');
  temp.style.position = 'fixed';
  temp.style.left = '-10000px';
  temp.style.top = '0';
  temp.style.width = '1280px';
  temp.style.background = '#ffffff';
  const clone = slide.cloneNode(true);
  clone.style.transform = 'none';
  clone.style.width = '1280px';
  clone.style.minHeight = '720px';
  clone.contentEditable = 'false';
  temp.appendChild(clone);
  document.body.appendChild(temp);
  const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });
  document.body.removeChild(temp);
  return canvas;
}

function saveGeminiUrl() {
  const value = geminiUrlInput.value.trim();
  localStorage.setItem(STORAGE_KEYS.geminiUrl, value);
}

function openGemini() {
  const savedUrl = localStorage.getItem(STORAGE_KEYS.geminiUrl) || '';
  const url = geminiUrlInput.value.trim() || savedUrl;
  if (!savedUrl) {
    showGeminiModal();
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function copyPrompt() {
  if (!promptText) return;
  navigator.clipboard.writeText(promptText).then(() => {
    showToast('コピーしました');
  }).catch(() => {});
}

function showGeminiModal() {
  modalGeminiUrl.value = geminiUrlInput.value.trim();
  geminiModal.classList.add('show');
  geminiModal.setAttribute('aria-hidden', 'false');
}

function closeGeminiModal() {
  geminiModal.classList.remove('show');
  geminiModal.setAttribute('aria-hidden', 'true');
}

function applySelectionStyle(style) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    const element = range.startContainer.parentElement;
    if (element && element.closest('.slide-editor')) {
      Object.assign(element.style, style);
    }
    return;
  }
  try {
    const span = document.createElement('span');
    Object.assign(span.style, style);
    range.surroundContents(span);
    selection.removeAllRanges();
  } catch (e) {
    const container = range.commonAncestorContainer.parentElement;
    if (container && container.closest('.slide-editor')) {
      Object.assign(container.style, style);
    }
  }
}

function refreshSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const node = range.startContainer.parentElement;
  if (!node || !node.closest('.slide-editor')) return;
  const styles = window.getComputedStyle(node);
  fontSizeInput.value = Math.round(parseFloat(styles.fontSize) || 16);
  fontColorInput.value = rgbToHex(styles.color || '#111111');
}

function rgbToHex(rgb) {
  const result = rgb.match(/\\d+/g);
  if (!result || result.length < 3) return '#111111';
  const [r, g, b] = result.map(v => parseInt(v, 10));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function renderColorScale() {
  COLOR_SWATCHES.forEach(color => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch';
    swatch.style.background = color;
    swatch.addEventListener('click', () => {
      fontColorInput.value = color;
      applySelectionStyle({ color });
    });
    colorScale.appendChild(swatch);
  });
}

function restoreState() {
  const saved = localStorage.getItem(STORAGE_KEYS.html);
  if (saved) htmlInput.value = saved;
  const url = localStorage.getItem(STORAGE_KEYS.geminiUrl);
  if (url) geminiUrlInput.value = url;
}

htmlInput.addEventListener('input', () => {
  localStorage.setItem(STORAGE_KEYS.html, htmlInput.value);
});
renderBtn.addEventListener('click', renderSlides);
clearBtn.addEventListener('click', () => {
  htmlInput.value = '';
  preview.innerHTML = '';
  localStorage.removeItem(STORAGE_KEYS.html);
});
editToggle.addEventListener('change', applyEditMode);
previewScale.addEventListener('input', applyPreviewScale);
applyFontSizeBtn.addEventListener('click', () => {
  applySelectionStyle({ fontSize: `${fontSizeInput.value}px` });
});
applyFontColorBtn.addEventListener('click', () => {
  applySelectionStyle({ color: fontColorInput.value });
});
exportImagesBtn.addEventListener('click', exportImages);
exportPdfBtn.addEventListener('click', exportPdf);
copyPromptBtn.addEventListener('click', copyPrompt);
saveGeminiBtn.addEventListener('click', saveGeminiUrl);
openGeminiBtn.addEventListener('click', openGemini);
modalCopyPromptBtn.addEventListener('click', copyPrompt);
modalSaveGeminiBtn.addEventListener('click', () => {
  geminiUrlInput.value = modalGeminiUrl.value.trim();
  saveGeminiUrl();
  closeGeminiModal();
  openGemini();
});
modalCloseBtn.addEventListener('click', closeGeminiModal);
document.addEventListener('selectionchange', refreshSelection);

loadPrompt();
restoreState();
applyPreviewScale();
renderColorScale();
if (htmlInput.value.trim()) renderSlides();
