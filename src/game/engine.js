/**
 * Game engine: plain-data world state + robot actions.
 * Used by the Python worker (to simulate while code runs) and by the UI (to draw).
 *
 * Coordinates: x grows to the right, y grows downward, (0, 0) is the top-left cell.
 */

export const GROW_TICKS = 5; // ticks a planted wheat needs before it is ripe
export const ACTION_LIMIT = 3000; // max timed actions per run
export const QUERY_LIMIT = 200000; // max free queries (scan/get_x...) per run, catches busy loops

// Map legend used in level definitions
const LEGEND = {
  '.': () => ({ type: 'grass' }),
  ',': () => ({ type: 'soil' }),
  w: () => ({ type: 'wheat', growth: GROW_TICKS }),
  s: () => ({ type: 'wheat', growth: 0 }),
  T: () => ({ type: 'tree' }),
  O: () => ({ type: 'ore' }),
  '#': () => ({ type: 'rock' }),
};

const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function createWorld(level) {
  const cells = level.map.map((row) =>
    [...row].map((ch) => {
      const make = LEGEND[ch];
      if (!make) throw new Error(`Unknown map symbol "${ch}" in level ${level.id}`);
      return make();
    })
  );
  const start = level.start || { x: 0, y: 0 };
  return {
    width: cells[0].length,
    height: cells.length,
    cells,
    robot: { x: start.x, y: start.y, dir: 'right' },
    target: level.target ? { ...level.target } : null,
    inventory: { wheat: 0, wood: 0, ore: 0 },
    tick: 0,
  };
}

export function cloneWorld(world) {
  return structuredClone(world);
}

export function isRipe(cell) {
  return cell.type === 'wheat' && cell.growth >= GROW_TICKS;
}

function passTime(world) {
  world.tick += 1;
  for (const row of world.cells) {
    for (const cell of row) {
      if (cell.type === 'wheat' && cell.growth < GROW_TICKS) cell.growth += 1;
    }
  }
}

/**
 * Perform one API call on the world (mutates it).
 * Returns { value, timed, action, detail }:
 *   value  - what Python receives
 *   timed  - true if it costs one tick and becomes an animation step in the queue
 *   action - animation kind: move | bump | harvest | plant | fail
 */
export function performAction(world, name, arg) {
  const { robot } = world;
  const here = world.cells[robot.y][robot.x];

  switch (name) {
    case 'move': {
      const d = DIRS[arg];
      if (!d) throw new Error(`Unknown direction: ${arg}`);
      const nx = robot.x + d[0];
      const ny = robot.y + d[1];
      robot.dir = arg;
      const inside = nx >= 0 && ny >= 0 && nx < world.width && ny < world.height;
      const free = inside && world.cells[ny][nx].type !== 'rock';
      if (free) {
        robot.x = nx;
        robot.y = ny;
      }
      passTime(world);
      return {
        value: free,
        timed: true,
        action: free ? 'move' : 'bump',
        detail: free ? null : inside ? 'ชนหิน' : 'ชนขอบแผนที่',
      };
    }

    case 'harvest': {
      let got = null;
      if (isRipe(here)) {
        got = 'wheat';
        world.cells[robot.y][robot.x] = { type: 'soil' };
      } else if (here.type === 'tree') {
        got = 'wood';
        world.cells[robot.y][robot.x] = { type: 'grass' };
      } else if (here.type === 'ore') {
        got = 'ore';
        world.cells[robot.y][robot.x] = { type: 'grass' };
      }
      if (got) world.inventory[got] += 1;
      passTime(world);
      return { value: Boolean(got), timed: true, action: got ? 'harvest' : 'fail', detail: got };
    }

    case 'plant': {
      const ok = here.type === 'soil';
      if (ok) world.cells[robot.y][robot.x] = { type: 'wheat', growth: 0 };
      passTime(world);
      return { value: ok, timed: true, action: ok ? 'plant' : 'fail', detail: ok ? 'wheat' : null };
    }

    case 'scan':
      return {
        value: {
          type: here.type,
          ripe: isRipe(here),
          growth: here.type === 'wheat' ? here.growth : 0,
          x: robot.x,
          y: robot.y,
        },
        timed: false,
      };

    case 'get_x':
      return { value: robot.x, timed: false };
    case 'get_y':
      return { value: robot.y, timed: false };
    case 'get_world_size':
      return { value: world.width, timed: false };

    default:
      throw new Error(`Unknown API call: ${name}`);
  }
}
