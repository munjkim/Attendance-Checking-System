const fs = require("fs");
const path = require("path");
const { NFC } = require("nfc-pcsc");
const WebSocket = require("ws");
const express = require("express");

const app = express();
const PORT = 3000;
const STUDENT_LIST_PATH = "./data/students.json";
const DATA_DIR = "./data";
let studentList = JSON.parse(fs.readFileSync(STUDENT_LIST_PATH, "utf8"));
let totalStudents = Object.keys(studentList).length;

let currentCsvPath = "";
let sessionActive = false;
let connectedReaderName = null;
let CHECKED_UIDS = new Set();

app.use(express.static("public"));
const server = app.listen(PORT, () => {
  console.log(`웹 페이지: http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

function loadCheckedUIDsFromCSV(filePath) {
  const set = new Set();
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    for (const line of lines) {
      const parts = line.split(",");
      const uid = parts[3]?.replace(/"/g, "").trim();
      if (uid) set.add(uid);
    }
  }
  return set;
}

function getKST_ISO() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9
  return kst.toISOString().replace("T", " ").split(".")[0]; // 'YYYY-MM-DD HH:mm:ss'
}

function logAttendance(uid, name, id, filePath) {
  const timestamp = getKST_ISO();
  const line = `"${timestamp}","${id}","${name}","${uid}"\n`;
  fs.appendFileSync(filePath, line, "utf8");
}

function getAttendanceList(filePath) {
  const list = [];
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    for (const line of lines) {
      const parts = line.split(",");
      if (parts.length >= 4) {
        const timestamp = parts[0].replace(/"/g, "");
        const id = parts[1].replace(/"/g, "");
        const name = parts[2].replace(/"/g, "");
        list.push({ id, name, timestamp });
      }
    }
  }
  return list;
}

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

wss.on("connection", ws => {
  const today = new Date().toISOString().split("T")[0];
  currentCsvPath = `${DATA_DIR}/${today}.csv`;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  ws.send(JSON.stringify({
    type: "device",
    readerName: connectedReaderName
  }));
  ws.send(JSON.stringify({
    type: "session",
    active: sessionActive
  }));
  ws.send(JSON.stringify({
    type: "attendanceList",
    attendees: getAttendanceList(currentCsvPath),
    total: totalStudents
  }));

  ws.on("message", msg => {
    const data = JSON.parse(msg.toString());

    // ✅ 출석 세션 시작
    if (data.type === "start") {
      sessionActive = true;
      CHECKED_UIDS = loadCheckedUIDsFromCSV(currentCsvPath);
      broadcast({ type: "session", active: true });
      broadcast({
        type: "attendanceList",
        attendees: getAttendanceList(currentCsvPath),
        total: totalStudents
      });
      console.log("[세션 시작]");
    }

    // ✅ 출석 세션 종료
    if (data.type === "end") {
      sessionActive = false;
      broadcast({ type: "session", active: false });
      console.log("[세션 종료]");
    }

    // ✅ 카드 등록 처리
    if (data.type === "register" && data.uid && data.name && data.id) {
      studentList[data.uid] = { name: data.name, id: data.id };
      fs.writeFileSync(STUDENT_LIST_PATH, JSON.stringify(studentList, null, 2));
      totalStudents = Object.keys(studentList).length;
      console.log(`✅ 등록 완료: ${data.name} (${data.id})`);
      ws.send(JSON.stringify({ type: "register", status: "success" }));
    }
  });
});

const nfc = new NFC();

nfc.on("reader", reader => {
  console.log(`${reader.reader.name} 리더 연결됨`);
  connectedReaderName = reader.reader.name;

  broadcast({
    type: "device",
    readerName: connectedReaderName
  });

  reader.on("card", card => {
    const uid = card.uid;
    const student = studentList[uid];

    let result = {
      type: "attendance",
      uid,
      status: "",
      name: "",
      id: ""
    };

    if (student) {
      result.name = student.name;
      result.id = student.id;

      if (CHECKED_UIDS.has(uid)) {
        result.status = "Already Checked";
      } else if (sessionActive) {
        result.status = "Complete Attendance";
        logAttendance(uid, student.name, student.id, currentCsvPath);
        CHECKED_UIDS.add(uid);
        broadcast({
          type: "attendanceList",
          attendees: getAttendanceList(currentCsvPath),
          total: totalStudents
        });
      } else {
        result.status = "Registered Card";
      }
    } else {
      result.status = "Unknown Card";
    }

    broadcast(result);
  });

  reader.on("end", () => {
    console.log(`${reader.reader.name} 리더 해제됨`);
    connectedReaderName = null;
    broadcast({
      type: "device",
      readerName: null
    });
  });
});