require("dotenv").config();
const { openDb } = require("./db");
const { seed } = require("./seed");
const { createApp } = require("./app");

const db = openDb();
seed(db);
const port = Number(process.env.PORT) || 4000;
createApp(db).listen(port, () => console.log(`Alumable API listening on http://localhost:${port}`));
