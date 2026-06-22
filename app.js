(() => {
  "use strict";

  const DATA = window.ROUTINE_DATA;
  const STORAGE_KEY = "abi-workout-pwa-v1";
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const shortDate = new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long" });
  const dateTime = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const defaultState = {
    history: [],
    currentSession: null,
    settings: {
      travelMode: false,
      sound: true,
      vibration: true,
      schedule: { ...DATA.defaultSchedule }
    }
  };

  let state = loadState();
  let currentView = "today";
  let timer = {
    remaining: 0,
    duration: 0,
    running: false,
    interval: null,
    endAt: null
  };

  const main = document.getElementById("main-content");
  const title = document.getElementById("page-title");
  const travelPill = document.getElementById("travel-pill");
  const timerPanel = document.getElementById("timer-panel");
  const timerValue = document.getElementById("timer-value");
  const timerPause = document.getElementById("timer-pause");
  const importInput = document.getElementById("import-input");

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed) return structuredClone(defaultState);
      return {
        ...structuredClone(defaultState),
        ...parsed,
        settings: {
          ...structuredClone(defaultState.settings),
          ...(parsed.settings || {}),
          schedule: {
            ...DATA.defaultSchedule,
            ...((parsed.settings && parsed.settings.schedule) || {})
          }
        }
      };
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2,"0")}:${String(safe % 60).padStart(2,"0")}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getScheduledItem() {
    return state.settings.schedule[String(new Date().getDay())] || "rest";
  }

  function nextRoutineId() {
    if (!state.history.length) return DATA.cycle[0];
    const latest = [...state.history].sort((a,b) => b.completedAt - a.completedAt)[0];
    const index = DATA.cycle.indexOf(latest.routineId);
    return DATA.cycle[(index + 1 + DATA.cycle.length) % DATA.cycle.length];
  }

  function completedToday(routineId) {
    return state.history.some(item => item.date === todayKey() && item.routineId === routineId);
  }

  function setView(view) {
    currentView = view;
    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view || (view === "workout" && button.dataset.view === "today"));
    });
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    travelPill.classList.toggle("active", state.settings.travelMode);
    if (currentView === "today") renderToday();
    if (currentView === "routines") renderRoutines();
    if (currentView === "history") renderHistory();
    if (currentView === "settings") renderSettings();
    if (currentView === "workout") renderWorkout();
  }

  function renderToday() {
    title.textContent = "Hoy";
    const scheduled = getScheduledItem();
    const nextId = nextRoutineId();
    const inProgress = state.currentSession;

    if (inProgress) {
      const routine = DATA.routines[inProgress.routineId];
      main.innerHTML = `
        <section class="hero-card">
          <p class="kicker">Entrenamiento en curso</p>
          <h2 class="hero-title">${escapeHtml(routine.name)}</h2>
          <p class="hero-subtitle">Tu progreso está guardado. Podés cerrar la app y retomarlo después.</p>
          <div class="hero-meta">
            <span class="chip">${countCompletedSets(inProgress)} de ${countTotalSets(routine)} series</span>
            <span class="chip">${escapeHtml(routine.focus)}</span>
          </div>
          <button class="primary-btn" id="resume-workout" type="button">Continuar entrenamiento</button>
        </section>
        ${renderNextRoutineBlock(nextId, "Después")}
      `;
      document.getElementById("resume-workout").onclick = () => setView("workout");
      wireStartButtons();
      return;
    }

    if (scheduled === "rest") {
      const next = DATA.routines[nextId];
      main.innerHTML = `
        <section class="recovery-card">
          <p class="kicker">${escapeHtml(shortDate.format(new Date()))}</p>
          <h2>${escapeHtml(DATA.recovery.title)}</h2>
          <p class="muted">Hoy no hay una sesión asignada en tu calendario.</p>
          <div class="recovery-list">
            ${DATA.recovery.items.map(item => `<div class="recovery-item"><span>✓</span><span>${escapeHtml(item)}</span></div>`).join("")}
          </div>
        </section>
        <div class="section-heading"><h2>Siguiente entrenamiento</h2><span>Ciclo flexible</span></div>
        ${routinePreview(nextId)}
      `;
      wireStartButtons();
      return;
    }

    const routine = DATA.routines[scheduled];
    const isDone = completedToday(scheduled);
    main.innerHTML = `
      <section class="hero-card">
        <p class="kicker">${escapeHtml(shortDate.format(new Date()))}</p>
        <h2 class="hero-title">${isDone ? "Sesión completada" : escapeHtml(routine.name)}</h2>
        <p class="hero-subtitle">${isDone ? `Ya registraste ${escapeHtml(routine.name)} hoy.` : escapeHtml(routine.focus)}</p>
        <div class="hero-meta">
          <span class="chip">${routine.exercises.length} ejercicios</span>
          <span class="chip">≈ ${routine.estimatedMinutes} min</span>
          <span class="chip">${state.settings.travelMode ? "Modo viaje" : "Gimnasio"}</span>
        </div>
        <button class="primary-btn" data-start="${isDone ? nextId : scheduled}" type="button">
          ${isDone ? `Empezar ${escapeHtml(DATA.routines[nextId].name)}` : "Comenzar entrenamiento"}
        </button>
      </section>
      ${scheduled !== nextId ? renderNextRoutineBlock(nextId, "Siguiente en el ciclo") : ""}
    `;
    wireStartButtons();
  }

  function renderNextRoutineBlock(routineId, label) {
    return `
      <div class="section-heading"><h2>${escapeHtml(label)}</h2><span>Podés cambiarlo</span></div>
      ${routinePreview(routineId)}
    `;
  }

  function routinePreview(id) {
    const routine = DATA.routines[id];
    return `
      <article class="routine-card">
        <div class="routine-card-top">
          <div>
            <p class="kicker">${escapeHtml(routine.focus)}</p>
            <h3>${escapeHtml(routine.name)}</h3>
            <p class="muted small">${routine.exercises.length} ejercicios · aprox. ${routine.estimatedMinutes} min</p>
          </div>
          <div class="routine-number">${DATA.cycle.indexOf(id) + 1}</div>
        </div>
        <button class="secondary-btn" data-start="${id}" type="button">Elegir esta sesión</button>
      </article>
    `;
  }

  function renderRoutines() {
    title.textContent = "Rutinas";
    main.innerHTML = `
      <section class="panel">
        <p class="kicker">Programa actual</p>
        <h2>4 sesiones de fuerza</h2>
        <p class="muted">El ciclo continúa desde la última sesión completada, aunque cambies los días.</p>
      </section>
      <div class="section-heading"><h2>Todas las sesiones</h2><span>${state.settings.travelMode ? "Alternativas activas" : "Plan principal"}</span></div>
      <div class="routine-list">
        ${DATA.cycle.map(id => {
          const r = DATA.routines[id];
          return `
            <article class="routine-card">
              <div class="routine-card-top">
                <div>
                  <p class="kicker">${escapeHtml(r.focus)}</p>
                  <h3>${escapeHtml(r.name)}</h3>
                  <p class="muted small">${r.exercises.length} ejercicios · ${r.estimatedMinutes} min</p>
                </div>
                <div class="routine-number">${DATA.cycle.indexOf(id) + 1}</div>
              </div>
              <div class="routine-meta">
                ${r.exercises.slice(0,3).map(ex => `<span class="chip">${escapeHtml(ex.name)}</span>`).join("")}
              </div>
              <button class="secondary-btn" data-start="${id}" type="button">Abrir rutina</button>
            </article>
          `;
        }).join("")}
      </div>
    `;
    wireStartButtons();
  }

  function startRoutine(routineId) {
    if (state.currentSession && state.currentSession.routineId !== routineId) {
      const replace = confirm("Hay otro entrenamiento en curso. ¿Querés reemplazarlo?");
      if (!replace) return;
    }
    if (!state.currentSession || state.currentSession.routineId !== routineId) {
      const routine = DATA.routines[routineId];
      const exercises = {};
      routine.exercises.forEach(ex => {
        const latest = getLastExercisePerformance(ex.id);
        exercises[ex.id] = {
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            weight: latest?.sets?.[i]?.weight ?? "",
            reps: "",
            done: false
          }))
        };
      });
      state.currentSession = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        routineId,
        date: todayKey(),
        startedAt: Date.now(),
        notes: "",
        exercises
      };
      saveState();
    }
    setView("workout");
  }

  function renderWorkout() {
    if (!state.currentSession) {
      setView("today");
      return;
    }
    const session = state.currentSession;
    const routine = DATA.routines[session.routineId];
    const done = countCompletedSets(session);
    const total = countTotalSets(routine);
    const pct = total ? Math.round((done / total) * 100) : 0;
    title.textContent = routine.name;

    main.innerHTML = `
      <section class="workout-header">
        <button class="back-btn" id="back-today" type="button">← Volver a Hoy</button>
        <p class="kicker">${escapeHtml(routine.focus)}</p>
        <div class="progress-wrap">
          <div class="progress-info"><span>${done} de ${total} series</span><span>${pct}%</span></div>
          <div class="progress-track"><div class="progress-bar" style="width:${pct}%"></div></div>
        </div>
      </section>
      <div class="exercise-list">
        ${routine.exercises.map((exercise, index) => exerciseCard(exercise, index, session)).join("")}
      </div>
      <section class="panel finish-wrap">
        <label for="session-notes"><strong>Notas de la sesión</strong></label>
        <textarea id="session-notes" class="note-input" placeholder="Energía, técnica, molestias, ajustes…">${escapeHtml(session.notes || "")}</textarea>
        <div class="divider"></div>
        <button class="primary-btn" id="finish-workout" type="button">Finalizar y guardar</button>
        <button class="danger-btn" id="cancel-workout" type="button" style="margin-top:10px">Descartar sesión</button>
      </section>
    `;

    document.getElementById("back-today").onclick = () => setView("today");
    document.getElementById("session-notes").oninput = e => {
      state.currentSession.notes = e.target.value;
      saveState();
    };
    document.getElementById("finish-workout").onclick = finishWorkout;
    document.getElementById("cancel-workout").onclick = cancelWorkout;
    wireSetControls();
  }

  function exerciseCard(exercise, index, session) {
    const exerciseState = session.exercises[exercise.id];
    const complete = exerciseState.sets.every(set => set.done);
    const last = getLastExercisePerformance(exercise.id);
    const chosenName = state.settings.travelMode ? exercise.travel : `${exercise.name} (${exercise.equipment})`;
    const lastText = last ? summarizeSets(last.sets) : "Sin registros anteriores";
    const suggestion = progressionSuggestion(exercise, last);

    return `
      <article class="exercise-card ${complete ? "complete" : ""}" data-exercise="${exercise.id}">
        <div class="exercise-top">
          <div class="exercise-index">${index + 1}</div>
          <div class="exercise-heading">
            <h3>${escapeHtml(chosenName)}</h3>
            <p class="exercise-detail">${exercise.sets} series · ${escapeHtml(exercise.reps)} reps · descanso ${formatTime(exercise.rest)}</p>
            ${exercise.group ? `<span class="superset-badge">${escapeHtml(exercise.group)}</span>` : ""}
            ${state.settings.travelMode ? `<span class="travel-badge">Reemplaza: ${escapeHtml(exercise.name)}</span>` : ""}
          </div>
        </div>
        <p class="last-performance"><strong>Última vez:</strong> ${escapeHtml(lastText)}</p>
        ${suggestion ? `<p class="suggestion">↗ ${escapeHtml(suggestion)}</p>` : ""}
        <div class="set-table">
          ${exerciseState.sets.map((set, setIndex) => `
            <div class="set-row">
              <span class="set-number">${setIndex + 1}</span>
              <label class="field-wrap">
                <input inputmode="decimal" type="number" min="0" step="0.5"
                  aria-label="Peso de la serie ${setIndex + 1}"
                  value="${escapeHtml(set.weight)}"
                  data-field="weight" data-exercise="${exercise.id}" data-set="${setIndex}">
                <span class="field-unit">kg</span>
              </label>
              <label class="field-wrap">
                <input inputmode="numeric" type="number" min="0" step="1"
                  aria-label="Repeticiones de la serie ${setIndex + 1}"
                  value="${escapeHtml(set.reps)}"
                  data-field="reps" data-exercise="${exercise.id}" data-set="${setIndex}">
                <span class="field-unit">rep</span>
              </label>
              <button class="set-toggle ${set.done ? "done" : ""}"
                data-toggle-set data-exercise="${exercise.id}" data-set="${setIndex}" data-rest="${exercise.rest}"
                type="button" aria-label="Marcar serie ${setIndex + 1}">
                ${set.done ? "✓" : "○"}
              </button>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  function wireSetControls() {
    main.querySelectorAll("input[data-field]").forEach(input => {
      input.addEventListener("change", event => {
        const { exercise, set, field } = event.target.dataset;
        state.currentSession.exercises[exercise].sets[Number(set)][field] = event.target.value;
        saveState();
      });
    });

    main.querySelectorAll("[data-toggle-set]").forEach(button => {
      button.addEventListener("click", event => {
        const { exercise, set, rest } = event.currentTarget.dataset;
        const item = state.currentSession.exercises[exercise].sets[Number(set)];
        item.done = !item.done;
        saveState();
        if (item.done) startTimer(Number(rest));
        renderWorkout();
      });
    });
  }

  function countCompletedSets(session) {
    return Object.values(session.exercises).reduce((total, ex) => total + ex.sets.filter(set => set.done).length, 0);
  }

  function countTotalSets(routine) {
    return routine.exercises.reduce((total, ex) => total + ex.sets, 0);
  }

  function finishWorkout() {
    const session = state.currentSession;
    const routine = DATA.routines[session.routineId];
    const done = countCompletedSets(session);
    const total = countTotalSets(routine);

    if (done < total && !confirm(`Completaste ${done} de ${total} series. ¿Guardar igual?`)) return;

    state.history.push({
      ...session,
      completedAt: Date.now(),
      durationSeconds: Math.max(60, Math.round((Date.now() - session.startedAt) / 1000))
    });
    state.currentSession = null;
    saveState();
    stopTimer();
    showToast("Entrenamiento guardado");
    setView("history");
  }

  function cancelWorkout() {
    if (!confirm("¿Descartar este entrenamiento y todo su progreso?")) return;
    state.currentSession = null;
    saveState();
    stopTimer();
    setView("today");
  }

  function getLastExercisePerformance(exerciseId) {
    const sessions = [...state.history].sort((a,b) => b.completedAt - a.completedAt);
    for (const session of sessions) {
      if (session.exercises?.[exerciseId]) return session.exercises[exerciseId];
    }
    return null;
  }

  function summarizeSets(sets) {
    const completed = sets.filter(s => s.done || s.weight || s.reps);
    if (!completed.length) return "Sin datos";
    const groups = new Map();
    completed.forEach(set => {
      const key = `${set.weight || "—"} kg × ${set.reps || "—"}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return [...groups.entries()].map(([key,count]) => `${count}× ${key}`).join(" · ");
  }

  function progressionSuggestion(exercise, last) {
    if (!last?.sets?.length) return "";
    const valid = last.sets.filter(set => set.done && Number(set.reps) > 0);
    if (valid.length !== exercise.sets) return "";
    const reachedTop = valid.every(set => Number(set.reps) >= exercise.targetMax);
    if (!reachedTop) return "";
    return "Completaste el objetivo en todas las series. Podrías probar un aumento pequeño de peso si la técnica fue sólida.";
  }

  function renderHistory() {
    title.textContent = "Historial";
    const sorted = [...state.history].sort((a,b) => b.completedAt - a.completedAt);
    const completedThisWeek = getThisWeekCount();
    const totalMinutes = Math.round(state.history.reduce((sum,item) => sum + (item.durationSeconds || 0), 0) / 60);

    main.innerHTML = `
      <section class="hero-card">
        <p class="kicker">Tu progreso</p>
        <h2 class="hero-title">${state.history.length} sesiones</h2>
        <div class="hero-meta">
          <span class="chip">${completedThisWeek} esta semana</span>
          <span class="chip">${totalMinutes} min registrados</span>
        </div>
      </section>
      <div class="section-heading"><h2>Sesiones recientes</h2><span>Más nueva primero</span></div>
      <div class="history-list">
        ${sorted.length ? sorted.map(historyCard).join("") : `<div class="empty-state">Todavía no guardaste entrenamientos.</div>`}
      </div>
    `;
  }

  function historyCard(item) {
    const routine = DATA.routines[item.routineId];
    const totalSets = Object.values(item.exercises || {}).reduce((sum, ex) => sum + ex.sets.filter(s => s.done).length, 0);
    const minutes = Math.max(1, Math.round((item.durationSeconds || 0) / 60));
    const maxWeight = getSessionMaxWeight(item);
    return `
      <article class="history-card">
        <div class="history-card-top">
          <div>
            <p class="kicker">${escapeHtml(dateTime.format(new Date(item.completedAt)))}</p>
            <h3>${escapeHtml(routine?.name || "Entrenamiento")}</h3>
            <p class="muted small">${escapeHtml(routine?.focus || "")}</p>
          </div>
          <div class="routine-number">✓</div>
        </div>
        <div class="history-meta">
          <span class="chip">${totalSets} series</span>
          <span class="chip">${minutes} min</span>
          ${maxWeight ? `<span class="chip">Máx. ${maxWeight} kg</span>` : ""}
        </div>
        ${item.notes ? `<p class="last-performance">${escapeHtml(item.notes)}</p>` : ""}
      </article>
    `;
  }

  function getSessionMaxWeight(item) {
    let max = 0;
    Object.values(item.exercises || {}).forEach(ex => ex.sets.forEach(set => {
      max = Math.max(max, Number(set.weight) || 0);
    }));
    return max;
  }

  function getThisWeekCount() {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setHours(0,0,0,0);
    monday.setDate(now.getDate() - day + 1);
    return state.history.filter(item => item.completedAt >= monday.getTime()).length;
  }

  function renderSettings() {
    title.textContent = "Ajustes";
    const routineOptions = [
      `<option value="rest">Descanso</option>`,
      ...DATA.cycle.map(id => `<option value="${id}">${escapeHtml(DATA.routines[id].name)}</option>`)
    ].join("");

    main.innerHTML = `
      <section class="panel">
        <p class="kicker">Experiencia</p>
        ${settingToggle("travel-setting", "Modo viaje", "Muestra alternativas con mancuernas, bandas o peso corporal.", state.settings.travelMode)}
        ${settingToggle("sound-setting", "Sonido del timer", "Emite un aviso breve al terminar el descanso.", state.settings.sound)}
        ${settingToggle("vibration-setting", "Vibración", "Vibra al terminar cuando el navegador lo permite.", state.settings.vibration)}
      </section>

      <div class="section-heading"><h2>Calendario semanal</h2><span>Editable</span></div>
      <section class="panel">
        <p class="muted small">Esto define la sugerencia de “Hoy”. El botón “Siguiente entrenamiento” siempre respeta el ciclo real.</p>
        <div class="schedule-grid">
          ${dayNames.map((day, index) => `
            <label class="schedule-row">
              <span>${day}</span>
              <select data-schedule-day="${index}">
                ${routineOptions}
              </select>
            </label>
          `).join("")}
        </div>
      </section>

      <div class="section-heading"><h2>Datos</h2><span>Solo en tu dispositivo</span></div>
      <section class="panel">
        <div class="inline-actions">
          <button class="secondary-btn" id="export-data" type="button">Exportar JSON</button>
          <button class="secondary-btn" id="import-data" type="button">Importar</button>
        </div>
        <button class="danger-btn" id="clear-data" type="button" style="margin-top:10px">Borrar todo el historial</button>
      </section>

      <section class="panel" style="margin-top:14px">
        <p class="kicker">Versión 1.0</p>
        <p class="muted small">Rutina cargada desde tus capturas. Podés editar ejercicios, series y descansos en <code>routine-data.js</code>.</p>
      </section>
    `;

    document.getElementById("travel-setting").onchange = e => updateSetting("travelMode", e.target.checked);
    document.getElementById("sound-setting").onchange = e => updateSetting("sound", e.target.checked);
    document.getElementById("vibration-setting").onchange = e => updateSetting("vibration", e.target.checked);

    main.querySelectorAll("[data-schedule-day]").forEach(select => {
      const day = select.dataset.scheduleDay;
      select.value = state.settings.schedule[day] || "rest";
      select.onchange = e => {
        state.settings.schedule[day] = e.target.value;
        saveState();
        showToast("Calendario actualizado");
      };
    });

    document.getElementById("export-data").onclick = exportData;
    document.getElementById("import-data").onclick = () => importInput.click();
    document.getElementById("clear-data").onclick = clearData;
  }

  function settingToggle(id, label, detail, checked) {
    return `
      <div class="setting-row">
        <div><strong>${escapeHtml(label)}</strong><p class="muted small" style="margin:4px 0 0">${escapeHtml(detail)}</p></div>
        <label class="switch">
          <input id="${id}" type="checkbox" ${checked ? "checked" : ""}>
          <span class="slider"></span>
        </label>
      </div>
    `;
  }

  function updateSetting(key, value) {
    state.settings[key] = value;
    saveState();
    render();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `abi-entrena-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  importInput.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.history) || !parsed.settings) throw new Error("Formato no válido");
      state = {
        ...structuredClone(defaultState),
        ...parsed,
        settings: {
          ...structuredClone(defaultState.settings),
          ...parsed.settings,
          schedule: { ...DATA.defaultSchedule, ...(parsed.settings.schedule || {}) }
        }
      };
      saveState();
      showToast("Datos importados");
      render();
    } catch {
      alert("No pude importar el archivo. Verificá que sea un backup generado por esta app.");
    } finally {
      event.target.value = "";
    }
  });

  function clearData() {
    if (!confirm("¿Borrar historial y entrenamiento en curso? Esta acción no se puede deshacer.")) return;
    const keepSettings = structuredClone(state.settings);
    state = structuredClone(defaultState);
    state.settings = keepSettings;
    saveState();
    stopTimer();
    showToast("Historial borrado");
    render();
  }

  function wireStartButtons() {
    main.querySelectorAll("[data-start]").forEach(button => {
      button.addEventListener("click", () => startRoutine(button.dataset.start));
    });
  }

  function startTimer(seconds) {
    clearInterval(timer.interval);
    timer.duration = seconds;
    timer.remaining = seconds;
    timer.running = true;
    timer.endAt = Date.now() + seconds * 1000;
    timerPanel.classList.remove("hidden");
    timerPause.textContent = "Pausar";
    updateTimerUI();
    timer.interval = setInterval(tickTimer, 250);
  }

  function tickTimer() {
    if (!timer.running) return;
    timer.remaining = Math.max(0, (timer.endAt - Date.now()) / 1000);
    updateTimerUI();
    if (timer.remaining <= 0) {
      completeTimer();
    }
  }

  function updateTimerUI() {
    timerValue.textContent = formatTime(timer.remaining);
    timerPanel.classList.toggle("urgent", timer.remaining <= 10 && timer.remaining > 0);
  }

  function completeTimer() {
    clearInterval(timer.interval);
    timer.running = false;
    timer.remaining = 0;
    updateTimerUI();
    if (state.settings.vibration && navigator.vibrate) navigator.vibrate([180, 90, 180]);
    if (state.settings.sound) playBeep();
    setTimeout(() => timerPanel.classList.add("hidden"), 2200);
  }

  function stopTimer() {
    clearInterval(timer.interval);
    timer = { remaining: 0, duration: 0, running: false, interval: null, endAt: null };
    timerPanel.classList.add("hidden");
  }

  function playBeep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 740;
      gain.gain.setValueAtTime(.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.2, ctx.currentTime + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .25);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + .26);
    } catch {}
  }

  timerPause.onclick = () => {
    if (timer.running) {
      timer.remaining = Math.max(0, (timer.endAt - Date.now()) / 1000);
      timer.running = false;
      timerPause.textContent = "Seguir";
    } else {
      timer.running = true;
      timer.endAt = Date.now() + timer.remaining * 1000;
      timerPause.textContent = "Pausar";
    }
  };
  document.getElementById("timer-add").onclick = () => {
    timer.remaining += 15;
    if (timer.running) timer.endAt = Date.now() + timer.remaining * 1000;
    updateTimerUI();
  };
  document.getElementById("timer-skip").onclick = stopTimer;

  travelPill.onclick = () => {
    state.settings.travelMode = !state.settings.travelMode;
    saveState();
    render();
  };

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  function showToast(message) {
    document.querySelector(".toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  render();
})();
