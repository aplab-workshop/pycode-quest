// Chapter 3: Heuristic Algorithms — terrain with different energy costs.
// Map legend: . grass(1)  d sand(2)  m mud(4)  ^ snow(7)  # rock(impassable)

// 8x8 intro map: a mud tunnel straight ahead vs. a cheap grass detour.
const passMap = [
  '........',
  '.######.',
  '.mmmmmm.',
  '.######.',
  '........',
  '..d..d..',
  '........',
  '........',
];

// 12x12 ridge: a mud/snow mountain band blocks the straight line; the far
// top row is pure grass. Greedy dives through the band, A* goes around.
const ridgeMap = [
  '............',
  '...mmmmmm...',
  '...mmmmmm...',
  '...mm^^mm...',
  '...mm^^mm...',
  '...mm^^mm...',
  '...mm^^mm...',
  '...mm^^mm...',
  '...mmmmmm...',
  '...mmmmmm...',
  '...mmmmmm...',
  '...mmmmmm...',
];

// 12x12 canyon for the final challenge: a thick mountain wall with three
// passes — mud (west), snow chimney (middle, fewest steps), sand (east).
// Shortest-in-steps route costs 30; the cheapest route (east) costs 25.
const canyonMap = [
  '............',
  '........mm..',
  '........mm..',
  '............',
  'm####^#####d',
  'm####^#####d',
  'm####^#####d',
  '............',
  '..mm........',
  '..mm........',
  '............',
  '............',
];

const CH_COST = { '.': 1, ',': 1, d: 2, m: 4, '^': 7 };

/** Dijkstra over the raw map strings -> cheapest possible energy. */
export function cheapestCost(map, start, goal) {
  const H = map.length;
  const W = map[0].length;
  const dist = Array.from({ length: H }, () => Array(W).fill(Infinity));
  dist[start.y][start.x] = 0;
  const pq = [[0, start.x, start.y]];
  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [d, x, y] = pq.splice(bi, 1)[0];
    if (d > dist[y][x]) continue;
    if (x === goal.x && y === goal.y) return d;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const ch = map[ny]?.[nx];
      if (!ch || ch === '#') continue;
      const nd = d + (CH_COST[ch] ?? 1);
      if (nd < dist[ny][nx]) {
        dist[ny][nx] = nd;
        pq.push([nd, nx, ny]);
      }
    }
  }
  return Infinity;
}

/** Fewest-steps (BFS) route cost — used to show that short != cheap. */
export function bfsRouteCost(map, start, goal) {
  const queue = [[start.x, start.y]];
  const parent = { [`${start.x},${start.y}`]: null };
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x === goal.x && y === goal.y) break;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const ch = map[ny]?.[nx];
      const k = `${nx},${ny}`;
      if (ch && ch !== '#' && !(k in parent)) {
        parent[k] = `${x},${y}`;
        queue.push([nx, ny]);
      }
    }
  }
  let k = `${goal.x},${goal.y}`;
  if (!(k in parent)) return Infinity;
  let cost = 0;
  while (parent[k] !== null) {
    const [x, y] = k.split(',').map(Number);
    cost += CH_COST[map[y][x]] ?? 1;
    k = parent[k];
  }
  return cost;
}

