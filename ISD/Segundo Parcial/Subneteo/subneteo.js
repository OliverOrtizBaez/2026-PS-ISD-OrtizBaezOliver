(function(global) {
    'use strict';

    function octetoABinario(octeto) {
        return octeto.toString(2).padStart(8, '0');
    }

    function pasosDecimalABinario(octeto) {
        const pesos = [128, 64, 32, 16, 8, 4, 2, 1];
        let resto = octeto;
        return pesos.map((peso) => {
            const bit = resto >= peso ? 1 : 0;
            if (bit) resto -= peso;
            return { peso, bit, resto };
        });
    }

    function ipEntero(ip) {
        const partes = String(ip).trim().split('.');
        if (partes.length !== 4) throw new Error(`"${ip}" no valida`);
        return partes.reduce((acc, parte) => {
            if (!/^\d{1,3}$/.test(parte)) throw new Error(`"${parte}" no es un octeto favor de verificar la ip`);
            const n = Number(parte);
            if (n > 255) throw new Error(`"${n}" es mayor a 255, no es una ip valida`);
            return acc * 256 + n; 
        }, 0);
    }

    function enteroAIp(n) {
        return [24, 16, 8, 0].map((d) => Math.floor(n / 2**d) % 256).join('.');
    }

    function ipABinario(ip) {
        return enteroAIp(ipEntero(ip)).split('.').map(Number).map(octetoABinario).join('.');
    }

    function prefijoAMascara(prefijo) {
        return enteroAIp(prefijo === 0 ? 0 : (2**32 - 2**(32 - prefijo)));
    }

    function mascaraAPrefijo(mascara) {
        const bin = ipABinario(mascara).replace(/\./g, '');
        if (!/^1*0*$/.test(bin)) throw new Error(`"${mascara}", no es una mascara valida los 1 deben ir seguidos`);
        return bin.indexOf('0') === -1 ? 32 : bin.indexOf('0');
    }

    function leerPrefijo(texto) {
        const t = String(texto).trim().replace(/^\//, '');
        if (t.includes('.')) return mascaraAPrefijo(t);
        const p = Number(t);
        if (!Number.isInteger(p) || p < 0 || p > 32) throw new Error(`"/${p}", no es un prefijo valido (0 a 32)`);
        return p;
    }

    function claseDeRed(ip) {
        const primer = Math.floor(ipEntero(ip) / 2**24);
        if (primer >= 1 && primer <= 126) return { clase: "A", prefijo: 8 };
        if (primer === 127) return { clase: "Local", prefijo: 8 };
        if (primer >= 128 && primer <= 191) return { clase: "B", prefijo: 16 };
        if (primer >= 192 && primer <= 223) return { clase: "C", prefijo: 24 };
        if (primer >= 224 && primer <= 239) return { clase: "D", prefijo: null };
        return { clase: 'E', prefijo: null };
    }

    function esPrivada(ip) {
        const n = ipEntero(ip);
        const en = (red, pref) => Math.floor(n / 2 ** (32 - pref)) === Math.floor(ipEntero(red) / 2 ** (32 - pref));
        return en('10.0.0.0', 8) || en('172.16.0.0', 12) || en('192.168.0.0', 16);
    }

    function hostUtilizable(prefijo) {
        if (prefijo === 32) return 1;
        if (prefijo === 31) return 2;
        return 2**(32 - prefijo) - 2;
    }

    function describirSubred(redEntero, prefijo, nombre) {
        const tamano = 2**(32 - prefijo);
        const broadcast = redEntero + tamano - 1;
        const conHost = prefijo < 31;

        return {
            nombre: nombre || '',
            red: enteroAIp(redEntero),
            prefijo,
            mascara: prefijoAMascara(prefijo),
            primerHost: enteroAIp(conHost ? redEntero + 1 : redEntero),
            ultimoHost: enteroAIp(conHost ? broadcast - 1 : broadcast),
            broadcast: enteroAIp(broadcast),
            host: hostUtilizable(prefijo),
            tamanoBloque: tamano
        };
    }

    function analizaIp(ip, prefijo) {
        const n = ipEntero(ip);
        const tamano = 2**(32 - prefijo);
        const red = Math.floor(n / tamano) * tamano;
        return describirSubred(red, prefijo);
    }

    function validarRedBase(ip, prefijo) {
        const n = ipEntero(ip);
        const tamano = 2**(32 - prefijo);
        if (n % tamano !== 0) {
            const correcta = enteroAIp(Math.floor(n / tamano) * tamano);
            throw new Error(`${ip}/${prefijo} no es una dirección valida. Debería ser ${correcta}/${prefijo}`);
        }
        return n; 
    }

function subnetearFLSM(ip, prefijo, opciones) {
    const base = validarRedBase(ip, prefijo);
    let bitsPrestados;
    
    if (opciones.subredes) {
        bitsPrestados = Math.ceil(Math.log2(opciones.subredes));
    } else if (opciones.hostPorSubred) {
        const bitsPorHost = bitsParaHost(opciones.hostPorSubred);
        bitsPrestados = 32 - prefijo - bitsPorHost;
    } else {
        throw new Error('Indica el numero de subredes o de host por subred');
    }
    
    const nuevoPrefijo = prefijo + bitsPrestados;
    if (bitsPrestados < 0 || nuevoPrefijo > 30) {
        throw new Error(`No caben: harían falta /${nuevoPrefijo}, fuera del rango /${prefijo}-/30`);
    }
    
    const total = 2**bitsPrestados;

    // 1. Validamos PRIMERO el total de subredes
    if (total > 1024) {
        throw new Error(`El cálculo generaría ${total.toLocaleString('es-MX')} subredes. Especifica un rango más pequeño o un prefijo inicial mayor (ej. /24) para evitar sobrecargar el navegador.`);
    }

    // 2. Si no supera el límite, recién aquí se ejecuta el bucle
    const tamano = 2**(32 - nuevoPrefijo);
    const subredes = [];
    
    for (let i = 0; i < total; i++) {
        subredes.push(describirSubred(base + i * tamano, nuevoPrefijo, `Subred ${i + 1}`));
    }
    
    return { 
        bitsPrestados, 
        nuevoPrefijo, 
        totalSubredes: total, 
        hostPorSubred: hostUtilizable(nuevoPrefijo), 
        subredes 
    };
}

    function bitsParaHost(host) {
        if (!Number.isInteger(host) || host < 1) throw new Error(`${host} no es un numero de host valido`);
        let n = 2;
        while (2**n - 2 < host) n++;
        return n;
    }

    function subnetearVLSM(ip, prefijo, requerimientos) {
        const base = validarRedBase(ip, prefijo);
        const fin = base + 2**(32 - prefijo);
        
        const ordenados = requerimientos.map((r, i) => ({ ...r, i })).sort((a, b) => b.host - a.host || a.i - b.i);
        let siguiente = base;
        
        const subredes = ordenados.map((r) => {
            const bitsHost = bitsParaHost(r.host);
            const nuevoPrefijo = 32 - bitsHost;
            if (nuevoPrefijo < prefijo) {
                throw new Error(`${r.nombre} (${r.host} hosts) nesecita /${nuevoPrefijo}, mas grande que toda la red`);
            }
            
            const inicio = siguiente;
            const tamano = 2**(32 - nuevoPrefijo);
            siguiente = inicio + tamano;
            
            return { ...describirSubred(inicio, nuevoPrefijo, r.nombre), hostsSolicitados: r.host, bitsHost };
        });
        
        const usadas = siguiente - base;
        return {
            direccionesTotales: 2**(32 - prefijo), 
            direccionesUsadas: usadas,
            primerLibre: siguiente < fin ? enteroAIp(siguiente) : null,
            subredes
        };
    }

    const api = {
        octetoABinario, pasosDecimalABinario, ipEntero, ipABinario, enteroAIp, prefijoAMascara, mascaraAPrefijo, leerPrefijo, claseDeRed, esPrivada, hostUtilizable, bitsParaHost, analizaIp, subnetearFLSM, subnetearVLSM
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else global.subneteo = api;

})(typeof window !== 'undefined' ? window : globalThis);