# Rally Club

Juego de rally 3D para navegador, construido con HTML, CSS y JavaScript. Conduces un coche inspirado en un Seat Ibiza de rally por un tramo de montaña: el motor acelera automáticamente, pero la dirección y el freno dependen del jugador.

## Lanzar el juego

El punto de entrada está en **`index.html`, en la raíz del repositorio**. Abre ese archivo directamente en el navegador o publica la carpeta raíz tal cual en un alojamiento estático, como GitHub Pages. No requiere compilación, servidor ni conexión para cargar el motor 3D.

Three.js está incluido localmente en `js/vendor/three.min.js`; su licencia MIT está en `js/vendor/THREE-LICENSE.txt`. Las tipografías personalizadas se descargan de Google Fonts; sin conexión se utilizan fuentes alternativas del sistema.

## Objetivo y controles

Completa las vueltas del tramo lo más rápido posible. El primer circuito tiene tres vueltas. La vuelta rápida objetivo de aproximadamente 23 segundos es orientativa: el tiempo real depende de la trazada, la velocidad y el uso del freno.

- **← / →** o **A / D**: girar a izquierda y derecha. Las ruedas delanteras responden mientras mantienes la tecla y vuelven al centro al soltarla. Las direcciones opuestas simultáneas se cancelan.
- **↓**, **S** o **espacio**: frenar. El coche acelera automáticamente cuando no estás frenando.
- **R**: volver a la salida mientras la etapa está en curso o una vez completada.
- **Enter** o **espacio**: arrancar desde la pantalla inicial o comenzar otra pasada desde la pantalla de finalización. Durante la carrera, espacio frena.
- En pantallas táctiles, usa los botones de dirección y freno sobre la vista del circuito.

La cámara sigue al coche desde atrás en tercera persona con suavizado. Las ruedas delanteras giran con la dirección y las cuatro ruedas rotan visualmente al avanzar.

## Comportamiento de conducción

La dirección no es un interruptor: el volante virtual se desplaza gradualmente hacia el ángulo pedido mientras se mantiene una tecla y regresa al centro al soltarla. El límite de ángulo cambia con la velocidad: se calcula como el ángulo máximo configurado multiplicado por `1 − reducción × fracción de velocidad`. La fracción de velocidad va de 0 a 1 respecto al límite de velocidad de la pista. Por tanto, con una reducción del 65 %, a velocidad punta queda disponible el 35 % del ángulo máximo configurado. El radio de giro efectivo aumenta al ganar velocidad.

En asfalto, al girar y sin mantener el freno, el coche pierde velocidad por curva. La desaceleración adicional se calcula como:

`frenado máximo × fracción de velocidad sobre el umbral × fracción del ángulo de giro`

La fracción del ángulo es lineal: 0 con las ruedas rectas y 1 al alcanzar el ángulo máximo disponible a esa velocidad. La fracción de velocidad también es lineal: 0 hasta el umbral configurado y aumenta hasta 1 en el límite de velocidad de la pista. Así, con el umbral inicial de 50 km/h, no hay penalización por giro hasta 50 km/h; a partir de ahí el efecto aumenta con la velocidad y con el ángulo. Mantener el freno aplica el freno manual en lugar de esta penalización de curva.

En asfalto, el coche acelera automáticamente hasta el límite de velocidad de la pista, con una pequeña pérdida constante de velocidad. El límite global del juego es 140 km/h; cada circuito puede establecer un límite inferior. En Puerto del Lobo, `maxSpeed: 38.88` equivale aproximadamente a 140 km/h.

Si sales del asfalto, la superficie de tierra frena progresivamente el coche y limita la velocidad a unos 27 km/h. Si quedas parado fuera de pista y no frenas, el coche puede volver a acelerar hasta ese límite. El freno manual también funciona en tierra. El guardarraíl al exterior de la zona de tierra impide continuar campo a través: un impacto de frente puede detener el coche, pero aún puedes girar para orientar el vehículo y reanudar la marcha.

## Ajustes de dirección y curvas

