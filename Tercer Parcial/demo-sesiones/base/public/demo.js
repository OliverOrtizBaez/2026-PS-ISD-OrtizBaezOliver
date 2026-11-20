// La página solo hace fetch a la API. Con JWT el navegador NO manda nada solo:
// nosotros guardamos el token y lo ponemos en el encabezado Authorization en cada petición.
const $ = (id) => document.getElementById(id);

// el token vive en localStorage (sobrevive al recargar la página). Ojo: cualquier JavaScript de la página lo puede leer
const CLAVE_TOKEN = 'jwt';
const leerToken = () => localStorage.getItem(CLAVE_TOKEN);
const guardarToken = (token) => localStorage.setItem(CLAVE_TOKEN, token);
const borrarToken = () => localStorage.removeItem(CLAVE_TOKEN);

// El index.html no se modifica: sus botones siguen diciendo /api/perfil, /api/logout, etc.
// Aquí se traducen a la ruta JWT incorporada, para no tener dos juegos de rutas en la página.
// (/api/visita no está: es un contador guardado en la sesión del servidor, JWT no guarda nada de eso)
const RUTAS_JWT = {
  '/api/perfil': '/api/jwt/perfil',
  '/api/admin/reporte': '/api/jwt/reporte',
  '/api/logout': '/api/jwt/logout',
};

// El payload (la parte de en medio del token) solo está en base64, no cifrado: cualquiera lo puede leer
function decodificarPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)); // TextDecoder para que los acentos no se rompan
  } catch {
    return null; // token roto o editado a mano en localStorage
  }
}

// Ees una funcion para hablar con la api, y se construyo asi para no repetir en el codigo los elementos generales
async function llamar(metodo, url, cuerpo) {
  const opciones = { method: metodo, headers: {} };

  // si ya hay token, viaja en cada petición (el servidor decide si le sirve o no)
  const token = leerToken();
  if (token) opciones.headers['Authorization'] = `Bearer ${token}`;

  //aqui se usa un content type, solo cuando hay cuerpo para que el server sepa que es un json
  if (cuerpo) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(url, opciones);

//aqui use un try y un catch por si existian entradas de datos que no fueran json no tronara el sistema, si no se pusiera un nulo
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  // login y refresh regresan un token nuevo: lo guardamos. Con logout el servidor ya lo revocó: lo borramos del navegador
  if (respuesta.ok && datos && datos.token) guardarToken(datos.token);
  if (respuesta.ok && url === '/api/jwt/logout') borrarToken();

  return { status: respuesta.status, datos };
}

// esta es la parte de la bitacora donde se van a poner los intentos que se han hecho
function anotar(metodo, url, status, datos) {
//colorcitos
  let clase = 'error';
  if (status >= 200 && status < 300) clase = 'ok';
  else if (status === 401) clase = 'e401';
  else if (status === 403) clase = 'e403';

  const li = document.createElement('li');

  const codigo = document.createElement('span');
  codigo.className = `codigo ${clase}`;
  codigo.textContent = status;

  const linea = document.createElement('strong');
  linea.textContent = ` ${metodo} ${url}`;

//aqui tenia de 2 , usar textcontent o innerHTML, pero con el segundo es posible inyectar codigo malisioso, y en textcontect no porque no deja leer los scripts
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(datos, null, 2);

  li.append(codigo, linea, pre);
  $('bitacora').prepend(li);
}

// el token completo y, debajo, lo que lleva dentro
function textoDelToken() {
  const token = leerToken();
  if (!token) return '(vacío)';
  const payload = decodificarPayload(token);
  return `${token}\n\nPayload (solo base64, cualquiera lo puede leer):\n${payload ? JSON.stringify(payload, null, 2) : '(no se pudo leer)'}`;
}

