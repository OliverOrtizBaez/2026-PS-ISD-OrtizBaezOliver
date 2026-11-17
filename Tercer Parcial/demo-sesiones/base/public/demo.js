// La página solo hace fetch a la API. El navegador manda la cookie solo (misma página, mismo servidor).
const $ = (id) => document.getElementById(id);

// Ees una funcion para hablar con la api, y se construyo asi para no repetir en el codigo los elementos generales
async function llamar(metodo, url, cuerpo) {
  const opciones = { method: metodo, headers: {} };

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

//aqui jala la informacion que el servidor tiene de la sesion para aceptarlo o responder con un 401
async function cargarEstado() {
  const { status, datos } = await llamar('GET', '/api/sesion');
  const estado = $('estado');

  if (status === 200) {
    estado.textContent = `${datos.usuario.nombre} (${datos.usuario.rol}) · sesión ${datos.sesion} · vence en ${datos.expiraEnSegundos} s`;
    estado.className = 'estado con-sesion';
  } else {
    estado.textContent = 'Sin sesión (el servidor responde 401)';
    estado.className = 'estado sin-sesion';
  }

  $('cookie-js').textContent = document.cookie || '(vacío)';
}

// pues aqui es la tabla de sesiones 
async function cargarTabla() {
  const { datos } = await llamar('GET', '/api/diagnostico/sesiones');

  $('donde').textContent = datos.almacen === 'mysql'
    ? 'En MySQL, tabla sessions: sobreviven a un reinicio del servidor'
    : 'En la MEMORIA del servidor: se pierden al reiniciar';

  const cuerpo = $('tabla-sesiones');
  cuerpo.replaceChildren();

  if (datos.sesiones.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 4;
    celda.textContent = '(sin sesiones)';
    fila.append(celda);
    cuerpo.append(fila);
    return;
  }

  for (const s of datos.sesiones) {
    const fila = document.createElement('tr');
    if (s.esLaTuya) fila.className = 'tuya';

    // aqui se convierte la fecha a algo legible para el usuario y s epone en sesiones
    const vence = new Date(s.expira).toLocaleTimeString();
    const textos = [s.esLaTuya ? `${s.sesion} (la tuya)` : s.sesion, s.usuario, s.visitas, vence];

    for (const texto of textos) {
      const celda = document.createElement('td');
      celda.textContent = texto;
      fila.append(celda);
    }
    cuerpo.append(fila);
  }
}

// Después de cada acción refresco estado y tabla, porque el servidor pudo cambiar la sesión.
async function refrescarTodo() {
  await cargarEstado();
  await cargarTabla();
}

// preventDefault evita que cuando se haga submit en el formulario se recargue todo
$('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const cuerpo = { usuario: $('usuario').value, contrasena: $('contrasena').value };
  const { status, datos } = await llamar('POST', '/api/login', cuerpo);
  anotar('POST', '/api/login', status, datos);
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
    const url = boton.dataset.url;
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
