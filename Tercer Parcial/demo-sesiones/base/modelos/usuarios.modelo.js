// Consultas a la tabla usuarios. Siempre con ? (consulta parametrizada), nunca pegando texto en el SQL.
const bcrypt = require('bcryptjs');

function crearModeloUsuarios(pool) {
  // Regresa el usuario (sin el hash) si la contraseña es correcta, o null si no.
  async function verificar(usuario, contrasena) {
    if (!usuario || !contrasena) return null;

    // el ? evita la inyección SQL: MySQL recibe el valor aparte del texto de la consulta
    const [filas] = await pool.query(
      'SELECT id, usuario, nombre, rol, contrasena_hash FROM usuarios WHERE usuario = ?',
      [usuario]
    );
    if (filas.length === 0) return null; // el usuario no existe

    // separamos el hash para NUNCA mandarlo al navegador
    const { contrasena_hash, ...datos } = filas[0];
    const coincide = await bcrypt.compare(contrasena, contrasena_hash);
    return coincide ? datos : null;
  }

  return { verificar };
}

module.exports = { crearModeloUsuarios };
