# 📚 Data Structure Attendance Checking System

This is a local NFC-based attendance system using ACR122U.

It records attendance by scanning student cards or using manual check during an active session.

---

# 🖥 System Requirements

- Node.js (v18 or later recommended)
- npm
- ACR122U NFC Reader
- Windows / macOS (tested locally)

---


# 🚀 How to Run

1️⃣ Move to the project folder

```bash
cd Attendance-Checking-System
```

2️⃣ Install dependencies

⚠️ IMPORTANT:
You must run npm install in the current project directory (where package.json exists).

```bash
npm install
```
This will create the node_modules folder automatically.

3️⃣ Start the server
```bash
node server.js
```
4️⃣ Open in browser
```code
http://localhost:3000
```

---

# 📋 Basic Usage

### 👩‍💻 Card Registration (=Updating /data foler)
The UID must be registered to the students.json file first.
1.	Make sure the NFC reader is connected.
2.	Click Card Registration.
3.	Tag the new card and ***press 'Enter'***.
4.	Enter the student’s Name and Student ID.
5.	Click Register.
6.	The student will be added to data/students.json.


### ▶ Start Attendance Session
1.	Make sure NFC reader is connected.
2.	Click Start.
3.	The attendance section will appear.
4.	Students can tag their card.

### 📝 Manual Check (for students without card)
1. Available only during active attendance session.
2. Click Manual Check
3. Enter Student Name and Student ID
4. Student must already exist in students.json

---

# 🗂 Data Management (IMPORTANT)

## ⚠️ Sensitive Information

The data/ folder contains:
- students.json (student ID + name + UID)
- Daily attendance CSV files

This folder contains personal and sensitive information.

🔒 Rules
- ❌ Do NOT upload data/ to GitHub
- ❌ Do NOT share students.json
- ❌ Do NOT distribute attendance CSV files
- ✅ Each TA must manage their own local data/ folder securely
- ✅ Back up locally if necessary

---

# 📁 File Structure
```code
Attendance-Checking-System/
│
├── server.js
├── package.json
├── package-lock.json
├── public/
│   ├── index.html
│   └── style.css
├── data/
│   ├── students.json
│   └── YYYY-MM-DD.csv
```

---

# 🛠 Important Notes
•	Attendance is recorded per day (KST time).
•	Duplicate attendance is prevented based on Student ID.
•	Manual Check and Card Scan are treated equally.
•	Session must be started before attendance is recorded.

---

# 📌 Important

This system is designed for local academic use.
Do not expose it to public internet without proper security configuration.

---

Developed for Data Structure Course Attendance Management.
Munjeong Kim