(() => {
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');

  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const usernameSelect = document.getElementById('username-select');

  const monthLabel = document.getElementById('month-label');
  const weekdayRow = document.querySelector('.weekday-row');
  const calendarGrid = document.getElementById('calendar-grid');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  const todayBtn = document.getElementById('today-btn');
  const newEventBtn = document.getElementById('new-event-btn');
  const currentUserEl = document.getElementById('current-user');
  const logoutBtn = document.getElementById('logout-btn');

  const saturdaysView = document.getElementById('saturdays-view');
  const saturdaysList = document.getElementById('saturdays-list');

  const profileView = document.getElementById('profile-view');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileName = document.getElementById('profile-name');
  const profileLogoutBtn = document.getElementById('profile-logout-btn');

  const eventModal = document.getElementById('event-modal');
  const eventForm = document.getElementById('event-form');
  const modalTitle = document.getElementById('modal-title');
  const eventError = document.getElementById('event-error');
  const deleteEventBtn = document.getElementById('delete-event-btn');
  const cancelEventBtn = document.getElementById('cancel-event-btn');
  const colorSelect = document.getElementById('color-select');
  const colorPreview = document.getElementById('color-preview');

  const dayModal = document.getElementById('day-modal');
  const dayModalTitle = document.getElementById('day-modal-title');
  const dayEventsList = document.getElementById('day-events-list');
  const dayAddBtn = document.getElementById('day-add-btn');
  const dayCloseBtn = document.getElementById('day-close-btn');

  const bottomNavItems = document.querySelectorAll('.bottom-nav-item');

  const mobileQuery = window.matchMedia('(max-width: 640px)');

  const MONTH_NAMES = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
  ];

  const EVENT_CATEGORIES = [
    { color: '#ffe066', label: 'Event' },
    { color: '#c0eb75', label: 'Wagenbau' },
    { color: '#66d9e8', label: 'sport' },
    { color: '#91a7ff', label: 'Sitzung' },
    { color: '#e599f7', label: 'Ausflug' },
    { color: '#ffa8a8', label: 'wichtig' },
  ];
  const EVENT_COLORS = EVENT_CATEGORIES.map((c) => c.color);

  colorSelect.innerHTML = EVENT_CATEGORIES.map((c) => `<option value="${c.color}">${c.label}</option>`).join('');
  colorSelect.addEventListener('change', () => { colorPreview.style.background = colorSelect.value; });

  function setSelectedColor(color) {
    colorSelect.value = EVENT_COLORS.includes(color) ? color : EVENT_COLORS[0];
    colorPreview.style.background = colorSelect.value;
  }

  let currentUser = null;
  let viewDate = new Date();
  viewDate.setDate(1);
  let events = [];
  let editingEventId = null;

  async function api(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    if (res.status === 204) return null;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Unbekannter Fehler');
    return body;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function toLocalInput(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // ---------- Auth ----------

  async function populateUserSelect() {
    try {
      const { users } = await api('/auth/users');
      usernameSelect.innerHTML = users
        .map((u) => `<option value="${u.username}">${u.displayName}</option>`)
        .join('');
    } catch (err) {
      console.error(err);
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const data = Object.fromEntries(new FormData(loginForm));
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: JSON.stringify(data) });
      onLoggedIn(user);
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    currentUser = null;
    events = [];
    appScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    loginForm.reset();
    populateUserSelect();
    showTab('calendar');
  }

  logoutBtn.addEventListener('click', logout);
  profileLogoutBtn.addEventListener('click', logout);

  function onLoggedIn(user) {
    currentUser = user;
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    currentUserEl.textContent = `Angemeldet als ${user.displayName}`;
    loadMonth();
  }

  // ---------- Calendar rendering ----------

  function goToMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
    loadMonth();
  }

  function goToToday() {
    viewDate = new Date();
    viewDate.setDate(1);
    loadMonth();
  }

  prevMonthBtn.addEventListener('click', () => goToMonth(-1));
  nextMonthBtn.addEventListener('click', () => goToMonth(1));
  todayBtn.addEventListener('click', goToToday);

  // Bottom nav (mobile): switches pages. Only "Kalender", "Samstage" and
  // "Profil" show real content so far — the remaining placeholder just
  // leaves the calendar showing. Every switch reloads that page's data
  // fresh from the server, so entries generated elsewhere (e.g. the
  // Wagenbau event from checking a Saturday) show up immediately.
  function showTab(tab) {
    bottomNavItems.forEach((i) => i.classList.toggle('active', i.dataset.tab === tab));

    const showCalendar = tab === 'calendar' || tab === 'placeholder-2';
    const showSaturdays = tab === 'saturdays';
    const showProfile = tab === 'profile';

    weekdayRow.classList.toggle('hidden', !showCalendar);
    calendarGrid.classList.toggle('hidden', !showCalendar);
    saturdaysView.classList.toggle('hidden', !showSaturdays);
    profileView.classList.toggle('hidden', !showProfile);

    if (showProfile) {
      monthLabel.textContent = 'Profil';
      profileName.textContent = currentUser.displayName;
      profileAvatar.textContent = currentUser.displayName.charAt(0).toUpperCase();
      profileAvatar.style.background = currentUser.color;
    } else if (showSaturdays) {
      monthLabel.textContent = 'Wagenbau?';
      renderSaturdaysList();
    } else {
      loadMonth(); // also updates monthLabel
    }
  }

  // ---------- Saturdays view ----------

  const SATURDAY_TITLE_FORMAT = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const SATURDAY_WEEKS_PAST = 52;
  const SATURDAY_WEEKS_FUTURE = 104;

  function getNextSaturday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    return d;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  async function toggleSaturdayCheck(date, checked) {
    const key = dateKey(date);
    try {
      if (checked) {
        await api(`/saturdays/${key}`, { method: 'POST' });
      } else {
        await api(`/saturdays/${key}`, { method: 'DELETE' });
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async function renderSaturdaysList() {
    const nextSaturday = getNextSaturday();
    saturdaysList.innerHTML = '';
    let nextSaturdayRow = null;

    let checkedDates = new Set();
    try {
      const { dates } = await api('/saturdays');
      checkedDates = new Set(dates);
    } catch (err) {
      console.error(err);
    }

    for (let i = -SATURDAY_WEEKS_PAST; i <= SATURDAY_WEEKS_FUTURE; i++) {
      const date = new Date(nextSaturday);
      date.setDate(date.getDate() + i * 7);
      const key = dateKey(date);

      const row = document.createElement('div');
      row.className = 'saturday-row';

      const label = document.createElement('span');
      label.className = 'saturday-row-label';
      label.textContent = date.toLocaleDateString('de-DE', SATURDAY_TITLE_FORMAT);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'saturday-row-checkbox';
      checkbox.checked = checkedDates.has(key);
      checkbox.setAttribute('aria-label', label.textContent);
      checkbox.addEventListener('change', async () => {
        const wanted = checkbox.checked;
        checkbox.disabled = true;
        const ok = await toggleSaturdayCheck(date, wanted);
        if (!ok) checkbox.checked = !wanted;
        checkbox.disabled = false;
      });

      row.append(label, checkbox);
      saturdaysList.appendChild(row);

      if (i === 0) nextSaturdayRow = row;
    }

    if (nextSaturdayRow) {
      nextSaturdayRow.scrollIntoView({ block: 'start' });
    }
  }

  bottomNavItems.forEach((item) => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      const wasActive = item.classList.contains('active');
      if (tab === 'calendar' && wasActive) {
        // Already on Kalender: jump to today instead of reloading the
        // currently-viewed month twice (goToToday() reloads on its own).
        goToToday();
      } else {
        showTab(tab);
      }
    });
  });

  // Swipe up -> next month, swipe down -> previous month.
  const SWIPE_DISTANCE = 50;
  const SWIPE_MAX_OFFAXIS = 80;
  const SWIPE_MAX_DURATION = 600;
  let touchStart = null;
  let suppressNextClick = false;

  calendarGrid.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });

  calendarGrid.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const duration = Date.now() - touchStart.time;
    touchStart = null;

    if (duration <= SWIPE_MAX_DURATION && Math.abs(dy) >= SWIPE_DISTANCE && Math.abs(dx) <= SWIPE_MAX_OFFAXIS) {
      suppressNextClick = true;
      e.preventDefault(); // stop the browser from synthesizing a click at the touch-end position
      goToMonth(dy < 0 ? 1 : -1);
    }
  }, { passive: false });

  // A swipe that starts/ends on a day-cell would otherwise also fire that
  // cell's click handler (open the day/new-event modal) right after navigating.
  calendarGrid.addEventListener('click', (e) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  function gridRange() {
    const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - startOffset);

    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridStart.getDate() + 42); // 6 weeks
    return { gridStart, gridEnd };
  }

  async function loadMonth() {
    monthLabel.textContent = `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    const { gridStart, gridEnd } = gridRange();
    try {
      const { events: fetched } = await api(
        `/events?start=${encodeURIComponent(toLocalInput(gridStart))}&end=${encodeURIComponent(toLocalInput(gridEnd))}`
      );
      events = fetched;
      renderGrid();
    } catch (err) {
      console.error(err);
    }
  }

  function renderGrid() {
    calendarGrid.innerHTML = '';
    const { gridStart } = gridRange();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const cellKey = `${cellDate.getFullYear()}-${pad(cellDate.getMonth() + 1)}-${pad(cellDate.getDate())}`;

      const cell = document.createElement('div');
      cell.className = 'day-cell';
      if (cellDate.getMonth() !== viewDate.getMonth()) cell.classList.add('other-month');
      if (cellKey === todayKey) cell.classList.add('today');

      const num = document.createElement('div');
      num.className = 'day-number';
      num.textContent = cellDate.getDate();
      cell.appendChild(num);

      const dayStart = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayEvents = events.filter((ev) => {
        const s = new Date(ev.startAt);
        const e = new Date(ev.endAt);
        return s < dayEnd && e > dayStart;
      });

      dayEvents.forEach((ev) => {
        const chip = document.createElement('div');
        chip.className = 'event-chip';
        chip.style.background = ev.color;
        chip.textContent = ev.allDay ? ev.title : `${pad(new Date(ev.startAt).getHours())}:${pad(new Date(ev.startAt).getMinutes())} ${ev.title}`;
        chip.title = `${ev.title} — ${ev.ownerName}`;
        chip.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(ev); });
        cell.appendChild(chip);
      });

      const dots = document.createElement('div');
      dots.className = 'day-dots';
      const maxDots = 4;
      dayEvents.slice(0, maxDots).forEach((ev) => {
        const dot = document.createElement('span');
        dot.className = 'day-dot';
        dot.style.background = ev.color;
        dots.appendChild(dot);
      });
      if (dayEvents.length > maxDots) {
        const more = document.createElement('span');
        more.className = 'day-dot-more';
        more.textContent = `+${dayEvents.length - maxDots}`;
        dots.appendChild(more);
      }
      cell.appendChild(dots);

      cell.addEventListener('click', () => {
        if (mobileQuery.matches) {
          openDayModal(cellDate, dayEvents);
        } else {
          openNewModal(cellDate);
        }
      });
      calendarGrid.appendChild(cell);
    }
  }

  // ---------- Day modal (mobile day agenda) ----------

  const DAY_TITLE_FORMAT = { weekday: 'long', day: 'numeric', month: 'long' };

  function formatTimeRange(ev) {
    if (ev.allDay) return 'Ganztägig';
    const start = new Date(ev.startAt);
    const end = new Date(ev.endAt);
    return `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
  }

  function categoryLabel(color) {
    const match = EVENT_CATEGORIES.find((c) => c.color === color);
    return match ? match.label : null;
  }

  function openDayModal(date, dayEvents) {
    dayModalTitle.textContent = date.toLocaleDateString('de-DE', DAY_TITLE_FORMAT);
    dayEventsList.innerHTML = '';

    if (dayEvents.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'day-empty';
      empty.textContent = 'Keine Termine an diesem Tag.';
      dayEventsList.appendChild(empty);
    } else {
      dayEvents
        .slice()
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
        .forEach((ev) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'day-event-row';

          const dot = document.createElement('span');
          dot.className = 'day-event-color';
          dot.style.background = ev.color;

          const info = document.createElement('span');
          info.className = 'day-event-info';

          const titleRow = document.createElement('span');
          titleRow.className = 'day-event-title-row';

          const title = document.createElement('span');
          title.className = 'day-event-title';
          title.textContent = ev.title;
          titleRow.append(title);

          const owner = document.createElement('span');
          owner.className = 'day-event-owner';
          owner.textContent = ev.generated ? 'Generiert' : `von ${ev.ownerName}`;
          titleRow.append(owner);

          info.append(titleRow);

          const category = categoryLabel(ev.color);
          if (category) {
            const categoryEl = document.createElement('span');
            categoryEl.className = 'day-event-category';
            categoryEl.textContent = category;
            categoryEl.style.color = ev.color;
            info.append(categoryEl);
          }

          const time = document.createElement('span');
          time.className = 'day-event-time';
          time.textContent = formatTimeRange(ev);
          info.append(time);

          if (ev.description) {
            const description = document.createElement('span');
            description.className = 'day-event-description';
            description.textContent = ev.description;
            info.append(description);
          }

          row.append(dot, info);
          row.addEventListener('click', () => { closeDayModal(); openEditModal(ev); });
          dayEventsList.appendChild(row);
        });
    }

    dayAddBtn.onclick = () => { closeDayModal(); openNewModal(date); };
    dayModal.classList.remove('hidden');
  }

  function closeDayModal() {
    dayModal.classList.add('hidden');
  }

  dayCloseBtn.addEventListener('click', closeDayModal);
  dayModal.addEventListener('click', (e) => { if (e.target === dayModal) closeDayModal(); });

  // ---------- Event modal ----------

  function openNewModal(date) {
    editingEventId = null;
    modalTitle.textContent = 'Neuer Termin';
    eventForm.reset();
    eventError.textContent = '';
    deleteEventBtn.classList.add('hidden');
    setFormDisabled(false);

    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(date);
    end.setHours(10, 0, 0, 0);
    eventForm.startAt.value = toLocalInput(start);
    eventForm.endAt.value = toLocalInput(end);
    setSelectedColor(EVENT_COLORS[0]);

    eventModal.classList.remove('hidden');
  }

  function openEditModal(ev) {
    editingEventId = ev.id;
    const isOwner = ev.userId === currentUser.id;
    modalTitle.textContent = isOwner ? 'Termin bearbeiten' : `Termin von ${ev.ownerName}`;
    eventError.textContent = '';

    eventForm.title.value = ev.title;
    eventForm.description.value = ev.description;
    eventForm.location.value = ev.location;
    eventForm.allDay.checked = ev.allDay;
    eventForm.startAt.value = toLocalInput(new Date(ev.startAt));
    eventForm.endAt.value = toLocalInput(new Date(ev.endAt));
    setSelectedColor(ev.color);

    deleteEventBtn.classList.toggle('hidden', !isOwner);
    setFormDisabled(!isOwner);

    eventModal.classList.remove('hidden');
  }

  function setFormDisabled(disabled) {
    [...eventForm.elements].forEach((el) => {
      if (el.type !== 'button' && el.type !== 'submit') el.disabled = disabled;
    });
    document.getElementById('save-event-btn').classList.toggle('hidden', disabled);
  }

  function closeModal() {
    eventModal.classList.add('hidden');
    editingEventId = null;
  }

  cancelEventBtn.addEventListener('click', closeModal);
  eventModal.addEventListener('click', (e) => { if (e.target === eventModal) closeModal(); });

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    eventError.textContent = '';
    const fd = new FormData(eventForm);
    const payload = {
      title: fd.get('title'),
      description: fd.get('description'),
      location: fd.get('location'),
      startAt: fd.get('startAt'),
      endAt: fd.get('endAt'),
      allDay: fd.get('allDay') === 'on',
      color: fd.get('color'),
    };

    try {
      if (editingEventId) {
        await api(`/events/${editingEventId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/events', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal();
      loadMonth();
    } catch (err) {
      eventError.textContent = err.message;
    }
  });

  deleteEventBtn.addEventListener('click', async () => {
    if (!editingEventId) return;
    if (!confirm('Diesen Termin wirklich löschen?')) return;
    try {
      await api(`/events/${editingEventId}`, { method: 'DELETE' });
      closeModal();
      loadMonth();
    } catch (err) {
      eventError.textContent = err.message;
    }
  });

  newEventBtn.addEventListener('click', () => openNewModal(new Date()));

  // ---------- Boot ----------

  (async () => {
    try {
      const { user } = await api('/auth/me');
      if (user) {
        onLoggedIn(user);
        return;
      }
    } catch (err) {
      console.error(err);
    }
    await populateUserSelect();
    authScreen.classList.remove('hidden');
  })();
})();
