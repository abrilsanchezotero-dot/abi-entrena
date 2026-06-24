# Abi Entrena — PWA

Aplicación web instalable para iPhone, creada a partir de las capturas de la rutina.

## Rutinas cargadas

1. Inferior A
2. Superior A
3. Inferior B
4. Superior B

La app incluye:

- Seguimiento de peso, repeticiones y series.
- Temporizador automático según el descanso de cada ejercicio.
- Historial guardado en el dispositivo.
- Sugerencias prudentes de progresión.
- Modo viaje con alternativas.
- Calendario semanal editable.
- Funcionamiento offline.
- Exportación e importación de backups JSON.

## Suposiciones de esta primera versión

- Los entrenamientos superiores se llamaron **Superior A** y **Superior B**, porque el título no aparecía completo en las capturas.
- El calendario inicial es:
  - Lunes: Inferior A
  - Martes: Superior A
  - Jueves: Inferior B
  - Viernes: Superior B
- El calendario se puede cambiar desde **Ajustes**.
- La captura de Superior B podría comenzar después de algún ejercicio no visible. La versión actual contiene todos los ejercicios que sí aparecían.
- La progresión nunca cambia el peso automáticamente; solo muestra una sugerencia.

## Publicar gratis en GitHub Pages

1. Entrá a GitHub y creá un repositorio nuevo, por ejemplo `abi-entrena`.
2. Elegí **Add file → Upload files**.
3. Subí todos los archivos y carpetas de este proyecto, manteniendo la carpeta `icons`.
4. Confirmá con **Commit changes**.
5. Abrí **Settings → Pages**.
6. En **Build and deployment**, elegí:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
7. Guardá. GitHub mostrará la URL pública después de unos minutos.

## Instalar en iPhone

1. Abrí la URL de GitHub Pages en **Safari**.
2. Tocá el botón **Compartir**.
3. Elegí **Agregar a pantalla de inicio**.
4. Confirmá con **Agregar**.

## Editar la rutina

Abrí `routine-data.js`. Cada ejercicio tiene:

- `sets`: cantidad de series.
- `reps`: texto que se muestra.
- `targetMin` y `targetMax`: rango usado para la sugerencia de progresión.
- `rest`: descanso en segundos.
- `travel`: alternativa del modo viaje.

Cuando publiques cambios, actualizá el nombre del caché en `service-worker.js`, por ejemplo de `abi-entrena-v1` a `abi-entrena-v2`, para que el iPhone descargue la nueva versión.


## Diseño v2

Esta versión usa la dirección visual **editorial + collage**, con:

- Fondo crema.
- Rosa, lila y amarillo manteca.
- Tarjetas con bordes negros y sombras gráficas.
- Stickers originales de entrenamiento.
- Pantallas de inicio, rutinas e historial más expresivas.
- Pantalla de entrenamiento más limpia para conservar la usabilidad.

Para actualizar una publicación existente en GitHub, subí nuevamente todos los archivos y carpetas. GitHub reemplazará los archivos que tengan el mismo nombre. El caché del service worker cambió a `abi-entrena-v2`.


## Rutina v3 — recomp

La rutina anterior fue reemplazada por:

1. Día A — Push
2. Día B — Glúteos/Hams
3. Día C — Pull
4. Día D — Piernas/Brazos

Calendario inicial:

- Lunes: Push
- Martes: Glúteos/Hams
- Miércoles: descanso
- Jueves: Pull
- Viernes: Piernas/Brazos
- Sábado y domingo: descanso

Los descansos del temporizador se configuraron así:

- Compuestos pesados: 90–120 segundos.
- Aislaciones: 60–75 segundos.
- Transición entre los dos curls de la superserie: 15 segundos.
- Descanso después del segundo curl: 60 segundos.

El Chest Fly está cargado como quinto ejercicio opcional del Día A.


## Estilo v4 — aesthetic neutral

Esta versión actualiza la interfaz a una dirección más suave y minimalista, inspirada en una paleta:

- Savory sage `#818263`
- Avocado smoothie `#C2C395`
- Blush beet `#DDBAAE`
- Peach protein `#EFD7CF`
- Oat latte `#DCD4C1`
- Honey oatmeal `#EEEAD4`
- Coconut cream `#FFFAF2`

Se redujo el look collage anterior y se pasó a un estilo más editorial, limpio y “wellness aesthetic”.
