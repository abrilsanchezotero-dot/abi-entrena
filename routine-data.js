window.ROUTINE_DATA = {
  appName: "Abi Entrena",
  cycle: ["lowerA", "upperA", "lowerB", "upperB"],
  defaultSchedule: {
    "0": "rest",
    "1": "lowerA",
    "2": "upperA",
    "3": "rest",
    "4": "lowerB",
    "5": "upperB",
    "6": "rest"
  },
  recovery: {
    title: "Recuperación activa",
    estimatedMinutes: 25,
    items: [
      "Caminata suave de 20–30 minutos.",
      "Movilidad de cadera, hombros y columna durante 5–10 minutos.",
      "Hidratación, proteína suficiente y sueño.",
      "No hace falta compensar una sesión perdida: usá “Siguiente entrenamiento”."
    ]
  },
  routines: {
    lowerA: {
      name: "Inferior A",
      focus: "Glúteos · posterior · cuádriceps",
      estimatedMinutes: 55,
      exercises: [
        {
          id: "hip-thrust-machine-a",
          name: "Impulso de Cadera",
          equipment: "Máquina",
          sets: 4,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 120,
          travel: "Hip thrust con mancuerna o glute bridge en el piso"
        },
        {
          id: "rdl-dumbbell",
          name: "Peso Muerto Rumano",
          equipment: "Mancuernas",
          sets: 3,
          reps: "12",
          targetMin: 12,
          targetMax: 12,
          rest: 90,
          travel: "Peso muerto rumano con mancuernas"
        },
        {
          id: "pendulum-squat",
          name: "Sentadilla Péndulo",
          equipment: "Máquina",
          sets: 3,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 90,
          travel: "Sentadilla goblet con mancuerna"
        },
        {
          id: "hip-abduction-a",
          name: "Abducción de Caderas",
          equipment: "Máquina",
          sets: 3,
          reps: "15",
          targetMin: 15,
          targetMax: 15,
          rest: 45,
          travel: "Caminata lateral con banda o abducción acostada"
        },
        {
          id: "seated-leg-curl",
          name: "Curl de Pierna Sentado",
          equipment: "Máquina",
          sets: 3,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 90,
          travel: "Curl femoral deslizante con toalla o fitball"
        }
      ]
    },
    upperA: {
      name: "Superior A",
      focus: "Espalda · hombros · tríceps",
      estimatedMinutes: 50,
      exercises: [
        {
          id: "lat-pulldown",
          name: "Jalón al Pecho",
          equipment: "Máquina",
          sets: 4,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 90,
          travel: "Jalón con banda anclada arriba"
        },
        {
          id: "pec-deck",
          name: "Mariposa",
          equipment: "Pec Deck",
          sets: 3,
          reps: "13",
          targetMin: 13,
          targetMax: 13,
          rest: 90,
          group: "Superserie",
          travel: "Aperturas con mancuernas o banda"
        },
        {
          id: "lateral-raise",
          name: "Elevaciones Laterales",
          equipment: "Mancuernas",
          sets: 3,
          reps: "8",
          targetMin: 8,
          targetMax: 8,
          rest: 60,
          group: "Superserie",
          travel: "Elevaciones laterales con mancuernas o botellas"
        },
        {
          id: "rear-delt-fly",
          name: "Vuelos Posteriores",
          equipment: "Máquina",
          sets: 3,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 90,
          travel: "Vuelos posteriores inclinada con mancuernas"
        },
        {
          id: "french-press",
          name: "Press Francés",
          equipment: "Mancuerna",
          sets: 3,
          reps: "18",
          targetMin: 18,
          targetMax: 18,
          rest: 45,
          travel: "Extensión de tríceps por encima de la cabeza con una mancuerna"
        },
        {
          id: "triceps-pushdown-a",
          name: "Tríceps con Polea",
          equipment: "Polea",
          sets: 3,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 60,
          travel: "Tríceps con banda o flexiones con agarre cerrado"
        }
      ]
    },
    lowerB: {
      name: "Inferior B",
      focus: "Glúteos · cuádriceps · unilateral",
      estimatedMinutes: 48,
      exercises: [
        {
          id: "hip-thrust-machine-b",
          name: "Impulso de Cadera",
          equipment: "Máquina",
          sets: 4,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 90,
          travel: "Hip thrust con mancuerna o glute bridge en el piso"
        },
        {
          id: "leg-press",
          name: "Press de Piernas",
          equipment: "Máquina",
          sets: 3,
          reps: "8–10",
          targetMin: 8,
          targetMax: 10,
          rest: 90,
          travel: "Sentadilla goblet o sentadilla búlgara"
        },
        {
          id: "hip-abduction-b",
          name: "Abducción de Caderas",
          equipment: "Máquina",
          sets: 3,
          reps: "15",
          targetMin: 15,
          targetMax: 15,
          rest: 45,
          travel: "Caminata lateral con banda o abducción acostada"
        },
        {
          id: "dumbbell-lunge",
          name: "Zancada",
          equipment: "Mancuernas",
          sets: 3,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 90,
          travel: "Zancada con mancuernas o peso corporal"
        }
      ]
    },
    upperB: {
      name: "Superior B",
      focus: "Espalda · pecho · brazos",
      estimatedMinutes: 48,
      exercises: [
        {
          id: "seated-row",
          name: "Remo Sentado",
          equipment: "Máquina",
          sets: 4,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 90,
          travel: "Remo unilateral con mancuerna"
        },
        {
          id: "incline-db-press",
          name: "Press de Banca Inclinado",
          equipment: "Mancuernas",
          sets: 3,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 90,
          travel: "Press inclinado con mancuernas; sin banco, press de piso"
        },
        {
          id: "cable-triceps-extension",
          name: "Extensión de Tríceps",
          equipment: "Cable",
          sets: 3,
          reps: "15",
          targetMin: 15,
          targetMax: 15,
          rest: 60,
          travel: "Extensión de tríceps con banda o mancuerna"
        },
        {
          id: "dumbbell-biceps-curl",
          name: "Curl de Bíceps",
          equipment: "Mancuernas",
          sets: 3,
          reps: "10",
          targetMin: 10,
          targetMax: 10,
          rest: 60,
          travel: "Curl de bíceps con mancuernas o banda"
        },
        {
          id: "triceps-pushdown-b",
          name: "Tríceps con Polea",
          equipment: "Polea",
          sets: 3,
          reps: "12",
          targetMin: 12,
          targetMax: 12,
          rest: 60,
          travel: "Tríceps con banda o flexiones con agarre cerrado"
        }
      ]
    }
  }
};
