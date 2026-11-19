
--se uso esta migracion para poner aqui la lista negra de los tokens que ya no vamos a aceptar
USE demo_sesiones;
CREATE TABLE tokens_revocados (
  jti CHAR(36) NOT NULL PRIMARY KEY,
  usuario VARCHAR(30) NOT NULL,
  exp DATETIME NOT NULL,
  revocado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);