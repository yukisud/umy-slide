const preview = document.getElementById('preview');
const htmlInput = document.getElementById('htmlInput');
const renderBtn = document.getElementById('renderBtn');
const clearBtn = document.getElementById('clearBtn');
const editToggle = document.getElementById('editToggle');
const previewScale = document.getElementById('previewScale');
const selectionToolbar = document.getElementById('selectionToolbar');
const toolbarFontSize = document.getElementById('toolbarFontSize');
const toolbarFontColor = document.getElementById('toolbarFontColor');
const toolbarSwatches = document.getElementById('toolbarSwatches');
const exportImagesBtn = document.getElementById('exportImagesBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const geminiUrlInput = document.getElementById('geminiUrl');
const saveGeminiBtn = document.getElementById('saveGeminiBtn');
const openGeminiBtn = document.getElementById('openGeminiBtn');
const geminiModal = document.getElementById('geminiModal');
const modalCopyPromptBtn = document.getElementById('modalCopyPromptBtn');
const modalOpenGeminiBtn = document.getElementById('modalOpenGeminiBtn');
const modalGeminiUrl = document.getElementById('modalGeminiUrl');
const modalSaveGeminiBtn = document.getElementById('modalSaveGeminiBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const toast = document.getElementById('toast');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');
const errorPrompt = document.getElementById('errorPrompt');
const copyErrorPromptBtn = document.getElementById('copyErrorPromptBtn');
const closeErrorModalBtn = document.getElementById('closeErrorModalBtn');

let promptText = '';
let savedRange = null;

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
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('HTMLの構文解析に失敗しました。タグの閉じ忘れや不正な構造が含まれている可能性があります。');
  }
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

  let slides = [];
  try {
    slides = extractSlides(html);
  } catch (e) {
    showErrorModal(e.message, html);
    return;
  }
  if (slides.length === 0) {
    showErrorModal('スライド要素が見つかりませんでした。class=\"slide\" が含まれているか確認してください。', html);
    return;
  }
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
  if (!editable) {
    selectionToolbar.classList.remove('show');
  }
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
  const pdf = new jsPDF({ unit: 'px', format: [1280, 720], orientation: 'landscape' });
  const slides = Array.from(preview.querySelectorAll('.slide-editor'));
  for (let i = 0; i < slides.length; i++) {
    const canvas = await renderSlideCanvas(slides[i]);
    const imgData = canvas.toDataURL('image/png');
    if (i > 0) pdf.addPage([1280, 720], 'landscape');
    pdf.addImage(imgData, 'PNG', 0, 0, 1280, 720);
  }
  pdf.save('slides.pdf');
}

async function renderSlideCanvas(slide) {
  // フォントのロード完了を確実に待つ
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // 書き出し用の一時コンテナを作成
  const exportContainer = document.createElement('div');
  exportContainer.style.position = 'fixed';
  exportContainer.style.left = '-9999px';
  exportContainer.style.top = '0';
  exportContainer.style.width = '1280px';
  exportContainer.style.height = '720px';
  exportContainer.style.overflow = 'hidden';
  exportContainer.style.background = '#ffffff';
  document.body.appendChild(exportContainer);

  // スライドをクローンしてコンテナに追加（transformなしの等倍）
  const clonedSlide = slide.cloneNode(true);
  clonedSlide.style.transform = 'none';
  clonedSlide.style.width = '1280px';
  clonedSlide.style.height = '720px';
  exportContainer.appendChild(clonedSlide);

  // 書き出し（scale=2で高解像度化）
  const canvas = await html2canvas(exportContainer, {
    width: 1280,
    height: 720,
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    scrollX: 0,
    scrollY: 0,
    windowWidth: 1280,
    windowHeight: 720
  });

  // 一時コンテナを削除
  document.body.removeChild(exportContainer);

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

function showErrorModal(message, html) {
  errorMessage.textContent = message;
  errorPrompt.value = buildErrorPrompt(message, html);
  errorModal.classList.add('show');
  errorModal.setAttribute('aria-hidden', 'false');
}

function closeErrorModal() {
  errorModal.classList.remove('show');
  errorModal.setAttribute('aria-hidden', 'true');
}

function buildErrorPrompt(message, html) {
  return `以下のHTMLでエラーが発生しました。\\n\\n【エラー内容】\\n${message}\\n\\n【修正方針】\\n- class=\"slide\" を持つスライド要素が必ず含まれるようにする\\n- タグの閉じ忘れや入れ子の不整合を修正\\n- 余分なscriptタグは削除\\n\\n【対象HTML】\\n${html}`;
}

function applySelectionStyle(style) {
  const range = restoreSelectionRange();
  if (!range) return;

  // 選択範囲が空の場合は親要素に適用
  if (range.collapsed) {
    const element = range.startContainer.parentElement;
    if (element && element.closest('.slide-editor')) {
      Object.assign(element.style, style);
    }
    saveSelectionRange();
    return;
  }

  // 選択範囲がある場合は、spanで囲むか親要素に適用
  try {
    // シンプルな選択範囲の場合
    const span = document.createElement('span');
    Object.assign(span.style, style);
    range.surroundContents(span);

    // 選択範囲を維持
    const selection = window.getSelection();
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);
    saveSelectionRange();
  } catch (e) {
    // 複雑な選択範囲の場合は親要素に適用
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    if (element && element.closest('.slide-editor')) {
      Object.assign(element.style, style);
    }
    saveSelectionRange();
  }
}

function refreshSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    selectionToolbar.classList.remove('show');
    return;
  }
  const range = selection.getRangeAt(0);
  const node = range.startContainer.parentElement;
  if (!node || !node.closest('.slide-editor')) {
    selectionToolbar.classList.remove('show');
    return;
  }
  const styles = window.getComputedStyle(node);
  toolbarFontSize.value = Math.round(parseFloat(styles.fontSize) || 16);
  toolbarFontColor.value = rgbToHex(styles.color || '#111111');
  saveSelectionRange();
  positionToolbar(range);
  if (editToggle.checked) {
    selectionToolbar.classList.add('show');
  }
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
    swatch.className = 'toolbar-swatch';
    swatch.style.background = color;
    swatch.addEventListener('click', () => {
      applySelectionStyle({ color });
      toolbarFontColor.value = color;
    });
    toolbarSwatches.appendChild(swatch);
  });
}

function saveSelectionRange() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  savedRange = selection.getRangeAt(0).cloneRange();
}

function restoreSelectionRange() {
  const selection = window.getSelection();
  if (!savedRange) {
    if (selection && selection.rangeCount > 0) return selection.getRangeAt(0);
    return null;
  }
  selection.removeAllRanges();
  selection.addRange(savedRange);
  return savedRange;
}

function positionToolbar(range) {
  if (!range) return;
  const rect = range.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;
  const top = Math.max(8, rect.top - previewRect.top + preview.scrollTop - 52);
  const left = Math.min(previewRect.width - 240, Math.max(8, rect.left - previewRect.left + preview.scrollLeft));
  selectionToolbar.style.top = `${top}px`;
  selectionToolbar.style.left = `${left}px`;
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
toolbarFontSize.addEventListener('input', () => {
  applySelectionStyle({ fontSize: `${toolbarFontSize.value}px` });
});
toolbarFontColor.addEventListener('input', () => {
  applySelectionStyle({ color: toolbarFontColor.value });
});
exportImagesBtn.addEventListener('click', exportImages);
exportPdfBtn.addEventListener('click', exportPdf);
copyPromptBtn.addEventListener('click', copyPrompt);
saveGeminiBtn.addEventListener('click', saveGeminiUrl);
openGeminiBtn.addEventListener('click', openGemini);
modalCopyPromptBtn.addEventListener('click', copyPrompt);
modalOpenGeminiBtn.addEventListener('click', () => {
  const url = modalGeminiUrl.value.trim();
  if (!url) {
    showToast('Gemini URLを入力してください');
    return;
  }
  window.open(url, '_blank', 'noopener');
});
modalSaveGeminiBtn.addEventListener('click', () => {
  geminiUrlInput.value = modalGeminiUrl.value.trim();
  saveGeminiUrl();
  closeGeminiModal();
  openGemini();
});
modalCloseBtn.addEventListener('click', closeGeminiModal);
copyErrorPromptBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(errorPrompt.value).then(() => {
    showToast('コピーしました');
  }).catch(() => {});
});
closeErrorModalBtn.addEventListener('click', closeErrorModal);
document.addEventListener('selectionchange', refreshSelection);
preview.addEventListener('mousedown', () => {
  if (!editToggle.checked) {
    selectionToolbar.classList.remove('show');
  }
});
document.addEventListener('click', (event) => {
  if (!preview.contains(event.target) && !selectionToolbar.contains(event.target)) {
    selectionToolbar.classList.remove('show');
  }
});

loadPrompt();
restoreState();
applyPreviewScale();
renderColorScale();
if (htmlInput.value.trim()) renderSlides();
