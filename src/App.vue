<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  BookOpen, Bookmark, Check, ChevronLeft, ChevronRight, Clock3, Edit3,
  Eye, FolderOpen, ListTodo, Maximize2, Minimize2, Plus, Search, Settings2, Trash2, Upload, X
} from 'lucide-vue-next';

const STORAGE_KEY = 'yujian-vue-state-v1';
const READER_KEY = 'yujian-vue-reader-v1';
const HIDDEN_BOOKS_KEY = 'yujian-hidden-books-v1';
const LIBRARY_DB_NAME = 'yujian-reader-library';
const LIBRARY_DB_VERSION = 1;
const LIBRARY_STORE_NAME = 'imported-books';
const defaultTask = {
  id: 'task-welcome', title: '整理本周工作计划', status: 'doing', priority: 'normal', due: '',
  content: '## 今日重点\n\n- 梳理本周待办事项\n- 给项目留出完整的阅读时间\n\n> 记录想法、拆解步骤，慢慢完成。', updatedAt: Date.now()
};
const sampleBook = {
  id: 'sample-book', title: '雨夜书店', author: '林间迟', chapters: [
    { title: '第一章  雨停之前', paragraphs: ['雨从傍晚一直下到十点，街上的霓虹在积水里晃成一片温柔的碎片。沈知遥推开巷口那扇旧木门时，门铃响了两声，像有人在很远的地方应答。', '店里没有客人。暖黄的灯落在一排排书脊上，空气里有纸张、木头和一点刚煮好的红茶味。柜台后的老人抬起头，看了她一眼，便把手边那本书合上。', '“你来得比书早。”老人说。'] },
    { title: '第二章  没有寄件人的信', paragraphs: ['第二天清晨，雨终于停了。知遥醒来时，窗台上放着一只没有署名的牛皮纸信封，封口压着一枚深蓝色的蜡印。', '她犹豫了很久，还是拆开了它。信里只有短短几句话，提到一座海边的灯塔，提到一本缺失了最后一页的旧书。'] },
    { title: '尾声  书页之外', paragraphs: ['后来，雨夜书店依然开在那条小巷里。有人来买书，有人来借一段故事。每当门铃响起，她都会抬头微笑，像早就知道来人会在这一晚抵达。'] }
  ]
};

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (error) { return fallback; } }
function openLibraryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LIBRARY_DB_NAME, LIBRARY_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LIBRARY_STORE_NAME)) {
        request.result.createObjectStore(LIBRARY_STORE_NAME, { keyPath: 'name' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function runLibraryTransaction(mode, operation) {
  const database = await openLibraryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LIBRARY_STORE_NAME, mode);
    const request = operation(transaction.objectStore(LIBRARY_STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  });
}
function saveImportedFile(file) {
  return runLibraryTransaction('readwrite', (store) => store.put({
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    blob: file
  }));
}
function loadImportedFiles() { return runLibraryTransaction('readonly', (store) => store.getAll()); }
function removeImportedFile(name) { return runLibraryTransaction('readwrite', (store) => store.delete(name)); }
const savedState = readJson(STORAGE_KEY, {});
const tasks = ref(savedState.tasks?.length ? savedState.tasks : [defaultTask]);
const activeTaskId = ref(savedState.activeTaskId || tasks.value[0].id);
const view = ref(savedState.view || 'tasks');
const taskFilter = ref('all');
const taskSearch = ref('');
const detailMode = ref('edit');
const books = ref([sampleBook]);
const activeBookId = ref('sample-book');
const activeChapter = ref(0);
const readerLimit = ref(80);
const readerLibraryCollapsed = ref(false);
const isReaderFocusMode = ref(false);
const readerSearch = ref('');
const bookmark = ref(false);
const readerProgress = readJson(READER_KEY, {});
const hiddenBookTitles = new Set(readJson(HIDDEN_BOOKS_KEY, []));
const readerContentRef = ref(null);
const fileInput = ref(null);
const folderInput = ref(null);

const activeTask = computed(() => tasks.value.find((task) => task.id === activeTaskId.value) || tasks.value[0]);
const activeBook = computed(() => books.value.find((book) => book.id === activeBookId.value) || books.value[0]);
const activeChapterData = computed(() => activeBook.value?.chapters[activeChapter.value] || { title: '正文', paragraphs: [] });
const visibleTasks = computed(() => tasks.value.filter((task) => {
  const matchesFilter = taskFilter.value === 'all' || (taskFilter.value === 'active' ? task.status !== 'done' : task.status === 'done');
  const matchesSearch = !taskSearch.value.trim() || `${task.title} ${task.content}`.toLowerCase().includes(taskSearch.value.toLowerCase());
  return matchesFilter && matchesSearch;
}));
const markdownHtml = computed(() => DOMPurify.sanitize(marked.parse(activeTask.value?.content || '')));
const readerProgressPercent = computed(() => activeBook.value ? Math.round(((activeChapter.value + 1) / activeBook.value.chapters.length) * 100) : 0);
const visibleParagraphs = computed(() => activeChapterData.value.paragraphs.slice(0, readerLimit.value));
const hasMoreParagraphs = computed(() => visibleParagraphs.value.length < activeChapterData.value.paragraphs.length);

function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: tasks.value, activeTaskId: activeTaskId.value, view: view.value })); } catch (error) {} }
function readerKey(book) { return `${book.title}::${book.author || ''}`; }
function saveReaderProgress() { if (!activeBook.value) return; readerProgress[readerKey(activeBook.value)] = { chapter: activeChapter.value, scrollY: readerContentRef.value?.scrollTop || 0, bookmark: bookmark.value }; try { localStorage.setItem(READER_KEY, JSON.stringify(readerProgress)); } catch (error) {} }
function restoreReaderProgress() { const saved = readerProgress[readerKey(activeBook.value)]; if (!saved) return; activeChapter.value = Math.min(Number(saved.chapter) || 0, activeBook.value.chapters.length - 1); bookmark.value = Boolean(saved.bookmark); nextTick(() => readerContentRef.value?.scrollTo(0, Number(saved.scrollY) || 0)); }
watch([tasks, activeTaskId, view], persist, { deep: true });
watch(view, (nextView) => {
  if (nextView === 'reader') nextTick(restoreReaderProgress);
  if (nextView !== 'reader') isReaderFocusMode.value = false;
});
function updateTask(field, value) { if (activeTask.value) { activeTask.value[field] = value; activeTask.value.updatedAt = Date.now(); } }
function addTask() { const task = { id: `task-${Date.now()}`, title: '新的待办', status: 'todo', priority: 'normal', due: '', content: '', updatedAt: Date.now() }; tasks.value.unshift(task); activeTaskId.value = task.id; detailMode.value = 'edit'; }
function deleteTask() { if (!activeTask.value || !window.confirm('确定删除这个待办吗？')) return; const index = tasks.value.findIndex((task) => task.id === activeTaskId.value); tasks.value.splice(index, 1); activeTaskId.value = tasks.value[Math.max(0, index - 1)]?.id || ''; }
function toggleTask(task) { task.status = task.status === 'done' ? 'todo' : 'done'; task.updatedAt = Date.now(); }
function selectBook(bookId) { saveReaderProgress(); activeBookId.value = bookId; activeChapter.value = 0; readerLimit.value = 80; bookmark.value = false; restoreReaderProgress(); }
async function deleteBook(book) {
  if (books.value.length === 1) { window.alert('书架至少需要保留一本书。'); return; }
  if (!window.confirm(`从书架移除《${book.title}》？原始 TXT 文件不会被删除。`)) return;
  const index = books.value.findIndex((item) => item.id === book.id);
  if (book.source === 'imported' && book.storageKey) {
    try { await removeImportedFile(book.storageKey); } catch (error) { window.alert('无法从浏览器书架中删除这本书，请稍后重试。'); return; }
    hiddenBookTitles.delete(book.title);
  } else {
    hiddenBookTitles.add(book.title);
  }
  localStorage.setItem(HIDDEN_BOOKS_KEY, JSON.stringify([...hiddenBookTitles]));
  books.value.splice(index, 1);
  if (activeBookId.value === book.id) selectBook(books.value[Math.min(index, books.value.length - 1)].id);
}
function selectChapter(index) { saveReaderProgress(); activeChapter.value = index; readerLimit.value = 80; nextTick(() => readerContentRef.value?.scrollTo({ top: 0, left: 0, behavior: 'auto' })); }
function changeChapter(offset) { const next = activeChapter.value + offset; if (next >= 0 && next < activeBook.value.chapters.length) selectChapter(next); }
function toggleBookmark() { bookmark.value = !bookmark.value; saveReaderProgress(); }
function escapeText(value) { return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function parseTxt(text, fileName) {
  const lines = text.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const title = fileName.replace(/\.txt$/i, '') || '未命名小说';
  const chapterPattern = /^(第\s*[零〇一二三四五六七八九十百千万\d]+\s*[章节回篇].*|Chapter\s+\d+.*|番外.*|序章.*|尾声.*)$/i;
  const chapters = []; let current = null;
  lines.forEach((line) => { if (chapterPattern.test(line)) { if (current) chapters.push(current); current = { title: line, paragraphs: [] }; } else if (current) current.paragraphs.push(line); });
  if (current) chapters.push(current);
  if (!chapters.length) chapters.push({ title: '正文', paragraphs: lines.length ? lines : ['文件内容为空。'] });
  chapters.forEach((chapter) => { chapter.paragraphs = chapter.paragraphs.flatMap((paragraph) => paragraph.length <= 4000 ? [paragraph] : Array.from({ length: Math.ceil(paragraph.length / 4000) }, (_, index) => paragraph.slice(index * 4000, index * 4000 + 4000))); });
  const populatedChapters = chapters.filter((chapter) => chapter.paragraphs.length > 0);
  return { id: `book-${Date.now()}-${Math.random()}`, title, author: '导入文本', chapters: populatedChapters.length ? populatedChapters : chapters };
}
function decodeBuffer(buffer) { const bytes = new Uint8Array(buffer); if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer).replace(/^\uFEFF/, ''); if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer).replace(/^\uFEFF/, ''); try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, ''); } catch (error) { return new TextDecoder('gb18030').decode(buffer).replace(/^\uFEFF/, ''); } }
async function decodeFile(file) { return decodeBuffer(await file.arrayBuffer()); }
async function importFiles(fileList) {
  const files = [...fileList].filter((file) => file.name.toLowerCase().endsWith('.txt'));
  let saveFailed = false;
  for (const file of files) {
    const book = parseTxt(await decodeFile(file), file.name);
    book.source = 'imported';
    book.storageKey = file.name;
    try { await saveImportedFile(file); } catch (error) { saveFailed = true; }
    hiddenBookTitles.delete(book.title);
    books.value = books.value.filter((item) => item.title !== book.title);
    books.value.push(book);
  }
  localStorage.setItem(HIDDEN_BOOKS_KEY, JSON.stringify([...hiddenBookTitles]));
  if (files.length) {
    view.value = 'reader';
    activeBookId.value = books.value[books.value.length - 1].id;
    activeChapter.value = 0;
    readerLimit.value = 80;
    bookmark.value = false;
    restoreReaderProgress();
  }
  if (saveFailed) window.alert('部分小说已打开，但浏览器未能持久保存。请检查是否禁用了站点存储或处于隐私模式。');
}
async function loadBookIndex() {
  const loadedByTitle = new Map();
  try {
    const response = await fetch('books/index.json', { cache: 'no-store' });
    if (response.ok) {
      const names = await response.json();
      for (const name of names) {
        const result = await fetch(`books/${encodeURIComponent(name)}`, { cache: 'no-store' });
        if (result.ok) {
          const book = parseTxt(decodeBuffer(await result.arrayBuffer()), name);
          book.source = 'bundled';
          if (!hiddenBookTitles.has(book.title)) loadedByTitle.set(book.title, book);
        }
      }
    }
  } catch (error) {}
  try {
    const savedFiles = await loadImportedFiles();
    for (const savedFile of savedFiles) {
      const book = parseTxt(decodeBuffer(await savedFile.blob.arrayBuffer()), savedFile.name);
      book.source = 'imported';
      book.storageKey = savedFile.name;
      loadedByTitle.set(book.title, book);
    }
  } catch (error) {}
  const loaded = [...loadedByTitle.values()];
  if (loaded.length) {
    books.value = loaded;
    activeBookId.value = loaded[0].id;
    restoreReaderProgress();
  }
}
function onReaderScroll() { window.clearTimeout(onReaderScroll.timer); onReaderScroll.timer = window.setTimeout(saveReaderProgress, 250); }
function toggleReaderFocusMode() { isReaderFocusMode.value = !isReaderFocusMode.value; }
function onFocusModeKeydown(event) {
  if (event.key === 'Escape' && isReaderFocusMode.value) isReaderFocusMode.value = false;
}
onMounted(() => {
  loadBookIndex();
  window.addEventListener('beforeunload', saveReaderProgress);
  window.addEventListener('keydown', onFocusModeKeydown);
});
onUnmounted(() => {
  window.removeEventListener('beforeunload', saveReaderProgress);
  window.removeEventListener('keydown', onFocusModeKeydown);
});
</script>

