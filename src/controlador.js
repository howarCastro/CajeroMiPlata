const $ = (id) => document.getElementById(id);

const banco = new Banco();
let clienteActivo = null;
let tipoActivo = null;
let secuencia = 0;

const VISTAS = ["vistaLanding", "vistaLogin", "vistaRegistro", "vistaTransacciones"];
const ENTRADAS = ["Apertura", "Consignación", "Transferencia recibida", "Pago"];
const INPUTS_APERTURA = ["numMontoAhorros", "numMontoCorriente", "numCupoTarjeta"];

const escaparHtml = (texto) =>
    String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const mostrarVista = (id) => VISTAS.forEach((v) => $(v).classList.toggle("hidden", v !== id));

const limpiarMensaje = (contenedor) => contenedor.querySelector(".mensaje")?.remove();

const pintarMensaje = (contenedor, texto, ok) => {
    let caja = contenedor.querySelector(".mensaje");
    if (!caja) {
        caja = document.createElement("p");
        caja.setAttribute("role", "alert");
        contenedor.prepend(caja);
    }
    caja.className = `mensaje ${ok ? "ok" : "error"}`;
    caja.textContent = texto;
};

const avisoHtml = (aviso) =>
    aviso ? `<p class="mensaje ${aviso.ok ? "ok" : "error"}" role="alert">${escaparHtml(aviso.texto)}</p>` : "";

const mostrarSesion = (activa) => {
    $("navPublico").classList.toggle("hidden", activa);
    $("headerUsuario").classList.toggle("hidden", !activa);
    if (activa) $("lblUsuarioHeader").textContent = clienteActivo.usuario;
};

const cerrarPanel = () => {
    $("panelOperacionDinamica").classList.add("hidden");
    $("contenidoOperacion").innerHTML = "";
};

