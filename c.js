// VARIABLES
// NUEVO: Intentamos cargar la lista guardada en localStorage. Si no hay nada, inicia vacía [].
let listaClientes = JSON.parse(localStorage.getItem("bancoClientes")) || [];
let intentosFallidos = 0; 

// MENÚ PRINCIPAL
function menuPrincipal() {
    let opcion = prompt("--- MENÚ PRINCIPAL ---\n1. Iniciar Sesión\n2. Registrar Cuenta\n\nElija Respuesta (Escriba 1 o 2):");

    if (opcion === "1") {
        iniciarSesion();
    } else if (opcion === "2") {
        registrar();
    } else {
        alert(" Opción no válida. Intente de nuevo.");
        menuPrincipal();
    }
}

// === FORMULARIO DE REGISTRO ===
function registrar() {
    console.log("--- Formulario Registrar ---");

    let identificacion = prompt("Ingrese su Identificación:");
    let usuario = prompt("Ingrese su Usuario:");
    let correo = prompt("Ingrese su Correo:");
    let clave = prompt("Ingrese su Clave:");
    let repetirClave = prompt("Repetir Clave:");
    let saldo = parseFloat(prompt("Ingrese su Saldo Inicial ($):"));

    if (clave !== repetirClave) {
        alert("Las claves no coinciden. El registro se ha cancelado.");
        menuPrincipal();
        return; 
    }

    if (isNaN(saldo) || saldo < 0) {
        saldo = 0;
    }

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

    //  localStorage 
    localStorage.setItem("bancoClientes", JSON.stringify(listaClientes));

    console.log("Cliente registrado con éxito.");
    alert("¡Registro Exitoso!");
    menuPrincipal();
}

// INICIO DE SESIÓN
function iniciarSesion() {
    if (intentosFallidos >= 3) {
        alert("Cuenta bloqueada por 24 horas, comunícate con tu banco");
        return; 
    }

    console.log("--- Formulario Iniciar ---");
    let usuarioLogin = prompt("Usuario:");
    let claveLogin = prompt("Clave:");

    let clienteEncontrado = listaClientes.find(cliente => 
        cliente.usuario === usuarioLogin && cliente.clave === claveLogin
    );

    if (clienteEncontrado) {
        intentosFallidos = 0; 
        alert(`¡Bienvenido, ${clienteEncontrado.usuario}!`);
        moduloTransacciones(clienteEncontrado);
    } else {
        intentosFallidos++; 
        alert(`Datos incorrectos. Intento fallido ${intentosFallidos} de 3.`);
        
        if (intentosFallidos >= 3) {
            alert("Cuenta bloqueada por 24 horas, comunícate con tu banco");
            return;
        }

        menuPrincipal(); 
    }
}

// Consultas y Movimientos
function moduloTransacciones(cliente) {
    let opcion = prompt(
        `--- MÓDULO DE TRANSACCIONES ---\n` +
        `Bienvenido: ${cliente.usuario}\n\n` +
        `1. Retirar\n` +
        `2. Consultar Saldo\n` +
        `3. Consignar\n` +
        `4. Consultar Movimientos\n` +
        `5. Salir\n\n` +
        `Elija una opción (1-5):`
    );

    let ahora = new Date().toLocaleString();

    switch (opcion) {
        case "1": // Retirar
            let montoRetiro = parseFloat(prompt("¿Cuánto dinero desea retirar?"));
            if (montoRetiro > 0 && montoRetiro <= cliente.saldo) {
                cliente.saldo -= montoRetiro; 
                cliente.movimientos.push(`[${ahora}] Retiro: -$${montoRetiro}`); 
                
                // NUEVO: Guardamos en localStorage para guardar el nuevo saldo e historial
                localStorage.setItem("bancoClientes", JSON.stringify(listaClientes));
                
                alert(`Retiro exitoso. Retire su dinero.`);
            } else {
                alert(" Fondos insuficientes o monto inválido.");
            }
            moduloTransacciones(cliente); 
            break;

        case "2": // Consultar Saldo
            alert(`Tu saldo disponible actual es: $${cliente.saldo}`);
            moduloTransacciones(cliente);
            break;

        case "3": // Consignar
            let montoConsignar = parseFloat(prompt("¿Cuánto dinero desea consignar?"));
            if (montoConsignar > 0) {
                cliente.saldo += montoConsignar; 
                cliente.movimientos.push(`[${ahora}] Consignación: +$${montoConsignar}`); 
                
                // Guardamos en localStorage  nuevo saldo e historial
                localStorage.setItem("bancoClientes", JSON.stringify(listaClientes));
                
                alert(`Consignación exitosa.`);
            } else {
                alert(" Monto inválido.");
            }
            moduloTransacciones(cliente);
            break;

        case "4": // Consultar Movimientos
            let historial = cliente.movimientos.join("\n");
            alert(`--- Historial de Movimientos ---\n${historial}`);
            moduloTransacciones(cliente);
            break;

        case "5": // Salir
            alert("Sesión cerrada. Volviendo al menú principal.");
            menuPrincipal(); 
            break;

        default:
            alert(" Opción inválida.");
            moduloTransacciones(cliente);
    }
}

// llamar menú
menuPrincipal();
