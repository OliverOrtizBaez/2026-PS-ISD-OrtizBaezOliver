const net = require('net');

const PUERTO = process.env.PUERTO || 5000;

const servidor = net.createServer((socket) => {
    const cliente = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`TCP Conexión establecida con el cliente, ${cliente}`);

    socket.on('data', (datos) => {
        const crudo = datos.toString();
        console.log(`TCP Datos crudos ${datos.length} bytes: ${JSON.stringify(crudo)}`);
        

        const lineas = crudo.split('\n').map((l) => l.trim()).filter(Boolean);
        
        lineas.forEach((linea) => {
            console.log(`TCP Mensaje: "${linea}"`);
            socket.write(`Eco TCP: ${linea}\n`);
        });
    });

    socket.on('close', () => {
        console.log(`TCP Conexion cerrada con el cliente ${cliente}`);
    });

    socket.on('error', (error) => {
        console.log(`TCP Error con ${cliente}`, error.message);
    });
});


servidor.listen(PUERTO, () => {
    console.log(`Servidor Inicializado en ${PUERTO}`);
});