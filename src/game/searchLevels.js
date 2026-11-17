// Chapter 2: explore the laboratory vault, then recover its shortest route.
const maze = [
  '........', '.###.##.', '...#....', '##.#.##.', '...#....',
  '.#####.#', '........', '.######.',
];
const fork = ['........', '.######.', '........', '.######.', '........', '.######.', '........', '........'];

export function shortestDistance(map, start, goal) {
  const queue = [[start.x, start.y, 0]], seen = new Set([`${start.x},${start.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const [x,y,d] = queue[i];
    if (x === goal.x && y === goal.y) return d;
    for (const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
      const nx=x+dx, ny=y+dy, k=`${nx},${ny}`;
      if (map[ny]?.[nx] && map[ny][nx] !== '#' && !seen.has(k)) { seen.add(k); queue.push([nx,ny,d+1]); }
    }
  }
  return Infinity;
}

const walkRoute = `
# แปลงเส้นทางพิกัดเป็นคำสั่งเดินจริง
for x, y in path[1:]:
    if x > get_x(): move_right()
    elif x < get_x(): move_left()
    elif y > get_y(): move_down()
    elif y < get_y(): move_up()
print("Route:", len(path) - 1, "steps")
`;

export const dfsCode = `# DFS: ลงลึกก่อน แล้วถอยกลับเมื่อเจอทางตัน
board = get_map()
target = get_target()
goal = (target["x"], target["y"])
visited = set()

def dfs(x, y):
    visited.add((x, y))
    mark(x, y, "visited")
    if (x, y) == goal:
        return [(x, y)]
    for dx, dy in [(1,0), (0,1), (-1,0), (0,-1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < 8 and 0 <= ny < 8:
            if board[ny][nx] != "#" and (nx, ny) not in visited:
                result = dfs(nx, ny)
                if result is not None:
                    return [(x, y)] + result
    return None

path = dfs(get_x(), get_y())
if path is None:
    raise ValueError("No route")
for x, y in path:
    mark(x, y, "path")
` + walkRoute;

export const bfsCode = `# BFS: คิว FIFO ขยายทีละชั้น จึงได้ทางสั้นสุดเมื่อทุกก้าวมีค่าเท่ากัน
from collections import deque
board = get_map()
target = get_target()
start = (get_x(), get_y())
goal = (target["x"], target["y"])
queue = deque([start])
parent = {start: None}
mark(*start, "frontier")

while queue:
    x, y = queue.popleft()
    mark(x, y, "visited")
    if (x, y) == goal:
        break
    for dx, dy in [(1,0), (0,1), (-1,0), (0,-1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < 8 and 0 <= ny < 8:
            if board[ny][nx] != "#" and (nx, ny) not in parent:
                parent[(nx, ny)] = (x, y)
                queue.append((nx, ny))
                mark(nx, ny, "frontier")

if goal not in parent:
    raise ValueError("No route")
path = []
node = goal
while node is not None:
    path.append(node)
    node = parent[node]
path.reverse()
for x, y in path:
    mark(x, y, "path")
` + walkRoute;

function goalCheck({world}, shortest=false, map=maze, start={x:0,y:0}, target={x:7,y:7}) {
  const optimum=shortestDistance(map,start,target);
  if(world.robot.x !== target.x || world.robot.y !== target.y) return {pass:false,message:'ยังไม่ถึงแท่นข้อมูล ลองตรวจทางตันและพิกัด map[y][x]'};
  if(shortest && world.stats.moves !== optimum) return {pass:false,message:`ถึงแล้ว แต่เดิน ${world.stats.moves} ก้าว ทางสั้นสุดคือ ${optimum} ก้าว ลองใช้คิว FIFO และ parent`};
  return {pass:true,message:`กู้ข้อมูลสำเร็จ! เดิน ${world.stats.moves} ก้าว · แสดงการค้นหา ${world.stats.explored} ช่อง · ทางสั้นสุด ${optimum} ก้าว`};
}

export const ch2Levels = [
  {
    id:'2-1', title:'เซนเซอร์ในห้องนิรภัย', theme:'lab', map:maze, start:{x:0,y:0}, target:{x:7,y:0},
    story:'ใต้ AP Lab มีห้องนิรภัยอัตโนมัติ เริ่มจากอ่านสถานะ: แต่ละพิกัดคือ state และการเดินคือ action แผนที่ใช้ . เป็นทางเดิน และ # เป็นกำแพง แกน y เพิ่มลงล่างเช่นเดียวกับบทที่ 1',
    objectives:['ไปที่แท่นข้อมูล (7, 0) โดยใช้เซนเซอร์ตรวจทาง','ทดลอง mark() เพื่อแสดงช่องที่สำรวจ'],
    concepts:['state = (x, y)','can_move(direction)','map[y][x]'],
    hint:'while get_x() < 7: ตรวจ can_move("right") แล้ว move_right() ในลูปเดียวกัน และ mark(get_x(), get_y())',
    starterCode:'# เติมคำสั่งเดินในลูป แทน break\nprint(get_map())\nwhile get_x() < 7:\n    if can_move("right"):\n        break  # TODO: เดินขวาและทำเครื่องหมายช่องใหม่\n    else:\n        break\n',
    check:({world})=>goalCheck({world},false,maze,{x:0,y:0},{x:7,y:0}),
  },
  {
    id:'2-2', title:'DFS · สำรวจลึกก่อน', theme:'lab', map:maze, start:{x:0,y:0}, target:{x:7,y:7},
    story:'DFS (Depth-First Search) สำรวจแขนงหนึ่งให้ลึกที่สุดก่อนย้อนกลับ เก็บ visited เพื่อไม่วนซ้ำ ด่านนี้มีโค้ดตัวอย่างที่รันได้ ลอง Step ดูลำดับสี แล้วสลับลำดับทิศเพื่อเปรียบเทียบเส้นทาง การค้นหาเป็นการวางแผน หุ่นยนต์จึงเริ่มเดินเมื่อได้ path แล้ว',
    objectives:['รัน DFS ไปยังแท่นข้อมูล (7, 7)','ลองสลับลำดับทิศและสังเกตว่า DFS ไม่รับประกันทางสั้นสุด'],
    concepts:['recursion','visited set','backtracking'], hint:'return None คือทางตัน เมื่อเรียกย้อนกลับจะลองทิศถัดไป สีฟ้า = visited, สีเขียว = path',
    starterCode:dfsCode, check:({world})=>goalCheck({world}),
  },
  {
    id:'2-3', title:'BFS · ค้นหาทีละชั้น', theme:'lab', map:maze, start:{x:0,y:0}, target:{x:7,y:7},
    story:'BFS (Breadth-First Search) ใช้คิว FIFO: ช่องที่เข้าก่อนถูกสำรวจก่อน ทำให้ค้นหาตามระยะจากจุดเริ่มต้น ในแผนที่ที่ทุกก้าวมีค่าเท่ากัน เส้นทางแรกถึงเป้าหมายจะสั้นที่สุด parent เก็บช่องก่อนหน้าไว้ย้อนสร้างเส้นทาง',
    objectives:['ไปถึง (7, 7) ด้วยจำนวนก้าวสั้นที่สุด','สังเกตสีทอง frontier → สีฟ้า visited → สีเขียว path'],
    concepts:['deque / FIFO','parent dictionary','shortest path'],hint:'popleft() ทำให้เป็น BFS ถ้าเปลี่ยนเป็น pop() จะกลายเป็นการเลือกแบบ stack ไม่รับประกันทางสั้นสุด',
    starterCode:bfsCode, check:({world})=>goalCheck({world},true),
  },
  {
    id:'2-4', title:'ภารกิจกู้ข้อมูล · เลือกอัลกอริทึม', theme:'lab', map:fork, start:{x:0,y:0}, target:{x:0,y:7},
    story:'แผนที่ใหม่มีทางแยกที่ล่อให้ DFS เดินอ้อม ภารกิจนี้ให้คุณนำ BFS จากด่านก่อนมาปรับใช้เอง ต้องไปถึงแท่นข้อมูลด้วยก้าวเดินสั้นที่สุด ตัวตรวจวัดผลจากเส้นทางเดินจริง ไม่บังคับวิธีเขียนโค้ด',
    objectives:['ไปยัง (0, 7) โดยใช้ 7 ก้าว','เขียนการค้นหาและย้อนสร้าง path ด้วยตัวเอง'],
    concepts:['นำอัลกอริทึมไปใช้กับแผนที่ใหม่','compare DFS / BFS','path reconstruction'],hint:'ใช้ BFS จากด่าน 2-3 ได้โดยไม่ต้องแก้พิกัดตายตัว เพราะ get_target() และ get_map() อ่านแผนที่ปัจจุบัน',
    starterCode:'# สร้าง BFS ของคุณเอง โดยใช้ API ด้านล่าง\nfrom collections import deque\nboard = get_map()\ntarget = get_target()\nstart = (get_x(), get_y())\ngoal = (target["x"], target["y"])\n# TODO: queue, parent, ค้นหา, ย้อนเส้นทาง แล้วสั่งเดิน\n',
    check:({world})=>goalCheck({world},true,fork,{x:0,y:0},{x:0,y:7}),
  },
];