<template>
  <div class="app-shell" :class="{ 'reader-focus-active': isReaderFocusMode && view === 'reader' }">
    <header class="topbar">
      <div class="brand-lockup"><div class="brand-mark">阅</div><div><strong>阅间</strong><span>DESK NOTES & READING</span></div></div>
      <nav class="main-nav" aria-label="主导航"><button :class="{ active: view === 'tasks' }" @click="view = 'tasks'"><ListTodo :size="15" />待办</button><button :class="{ active: view === 'reader' }" @click="view = 'reader'"><BookOpen :size="15" />阅读</button></nav>
      <div class="topbar-actions"><label class="outline-button"><Upload :size="14" />导入 TXT<input ref="fileInput" type="file" accept=".txt,text/plain" multiple hidden @change="importFiles($event.target.files)" /></label><label class="icon-button" title="导入小说目录"><FolderOpen :size="18" /><input ref="folderInput" type="file" accept=".txt,text/plain" webkitdirectory directory multiple hidden @change="importFiles($event.target.files)" /></label><button class="icon-button" title="设置"><Settings2 :size="18" /></button></div>
    </header>

    <main v-if="view === 'tasks'" class="task-workspace">
      <aside class="task-sidebar">
        <div class="section-heading"><div><p class="eyebrow">PERSONAL DESK</p><h1>待办</h1></div><span class="count-badge">{{ tasks.filter((task) => task.status !== 'done').length }}</span></div>
        <div class="search-field"><Search :size="15" /><input v-model="taskSearch" type="search" placeholder="搜索待办或记录" /></div>
        <div class="filter-tabs"><button :class="{ active: taskFilter === 'all' }" @click="taskFilter = 'all'">全部</button><button :class="{ active: taskFilter === 'active' }" @click="taskFilter = 'active'">进行中</button><button :class="{ active: taskFilter === 'done' }" @click="taskFilter = 'done'">已完成</button></div>
        <div class="task-list"><button v-for="task in visibleTasks" :key="task.id" class="task-item" :class="{ active: task.id === activeTaskId, done: task.status === 'done' }" @click="activeTaskId = task.id"><span class="task-check" :class="`priority-${task.priority}`" @click.stop="toggleTask(task)"><Check v-if="task.status === 'done'" :size="13" /></span><span class="task-item-copy"><strong>{{ task.title }}</strong><small>{{ task.due || '暂无截止时间' }}</small></span></button><div v-if="!visibleTasks.length" class="empty-state">还没有匹配的待办</div></div>
        <button class="add-task-button" @click="addTask"><Plus :size="15" />新增待办</button>
      </aside>
      <section v-if="activeTask" class="task-detail">
        <div class="detail-toolbar"><div><p class="eyebrow">TASK DETAIL</p><span class="updated-label"><Clock3 :size="13" />最近编辑于 {{ new Date(activeTask.updatedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span></div><div class="detail-actions"><button class="soft-button" @click="toggleTask(activeTask)"><Check :size="14" />{{ activeTask.status === 'done' ? '标记未完成' : '标记完成' }}</button><button class="icon-button danger" title="删除待办" @click="deleteTask"><Trash2 :size="17" /></button></div></div>
        <input class="task-title-input" :value="activeTask.title" @input="updateTask('title', $event.target.value)" />
        <div class="task-meta-row"><label>状态<select :value="activeTask.status" @change="updateTask('status', $event.target.value)"><option value="todo">未开始</option><option value="doing">进行中</option><option value="done">已完成</option></select></label><label>优先级<select :value="activeTask.priority" @change="updateTask('priority', $event.target.value)"><option value="low">低</option><option value="normal">普通</option><option value="high">重要</option></select></label><label>截止日期<input type="date" :value="activeTask.due" @input="updateTask('due', $event.target.value)" /></label></div>
        <div class="note-heading"><div><p class="eyebrow">WORK NOTES</p><h2>补充记录</h2></div><div class="mode-tabs"><button :class="{ active: detailMode === 'edit' }" @click="detailMode = 'edit'"><Edit3 :size="14" />编辑</button><button :class="{ active: detailMode === 'preview' }" @click="detailMode = 'preview'"><Eye :size="14" />预览</button></div></div>
        <textarea v-if="detailMode === 'edit'" class="markdown-editor" :value="activeTask.content" placeholder="写下补充信息，支持 Markdown..." @input="updateTask('content', $event.target.value)"></textarea><div v-else class="markdown-preview" v-html="markdownHtml"></div>
        <p class="markdown-hint">支持标题、列表、引用、粗体、链接等 Markdown 语法</p>
      </section>
      <section v-else class="blank-detail"><ListTodo :size="32" /><p>选择一个待办开始记录</p></section>
    </main>

    <main v-else class="reader-workspace" :class="{ 'library-collapsed': readerLibraryCollapsed }">
      <aside class="library-panel"><div class="section-heading"><div><p class="eyebrow">MY LIBRARY</p><h1>书架</h1></div><div class="library-heading-actions"><span class="count-badge">{{ books.length }}</span><button class="library-toggle" :title="readerLibraryCollapsed ? '展开书架' : '收起书架'" @click="readerLibraryCollapsed = !readerLibraryCollapsed"><ChevronRight v-if="readerLibraryCollapsed" :size="16" /><ChevronLeft v-else :size="16" /></button></div></div><div class="search-field"><Search :size="15" /><input type="search" placeholder="搜索书名" /></div><div class="book-list"><div v-for="book in books" :key="book.id" class="book-row" :class="{ active: book.id === activeBookId }"><button class="book-item" @click="selectBook(book.id)"><BookOpen :size="15" /><span><strong>{{ book.title }}</strong><small>{{ book.chapters.length }} 章 · {{ book.author }}</small></span></button><button class="book-delete" :title="`从书架移除《${book.title}》`" @click="deleteBook(book)"><Trash2 :size="14" /></button></div></div><p class="library-tip">把 TXT 放进 books/，或使用顶部导入按钮。</p></aside>
      <aside class="chapter-panel"><div class="section-heading"><div><p class="eyebrow">TABLE OF CONTENTS</p><h2>{{ activeBook.title }}</h2></div></div><p class="book-meta">{{ activeBook.author }} · {{ activeBook.chapters.length }} 章</p><div class="chapter-list"><button v-for="(chapter, index) in activeBook.chapters" :key="chapter.title + index" class="chapter-item" :class="{ active: index === activeChapter }" @click="selectChapter(index)">{{ chapter.title }}</button></div></aside>
      <section class="reader-panel"><div class="reader-toolbar"><div class="breadcrumb"><span>{{ activeBook.title }}</span><span>/</span><strong>{{ activeChapterData.title }}</strong></div><div class="reader-tools"><button class="toolbar-button" :class="{ selected: bookmark }" title="添加书签" @click="toggleBookmark"><Bookmark :size="15" />书签</button><button class="toolbar-button" :title="isReaderFocusMode ? '退出专注阅读' : '专注阅读（隐藏导航）'" @click="toggleReaderFocusMode"><Minimize2 v-if="isReaderFocusMode" :size="15" /><Maximize2 v-else :size="15" />{{ isReaderFocusMode ? '退出专注' : '专注阅读' }}</button><button class="toolbar-button primary" @click="view = 'tasks'">回到待办</button></div></div><article ref="readerContentRef" class="reader-content" @scroll="onReaderScroll"><h3><span class="chapter-kicker">CHAPTER {{ String(activeChapter + 1).padStart(2, '0') }}</span>{{ activeChapterData.title }}</h3><p v-for="(paragraph, index) in visibleParagraphs" :key="index">{{ paragraph }}</p><button v-if="hasMoreParagraphs" class="load-more" @click="readerLimit += 80">继续加载（已显示 {{ visibleParagraphs.length }} 段）</button></article><div class="reader-footer"><button class="nav-button" :disabled="activeChapter === 0" @click="changeChapter(-1)"><ChevronLeft :size="15" />上一章</button><div class="progress-wrap"><div class="progress-label"><span>阅读进度 {{ readerProgressPercent }}%</span><span>{{ activeChapterData.paragraphs.join('').length.toLocaleString() }} 字</span></div><div class="progress-track"><div class="progress-bar" :style="{ width: `${readerProgressPercent}%` }"></div></div></div><button class="nav-button" :disabled="activeChapter === activeBook.chapters.length - 1" @click="changeChapter(1)">下一章<ChevronRight :size="15" /></button></div></section>
    </main>
  </div>
</template>
