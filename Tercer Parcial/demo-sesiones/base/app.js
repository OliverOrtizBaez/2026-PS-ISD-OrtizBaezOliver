// La aplicación de la demo. server.js la arranca; las pruebas la arrancan con otras configuraciones.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const JWT = require('jsonwebtoken');
const { crearModeloUsuarios } = require('./modelos/usuarios.modelo');
const { crearModeloTokens } = require('./modelos/tokens.modelo');
const { crearModeloCortes } = require('./modelos/cortes.modelo');

const NOMBRE_COOKIE = 'connect.sid';

//Tenemos que determinar donde se deben de almacenar las sesiones para la aplicación: si es 'memoria' utilizamos MemoryStore (se guarda en la memoria del SERVIDOR y se pierde al reiniciar) y si la queremos guardar en MySQL debemos de obtenerla y mantenerla durante su ciclo de vida

function todasLasSesiones(almacen){
  return new Promise((resolve, reject)=>{
    const promesa = almacen.all((error, sesiones)=> (error ? reject(error) : resolve(sesiones)));
    if (promesa && typeof promesa.then === 'function') promesa.then(resolve, reject);
  });
}

//vamos a conectarnos a la aplicacion
function crearApp(config, pool){
  const app = express();
  app.use(express.json());
  const usuarios = crearModeloUsuarios(pool);
  const tokens = crearModeloTokens(pool);
  const cortes = crearModeloCortes(pool);

  //necesito crear una sesión a partir del tipo, rol y privilegio del usuario
  //opcion 1 manejorlo desde mysql, significa que debo de tener una tabla de sesiones
  //opcion 2 manejorlo desde memoria

  const almacen = config.almacen === 'memoria'
    ? new session.MemoryStore()
    : new MySQLStore({ createDatabaseTable: false, clearExpired: false }, pool);
  app.locals.almacen = almacen;

  app.use(
    session({
      //nosotros creamos la cookie para que vaya sobre todo el elemento de la aplicación
      name : NOMBRE_COOKIE,
      secret : process.env.SESSION_SECRET || 'secreto-solo-para-la-demo',
      store : almacen,
      resave : false,
      saveUninitialized : false, //no crea la sesion ni la cookie
      rolling : config.rolling,
      cookie : {
        maxAge: config.maxAgeMs,
        httpOnly: config.httpOnly,
        sameSite : config.sameSite,
        secure : false //activar el https
      }
    })
  )

  //conocer el id de la sesión
  const idCorto = (id) => (id ? `${id.slice(0, 8)}…` : null);

  // ---------------------------------------------------------------------------
  // PIEZAS COMPARTIDAS (cookie y JWT usan las mismas, así no se repite código)
  // ---------------------------------------------------------------------------

  // Los dos middlewares de identidad (requiereSesion y requiereJWT) dejan al usuario en
  // req.usuario = { usuario, nombre, rol }. Por eso solo hace falta UNA función de rol.
  function requiereRol(rol){
    return (req, res, next) => {
      if(req.usuario.rol !== rol){
        return res.status(403).json({error: `403 · Eres ${req.usuario.usuario}, pero esta ruta es solo para ${rol}`});
      }
      next();
    };
  }

  // Revisa usuario y contraseña en MySQL. Si fallan, ya responde el 401 y regresa null.
  async function credencialesValidas(req, res){
    const {usuario, contrasena} = req.body || {};
    const datos = await usuarios.verificar(usuario, contrasena);
    if(!datos) res.status(401).json({error: 'Usuario o contraseña incorrectos'});
    return datos;
  }

  // El mismo reporte para la ruta de cookie y la de JWT
  const REPORTE_ADMIN = 'Talleres: 3 · Inscritos: 57 · Cupo libre: 18';

  // ---------------------------------------------------------------------------
  // SESIÓN CON COOKIE
  // ---------------------------------------------------------------------------

  //en el uso de middleware como existe el intercambio de la sesion para tener un seguimiento del usuario, rol, privilegio, etc, se utiliza el atributo roling para poder extener su uso

  //cuando estemos utilizando un middleware verificar la sesión actividad a partir ya sea de la consulta al servidor o la cookie
  function vencida(sesion){
    const desde = config.rolling ? sesion.ultimoUso : sesion.creada;
    return Date.now() - desde > config.maxAgeMs;
  }

  //tenemos que identicar quien entro
  function requiereSesion(req, res, next){
    if (req.session.usuario && vencida(req.session)){
      return req.session.destroy(() => {
        res.clearCookie(NOMBRE_COOKIE);
        res.status(401).json({error: '401 · Tu sesión venció: vuelve a iniciar sesión'});
      });
    }
    if(!req.session.usuario){
      return res.status(401).json({error: '401 · No has iniciado sesión (o tu sesión ya venció)'});
    }
    req.session.ultimoUso = Date.now();
    req.usuario = req.session.usuario;
    next();
  }

  app.get('/api/config', (req, res) => res.json(config));

  //vamos a generar un contador en la sesion, sirve para saver que la sesion existe antes de entrar
  app.post('/api/visita', (req, res) =>{
    req.session.visitas = (req.session.visitas || 0)+1;
    res.json({visitas : req.session.visitas, sesion : idCorto(req.sessionID)});
  });

  //ruta para iniciar sesion
  app.post('/api/login', async(req, res, next)=>{
    try{
      const datos = await credencialesValidas(req, res);
      if(!datos) return;

      //necesito crear su sesion
      const antes = req.session.visitas !== undefined ? idCorto(req.sessionID) : null;
      const visitas = req.session.visitas || 0;

      //guardo la sesion
      const guardar = () =>{
        req.session.usuario = datos;
        req.session.visitas = visitas;
        req.session.creada = Date.now();
        req.session.ultimoUso = Date.now();
        req.session.save((error)=>{
          if(error) return next(error);
          res.json({usuario:datos, sesionAntes: antes, sesionDespues: idCorto(req.sessionID)});
        });
      };

      if(config.regenerarAlEntrar){
        //se crea una nueva sesion y se descarta la anterior
        req.session.regenerate((error) => (error ? next(error) : guardar()));
      }else{
        guardar();
      }
    }catch(error){
      next(error);
    }
  });

  //cerrar sesion
  app.post('/api/logout', (req, res, next)=>{
    req.session.destroy((error)=>{
      if(error) return next(error);
      res.clearCookie(NOMBRE_COOKIE);
      res.json({mensaje: 'Sesión cerrada: el servidor la borró'});
    });
  });

  app.get('/api/sesion', requiereSesion, (req, res) =>{
    const desde = config.rolling ? req.session.ultimoUso : req.session.creada;
    res.json({
      usuario : req.session.usuario,
      sesion : idCorto(req.sessionID),
      expiraEnSegundos : Math.max(0, Math.round((desde + config.maxAgeMs - Date.now())/1000)),
    });
  });

  app.get('/api/perfil', requiereSesion, (req, res)=>{
    req.session.visitas = (req.session.visitas || 0)+1;
    res.json({mensaje : `Hola, ${req.usuario.nombre}`, rol : req.usuario.rol, visitas: req.session.visitas});
  });

  app.get('/api/admin/reporte', requiereSesion, requiereRol('admin'), (req, res)=>{
    res.json({reporte : REPORTE_ADMIN});
  });

  //vamos a simular que el servidor guarda la sesion y la expone, en productivo jamas se expone
  app.get('/api/diagnostico/sesiones', async(req, res, next)=>{
    try{
      const sesiones = await todasLasSesiones(almacen);
      const lista = Object.entries(sesiones || {}).map(([id, s]) => ({
        sesion : idCorto(id),
        esLaTuya : id === req.sessionID,
        usuario : s.usuario ? s.usuario.usuario : '(sin iniciar sesion)',
        visitas: s.visitas || 0,
        expira: s.cookie && s.cookie.expires,
      }));
      res.json({almacen: config.almacen, sesiones: lista});
    }catch(error){
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // JWT (todo esto tiene que ir ANTES del 404, del static y del manejador de errores,
  // si no, Express nunca llega aquí o los errores se van a la página de error por defecto)
  // ---------------------------------------------------------------------------

  // El secreto va en .env (JWT_SECRET). No lo pongas en config.js: /api/config muestra todo config.
  const SECRETO_JWT = process.env.JWT_SECRET || 'secreto-jwt-solo-para-la-demo';

  function firmarToken(usuario){
    return JWT.sign(
      { sub: usuario.usuario, nombre: usuario.nombre, rol: usuario.rol },
      SECRETO_JWT,
      { algorithm: 'HS256', expiresIn: config.jwtExpiraSeg, jwtid: crypto.randomUUID() }
    );
  }

  //tenemos que identificar quien entro, pero ahora con el token que viaja en el encabezado Authorization
  async function requiereJWT(req, res, next){
    const encabezado = req.headers.authorization || '';
    if(!encabezado.startsWith('Bearer ')) return res.status(401).json({error: '401 · falta el token para estar autorizado'});
    const token = encabezado.slice('Bearer '.length);
    let datos;
    try{
      //debemos aceptar los datos de acuerdo al algoritmo
      datos = JWT.verify(token, SECRETO_JWT, { algorithms: ['HS256'] });
    }catch(error){
      if(error.name === 'TokenExpiredError') {
        return res.status(401).json({error: '401 · Tu token expiró, por favor bórralo o vuelve a iniciar sesión'});
      }
      return res.status(401).json({error: '401 · Token inválido'});
    }
    try{
      if(config.jwtRevocar){
        if(await tokens.estaRevocado(datos.jti)){
          return res.status(401).json({error: '401 · Token revocado, ya se cerró la sesión'});
        }
        // "revocar todos": se rechaza cualquier token emitido en o antes de la fecha de corte
        const corte = await cortes.corteDe(datos.sub);
        if(corte && datos.iat <= corte){
          return res.status(401).json({error: '401 · Token revocado: se revocaron todos los tokens'});
        }
      }
    }catch(error){
      return next(error);
    }
    req.jwt = datos;
    req.usuario = { usuario: datos.sub, nombre: datos.nombre, rol: datos.rol }; // igual que en la sesión
    next();
  }

  app.post('/api/jwt/login', async(req, res, next)=>{
    try{
      const datos = await credencialesValidas(req, res);
      if(!datos) return;
      res.json({token: firmarToken(datos), usuario: datos});
    }catch(error){
      next(error);
    }
  });

  // Aquí se presentan los elementos de la "sesión" JWT: quién es, su rol, el id del token y cuándo vence
  app.get('/api/jwt/perfil', requiereJWT, (req, res)=>{
    res.json({
      mensaje: `Hola, ${req.usuario.nombre}`,
      usuario: req.usuario.usuario,
      nombre: req.usuario.nombre,
      rol: req.usuario.rol,
      jti: req.jwt.jti,
      emitidoEn: new Date(req.jwt.iat * 1000).toISOString(),
      venceEn: new Date(req.jwt.exp * 1000).toISOString(),
      expiraEnSegundos: Math.max(0, Math.round((req.jwt.exp*1000 - Date.now())/1000))
    });
  });

  // Renovar: se entrega un token nuevo y el viejo se anota en la lista negra,
  // para que no existan dos tokens válidos del mismo usuario al mismo tiempo
  app.post('/api/jwt/refresh', requiereJWT, async(req, res, next)=>{
    try{
      if(config.jwtRevocar) await tokens.revocar(req.jwt.jti, req.jwt.sub, req.jwt.exp);
      res.json({token: firmarToken(req.usuario), usuario: req.usuario});
    }catch(error){
      next(error);
    }
  });

  app.get('/api/jwt/reporte', requiereJWT, requiereRol('admin'), (req, res)=>{
    res.json({reporte: REPORTE_ADMIN});
  });

  app.post('/api/jwt/logout', requiereJWT, async(req, res, next)=>{
    try {
      if(config.jwtRevocar){
        await tokens.revocar(req.jwt.jti, req.jwt.sub, req.jwt.exp);
        return res.json({mensaje: 'token revocado en el servidor, se anotó en la lista negra', revocado: true});
      }
      res.json({mensaje: 'el servidor no guarda nada, solo se puede borrar el token desde el navegador', revocado: false});
    } catch(error){
      next(error);
    }
  });

  // Revocar TODOS los tokens. Sin parámetros: todos los tuyos (cerrar sesión en todos lados).
  // Con ?alcance=global: los de TODOS los usuarios, y eso solo lo puede hacer un admin.
  // No se anotan token por token: se guarda una fecha de corte y todo lo emitido antes deja de servir.
  app.post('/api/jwt/revocar-todos', requiereJWT, async(req, res, next)=>{
    try{
      const global = req.query.alcance === 'global';
      if(global && req.usuario.rol !== 'admin'){
        return res.status(403).json({error: `403 · Eres ${req.usuario.usuario}, pero revocar los tokens de todos es solo para admin`});
      }
      if(!config.jwtRevocar){
        return res.json({mensaje: 'el servidor no guarda nada (jwtRevocar = false), no se puede revocar', revocado: false});
      }
      const corte = Math.floor(Date.now()/1000);
      await cortes.cortarDesde(global ? '*' : req.usuario.usuario, corte);
      res.json({
        mensaje: global ? 'se revocaron los tokens de TODOS los usuarios' : `se revocaron todos los tokens de ${req.usuario.usuario}`,
        alcance: global ? 'global' : 'usuario',
        corte: new Date(corte * 1000).toISOString(),
        revocado: true
      });
    }catch(error){
      next(error);
    }
  });

  //igual que el diagnóstico de sesiones: solo para la clase, en productivo jamas se expone
  app.get('/api/diagnostico/tokens', async(req, res, next)=>{
    try{
      const lista = (await tokens.listar()).map((t) => ({
        jti: idCorto(t.jti),
        usuario: t.usuario,
        exp: t.exp,
        revocadoEn: t.revocado_en,
      }));
      const fechasDeCorte = (await cortes.listar()).map((c) => ({usuario: c.usuario, desde: Number(c.desde) * 1000}));
      res.json({revocar: config.jwtRevocar, tokens: lista, cortes: fechasDeCorte});
    }catch(error){
      next(error);
    }
  });

  // ---------------------------------------------------------------------------
  // Lo que no coincidió con ninguna ruta, y el manejador de errores: SIEMPRE al final
  // ---------------------------------------------------------------------------
  app.use('/api', (req, res)=>{
    res.status(404).json({error: 'Ruta no encontrada'});
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.use((error, req, res, next)=>{
    console.log('Ejercicio de sesiones');
    console.error(error);
    res.status(500).json({error: 'Error de servidor'});
  });

  return app;
}
module.exports = {crearApp, NOMBRE_COOKIE};