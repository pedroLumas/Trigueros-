# Tigre Incremental — prototipo jugable

Prototipo en HTML5 + JavaScript (canvas 2D, sin dependencias) para comprobar si
este ciclo es divertido:

> mover al tigre → encontrar animales → atacarlos → matarlos → pasar por encima
> de los cadáveres → conseguir sangre y recuperar vida → comprar mejoras → cazar
> más eficientemente.

## Cómo jugar

Abre `index.html` en cualquier navegador moderno (doble clic basta; no necesita
servidor ni instalación).

| Control | Acción |
| --- | --- |
| Clic izquierdo en el suelo | El tigre camina hasta ese punto. Si ve una presa delante, se desvía, la caza y sigue hacia el destino. |
| Clic izquierdo en un animal | Lo persigue y lo ataca hasta matarlo. |
| Sin órdenes | Se queda quieto y ataca lo que entre en su radio de detección. |
| Clic derecho | Zarpazo sangriento hacia el cursor (30 de daño en arco de 100°, alcance 85, recarga 10 s). |
| `T` o botón «Mejoras» | Abre o cierra las mejoras (el juego se pausa). |
| `F1` o botón «Depuración» | Panel de depuración. |
| `Esc` | Cierra el panel de mejoras. |

Los cadáveres **no** se recogen al matar: hay que pasar por encima. Al devorarlos
se gana sangre y se recupera un 5 % de la vida máxima. Duran 20 s y se van
desvaneciendo; un arco fino alrededor indica el tiempo restante.

## Estructura del código

```
index.html        Escenario, HUD y paneles (HTML sobre el canvas)
css/style.css     Estilo de la interfaz
js/config.js      ⚙️  TODOS los parámetros de equilibrio
js/utils.js       Matemáticas y atajos de dibujo
js/events.js      Bus de eventos para desacoplar sistemas
js/effects.js     Números flotantes, marcadores, zarpazos, partículas
js/arena.js       Límites del claro y decorado prerrenderizado
js/combat.js      Resolución de golpes y del zarpazo sangriento
js/animals.js     Entidad Animal, IA por comportamiento y dibujo
js/tiger.js       Controlador del tigre estilo RTS (órdenes, persecución, ataque)
js/spawner.js     Aparición continua de animales
js/corpses.js     Cadáveres y recogida
js/economy.js     Sangre
js/upgrades.js    Las cuatro mejoras y su fórmula de precio
js/input.js       Ratón y teclado → órdenes
js/ui.js          HUD, panel de mejoras y pantalla de muerte
js/debug.js       Panel de depuración (F1)
js/game.js        Bucle principal, colisiones y renderizado
js/main.js        Arranque
```

Los scripts son clásicos (no módulos ES) para que el juego funcione abriendo el
archivo directamente con `file://`.

## Ajustar el equilibrio

Todo está en `js/config.js`. Lo más útil para experimentar:

- `tiger.detectionRadius` (120) y `tiger.maxChaseDistance` (260): cuánto «ve» y
  cuánto persigue el tigre por su cuenta. La distancia de persecución se cuenta
  desde el último golpe acertado, así que nunca abandona a una presa que está
  alcanzando.
- `tiger.moveAcquireConeDegrees` (160): al caminar, solo se desvía por presas
  que tiene delante. Así el jugador puede alejarse de un jabalí sin que el tigre
  se dé la vuelta. Con `360` se desvía por cualquier animal cercano.
- `animals.*`: vida, daño, sangre, velocidades, distancia de miedo, aguante al
  huir, tiempos de la embestida del ciervo…
- `spawner`: ritmo de aparición, máximo de animales y probabilidades.
- `upgrades`: coste inicial, efecto por nivel y `priceGrowth` (1,35).
- `combat.hitSlowDuration`: el frenazo breve de un animal al recibir un golpe.
  Ayuda a rematar presas que huyen (ponlo a `0` para quitarlo).

## Comportamiento de los animales

| Animal | Vida | Daño | Sangre | Comportamiento |
| --- | --- | --- | --- | --- |
| Conejo | 15 | 0 | 5 | Deambula despacio; huye en zigzag si el tigre se acerca y se cansa pronto. |
| Antílope | 35 | 0 | 12 | Más rápido; detecta al tigre desde lejos y huye; se cansa tras unos segundos. |
| Jabalí | 65 | 8 | 25 | Deambula; si le atacan, persigue y muerde durante una distancia limitada. |
| Ciervo | 90 | 14 | 40 | Deambula; si le atacan, se coloca, avisa con una franja roja y embiste. Después queda aturdido. |

La embestida del ciervo sigue al tigre durante la preparación, pero deja de
apuntar en el último cuarto de segundo: moverse de lado en ese momento la esquiva.

## Lo que se ha medido

Simulaciones de 5 minutos con los valores del documento:

- Persecución de un conejo: ~2,8 s. De un antílope: ~5,3 s. Ninguna abandonada.
- Combate contra un jabalí con el tigre inicial y sin esquivar: −32 de vida en ~6 s.
  Contra un ciervo: −42 de vida en ~9 s.
- Un jugador simulado lento (decide cada 1,2 s, sin zarpazo) muere en el primer
  minuto 1 de cada 6 veces. El resto llega a los 5 minutos con ~22 mejoras y
  ~220 de vida máxima.
- **Primera mejora:** entre 10 y 25 s, antes de los 30–60 s buscados. Con los
  precios y la sangre del documento (Garras cuesta 15 y un jabalí da 25), basta
  con uno o dos animales. Para retrasarla: sube `baseCost`, baja la sangre de los
  animales o pon `spawner.initialAnimals` a `0`.

## Fuera del alcance (a propósito)

Sin quiebras, prestigio, multiplicadores, jefes, fases, zonas, skins,
evoluciones, misiones, logros, guardado ni progreso sin conexión.
