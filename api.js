const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.json()); // JSON 요청 처리

// DB 연결 설정
const dbConfig = {
  host: "localhost",
  user: "",
  password: "",
  database: "",
};

// 테이블 정보를 DB에서 가져오는 함수
async function getTableInfo(connection, tableName) {
  const [rows] = await connection.query(
    `
    SELECT COLUMN_NAME, COLUMN_KEY, DATA_TYPE 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
  `,
    [tableName]
  );

  return rows.map((row) => ({
    name: row.COLUMN_NAME,
    type: row.DATA_TYPE,
    isPrimary: row.COLUMN_KEY === "PRI",
  }));
}

// CRUD 쿼리 자동 생성 함수
function generateCRUDQueries(tableName, columns) {
  const createQuery = `INSERT INTO ${tableName} (${columns
    .map((col) => col.name)
    .join(", ")})
VALUES (${columns.map((col) => "?").join(", ")});`;

  const primaryKey = columns.find((col) => col.isPrimary).name;
  const readQuery = `SELECT * FROM ${tableName} WHERE ${primaryKey} = ?;`;

  const updateQuery = `UPDATE ${tableName} SET ${columns
    .filter((col) => !col.isPrimary)
    .map((col) => `${col.name} = ?`)
    .join(", ")} WHERE ${primaryKey} = ?;`;

  const deleteQuery = `DELETE FROM ${tableName} WHERE ${primaryKey} = ?;`;

  return {
    create: createQuery,
    read: readQuery,
    update: updateQuery,
    delete: deleteQuery,
  };
}

// CRUD 쿼리를 생성하고 반환하는 API
app.post("/generate-crud", async (req, res) => {
  const { tableName } = req.body;

  if (!tableName) {
    return res.status(400).json({ error: "Table name is required" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // 테이블 정보 가져오기
    const columns = await getTableInfo(connection, tableName);

    if (columns.length === 0) {
      return res.status(404).json({ error: `Table ${tableName} not found` });
    }

    // CRUD 쿼리 생성
    const queries = generateCRUDQueries(tableName, columns);

    // 결과 반환
    res.json(queries);

    await connection.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 서버 실행
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
