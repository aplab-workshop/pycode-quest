import { ch2Levels } from './searchLevels.js';
/**
 * Curriculum: chapters -> levels.
 *
 * Level fields:
 *   map        8 strings of 8 chars, legend:
 *              .=grass  ,=soil  w=ripe wheat  s=sprout  T=tree  O=ore  #=rock
 *   start      robot start cell {x, y}
 *   target     optional flag cell {x, y}
 *   objectives list of goal texts shown to the player
 *   check({ world, output, initialWorld }) -> { pass, message }
 */

const GRASS_ROW = '........';

const ch1Levels = [
  {
    id: '1-1',
    title: 'Hello world!!',
    story:
      'หุ่นยนต์ฟาร์มของคุณเพิ่งเปิดเครื่อง มันรอคำสั่งแรกอยู่ ทักทายโลกด้วยคำสั่ง print() เพื่อทดสอบว่าระบบสื่อสารทำงาน',
    objectives: ['แสดงข้อความ Hello world!! ใน Console'],
    concepts: ['print()', 'ข้อความ (string) อยู่ในเครื่องหมายคำพูด'],
    hint: 'print("Hello world!!")  สะกดและวางเครื่องหมาย ! ให้ครบ 2 ตัว',
    starterCode: '# คำสั่งแรกของหุ่นยนต์: พิมพ์ข้อความลง Console\n',
    map: [
      'T......T',
      GRASS_ROW,
      '..,,,,..',
      '..,ww,..',
      '..,ww,..',
      '..,,,,..',
      GRASS_ROW,
      'T......T',
    ],
    start: { x: 1, y: 1 },
    check: ({ output }) => {
      if (output.some((l) => l.trim() === 'Hello world!!')) {
        return { pass: true, message: 'ระบบสื่อสารออนไลน์! หุ่นยนต์ทักทายโลกสำเร็จ' };
      }
      if (output.length === 0) {
        return { pass: false, message: 'Console ยังว่างอยู่ ลองใช้ print("...")' };
      }
      return { pass: false, message: 'ข้อความยังไม่ตรง ต้องเป็น Hello world!! เป๊ะ ๆ (ตัวพิมพ์เล็ก-ใหญ่และ ! สองตัว)' };
    },
  },
  {
    id: '1-2',
    title: 'ก้าวแรกของหุ่นยนต์',
    story:
      'ธงสีแดงคือจุดชาร์จแบตเตอรี่ พาหุ่นยนต์ไปที่ธง โดยสั่งเดินทีละช่องด้วย move_right() และ move_down()',
    objectives: ['พาหุ่นยนต์ไปยืนบนธง 🚩 ที่พิกัด (4, 3)', 'พิมพ์ "Hello world!!" เมื่อถึงธง'],
    concepts: ['move_right()', 'move_down()', 'โค้ดทำงานจากบนลงล่างทีละบรรทัด'],
    hint: 'ต้องเดินขวา 4 ครั้งและลง 3 ครั้ง ลำดับไหนก็ได้ แล้วปิดท้ายด้วย print("Hello world!!")',
    starterCode: '# พาหุ่นยนต์ไปที่ธง 🚩\nmove_right()\nmove_down()\n',
    map: [
      GRASS_ROW,
      '......T.',
      '..T.....',
      GRASS_ROW,
      '.T......',
      '.....T..',
      GRASS_ROW,
      'T......T',
    ],
    start: { x: 0, y: 0 },
    target: { x: 4, y: 3 },
    check: ({ world, output }) => {
      const atFlag = world.robot.x === world.target.x && world.robot.y === world.target.y;
      const said = output.some((l) => l.trim() === 'Hello world!!');
      if (atFlag && said) return { pass: true, message: 'ถึงจุดชาร์จแล้ว แบตเต็ม 100%!' };
      if (!atFlag) {
        return {
          pass: false,
          message: `หุ่นยนต์อยู่ที่ (${world.robot.x}, ${world.robot.y}) แต่ธงอยู่ที่ (${world.target.x}, ${world.target.y})`,
        };
      }
      return { pass: false, message: 'ถึงธงแล้ว เหลือพิมพ์ Hello world!! อีกนิด' };
    },
  },
  {
    id: '1-3',
    title: 'ลูป for: เก็บข้าวทั้งแถว',
    story:
      'แถวบนสุดมีข้าวสาลีสุกพร้อมเก็บ 8 ต้น การเขียน harvest() กับ move_right() ซ้ำ 8 รอบมันเหนื่อย ให้ลูป for ทำงานซ้ำแทน',
    objectives: ['เก็บข้าวสาลี 🌾 ให้ได้อย่างน้อย 8 ต้น'],
    concepts: ['ตัวแปร', 'for i in range(n):', 'การย่อหน้า (indent) ของบล็อกลูป'],
    hint: 'ในลูปให้มี 2 บรรทัด: harvest() แล้วตามด้วย move_right()',
    starterCode:
      '# เก็บข้าวสาลีทั้งแถว\nsteps = 8\nfor i in range(steps):\n    harvest()\n    # จากนั้นเดินไปช่องถัดไป\n',
    map: ['wwwwwwww', GRASS_ROW, '.T....T.', GRASS_ROW, GRASS_ROW, '..T..T..', GRASS_ROW, GRASS_ROW],
    start: { x: 0, y: 0 },
    check: ({ world }) =>
      world.inventory.wheat >= 8
        ? { pass: true, message: `เก็บได้ ${world.inventory.wheat} ต้น! ลูปช่วยให้โค้ดสั้นลงมาก` }
        : { pass: false, message: `เก็บได้ ${world.inventory.wheat}/8 ต้น ตรวจว่าเดินครบทุกช่องหรือยัง` },
  },
  {
    id: '1-4',
    title: 'ลูป while กับพิกัด',
    story:
      'มีแร่ 💎 อยู่ตามทางในแถวที่ 3 หุ่นยนต์ไม่รู้ว่าต้องเดินกี่ก้าว แต่รู้พิกัดของตัวเองจาก get_x() ใช้ while เดินไปจนสุดขอบขวา',
    objectives: ['เก็บแร่ 💎 ให้ครบ 4 ก้อน', 'จบที่ขอบขวาสุด (x = 7)'],
    concepts: ['while เงื่อนไข:', 'get_x()', 'ตัวดำเนินการเปรียบเทียบ <'],
    hint: 'while get_x() < 7:  ข้างในให้ harvest() แล้ว move_right()',
    starterCode: '# เดินไปทางขวาจนสุดแผนที่\nwhile get_x() < 7:\n    move_right()\n',
    map: [GRASS_ROW, '.T....T.', GRASS_ROW, '.O.OO.O.', GRASS_ROW, '...T....', GRASS_ROW, 'T......T'],
    start: { x: 0, y: 3 },
    check: ({ world }) => {
      const ore = world.inventory.ore;
      if (ore >= 4 && world.robot.x === 7) return { pass: true, message: 'เก็บแร่ครบและไปถึงขอบขวาแล้ว!' };
      if (ore < 4) return { pass: false, message: `ได้แร่ ${ore}/4 ก้อน ต้องสั่ง harvest() ในช่องที่มีแร่ด้วย` };
      return { pass: false, message: `แร่ครบแล้ว แต่หุ่นยนต์ยังอยู่ที่ x = ${world.robot.x}` };
    },
  },
  {
    id: '1-5',
    title: 'เงื่อนไข if-else',
    story:
      'แถวนี้ปนกันระหว่างข้าวที่สุกแล้วกับดินว่าง ใช้ scan() ดูช่องที่ยืนอยู่ แล้วตัดสินใจ: ข้าวสุกให้เก็บ ดินว่างให้ปลูก',
    objectives: ['เก็บข้าวสุกทั้งหมด 4 ต้น', 'ปลูกข้าวในดินว่างทั้ง 4 ช่อง'],
    concepts: ['scan() คืนค่า dict', 'if / elif / else', '== เปรียบเทียบค่า'],
    hint: 'info = scan()  แล้ว if info["ripe"]: harvest()  elif info["type"] == "soil": plant()',
    starterCode:
      '# สำรวจทีละช่อง แล้วตัดสินใจ\nfor i in range(8):\n    info = scan()\n    print(info)\n    # ถ้าข้าวสุก (info["ripe"]) ให้ harvest()\n    # ถ้าเป็นดินว่าง (info["type"] == "soil") ให้ plant()\n    move_right()\n',
    map: [GRASS_ROW, '.T....T.', 'w,ww,,w,', GRASS_ROW, GRASS_ROW, '..T..T..', GRASS_ROW, GRASS_ROW],
    start: { x: 0, y: 2 },
    check: ({ world, initialWorld }) => {
      const row = 2;
      let planted = 0;
      let soil = 0;
      initialWorld.cells[row].forEach((c, x) => {
        if (c.type === 'soil') {
          soil += 1;
          if (world.cells[row][x].type === 'wheat') planted += 1;
        }
      });
      const wheat = world.inventory.wheat;
      if (wheat >= 4 && planted === soil) return { pass: true, message: 'หุ่นยนต์ตัดสินใจถูกทุกช่อง!' };
      return { pass: false, message: `เก็บข้าว ${wheat}/4 ต้น, ปลูกในดินว่าง ${planted}/${soil} ช่อง` };
    },
  },
  {
    id: '1-6',
    title: 'ฟาร์มอัตโนมัติ',
    story:
      'ภารกิจสุดท้ายของบทที่ 1 ทั้งแผนที่เป็นดินเปล่า ข้าวต้องใช้เวลา 5 จังหวะจึงจะสุก (ทุกคำสั่งที่หุ่นยนต์ทำคือ 1 จังหวะ) เขียนโปรแกรมให้หุ่นยนต์ปลูกและเก็บเกี่ยวเองอัตโนมัติ',
    objectives: ['สะสมข้าวสาลี 🌾 ให้ได้อย่างน้อย 32 ต้น'],
    concepts: ['ลูปซ้อนลูป (nested loop)', 'รวม for / while / if เข้าด้วยกัน', 'ฟังก์ชันของตัวเองด้วย def'],
    hint:
      'ลองเดินแบบงูเลื้อย: แต่ละแถวเดินไปทางขวาหรือซ้ายสลับกัน ในแต่ละช่อง if ข้าวสุก harvest() แล้ว plant() ใหม่ ทำซ้ำหลาย ๆ รอบ',
    starterCode:
      '# ปลูกและเก็บเกี่ยวอัตโนมัติ\ndef work():\n    info = scan()\n    if info["ripe"]:\n        harvest()\n    if scan()["type"] == "soil":\n        plant()\n\nsize = get_world_size()\n# เขียนลูปเดินให้ครบทุกช่อง และวนหลายรอบ\n',
    map: Array(8).fill(',,,,,,,,'),
    start: { x: 0, y: 0 },
    check: ({ world }) =>
      world.inventory.wheat >= 32
        ? { pass: true, message: `ฟาร์มอัตโนมัติสำเร็จ! เก็บได้ ${world.inventory.wheat} ต้นใน ${world.tick} จังหวะ` }
        : { pass: false, message: `ได้ข้าว ${world.inventory.wheat}/32 ต้น ลองวนเก็บหลายรอบ` },
  },
];

