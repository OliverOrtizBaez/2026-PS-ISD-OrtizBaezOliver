const path = require('path');
const http = require('http');
const fs = require('fs');
const readline = require('readline');
const { WebSocket, WebSocketServer } = require('ws');

const PUERTO = 7000;

const servidorHttp = http.createServer((req, res) => {
    fs.readFile(path.join(__dirname, 'index.html'), (error, contenido) => {
        if (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('No se pudo cargar el archivo index.html');
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(contenido);
    });
});

const wss = new WebSocketServer({ server: servidorHttp });
const clientes = new Set();

wss.on('connection', (socket) => {
    clientes.add(socket);
    console.log(`Cliente conectado. Total de clientes: ${clientes.size}`);

    socket.on('close', () => {
        clientes.delete(socket);
        console.log(`Cliente desconectado. Total de clientes: ${clientes.size}`);
    });
});

function broadcast(mensaje) {
    console.log(`[broadcast] Enviado a ${clientes.size} clientes: ${mensaje}`);
    const payload = JSON.stringify({
        tipo: 'cupo_lleno',
        mensaje,
        fecha: new Date().toISOString()
    });

    for (const socket of clientes) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(payload);
        }
    }
}

servidorHttp.listen(PUERTO, () => {
    console.log(`Servidor escuchando en el puerto ${PUERTO}`);
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (linea) => {
    const [comando, ...resto] = linea.trim().split(/\s+/);

    if (comando === 'broadcast') {
        const mensaje = resto.join(' ');
        if (mensaje) {
            broadcast(mensaje);
        } else {
            console.log('Uso: broadcast <mensaje>');
        }
    } else if (linea.trim()) {
        console.log('Comando no reconocido. Usa: broadcast <mensaje>');
    }
});
