// generar_hash.js
const bcrypt = require('bcrypt');

async function generar() {
  const pass1 = await bcrypt.hash('1234', 10); // contraseña de admin
  const pass2 = await bcrypt.hash('abcd', 10); // contraseña de usuario

  console.log('Hash admin:', pass1);
  console.log('Hash user:', pass2);
}

generar();
