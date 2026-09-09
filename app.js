const sampleBook = {
  id: 'rain-bookshop',
  title: '雨夜书店',
  author: '林间迟',
  chapters: [
    { title: '第一章  雨停之前', paragraphs: ['雨从傍晚一直下到十点，街上的霓虹在积水里晃成一片温柔的碎片。沈知遥推开巷口那扇旧木门时，门铃响了两声，像有人在很远的地方应答。', '店里没有客人。暖黄的灯落在一排排书脊上，空气里有纸张、木头和一点刚煮好的红茶味。柜台后的老人抬起头，看了她一眼，便把手边那本书合上。', '“你来得比书早。”老人说。', '知遥没有听懂。她只是把湿透的伞靠在门边，从口袋里取出那张已经泛黄的书签。书签上只有一个地址，和一行她从未见过却熟悉得过分的字。'] },
    { title: '第二章  没有寄件人的信', paragraphs: ['第二天清晨，雨终于停了。知遥醒来时，窗台上放着一只没有署名的牛皮纸信封，封口压着一枚深蓝色的蜡印。', '她犹豫了很久，还是拆开了它。信里只有短短几句话，提到一座海边的灯塔，提到一本缺失了最后一页的旧书，还提到她小时候曾经忘记的一场雪。', '书店的老人说，那不是一封信，而是一把钥匙。'] },
    { title: '第三章  海边的灯塔', paragraphs: ['列车向南驶去，窗外的城市慢慢变成低矮的屋檐和成片的芦苇。知遥把那本旧书放在膝上，指腹反复摩挲着封面角落的压痕。', '傍晚，她在海风里看见了灯塔。塔顶的光一圈一圈扫过灰蓝色的海面，仿佛在寻找一个迟到的人。'] },
    { title: '尾声  书页之外', paragraphs: ['后来，雨夜书店依然开在那条小巷里。老人离开后，知遥接过了柜台，也接过了那盏总在午夜亮起的灯。', '有人来买书，有人来借一段故事。每当门铃响起，她都会抬头微笑，像早就知道来人会在这一晚抵达。'] }
  ]
};

const STORAGE_KEY = 'yujian-reader-progress-v1';
const progressStore = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (error) { return {}; } })();
const state = { books: [sampleBook], activeBookId: sampleBook.id, activeChapter: 0, query: '', bookmark: false, renderLimit: 80, restoreProgress: true };
const $ = (id) => document.getElementById(id);
const getBook = () => state.books.find((book) => book.id === state.activeBookId) || state.books[0];
const escapeHtml = (value) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const progressKey = (book) => `${book.title}::${book.author || ''}`;
function saveProgress() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progressStore)); } catch (error) {} }
function rememberProgress() { const book = getBook(); progressStore[progressKey(book)] = { chapter: state.activeChapter, scrollY: window.scrollY, bookmark: state.bookmark }; saveProgress(); }
function restoreProgress() {
  const book = getBook(); const saved = progressStore[progressKey(book)];
  if (!saved) return;
  state.activeChapter = Math.min(Math.max(Number(saved.chapter) || 0, 0), Math.max(book.chapters.length - 1, 0));
  state.bookmark = Boolean(saved.bookmark);
  requestAnimationFrame(() => window.scrollTo(0, Number(saved.scrollY) || 0));
}

function renderBooks() {
  const query = state.query.trim().toLowerCase();
  const books = state.books.filter((book) => book.title.toLowerCase().includes(query));
  $('bookCount').textContent = state.books.length;
  $('bookList').innerHTML = books.map((book) => `<div class="book-item ${book.id === state.activeBookId ? 'active' : ''}" data-book-id="${book.id}"><div class="book-item-title">${escapeHtml(book.title)}</div><div class="book-item-meta">${book.author || '本地文本'} · ${book.chapters.length} 章</div></div>`).join('') || '<div class="book-item-meta">没有找到匹配书籍</div>';
  document.querySelectorAll('[data-book-id]').forEach((item) => item.addEventListener('click', () => { rememberProgress(); state.activeBookId = item.dataset.bookId; state.activeChapter = 0; state.renderLimit = 80; state.restoreProgress = true; renderAll(); }));
}

