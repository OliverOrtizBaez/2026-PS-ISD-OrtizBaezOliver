// "Revocar TODOS los tokens": el servidor no guarda los tokens, así que no puede anotarlos uno por uno.
// En su lugar guarda una FECHA DE CORTE por usuario: todo token emitido antes de esa fecha ya no sirve.
// El usuario '*' significa "todos los usuarios".
function crearModeloCortes(pool){
    // la tabla se crea sola la primera vez que se usa (también está en bd/demo_sesiones.sql)
    let listo = null;
    function asegurarTabla() {
        if (!listo) {
            listo = pool.query(
                'CREATE TABLE IF NOT EXISTS tokens_corte (usuario VARCHAR(30) NOT NULL PRIMARY KEY, desde BIGINT NOT NULL, creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)'
            ).catch((error) => { listo = null; throw error; });
        }
        return listo;
    }

    //desde = segundos (igual que el iat del token)
    async function cortarDesde(usuario, desde) {
        await asegurarTabla();
        await pool.query('INSERT INTO tokens_corte (usuario, desde) VALUES (?, ?) ON DUPLICATE KEY UPDATE desde = VALUES(desde)', [usuario, desde]);
    }
    //el corte que le toca a este usuario: el suyo o el de todos, el más reciente. 0 = ninguno
    async function corteDe(usuario) {
        await asegurarTabla();
        const [filas] = await pool.query('SELECT MAX(desde) AS desde FROM tokens_corte WHERE usuario IN (?, ?)', [usuario, '*']);
        return filas[0] && filas[0].desde ? Number(filas[0].desde) : 0;
    }
    async function listar() {
        await asegurarTabla();
        const [filas] = await pool.query('SELECT usuario, desde FROM tokens_corte ORDER BY desde DESC');
        return filas;
    }

    return { cortarDesde, corteDe, listar };
}
module.exports = {crearModeloCortes};