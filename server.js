const express = require("express");
const fs = require("fs");
const path = require("path");
const { NFC } = require("nfc-pcsc");
const WebSocket = require("ws");

const app = express();
const PORT = 3000;

const DATA_DIR = path.join(__dirname, "data");
const STUDENT_LIST_PATH = path.join(DATA_DIR, "students.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(express.static("public"));

const server = app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);

const wss = new WebSocket.Server({ server });
const nfc = new NFC();

let sessionActive = false;
let currentCsvPath = null;
let CHECKED_IDS = new Set();
let currentReaderName = null;

let studentList = JSON.parse(fs.readFileSync(STUDENT_LIST_PATH, "utf8"));
let totalStudents = Object.keys(studentList).length;

function buildStudentIdIndex(listByUid) {
  const map = new Map();
  for (const [uid, info] of Object.entries(listByUid)) {
    if (info?.id) map.set(String(info.id), { name: info.name, uid });
  }
  return map;
}
let studentById = buildStudentIdIndex(studentList);

function getKST_ISO() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace("T", " ").split(".")[0];
}

function getTodayCsvPath() {
  const date = getKST_ISO().split(" ")[0];
  return path.join(DATA_DIR, `${date}.csv`);
}

function loadCheckedIDsFromCSV(filePath) {
  const set = new Set();
  if (!fs.existsSync(filePath)) return set;

  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    const id = parts[1]?.replace(/"/g, "").trim();
    if (id) set.add(id);
  }
  return set;
}

function getAttendanceList(filePath) {
  const list = [];
  if (!fs.existsSync(filePath)) return list;

  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    if (parts.length >= 3) {
      list.push({
        timestamp: parts[0].replace(/"/g, ""),
        id: parts[1].replace(/"/g, ""),
        name: parts[2].replace(/"/g, ""),
      });
    }
  }
  return list;
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "device", readerName: currentReaderName }));
  ws.send(JSON.stringify({ type: "session", active: sessionActive }));

  ws.on("message", message => {
    const data = JSON.parse(message);

    if (data.type === "start") {
      sessionActive = true;
      currentCsvPath = getTodayCsvPath();
      CHECKED_IDS = loadCheckedIDsFromCSV(currentCsvPath);
      broadcast({ type: "session", active: true });
      broadcast({
        type: "attendanceList",
        attendees: getAttendanceList(currentCsvPath),
        total: totalStudents,
      });
    }

    if (data.type === "end") {
      sessionActive = false;
      broadcast({ type: "session", active: false });
    }

    if (data.type === "register" && data.uid && data.name && data.id) {
      studentList[data.uid] = { name: data.name, id: data.id };
      fs.writeFileSync(STUDENT_LIST_PATH, JSON.stringify(studentList, null, 2));
      totalStudents = Object.keys(studentList).length;
      studentById = buildStudentIdIndex(studentList);
      ws.send(JSON.stringify({ type: "register", status: "success" }));
    }

    if (data.type === "manual" && data.id && data.name) {
      if (!sessionActive) {
        ws.send(JSON.stringify({ type: "manualResult", status: "no_session" }));
        return;
      }

      const key = String(data.id).trim();
      const found = studentById.get(key);

      if (!found) {
        ws.send(JSON.stringify({ type: "manualResult", status: "not_found" }));
        return;
      }

      if (CHECKED_IDS.has(key)) {
        broadcast({
          type: "attendance",
          status: "Already Checked",
          name: found.name,
          id: key,
          uid: "",
        });
        return;
      }

      const timestamp = getKST_ISO();
      const line = `"${timestamp}","${key}","${found.name}"\n`;
      fs.appendFileSync(currentCsvPath, line, "utf8");
      CHECKED_IDS.add(key);

      broadcast({
        type: "attendance",
        status: "Complete Attendance",
        name: found.name,
        id: key,
        uid: "",
      });

      broadcast({
        type: "attendanceList",
        attendees: getAttendanceList(currentCsvPath),
        total: totalStudents,
      });
    }
  });
});

nfc.on("reader", reader => {
  currentReaderName = reader.name;
  broadcast({ type: "device", readerName: currentReaderName });

  reader.on("error", err => {
    console.error(`Error (${reader.name}):`, err);

    broadcast({ type: "attendance", status: "Not a Student Card", name: "-", id: "-", uid: "" });

    return;

  });

  reader.on("card", card => {
    const uid = card.uid;
    const student = studentList[uid];

    let result = { type: "attendance", uid };

    if (!student) {
      result.status = "Unknown Card";
      result.name = "-";
      result.id = "-";
      broadcast(result);
      return;
    }

    const idKey = String(student.id);

    if (CHECKED_IDS.has(idKey)) {
      result.status = "Already Checked";
    } else if (sessionActive) {
      result.status = "Complete Attendance";
      const timestamp = getKST_ISO();
      const line = `"${timestamp}","${student.id}","${student.name}","${uid}"\n`;
      fs.appendFileSync(currentCsvPath, line, "utf8");
      CHECKED_IDS.add(idKey);

      broadcast({
        type: "attendanceList",
        attendees: getAttendanceList(currentCsvPath),
        total: totalStudents,
      });
    } else {
      result.status = "Registered Card";
    }

    result.name = student.name;
    result.id = student.id;
    broadcast(result);
  });

  reader.on("end", () => {
    currentReaderName = null;
    broadcast({ type: "device", readerName: null });
  });
});