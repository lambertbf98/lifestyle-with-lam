const pool = require('./pool');

// Base URL for exercise GIFs from fitnessprogramer.com
const GIF_BASE = 'https://fitnessprogramer.com/wp-content/uploads';

// Ejercicios con GIFs de fitnessprogramer.com
const exercises = [
  // PECHO
  {
    name: 'Press de Banca',
    name_es: 'Press de Banca',
    muscle_group: 'Pecho',
    secondary_muscles: ['Tríceps', 'Hombros'],
    equipment: 'Barra',
    difficulty: 'Intermedio',
    instructions: 'Acuéstate en el banco, agarra la barra con las manos separadas al ancho de los hombros. Baja la barra hasta el pecho y empuja hacia arriba.',
    gif_url: `${GIF_BASE}/2021/02/Barbell-Bench-Press.gif`
  },
  {
    name: 'Press Inclinado con Mancuernas',
    name_es: 'Press Inclinado con Mancuernas',
    muscle_group: 'Pecho',
    secondary_muscles: ['Tríceps', 'Hombros'],
    equipment: 'Mancuernas',
    difficulty: 'Intermedio',
    instructions: 'En banco inclinado a 30-45°, presiona las mancuernas hacia arriba juntándolas en la parte superior.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Incline-Dumbbell-Press.gif'
  },
  {
    name: 'Aperturas con Mancuernas',
    name_es: 'Aperturas con Mancuernas',
    muscle_group: 'Pecho',
    secondary_muscles: ['Hombros'],
    equipment: 'Mancuernas',
    difficulty: 'Principiante',
    instructions: 'Acostado en banco plano, abre los brazos en arco manteniendo codos ligeramente flexionados.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Fly.gif'
  },
  {
    name: 'Fondos en Paralelas',
    name_es: 'Fondos en Paralelas',
    muscle_group: 'Pecho',
    secondary_muscles: ['Tríceps', 'Hombros'],
    equipment: 'Paralelas',
    difficulty: 'Intermedio',
    instructions: 'Inclínate hacia adelante mientras bajas el cuerpo entre las barras. Empuja hasta extender los brazos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Chest-Dips.gif'
  },
  {
    name: 'Flexiones',
    name_es: 'Flexiones',
    muscle_group: 'Pecho',
    secondary_muscles: ['Tríceps', 'Hombros', 'Core'],
    equipment: 'Peso Corporal',
    difficulty: 'Principiante',
    instructions: 'Manos al ancho de hombros, baja el pecho al suelo manteniendo el cuerpo recto.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Push-Up.gif'
  },

  // ESPALDA
  {
    name: 'Dominadas',
    name_es: 'Dominadas',
    muscle_group: 'Espalda',
    secondary_muscles: ['Bíceps', 'Antebrazos'],
    equipment: 'Barra de Dominadas',
    difficulty: 'Avanzado',
    instructions: 'Agarra la barra con las palmas hacia afuera, tira del cuerpo hasta que la barbilla supere la barra.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pull-Up.gif'
  },
  {
    name: 'Remo con Barra',
    name_es: 'Remo con Barra',
    muscle_group: 'Espalda',
    secondary_muscles: ['Bíceps', 'Core'],
    equipment: 'Barra',
    difficulty: 'Intermedio',
    instructions: 'Inclínate hacia adelante 45°, tira de la barra hacia el abdomen manteniendo los codos cerca del cuerpo.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Bent-Over-Row.gif'
  },
  {
    name: 'Jalón al Pecho',
    name_es: 'Jalón al Pecho',
    muscle_group: 'Espalda',
    secondary_muscles: ['Bíceps'],
    equipment: 'Polea',
    difficulty: 'Principiante',
    instructions: 'Siéntate en la máquina, agarra la barra ancha y tira hacia el pecho apretando los omóplatos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lat-Pulldown.gif'
  },
  {
    name: 'Remo con Mancuerna',
    name_es: 'Remo con Mancuerna',
    muscle_group: 'Espalda',
    secondary_muscles: ['Bíceps'],
    equipment: 'Mancuerna',
    difficulty: 'Principiante',
    instructions: 'Apoya una rodilla y mano en el banco, tira de la mancuerna hacia la cadera.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Row.gif'
  },
  {
    name: 'Peso Muerto',
    name_es: 'Peso Muerto',
    muscle_group: 'Espalda',
    secondary_muscles: ['Glúteos', 'Isquiotibiales', 'Core'],
    equipment: 'Barra',
    difficulty: 'Avanzado',
    instructions: 'Pies al ancho de caderas, agarra la barra y levántala manteniendo la espalda recta.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Deadlift.gif'
  },

  // HOMBROS
  {
    name: 'Press Militar',
    name_es: 'Press Militar',
    muscle_group: 'Hombros',
    secondary_muscles: ['Tríceps'],
    equipment: 'Barra',
    difficulty: 'Intermedio',
    instructions: 'De pie o sentado, presiona la barra desde los hombros hasta arriba de la cabeza.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Overhead-Press.gif'
  },
  {
    name: 'Elevaciones Laterales',
    name_es: 'Elevaciones Laterales',
    muscle_group: 'Hombros',
    secondary_muscles: [],
    equipment: 'Mancuernas',
    difficulty: 'Principiante',
    instructions: 'De pie, eleva las mancuernas hacia los lados hasta la altura de los hombros.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Lateral-Raise.gif'
  },
  {
    name: 'Elevaciones Frontales',
    name_es: 'Elevaciones Frontales',
    muscle_group: 'Hombros',
    secondary_muscles: [],
    equipment: 'Mancuernas',
    difficulty: 'Principiante',
    instructions: 'De pie, eleva las mancuernas hacia el frente hasta la altura de los ojos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Front-Raise.gif'
  },
  {
    name: 'Pájaros',
    name_es: 'Pájaros (Elevaciones Posteriores)',
    muscle_group: 'Hombros',
    secondary_muscles: ['Espalda'],
    equipment: 'Mancuernas',
    difficulty: 'Intermedio',
    instructions: 'Inclinado hacia adelante, eleva las mancuernas hacia los lados apretando los omóplatos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Rear-Delt-Fly.gif'
  },

  // BÍCEPS
  {
    name: 'Curl con Barra',
    name_es: 'Curl con Barra',
    muscle_group: 'Bíceps',
    secondary_muscles: ['Antebrazos'],
    equipment: 'Barra',
    difficulty: 'Principiante',
    instructions: 'De pie, flexiona los codos llevando la barra hacia los hombros sin mover los codos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Curl.gif'
  },
  {
    name: 'Curl con Mancuernas',
    name_es: 'Curl con Mancuernas',
    muscle_group: 'Bíceps',
    secondary_muscles: ['Antebrazos'],
    equipment: 'Mancuernas',
    difficulty: 'Principiante',
    instructions: 'De pie o sentado, flexiona los codos alternando brazos o simultáneamente.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Curl.gif'
  },
  {
    name: 'Curl Martillo',
    name_es: 'Curl Martillo',
    muscle_group: 'Bíceps',
    secondary_muscles: ['Antebrazos'],
    equipment: 'Mancuernas',
    difficulty: 'Principiante',
    instructions: 'Con las palmas mirándose, flexiona los codos manteniendo las muñecas neutras.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Hammer-Curl.gif'
  },
  {
    name: 'Curl Concentrado',
    name_es: 'Curl Concentrado',
    muscle_group: 'Bíceps',
    secondary_muscles: [],
    equipment: 'Mancuerna',
    difficulty: 'Intermedio',
    instructions: 'Sentado, apoya el codo en el muslo interno y flexiona el brazo concentrando en el bíceps.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Concentration-Curl.gif'
  },

  // TRÍCEPS
  {
    name: 'Fondos en Banco',
    name_es: 'Fondos en Banco',
    muscle_group: 'Tríceps',
    secondary_muscles: ['Pecho', 'Hombros'],
    equipment: 'Banco',
    difficulty: 'Principiante',
    instructions: 'Manos en el banco detrás de ti, baja el cuerpo flexionando los codos y sube.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Bench-Dips.gif'
  },
  {
    name: 'Extensión de Tríceps con Polea',
    name_es: 'Extensión de Tríceps con Polea',
    muscle_group: 'Tríceps',
    secondary_muscles: [],
    equipment: 'Polea',
    difficulty: 'Principiante',
    instructions: 'De pie frente a la polea alta, extiende los codos hacia abajo manteniendo los codos fijos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pushdown.gif'
  },
  {
    name: 'Extensión de Tríceps sobre Cabeza',
    name_es: 'Extensión de Tríceps sobre Cabeza',
    muscle_group: 'Tríceps',
    secondary_muscles: [],
    equipment: 'Mancuerna',
    difficulty: 'Intermedio',
    instructions: 'Con mancuerna sobre la cabeza, baja detrás de la cabeza y extiende.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Triceps-Extension.gif'
  },
  {
    name: 'Press Francés',
    name_es: 'Press Francés',
    muscle_group: 'Tríceps',
    secondary_muscles: [],
    equipment: 'Barra EZ',
    difficulty: 'Intermedio',
    instructions: 'Acostado, baja la barra hacia la frente flexionando solo los codos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Skull-Crusher.gif'
  },

  // PIERNAS - CUÁDRICEPS
  {
    name: 'Sentadilla con Barra',
    name_es: 'Sentadilla con Barra',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos', 'Isquiotibiales', 'Core'],
    equipment: 'Barra',
    difficulty: 'Intermedio',
    instructions: 'Barra sobre los trapecios, baja hasta que los muslos estén paralelos al suelo.',
    gif_url: `${GIF_BASE}/2021/02/BARBELL-SQUAT.gif`
  },
  {
    name: 'Prensa de Piernas',
    name_es: 'Prensa de Piernas',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos', 'Isquiotibiales'],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Pies al ancho de hombros en la plataforma, baja el peso flexionando las rodillas 90°.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Leg-Press.gif'
  },
  {
    name: 'Extensión de Cuádriceps',
    name_es: 'Extensión de Cuádriceps',
    muscle_group: 'Cuádriceps',
    secondary_muscles: [],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Sentado en la máquina, extiende las piernas hasta que estén rectas.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/LEG-EXTENSION.gif'
  },
  {
    name: 'Zancadas',
    name_es: 'Zancadas',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos', 'Isquiotibiales'],
    equipment: 'Mancuernas',
    difficulty: 'Intermedio',
    instructions: 'Da un paso adelante y baja hasta que ambas rodillas formen 90°.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Lunges.gif'
  },
  {
    name: 'Sentadilla Búlgara',
    name_es: 'Sentadilla Búlgara',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos'],
    equipment: 'Mancuernas',
    difficulty: 'Avanzado',
    instructions: 'Pie trasero elevado en banco, baja la rodilla trasera hacia el suelo.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Bulgarian-Split-Squat.gif'
  },

  // PIERNAS - ISQUIOTIBIALES
  {
    name: 'Curl de Pierna Acostado',
    name_es: 'Curl de Pierna Acostado',
    muscle_group: 'Isquiotibiales',
    secondary_muscles: [],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Acostado boca abajo, flexiona las rodillas llevando los talones hacia los glúteos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lying-Leg-Curl.gif'
  },
  {
    name: 'Peso Muerto Rumano',
    name_es: 'Peso Muerto Rumano',
    muscle_group: 'Isquiotibiales',
    secondary_muscles: ['Glúteos', 'Espalda Baja'],
    equipment: 'Barra',
    difficulty: 'Intermedio',
    instructions: 'Piernas casi rectas, baja la barra deslizándola por las piernas manteniendo espalda recta.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Romanian-Deadlift.gif'
  },

  // GLÚTEOS
  {
    name: 'Hip Thrust',
    name_es: 'Hip Thrust',
    muscle_group: 'Glúteos',
    secondary_muscles: ['Isquiotibiales'],
    equipment: 'Barra',
    difficulty: 'Intermedio',
    instructions: 'Espalda apoyada en banco, empuja las caderas hacia arriba apretando glúteos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Hip-Thrust.gif'
  },
  {
    name: 'Patada de Glúteo',
    name_es: 'Patada de Glúteo',
    muscle_group: 'Glúteos',
    secondary_muscles: [],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'En cuadrupedia o máquina, extiende la pierna hacia atrás apretando el glúteo.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Kickback.gif'
  },

  // PANTORRILLAS
  {
    name: 'Elevación de Talones de Pie',
    name_es: 'Elevación de Talones de Pie',
    muscle_group: 'Pantorrillas',
    secondary_muscles: [],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'De pie en la máquina, eleva los talones lo más alto posible.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Standing-Calf-Raise.gif'
  },
  {
    name: 'Elevación de Talones Sentado',
    name_es: 'Elevación de Talones Sentado',
    muscle_group: 'Pantorrillas',
    secondary_muscles: [],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Sentado con peso sobre las rodillas, eleva los talones.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Calf-Raise.gif'
  },

  // ABDOMINALES
  {
    name: 'Crunch',
    name_es: 'Crunch Abdominal',
    muscle_group: 'Abdominales',
    secondary_muscles: [],
    equipment: 'Peso Corporal',
    difficulty: 'Principiante',
    instructions: 'Acostado, eleva los hombros del suelo contrayendo el abdomen.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Crunch.gif'
  },
  {
    name: 'Plancha',
    name_es: 'Plancha',
    muscle_group: 'Abdominales',
    secondary_muscles: ['Core', 'Hombros'],
    equipment: 'Peso Corporal',
    difficulty: 'Principiante',
    instructions: 'Apoyado en antebrazos y puntas de pies, mantén el cuerpo recto.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Plank.gif'
  },
  {
    name: 'Elevación de Piernas',
    name_es: 'Elevación de Piernas',
    muscle_group: 'Abdominales',
    secondary_muscles: [],
    equipment: 'Peso Corporal',
    difficulty: 'Intermedio',
    instructions: 'Acostado, eleva las piernas rectas hasta 90° y baja con control.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Lying-Leg-Raise.gif'
  },
  {
    name: 'Russian Twist',
    name_es: 'Giro Ruso',
    muscle_group: 'Abdominales',
    secondary_muscles: ['Oblicuos'],
    equipment: 'Peso Corporal',
    difficulty: 'Intermedio',
    instructions: 'Sentado con torso inclinado, gira el torso de lado a lado.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Russian-Twist.gif'
  },
  {
    name: 'Mountain Climbers',
    name_es: 'Escaladores',
    muscle_group: 'Abdominales',
    secondary_muscles: ['Cardio', 'Hombros'],
    equipment: 'Peso Corporal',
    difficulty: 'Intermedio',
    instructions: 'En posición de plancha alta, alterna llevando las rodillas al pecho rápidamente.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Mountain-Climber.gif'
  },

  // EJERCICIOS ADICIONALES - Variaciones comunes

  // Variaciones de Sentadilla
  {
    name: 'Sentadilla',
    name_es: 'Sentadilla',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos', 'Isquiotibiales'],
    equipment: 'Peso Corporal',
    difficulty: 'Principiante',
    instructions: 'Pies al ancho de hombros, baja flexionando rodillas manteniendo espalda recta.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Barbell-Squat.gif'
  },
  {
    name: 'Sentadilla Goblet',
    name_es: 'Sentadilla Goblet',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos', 'Core'],
    equipment: 'Mancuerna',
    difficulty: 'Principiante',
    instructions: 'Sostén una mancuerna contra el pecho y realiza una sentadilla profunda.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Goblet-Squat.gif'
  },
  {
    name: 'Sentadilla Sumo',
    name_es: 'Sentadilla Sumo',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos', 'Aductores'],
    equipment: 'Barra',
    difficulty: 'Intermedio',
    instructions: 'Piernas muy separadas, puntas hacia afuera, baja manteniendo rodillas alineadas.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Sumo-Squat.gif'
  },
  {
    name: 'Sentadilla Hack',
    name_es: 'Sentadilla Hack',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos'],
    equipment: 'Máquina',
    difficulty: 'Intermedio',
    instructions: 'En máquina hack, baja controladamente y empuja con los talones.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Hack-Squat.gif'
  },

  // Variaciones de Prensa
  {
    name: 'Prensa',
    name_es: 'Prensa',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos', 'Isquiotibiales'],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Pies al ancho de hombros en la plataforma, baja y empuja.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Leg-Press.gif'
  },
  {
    name: 'Prensa Inclinada',
    name_es: 'Prensa Inclinada',
    muscle_group: 'Cuádriceps',
    secondary_muscles: ['Glúteos'],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'En prensa a 45°, empuja la plataforma controlando el descenso.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Leg-Press.gif'
  },

  // Más ejercicios de Glúteos
  {
    name: 'Puente de Glúteos',
    name_es: 'Puente de Glúteos',
    muscle_group: 'Glúteos',
    secondary_muscles: ['Isquiotibiales'],
    equipment: 'Peso Corporal',
    difficulty: 'Principiante',
    instructions: 'Acostado, pies apoyados, eleva las caderas apretando glúteos.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Glute-Bridge.gif'
  },
  {
    name: 'Peso Muerto Sumo',
    name_es: 'Peso Muerto Sumo',
    muscle_group: 'Glúteos',
    secondary_muscles: ['Isquiotibiales', 'Espalda'],
    equipment: 'Barra',
    difficulty: 'Intermedio',
    instructions: 'Piernas muy separadas, agarre estrecho, levanta manteniendo espalda recta.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Sumo-Deadlift.gif'
  },
  {
    name: 'Abducción de Cadera',
    name_es: 'Abducción de Cadera',
    muscle_group: 'Glúteos',
    secondary_muscles: [],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Sentado en la máquina, separa las piernas contra la resistencia.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Hip-Abduction-Machine.gif'
  },
  {
    name: 'Aducción de Cadera',
    name_es: 'Aducción de Cadera',
    muscle_group: 'Aductores',
    secondary_muscles: [],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Sentado en la máquina, junta las piernas contra la resistencia.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Hip-Adduction-Machine.gif'
  },

  // Más ejercicios de Espalda
  {
    name: 'Remo en Máquina',
    name_es: 'Remo en Máquina',
    muscle_group: 'Espalda',
    secondary_muscles: ['Bíceps'],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Siéntate en la máquina, tira de las asas hacia el abdomen.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Row-Machine.gif'
  },
  {
    name: 'Remo en Polea Baja',
    name_es: 'Remo en Polea Baja',
    muscle_group: 'Espalda',
    secondary_muscles: ['Bíceps'],
    equipment: 'Polea',
    difficulty: 'Intermedio',
    instructions: 'Sentado, tira del agarre hacia el abdomen manteniendo espalda recta.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Cable-Row.gif'
  },
  {
    name: 'Pull Over',
    name_es: 'Pull Over',
    muscle_group: 'Espalda',
    secondary_muscles: ['Pecho', 'Tríceps'],
    equipment: 'Mancuerna',
    difficulty: 'Intermedio',
    instructions: 'Acostado, baja la mancuerna detrás de la cabeza y sube.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Pullover.gif'
  },

  // Más ejercicios de Pecho
  {
    name: 'Press de Pecho en Máquina',
    name_es: 'Press de Pecho en Máquina',
    muscle_group: 'Pecho',
    secondary_muscles: ['Tríceps', 'Hombros'],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Sentado en la máquina, empuja las asas hacia adelante.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Chest-Press-Machine.gif'
  },
  {
    name: 'Cruces en Polea',
    name_es: 'Cruces en Polea',
    muscle_group: 'Pecho',
    secondary_muscles: [],
    equipment: 'Polea',
    difficulty: 'Intermedio',
    instructions: 'De pie entre las poleas, junta las manos frente al pecho.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Crossover.gif'
  },

  // Más ejercicios de Hombros
  {
    name: 'Press con Mancuernas',
    name_es: 'Press con Mancuernas',
    muscle_group: 'Hombros',
    secondary_muscles: ['Tríceps'],
    equipment: 'Mancuernas',
    difficulty: 'Intermedio',
    instructions: 'Sentado o de pie, presiona las mancuernas sobre la cabeza.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Shoulder-Press.gif'
  },
  {
    name: 'Press Arnold',
    name_es: 'Press Arnold',
    muscle_group: 'Hombros',
    secondary_muscles: ['Tríceps'],
    equipment: 'Mancuernas',
    difficulty: 'Avanzado',
    instructions: 'Inicia con mancuernas frente a ti, gira mientras presionas hacia arriba.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Arnold-Press.gif'
  },
  {
    name: 'Face Pull',
    name_es: 'Face Pull',
    muscle_group: 'Hombros',
    secondary_muscles: ['Espalda'],
    equipment: 'Polea',
    difficulty: 'Intermedio',
    instructions: 'Tira de la cuerda hacia la cara separando las manos al final.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Face-Pull.gif'
  },
  {
    name: 'Encogimientos de Hombros',
    name_es: 'Encogimientos de Hombros',
    muscle_group: 'Trapecios',
    secondary_muscles: [],
    equipment: 'Mancuernas',
    difficulty: 'Principiante',
    instructions: 'De pie con mancuernas, eleva los hombros hacia las orejas.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Dumbbell-Shrug.gif'
  },

  // Curl de pierna sentado
  {
    name: 'Curl de Pierna Sentado',
    name_es: 'Curl de Pierna Sentado',
    muscle_group: 'Isquiotibiales',
    secondary_muscles: [],
    equipment: 'Máquina',
    difficulty: 'Principiante',
    instructions: 'Sentado en la máquina, flexiona las rodillas llevando talones hacia atrás.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Seated-Leg-Curl.gif'
  },

  // Más abdominales
  {
    name: 'Crunch en Polea',
    name_es: 'Crunch en Polea',
    muscle_group: 'Abdominales',
    secondary_muscles: [],
    equipment: 'Polea',
    difficulty: 'Intermedio',
    instructions: 'De rodillas, flexiona el torso hacia abajo contra la resistencia.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Cable-Crunch.gif'
  },
  {
    name: 'Plancha Lateral',
    name_es: 'Plancha Lateral',
    muscle_group: 'Oblicuos',
    secondary_muscles: ['Core'],
    equipment: 'Peso Corporal',
    difficulty: 'Intermedio',
    instructions: 'Apoyado en un antebrazo, mantén el cuerpo recto de lado.',
    gif_url: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Side-Plank.gif'
  }
];

