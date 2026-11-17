# PyCode Quest — Farm Automation

เกมสอน Python และ AI แนว Simulation & Automation (สไตล์ The Farmer Was Replaced)
เขียนโค้ด Python ทางขวา แล้วดูหุ่นยนต์มาสคอต AP Lab ทำงานทีละช่องบนเกาะฟาร์ม 8x8
แบบ Isometric 3D (Three.js + @react-three/fiber, โมเดลทั้งหมดเป็น procedural ไม่มีไฟล์ asset)
ธีม UI อิงเว็บหลัก AP Lab: พื้นขาว ตัวหนังสือกรมท่า ส้ม/เขียว

## เริ่มใช้งาน

```bash
npm install
npm run dev      # http://localhost:5173
```

ต้องต่ออินเทอร์เน็ตเพื่อโหลด Pyodide จาก CDN (jsDelivr)

## สถาปัตยกรรม

```
Editor ──code──▶ Web Worker (Pyodide)
                  │  รัน Python จนจบ พร้อมจำลองโลกเกมใน engine.js
                  │  ทุก move/harvest/plant = 1 event + snapshot ของโลก
                  ▼
           Command Queue (useCommandQueue)
                  │  เล่น event ทีละรายการตามความเร็ว 1x/2x/5x
                  ▼
        GameWorld (หุ่นยนต์เลื่อนทีละช่อง) + Console + ไฮไลต์บรรทัดที่ทำงาน
```

- `src/game/engine.js` สถานะโลก กติกา และคำสั่งหุ่นยนต์ (ใช้ร่วมทั้ง worker และ UI)
- `src/python/pyWorker.js` โหลด Pyodide, API ฝั่ง Python, บันทึก event, แปลข้อผิดพลาด
- `src/python/usePythonRunner.js` จัดการ worker และตัดโค้ดที่ค้างเกิน 10 วินาที
- `src/game/useCommandQueue.js` Run / Step / Stop / Reset และความเร็ว
- `src/game/levels.js` บทเรียน ด่าน แผนที่ และเงื่อนไขผ่านด่าน
- `src/components/GameWorld3D.jsx` ฉาก 3D ทั้งหมด: เกาะกริด, พืชผล (merge เป็น vertex-colored
  geometry ชิ้นเดียวต่อช่อง), มาสคอต, เอฟเฟกต์เก็บเกี่ยว, แท่นเป้าหมาย, OrbitControls + Reset View
- `src/components/` ResourceBar, CodeEditor (CodeMirror), ConsolePanel, LevelMenu

## API ที่ผู้เล่นใช้ได้

`move_up()` `move_down()` `move_left()` `move_right()` `harvest()` `plant()` `scan()`
`get_x()` `get_y()` `get_world_size()` `print()`

คำสั่งที่ทำให้หุ่นยนต์ทำงาน (move/harvest/plant) ใช้ 1 จังหวะเวลา ข้าวสุกหลัง 5 จังหวะ
ส่วน scan/get_x/get_y ไม่เสียเวลา

## เพิ่มด่าน

เพิ่ม object ใน `levels` ของบทใน `src/game/levels.js`
แผนที่ใช้สัญลักษณ์ `.` หญ้า `,` ดิน `w` ข้าวสุก `s` ต้นกล้า `T` ต้นไม้ `O` แร่ `#` หิน
