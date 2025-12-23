const preview = document.getElementById('preview');
const htmlInput = document.getElementById('htmlInput');
const renderBtn = document.getElementById('renderBtn');
const clearBtn = document.getElementById('clearBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const editToggle = document.getElementById('editToggle');
const densitySelect = document.getElementById('densitySelect');
const fontScale = document.getElementById('fontScale');
const findColor = document.getElementById('findColor');
const replaceColor = document.getElementById('replaceColor');
const replaceColorBtn = document.getElementById('replaceColorBtn');
const exportImagesBtn = document.getElementById('exportImagesBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const geminiUrlInput = document.getElementById('geminiUrl');
const saveGeminiBtn = document.getElementById('saveGeminiBtn');
const openGeminiBtn = document.getElementById('openGeminiBtn');

let promptText = '';

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

function applyDensity() {
  preview.dataset.density = densitySelect.value;
}

function applyFontScale() {
  preview.style.setProperty('--font-scale', fontScale.value);
}

function replaceColors() {
  const source = htmlInput.value;
  const from = findColor.value.trim();
  const to = replaceColor.value.trim();
  if (!from || !to) return;
  const safeFrom = from.replace(/[#]/g, '\\$&');
  const regex = new RegExp(safeFrom, 'gi');
  const updated = source.replace(regex, to);
  htmlInput.value = updated;
  renderSlides();
}

async function exportImages() {
  const zip = new window.JSZip();
  const slides = Array.from(preview.querySelectorAll('.slide-editor'));
  for (let i = 0; i < slides.length; i++) {
    const canvas = await html2canvas(slides[i], {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });
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
    const canvas = await html2canvas(slides[i], {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });
    const imgData = canvas.toDataURL('image/png');
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, 0, 1280, 720);
  }
  pdf.save('slides.pdf');
}

function saveGeminiUrl() {
  const value = geminiUrlInput.value.trim();
  localStorage.setItem(STORAGE_KEYS.geminiUrl, value);
}

function openGemini() {
  const url = geminiUrlInput.value.trim() || 'https://gemini.google.com/';
  window.open(url, '_blank', 'noopener');
}

function copyPrompt() {
  if (!promptText) return;
  navigator.clipboard.writeText(promptText).catch(() => {});
}

function loadSample() {
  const template = document.getElementById('sampleTemplate');
  htmlInput.value = template.innerHTML.trim();
  renderSlides();
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
loadSampleBtn.addEventListener('click', loadSample);
editToggle.addEventListener('change', applyEditMode);
densitySelect.addEventListener('change', applyDensity);
fontScale.addEventListener('input', applyFontScale);
replaceColorBtn.addEventListener('click', replaceColors);
exportImagesBtn.addEventListener('click', exportImages);
exportPdfBtn.addEventListener('click', exportPdf);
copyPromptBtn.addEventListener('click', copyPrompt);
saveGeminiBtn.addEventListener('click', saveGeminiUrl);
openGeminiBtn.addEventListener('click', openGemini);

loadPrompt();
restoreState();
applyDensity();
applyFontScale();
if (htmlInput.value.trim()) renderSlides();