El panel **Dirección y curvas**, bajo el juego, cambia la física inmediatamente, incluso durante una vuelta. Cada control muestra su valor actual y unidades; **Restablecer** recupera los valores iniciales. Los ajustes solo duran hasta recargar la página y no cambian el archivo del circuito.

| Parámetro | Inicial | Intervalo del slider | Efecto |
|---|---:|---:|---|
| Ángulo máximo a baja velocidad | 30° | 10–45° | Ángulo máximo de las ruedas antes de aplicar la reducción por velocidad. |
| Reducción de ángulo a velocidad punta | 65 % | 0–90 % | Porcentaje del ángulo máximo que se resta al alcanzar el límite de velocidad de la pista. |
| Respuesta al girar | 150°/s | 30–360°/s | Rapidez con la que las ruedas se orientan al mantener la dirección. |
| Velocidad al centrar ruedas | 180°/s | 30–360°/s | Rapidez con la que las ruedas vuelven al centro al soltar la dirección. |
| Inicio de pérdida por giro | 50 km/h | 0–120 km/h | Velocidad por debajo de la cual girar no añade desaceleración. |
| Frenado con giro máximo | 18 m/s² | 0–30 m/s² | Desaceleración adicional máxima por giro; se alcanza con el ángulo máximo al límite de velocidad de la pista. |

Estos controles sirven para probar combinaciones y leer los valores elegidos antes de fijarlos en el código. Para hacer permanentes unos valores, tras probarlos se deben trasladar a los valores iniciales de `TUNING_DEFAULTS` en `js/game.js`.

## Vueltas, cronómetro y récords

El cronómetro empieza al arrancar la etapa y la primera vuelta se mide desde la salida. Se registra una vuelta al cruzar la línea de salida/meta si el coche está sobre el asfalto, no está detenido contra el guardarraíl y atraviesa la línea en el sentido correcto. Un cruce fuera de pista, contra el muro o en sentido contrario no cuenta. Al terminar el número de vueltas configurado, la etapa se detiene y se muestra el mejor tiempo local.

El juego conserva las diez vueltas más rápidas del circuito en `localStorage` del navegador, ordenadas de menor a mayor tiempo. El almacenamiento es local a ese navegador y dispositivo; los tiempos no se envían a ningún servidor. **Borrar tiempos** elimina los récords locales de la pista actual, previa confirmación. Si el navegador no permite almacenamiento, los tiempos solo están disponibles durante la sesión.

## Circuitos y archivos

- `index.html`: interfaz, controles y orden de carga de los archivos.
- `styles.css`: presentación adaptable a escritorio y móvil.
- `js/game.js`: escena 3D, coche, cámara, físicas, cronómetro, tabla local y sliders de ajuste.
- `js/vendor/three.min.js`: motor Three.js incluido localmente.
- `js/vendor/THREE-LICENSE.txt`: licencia del motor.
- `js/tracks/mountain-pass.js`: configuración del circuito Puerto del Lobo.

El trazado se define por separado del motor para poder añadir o modificar circuitos.

### Añadir otro circuito

Crea un archivo JavaScript en `js/tracks/` que asigne `window.RALLY_TRACK` con estos campos:

- `id`: identificador único, también usado para separar los récords locales.
- `name`, `titleLines`, `stage`, `location` y `surface`: textos que aparecen en la interfaz.
- `roadWidth`: anchura de la carretera en metros.
- `maxSpeed`: límite del circuito en metros por segundo; no puede superar el límite global de 140 km/h.
- `targetLapSeconds`: referencia de duración aproximada de una vuelta; no cambia ni limita el cronómetro.
- `laps`: vueltas necesarias para completar la etapa.
- `points`: pares `[x, z]` que describen el trazado en orden.
- `courseScale` (opcional): escala global aplicada a los puntos del trazado.

El juego suaviza y cierra automáticamente el circuito a partir de los puntos. Añade el nuevo archivo como un `<script defer>` en `index.html`, después de Three.js y antes de `js/game.js`.