const mostrarPanel = (titulo, html) => {
    $("lblTituloOperacion").textContent = titulo;
    $("contenidoOperacion").innerHTML = html;
    const panel = $("panelOperacionDinamica");
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

const campo = (nombre, etiqueta, { tipo = "text", valor = "", extra = "" } = {}) => {
    const id = `op_${nombre}_${++secuencia}`;
    return `<div class="form-group"><label for="${id}">${etiqueta}</label>` +
        `<input id="${id}" name="${nombre}" type="${tipo}" value="${escaparHtml(valor)}" ${extra} required></div>`;
};

const campoMonto = (etiqueta = "Monto ($)") =>
    campo("monto", etiqueta, { tipo: "number", extra: 'min="0" step="any"' });

const selector = (nombre, etiqueta, opciones) => {
    const id = `op_${nombre}_${++secuencia}`;
    const items = opciones.map(([valor, texto]) => `<option value="${valor}">${texto}</option>`).join("");
    return `<div class="form-group"><label for="${id}">${etiqueta}</label><select id="${id}" name="${nombre}">${items}</select></div>`;
};

const formulario = (accion, campos, boton) =>
    `<form data-accion="${accion}">${campos}<button type="submit" class="btn-primary">${boton}</button></form>`;

const actualizarSaldo = () => {
    const producto = clienteActivo?.producto(tipoActivo) ?? null;
    const etiqueta = document.querySelector(".saldo-label");
    if (!producto) {
        etiqueta.textContent = "Saldo disponible";
        $("lblSaldoMonto").textContent = formatearMoneda(0);
        $("lblDetalleSobregiro").textContent = "Aún no tiene productos. Use «Abrir producto».";
        return;
    }
    if (producto instanceof TarjetaCredito) {
        etiqueta.textContent = "Cupo disponible";
        $("lblSaldoMonto").textContent = formatearMoneda(producto.cupoDisponible);
        $("lblDetalleSobregiro").textContent =
            `Cupo total: ${formatearMoneda(producto.cupo)} | Deuda: ${formatearMoneda(producto.deuda)}`;
        return;
    }
    etiqueta.textContent = "Saldo disponible";
    $("lblSaldoMonto").textContent = formatearMoneda(producto.saldo);
    $("lblDetalleSobregiro").textContent = producto instanceof CuentaCorriente
        ? `Retiro máximo con sobregiro: ${formatearMoneda(producto.calcularMaximoRetirable())}`
        : "";
};

const cargarProductos = (seleccion = tipoActivo) => {
    const tipos = Object.keys(clienteActivo.productos);
    $("cboProductosCliente").innerHTML =
        tipos.map((t) => `<option value="${t}">${NOMBRES_PRODUCTO[t]}</option>`).join("");
    tipoActivo = tipos.includes(seleccion) ? seleccion : (tipos[0] ?? null);
    if (tipoActivo) $("cboProductosCliente").value = tipoActivo;
    $("btnAccionTarjeta").classList.toggle("hidden", !tipos.includes("tarjeta"));
    actualizarSaldo();
};

const entrarAlPanel = () => {
    mostrarSesion(true);
    cerrarPanel();
    cargarProductos(null);
    mostrarVista("vistaTransacciones");
};

const requerirProducto = () => {
    const producto = clienteActivo.producto(tipoActivo);
    if (!producto) {
        mostrarPanel("Sin productos", avisoHtml({ texto: "No tiene un producto activo. Use «Abrir producto».", ok: false }));
    }
    return producto;
};

const RENDER = {
    saldo(aviso) {
        const producto = requerirProducto();
        if (!producto) return;
        mostrarPanel("Consultar saldo", `${avisoHtml(aviso)}<p>${escaparHtml(producto.resumen())}</p>`);
    },

    retirar(aviso) {
        if (!requerirProducto()) return;
        mostrarPanel("Retirar", `${avisoHtml(aviso)}<p>Producto: <strong>${NOMBRES_PRODUCTO[tipoActivo]}</strong></p>` +
            formulario("retirar", campoMonto(), "Retirar"));
    },

    consignar(aviso) {
        const producto = requerirProducto();
        if (!producto) return;
        if (producto instanceof TarjetaCredito) return RENDER.tarjeta(aviso);
        mostrarPanel("Consignar", `${avisoHtml(aviso)}<p>Producto: <strong>${NOMBRES_PRODUCTO[tipoActivo]}</strong></p>` +
            formulario("consignar", campoMonto(), "Consignar"));
    },

    movimientos() {
        const producto = requerirProducto();
        if (!producto) return;
        const filas = producto.movimientos.map((m) => {
            const entrada = ENTRADAS.includes(m.tipo);
            const detalle = m.interes
                ? `Interés: ${formatearMoneda(m.interes)}`
                : m.cuotas ? `${m.cuotas} cuota(s) de ${formatearMoneda(m.cuotaMensual)}` : "";
            return `<tr><td>${formatearFecha(m.fecha)}</td><td>${escaparHtml(m.tipo)}</td>` +
                `<td class="${entrada ? "positivo" : "negativo"}">${entrada ? "+" : "-"} ${formatearMoneda(m.valor)}</td>` +
                `<td>${detalle}</td></tr>`;
        }).join("");
        mostrarPanel(`Movimientos - ${NOMBRES_PRODUCTO[tipoActivo]}`, filas
            ? `<div class="tabla-scroll"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Valor</th><th>Detalle</th></tr></thead><tbody>${filas}</tbody></table></div>`
            : "<p>Aún no hay movimientos en este producto.</p>");
    },

    transferir(aviso) {
        if (!requerirProducto()) return;
        mostrarPanel("Transferir", `${avisoHtml(aviso)}<p>Desde: <strong>${NOMBRES_PRODUCTO[tipoActivo]}</strong></p>` +
            formulario("transferir",
                campo("usuarioDestino", "Usuario destino") +
                selector("tipoDestino", "Producto destino", Object.entries(NOMBRES_PRODUCTO)) +
                campoMonto(),
                "Transferir"));
    },

    tarjeta(aviso) {
        const tarjeta = clienteActivo.producto("tarjeta");
        if (!tarjeta) {
            return mostrarPanel("Tarjeta de crédito",
                avisoHtml({ texto: "No tiene Tarjeta de Crédito. Use «Abrir producto».", ok: false }));
        }
        mostrarPanel("Tarjeta de crédito", `${avisoHtml(aviso)}<p>${escaparHtml(tarjeta.resumen())}</p>` +
            "<h3>Comprar a cuotas</h3>" +
            formulario("comprar",
                campoMonto("Valor de la compra ($)") +
                campo("cuotas", "Número de cuotas", { tipo: "number", extra: 'min="1" step="1"' }),
                "Comprar") +
            "<h3>Pagar deuda</h3>" +
            formulario("pagar", campoMonto("Valor a pagar ($)"), "Pagar"));
    },

    perfil(aviso) {
        const c = clienteActivo;
        mostrarPanel("Mi perfil", `${avisoHtml(aviso)}` +
            formulario("perfil",
                campo("identificacion", "Identificación", { valor: c.identificacion }) +
                campo("nombreCompleto", "Nombre completo", { valor: c.nombreCompleto }) +
                campo("celular", "Celular", { tipo: "tel", valor: c.celular }) +
                campo("usuario", "Usuario", { valor: c.usuario }),
                "Guardar cambios") +
            "<h3>Cambiar contraseña</h3>" +
            formulario("clave",
                campo("usuario", "Usuario") +
                campo("claveActual", "Contraseña actual", { tipo: "password" }) +
                campo("nuevaClave", "Nueva contraseña", { tipo: "password" }) +
                campo("confirmacion", "Confirmar nueva contraseña", { tipo: "password" }),
                "Cambiar contraseña"));
    },

    abrir(aviso) {
    const faltantes = Object.entries(NOMBRES_PRODUCTO).filter(([tipo]) => !clienteActivo.producto(tipo));
    if (!faltantes.length) {
        return mostrarPanel("Abrir producto", `${avisoHtml(aviso)}<p>Ya tiene todos los productos disponibles.</p>`);
    }
    mostrarPanel("Abrir producto", `${avisoHtml(aviso)}` +
        formulario("abrir",
            selector("tipo", "Producto", faltantes) +
            campo("valor", "Saldo inicial o cupo (\$)", { tipo: "number", extra: 'min="0" step="any"' }),
            "Abrir producto"));
}

};

const ACCIONES = {
    retirar: {
        ejecutar: (d) => banco.retirar(clienteActivo, tipoActivo, Number(d.monto)),
        exito: (r) => r.interes > 0
            ? `Retiro exitoso. Interés cobrado: ${formatearMoneda(r.interes)}. Nuevo saldo: ${formatearMoneda(r.nuevoSaldo)}.`
            : `Retiro exitoso. Nuevo saldo: ${formatearMoneda(r.nuevoSaldo)}.`,
        panel: "retirar"
    },
    consignar: {
        ejecutar: (d) => banco.consignar(clienteActivo, tipoActivo, Number(d.monto)),
        exito: (r) => `Consignación exitosa. Nuevo saldo: ${formatearMoneda(r.nuevoSaldo)}.`,
        panel: "consignar"
    },
    transferir: {
        ejecutar: (d) => {
            const destino = banco.buscarPorUsuario(d.usuarioDestino.trim());
            return destino
                ? banco.transferir(clienteActivo, tipoActivo, destino, d.tipoDestino, Number(d.monto))
                : fallo("El usuario destino no existe.");
        },
        exito: () => "Transferencia realizada con éxito.",
        panel: "transferir"
    },
    comprar: {
        ejecutar: (d) => banco.comprar(clienteActivo, Number(d.monto), Number(d.cuotas)),
        exito: (r) => `Compra registrada. Cuota mensual: ${formatearMoneda(r.cuotaMensual)} ` +
            `(tasa ${(r.tasa * 100).toFixed(1)}% mensual). Total a pagar: ${formatearMoneda(r.totalAPagar)}.`,
        panel: "tarjeta"
    },
    pagar: {
        ejecutar: (d) => banco.pagarTarjeta(clienteActivo, Number(d.monto)),
        exito: (r) => `Pago registrado. Deuda actual: ${formatearMoneda(r.deuda)}.`,
        panel: "tarjeta"
    },
    perfil: {
        ejecutar: (d) => banco.actualizarPerfil(clienteActivo, d),
        exito: () => "Perfil actualizado.",
        despues: () => { $("lblUsuarioHeader").textContent = clienteActivo.usuario; },
        panel: "perfil"
    },
    clave: {
        ejecutar: (d) => banco.cambiarClave(clienteActivo, d.usuario.trim(), d.claveActual, d.nuevaClave, d.confirmacion),
        exito: () => "Contraseña actualizada.",
        panel: "perfil"
    },
    abrir: {
        ejecutar: (d) => banco.abrirProducto(clienteActivo, d.tipo, Number(d.valor)),
        exito: () => "Producto abierto con éxito.",
        despues: (d) => cargarProductos(d.tipo),
        panel: "abrir"
    }
};

const abrirLogin = () => {
    limpiarMensaje($("formLogin"));
    $("lblIntentos").textContent = "0";
    mostrarVista("vistaLogin");
};

["btnNavLogin", "btnHeroLogin"].forEach((id) => $(id).addEventListener("click", abrirLogin));

["btnNavRegistro", "btnHeroRegistro", "btnIrARegistro"].forEach((id) =>
    $(id).addEventListener("click", () => mostrarVista("vistaRegistro")));

$("navPublico").querySelector('a[href="#inicio"]').addEventListener("click", (e) => {
    e.preventDefault();
    mostrarVista("vistaLanding");
});

[["chkAhorros", "numMontoAhorros"], ["chkCorriente", "numMontoCorriente"], ["chkTarjeta", "numCupoTarjeta"]]
    .forEach(([chk, num]) => {
        $(chk).addEventListener("change", () => {
            $(num).disabled = !$(chk).checked;
            if (!$(chk).checked) $(num).value = "";
        });
    });

$("formRegistro").addEventListener("submit", (e) => {
    e.preventDefault();
    const productos = {};
    if ($("chkAhorros").checked) productos.ahorros = Number($("numMontoAhorros").value);
    if ($("chkCorriente").checked) productos.corriente = Number($("numMontoCorriente").value);
    if ($("chkTarjeta").checked) productos.tarjeta = Number($("numCupoTarjeta").value);

    const resultado = banco.registrar({
        identificacion: $("txtRegIdentificacion").value,
        nombreCompleto: $("txtRegNombre").value,
        celular: $("txtRegCelular").value,
        usuario: $("txtRegUsuario").value,
        clave: $("txtRegClave").value,
        confirmacion: $("txtRegConfirmacion").value,
        productos
    });
    if (!resultado.ok) return pintarMensaje($("formRegistro"), resultado.msg, false);

    $("formRegistro").reset();
    limpiarMensaje($("formRegistro"));
    INPUTS_APERTURA.forEach((id) => { $(id).disabled = true; });
    abrirLogin();
    pintarMensaje($("formLogin"), "Registro exitoso. Ya puede iniciar sesión.", true);
});

$("formLogin").addEventListener("submit", (e) => {
    e.preventDefault();
    const usuario = $("txtUsuario").value.trim();
    const resultado = banco.iniciarSesion(usuario, $("txtClave").value);
    $("lblIntentos").textContent = banco.buscarPorUsuario(usuario)?.intentosFallidos ?? 0;
    if (!resultado.ok) return pintarMensaje($("formLogin"), resultado.msg, false);

    clienteActivo = resultado.cliente;
    $("formLogin").reset();
    limpiarMensaje($("formLogin"));
    entrarAlPanel();
});

$("btnCerrarSesion").addEventListener("click", () => {
    clienteActivo = null;
    tipoActivo = null;
    cerrarPanel();
    mostrarSesion(false);
    mostrarVista("vistaLanding");
});

$("cboProductosCliente").addEventListener("change", (e) => {
    tipoActivo = e.target.value;
    actualizarSaldo();
    cerrarPanel();
});

const BOTONES_OPERACION = {
    btnAccionRetirar: "retirar",
    btnAccionSaldo: "saldo",
    btnAccionConsignar: "consignar",
    btnAccionMovimientos: "movimientos",
    btnAccionTransferir: "transferir",
    btnAccionTarjeta: "tarjeta",
    btnAccionPerfil: "perfil",
    btnAccionAbrirProd: "abrir"
};

Object.entries(BOTONES_OPERACION).forEach(([id, operacion]) =>
    $(id).addEventListener("click", () => RENDER[operacion]()));

document.querySelector('.sidebar-item[href="#panelOperacionDinamica"]').addEventListener("click", (e) => {
    e.preventDefault();
    RENDER.movimientos();
});

$("contenidoOperacion").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const accion = ACCIONES[form.dataset.accion];
    if (!accion) return;

    const datos = Object.fromEntries(new FormData(form));
    const resultado = accion.ejecutar(datos);
    if (!resultado.ok) return pintarMensaje(form, resultado.msg, false);

    accion.despues?.(datos);
    actualizarSaldo();
    RENDER[accion.panel]({ texto: accion.exito(resultado), ok: true });
});
