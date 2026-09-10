//vamos a programar un cliente mediante el cual  vamos a probar la arquitectura cliente servidor por medio de una peticion mediante protocolo http utilizando metodo GET a la ruta: /api/talleres

//tenemos que conectarnos al servicio de la base de datos, el problema es como apuntar al back 

const API_URL = "https://proyectobackcecyt9.onrender.com";

async function main() {
    
    console.log("Cliente peticion GEt -> a ${API_URL}/api/talleres");

        const inicio = Date.now();
        const respuesta = await fetch(`${API_URL}/api/talleres`)
        //Nos da el tiempo de ida y vuelta por medio de la peticion mediante RTT
        const duracionMS = Date.now() - inicio;
        //un estatus de rror 500 seria una respuesta valida sio el servicio de la bd no esta disponible 
        const cuerpo = await respuesta.json(); 

        console.log("ciclo de peticion - respuesta");
        console.log("protocolo HTTPS sobre TCP :${respuesta.status} ${respuesta.statusText}");
        console.log("Tiempo de ida y vuelta (RTT): ${duracionMS} ms");
        console.log(JSON.stringify(cuerpo, null, 2));

}

