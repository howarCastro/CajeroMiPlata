const TASA_AHORROS = 0.015;
const SOBREGIRO_CORRIENTE = 0.2;
const TASA_3_6 = 0.019;
const TASA_7_MAS = 0.023;
const MAX_INTENTOS = 3;
const CLAVE_ALMACENAMIENTO = "miPlataClientes";
const CAMPOS_PERFIL = ["identificacion", "nombreCompleto", "celular", "usuario"];
const NOMBRES_PRODUCTO = {
    ahorros: "Cuenta de Ahorros",
    corriente: "Cuenta Corriente",
    tarjeta: "Tarjeta de Crédito"
};
const exito = (datos = {}) => ({ ok: true, ...datos });
const fallo = (msg, datos = {}) => ({ ok: false, msg, ...datos });
const redondear = (valor) => Math.round(valor * 100) / 100;
const montoValido = (monto) => Number.isFinite(monto) && monto > 0;
const noImplementado = () => { throw new Error("Método no implementado en la subclase."); };
const formatearMoneda = (valor) =>
    valor.toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const formatearFecha = (iso) => new Date(iso).toLocaleString("es-CO");
class Producto {
    #movimientos = [];
    constructor() {
        if (new.target === Producto) throw new TypeError("Producto es una clase abstracta.");
    }
    get tipo() { return noImplementado(); }
    get movimientos() { return [...this.#movimientos]; }
    _registrar(tipo, valor, extras = {}) {
        this.#movimientos.unshift({ fecha: new Date().toISOString(), tipo, valor, ...extras });
    }
    _restaurarMovimientos(movimientos = []) {
        this.#movimientos = [...movimientos];
    }
    retirar() { return noImplementado(); }
    recibir() { return noImplementado(); }
    puedeRecibir() { return noImplementado(); }
    resumen() { return noImplementado(); }
    toJSON() { return noImplementado(); }
    restaurar() { return noImplementado(); }
}
class Cuenta extends Producto {
    #saldo;
    constructor(saldoInicial = 0) {
        super();
        if (new.target === Cuenta) throw new TypeError("Cuenta es una clase abstracta.");
        this.#saldo = saldoInicial;
        if (saldoInicial > 0) this._registrar("Apertura", saldoInicial);
    }
    static valorInicialValido(valor) { return Number.isFinite(valor) && valor >= 0; }
    get saldo() { return this.#saldo; }
    calcularCostoRetiro() { return noImplementado(); }
    calcularMaximoRetirable() { return noImplementado(); }
    puedeRecibir(monto) { return montoValido(monto); }
    consignar(monto, tipoMovimiento = "Consignación") {
        if (!montoValido(monto)) return fallo("Ingrese un monto numérico mayor a cero.");
        this.#saldo = redondear(this.#saldo + monto);
        this._registrar(tipoMovimiento, monto);
        return exito({ nuevoSaldo: this.#saldo });
    }
    retirar(monto, tipoMovimiento = "Retiro") {
        if (!montoValido(monto)) return fallo("Ingrese un monto numérico mayor a cero.");
        const maximo = this.calcularMaximoRetirable();
        if (monto > maximo) return fallo(`Fondos insuficientes. Máximo a retirar: ${formatearMoneda(maximo)}.`);
        const costo = this.calcularCostoRetiro(monto);
        const interes = redondear(costo - monto);
        this.#saldo = redondear(this.#saldo - costo);
        this._registrar(tipoMovimiento, monto, interes > 0 ? { interes } : {});
        return exito({ nuevoSaldo: this.#saldo, interes });
    }
    recibir(monto, tipoMovimiento) { return this.consignar(monto, tipoMovimiento); }
    resumen() { return `Saldo disponible: ${formatearMoneda(this.#saldo)}`; }
    toJSON() { return { tipo: this.tipo, saldo: this.#saldo, movimientos: this.movimientos }; }
    restaurar(estado) {
        this.#saldo = estado.saldo ?? 0;
        this._restaurarMovimientos(estado.movimientos);
    }
}
class CuentaAhorros extends Cuenta {
    get tipo() { return "ahorros"; }
    calcularCostoRetiro(monto) { return redondear(monto * (1 + TASA_AHORROS)); }
    calcularMaximoRetirable() {
        return Math.floor((this.saldo / (1 + TASA_AHORROS)) * 100 + 1e-6) / 100;
    }
}
class CuentaCorriente extends Cuenta {
    get tipo() { return "corriente"; }
    calcularCostoRetiro(monto) { return monto; }
    calcularMaximoRetirable() {
        return redondear(Math.max(0, this.saldo) * (1 + SOBREGIRO_CORRIENTE));
    }
    resumen() {
        return `${super.resumen()} | Retiro máximo con sobregiro: ${formatearMoneda(this.calcularMaximoRetirable())}`;
    }
}
class TarjetaCredito extends Producto {
    #cupo;
    #deuda = 0;
    constructor(cupo = 0) {
        super();
        this.#cupo = cupo;
    }
    static valorInicialValido(valor) { return montoValido(valor); }
    static obtenerTasa(cuotas) {
        if (cuotas <= 2) return 0;
        if (cuotas <= 6) return TASA_3_6;
        return TASA_7_MAS;
    }
    get tipo() { return "tarjeta"; }
    get cupo() { return this.#cupo; }
    get deuda() { return this.#deuda; }
    get cupoDisponible() { return redondear(this.#cupo - this.#deuda); }
    puedeRecibir(monto) { return montoValido(monto) && monto <= this.#deuda; }
    retirar() { return fallo("La tarjeta de crédito no permite retiros ni transferencias."); }
    comprar(monto, cuotas) {
        if (!montoValido(monto)) return fallo("Ingrese un valor de compra numérico mayor a cero.");
        if (!Number.isInteger(cuotas) || cuotas < 1) return fallo("El número de cuotas debe ser un entero mayor o igual a 1.");
        if (monto > this.cupoDisponible) return fallo(`Cupo insuficiente. Disponible: ${formatearMoneda(this.cupoDisponible)}.`);
        const tasa = TarjetaCredito.obtenerTasa(cuotas);
        const cuotaMensual = redondear(
            tasa === 0 ? monto / cuotas : (monto * tasa) / (1 - Math.pow(1 + tasa, -cuotas))
        );
        const totalAPagar = redondear(cuotaMensual * cuotas);
        this.#deuda = redondear(this.#deuda + monto);
        this._registrar(`Compra a ${cuotas} cuota(s)`, monto, { cuotas, cuotaMensual, totalAPagar });
        return exito({ cuotaMensual, tasa, totalAPagar });
    }
    pagar(monto, tipoMovimiento = "Pago") {
        if (!this.puedeRecibir(monto)) {
            return fallo(`El pago debe ser mayor a cero y no superar la deuda (${formatearMoneda(this.#deuda)}).`);
        }
        this.#deuda = redondear(this.#deuda - monto);
        this._registrar(tipoMovimiento, monto);
        return exito({ deuda: this.#deuda });
    }
    recibir(monto, tipoMovimiento) { return this.pagar(monto, tipoMovimiento); }
    resumen() {
        return `Cupo disponible: ${formatearMoneda(this.cupoDisponible)} | Deuda: ${formatearMoneda(this.#deuda)}`;
    }
    toJSON() {
        return { tipo: this.tipo, cupo: this.#cupo, deuda: this.#deuda, movimientos: this.movimientos };
    }
    restaurar(estado) {
        this.#cupo = estado.cupo ?? 0;
        this.#deuda = estado.deuda ?? 0;
        this._restaurarMovimientos(estado.movimientos);
    }
}
const FABRICA_PRODUCTOS = {
    ahorros: CuentaAhorros,
    corriente: CuentaCorriente,
    tarjeta: TarjetaCredito
};
class Cliente {
    #identificacion;
    #nombreCompleto;
    #celular;
    #usuario;
    #clave;
    #bloqueado = false;
    #intentosFallidos = 0;
    #productos = {};
    constructor(identificacion, nombreCompleto, celular, usuario, clave) {
        this.#identificacion = identificacion;
        this.#nombreCompleto = nombreCompleto;
        this.#celular = celular;
        this.#usuario = usuario;
        this.#clave = clave;
    }
    get identificacion() { return this.#identificacion; }
    get nombreCompleto() { return this.#nombreCompleto; }
    get celular() { return this.#celular; }
    get usuario() { return this.#usuario; }
    get bloqueado() { return this.#bloqueado; }
    get intentosFallidos() { return this.#intentosFallidos; }
    get productos() { return { ...this.#productos }; }
    producto(tipo) { return this.#productos[tipo] ?? null; }
    abrirProducto(tipo, valorInicial) {
        const Clase = FABRICA_PRODUCTOS[tipo];
        if (!Clase) return fallo("Tipo de producto desconocido.");
        if (this.#productos[tipo]) return fallo(`Ya tiene ${NOMBRES_PRODUCTO[tipo]}.`);
        if (!Clase.valorInicialValido(valorInicial)) {
            return fallo(tipo === "tarjeta"
                ? "El cupo debe ser un número mayor a cero."
                : "El saldo inicial debe ser un número mayor o igual a cero.");
        }
        this.#productos[tipo] = new Clase(valorInicial);
        return exito();
    }
    validarClave(claveIngresada) { return this.#clave === claveIngresada; }
    cambiarClave(nuevaClave) { this.#clave = nuevaClave; }
    registrarIntentoFallido() {
        this.#intentosFallidos++;
        if (this.#intentosFallidos >= MAX_INTENTOS) this.#bloqueado = true;
    }
    reiniciarIntentos() { this.#intentosFallidos = 0; }
    desbloquear() {
        this.#bloqueado = false;
        this.#intentosFallidos = 0;
    }
    actualizarDatos({ identificacion, nombreCompleto, celular, usuario }) {
        this.#identificacion = identificacion;
        this.#nombreCompleto = nombreCompleto;
        this.#celular = celular;
        this.#usuario = usuario;
    }
    toJSON() {
        return {
            identificacion: this.#identificacion,
            nombreCompleto: this.#nombreCompleto,
            celular: this.#celular,
            usuario: this.#usuario,
            clave: this.#clave,
            bloqueado: this.#bloqueado,
            intentosFallidos: this.#intentosFallidos,
            productos: Object.fromEntries(
                Object.entries(this.#productos).map(([tipo, producto]) => [tipo, producto.toJSON()])
            )
        };
    }
    static desdeJSON(datos) {
        const cliente = new Cliente(datos.identificacion, datos.nombreCompleto, datos.celular, datos.usuario, datos.clave);
        cliente.#bloqueado = Boolean(datos.bloqueado);
        cliente.#intentosFallidos = datos.intentosFallidos ?? 0;
        for (const [tipo, estado] of Object.entries(datos.productos ?? {})) {
            const Clase = FABRICA_PRODUCTOS[tipo];
            if (!Clase) continue;
            const producto = new Clase();
            producto.restaurar(estado);
            cliente.#productos[tipo] = producto;
        }
        return cliente;
    }
}
class Banco {
    #almacenamiento;
    #clientes;
    constructor(almacenamiento = localStorage) {
        this.#almacenamiento = almacenamiento;
        this.#clientes = this.#cargar();
    }
    #cargar() {
        try {
            const datos = JSON.parse(this.#almacenamiento.getItem(CLAVE_ALMACENAMIENTO)) || [];
            return datos.map(d => Cliente.desdeJSON(d));
        } catch {
            return [];
        }
    }
    #validarDatos(datos, excluir = null) {
        const limpios = {};
        for (const campo of CAMPOS_PERFIL) {
            limpios[campo] = String(datos[campo] ?? "").trim();
            if (!limpios[campo]) return fallo("Todos los campos son obligatorios.");
        }
        const duplicado = this.#clientes.some(c =>
            c !== excluir && (c.identificacion === limpios.identificacion || c.usuario === limpios.usuario)
        );
        if (duplicado) return fallo("La identificación o el usuario ya se encuentran registrados.");
        return exito({ datos: limpios });
    }
    get clientes() { return [...this.#clientes]; }
    guardar() {
        this.#almacenamiento.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(this.#clientes));
    }
    #ejecutar(operacion) {
        const resultado = operacion();
        if (resultado.ok) this.guardar();
        return resultado;
    }
    #operar(cliente, tipo, operacion) {
        const producto = cliente.producto(tipo);
        if (!producto) return fallo(`No tiene ${NOMBRES_PRODUCTO[tipo]}.`);
        return this.#ejecutar(() => operacion(producto));
    }
    consignar(cliente, tipo, monto) {
        return this.#operar(cliente, tipo, producto =>
            producto instanceof Cuenta ? producto.consignar(monto) : fallo("Solo se puede consignar en cuentas."));
    }
    retirar(cliente, tipo, monto) {
        return this.#operar(cliente, tipo, producto => producto.retirar(monto));
    }
    comprar(cliente, monto, cuotas) {
        return this.#operar(cliente, "tarjeta", tarjeta => tarjeta.comprar(monto, cuotas));
    }
    pagarTarjeta(cliente, monto) {
        return this.#operar(cliente, "tarjeta", tarjeta => tarjeta.pagar(monto));
    }
    buscarPorUsuario(usuario) {
        return this.#clientes.find(c => c.usuario === usuario) ?? null;
    }
    registrar({ clave, confirmacion, productos = {}, ...datosPerfil }) {
        const validacion = this.#validarDatos(datosPerfil);
        if (!validacion.ok) return validacion;
        if (!clave) return fallo("La clave es obligatoria.");
        if (clave !== confirmacion) return fallo("Las claves no coinciden.");
        const { identificacion, nombreCompleto, celular, usuario } = validacion.datos;
        const cliente = new Cliente(identificacion, nombreCompleto, celular, usuario, clave);
        for (const [tipo, valorInicial] of Object.entries(productos)) {
            const apertura = cliente.abrirProducto(tipo, valorInicial);
            if (!apertura.ok) return apertura;
        }
        this.#clientes.push(cliente);
        this.guardar();
        return exito({ cliente });
    }
    iniciarSesion(usuario, clave) {
        const cliente = this.buscarPorUsuario(usuario);
        if (!cliente) return fallo("Usuario no registrado.");
        if (cliente.bloqueado) {
            return fallo("Cuenta bloqueada por superar el límite de intentos. Contacte al administrador.", { bloqueado: true });
        }
        if (cliente.validarClave(clave)) {
            cliente.reiniciarIntentos();
            this.guardar();
            return exito({ cliente });
        }
        cliente.registrarIntentoFallido();
        this.guardar();
        if (cliente.bloqueado) {
            return fallo(`Clave incorrecta. Su cuenta fue bloqueada tras ${MAX_INTENTOS} intentos fallidos.`, { bloqueado: true });
        }
        return fallo(`Clave incorrecta. Intentos fallidos: ${cliente.intentosFallidos} de ${MAX_INTENTOS}.`, { bloqueado: false });
    }
    actualizarPerfil(cliente, datos) {
        const validacion = this.#validarDatos(datos, cliente);
        if (!validacion.ok) return validacion;
        cliente.actualizarDatos(validacion.datos);
        this.guardar();
        return exito();
    }
    cambiarClave(cliente, usuario, claveActual, nuevaClave, confirmacion) {
        if (usuario !== cliente.usuario || !cliente.validarClave(claveActual)) {
            return fallo("Usuario o clave actual incorrectos.");
        }
        if (!nuevaClave) return fallo("La nueva clave es obligatoria.");
        if (nuevaClave !== confirmacion) return fallo("Las claves no coinciden.");
        cliente.cambiarClave(nuevaClave);
        this.guardar();
        return exito();
    }
    abrirProducto(cliente, tipo, valorInicial) {
        return this.#ejecutar(() => cliente.abrirProducto(tipo, valorInicial));
    }
    transferir(clienteOrigen, tipoOrigen, clienteDestino, tipoDestino, monto) {
        const origen = clienteOrigen.producto(tipoOrigen);
        const destino = clienteDestino.producto(tipoDestino);
        if (!origen || !destino) return fallo("Producto de origen o destino no disponible.");
        if (origen === destino) return fallo("No se permiten transferencias al mismo producto.");
        if (!destino.puedeRecibir(monto)) return fallo("El producto destino no puede recibir ese monto.");
        const retiro = origen.retirar(monto, "Transferencia enviada");
        if (!retiro.ok) return retiro;
        destino.recibir(monto, "Transferencia recibida");
        this.guardar();
        return exito();
    }
    eliminar(cliente) {
        const indice = this.#clientes.indexOf(cliente);
        if (indice === -1) return fallo("Usuario no encontrado.");
        this.#clientes.splice(indice, 1);
        this.guardar();
        return exito();
    }
    desbloquear(cliente) {
        cliente.desbloquear();
        this.guardar();
        return exito();
    }
}
