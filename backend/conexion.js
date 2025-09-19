const { Pool } = require("pg");
const config = require("../config/config.json");

// Selecciona el entorno: "local" o "remoto"
const entorno = "remoto"; // o "local" según tu caso

const pool = new Pool(config[entorno]);

module.exports = pool;
