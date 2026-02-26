const fs = require("fs");
const path = require("path");
const csvFilePath = path.join(__dirname, "data/data.csv");

const csv = require("csv-parser");
const result = {};

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on("data", (row) => {
    const uid = row["UID"].replace(/\s+/g, '').trim();  // 모든 공백 제거
    const studentId = row["Student ID"].trim();
    const name = row["Name"].trim();
    const last_update = row["last update"].trim();
    result[uid] = {
      id: studentId,
      name: name,
      last_update: last_update
    };
  })
  .on("end", () => {
    fs.writeFileSync("data/students.json", JSON.stringify(result, null, 2), "utf8");
    console.log("✅ 변환 완료: data/students.json 생성됨");
  });