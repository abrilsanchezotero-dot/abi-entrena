(() => {
  "use strict";

  const BASE = window.ROUTINE_DATA;
  const EXERCISES = Array.isArray(window.EXERCISE_LIBRARY) ? window.EXERCISE_LIBRARY : [];
  const EXERCISE_MAP = new Map(EXERCISES.map(exercise => [exercise.id, exercise]));
  const STORAGE_KEY = "recomp-studio-plus-v1";

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const calendarDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activityTypes = ["Walk", "Pilates", "Cardio", "Mobility", "Yoga", "Sport", "Recovery", "Other"];

  const fmt = {
    today: new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long" }),
    dateTime: new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    monthTitle: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }),
    fullDate: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    weekDayDate: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }),
    monthDay: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
    short: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
  };

  const defaultState = {
    history: [],
    currentSession: null,
    calendarNotes: {},
    activities: {},
    settings: {
      travelMode: false,
      sound: true,
      vibration: true,
      schedule: { ...BASE.defaultSchedule },
      weekPlan: {}
    },
    program: {
      cycle: [...BASE.cycle],
      routines: structuredClone(BASE.routines)
    }
  };

  let state = normalizeState(loadState());
  let currentView = "today";
  let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedCalendarDate = todayKey();
  let selectedExerciseId = null;
  let editorRoutineId = null;
  let editorDraft = null;

  let timer = {
    remaining: 0,
    duration: 0,
    running: false,
    interval: null,
    endAt: null
  };

  let audioContext = null;
  let audioUnlocked = false;

  const main = document.getElementById("main-content");
  const title = document.getElementById("page-title");
  const travelPill = document.getElementById("travel-pill");
  const timerPanel = document.getElementById("timer-panel");
  const timerValue = document.getElementById("timer-value");
  const timerPause = document.getElementById("timer-pause");
  const importInput = document.getElementById("import-input");
  const modalRoot = document.getElementById("modal-root");

  saveState();

  // -------------------------
  // State and helpers
  // -------------------------
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(defaultState);
    } catch {
      return structuredClone(defaultState);
    }
  }

  function normalizeState(raw) {
    const normalized = {
      ...structuredClone(defaultState),
      ...(raw || {}),
      settings: {
        ...structuredClone(defaultState.settings),
        ...((raw && raw.settings) || {}),
        schedule: {
          ...BASE.defaultSchedule,
          ...((raw && raw.settings && raw.settings.schedule) || {})
        },
        weekPlan: {
          ...((raw && raw.settings && raw.settings.weekPlan) || {})
        }
      },
      program: normalizeProgram(raw?.program),
      calendarNotes: raw?.calendarNotes && typeof raw.calendarNotes === "object" ? raw.calendarNotes : {},
      activities: raw?.activities && typeof raw.activities === "object" ? raw.activities : {}
    };

    normalized.history = Array.isArray(raw?.history)
      ? raw.history.map(normalizeSession)
      : [];

    if (raw?.currentSession) {
      normalized.currentSession = normalized.program.routines[raw.currentSession.routineId]
        ? normalizeSession(raw.currentSession)
        : null;
    }

    Object.entries(normalized.settings.weekPlan).forEach(([key, routineId]) => {
      if (routineId !== "rest" && !normalized.program.routines[routineId]) {
        delete normalized.settings.weekPlan[key];
      }
    });

    return normalized;
  }

  function normalizeProgram(program) {
    const source = program?.routines ? program : { cycle: BASE.cycle, routines: BASE.routines };
    const cycle = Array.isArray(source.cycle) ? [...source.cycle] : [...BASE.cycle];
    const routines = {};

    cycle.forEach(routineId => {
      const baseRoutine = source.routines?.[routineId] || BASE.routines[routineId];
      if (!baseRoutine) return;
      routines[routineId] = normalizeRoutine({ ...baseRoutine, id: routineId });
    });

    Object.entries(source.routines || {}).forEach(([routineId, routine]) => {
      if (!routines[routineId]) {
        routines[routineId] = normalizeRoutine({ ...routine, id: routineId });
        cycle.push(routineId);
      }
    });

    return { cycle, routines };
  }

  function normalizeRoutine(routine) {
    return {
      id: routine.id || makeId("routine"),
      name: routine.name || "Workout",
      shortName: routine.shortName || routine.name || "Workout",
      focus: routine.focus || "",
      estimatedMinutes: Number(routine.estimatedMinutes) || 45,
      exercises: Array.isArray(routine.exercises)
        ? routine.exercises.map(normalizeExercise)
        : []
    };
  }

  function normalizeExercise(exercise) {
    const min = Number(exercise.targetMin) || parseRepRange(exercise.reps).min || 8;
    const max = Number(exercise.targetMax) || parseRepRange(exercise.reps).max || min;
    return {
      id: exercise.id || makeId("exercise"),
      name: exercise.name || "Exercise",
      equipment: exercise.equipment || "",
      sets: Math.max(1, Number(exercise.sets) || 3),
      reps: exercise.reps || `${min}–${max}`,
      targetMin: min,
      targetMax: max,
      rest: Math.max(0, Number(exercise.rest) || 60),
      travel: exercise.travel || "",
      group: exercise.group || ""
    };
  }

  function normalizeSession(session) {
    const normalized = {
      ...session,
      notes: session?.notes || "",
      routineName: session?.routineName || state?.program?.routines?.[session?.routineId]?.name || "",
      routineFocus: session?.routineFocus || state?.program?.routines?.[session?.routineId]?.focus || "",
      exercises: { ...(session?.exercises || {}) }
    };

    Object.entries(normalized.exercises).forEach(([slotExerciseId, exerciseState]) => {
      const fallback = getExerciseDefinition(slotExerciseId);
      normalized.exercises[slotExerciseId] = {
        ...exerciseState,
        originalExerciseId: exerciseState?.originalExerciseId || slotExerciseId,
        performedExerciseId: exerciseState?.performedExerciseId || slotExerciseId,
        originalName: exerciseState?.originalName || exerciseState?.name || fallback?.name || "Exercise",
        performedName: exerciseState?.performedName || exerciseState?.name || fallback?.name || "Exercise",
        equipment: exerciseState?.equipment || fallback?.equipment || "",
        notes: exerciseState?.notes || "",
        sets: Array.isArray(exerciseState?.sets)
          ? exerciseState.sets.map(set => ({
              weight: set?.weight ?? "",
              reps: set?.reps ?? "",
              rir: set?.rir ?? "",
              done: Boolean(set?.done)
            }))
          : []
      };
    });

    return normalized;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function makeId(prefix = "id") {
    return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function dateFromKey(key) {
    const [year, month, day] = String(key).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function parseRepRange(value) {
    const matches = String(value || "").match(/\d+/g) || [];
    const min = Number(matches[0]) || 0;
    const max = Number(matches[1]) || min;
    return { min, max };
  }

  function getRoutine(routineId) {
    return state.program.routines[routineId];
  }

  function getExerciseDefinition(exerciseId) {
    for (const routineId of state.program.cycle) {
      const exercise = getRoutine(routineId)?.exercises.find(item => item.id === exerciseId);
      if (exercise) return exercise;
    }

    const libraryItem = EXERCISE_MAP.get(exerciseId);
    if (libraryItem) {
      return {
        ...libraryItem,
        sets: 3,
        reps: "8–12",
        targetMin: 8,
        targetMax: 12,
        rest: 60,
        travel: "",
        group: ""
      };
    }

    for (const session of state.history) {
      for (const exerciseState of Object.values(session.exercises || {})) {
        if (exerciseState.performedExerciseId === exerciseId) {
          return {
            id: exerciseId,
            name: exerciseState.performedName || "Custom exercise",
            equipment: exerciseState.equipment || "Custom",
            sets: exerciseState.sets?.length || 3,
            reps: "Custom",
            targetMin: 0,
            targetMax: 0,
            rest: 60,
            travel: "",
            group: ""
          };
        }
      }
    }

    return null;
  }

  function allProgramExercises() {
    const seen = new Map();

    state.program.cycle.forEach(routineId => {
      getRoutine(routineId)?.exercises.forEach(exercise => {
        if (!seen.has(exercise.id)) seen.set(exercise.id, exercise);
      });
    });

    state.history.forEach(session => {
      Object.values(session.exercises || {}).forEach(exerciseState => {
        const performedId = exerciseState.performedExerciseId || exerciseState.originalExerciseId;
        if (!performedId || seen.has(performedId)) return;
        seen.set(performedId, getExerciseDefinition(performedId) || {
          id: performedId,
          name: exerciseState.performedName || "Custom exercise",
          equipment: exerciseState.equipment || "Custom"
        });
      });
    });

    return [...seen.values()];
  }

  function startOfWeek(date = new Date(), offsetWeeks = 0) {
    const start = new Date(date);
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset + offsetWeeks * 7);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  function weekDates(offsetWeeks = 0) {
    const monday = startOfWeek(new Date(), offsetWeeks);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
  }

  function getScheduledItem(date = new Date()) {
    const key = dateKey(date);
    const planned = state.settings.weekPlan?.[key];
    if (planned) return planned;
    return state.settings.schedule[String(date.getDay())] || "rest";
  }

  function nextRoutineId() {
    if (!state.history.length) return state.program.cycle[0];
    const latest = [...state.history].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))[0];
    const index = state.program.cycle.indexOf(latest.routineId);
    return state.program.cycle[(index + 1 + state.program.cycle.length) % state.program.cycle.length];
  }

  function sessionsForDate(key) {
    return state.history.filter(item => item.date === key);
  }

  function activitiesForDate(key) {
    return Array.isArray(state.activities[key]) ? state.activities[key] : [];
  }

  function completedToday(routineId) {
    return state.history.some(item => item.date === todayKey() && item.routineId === routineId);
  }

  // -------------------------
  // Navigation
  // -------------------------
  function setView(view) {
    currentView = view;
    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.view === view ||
        (["workout", "exerciseHistory", "routineEditor"].includes(view) && button.dataset.view === (view === "workout" ? "today" : view === "exerciseHistory" ? "history" : "settings"))
      );
    });
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    travelPill.classList.toggle("active", state.settings.travelMode);

    if (currentView === "today") renderToday();
    if (currentView === "routines") renderRoutines();
    if (currentView === "calendar") renderCalendar();
    if (currentView === "coach") renderCoach();
    if (currentView === "history") renderProgress();
    if (currentView === "settings") renderSettings();
    if (currentView === "workout") renderWorkout();
    if (currentView === "exerciseHistory") renderExerciseHistory();
    if (currentView === "routineEditor") renderRoutineEditor();
  }

  // -------------------------
  // Today and routines
  // -------------------------
  function renderToday() {
    title.textContent = "Today";

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const scheduled = getScheduledItem(today);
    const nextId = nextRoutineId();
    const tomorrowBlock = renderTomorrowBlock(tomorrow);

    if (state.currentSession) {
      const routine = getRoutine(state.currentSession.routineId);
      main.innerHTML = `
        <section class="hero-card">
          <p class="kicker">Workout in progress</p>
          <h2 class="hero-title">${escapeHtml(routine?.name || state.currentSession.routineName || "Workout")}</h2>
          <p class="hero-subtitle">Your set data, RIR, substitutions, and notes are saved on this device.</p>
          <div class="hero-meta">
            <span class="chip">${countCompletedSets(state.currentSession)} of ${countSessionSets(state.currentSession)} sets</span>
            <span class="chip">${escapeHtml(routine?.focus || state.currentSession.routineFocus || "")}</span>
          </div>
          <button class="primary-btn" id="resume-workout" type="button">Continue workout</button>
        </section>
        ${tomorrowBlock}
      `;
      document.getElementById("resume-workout").onclick = () => {
        ensureAudioReady();
        setView("workout");
      };
      wireStartButtons();
      return;
    }

    if (scheduled === "rest" || !getRoutine(scheduled)) {
      main.innerHTML = `
        <section class="recovery-card">
          <p class="kicker">Today · ${escapeHtml(fmt.today.format(today))}</p>
          <h2>${escapeHtml(BASE.recovery.title)}</h2>
          <p class="muted">No programmed strength session is scheduled for today.</p>
          <div class="recovery-list">
            ${BASE.recovery.items.map(item => `<div class="recovery-item"><span>✓</span><span>${escapeHtml(item)}</span></div>`).join("")}
          </div>
          <button class="secondary-btn" id="quick-activity" type="button" style="margin-top:14px">Log another activity</button>
        </section>
        ${tomorrowBlock}
        <div class="section-heading"><h2>Next in your cycle</h2><span>Flexible plan</span></div>
        ${routinePreview(nextId)}
      `;
      document.getElementById("quick-activity").onclick = () => openActivityModal(todayKey());
      wireStartButtons();
      return;
    }

    const routine = getRoutine(scheduled);
    const isDone = completedToday(scheduled);

    main.innerHTML = `
      <section class="hero-card">
        <p class="kicker">Today · ${escapeHtml(fmt.today.format(today))}</p>
        <h2 class="hero-title">${isDone ? "Workout complete" : escapeHtml(routine.name)}</h2>
        <p class="hero-subtitle">${isDone ? `You already logged ${escapeHtml(routine.name)} today.` : escapeHtml(routine.focus)}</p>
        <div class="hero-meta">
          <span class="chip">${routine.exercises.length} exercises</span>
          <span class="chip">≈ ${routine.estimatedMinutes} min</span>
          <span class="chip">${state.settings.travelMode ? "Travel mode" : "Gym mode"}</span>
        </div>
        <button class="primary-btn" data-start="${isDone ? nextId : scheduled}" type="button">
          ${isDone ? `Start ${escapeHtml(getRoutine(nextId)?.name || "next workout")}` : "Start workout"}
        </button>
      </section>
      ${tomorrowBlock}
    `;

    wireStartButtons();
  }

  function renderTomorrowBlock(date) {
    const routineId = getScheduledItem(date);
    const routine = getRoutine(routineId);

    return `
      <div class="section-heading">
        <h2>Tomorrow</h2>
        <span>${escapeHtml(fmt.today.format(date))}</span>
      </div>
      <article class="tomorrow-card">
        ${routine ? `
          <div>
            <p class="kicker">Planned workout</p>
            <h3>${escapeHtml(routine.name)}</h3>
            <p class="muted">${escapeHtml(routine.focus)}</p>
            <div class="hero-meta">
              <span class="chip">${routine.exercises.length} exercises</span>
              <span class="chip">≈ ${routine.estimatedMinutes} min</span>
            </div>
          </div>
          <button class="secondary-btn" data-start="${routineId}" type="button">Start workout</button>
        ` : `
          <div>
            <p class="kicker">Planned day</p>
            <h3>Rest / recovery</h3>
            <p class="muted">You can change tomorrow’s plan in Settings → This week.</p>
          </div>
        `}
      </article>
    `;
  }

  function renderNextRoutineBlock(routineId, label) {
    return `
      <div class="section-heading"><h2>${escapeHtml(label)}</h2><span>You can change it</span></div>
      ${routinePreview(routineId)}
    `;
  }

  function routinePreview(routineId) {
    const routine = getRoutine(routineId);
    if (!routine) return "";
    return `
      <article class="routine-card">
        <div class="routine-card-top">
          <div>
            <p class="kicker">${escapeHtml(routine.focus)}</p>
            <h3>${escapeHtml(routine.name)}</h3>
            <p class="muted small">${routine.exercises.length} exercises · about ${routine.estimatedMinutes} min</p>
          </div>
          <div class="routine-number">${state.program.cycle.indexOf(routineId) + 1}</div>
        </div>
        <button class="secondary-btn" data-start="${routineId}" type="button">Start workout</button>
      </article>
    `;
  }

  function renderRoutines() {
    title.textContent = "Routines";
    main.innerHTML = `
      <section class="panel">
        <p class="kicker">Current program</p>
        <h2>${state.program.cycle.length} strength sessions</h2>
        <p class="muted">Start any workout, review an exercise’s progress, or edit the full program in Settings.</p>
      </section>

      <div class="section-heading"><h2>All workouts</h2><span>${state.settings.travelMode ? "Travel alternatives on" : "Main program"}</span></div>

      <div class="routine-list">
        ${state.program.cycle.map((routineId, routineIndex) => {
          const routine = getRoutine(routineId);
          if (!routine) return "";
          return `
            <article class="routine-card">
              <div class="routine-card-top">
                <div>
                  <p class="kicker">${escapeHtml(routine.focus)}</p>
                  <h3>${escapeHtml(routine.name)}</h3>
                  <p class="muted small">${routine.exercises.length} exercises · ${routine.estimatedMinutes} min</p>
                </div>
                <div class="routine-number">${routineIndex + 1}</div>
              </div>

              <div class="routine-exercise-links">
                ${routine.exercises.map(exercise => `
                  <button class="exercise-link" data-history-exercise="${exercise.id}" type="button">
                    ${escapeHtml(exercise.name)} <span>↗</span>
                  </button>
                `).join("")}
              </div>

              <button class="primary-btn" data-start="${routineId}" type="button">Start workout</button>
            </article>
          `;
        }).join("")}
      </div>
    `;

    wireStartButtons();
    wireExerciseHistoryButtons();
  }

  // -------------------------
  // Workout
  // -------------------------
  function startRoutine(routineId) {
    const routine = getRoutine(routineId);
    if (!routine) return;

    ensureAudioReady();

    if (state.currentSession && state.currentSession.routineId !== routineId) {
      if (!confirm("Another workout is already in progress. Replace it?")) return;
    }

    if (!state.currentSession || state.currentSession.routineId !== routineId) {
      const exercises = {};

      routine.exercises.forEach(exercise => {
        const initialPerformedId = state.settings.travelMode && exercise.travel
          ? `custom:${slugify(exercise.travel)}`
          : exercise.id;
        const initialPerformedName = state.settings.travelMode && exercise.travel
          ? exercise.travel
          : exercise.name;
        const latest = getLastExercisePerformance(initialPerformedId);

        exercises[exercise.id] = {
          originalExerciseId: exercise.id,
          performedExerciseId: initialPerformedId,
          originalName: exercise.name,
          performedName: initialPerformedName,
          equipment: exercise.equipment,
          notes: "",
          sets: Array.from({ length: exercise.sets }, (_, index) => ({
            weight: latest?.sets?.[index]?.weight ?? "",
            reps: "",
            rir: "",
            done: false
          }))
        };
      });

      state.currentSession = {
        id: makeId("session"),
        routineId,
        routineName: routine.name,
        routineFocus: routine.focus,
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
    const routine = getRoutine(session.routineId);
    const exerciseDefinitions = routine?.exercises || [];
    const done = countCompletedSets(session);
    const total = countSessionSets(session);
    const percentage = total ? Math.round((done / total) * 100) : 0;
    title.textContent = routine?.name || session.routineName || "Workout";

    main.innerHTML = `
      <section class="workout-header">
        <button class="back-btn" id="back-today" type="button">← Back to Today</button>
        <p class="kicker">${escapeHtml(routine?.focus || session.routineFocus || "")}</p>
        <div class="progress-wrap">
          <div class="progress-info"><span>${done} of ${total} sets</span><span>${percentage}%</span></div>
          <div class="progress-track"><div class="progress-bar" style="width:${percentage}%"></div></div>
        </div>
      </section>

      <div class="exercise-list">
        ${exerciseDefinitions.map((exercise, index) => exerciseCard(exercise, index, session)).join("")}
      </div>

      <section class="panel finish-wrap">
        <label for="session-notes"><strong>Workout notes</strong></label>
        <textarea id="session-notes" class="note-input" placeholder="Energy, overall performance, discomfort, or anything to remember…">${escapeHtml(session.notes || "")}</textarea>
        <div class="divider"></div>
        <button class="primary-btn" id="finish-workout" type="button">Finish and save</button>
        <button class="danger-btn" id="cancel-workout" type="button" style="margin-top:10px">Discard workout</button>
      </section>
    `;

    document.getElementById("back-today").onclick = () => setView("today");
    document.getElementById("session-notes").oninput = event => {
      state.currentSession.notes = event.target.value;
      saveState();
    };
    document.getElementById("finish-workout").onclick = finishWorkout;
    document.getElementById("cancel-workout").onclick = cancelWorkout;

    wireWorkoutControls();
    wireExerciseHistoryButtons();
  }

  function exerciseCard(exercise, index, session) {
    const exerciseState = session.exercises[exercise.id];
    if (!exerciseState) return "";

    const complete = exerciseState.sets.every(set => set.done);
    const performedId = exerciseState.performedExerciseId || exercise.id;
    const last = getLastExercisePerformance(performedId);
    const isSubstituted = performedId !== exercise.id || exerciseState.performedName !== exerciseState.originalName;
    const suggestion = progressionSuggestion(exercise, last);

    return `
      <article class="exercise-card ${complete ? "complete" : ""}" data-exercise="${exercise.id}">
        <div class="exercise-top">
          <div class="exercise-index">${index + 1}</div>
          <div class="exercise-heading">
            <h3>${escapeHtml(exerciseState.performedName)}</h3>
            <p class="exercise-detail">${exercise.sets} sets · ${escapeHtml(exercise.reps)} reps · rest ${formatTime(exercise.rest)}</p>
            ${exercise.group ? `<span class="superset-badge">${escapeHtml(exercise.group)}</span>` : ""}
            ${isSubstituted ? `<span class="travel-badge">Instead of ${escapeHtml(exerciseState.originalName)}</span>` : ""}
          </div>
        </div>

        <div class="exercise-actions">
          <button class="text-btn" data-replace-exercise="${exercise.id}" type="button">Replace exercise</button>
          <button class="text-btn" data-history-exercise="${escapeHtml(performedId)}" type="button">View history</button>
        </div>

        ${lastPerformanceBlock(last)}
        ${suggestion ? `<p class="suggestion">↗ ${escapeHtml(suggestion)}</p>` : ""}

        <div class="set-table">
          <div class="set-table-header" aria-hidden="true">
            <span>Set</span><span>Kg</span><span>Reps</span><span>RIR</span><span></span>
          </div>

          ${exerciseState.sets.map((set, setIndex) => `
            <div class="set-row">
              <span class="set-number">${setIndex + 1}</span>

              <label class="field-wrap">
                <input inputmode="decimal" type="number" min="0" step="0.5"
                  aria-label="Weight for set ${setIndex + 1}"
                  value="${escapeHtml(set.weight)}" placeholder="—"
                  data-field="weight" data-exercise="${exercise.id}" data-set="${setIndex}">
              </label>

              <label class="field-wrap">
                <input inputmode="numeric" type="number" min="0" step="1"
                  aria-label="Repetitions for set ${setIndex + 1}"
                  value="${escapeHtml(set.reps)}" placeholder="—"
                  data-field="reps" data-exercise="${exercise.id}" data-set="${setIndex}">
              </label>

              <label class="field-wrap">
                <input inputmode="numeric" type="number" min="0" max="10" step="1"
                  aria-label="RIR for set ${setIndex + 1}"
                  value="${escapeHtml(set.rir)}" placeholder="—"
                  data-field="rir" data-exercise="${exercise.id}" data-set="${setIndex}">
              </label>

              <button class="set-toggle ${set.done ? "done" : ""}"
                data-toggle-set data-exercise="${exercise.id}" data-set="${setIndex}" data-rest="${exercise.rest}"
                type="button" aria-label="Mark set ${setIndex + 1} complete">
                ${set.done ? "✓" : "○"}
              </button>
            </div>
          `).join("")}
        </div>

        <label class="exercise-note-label" for="note-${exercise.id}">Exercise note</label>
        <textarea
          id="note-${exercise.id}"
          class="exercise-note-input"
          data-exercise-note="${exercise.id}"
          placeholder="Setup, machine setting, technique cue, discomfort, or anything to remember next time…"
        >${escapeHtml(exerciseState.notes || "")}</textarea>
      </article>
    `;
  }

  function lastPerformanceBlock(last) {
    if (!last) {
      return `<div class="last-performance"><strong>Last time:</strong> No previous record.</div>`;
    }

    return `
      <div class="last-performance">
        <div class="last-performance-title">
          <strong>Last time · ${escapeHtml(fmt.short.format(new Date(last.completedAt)))}</strong>
          ${last.performedName && last.performedName !== last.originalName ? `<span class="last-substitute">Performed: ${escapeHtml(last.performedName)}</span>` : ""}
        </div>
        <div class="last-set-list">${formatPreviousSets(last.sets)}</div>
        ${last.notes ? `<div class="last-exercise-note"><strong>Note:</strong> ${escapeHtml(last.notes)}</div>` : ""}
      </div>
    `;
  }

  function formatPreviousSets(sets) {
    const recorded = (sets || []).filter(set => set.done || set.weight || set.reps || set.rir !== "");
    if (!recorded.length) return `<span class="muted">No set details.</span>`;

    return recorded.map((set, index) => `
      <span class="last-set-pill">
        ${index + 1}: ${escapeHtml(set.weight || "—")} kg · ${escapeHtml(set.reps || "—")} reps · RIR ${escapeHtml(set.rir === "" || set.rir == null ? "—" : set.rir)}
      </span>
    `).join("");
  }

  function wireWorkoutControls() {
    main.querySelectorAll("input[data-field]").forEach(input => {
      input.addEventListener("input", event => {
        const { exercise, set, field } = event.target.dataset;
        state.currentSession.exercises[exercise].sets[Number(set)][field] = event.target.value;
        saveState();
      });
    });

    main.querySelectorAll("[data-exercise-note]").forEach(textarea => {
      textarea.addEventListener("input", event => {
        const exerciseId = event.target.dataset.exerciseNote;
        state.currentSession.exercises[exerciseId].notes = event.target.value;
        saveState();
      });
    });

    main.querySelectorAll("[data-toggle-set]").forEach(button => {
      button.addEventListener("click", event => {
        const { exercise, set, rest } = event.currentTarget.dataset;
        ensureAudioReady();
        const item = state.currentSession.exercises[exercise].sets[Number(set)];
        item.done = !item.done;
        saveState();
        if (item.done) startTimer(Number(rest));
        renderWorkout();
      });
    });

    main.querySelectorAll("[data-replace-exercise]").forEach(button => {
      button.addEventListener("click", () => openSubstitutionModal(button.dataset.replaceExercise));
    });
  }

  function countCompletedSets(session) {
    return Object.values(session.exercises || {}).reduce(
      (total, exercise) => total + (exercise.sets || []).filter(set => set.done).length,
      0
    );
  }

  function countSessionSets(session) {
    return Object.values(session.exercises || {}).reduce(
      (total, exercise) => total + (exercise.sets || []).length,
      0
    );
  }

  function finishWorkout() {
    const session = state.currentSession;
    const done = countCompletedSets(session);
    const total = countSessionSets(session);

    if (done < total && !confirm(`You completed ${done} of ${total} sets. Save the workout anyway?`)) return;

    state.history.push({
      ...session,
      completedAt: Date.now(),
      durationSeconds: Math.max(60, Math.round((Date.now() - session.startedAt) / 1000))
    });

    state.currentSession = null;
    saveState();
    stopTimer();
    selectedCalendarDate = session.date;
    showToast("Workout saved");
    setView("calendar");
  }

  function cancelWorkout() {
    if (!confirm("Discard this workout and all of its progress?")) return;
    state.currentSession = null;
    saveState();
    stopTimer();
    setView("today");
  }

  function progressionSuggestion(exercise, last) {
    if (!last?.sets?.length) return "";

    const valid = last.sets.filter(set => set.done && Number(set.reps) > 0);
    if (valid.length !== exercise.sets) return "";

    const reachedTop = valid.every(set => Number(set.reps) >= Number(exercise.targetMax));
    const withRir = valid.filter(set => set.rir !== "" && set.rir != null);
    const effortAllows = !withRir.length || withRir.every(set => Number(set.rir) >= 1);

    return reachedTop && effortAllows
      ? "You reached the top of the rep range on every set. If technique was solid, consider a small weight increase."
      : "";
  }

  function getLastExercisePerformance(exerciseId) {
    const sessions = [...state.history].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    for (const session of sessions) {
      for (const [slotId, exerciseState] of Object.entries(session.exercises || {})) {
        const performedId = exerciseState.performedExerciseId || exerciseState.originalExerciseId || slotId;
        if (performedId === exerciseId) {
          return {
            ...exerciseState,
            completedAt: session.completedAt,
            date: session.date,
            routineId: session.routineId
          };
        }
      }
    }

    return null;
  }

  // -------------------------
  // Exercise substitution
  // -------------------------
  function openSubstitutionModal(slotExerciseId) {
    const definition = getExerciseDefinition(slotExerciseId);
    const current = state.currentSession?.exercises?.[slotExerciseId];
    if (!definition || !current) return;

    const recommendations = recommendedAlternatives(slotExerciseId);

    openModal(`
      <div class="modal-sheet substitution-sheet">
        <div class="modal-head">
          <div>
            <p class="kicker">Exercise library</p>
            <h2>Replace ${escapeHtml(definition.name)}</h2>
          </div>
          <button class="modal-close" data-close-modal type="button">×</button>
        </div>

        <p class="muted">Recommended options preserve the same muscle or movement pattern. Your history will track the replacement separately from the original exercise.</p>

        <label class="form-label" for="exercise-search">Search the exercise library</label>
        <input id="exercise-search" class="form-input" placeholder="Search by exercise, muscle, equipment, or movement…">

        <div class="replacement-section">
          <div class="replacement-title"><strong>Recommended alternatives</strong><span>${recommendations.length}</span></div>
          <div id="recommended-replacements" class="replacement-list">
            ${replacementButtons(recommendations)}
          </div>
        </div>

        <div class="replacement-section">
          <div class="replacement-title"><strong>All matching exercises</strong><span id="search-count">${EXERCISES.length}</span></div>
          <div id="exercise-search-results" class="replacement-list replacement-scroll">
            ${replacementButtons(EXERCISES.slice(0, 30))}
          </div>
        </div>

        <div class="custom-replacement">
          <label class="form-label" for="custom-substitute">Can’t find it? Record what you actually did</label>
          <input id="custom-substitute" class="form-input" value="" placeholder="Example: Supported RDL">
          <button class="secondary-btn" id="save-custom-substitute" type="button">Use custom exercise</button>
        </div>

        <button class="text-btn reset-exercise-btn" id="use-original-exercise" type="button">Use original exercise</button>
      </div>
    `);

    const chooseExercise = exerciseId => {
      const selected = EXERCISE_MAP.get(exerciseId);
      if (!selected) return;
      current.performedExerciseId = selected.id;
      current.performedName = selected.name;
      current.equipment = selected.equipment;
      const latest = getLastExercisePerformance(selected.id);
      current.sets.forEach((set, index) => {
        if (!set.done && !set.reps) set.weight = latest?.sets?.[index]?.weight ?? set.weight;
      });
      saveState();
      closeModal();
      renderWorkout();
    };

    modalRoot.querySelectorAll("[data-library-exercise]").forEach(button => {
      button.onclick = () => chooseExercise(button.dataset.libraryExercise);
    });

    document.getElementById("exercise-search").oninput = event => {
      const query = event.target.value.trim().toLowerCase();
      const matches = EXERCISES
        .filter(exercise => {
          const haystack = [
            exercise.name,
            exercise.primary,
            ...(exercise.secondary || []),
            exercise.pattern,
            exercise.equipment
          ].join(" ").toLowerCase();
          return !query || haystack.includes(query);
        })
        .slice(0, 60);

      document.getElementById("exercise-search-results").innerHTML = replacementButtons(matches);
      document.getElementById("search-count").textContent = matches.length;
      document.querySelectorAll("#exercise-search-results [data-library-exercise]").forEach(button => {
        button.onclick = () => chooseExercise(button.dataset.libraryExercise);
      });
    };

    document.getElementById("save-custom-substitute").onclick = () => {
      const name = document.getElementById("custom-substitute").value.trim();
      if (!name) return;
      current.performedExerciseId = `custom:${slugify(name)}`;
      current.performedName = name;
      current.equipment = "Custom";
      saveState();
      closeModal();
      renderWorkout();
    };

    document.getElementById("use-original-exercise").onclick = () => {
      current.performedExerciseId = current.originalExerciseId || slotExerciseId;
      current.performedName = current.originalName || definition.name;
      current.equipment = definition.equipment || "";
      saveState();
      closeModal();
      renderWorkout();
    };
  }

  function recommendedAlternatives(exerciseId) {
    const source = EXERCISE_MAP.get(exerciseId) || libraryMatchForDefinition(getExerciseDefinition(exerciseId));
    if (!source) return EXERCISES.slice(0, 12);

    return EXERCISES
      .filter(exercise => exercise.id !== source.id)
      .map(exercise => {
        let score = 0;
        if (exercise.pattern === source.pattern) score += 8;
        if (exercise.primary === source.primary) score += 6;
        if ((exercise.secondary || []).includes(source.primary)) score += 2;
        if ((source.secondary || []).includes(exercise.primary)) score += 2;
        if (exercise.equipment === source.equipment) score += 1;
        return { exercise, score };
      })
      .filter(item => item.score >= 5)
      .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
      .slice(0, 12)
      .map(item => item.exercise);
  }

  function replacementButtons(exercises) {
    if (!exercises.length) return `<div class="empty-state compact">No exercises found.</div>`;

    return exercises.map(exercise => `
      <button class="replacement-option" data-library-exercise="${exercise.id}" type="button">
        <span>
          <strong>${escapeHtml(exercise.name)}</strong>
          <small>${escapeHtml(exercise.primary)} · ${escapeHtml(exercise.pattern)}</small>
        </span>
        <span class="replacement-equipment">${escapeHtml(exercise.equipment)}</span>
      </button>
    `).join("");
  }

  function libraryMatchForDefinition(definition) {
    if (!definition) return null;
    const normalizedName = String(definition.name || "").toLowerCase();
    return EXERCISES.find(exercise =>
      exercise.id === definition.id ||
      exercise.name.toLowerCase() === normalizedName
    ) || null;
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || makeId("exercise");
  }

  // -------------------------
  // Calendar and activities
  // -------------------------
  function renderCalendar() {
    title.textContent = "Calendar";

    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const monthSessions = state.history.filter(item => {
      const date = dateFromKey(item.date);
      return date.getFullYear() === year && date.getMonth() === month;
    });
    const monthActivities = Object.entries(state.activities).flatMap(([key, items]) => {
      const date = dateFromKey(key);
      return date.getFullYear() === year && date.getMonth() === month ? items : [];
    });

    const totalMinutes = Math.round(
      monthSessions.reduce((sum, item) => sum + (item.durationSeconds || 0), 0) / 60 +
      monthActivities.reduce((sum, item) => sum + (Number(item.duration) || 0), 0)
    );

    const selectedSessions = sessionsForDate(selectedCalendarDate);
    const selectedActivities = activitiesForDate(selectedCalendarDate);
    const selectedDayNote = state.calendarNotes[selectedCalendarDate] || "";

    main.innerHTML = `
      <section class="calendar-card">
        <div class="calendar-toolbar">
          <button class="calendar-arrow" id="calendar-prev" type="button" aria-label="Previous month">←</button>
          <div>
            <p class="kicker">Training calendar</p>
            <h2>${escapeHtml(fmt.monthTitle.format(calendarCursor))}</h2>
          </div>
          <button class="calendar-arrow" id="calendar-next" type="button" aria-label="Next month">→</button>
        </div>

        <div class="calendar-summary">
          <span class="chip">${monthSessions.length} workouts</span>
          <span class="chip">${monthActivities.length} activities</span>
          <span class="chip">${totalMinutes} total min</span>
        </div>

        <div class="calendar-weekdays">
          ${calendarDayNames.map(day => `<span>${day}</span>`).join("")}
        </div>

        <div class="calendar-grid">
          ${calendarDaysHtml(year, month)}
        </div>
      </section>

      <div class="section-heading">
        <h2>${escapeHtml(fmt.fullDate.format(dateFromKey(selectedCalendarDate)))}</h2>
        <span>${selectedSessions.length + selectedActivities.length ? `${selectedSessions.length + selectedActivities.length} logged` : selectedDayNote ? "Note added" : "Nothing logged"}</span>
      </div>

      <section class="calendar-day-note-card">
        <label for="calendar-day-note">
          <span class="calendar-note-title">Day note</span>
          <span class="muted small">Add context that is not tied to a specific workout or activity.</span>
        </label>
        <textarea id="calendar-day-note" class="calendar-day-note-input" placeholder="Energy, recovery, soreness, cycle, travel, or anything else…">${escapeHtml(selectedDayNote)}</textarea>
        <button class="secondary-btn calendar-note-save" id="save-calendar-note" type="button">Save day note</button>
      </section>

      <section class="calendar-activity-actions">
        <button class="primary-btn" id="add-activity" type="button">+ Add activity</button>
      </section>

      ${selectedActivities.length ? `
        <div class="section-heading"><h2>Other activities</h2><span>${selectedActivities.length}</span></div>
        <div class="activity-list">
          ${selectedActivities.map(activityCard).join("")}
        </div>
      ` : ""}

      <div class="section-heading"><h2>Workouts</h2><span>${selectedSessions.length}</span></div>
      <div class="calendar-detail-list">
        ${selectedSessions.length
          ? selectedSessions.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).map(calendarSessionCard).join("")
          : `<div class="empty-state">No programmed workout was logged on this day.</div>`}
      </div>
    `;

    document.getElementById("calendar-prev").onclick = () => moveCalendar(-1);
    document.getElementById("calendar-next").onclick = () => moveCalendar(1);
    document.getElementById("add-activity").onclick = () => openActivityModal(selectedCalendarDate);

    document.getElementById("save-calendar-note").onclick = () => {
      const value = document.getElementById("calendar-day-note").value.trim();
      if (value) state.calendarNotes[selectedCalendarDate] = value;
      else delete state.calendarNotes[selectedCalendarDate];
      saveState();
      showToast(value ? "Day note saved" : "Day note removed");
      renderCalendar();
    };

    main.querySelectorAll("[data-calendar-date]").forEach(button => {
      button.onclick = () => {
        selectedCalendarDate = button.dataset.calendarDate;
        renderCalendar();
      };
    });

    main.querySelectorAll("[data-edit-activity]").forEach(button => {
      button.onclick = () => openActivityModal(selectedCalendarDate, button.dataset.editActivity);
    });
  }

  function calendarDaysHtml(year, month) {
    const firstDay = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const cells = [];

    for (let index = 0; index < offset; index += 1) {
      cells.push(`<span class="calendar-day calendar-day-empty" aria-hidden="true"></span>`);
    }

    for (let day = 1; day <= days; day += 1) {
      const key = dateKey(new Date(year, month, day));
      const sessions = sessionsForDate(key);
      const activities = activitiesForDate(key);
      const hasNote = Boolean(state.calendarNotes[key]?.trim());
      const selected = key === selectedCalendarDate;
      const isToday = key === todayKey();
      const firstRoutine = sessions.length ? getRoutine(sessions[0].routineId) : null;

      cells.push(`
        <button
          class="calendar-day ${sessions.length ? "has-workout" : ""} ${activities.length ? "has-activity" : ""} ${hasNote ? "has-note" : ""} ${selected ? "selected" : ""} ${isToday ? "today" : ""}"
          data-calendar-date="${key}"
          type="button"
        >
          <span class="calendar-date-number">${day}</span>
          ${firstRoutine ? `<span class="calendar-workout-label">${escapeHtml(firstRoutine.shortName || firstRoutine.name)}</span>` : ""}
          ${activities.length ? `<span class="calendar-activity-label">${escapeHtml(activities[0].type)}</span>` : ""}
          ${hasNote ? `<span class="calendar-note-dot" aria-hidden="true"></span>` : ""}
        </button>
      `);
    }

    return cells.join("");
  }

  function moveCalendar(direction) {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + direction, 1);
    const today = new Date();
    selectedCalendarDate =
      calendarCursor.getFullYear() === today.getFullYear() && calendarCursor.getMonth() === today.getMonth()
        ? todayKey()
        : dateKey(calendarCursor);
    renderCalendar();
  }

  function activityCard(activity) {
    return `
      <article class="activity-card">
        <div>
          <p class="kicker">${escapeHtml(activity.type)}</p>
          <h3>${escapeHtml(activity.title || activity.type)}</h3>
          <p class="muted small">${activity.duration ? `${escapeHtml(activity.duration)} min` : "Duration not recorded"}</p>
          ${activity.notes ? `<p class="activity-note">${escapeHtml(activity.notes)}</p>` : ""}
        </div>
        <button class="text-btn" data-edit-activity="${activity.id}" type="button">Edit</button>
      </article>
    `;
  }

  function openActivityModal(key, activityId = null) {
    const existing = activityId ? activitiesForDate(key).find(item => item.id === activityId) : null;

    openModal(`
      <div class="modal-sheet">
        <div class="modal-head">
          <div>
            <p class="kicker">${escapeHtml(fmt.fullDate.format(dateFromKey(key)))}</p>
            <h2>${existing ? "Edit activity" : "Add activity"}</h2>
          </div>
          <button class="modal-close" data-close-modal type="button">×</button>
        </div>

        <label class="form-label" for="activity-type">Activity type</label>
        <select id="activity-type" class="form-input">
          ${activityTypes.map(type => `<option value="${type}" ${existing?.type === type ? "selected" : ""}>${type}</option>`).join("")}
        </select>

        <label class="form-label" for="activity-title">Title</label>
        <input id="activity-title" class="form-input" value="${escapeHtml(existing?.title || "")}" placeholder="Example: Reformer Pilates">

        <label class="form-label" for="activity-duration">Duration in minutes</label>
        <input id="activity-duration" class="form-input" inputmode="numeric" type="number" min="0" step="5" value="${escapeHtml(existing?.duration || "")}" placeholder="45">

        <label class="form-label" for="activity-notes">Notes</label>
        <textarea id="activity-notes" class="form-textarea" placeholder="Intensity, distance, class details, or how it felt…">${escapeHtml(existing?.notes || "")}</textarea>

        <button class="primary-btn" id="save-activity" type="button">${existing ? "Save changes" : "Add activity"}</button>
        ${existing ? `<button class="danger-btn" id="delete-activity" type="button" style="margin-top:10px">Delete activity</button>` : ""}
      </div>
    `);

    document.getElementById("save-activity").onclick = () => {
      const type = document.getElementById("activity-type").value;
      const titleValue = document.getElementById("activity-title").value.trim();
      const activity = {
        id: existing?.id || makeId("activity"),
        type,
        title: titleValue || type,
        duration: document.getElementById("activity-duration").value,
        notes: document.getElementById("activity-notes").value.trim()
      };

      if (!state.activities[key]) state.activities[key] = [];
      if (existing) {
        const index = state.activities[key].findIndex(item => item.id === existing.id);
        state.activities[key][index] = activity;
      } else {
        state.activities[key].push(activity);
      }

      saveState();
      closeModal();
      selectedCalendarDate = key;
      currentView = "calendar";
      renderCalendar();
      showToast(existing ? "Activity updated" : "Activity added");
    };

    if (existing) {
      document.getElementById("delete-activity").onclick = () => {
        if (!confirm("Delete this activity?")) return;
        state.activities[key] = state.activities[key].filter(item => item.id !== existing.id);
        if (!state.activities[key].length) delete state.activities[key];
        saveState();
        closeModal();
        renderCalendar();
        showToast("Activity deleted");
      };
    }
  }

  function calendarSessionCard(item) {
    const routine = getRoutine(item.routineId);
    const minutes = Math.max(1, Math.round((item.durationSeconds || 0) / 60));

    return `
      <article class="calendar-session-card">
        <div class="calendar-session-head">
          <div>
            <p class="kicker">${escapeHtml(item.routineFocus || routine?.focus || "Workout")}</p>
            <h3>${escapeHtml(item.routineName || routine?.name || "Workout")}</h3>
          </div>
          <span class="chip">${minutes} min</span>
        </div>

        <div class="calendar-exercise-list">
          ${Object.entries(item.exercises || {}).map(([slotId, exerciseState]) => {
            const performedId = exerciseState.performedExerciseId || exerciseState.originalExerciseId || slotId;
            return `
              <button class="calendar-exercise calendar-exercise-button" data-history-exercise="${escapeHtml(performedId)}" type="button">
                <strong>${escapeHtml(exerciseState.performedName || exerciseState.originalName)}</strong>
                ${exerciseState.performedName !== exerciseState.originalName ? `<span class="muted small">Instead of ${escapeHtml(exerciseState.originalName)}</span>` : ""}
                <div class="calendar-set-summary">${formatPreviousSets(exerciseState.sets)}</div>
                ${exerciseState.notes ? `<p class="calendar-note"><strong>Note:</strong> ${escapeHtml(exerciseState.notes)}</p>` : ""}
              </button>
            `;
          }).join("")}
        </div>

        ${item.notes ? `<p class="session-note"><strong>Workout note:</strong> ${escapeHtml(item.notes)}</p>` : ""}
      </article>
    `;
  }

  // -------------------------
  // Progress and exercise history
  // -------------------------
  function renderProgress() {
    title.textContent = "Progress";

    const current = weekStats(0);
    const previous = weekStats(-1);
    const sessionDiff = current.sessions - previous.sessions;
    const setDiff = current.sets - previous.sets;

    main.innerHTML = `
      <section class="weekly-summary-card">
        <p class="kicker">This week</p>
        <h2>${escapeHtml(fmt.monthDay.format(current.start))} – ${escapeHtml(fmt.monthDay.format(current.end))}</h2>

        <div class="summary-grid">
          ${summaryMetric(current.sessions, "Workouts", comparisonText(sessionDiff))}
          ${summaryMetric(current.sets, "Working sets", comparisonText(setDiff))}
          ${summaryMetric(current.minutes, "Minutes", comparisonText(current.minutes - previous.minutes))}
          ${summaryMetric(current.activities, "Other activities", comparisonText(current.activities - previous.activities))}
        </div>

        <div class="muscle-summary">
          <strong>Areas trained</strong>
          <p>${current.focuses.length ? escapeHtml(current.focuses.join(" · ")) : "Nothing logged yet this week."}</p>
        </div>
      </section>

      <div class="section-heading"><h2>Exercise progress</h2><span>Tap an exercise</span></div>
      <div class="exercise-progress-grid">
        ${allProgramExercises().map(exercise => {
          const records = exerciseRecords(exercise.id);
          return `
            <button class="progress-exercise-card" data-history-exercise="${exercise.id}" type="button">
              <span>
                <strong>${escapeHtml(exercise.name)}</strong>
                <small>${records.length} logged session${records.length === 1 ? "" : "s"}</small>
              </span>
              <span>↗</span>
            </button>
          `;
        }).join("")}
      </div>

      <div class="section-heading"><h2>Recent workouts</h2><span>Newest first</span></div>
      <div class="history-list">
        ${state.history.length
          ? [...state.history].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).map(historyCard).join("")
          : `<div class="empty-state">You have not saved any workouts yet.</div>`}
      </div>
    `;

    wireExerciseHistoryButtons();
  }

  function summaryMetric(value, label, comparison) {
    return `
      <div class="summary-metric">
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(label)}</span>
        <small>${escapeHtml(comparison)}</small>
      </div>
    `;
  }

  function comparisonText(diff) {
    if (diff === 0) return "same as last week";
    return `${diff > 0 ? "+" : ""}${diff} vs last week`;
  }

  function weekStats(offsetWeeks) {
    const start = startOfWeek(new Date(), offsetWeeks);
    const endExclusive = new Date(start);
    endExclusive.setDate(start.getDate() + 7);
    const end = new Date(endExclusive);
    end.setDate(endExclusive.getDate() - 1);

    const sessions = state.history.filter(item => {
      const date = dateFromKey(item.date);
      return date >= start && date < endExclusive;
    });

    const activityItems = Object.entries(state.activities).flatMap(([key, items]) => {
      const date = dateFromKey(key);
      return date >= start && date < endExclusive ? items : [];
    });

    const sets = sessions.reduce((sum, session) => sum + countCompletedSets(session), 0);
    const minutes = Math.round(
      sessions.reduce((sum, session) => sum + (session.durationSeconds || 0), 0) / 60 +
      activityItems.reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0)
    );

    const focuses = [...new Set(sessions
      .map(session => session.routineFocus || getRoutine(session.routineId)?.focus || "")
      .flatMap(value => value.split("·").map(item => item.trim()).filter(Boolean))
    )];

    return {
      start,
      end,
      sessions: sessions.length,
      activities: activityItems.length,
      sets,
      minutes,
      focuses
    };
  }

  function historyCard(item) {
    const routine = getRoutine(item.routineId);
    const totalSets = countCompletedSets(item);
    const minutes = Math.max(1, Math.round((item.durationSeconds || 0) / 60));
    const maxWeight = getSessionMaxWeight(item);

    return `
      <article class="history-card">
        <div class="history-card-top">
          <div>
            <p class="kicker">${escapeHtml(fmt.dateTime.format(new Date(item.completedAt)))}</p>
            <h3>${escapeHtml(item.routineName || routine?.name || "Workout")}</h3>
            <p class="muted small">${escapeHtml(item.routineFocus || routine?.focus || "")}</p>
          </div>
          <div class="routine-number">✓</div>
        </div>

        <div class="history-meta">
          <span class="chip">${totalSets} sets</span>
          <span class="chip">${minutes} min</span>
          ${maxWeight ? `<span class="chip">Max ${maxWeight} kg</span>` : ""}
        </div>

        ${item.notes ? `<p class="last-performance">${escapeHtml(item.notes)}</p>` : ""}
      </article>
    `;
  }

  function getSessionMaxWeight(item) {
    let max = 0;
    Object.values(item.exercises || {}).forEach(exercise => {
      (exercise.sets || []).forEach(set => {
        max = Math.max(max, Number(set.weight) || 0);
      });
    });
    return max;
  }

  function wireExerciseHistoryButtons() {
    main.querySelectorAll("[data-history-exercise]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        selectedExerciseId = button.dataset.historyExercise;
        setView("exerciseHistory");
      });
    });
  }

  function exerciseRecords(exerciseId) {
    const records = [];

    state.history.forEach(session => {
      Object.entries(session.exercises || {}).forEach(([slotId, exerciseState]) => {
        const performedId = exerciseState.performedExerciseId || exerciseState.originalExerciseId || slotId;
        if (performedId !== exerciseId) return;

        const completedSets = (exerciseState.sets || []).filter(set => set.done || set.weight || set.reps || set.rir !== "");
        const weightedSets = completedSets.filter(set => Number(set.weight) > 0 && Number(set.reps) > 0);
        const maxWeight = weightedSets.length ? Math.max(...weightedSets.map(set => Number(set.weight))) : 0;
        const volume = weightedSets.reduce((sum, set) => sum + Number(set.weight) * Number(set.reps), 0);
        const rirValues = completedSets
          .filter(set => set.rir !== "" && set.rir != null)
          .map(set => Number(set.rir));
        const avgRir = rirValues.length
          ? rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length
          : null;

        let bestSet = null;
        let bestScore = -Infinity;
        weightedSets.forEach(set => {
          const score = Number(set.weight) * (1 + Number(set.reps) / 30);
          if (score > bestScore) {
            bestScore = score;
            bestSet = set;
          }
        });

        records.push({
          session,
          exercise: exerciseState,
          completedSets,
          maxWeight,
          volume,
          avgRir,
          bestSet
        });
      });
    });

    return records.sort((a, b) => (a.session.completedAt || 0) - (b.session.completedAt || 0));
  }

  function renderExerciseHistory() {
    const definition = getExerciseDefinition(selectedExerciseId);
    const records = exerciseRecords(selectedExerciseId);
    const fallbackName = records.at(-1)?.exercise?.originalName || "Exercise";
    const name = definition?.name || fallbackName;

    title.textContent = "Exercise Progress";

    const allSets = records.flatMap(record => record.completedSets.map(set => ({ set, record })));
    const weightedSets = allSets.filter(item => Number(item.set.weight) > 0 && Number(item.set.reps) > 0);
    const heaviest = weightedSets.length ? Math.max(...weightedSets.map(item => Number(item.set.weight))) : 0;

    let bestSet = null;
    let bestSetScore = -Infinity;
    weightedSets.forEach(item => {
      const score = Number(item.set.weight) * (1 + Number(item.set.reps) / 30);
      if (score > bestSetScore) {
        bestSetScore = score;
        bestSet = item.set;
      }
    });

    const bestVolumeRecord = records.length
      ? [...records].sort((a, b) => b.volume - a.volume)[0]
      : null;

    main.innerHTML = `
      <button class="back-btn" id="back-progress" type="button">← Back to Progress</button>

      <section class="exercise-history-hero">
        <p class="kicker">Exercise history</p>
        <h2>${escapeHtml(name)}</h2>
        <p class="muted">${records.length} logged session${records.length === 1 ? "" : "s"}</p>

        <div class="pr-grid">
          ${prCard(heaviest ? `${heaviest} kg` : "—", "Heaviest load")}
          ${prCard(bestSet ? `${bestSet.weight} kg × ${bestSet.reps}` : "—", "Best set")}
          ${prCard(bestVolumeRecord?.volume ? `${Math.round(bestVolumeRecord.volume)} kg` : "—", "Best session volume")}
        </div>
      </section>

      ${records.length ? `
        <section class="chart-card">
          <div class="chart-head">
            <div><p class="kicker">Load trend</p><h3>Heaviest set by session</h3></div>
          </div>
          ${exerciseChart(records)}
        </section>

        <div class="section-heading"><h2>Session history</h2><span>Oldest to newest</span></div>
        <div class="exercise-record-list">
          ${records.map(record => exerciseRecordCard(record)).join("")}
        </div>
      ` : `<div class="empty-state">Complete this exercise once to begin tracking progress.</div>`}
    `;

    document.getElementById("back-progress").onclick = () => setView("history");
  }

  function prCard(value, label) {
    return `
      <div class="pr-card">
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }

  function exerciseChart(records) {
    const values = records.map(record => record.maxWeight).filter(value => value > 0);
    if (!values.length) {
      return `<div class="empty-chart">Add weight values to see a progress chart.</div>`;
    }

    const width = 340;
    const height = 130;
    const padX = 18;
    const padY = 18;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const points = records.map((record, index) => {
      const value = record.maxWeight || min;
      const x = records.length === 1 ? width / 2 : padX + index * ((width - padX * 2) / (records.length - 1));
      const y = height - padY - ((value - min) / range) * (height - padY * 2);
      return { x, y, value };
    });

    return `
      <svg class="progress-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Exercise weight progress">
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" class="chart-axis"></line>
        <polyline points="${points.map(point => `${point.x},${point.y}`).join(" ")}" class="chart-line"></polyline>
        ${points.map(point => `
          <circle cx="${point.x}" cy="${point.y}" r="4.5" class="chart-dot"></circle>
          <text x="${point.x}" y="${Math.max(12, point.y - 9)}" text-anchor="middle" class="chart-label">${point.value}</text>
        `).join("")}
      </svg>
      <div class="chart-range">
        <span>${escapeHtml(fmt.short.format(new Date(records[0].session.completedAt)))}</span>
        <span>${escapeHtml(fmt.short.format(new Date(records.at(-1).session.completedAt)))}</span>
      </div>
    `;
  }

  function exerciseRecordCard(record) {
    return `
      <article class="exercise-record-card">
        <div class="record-head">
          <div>
            <p class="kicker">${escapeHtml(fmt.fullDate.format(dateFromKey(record.session.date)))}</p>
            <h3>${escapeHtml(record.exercise.performedName || record.exercise.originalName)}</h3>
            ${record.exercise.performedName !== record.exercise.originalName ? `<p class="muted small">Instead of ${escapeHtml(record.exercise.originalName)}</p>` : ""}
          </div>
          ${record.volume ? `<span class="chip">${Math.round(record.volume)} kg volume</span>` : ""}
        </div>

        <div class="last-set-list">${formatPreviousSets(record.exercise.sets)}</div>
        ${record.avgRir != null ? `<p class="record-stat">Average RIR: <strong>${record.avgRir.toFixed(1)}</strong></p>` : ""}
        ${record.exercise.notes ? `<p class="last-exercise-note"><strong>Note:</strong> ${escapeHtml(record.exercise.notes)}</p>` : ""}
      </article>
    `;
  }

  function renderCoach() {
    title.textContent = "Coach";

    const analysis = analyzeProgram();
    const defaultQuestion = "What am I prioritizing, which muscles am I training, and what would you change in my routine?";

    main.innerHTML = `
      <section class="coach-hero">
        <p class="kicker">Local program analysis</p>
        <h2>Your routine at a glance</h2>
        <p class="muted">This section analyzes the exercises and weekly volume saved in the app. It works offline and does not send your workout data anywhere.</p>
      </section>

      <div class="coach-grid">
        <article class="coach-card">
          <p class="kicker">Top priorities</p>
          <h3>${escapeHtml(analysis.topMuscles.slice(0, 3).map(item => item.name).join(" · ") || "Not enough exercise data")}</h3>
          <p>${escapeHtml(analysis.prioritySummary)}</p>
        </article>

        <article class="coach-card">
          <p class="kicker">Movement balance</p>
          <h3>${analysis.patternCount} movement patterns</h3>
          <p>${escapeHtml(analysis.patternSummary)}</p>
        </article>

        <article class="coach-card">
          <p class="kicker">Weekly workload</p>
          <h3>${analysis.totalSets} programmed sets</h3>
          <p>${escapeHtml(analysis.workloadSummary)}</p>
        </article>

        <article class="coach-card">
          <p class="kicker">Potential blind spot</p>
          <h3>${escapeHtml(analysis.blindSpotTitle)}</h3>
          <p>${escapeHtml(analysis.blindSpotText)}</p>
        </article>
      </div>

      <div class="section-heading"><h2>Muscle coverage</h2><span>Programmed sets</span></div>
      <section class="coach-volume-card">
        ${analysis.topMuscles.map(item => `
          <div class="muscle-volume-row">
            <span>${escapeHtml(item.name)}</span>
            <div class="muscle-volume-track"><span style="width:${Math.max(5, Math.round(item.sets / analysis.maxSets * 100))}%"></span></div>
            <strong>${Number.isInteger(item.sets) ? item.sets : item.sets.toFixed(1)}</strong>
          </div>
        `).join("")}
      </section>

      <div class="section-heading"><h2>Ask AI</h2><span>Uses ChatGPT</span></div>
      <section class="coach-ask-card">
        <p class="muted small">Write a question. The app will copy a structured summary of your routine and recent training, then open ChatGPT for you to paste it.</p>

        <div class="coach-question-chips">
          ${[
            "What am I prioritizing?",
            "Which muscles am I training?",
            "Is my routine balanced?",
            "What would you change for body recomposition?"
          ].map(question => `<button class="text-btn" data-coach-question="${escapeHtml(question)}" type="button">${escapeHtml(question)}</button>`).join("")}
        </div>

        <textarea id="coach-question" class="coach-question-input" placeholder="Ask about your routine, exercise selection, muscles worked, or priorities…">${escapeHtml(defaultQuestion)}</textarea>
        <button class="primary-btn" id="ask-chatgpt" type="button">Copy context & open ChatGPT</button>
      </section>
    `;

    main.querySelectorAll("[data-coach-question]").forEach(button => {
      button.onclick = () => {
        document.getElementById("coach-question").value = button.dataset.coachQuestion;
      };
    });

    document.getElementById("ask-chatgpt").onclick = async () => {
      const question = document.getElementById("coach-question").value.trim() || defaultQuestion;
      const prompt = buildCoachPrompt(question);

      try {
        await navigator.clipboard.writeText(prompt);
        showToast("Routine context copied");
      } catch {
        window.prompt("Copy this prompt, then paste it into ChatGPT:", prompt);
      }

      window.open("https://chatgpt.com/", "_blank", "noopener");
    };
  }

  function analyzeProgram() {
    const muscleSets = new Map();
    const patterns = new Set();
    let totalSets = 0;
    let unmatched = 0;

    state.program.cycle.forEach(routineId => {
      getRoutine(routineId)?.exercises.forEach(exercise => {
        totalSets += Number(exercise.sets) || 0;
        const meta = EXERCISE_MAP.get(exercise.id) || libraryMatchForDefinition(exercise);

        if (!meta) {
          unmatched += 1;
          return;
        }

        patterns.add(meta.pattern);
        muscleSets.set(meta.primary, (muscleSets.get(meta.primary) || 0) + Number(exercise.sets || 0));
        (meta.secondary || []).forEach(muscle => {
          muscleSets.set(muscle, (muscleSets.get(muscle) || 0) + Number(exercise.sets || 0) * 0.5);
        });
      });
    });

    const topMuscles = [...muscleSets.entries()]
      .map(([name, sets]) => ({ name, sets }))
      .sort((a, b) => b.sets - a.sets);

    const maxSets = Math.max(1, ...topMuscles.map(item => item.sets));
    const lowest = topMuscles.filter(item => item.sets > 0).slice(-3).map(item => item.name);
    const highest = topMuscles.slice(0, 3).map(item => item.name);

    return {
      totalSets,
      topMuscles,
      maxSets,
      patternCount: patterns.size,
      prioritySummary: highest.length
        ? `Your highest programmed volume currently goes to ${highest.join(", ")}.`
        : "Add muscle tags through exercises from the library to improve this analysis.",
      patternSummary: patterns.size >= 8
        ? "Your routine covers a broad mix of pushes, pulls, squats, hinges, unilateral work, and isolation."
        : "Your routine is relatively concentrated. Consider whether you want more movement variety or prefer deliberate specialization.",
      workloadSummary: totalSets >= 50
        ? "This is a fairly high-volume four-day plan, so recovery and consistent RIR tracking matter."
        : totalSets >= 35
          ? "This is a moderate weekly workload that should be manageable if sets are taken close to the intended effort."
          : "This is a lower-volume plan. Progress will depend heavily on exercise quality and progressive overload.",
      blindSpotTitle: unmatched
        ? `${unmatched} custom exercise${unmatched === 1 ? "" : "s"} not classified`
        : lowest[0] || "No obvious gap",
      blindSpotText: unmatched
        ? "Custom exercises are still tracked, but the local muscle analysis cannot classify them until they match an exercise in the library."
        : lowest.length
          ? `${lowest.join(", ")} receive less programmed volume than your main priorities. That may be intentional rather than a problem.`
          : "The routine has enough classified exercise data for a basic balance check."
    };
  }

  function buildCoachPrompt(question) {
    const routineSummary = state.program.cycle.map(routineId => {
      const routine = getRoutine(routineId);
      return `${routine.name} (${routine.focus}): ` + routine.exercises
        .map(exercise => `${exercise.name} — ${exercise.sets} sets of ${exercise.reps}, ${exercise.rest}s rest`)
        .join("; ");
    }).join("\n");

    const recent = [...state.history]
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, 4)
      .map(session => {
        const exercises = Object.values(session.exercises || {})
          .map(exercise => {
            const sets = (exercise.sets || [])
              .filter(set => set.done || set.weight || set.reps || set.rir !== "")
              .map(set => `${set.weight || "—"}kg x ${set.reps || "—"} @ RIR ${set.rir === "" ? "—" : set.rir}`)
              .join(", ");
            return `${exercise.performedName}: ${sets}${exercise.notes ? ` | note: ${exercise.notes}` : ""}`;
          })
          .join("; ");
        return `${session.date} — ${session.routineName}: ${exercises}`;
      })
      .join("\n");

    return `Act as an evidence-informed strength coach focused on body recomposition. Be practical and do not overstate certainty.

My current routine:
${routineSummary}

My most recent logged sessions:
${recent || "No sessions logged yet."}

My question:
${question}

Please answer using my actual exercise selection and volume. Explain which muscles and movement patterns are being prioritized, mention any relevant trade-offs, and give only actionable changes that are justified.`;
  }

  // -------------------------
  // Settings and program editor
  // -------------------------
  function renderSettings() {
    title.textContent = "Settings";
    const dates = weekDates(0);
    const routineOptions = [
      `<option value="rest">Rest</option>`,
      ...state.program.cycle.map(routineId => `<option value="${routineId}">${escapeHtml(getRoutine(routineId)?.name || "Workout")}</option>`)
    ].join("");

    main.innerHTML = `
      <section class="panel">
        <p class="kicker">Experience</p>
        ${settingToggle("travel-setting", "Travel mode", "Show travel-friendly alternatives when a workout starts.", state.settings.travelMode)}
        ${settingToggle("sound-setting", "Timer sound", "Play a short chime when your rest period ends.", state.settings.sound)}
        ${settingToggle("vibration-setting", "Vibration", "Vibrate when the browser and device allow it.", state.settings.vibration)}
        <button class="secondary-btn" id="test-sound" type="button" style="margin-top:12px">Enable & test timer sound</button>
        <p class="muted small sound-help">Tap once after opening the app. This gives the browser permission to play the timer chime.</p>
      </section>

      <div class="section-heading"><h2>This week</h2><span>${escapeHtml(fmt.monthDay.format(dates[0]))} – ${escapeHtml(fmt.monthDay.format(dates[6]))}</span></div>
      <section class="panel">
        <p class="muted small">Schedule the workout you intend to complete on each date. Today uses this plan automatically.</p>
        <div class="week-plan-grid">
          ${dates.map(date => {
            const key = dateKey(date);
            return `
              <label class="week-plan-row ${key === todayKey() ? "is-today" : ""}">
                <span class="week-plan-date">
                  <strong>${escapeHtml(dayNames[date.getDay()])}</strong>
                  <small>${escapeHtml(fmt.monthDay.format(date))}</small>
                </span>
                <select data-schedule-date="${key}">
                  ${routineOptions}
                </select>
              </label>
            `;
          }).join("")}
        </div>
      </section>

      <div class="section-heading"><h2>Program editor</h2><span>No GitHub editing needed</span></div>
      <section class="panel">
        <p class="muted small">Change workout names, sets, rep ranges, rest times, exercise order, or add and remove exercises.</p>
        <div class="program-editor-list">
          ${state.program.cycle.map(routineId => {
            const routine = getRoutine(routineId);
            return `
              <button class="program-editor-row" data-edit-routine="${routineId}" type="button">
                <span><strong>${escapeHtml(routine.name)}</strong><small>${routine.exercises.length} exercises</small></span>
                <span>›</span>
              </button>
            `;
          }).join("")}
        </div>
        <button class="danger-btn" id="reset-program" type="button" style="margin-top:12px">Reset program to default</button>
      </section>

      <div class="section-heading"><h2>Data</h2><span>Stored on this device</span></div>
      <section class="panel">
        <div class="inline-actions">
          <button class="secondary-btn" id="export-data" type="button">Export backup</button>
          <button class="secondary-btn" id="import-data" type="button">Import backup</button>
        </div>
        <button class="danger-btn" id="clear-data" type="button" style="margin-top:10px">Delete all app data</button>
      </section>

      <section class="panel" style="margin-top:14px">
        <p class="kicker">Recomp Studio+ 2.0</p>
        <p class="muted small">Today + Tomorrow · exercise library · safer sound setup · Coach tab · editable routines · PRs · RIR and notes.</p>
      </section>
    `;

    document.getElementById("test-sound").onclick = async () => {
      await ensureAudioReady(true);
      playBeep();
      showToast("Sound test played");
    };

    document.getElementById("travel-setting").onchange = event => updateSetting("travelMode", event.target.checked);
    document.getElementById("sound-setting").onchange = event => updateSetting("sound", event.target.checked);
    document.getElementById("vibration-setting").onchange = event => updateSetting("vibration", event.target.checked);

    main.querySelectorAll("[data-schedule-date]").forEach(select => {
      const key = select.dataset.scheduleDate;
      select.value = getScheduledItem(dateFromKey(key));
      select.onchange = event => {
        state.settings.weekPlan[key] = event.target.value;
        saveState();
        showToast("Weekly plan updated");
      };
    });

    main.querySelectorAll("[data-edit-routine]").forEach(button => {
      button.onclick = () => openRoutineEditor(button.dataset.editRoutine);
    });

    document.getElementById("reset-program").onclick = resetProgram;
    document.getElementById("export-data").onclick = exportData;
    document.getElementById("import-data").onclick = () => importInput.click();
    document.getElementById("clear-data").onclick = clearData;
  }

  function settingToggle(id, label, detail, checked) {
    return `
      <div class="setting-row">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <p class="muted small" style="margin:4px 0 0">${escapeHtml(detail)}</p>
        </div>
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

  function openRoutineEditor(routineId) {
    editorRoutineId = routineId;
    editorDraft = structuredClone(getRoutine(routineId));
    setView("routineEditor");
  }

  function renderRoutineEditor() {
    if (!editorDraft) {
      setView("settings");
      return;
    }

    title.textContent = "Edit Routine";

    main.innerHTML = `
      <button class="back-btn" id="back-settings" type="button">← Back to Settings</button>

      <section class="panel editor-routine-meta">
        <p class="kicker">Routine details</p>

        <label class="form-label" for="routine-name">Workout name</label>
        <input id="routine-name" class="form-input" value="${escapeHtml(editorDraft.name)}">

        <label class="form-label" for="routine-short-name">Calendar label</label>
        <input id="routine-short-name" class="form-input" value="${escapeHtml(editorDraft.shortName)}" maxlength="12">

        <label class="form-label" for="routine-focus">Focus</label>
        <input id="routine-focus" class="form-input" value="${escapeHtml(editorDraft.focus)}">

        <label class="form-label" for="routine-minutes">Estimated minutes</label>
        <input id="routine-minutes" class="form-input" type="number" min="1" step="1" value="${escapeHtml(editorDraft.estimatedMinutes)}">
      </section>

      <div class="section-heading"><h2>Exercises</h2><span>${editorDraft.exercises.length}</span></div>
      <div id="editor-exercise-list" class="editor-exercise-list">
        ${editorDraft.exercises.map((exercise, index) => editorExerciseCard(exercise, index)).join("")}
      </div>

      <button class="secondary-btn" id="add-editor-exercise" type="button">+ Add exercise</button>

      <section class="editor-save-bar">
        <button class="primary-btn" id="save-routine" type="button">Save routine</button>
      </section>
    `;

    document.getElementById("back-settings").onclick = () => setView("settings");
    document.getElementById("routine-name").oninput = event => editorDraft.name = event.target.value;
    document.getElementById("routine-short-name").oninput = event => editorDraft.shortName = event.target.value;
    document.getElementById("routine-focus").oninput = event => editorDraft.focus = event.target.value;
    document.getElementById("routine-minutes").oninput = event => editorDraft.estimatedMinutes = Number(event.target.value) || 45;

    wireEditorExerciseControls();

    document.getElementById("add-editor-exercise").onclick = () => {
      editorDraft.exercises.push(normalizeExercise({
        id: makeId("exercise"),
        name: "New Exercise",
        equipment: "",
        sets: 3,
        reps: "8–12",
        targetMin: 8,
        targetMax: 12,
        rest: 60,
        travel: ""
      }));
      renderRoutineEditor();
    };

    document.getElementById("save-routine").onclick = () => {
      editorDraft.name = editorDraft.name.trim() || "Workout";
      editorDraft.shortName = editorDraft.shortName.trim() || editorDraft.name.slice(0, 10);
      editorDraft.focus = editorDraft.focus.trim();
      editorDraft.exercises = editorDraft.exercises.map(normalizeExercise);
      state.program.routines[editorRoutineId] = structuredClone(editorDraft);
      saveState();
      showToast("Routine saved");
      setView("settings");
    };
  }

  function editorExerciseCard(exercise, index) {
    return `
      <article class="editor-exercise-card" data-editor-index="${index}">
        <div class="editor-card-head">
          <span class="exercise-index">${index + 1}</span>
          <div class="editor-order-actions">
            <button class="mini-btn" data-editor-up="${index}" type="button" ${index === 0 ? "disabled" : ""}>↑</button>
            <button class="mini-btn" data-editor-down="${index}" type="button" ${index === editorDraft.exercises.length - 1 ? "disabled" : ""}>↓</button>
            <button class="mini-btn danger-mini" data-editor-delete="${index}" type="button">Delete</button>
          </div>
        </div>

        <label class="form-label">Exercise name</label>
        <input class="form-input" data-editor-field="name" data-editor-index="${index}" value="${escapeHtml(exercise.name)}">

        <label class="form-label">Equipment or setup</label>
        <input class="form-input" data-editor-field="equipment" data-editor-index="${index}" value="${escapeHtml(exercise.equipment)}">

        <div class="editor-grid-three">
          <label><span>Sets</span><input class="form-input" type="number" min="1" data-editor-field="sets" data-editor-index="${index}" value="${exercise.sets}"></label>
          <label><span>Min reps</span><input class="form-input" type="number" min="1" data-editor-field="targetMin" data-editor-index="${index}" value="${exercise.targetMin}"></label>
          <label><span>Max reps</span><input class="form-input" type="number" min="1" data-editor-field="targetMax" data-editor-index="${index}" value="${exercise.targetMax}"></label>
        </div>

        <div class="editor-grid-two">
          <label><span>Rest seconds</span><input class="form-input" type="number" min="0" step="15" data-editor-field="rest" data-editor-index="${index}" value="${exercise.rest}"></label>
          <label><span>Group / superset</span><input class="form-input" data-editor-field="group" data-editor-index="${index}" value="${escapeHtml(exercise.group || "")}" placeholder="Optional"></label>
        </div>

        <label class="form-label">Travel or substitute suggestion</label>
        <input class="form-input" data-editor-field="travel" data-editor-index="${index}" value="${escapeHtml(exercise.travel || "")}">
      </article>
    `;
  }

  function wireEditorExerciseControls() {
    main.querySelectorAll("[data-editor-field]").forEach(input => {
      input.oninput = event => {
        const index = Number(event.target.dataset.editorIndex);
        const field = event.target.dataset.editorField;
        const numeric = ["sets", "targetMin", "targetMax", "rest"].includes(field);
        editorDraft.exercises[index][field] = numeric ? Number(event.target.value) : event.target.value;

        if (["targetMin", "targetMax"].includes(field)) {
          const exercise = editorDraft.exercises[index];
          exercise.reps = exercise.targetMin === exercise.targetMax
            ? String(exercise.targetMin)
            : `${exercise.targetMin}–${exercise.targetMax}`;
        }
      };
    });

    main.querySelectorAll("[data-editor-up]").forEach(button => {
      button.onclick = () => moveEditorExercise(Number(button.dataset.editorUp), -1);
    });

    main.querySelectorAll("[data-editor-down]").forEach(button => {
      button.onclick = () => moveEditorExercise(Number(button.dataset.editorDown), 1);
    });

    main.querySelectorAll("[data-editor-delete]").forEach(button => {
      button.onclick = () => {
        const index = Number(button.dataset.editorDelete);
        if (!confirm(`Delete ${editorDraft.exercises[index].name}?`)) return;
        editorDraft.exercises.splice(index, 1);
        renderRoutineEditor();
      };
    });
  }

  function moveEditorExercise(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= editorDraft.exercises.length) return;
    const [exercise] = editorDraft.exercises.splice(index, 1);
    editorDraft.exercises.splice(target, 0, exercise);
    renderRoutineEditor();
  }

  function resetProgram() {
    if (!confirm("Reset every routine and exercise to the original program? Your workout history will remain.")) return;
    state.program = {
      cycle: [...BASE.cycle],
      routines: structuredClone(BASE.routines)
    };
    saveState();
    showToast("Program reset");
    renderSettings();
  }

  // -------------------------
  // Data
  // -------------------------
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recomp-studio-plus-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  importInput.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.history)) throw new Error("Invalid backup");
      state = normalizeState(parsed);
      saveState();
      showToast("Backup imported");
      render();
    } catch {
      alert("The file could not be imported. Make sure it is a Recomp Studio backup.");
    } finally {
      event.target.value = "";
    }
  });

  function clearData() {
    if (!confirm("Delete all workouts, activities, notes, settings, and program edits? This cannot be undone.")) return;
    state = structuredClone(defaultState);
    saveState();
    stopTimer();
    showToast("All app data deleted");
    setView("today");
  }

  // -------------------------
  // Timer
  // -------------------------
  function startTimer(seconds) {
    clearInterval(timer.interval);
    timer.duration = seconds;
    timer.remaining = seconds;
    timer.running = true;
    timer.endAt = Date.now() + seconds * 1000;
    timerPanel.classList.remove("hidden");
    timerPause.textContent = "Pause";
    updateTimerUI();
    timer.interval = setInterval(tickTimer, 250);
  }

  function tickTimer() {
    if (!timer.running) return;
    timer.remaining = Math.max(0, (timer.endAt - Date.now()) / 1000);
    updateTimerUI();
    if (timer.remaining <= 0) completeTimer();
  }

  function adjustTimer(seconds) {
    timer.remaining = Math.max(0, timer.remaining + seconds);
    if (timer.running) timer.endAt = Date.now() + timer.remaining * 1000;
    updateTimerUI();
    if (timer.remaining <= 0) completeTimer();
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
      if (!audioContext || audioContext.state !== "running") return;

      const now = audioContext.currentTime;
      const master = audioContext.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
      master.connect(audioContext.destination);

      [
        { frequency: 659.25, start: 0, duration: 0.24 },
        { frequency: 880, start: 0.28, duration: 0.34 }
      ].forEach(tone => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = tone.frequency;
        gain.gain.setValueAtTime(0.0001, now + tone.start);
        gain.gain.exponentialRampToValueAtTime(0.9, now + tone.start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);
        oscillator.connect(gain).connect(master);
        oscillator.start(now + tone.start);
        oscillator.stop(now + tone.start + tone.duration + 0.03);
      });
    } catch {}
  }

  async function ensureAudioReady(force = false) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;

      if (!audioContext) audioContext = new AudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();

      if ((force || !audioUnlocked) && audioContext.state === "running") {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        gain.gain.value = 0.00001;
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.02);
      }

      audioUnlocked = audioContext.state === "running";
      return audioUnlocked;
    } catch {
      return false;
    }
  }

  function closeModal() {
    modalRoot.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function wireStartButtons() {
    main.querySelectorAll("[data-start]").forEach(button => {
      button.onclick = () => startRoutine(button.dataset.start);
    });
  }

  travelPill.onclick = () => {
    state.settings.travelMode = !state.settings.travelMode;
    saveState();
    render();
  };

  document.querySelectorAll(".nav-item").forEach(button => {
    button.onclick = () => setView(button.dataset.view);
  });

  document.addEventListener("pointerdown", () => {
    ensureAudioReady();
  }, { once: true });

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
