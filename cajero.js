// PERSISTENCIA
let listaClientes = JSON.parse(localStorage.getItem("bancoClientes")) || [];

// 1. FORMULARIO DE REGISTRO
function registrar() {
    console.log("--- Formulario Registrar ---");

    let identificacion = prompt("Ingrese su Identificación:");
    let usuario = prompt("Ingrese su Nombre de Usuario:");

    // Validación de existencia previa (EVITA DUPLICADOS)
    let clienteExiste = listaClientes.some(
        c => c.identificacion === identificacion || c.usuario === usuario
    );

    if (clienteExiste) {
        alert(" Error: La identificación o el usuario ya se encuentran registrados.");
        return;
    }

    let correo = prompt("Ingrese su Correo:");
    let clave = prompt("Ingrese su Clave:");
    let repetirClave = prompt("Repetir Clave:");

    if (clave !== repetirClave) {
        alert(" Las claves no coinciden. Registro cancelado.");
        return;
    }

    let saldoInput = parseFloat(prompt("Ingrese su Saldo Inicial ($):"));
    let saldo = (isNaN(saldoInput) || saldoInput < 0) ? 0 : saldoInput;

    let ahora = new Date().toLocaleString();

    let cuentaUsuario = {
        identificacion: identificacion,
        usuario: usuario,
        correo: correo,
        clave: clave,
        saldo: saldo,
        movimientos: [`[${ahora}] Cuenta abierta con $${saldo}`]
    };

    listaClientes.push(cuentaUsuario);
    localStorage.setItem("bancoClientes", JSON.stringify(listaClientes));

    console.log("Cliente registrado con éxito:", cuentaUsuario.usuario);
}

// 2. INICIO DE SESIÓN
function iniciarSesion() {
    console.log("--- Formulario Iniciar Sesión ---");
    let intentos = 0;
    const MAX_INTENTOS = 3;

    while (intentos < MAX_INTENTOS) {
        let usuarioLogin = prompt(`Usuario (Intento ${intentos + 1}/${MAX_INTENTOS}):`);
        if (usuarioLogin === null) return; // Permitir cancelar

        let claveLogin = prompt("Clave:");
        if (claveLogin === null) return;

        let clienteEncontrado = listaClientes.find(
            cliente => cliente.usuario === usuarioLogin && cliente.clave === claveLogin
        );

        if (clienteEncontrado) {
            console.log(`🔓 Sesión iniciada: ${clienteEncontrado.usuario}`);
            moduloTransacciones(clienteEncontrado);
            return; // Sale del ciclo al iniciar sesión
        }

        intentos++;
        alert(` Datos incorrectos. Intentos fallidos: ${intentos} de ${MAX_INTENTOS}.`);
    }

    alert(" Cuenta o acceso bloqueado por superar el límite de intentos.");
}

// 3. MÓDULO DE TRANSACCIONES (Uso de Bucle en lugar de Recursividad)
function moduloTransacciones(cliente) {
    let salirModulo = false;

    while (!salirModulo) {
        let opcion = prompt(
            `--- MÓDULO DE TRANSACCIONES ---\n` +
            `Usuario: ${cliente.usuario} | Saldo: $${cliente.saldo}\n\n` +
            `1. Retirar\n` +
            `2. Consultar Saldo\n` +
            `3. Consignar\n` +
            `4. Consultar Movimientos\n` +
            `5. Cerrar Sesión\n\n` +
            `Elija una opción (1-5):`
        );

        let ahora = new Date().toLocaleString();

        switch (opcion) {
            case "1": // Retirar
                let montoRetiro = parseFloat(prompt("¿Cuánto dinero desea retirar?"));
                if (montoRetiro > 0 && montoRetiro <= cliente.saldo) {
                    cliente.saldo -= montoRetiro;
                    cliente.movimientos.push(`[${ahora}] Retiro: -$${montoRetiro}`);
                    
                    // Actualización directa en localStorage
                    localStorage.setItem("bancoClientes", JSON.stringify(listaClientes));
                    console.log(`Retiro exitoso. Nuevo saldo: $${cliente.saldo}`);
                } else {
                    alert(" Fondos insuficientes o monto inválido.");
                }
                break;

            case "2": // Consultar Saldo
                console.log(`Saldo actual de ${cliente.usuario}: $${cliente.saldo}`);
                alert(`Tu saldo disponible actual es: $${cliente.saldo}`);
                break;

            case "3": // Consignar
                let montoConsignar = parseFloat(prompt("¿Cuánto dinero desea consignar?"));
                if (montoConsignar > 0) {
                    cliente.saldo += montoConsignar;
                    cliente.movimientos.push(`[${ahora}] Consignación: +$${montoConsignar}`);
                    
                    localStorage.setItem("bancoClientes", JSON.stringify(listaClientes));
                    console.log(`Consignación exitosa. Nuevo saldo: $${cliente.saldo}`);
                } else {
                    alert(" Monto inválido.");
                }
                break;

            case "4": // Consultar Movimientos
                let historial = cliente.movimientos.join("\n");
                alert(`--- Historial de Movimientos ---\n${historial}`);
                break;

            case "5": // Salir
            case null:
                console.log("Sesión finalizada.");
                salirModulo = true;
                break;

            default:
                alert(" Opción inválida.");
        }
    }
}

// 4. MENÚ PRINCIPAL (Estructura de Bucle Controlado)
function menuPrincipal() {
    let salir = false;

    while (!salir) {
        let opcion = prompt(
            "--- MENÚ PRINCIPAL ---\n" +
            "1. Iniciar Sesión\n" +
            "2. Registrar Cuenta\n" +
            "3. Salir\n\n" +
            "Elija una opción (1-3):"
        );

        switch (opcion) {
            case "1":
                iniciarSesion();
                break;
            case "2":
                registrar();
                break;
            case "3":
            case null:
                console.log("Aplicación finalizada.");
                salir = true;
                break;
            default:
                alert("Opción no válida. Intente de nuevo.");
        }
    }
}

// Iniciar aplicación
menuPrincipal();