function energyCheck(map, start, target, { strict = true, greedyNote = false } = {}) {
  const best = cheapestCost(map, start, target);
  return ({ world }) => {
    const { x, y } = world.robot;
    const e = world.stats.energy;
    if (x !== target.x || y !== target.y) {
      return { pass: false, message: `ยังไม่ถึงเป้าหมาย (${target.x}, ${target.y}) — ตอนนี้โดรนอยู่ที่ (${x}, ${y})` };
    }
    if (strict && e > best) {
      return {
        pass: false,
        message: `ถึงเป้าหมายแล้ว แต่ใช้พลังงาน ${e} หน่วย เส้นทางประหยัดสุดใช้แค่ ${best} หน่วย ลองดูตารางพลังงานแล้วเลี่ยงช่องแพง`,
      };
    }
    const extra = greedyNote
      ? e > best
        ? ` (ประหยัดสุดคือ ${best} หน่วย — Greedy หาเจอเร็วแต่ไม่สนราคา เดี๋ยว A* จะแก้เรื่องนี้)`
        : ' (รอบนี้ Greedy บังเอิญได้ทางถูกสุดพอดี)'
      : ` เท่ากับเส้นทางประหยัดสุดพอดี!`;
    return {
      pass: true,
      message: `ถึงเป้าหมาย! ใช้พลังงาน ${e} หน่วย · เดิน ${world.stats.moves} ก้าว · แสดงการค้นหา ${world.stats.explored} ช่อง${extra}`,
    };
  };
}

const walkRoute = `
# แปลงเส้นทางเป็นคำสั่งเดินจริง
for x, y in path[1:]:
    if x > get_x(): move_right()
    elif x < get_x(): move_left()
    elif y > get_y(): move_down()
    elif y < get_y(): move_up()
print("พลังงานที่ใช้เดินจริง:", get_energy(), "หน่วย")
`;

export const greedyCode = `# Greedy Best-First: เลือกช่องที่ heuristic บอกว่า "ใกล้เป้าหมายสุด" ก่อนเสมอ
import heapq
board = get_map()
target = get_target()
start = (get_x(), get_y())
goal = (target["x"], target["y"])
size = get_world_size()

def h(x, y):
    # heuristic: ระยะแมนฮัตตัน = เดาจำนวนก้าวที่เหลือ (ไม่สนพื้นผิวและกำแพง)
    return abs(x - goal[0]) + abs(y - goal[1])

frontier = [(h(*start), start)]
parent = {start: None}
while frontier:
    _, (x, y) = heapq.heappop(frontier)
    mark(x, y, "visited")
    if (x, y) == goal:
        break
    for dx, dy in [(1,0), (0,1), (-1,0), (0,-1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < size and 0 <= ny < size:
            if board[ny][nx] != "#" and (nx, ny) not in parent:
                parent[(nx, ny)] = (x, y)
                heapq.heappush(frontier, (h(nx, ny), (nx, ny)))
                mark(nx, ny, "frontier")

path = []
node = goal
while node is not None:
    path.append(node)
    node = parent[node]
path.reverse()
for x, y in path:
    mark(x, y, "path")
` + walkRoute;

export const astarCode = `# A*: f = g (พลังงานที่จ่ายจริง) + h (ค่าเดาที่เหลือ) ได้ทางถูกสุดแบบฉลาด
import heapq
board = get_map()
cost = get_cost_map()
target = get_target()
start = (get_x(), get_y())
goal = (target["x"], target["y"])
size = get_world_size()

def h(x, y):
    # ระยะแมนฮัตตัน ไม่เคยเดาเกินจริง (ทุกก้าวแพงอย่างน้อย 1) จึงรับประกันทางถูกสุด
    return abs(x - goal[0]) + abs(y - goal[1])

open_heap = [(h(*start), 0, start)]
g = {start: 0}
parent = {start: None}
done = set()
while open_heap:
    f, gc, (x, y) = heapq.heappop(open_heap)
    if (x, y) in done:
        continue
    done.add((x, y))
    mark(x, y, "visited")
    if (x, y) == goal:
        break
    for dx, dy in [(1,0), (0,1), (-1,0), (0,-1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < size and 0 <= ny < size and board[ny][nx] != "#":
            ng = gc + cost[ny][nx]
            if (nx, ny) not in g or ng < g[(nx, ny)]:
                g[(nx, ny)] = ng
                parent[(nx, ny)] = (x, y)
                heapq.heappush(open_heap, (ng + h(nx, ny), ng, (nx, ny)))
                if (nx, ny) not in done:
                    mark(nx, ny, "frontier")

if goal not in parent:
    raise ValueError("ไปไม่ถึงเป้าหมาย")
path = []
node = goal
while node is not None:
    path.append(node)
    node = parent[node]
path.reverse()
for x, y in path:
    mark(x, y, "path")
print("ค่าเส้นทางที่วางแผนไว้:", g[goal], "หน่วย")
` + walkRoute;

