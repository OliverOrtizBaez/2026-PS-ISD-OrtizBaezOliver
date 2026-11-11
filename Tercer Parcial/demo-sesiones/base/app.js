// La aplicación de la demo. server.js la arranca; las pruebas la arrancan con otras configuraciones.
// Lo que dice "(en clase)" lo programamos juntos, paso por paso. Mientras no esté, esa ruta responde 501.
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { crearModeloUsuarios } = require('./modelos/usuarios.modelo');

const NOMBRE_COOKIE = 'connect.sid';

//tenemos que determinar donde se deben de almacenar las sesiones para la aplicación 
//si es localstorage utilizamos memorystore (significa que se guarda en navegador) y si la queremos guardar en mysql debemos de obtenerla y mantenerla durante su ciclo de vida

function todasLasSesiones(almacen) {
  return new Promise((resolve, reject) => {
    const promesa = almacen.all((error, sesiones) => (
      error ? reject(error) : resolve(sesiones)
    ));
    if (promesa && typeof promesa.then === 'function') {
      promesa.then(resolve, reject);
    }
  });
}

function crearApp(config, pool) {
  const app = express();
  app.use(express.json());
  crearModeloUsuarios(pool);

  //nesecito crear una sesion a partir del tipo, rol y privilegio del usuario
  //opción 1, manejarlo desde mysql, significa que debo de tener una tabla de sesiones
  //opción 2, manejarlo desde memoria

  const almacen = config.almacen === 'memoria'
    ? new session.MemoryStore()
    : new MySQLStore({ createDatabaseTable: false, clearExpired: false }, pool);
  app.locals.almacen = almacen;

  //conocer el id de la sesión 
  const idCorto = (id) => (id ? `${id.slice(0, 8)}...` : null);

  // dentro del middleware como existe el intercambio de la sesion para tener un seguimiento del usuario, rol, privilegio, etc, se utiliza el atributo roling para poder extender su uso

  function pendiente(paso) {
    return (req, res) => res.status(501).json({
      error: `Esta funcionalidad sigue pendiente (paso ${paso}).`
    });
  }

  function requiereSesion(req, res, next) {
    return pendiente(1)(req, res, next);
  }
  function requiereRol(rol) {
    return pendiente(3);
  }
  app.get('/api/config', (req, res) => res.json(config));
  //vamos a generar un contador en la sesion, sirve para saber que la sesión existe antes de entrar
  app.post('/api/visita', (req, res) => {
    if (!req.session) return pendiente(1)(req, res);
    req.session.visitas = (req.session.visitas || 0) + 1;
    return res.json({ visitas: req.session.visitas, sesion: idCorto(req.sessionID) });
  });

  return app;
}

module.exports = { crearApp, NOMBRE_COOKIE, todasLasSesiones };