export const chapters = [
  {
    id: 1,
    title: 'บทที่ 1: Python Basics',
    description: 'print ตัวแปร ลูป for/while และเงื่อนไข if-else เพื่อสั่งหุ่นยนต์เก็บเกี่ยวอัตโนมัติ',
    levels: ch1Levels,
  },
  {
    id: 2,
    title: 'บทที่ 2: State Space Searching',
    description: 'เขาวงกตและสิ่งกีดขวาง เขียน BFS และ DFS เพื่อหาเส้นทางไปเป้าหมาย',
    levels: ch2Levels,
  },
  {
    id: 3,
    title: 'บทที่ 3: Heuristic Algorithms',
    description: 'แผนที่ใหญ่ที่แต่ละช่องใช้พลังงานต่างกัน เขียน A* Search หาเส้นทางที่ประหยัดที่สุด',
    levels: [],
    comingSoon: true,
  },
  {
    id: 4,
    title: 'บทที่ 4: Machine Learning',
    description: 'ฟาร์มที่มีปัจจัยดินและสภาพอากาศ เก็บข้อมูลแล้วสร้างโมเดลเลือกพืชให้ได้ผลผลิตสูงสุด',
    levels: [],
    comingSoon: true,
  },
  {
    id: 5,
    title: 'บทที่ 5: Modern AI Platforms',
    description: 'โหมด Sandbox เชื่อมต่อ LLM API ให้ช่วยวางแผนและสั่งการหุ่นยนต์',
    levels: [],
    comingSoon: true,
  },
];