function renderChapters() {
  const book = getBook();
  $('currentBookTitle').textContent = book.title;
  $('breadcrumbBook').textContent = book.title;
  $('bookMeta').textContent = `${book.author || '本地文本'} · ${book.chapters.length} 章`;
  $('chapterList').innerHTML = book.chapters.map((chapter, index) => `<div class="chapter-item ${index === state.activeChapter ? 'active' : ''}" data-chapter-index="${index}">${escapeHtml(chapter.title)}</div>`).join('');
  document.querySelectorAll('[data-chapter-index]').forEach((item) => item.addEventListener('click', () => { state.activeChapter = Number(item.dataset.chapterIndex); state.renderLimit = 80; renderReader(); }));
}

function renderReader() {
  const book = getBook();
  const chapter = book.chapters[state.activeChapter];
  $('breadcrumbChapter').textContent = chapter.title;
  const visibleParagraphs = chapter.paragraphs.slice(0, state.renderLimit);
  const hasMore = visibleParagraphs.length < chapter.paragraphs.length;
  $('readerContent').innerHTML = `<h3><span class="chapter-kicker">CHAPTER ${String(state.activeChapter + 1).padStart(2, '0')}</span>${escapeHtml(chapter.title)}</h3>${visibleParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}${hasMore ? `<button id="loadMoreButton" class="load-more">继续加载（已显示 ${visibleParagraphs.length} 段）</button>` : ''}`;
  const loadMoreButton = $('loadMoreButton');
  if (loadMoreButton) loadMoreButton.addEventListener('click', () => { state.renderLimit += 80; renderReader(); });
  const progress = Math.round(((state.activeChapter + 1) / book.chapters.length) * 100);
  $('progressText').textContent = `阅读进度 ${progress}%`;
  $('progressBar').style.width = `${progress}%`;
  $('wordCount').textContent = `${chapter.paragraphs.join('').length.toLocaleString()} 字`;
  $('prevButton').disabled = state.activeChapter === 0; $('nextButton').disabled = state.activeChapter === book.chapters.length - 1;
  $('bookmarkButton').textContent = state.bookmark ? '★ 书签' : '☆ 书签';
  $('readerContent').scrollTop = 0;
}

function renderAll() { if (state.restoreProgress) { restoreProgress(); state.restoreProgress = false; } renderBooks(); renderChapters(); renderReader(); }
function showToast(message) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1800); }

function parseTxt(text, fileName) {
  const lines = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const title = fileName.replace(/\.txt$/i, '') || '未命名小说';
  const chapterPattern = /^(第\s*[零〇一二三四五六七八九十百千万\d]+\s*[章节回篇].*|Chapter\s+\d+.*|番外.*|序章.*|尾声.*)$/i;
  const chapters = []; let current = null;
  lines.forEach((line) => {
    if (chapterPattern.test(line)) {
      if (current) chapters.push(current);
      current = { title: line, paragraphs: [] };
    } else if (current) {
      current.paragraphs.push(line);
    }
  });
  if (current) chapters.push(current);
  if (!chapters.length) chapters.push({ title: '正文', paragraphs: lines.length ? lines : ['文件内容为空。'] });
  chapters.forEach((chapter) => {
    chapter.paragraphs = chapter.paragraphs.flatMap((paragraph) => {
      if (paragraph.length <= 4000) return [paragraph];
      const chunks = [];
      for (let index = 0; index < paragraph.length; index += 4000) chunks.push(paragraph.slice(index, index + 4000));
      return chunks;
    });
  });
  return { id: `file-${Date.now()}-${Math.random()}`, title, author: '导入文本', chapters };
}

async function decodeText(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(buffer).replace(/^\uFEFF/, '');
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(buffer).replace(/^\uFEFF/, '');
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return utf8Decoder.decode(buffer).replace(/^\uFEFF/, '');
  } catch (error) {
    return new TextDecoder('gb18030').decode(buffer).replace(/^\uFEFF/, '');
  }
}

