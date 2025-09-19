// frontend/Js/main.js

// --- LOGIN ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value.trim();

    try {
      const res = await fetch('/usuarios/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!data.ok) { alert(data.msg || 'Credenciales incorrectas'); return; }

      localStorage.setItem('id_usuario', data.id_usuario);
      localStorage.setItem('email', email);
      localStorage.setItem('tipo_usuario', data.tipo_usuario);

      if (data.tipo_usuario === 'user') {
        const chk = await fetch(`/candidatos/${data.id_usuario}/completo`);
        const cj = await chk.json();
        if (cj.ok && cj.completo) {
          window.location.href = 'busqueda_vacantes.html';
        } else {
          window.location.href = 'perfil_candidato.html';
        }
      } else if (data.tipo_usuario === 'admin') {
        window.location.href = 'dashboard_admin.html';
      } else if (data.tipo_usuario === 'empresa') {
        window.location.href = 'dashboard_empresa.html';
      } else {
        alert('Tipo de usuario desconocido');
      }
    } catch (err) {
      console.error(err);
      alert('Error en la conexión con el servidor.');
    }
  });
}

// --- SIGN UP (solo candidatos) ---
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = signupForm.email.value.trim();
    const password = signupForm.password.value.trim();

    try {
      const res = await fetch('/usuarios/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!data.ok) { alert(data.error || 'Error en el registro'); return; }

      localStorage.setItem('id_usuario', data.id_usuario);
      localStorage.setItem('email', data.email);
      localStorage.setItem('tipo_usuario', data.tipo_usuario);

      window.location.href = 'perfil_candidato.html';
    } catch (err) {
      console.error(err);
      alert('Error en la conexión con el servidor.');
    }
  });
}
