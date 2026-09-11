const API_URL = "https://proyectobackcecyt9.onrender.com";

async function main() {
    // Corregido: se usan comillas invertidas `` para interpolar variables
    console.log(`Cliente peticion GET -> a ${API_URL}/api/talleres`);

    try {
        const inicio = Date.now();
        const respuesta = await fetch(`${API_URL}/api/talleres`);
        
        // Nos da el tiempo de ida y vuelta por medio de la petición mediante RTT
        const duracionMS = Date.now() - inicio;
        const cuerpo = await respuesta.json(); 

        console.log("ciclo de peticion - respuesta");
        console.log(`protocolo HTTPS sobre TCP: ${respuesta.status} ${respuesta.statusText}`);
        console.log(`Tiempo de ida y vuelta (RTT): ${duracionMS} ms`);
        console.log("Respuesta recibida:");
        console.log(JSON.stringify(cuerpo, null, 2));
    } catch (error) {
        console.error("Error al realizar la petición:", error.message);
    }
}

// Llama a la función para que se ejecute
main();