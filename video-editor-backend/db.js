const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'videos.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fileUrl TEXT NOT NULL,
    originalName TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS scenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    videoId INTEGER NOT NULL,
    start REAL NOT NULL,
    end REAL NOT NULL,
    metadata TEXT,
    FOREIGN KEY (videoId) REFERENCES videos (id) ON DELETE CASCADE
  )`);
});

module.exports = db;