export const allLevels = chapters.flatMap((c) => c.levels.map((l) => ({ ...l, chapterId: c.id })));

export function findLevel(id) {
  return allLevels.find((l) => l.id === id) || allLevels[0];
}

export const API_REFERENCE = [
  { sig: 'get_map()', desc: 'แผนที่เป็น list ของ string: map[y][x] เป็น . ทางเดิน หรือ # กำแพง' },
  { sig: 'get_target()', desc: 'พิกัดแท่นข้อมูล {"x": ..., "y": ...}' },
  { sig: 'can_move("right")', desc: 'ตรวจทาง up/down/left/right โดยไม่เดินและไม่ใช้เวลา' },
  { sig: 'mark(x, y, "visited")', desc: 'แสดงสีทีละจังหวะ: visited ฟ้า / frontier ทอง / path เขียว โดยไม่เพิ่มก้าวเดิน' },
  { sig: 'move_up() / move_down()', desc: 'เดินขึ้น / ลง 1 ช่อง (คืน True ถ้าเดินได้)' },
  { sig: 'move_left() / move_right()', desc: 'เดินซ้าย / ขวา 1 ช่อง' },
  { sig: 'harvest()', desc: 'เก็บข้าวสุก ต้นไม้ หรือแร่ในช่องปัจจุบัน' },
  { sig: 'plant()', desc: 'ปลูกข้าวสาลีบนดิน (soil)' },
  { sig: 'scan()', desc: 'ข้อมูลช่องปัจจุบัน เช่น {"type": "wheat", "ripe": True}' },
  { sig: 'get_x() / get_y()', desc: 'พิกัดของหุ่นยนต์ (0,0 คือมุมซ้ายบน)' },
  { sig: 'get_world_size()', desc: 'ขนาดแผนที่ (8)' },
  { sig: 'print(...)', desc: 'แสดงข้อความใน Console' },
];
