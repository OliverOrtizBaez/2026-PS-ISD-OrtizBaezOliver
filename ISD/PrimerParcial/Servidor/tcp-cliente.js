const net = require('net');
const HOST = process.env.HOST || '127.0.0.1';
const PUERTO = process.env.PUERTO || 5000;

const socket = net.connect(PUERTO, HOST, () => {
    console.log(`TCP Conectando al HOST ${HOST}:${PUERTO}`);

    ['uno', 'dos', 'Habia una vez', 'un', 'patito', 'que decia miu miau'].forEach((mensaje) => {
        socket.write(`${mensaje}\n`);
    });
    

    socket.end(); 
});

socket.on('data', (datos) => {

    process.stdout.write(`[TCP] ${datos.toString()}`);
});

socket.on('close', () => {
    console.log(`TCP Conexion cerrada con el servidor`);
});

socket.on('error', (error) => {
    console.log(`[TCP] No se pudo conectar`, error.message);
});