async function importFiles(files) {
  const txtFiles = [...files].filter((file) => file.name.toLowerCase().endsWith('.txt'));
  for (const file of txtFiles) {
    const text = await decodeText(file);
    const importedBook = parseTxt(text, file.name);
    state.books = state.books.filter((book) => book.title !== importedBook.title);
    state.books.push(importedBook);
  }
  if (txtFiles.length) {
    state.activeBookId = state.books[state.books.length - 1].id;
    state.activeChapter = 0;
    state.renderLimit = 80;
    state.restoreProgress = true;
    renderAll();
    showToast(`已导入 ${txtFiles.length} 本小说`);
  }
}

$('fileInput').addEventListener('change', async (event) => { await importFiles(event.target.files); event.target.value = ''; });
$('folderInput').addEventListener('change', async (event) => { await importFiles(event.target.files); event.target.value = ''; });
$('librarySearch').addEventListener('input', (event) => { state.query = event.target.value; renderBooks(); });
$('prevButton').addEventListener('click', () => { if (state.activeChapter > 0) { rememberProgress(); state.activeChapter -= 1; state.renderLimit = 80; renderAll(); } });
$('nextButton').addEventListener('click', () => { if (state.activeChapter < getBook().chapters.length - 1) { rememberProgress(); state.activeChapter += 1; state.renderLimit = 80; renderAll(); } });
$('bookmarkButton').addEventListener('click', () => { state.bookmark = !state.bookmark; rememberProgress(); renderReader(); showToast(state.bookmark ? '已添加书签' : '已移除书签'); });
$('focusButton').addEventListener('click', () => { document.body.classList.toggle('focus-mode'); $('focusButton').textContent = document.body.classList.contains('focus-mode') ? '退出专注' : '专注阅读'; });
$('searchButton').addEventListener('click', () => { $('searchBar').hidden = !$('searchBar').hidden; if (!$('searchBar').hidden) $('contentSearch').focus(); });
$('contentSearch').addEventListener('input', (event) => { const term = event.target.value.trim(); const text = getBook().chapters.map((chapter) => chapter.paragraphs.join('')).join(''); $('searchResult').textContent = term ? `${(text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length} 个结果` : '0 个结果'; });
$('settingsButton').addEventListener('click', () => { $('settingsPanel').hidden = !$('settingsPanel').hidden; }); $('closeSettings').addEventListener('click', () => { $('settingsPanel').hidden = true; });
$('fontSizeControl').addEventListener('input', (event) => { $('readerContent').style.fontSize = `${event.target.value}px`; }); $('lineHeightControl').addEventListener('input', (event) => { $('readerContent').style.lineHeight = event.target.value; });
document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => { document.body.classList.remove('night', 'mist'); if (button.dataset.theme !== 'paper') document.body.classList.add(button.dataset.theme); document.querySelectorAll('[data-theme]').forEach((item) => item.classList.toggle('active', item === button)); }));
document.addEventListener('keydown', (event) => { if (event.key === 'ArrowRight') $('nextButton').click(); if (event.key === 'ArrowLeft') $('prevButton').click(); if (event.key === 'Escape') { document.body.classList.remove('focus-mode'); $('focusButton').textContent = '专注阅读'; } });
let scrollSaveTimer;
window.addEventListener('scroll', () => { clearTimeout(scrollSaveTimer); scrollSaveTimer = setTimeout(rememberProgress, 250); }, { passive: true });
window.addEventListener('beforeunload', rememberProgress);

async function loadBooksFolder() {
  try {
    const response = await fetch('books/index.json', { cache: 'no-store' });
    if (!response.ok) return;
    const files = await response.json();
    const loaded = await Promise.all(files.map(async (fileName) => {
      const fileResponse = await fetch(`books/${encodeURIComponent(fileName)}`, { cache: 'no-store' });
      if (!fileResponse.ok) return null;
      return parseTxt(await fileResponse.text(), fileName);
    }));
    const folderBooks = loaded.filter(Boolean);
    if (folderBooks.length) {
      state.books = folderBooks;
      state.activeBookId = folderBooks[0].id;
      state.restoreProgress = true;
      renderAll();
    }
  } catch (error) {
    // Opening index.html directly still works with the built-in sample book.
  }
}

renderAll();
loadBooksFolder();
