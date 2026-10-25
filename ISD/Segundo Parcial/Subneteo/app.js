(function() {
    'use strict';
    
    const $ = (id) => document.getElementById(id);

    // Función que verifica si la librería existe y lanza un Error si no
    function obtenerSubneteo() {
        if (!window.subneteo) {
            throw new Error("El módulo 'subneteo.js' no se ha cargado correctamente o no se encontró en el proyecto.");
        }
        return window.subneteo;
    }

    function escapar(texto) {
        return String(texto).replace(/[&<>"']/g,
             (c) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
             })[c]);
    }
    
    const formatoMiles = (n) => n.toLocaleString('es-Mx');
    
    function mostrarError(destino, error) {
        destino.innerHTML = `<div class="error">¡Error! ${escapar(error.message)}</div>`;
    }

    function binarioColorado(ip, prefijo) {
        const S = obtenerSubneteo();
        const bits = S.ipABinario(ip).replace(/\./g, '');
        let html = '';
        for (let i = 0; i < 32; i++) {
            if(i > 0 && i % 8 === 0) html += '.';
            html += `<span class="${i < prefijo ? 'bits-red' : 'bits-host'}">${bits[i]}</span>`;
        }
        return html;
    }

    function tablaSubrredes(subredes, conSolicitados) {
        const filas = subredes.map((s, i) =>
            `<tr>
                <td>${i + 1}</td>
                <td>${escapar(s.nombre)}</td> ${conSolicitados ? `<td>${formatoMiles(s.hostsSolicitados)}</td>` : ''}
                <td class="ip">${s.red}/${s.prefijo}</td>
                <td class="ip">${s.primerHost}</td>
                <td class="ip">${s.ultimoHost}</td>
                <td class="ip">${s.broadcast || 'N/A'}</td>
                <td>${formatoMiles(s.host)}</td>
            </tr>`
        ).join('');
        
        return `
        <div class="tabla-envoltura">
            <table class="resultado">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Subred</th>
                        ${conSolicitados ? '<th>Hosts Solicitados</th>' : ''}
                        <th>Red</th>
                        <th>Primer Host</th>
                        <th>Último Host</th>
                        <th>Broadcast</th>
                        <th>Hosts Útiles</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>
        </div>
        `;
    }

    // --- LÓGICA DE PESTAÑAS ---
    document.querySelectorAll('.pestaña').forEach((boton) => {
        boton.addEventListener('click', () => { 
            activarPanel(boton.dataset.panel); 
        });    
    });

    function activarPanel(id) {
        document.querySelectorAll('.pestaña').forEach((pestana) => {
            pestana.classList.toggle('activa', pestana.dataset.panel === id);
        });
        document.querySelectorAll('.panel').forEach((p) => {
            p.classList.toggle('activo', p.id === id);
        });
    }

    // --- PANEL BINARIO ---
    const formBinario = $('form-binario');
    if(formBinario) {
        formBinario.addEventListener('submit', (e) => {
            e.preventDefault();
            const destino = $('bin-resultado');
            try {
                const S = obtenerSubneteo(); // Valida y obtiene la instancia
                const entrada = $('bin-entrada').value.trim(); 
                const octetos = entrada.includes('.') ? S.enteroAIp(S.ipEntero(entrada)).split('.').map(Number) : [Number(entrada)];
                
                if(octetos.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
                    throw new Error(`Escribe un valor entre 0 y 255 o una IP valida`);
                }
                
                destino.innerHTML = octetos.map((o) => {
                    const pasos = S.pasosDecimalABinario(o);
                    return `
                    <div class="tarjeta">
                        <h3>${o} <span class="binario">${S.octetoABinario(o)}</span></h3>
                        <table class="pasos">
                            <tr>
                                <th>Peso</th>
                                ${pasos.map((p) => `<th>${p.peso}</th>`).join('')}
                            </tr>
                            <tr>
                                <th>Bit</th>
                                ${pasos.map((p) => `<td>${p.bit}</td>`).join('')}
                            </tr>
                            <tr>
                                <th>Resto</th>
                                ${pasos.map((p) => `<td>${p.resto}</td>`).join('')}
                            </tr>
                        </table>
                        <p class="leyenda">Si el numero (o lo que resta) alcanza el peso, se pone 1, sino se pone 0</p>
                    </div>`;
                }).join('');
            } catch(error) {
                mostrarError(destino, error);
            }
        });
    }

    // --- PANEL FLSM ---
    const formFlsm = $('form-flsm');
    if(formFlsm) {
        formFlsm.addEventListener('submit', (e) => {
            e.preventDefault();
            const destino = $('flsm-resultado');
            try {
                const S = obtenerSubneteo();
                const red = $('flsm-red').value.trim();
                const prefijo = S.leerPrefijo($('flsm-prefijo').value);
                const modo = $('flsm-modo').value;
                const cantidad = Number($('flsm-cantidad').value);

                const opciones = {};
                if(modo === 'subredes') opciones.subredes = cantidad;
                else opciones.hostPorSubred = cantidad;

                const resultado = S.subnetearFLSM(red, prefijo, opciones);
                
                destino.innerHTML = `
                    <div class="tarjeta">
                        <h3>Resultados FLSM</h3>
                        <div class="datos">
                            <div><dt>Nuevo Prefijo</dt><dd>/${resultado.nuevoPrefijo}</dd></div>
                            <div><dt>Bits Prestados</dt><dd>${resultado.bitsPrestados}</dd></div>
                            <div><dt>Total Subredes</dt><dd>${formatoMiles(resultado.totalSubredes)}</dd></div>
                            <div><dt>Hosts Útiles por Subred</dt><dd>${formatoMiles(resultado.hostPorSubred)}</dd></div>
                        </div>
                    </div>
                    ${tablaSubrredes(resultado.subredes, false)}
                `;
            } catch (error) {
                mostrarError(destino, error);
            }
        });
    }

    // --- PANEL VLSM ---
    const formVlsm = $('form-vlsm');
    const contenedorFilas = document.querySelector('.vlsm-filas');
    const btnVlsmAgregar = document.querySelector('#vlsn-agregar');

    function agregarFilaVLSM() {
        const div = document.createElement('div');
        div.className = 'req-fila';
        div.innerHTML = `
            <input type="text" placeholder="Nombre (ej: Ventas)" class="vlsm-nombre" required>
            <input type="number" placeholder="Hosts" class="vlsm-hosts" min="1" required>
            <button type="button" class="quitar" title="Eliminar fila">✖</button>
        `;
        div.querySelector('.quitar').addEventListener('click', () => div.remove());
        contenedorFilas.appendChild(div);
    }

    if (btnVlsmAgregar && contenedorFilas) {
        btnVlsmAgregar.addEventListener('click', agregarFilaVLSM);
        if(contenedorFilas.children.length === 0) agregarFilaVLSM();
    }

    if(formVlsm) {
        formVlsm.addEventListener('submit', (e) => {
            e.preventDefault();
            const destino = $('vlsm-resultado');
            try {
                const S = obtenerSubneteo();
                const red = $('vlsm-red').value.trim();
                const prefijo = S.leerPrefijo($('vlsm-prefijo').value);
                
                const requerimientos = Array.from(document.querySelectorAll('.req-fila')).map(fila => ({
                    nombre: fila.querySelector('.vlsm-nombre').value.trim() || 'Subred',
                    host: Number(fila.querySelector('.vlsm-hosts').value)
                }));

                if(requerimientos.length === 0) throw new Error("Agrega al menos una subred con hosts.");

                const resultado = S.subnetearVLSM(red, prefijo, requerimientos);
                
                destino.innerHTML = `
                    <div class="tarjeta">
                        <h3>Resultados VLSM</h3>
                        <div class="datos">
                            <div><dt>Direcciones Totales</dt><dd>${formatoMiles(resultado.direccionesTotales)}</dd></div>
                            <div><dt>Direcciones Usadas</dt><dd>${formatoMiles(resultado.direccionesUsadas)}</dd></div>
                            <div><dt>Primera IP Libre</dt><dd>${resultado.primerLibre || 'Ninguna (Red Llena)'}</dd></div>
                        </div>
                    </div>
                    ${tablaSubrredes(resultado.subredes, true)}
                `;
            } catch (error) {
                mostrarError(destino, error);
            }
        });
    }

    // --- PANEL IP ---
    const formIp = $('form-ip');
    if(formIp) {
        formIp.addEventListener('submit', (e) => {
            e.preventDefault();
            const destino = $('ip-resultado');
            try {
                const S = obtenerSubneteo();
                const ip = $('ip-dir').value.trim();
                const prefijo = S.leerPrefijo($('ip-prefijo').value);
                
                const s = S.analizaIp(ip, prefijo);
                
                destino.innerHTML = `
                    <div class="tarjeta">
                        <h3>IP ${escapar(ip)}/${prefijo}</h3>
                        <p class="binario">IP &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${binarioColorado(ip, 32)}</p>
                        <p class="binario">Mascara &nbsp; ${binarioColorado(s.mascara, prefijo)}</p>
                        <p class="binario">Red &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${binarioColorado(s.red, prefijo)}</p>
                        <div class="datos">
                            <div><dt>Red</dt><dd>${s.red}/${prefijo}</dd></div>
                            <div><dt>Primer Host</dt><dd>${s.primerHost}</dd></div>
                            <div><dt>Último Host</dt><dd>${s.ultimoHost}</dd></div>
                            <div><dt>Prefijo</dt><dd>/${s.prefijo}</dd></div>
                            <div><dt>Hosts Útiles</dt><dd>${formatoMiles(s.host)}</dd></div>
                        </div>
                    </div>
                `;
            } catch (error) {
                mostrarError(destino, error);
            }   
        });
    }
})();