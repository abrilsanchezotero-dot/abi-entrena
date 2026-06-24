window.ROUTINE_DATA = {
  appName: "Abi Entrena",
  cycle: ["push", "glutesHams", "pull", "quadsArms"],
  defaultSchedule: {
    "0": "rest",
    "1": "push",
    "2": "glutesHams",
    "3": "rest",
    "4": "pull",
    "5": "quadsArms",
    "6": "rest"
  },
  recovery: {
    title: "Recuperación activa",
    estimatedMinutes: 25,
    items: [
      "Mantené tus pasos habituales sin agregar cardio intenso.",
      "Hacé 5–10 minutos de movilidad suave si te sentís rígida.",
      "Priorizá sueño, hidratación y proteína.",
      "Si cambiás un día, usá “Siguiente entrenamiento” para continuar el ciclo."
    ]
  },
  routines: {
    push: {
      name: "Día A — Push",
      focus: "Pecho · hombros · tríceps",
      estimatedMinutes: 48,
      exercises: [
        {
          id: "smith-bench-press",
          name: "Press de Banca",
          equipment: "Smith",
          sets: 4,
          reps: "6–10",
          targetMin: 6,
          targetMax: 10,
          rest: 120,
          travel: "Press de pecho con mancuernas o press de piso"
        },
        {
          id: "lateral-raises",
          name: "Elevaciones Laterales",
          equipment: "Polea o mancuernas",
          sets: 3,
          reps: "12–20",
          targetMin: 12,
          targetMax: 20,
          rest: 60,
          travel: "Elevaciones laterales con mancuernas o banda"
        },
        {
          id: "overhead-cable-triceps",
          name: "Extensión Overhead de Tríceps",
          equipment: "Polea · cabeza larga",
          sets: 3,
          reps: "10–15",
          targetMin: 10,
          targetMax: 15,
          rest: 75,
          travel: "Extensión overhead con mancuerna o banda"
        },
        {
          id: "cable-triceps-pushdown",
          name: "Tríceps Pushdown",
          equipment: "Polea · cuerda o barra",
          sets: 3,
          reps: "12–15",
          targetMin: 12,
          targetMax: 15,
          rest: 60,
          travel: "Pushdown con banda o flexiones con agarre cerrado"
        },
        {
          id: "matrix-chest-fly",
          name: "Chest Fly (opcional)",
          equipment: "Matrix",
          sets: 2,
          reps: "12–15",
          targetMin: 12,
          targetMax: 15,
          rest: 60,
          travel: "Aperturas con mancuernas o banda"
        }
      ]
    },

    glutesHams: {
      name: "Día B — Glúteos/Hams",
      focus: "Glúteos · isquios · cadena posterior",
      estimatedMinutes: 52,
      exercises: [
        {
          id: "romanian-deadlift",
          name: "Peso Muerto Rumano",
          equipment: "Barra o mancuernas",
          sets: 4,
          reps: "8–10",
          targetMin: 8,
          targetMax: 10,
          rest: 120,
          travel: "RDL con mancuernas"
        },
        {
          id: "bulgarian-split-squat",
          name: "Sentadilla Búlgara",
          equipment: "Mancuernas",
          sets: 3,
          reps: "8–12 por pierna",
          targetMin: 8,
          targetMax: 12,
          rest: 90,
          travel: "Sentadilla búlgara con mancuerna o peso corporal"
        },
        {
          id: "leg-press-high-wide",
          name: "Press de Piernas",
          equipment: "Pies altos y abiertos",
          sets: 3,
          reps: "10–15",
          targetMin: 10,
          targetMax: 15,
          rest: 90,
          travel: "Sentadilla goblet con postura amplia"
        },
        {
          id: "matrix-hamstring-curl",
          name: "Curl de Isquios",
          equipment: "Matrix",
          sets: 3,
          reps: "10–15",
          targetMin: 10,
          targetMax: 15,
          rest: 75,
          travel: "Curl femoral deslizante con toalla o fitball"
        }
      ]
    },

    pull: {
      name: "Día C — Pull",
      focus: "Espalda · deltoides posteriores · bíceps",
      estimatedMinutes: 48,
      exercises: [
        {
          id: "lat-pulldown",
          name: "Jalón al Pecho",
          equipment: "Agarre ancho o neutro",
          sets: 4,
          reps: "8–12",
          targetMin: 8,
          targetMax: 12,
          rest: 90,
          travel: "Jalón con banda anclada arriba"
        },
        {
          id: "seated-cable-row",
          name: "Remo Sentado",
          equipment: "Polea · agarre neutro",
          sets: 3,
          reps: "10–12",
          targetMin: 10,
          targetMax: 12,
          rest: 90,
          travel: "Remo unilateral con mancuerna"
        },
        {
          id: "rear-delt-fly-machine",
          name: "Rear Delt Fly",
          equipment: "Máquina",
          sets: 3,
          reps: "12–20",
          targetMin: 12,
          targetMax: 20,
          rest: 60,
          travel: "Vuelos posteriores inclinada con mancuernas"
        },
        {
          id: "hammer-curl",
          name: "Hammer Curl",
          equipment: "Mancuernas",
          sets: 3,
          reps: "10–12",
          targetMin: 10,
          targetMax: 12,
          rest: 15,
          group: "Superserie",
          travel: "Hammer curl con mancuernas o banda"
        },
        {
          id: "reverse-hammer-curl",
          name: "Reverse Hammer Curl",
          equipment: "Mancuernas",
          sets: 3,
          reps: "10–12",
          targetMin: 10,
          targetMax: 12,
          rest: 60,
          group: "Superserie",
          travel: "Reverse curl con mancuernas o banda"
        }
      ]
    },

    quadsArms: {
      name: "Día D — Piernas/Brazos",
      focus: "Cuádriceps · pantorrillas · tríceps",
      estimatedMinutes: 47,
      exercises: [
        {
          id: "heel-elevated-goblet-squat",
          name: "Goblet Squat con Talones Elevados",
          equipment: "Mancuerna",
          sets: 3,
          reps: "10–15",
          targetMin: 10,
          targetMax: 15,
          rest: 90,
          travel: "Goblet squat con talones elevados"
        },
        {
          id: "close-stance-split-or-sissy",
          name: "Split Squat Cerrado / Sissy Squat",
          equipment: "Elegí una variante",
          sets: 3,
          reps: "10–12 por pierna",
          targetMin: 10,
          targetMax: 12,
          rest: 90,
          travel: "Split squat cerrado o sissy squat asistida"
        },
        {
          id: "standing-calf-raise",
          name: "Elevación de Pantorrillas",
          equipment: "Máquina de sentadilla",
          sets: 4,
          reps: "15–20",
          targetMin: 15,
          targetMax: 20,
          rest: 60,
          travel: "Elevación de pantorrillas de pie con mancuerna"
        },
        {
          id: "skull-crushers",
          name: "Skull Crushers",
          equipment: "Barra EZ",
          sets: 3,
          reps: "8–12",
          targetMin: 8,
          targetMax: 12,
          rest: 75,
          travel: "Skull crushers con mancuernas"
        }
      ]
    }
  }
};
