/* ============================================================
   Advanced To-Do App — Vanilla JS
   Data model for each task:
   {
     id: string,               // unique id
     text: string,             // task text
     completed: boolean,
     priority: 'high'|'medium'|'low',
     dueAt: number|null,       // timestamp (ms) or null
     order: number,            // manual order for drag & drop
     createdAt: number
   }
   ============================================================ */

(() => {
  // ---------- Elements ----------
  const els = {
    taskInput: document.getElementById('taskInput'),
    dueInput: document.getElementById('dueInput'),
    prioritySelect: document.getElementById('prioritySelect'),
    addBtn: document.getElementById('addBtn'),
    addRow: document.getElementById('addRow'),
    validationMsg: document.getElementById('validationMsg'),

    taskList: document.getElementById('taskList'),
    template: document.getElementById('taskTemplate'),

    filterButtons: document.querySelectorAll('.filters .chip'),
    sortSelect: document.getElementById('sortSelect'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),

    countTotal: document.getElementById('countTotal'),
    countActive: document.getElementById('countActive'),
    countCompleted: document.getElementById('countCompleted'),

    searchInput: document.getElementById('searchInput'),
    themeToggle: document.getElementById('themeToggle'),
    importInput: document.getElementById('importInput'),
    exportBtn: document.getElementById('exportBtn'),

    root: document.documentElement
  };

  // ---------- State ----------
  let tasks = loadTasks();
  let activeFilter = 'all';          // 'all' | 'active' | 'completed'
  let sortMode = 'default';          // 'default' | 'priority' | 'due' | 'alpha'
  let searchTerm = '';

  // ---------- Storage ----------
  function loadTasks() {
    try {
      const raw = localStorage.getItem('advanced_todos');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function saveTasks() {
    localStorage.setItem('advanced_todos', JSON.stringify(tasks));
  }

  // ---------- Utilities ----------
  const now = () => Date.now();
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  const priorityRank = p => (p === 'high' ? 0 : p === 'medium' ? 1 : 2);

  function formatDue(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    // Human-friendly: e.g., Mon, 12 Aug 10:30
    return d.toLocaleString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ---------- Rendering ----------
  function getFilteredSortedTasks() {
    let list = tasks.slice();

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(t => t.text.toLowerCase().includes(q));
    }

    // Filter by status
    if (activeFilter === 'active') list = list.filter(t => !t.completed);
    if (activeFilter === 'completed') list = list.filter(t => t.completed);

    // Sort: Completed always last (while keeping manual order among alike)
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      // Within same completed group, apply chosen sort
      if (sortMode === 'priority') {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        // tie-breaker: due date then order
        if ((a.dueAt || 0) !== (b.dueAt || 0)) return (a.dueAt || Infinity) - (b.dueAt || Infinity);
      } else if (sortMode === 'due') {
        if ((a.dueAt || 0) !== (b.dueAt || 0)) return (a.dueAt || Infinity) - (b.dueAt || Infinity);
      } else if (sortMode === 'alpha') {
        const at = a.text.toLowerCase(), bt = b.text.toLowerCase();
        if (at < bt) return -1;
        if (at > bt) return 1;
      }

      return a.order - b.order; // default/manual
    });

    return list;
  }

  function render() {
    // Counters
    els.countTotal.textContent = tasks.length.toString();
    els.countActive.textContent = tasks.filter(t => !t.completed).length.toString();
    els.countCompleted.textContent = tasks.filter(t => t.completed).length.toString();

    // List
    els.taskList.innerHTML = '';
    const list = getFilteredSortedTasks();

    for (const t of list) {
      const li = els.template.content.firstElementChild.cloneNode(true);
      li.dataset.id = t.id;
      if (t.completed) li.classList.add('completed');

      const checkbox = li.querySelector('.item__check');
      const textSpan = li.querySelector('.item__text');
      const dueSpan = li.querySelector('.item__due');
      const prioSpan = li.querySelector('.item__priority');
      const btnEdit = li.querySelector('.edit');
      const btnDelete = li.querySelector('.delete');

      checkbox.checked = t.completed;
      textSpan.textContent = t.text;

      // Due date
      dueSpan.textContent = t.dueAt ? `Due: ${formatDue(t.dueAt)}` : 'No due date';
      dueSpan.classList.toggle('overdue', !!t.dueAt && t.dueAt < now() && !t.completed);

      // Priority badge
      prioSpan.className = 'item__priority badge';
      prioSpan.textContent = `Priority: ${capitalize(t.priority)}`;
      prioSpan.classList.add(
        t.priority === 'high' ? 'priority-high' : t.priority === 'medium' ? 'priority-medium' : 'priority-low'
      );

      // Events
      checkbox.addEventListener('change', () => toggleComplete(t.id));
      btnDelete.addEventListener('click', () => deleteTask(t.id, li));
      btnEdit.addEventListener('click', () => beginEdit(t.id, textSpan, li));

      // Drag & drop
      li.addEventListener('dragstart', e => {
        li.classList.add('dragging');
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));

      els.taskList.appendChild(li);
    }
  }

  // ---------- CRUD ----------
  function addTask() {
    const text = els.taskInput.value.trim();
    const dueValue = els.dueInput.value;
    const priority = els.prioritySelect.value;

    if (!text) {
      showValidation('Task cannot be empty.');
      return shakeAddRow();
    }
    hideValidation();

    const dueAt = dueValue ? new Date(dueValue).getTime() : null;

    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order), 0);
    tasks.push({
      id: uid(),
      text,
      completed: false,
      priority,
      dueAt,
      order: maxOrder + 1,
      createdAt: now()
    });

    // Reset inputs
    els.taskInput.value = '';
    els.dueInput.value = '';
    els.prioritySelect.value = 'medium';

    saveTasks();
    render();
  }

  function toggleComplete(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.completed = !t.completed;
    saveTasks();
    render();   // render will place completed items at the bottom
  }

  function deleteTask(id, liEl) {
    // graceful remove animation
    if (liEl) { liEl.classList.add('removing'); setTimeout(() => performDelete(id), 150); }
    else performDelete(id);
  }
  function performDelete(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
  }

  function beginEdit(id, textSpan, li) {
    // Replace text with an input
    const t = tasks.find(x => x.id === id);
    if (!t) return;

    const input = document.createElement('input');
    input.className = 'edit-input';
    input.type = 'text';
    input.value = t.text;
    textSpan.replaceWith(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    const finish = () => {
      const newText = input.value.trim();
      if (newText) t.text = newText;
      saveTasks();
      render();
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { render(); } // cancel
    });
  }

  // ---------- Clear Completed ----------
  els.clearCompletedBtn.addEventListener('click', () => {
    if (!tasks.some(t => t.completed)) return;
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    render();
  });

  // ---------- Filters / Sort / Search ----------
  els.filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      els.filterButtons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
      btn.classList.add('active'); btn.setAttribute('aria-selected','true');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  els.sortSelect.addEventListener('change', () => {
    sortMode = els.sortSelect.value;
    render();
  });

  els.searchInput.addEventListener('input', () => {
    searchTerm = els.searchInput.value;
    render();
  });

  // ---------- Drag & Drop ordering (manual) ----------
  els.taskList.addEventListener('dragover', e => {
    e.preventDefault();
    const dragging = els.taskList.querySelector('.dragging');
    if (!dragging) return;

    const afterEl = getDragAfterElement(els.taskList, e.clientY);
    if (!afterEl) els.taskList.appendChild(dragging);
    else els.taskList.insertBefore(dragging, afterEl);
  });

  els.taskList.addEventListener('drop', () => {
    // Recompute order based on current DOM children
    const idsInDom = [...els.taskList.children].map(li => li.dataset.id);
    const map = new Map(tasks.map(t => [t.id, t]));
    idsInDom.forEach((id, idx) => { const t = map.get(id); if (t) t.order = idx + 1; });
    saveTasks();
    render();
  });

  function getDragAfterElement(container, y) {
    // Find the nearest element above the cursor
    const els = [...container.querySelectorAll('.item:not(.dragging)')];
    let closest = null;
    let closestOffset = Number.NEGATIVE_INFINITY;
    for (const child of els) {
      const box = child.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = child; }
    }
    return closest;
  }

  // ---------- Theme ----------
  const THEME_KEY = 'advanced_todos_theme';
  function loadTheme() {
    const t = localStorage.getItem(THEME_KEY) || 'light';
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  }
  els.themeToggle.addEventListener('click', toggleTheme);

  // ---------- Export / Import ----------
  els.exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url, download: `todos-${new Date().toISOString().slice(0,10)}.json`
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  els.importInput.addEventListener('change', () => {
    const file = els.importInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!Array.isArray(imported)) throw new Error('Invalid JSON');
        if (!confirm('Import will replace your current list. Continue?')) return;
        tasks = imported.map(normalizeTask); // defensive
        saveTasks();
        render();
      } catch (e) {
        alert('Import failed: invalid file.');
      } finally {
        els.importInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  function normalizeTask(t) {
    return {
      id: typeof t.id === 'string' ? t.id : uid(),
      text: String(t.text || '').trim(),
      completed: Boolean(t.completed),
      priority: ['high','medium','low'].includes(t.priority) ? t.priority : 'medium',
      dueAt: typeof t.dueAt === 'number' ? t.dueAt : (t.dueAt ? Date.parse(t.dueAt) : null) || null,
      order: Number.isFinite(t.order) ? t.order : 0,
      createdAt: Number.isFinite(t.createdAt) ? t.createdAt : now()
    };
  }

  // ---------- Validation helpers ----------
  function showValidation(msg) {
    els.validationMsg.textContent = msg;
  }
  function hideValidation() {
    els.validationMsg.textContent = '';
  }
  function shakeAddRow() {
    els.addRow.classList.remove('invalid');
    // force reflow to restart animation
    void els.addRow.offsetWidth;
    els.addRow.classList.add('invalid');
    els.taskInput.focus();
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- Event wiring ----------
  els.addBtn.addEventListener('click', addTask);
  els.taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

  // ---------- Initial load ----------
  loadTheme();
  render();

  // Keep overdue highlighting fresh each minute without reloading
  setInterval(() => { if (tasks.some(t => t.dueAt && !t.completed)) render(); }, 60_000);
})();