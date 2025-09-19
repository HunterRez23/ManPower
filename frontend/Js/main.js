// main.js

// --- LOGIN ---
const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value.trim();

    if (!email || !password) {
        Swal.fire({ icon: 'warning', title: 'Campos incompletos', text: 'Por favor completa todos los campos.' });
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/usuarios/login', { // Ajusta la URL a tu backend
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!data.ok) {
            Swal.fire({ icon: 'error', title: 'Error', text: data.msg || 'Credenciales incorrectas' });
            return;
        }

        // Redirigir según tipo de usuario
        switch (data.tipo_usuario) {
            case 'user':
                window.location.href = 'perfil_candidato.html';
                break;
            case 'admin':
                window.location.href = 'dashboard_admin.html';
                break;
            case 'empresa':
                window.location.href = 'dashboard_empresa.html';
                break;
            default:
                Swal.fire({ icon: 'error', title: 'Error', text: 'Tipo de usuario desconocido' });
        }

    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Error en la conexión con el servidor.' });
    }
});

// --- SIGN UP (solo candidatos) ---
const signupForm = document.getElementById('signupForm');
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = signupForm.nombre.value.trim();
    const apellido = signupForm.apellido.value.trim();
    const email = signupForm.email.value.trim();
    const password = signupForm.password.value.trim();

    if (!nombre || !apellido || !email || !password) {
        Swal.fire({ icon: 'warning', title: 'Campos incompletos', text: 'Por favor completa todos los campos.' });
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/usuarios/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, apellido, email, password })
        });

        const data = await res.json();

        if (!data.ok) {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Error en el registro' });
            return;
        }

        Swal.fire({
            icon: 'success',
            title: '¡Registro exitoso!',
            text: 'Ya puedes iniciar sesión',
            confirmButtonText: 'OK'
        });

        // Cambiar al login automáticamente
        document.querySelector('.toggle').checked = false;
        signupForm.reset();

    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Error en la conexión con el servidor.' });
    }
});
