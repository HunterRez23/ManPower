// generar_hash.js
const bcrypt = require('bcrypt');

async function generar() {
  const plain = process.argv[2] || '123456';  // usa "1234" si no pasas nada
  const hash = await bcrypt.hash(plain, 10);
  console.log(`Contraseña: ${plain}`);
  console.log(`Hash: ${hash}`);
}

generar();