const seedExercises = async () => {
  const client = await pool.connect();

  try {
    // Check if exercises table already has data
    const existingCount = await client.query('SELECT COUNT(*) FROM exercises');
    const count = parseInt(existingCount.rows[0].count);

    if (count > 0) {
      console.log(`Exercises table already has ${count} exercises, updating GIFs...`);
      // Update existing exercises with GIFs
      await updateExerciseGifs(client);
      return;
    }

    await client.query('BEGIN');

    // Insert exercises
    for (const exercise of exercises) {
      await client.query(
        `INSERT INTO exercises (name, name_es, muscle_group, secondary_muscles, equipment, difficulty, instructions, gif_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          exercise.name,
          exercise.name_es,
          exercise.muscle_group,
          exercise.secondary_muscles,
          exercise.equipment,
          exercise.difficulty,
          exercise.instructions,
          exercise.gif_url
        ]
      );
    }

    await client.query('COMMIT');
    console.log(`Seeded ${exercises.length} exercises successfully`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding exercises:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update existing exercises with GIF URLs using fuzzy matching
const updateExerciseGifs = async (client) => {
  try {
    let updated = 0;
    for (const exercise of exercises) {
      // Use ILIKE for partial matching
      const result = await client.query(
        `UPDATE exercises SET gif_url = $1
         WHERE gif_url IS NULL OR gif_url = ''
         AND (
           LOWER(name_es) LIKE LOWER($2) OR
           LOWER(name) LIKE LOWER($3) OR
           LOWER(name_es) LIKE LOWER($4) OR
           LOWER(name) LIKE LOWER($4)
         )`,
        [
          exercise.gif_url,
          exercise.name_es,
          exercise.name,
          `%${exercise.name_es.split(' ')[0]}%` // Match first word
        ]
      );
      updated += result.rowCount;
    }
    console.log(`Exercise GIFs updated: ${updated} exercises`);
  } catch (error) {
    console.error('Error updating exercise GIFs:', error);
  }
};

// Force update all exercises with GIFs - using fitnessprogramer.com (verified working URLs)
const forceUpdateAllGifs = async () => {
  const client = await pool.connect();
  try {
    // GIFs from fitnessprogramer.com - verified working URLs
    const FP_BASE = 'https://fitnessprogramer.com/wp-content/uploads';

    const exactNameGifs = {
      // PECHO
      'Press de Banca': `${FP_BASE}/2021/02/Barbell-Bench-Press.gif`,
      'Press Inclinado con Mancuernas': `${FP_BASE}/2021/02/Incline-Dumbbell-Press.gif`,
      'Press Inclinado': `${FP_BASE}/2021/02/Incline-Dumbbell-Press.gif`,
      'Aperturas con Mancuernas': `${FP_BASE}/2021/02/Dumbbell-Fly.gif`,
      'Aperturas': `${FP_BASE}/2021/02/Dumbbell-Fly.gif`,
      'Fondos en Paralelas': `${FP_BASE}/2021/06/Chest-Dips.gif`,
      'Fondos': `${FP_BASE}/2021/06/Chest-Dips.gif`,
      'Flexiones': `${FP_BASE}/2021/02/Push-up.gif`,
      'Press de Pecho en Máquina': `${FP_BASE}/2021/02/Barbell-Bench-Press.gif`,
      'Cruces en Polea': `${FP_BASE}/2021/02/Cable-Crossover.gif`,

      // ESPALDA
      'Dominadas': `${FP_BASE}/2021/02/Pull-up.gif`,
      'Pull-Up': `${FP_BASE}/2021/02/Pull-up.gif`,
      'Remo con Barra': `${FP_BASE}/2021/02/Barbell-Bent-Over-Row.gif`,
      'Remo con Mancuerna': `${FP_BASE}/2021/02/Dumbbell-Row.gif`,
      'Remo': `${FP_BASE}/2021/02/Barbell-Bent-Over-Row.gif`,
      'Jalón al Pecho': `${FP_BASE}/2021/02/Lat-Pulldown.gif`,
      'Jalón': `${FP_BASE}/2021/02/Lat-Pulldown.gif`,
      'Peso Muerto': `${FP_BASE}/2021/02/Barbell-Deadlift.gif`,
      'Remo en Máquina': `${FP_BASE}/2021/02/Barbell-Bent-Over-Row.gif`,
      'Remo en Polea Baja': `${FP_BASE}/2021/02/Seated-Cable-Row.gif`,
      'Pull Over': `${FP_BASE}/2021/02/Lat-Pulldown.gif`,

      // HOMBROS
      'Press Militar': `${FP_BASE}/2021/07/Barbell-Standing-Military-Press.gif`,
      'Press con Mancuernas': `${FP_BASE}/2021/02/Dumbbell-Shoulder-Press.gif`,
      'Elevaciones Laterales': `${FP_BASE}/2021/02/Dumbbell-Lateral-Raise.gif`,
      'Elevaciones Frontales': `${FP_BASE}/2021/02/Dumbbell-Front-Raise.gif`,
      'Pájaros': `${FP_BASE}/2021/02/Dumbbell-Lateral-Raise.gif`,
      'Elevaciones Posteriores': `${FP_BASE}/2021/02/Dumbbell-Lateral-Raise.gif`,
      'Press Arnold': `${FP_BASE}/2021/02/Dumbbell-Shoulder-Press.gif`,
      'Face Pull': `${FP_BASE}/2021/02/Face-Pull.gif`,
      'Encogimientos de Hombros': `${FP_BASE}/2021/02/Dumbbell-Shrug.gif`,
      'Encogimientos': `${FP_BASE}/2021/02/Dumbbell-Shrug.gif`,

      // BÍCEPS
      'Curl con Barra': `${FP_BASE}/2021/02/Barbell-Curl.gif`,
      'Curl con Mancuernas': `${FP_BASE}/2021/02/Dumbbell-Curl.gif`,
      'Curl Martillo': `${FP_BASE}/2021/02/Hammer-Curl.gif`,
      'Curl Concentrado': `${FP_BASE}/2021/02/Concentration-Curl.gif`,
      'Curl': `${FP_BASE}/2021/02/Barbell-Curl.gif`,

      // TRÍCEPS
      'Fondos en Banco': `${FP_BASE}/2021/02/Bench-Dips.gif`,
      'Extensión de Tríceps con Polea': `${FP_BASE}/2021/02/Triceps-Pushdown.gif`,
      'Extensión de Tríceps sobre Cabeza': `${FP_BASE}/2021/02/Dumbbell-Triceps-Extension.gif`,
      'Extensión de Tríceps': `${FP_BASE}/2021/02/Triceps-Pushdown.gif`,
      'Press Francés': `${FP_BASE}/2021/02/Skull-Crusher.gif`,

      // PIERNAS - CUÁDRICEPS
      'Sentadilla con Barra': `${FP_BASE}/2021/02/BARBELL-SQUAT.gif`,
      'Sentadilla': `${FP_BASE}/2021/02/BARBELL-SQUAT.gif`,
      'Sentadilla Goblet': `${FP_BASE}/2021/02/Goblet-Squat.gif`,
      'Sentadilla Sumo': `${FP_BASE}/2021/02/Sumo-Squat.gif`,
      'Sentadilla Hack': `${FP_BASE}/2021/02/BARBELL-SQUAT.gif`,
      'Sentadilla Búlgara': `${FP_BASE}/2021/02/Dumbbell-Lunge.gif`,
      'Prensa de Piernas': `${FP_BASE}/2015/11/Leg-Press.gif`,
      'Prensa': `${FP_BASE}/2015/11/Leg-Press.gif`,
      'Prensa Inclinada': `${FP_BASE}/2015/11/Leg-Press.gif`,
      'Extensión de Cuádriceps': `${FP_BASE}/2021/02/LEG-EXTENSION.gif`,
      'Zancadas': `${FP_BASE}/2021/02/Dumbbell-Lunge.gif`,
      'Zancada': `${FP_BASE}/2021/02/Dumbbell-Lunge.gif`,

      // PIERNAS - ISQUIOTIBIALES
      'Curl de Pierna Acostado': `${FP_BASE}/2021/02/Lying-Leg-Curl.gif`,
      'Curl de Pierna Sentado': `${FP_BASE}/2021/08/Seated-Leg-Curl.gif`,
      'Curl de Pierna': `${FP_BASE}/2021/08/Seated-Leg-Curl.gif`,
      'Peso Muerto Rumano': `${FP_BASE}/2021/02/Barbell-Deadlift.gif`,

      // GLÚTEOS
      'Hip Thrust': `${FP_BASE}/2021/02/Barbell-Hip-Thrust.gif`,
      'Patada de Glúteo': `${FP_BASE}/2021/02/Barbell-Hip-Thrust.gif`,
      'Puente de Glúteos': `${FP_BASE}/2021/02/Barbell-Hip-Thrust.gif`,
      'Peso Muerto Sumo': `${FP_BASE}/2021/02/Barbell-Deadlift.gif`,
      'Abducción de Cadera': `${FP_BASE}/2021/02/Dumbbell-Lunge.gif`,
      'Aducción de Cadera': `${FP_BASE}/2021/02/Dumbbell-Lunge.gif`,

      // PANTORRILLAS
      'Elevación de Talones de Pie': `${FP_BASE}/2021/06/Standing-Calf-Raise.gif`,
      'Elevación de Talones Sentado': `${FP_BASE}/2021/06/Standing-Calf-Raise.gif`,
      'Elevación de Talones': `${FP_BASE}/2021/06/Standing-Calf-Raise.gif`,

      // ABDOMINALES
      'Crunch': `${FP_BASE}/2021/02/Crunch.gif`,
      'Crunch Abdominal': `${FP_BASE}/2021/02/Crunch.gif`,
      'Crunch en Polea': `${FP_BASE}/2021/02/Crunch.gif`,
      'Plancha': `${FP_BASE}/2021/02/Front-Plank.gif`,
      'Plancha Lateral': `${FP_BASE}/2021/02/Front-Plank.gif`,
      'Elevación de Piernas': `${FP_BASE}/2021/02/Leg-Raise.gif`,
      'Russian Twist': `${FP_BASE}/2021/02/Crunch.gif`,
      'Giro Ruso': `${FP_BASE}/2021/02/Crunch.gif`,
      'Mountain Climbers': `${FP_BASE}/2021/02/Push-up.gif`,
      'Escaladores': `${FP_BASE}/2021/02/Push-up.gif`
    };

    // Keyword-based GIF mapping for partial matches
    const keywordGifs = {
      'dominada': `${FP_BASE}/2021/02/Pull-up.gif`,
      'pull up': `${FP_BASE}/2021/02/Pull-up.gif`,
      'pull-up': `${FP_BASE}/2021/02/Pull-up.gif`,
      'press banca': `${FP_BASE}/2021/02/Barbell-Bench-Press.gif`,
      'press inclinado': `${FP_BASE}/2021/02/Incline-Dumbbell-Press.gif`,
      'press militar': `${FP_BASE}/2021/07/Barbell-Standing-Military-Press.gif`,
      'press hombro': `${FP_BASE}/2021/02/Dumbbell-Shoulder-Press.gif`,
      'remo': `${FP_BASE}/2021/02/Barbell-Bent-Over-Row.gif`,
      'jalón': `${FP_BASE}/2021/02/Lat-Pulldown.gif`,
      'curl': `${FP_BASE}/2021/02/Barbell-Curl.gif`,
      'sentadilla': `${FP_BASE}/2021/02/BARBELL-SQUAT.gif`,
      'squat': `${FP_BASE}/2021/02/BARBELL-SQUAT.gif`,
      'prensa': `${FP_BASE}/2015/11/Leg-Press.gif`,
      'zancada': `${FP_BASE}/2021/02/Dumbbell-Lunge.gif`,
      'peso muerto': `${FP_BASE}/2021/02/Barbell-Deadlift.gif`,
      'deadlift': `${FP_BASE}/2021/02/Barbell-Deadlift.gif`,
      'hip thrust': `${FP_BASE}/2021/02/Barbell-Hip-Thrust.gif`,
      'elevación lateral': `${FP_BASE}/2021/02/Dumbbell-Lateral-Raise.gif`,
      'elevación frontal': `${FP_BASE}/2021/02/Dumbbell-Front-Raise.gif`,
      'fondo': `${FP_BASE}/2021/06/Chest-Dips.gif`,
      'dips': `${FP_BASE}/2021/06/Chest-Dips.gif`,
      'flexión': `${FP_BASE}/2021/02/Push-up.gif`,
      'flexiones': `${FP_BASE}/2021/02/Push-up.gif`,
      'plancha': `${FP_BASE}/2021/02/Front-Plank.gif`,
      'crunch': `${FP_BASE}/2021/02/Crunch.gif`,
      'abdominal': `${FP_BASE}/2021/02/Crunch.gif`,
      'extensión tríceps': `${FP_BASE}/2021/02/Triceps-Pushdown.gif`,
      'extensión cuádriceps': `${FP_BASE}/2021/02/LEG-EXTENSION.gif`,
      'curl pierna': `${FP_BASE}/2021/08/Seated-Leg-Curl.gif`,
      'pantorrilla': `${FP_BASE}/2021/06/Standing-Calf-Raise.gif`,
      'gemelo': `${FP_BASE}/2021/06/Standing-Calf-Raise.gif`,
      'apertura': `${FP_BASE}/2021/02/Dumbbell-Fly.gif`,
      'face pull': `${FP_BASE}/2021/02/Face-Pull.gif`
    };

    // Map of muscle groups to default GIFs (fallback)
    const muscleGroupGifs = {
      'Pecho': `${FP_BASE}/2021/02/Barbell-Bench-Press.gif`,
      'Espalda': `${FP_BASE}/2021/02/Lat-Pulldown.gif`,
      'Hombros': `${FP_BASE}/2021/02/Dumbbell-Shoulder-Press.gif`,
      'Bíceps': `${FP_BASE}/2021/02/Barbell-Curl.gif`,
      'Tríceps': `${FP_BASE}/2021/02/Triceps-Pushdown.gif`,
      'Cuádriceps': `${FP_BASE}/2021/02/BARBELL-SQUAT.gif`,
      'Isquiotibiales': `${FP_BASE}/2021/08/Seated-Leg-Curl.gif`,
      'Glúteos': `${FP_BASE}/2021/02/Barbell-Hip-Thrust.gif`,
      'Pantorrillas': `${FP_BASE}/2021/06/Standing-Calf-Raise.gif`,
      'Abdominales': `${FP_BASE}/2021/02/Crunch.gif`,
      'Core': `${FP_BASE}/2021/02/Front-Plank.gif`,
      'Piernas': `${FP_BASE}/2021/02/BARBELL-SQUAT.gif`,
      'Trapecios': `${FP_BASE}/2021/02/Dumbbell-Shrug.gif`,
      'Oblicuos': `${FP_BASE}/2021/02/Crunch.gif`,
      'Aductores': `${FP_BASE}/2021/02/Dumbbell-Lunge.gif`
    };

    let totalUpdated = 0;

    // Step 1: Try exact name matches - UPDATE ALL (including broken URLs)
    for (const [name, gifUrl] of Object.entries(exactNameGifs)) {
      const result = await client.query(
        `UPDATE exercises SET gif_url = $1
         WHERE (LOWER(name_es) = LOWER($2) OR LOWER(name) = LOWER($2))`,
        [gifUrl, name]
      );
      totalUpdated += result.rowCount;
    }

    // Step 2: Try keyword-based partial matching - for exercises not yet updated
    for (const [keyword, gifUrl] of Object.entries(keywordGifs)) {
      const result = await client.query(
        `UPDATE exercises SET gif_url = $1
         WHERE (gif_url IS NULL OR gif_url = '' OR gif_url LIKE '%fitnessprogramer%')
         AND (LOWER(name_es) ILIKE $2 OR LOWER(name) ILIKE $2)`,
        [gifUrl, `%${keyword}%`]
      );
      totalUpdated += result.rowCount;
    }

    // Step 3: Fill remaining with muscle group defaults
    for (const [muscleGroup, gifUrl] of Object.entries(muscleGroupGifs)) {
      const result = await client.query(
        `UPDATE exercises SET gif_url = $1
         WHERE (gif_url IS NULL OR gif_url = '' OR gif_url LIKE '%fitnessprogramer%')
         AND LOWER(muscle_group) = LOWER($2)`,
        [gifUrl, muscleGroup]
      );
      totalUpdated += result.rowCount;
    }

    // Count remaining without GIFs
    const remaining = await client.query(
      `SELECT name, name_es, muscle_group FROM exercises WHERE gif_url IS NULL OR gif_url = ''`
    );

    console.log(`GIFs updated: ${totalUpdated} exercises.`);
    if (remaining.rows.length > 0) {
      console.log('Exercises still without GIF:');
      remaining.rows.forEach(ex => console.log(`  - ${ex.name_es || ex.name} (${ex.muscle_group})`));
    }

    return {
      success: true,
      updated: totalUpdated,
      remaining: remaining.rows.length,
      exercisesWithoutGif: remaining.rows
    };
  } catch (error) {
    console.error('Error force updating GIFs:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
};

module.exports = { seedExercises, exercises, forceUpdateAllGifs };