//aqui se le pregunta al servidor por el token (ruta jwt) para aceptarlo o responder con un 401
async function cargarEstado() {
  const estado = $('estado');

  if (!leerToken()) {
    estado.textContent = 'Sin sesión (no hay token)';
    estado.className = 'estado sin-sesion';
  } else {
    const { status, datos } = await llamar('GET', '/api/jwt/perfil');

    if (status === 200) {
      estado.textContent = `${datos.nombre} (${datos.rol}) · token ${datos.jti.slice(0, 8)}… · vence en ${datos.expiraEnSegundos} s`;
      estado.className = 'estado con-sesion';
    } else {
      // expiró, se revocó o es inválido: el token ya no sirve, se quita del navegador
      estado.textContent = datos && datos.error ? datos.error : `Sin sesión (el servidor responde ${status})`;
      estado.className = 'estado sin-sesion';
      borrarToken();
    }
  }

  // el index.html dice "document.cookie", pero con JWT el token vive en localStorage: corrijo el texto desde aquí
  const etiqueta = document.querySelector('#tarjeta-estado .detalle');
  if (etiqueta) etiqueta.textContent = 'Lo que el JavaScript de esta página puede leer: el token guardado en localStorage (no es una cookie, por eso document.cookie sale vacío) y lo que lleva dentro:';
  $('cookie-js').textContent = textoDelToken();
}

// pues aqui es la tabla de sesiones: la fila "la tuya" sale de tu token y las revocadas de la lista negra en MySQL
async function cargarTabla() {
  const { datos } = await llamar('GET', '/api/diagnostico/tokens');
  const cuerpo = $('tabla-sesiones');
  cuerpo.replaceChildren();

  if (!datos || !datos.tokens) {
    $('donde').textContent = 'No se pudo leer la lista negra (¿ya creaste la tabla tokens_revocados?)';
    return;
  }

  $('donde').textContent = datos.revocar
    ? 'JWT: el servidor no guarda las sesiones activas (la fila "la tuya" sale de tu propio token). Solo anota los tokens revocados en MySQL, tabla tokens_revocados'
    : 'JWT con jwtRevocar = false: el servidor no guarda nada, el token sigue sirviendo hasta que venza';

  const filas = [];
  const payload = leerToken() ? decodificarPayload(leerToken()) : null;
  if (payload) {
    filas.push({ sesion: `${payload.jti.slice(0, 8)}… (la tuya)`, usuario: payload.sub, vence: payload.exp * 1000, tuya: true });
  }
  for (const t of datos.tokens) {
    filas.push({ sesion: `${t.jti} (revocado)`, usuario: t.usuario, vence: t.exp });
  }

  if (filas.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(sin sesiones)';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  for (const f of filas) {
    const fila = document.createElement('tr');
    if (f.tuya) fila.className = 'tuya';

    // JWT no cuenta visitas (no hay sesión en el servidor), por eso esa columna va con guion
    const textos = [f.sesion, f.usuario, '—', new Date(f.vence).toLocaleTimeString()];

    for (const texto of textos) {
      const celda = document.createElement('td');
      celda.textContent = texto;
      fila.append(celda);
    }
    cuerpo.append(fila);
  }
}

// Después de cada acción refresco estado y tabla, porque el servidor pudo cambiar la lista negra.
async function refrescarTodo() {
  await cargarEstado();
  await cargarTabla();
}

// preventDefault evita que cuando se haga submit en el formulario se recargue todo
$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const cuerpo = { usuario: $('usuario').value, contrasena: $('contrasena').value };
  const { status, datos } = await llamar('POST', '/api/jwt/login', cuerpo);
  anotar('POST', '/api/jwt/login', status, datos);
  await refrescarTodo();
});

// Al elegir otro usuario pongo su contraseña de ejemplo (<usuario>12345) para no teclearla.
$('usuario').addEventListener('change', () => {
  $('contrasena').value = `${$('usuario').value}12345`;
});

//aqui escucha todos los botones para que no se tenga que poner un escucha por cada boton, y se hace un forEach para que se haga en todos los botones que tengan data-url
document.querySelectorAll('button[data-url]').forEach((boton) => {
  boton.addEventListener('click', async () => {
    const metodo = boton.dataset.metodo;
    const url = RUTAS_JWT[boton.dataset.url] || boton.dataset.url;
    const { status, datos } = await llamar(metodo, url);
    anotar(metodo, url, status, datos);
    await refrescarTodo();
  });
});

$('btn-refrescar').addEventListener('click', refrescarTodo);
$('btn-sesiones').addEventListener('click', cargarTabla);

//como vimos en el html ya estaba el script hasta el final entonces ya solo llamo esto y no deberia dar error
(async () => {
  const { datos } = await llamar('GET', '/api/config');
  $('config').textContent = JSON.stringify(datos, null, 2);
  await refrescarTodo();
})();