export const ch3Levels = [
  {
    id: '3-1',
    title: 'แผนที่พลังงาน',
    theme: 'peak',
    map: passMap,
    start: { x: 0, y: 2 },
    target: { x: 7, y: 2 },
    story:
      'โดรนขึ้นมาสำรวจเชิงเขาแล้ว บนนี้แต่ละช่องใช้พลังงานไม่เท่ากัน: หญ้า 1 ทราย 2 โคลน 4 หิมะ 7 หน่วย (ตัวเลขบนพื้น) ทางตรงข้างหน้าเป็นอุโมงค์โคลนล้วน โค้ดเริ่มต้นเดินทะลุไปเลย — รันดูก่อนว่าเปลืองแค่ไหน แล้วหาเส้นทางที่ถูกกว่า',
    objectives: [
      'ไปถึงแท่นเป้าหมาย (7, 2) โดยใช้พลังงานน้อยที่สุด',
      'ลองอ่าน get_cost_map() และ scan()["cost"] ประกอบการตัดสินใจ',
    ],
    concepts: ['get_cost_map()', 'get_energy()', 'cost ของ state ไม่เท่ากัน'],
    hint: 'อุโมงค์โคลนตรงกลางราคา 6×4 = 24 หน่วย แต่แถวบนสุด (y = 0) เป็นหญ้าล้วน อ้อมขึ้น-ขวา-ลงใช้แค่ 11 หน่วย',
    starterCode:
      '# หญ้า 1, ทราย 2, โคลน 4, หิมะ 7 หน่วย — ดูได้จากตารางพลังงาน\ncost = get_cost_map()\nprint("แถวที่โดรนยืน:", cost[get_y()])\nprint("ช่องปัจจุบัน:", scan()["cost"], "หน่วย")\n\n# เส้นทางตรง: มุดอุโมงค์โคลน 6 ช่อง (ลองรันดูพลังงานก่อน แล้วค่อยแก้)\nwhile get_x() < 7:\n    move_right()\nprint("พลังงานที่ใช้:", get_energy(), "หน่วย")\n',
    check: energyCheck(passMap, { x: 0, y: 2 }, { x: 7, y: 2 }),
  },
  {
    id: '3-2',
    title: 'Greedy Best-First · เร็วแต่หลงกล',
    theme: 'peak',
    map: ridgeMap,
    start: { x: 0, y: 5 },
    target: { x: 11, y: 5 },
    story:
      'แผนที่ใหญ่ขึ้นเป็น 12x12 มีเทือกเขาโคลนและหิมะขวางกลาง Greedy Best-First ใช้ heuristic อย่างเดียว: หยิบช่องที่ "ดูใกล้เป้าหมายสุด" จากคิวลำดับความสำคัญ (heapq) มาก่อนเสมอ มันจึงพุ่งตรงเข้าภูเขาโดยไม่สนราคา รัน Step ดูลำดับการค้นหา แล้วสังเกตพลังงานที่เสียไป',
    objectives: [
      'รัน Greedy ไปถึงแท่นเป้าหมาย (11, 5)',
      'สังเกตว่าสำรวจน้อยช่องมาก แต่เส้นทางแพงเพราะ h ไม่รู้จักราคาพื้น',
    ],
    concepts: ['heuristic h(n)', 'ระยะแมนฮัตตัน', 'heapq / priority queue'],
    hint: 'ลองแก้ h ให้ return 0 ดู จะกลายเป็นการค้นหาแบบไม่มีเข็มทิศ (สำรวจบานขึ้นมาก) — heuristic คือเข็มทิศ แต่เข็มทิศอย่างเดียวไม่เห็นหล่มโคลน',
    starterCode: greedyCode,
    check: energyCheck(ridgeMap, { x: 0, y: 5 }, { x: 11, y: 5 }, { strict: false, greedyNote: true }),
  },
  {
    id: '3-3',
    title: 'A* Search · ถูกสุดและฉลาด',
    theme: 'peak',
    map: ridgeMap,
    start: { x: 0, y: 5 },
    target: { x: 11, y: 5 },
    story:
      'A* รวมสองโลก: g = พลังงานที่จ่ายจริงจากจุดเริ่ม (อ่านจาก get_cost_map) และ h = ค่าเดาที่เหลือ จัดคิวตาม f = g + h ถ้า h ไม่เดาเกินจริง (admissible) A* รับประกันเส้นทางถูกสุด แถมสำรวจน้อยกว่า Dijkstra (ลองลบ h ออกจาก f ดูจะเห็นว่าสำรวจบานกว่า)',
    objectives: [
      'ไปถึง (11, 5) ด้วยพลังงานต่ำสุด',
      'เทียบกับด่านก่อน: A* สำรวจมากกว่า Greedy แต่ได้ทางถูกกว่ามาก',
    ],
    concepts: ['f = g + h', 'admissible heuristic', 'Dijkstra = A* ที่ h=0'],
    hint: 'โค้ดนี้รันผ่านได้เลย ลองทดลอง: เปลี่ยน f เป็น gc อย่างเดียว (Dijkstra) หรือ h อย่างเดียว (Greedy) แล้วเทียบจำนวนช่องสีฟ้ากับพลังงานที่ใช้',
    starterCode: astarCode,
    check: energyCheck(ridgeMap, { x: 0, y: 5 }, { x: 11, y: 5 }),
  },
  {
    id: '3-4',
    title: 'ภารกิจข้ามเทือกเขา',
    theme: 'peak',
    map: canyonMap,
    start: { x: 5, y: 11 },
    target: { x: 6, y: 0 },
    story:
      'ด่านสุดท้ายของบท: เทือกเขาหินหนา 3 แถวขวางทาง มีช่องเขาให้ลอด 3 ช่อง — โคลนตะวันตก หิมะตรงกลาง ทรายตะวันออก เส้นทางก้าวน้อยสุด (ลอดหิมะ) ไม่ใช่เส้นทางถูกสุด! เขียน A* ของคุณเองพาโดรนไปแท่นเป้าหมายด้วยพลังงานต่ำที่สุด',
    objectives: [
      'ไปถึง (6, 0) ด้วยพลังงานต่ำสุด',
      'เขียน A* เอง: heapq, dict g, dict parent แล้วย้อนสร้าง path',
    ],
    concepts: ['นำ A* ไปใช้แผนที่ใหม่', 'เปรียบเทียบ "สั้นสุด" กับ "ถูกสุด"', 'path reconstruction'],
    hint: 'โค้ด A* จากด่าน 3-3 เขียนแบบอ่านแผนที่ปัจจุบันอยู่แล้ว (get_map, get_cost_map, get_target) นำมาปรับใช้ได้เลย ระวังช่อง None ในตารางพลังงานคือกำแพง — กรองด้วย board[ny][nx] != "#" ก่อนบวก',
    starterCode:
      '# เขียน A* ของคุณเอง: f = g + h\nimport heapq\nboard = get_map()\ncost = get_cost_map()\ntarget = get_target()\nstart = (get_x(), get_y())\ngoal = (target["x"], target["y"])\nsize = get_world_size()\n\ndef h(x, y):\n    return abs(x - goal[0]) + abs(y - goal[1])\n\n# TODO: open_heap = [(h(*start), 0, start)], dict g, dict parent\n# TODO: วนหยิบค่า f ต่ำสุด ขยายเพื่อนบ้าน อัปเดต g เมื่อถูกกว่า\n# TODO: ย้อน parent สร้าง path แล้วสั่งเดิน\n',
    check: energyCheck(canyonMap, { x: 5, y: 11 }, { x: 6, y: 0 }),
  },
];
