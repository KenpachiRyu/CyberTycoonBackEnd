let tokenDocente = localStorage.getItem('tokenDocente') || '';
let listaAlumnosActuales = [];
let timerAutoRefresh = null;

// Sanitizador contextual defensivo para el renderizado seguro en DOM
function escaparHTML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  // Inicialización de escuchadores de eventos
  document.getElementById('tabBtnLogin').addEventListener('click', () => cambiarTab('login'));
  document.getElementById('tabBtnRegistro').addEventListener('click', () => cambiarTab('registro'));
  document.getElementById('btnIniciarSesion').addEventListener('click', iniciarSesionDocente);
  document.getElementById('btnRegistrarDocente').addEventListener('click', registrarNuevoDocente);
  document.getElementById('btnAutoRefresh').addEventListener('click', toggleAutoRefresh);
  document.getElementById('btnCerrarSesion').addEventListener('click', cerrarSesion);
  document.getElementById('btnCrearClase').addEventListener('click', crearClase);
  document.getElementById('selectClases').addEventListener('change', cargarEstudiantes);
  document.getElementById('btnEliminarClase').addEventListener('click', eliminarClaseSeleccionada);
  document.getElementById('btnAgregarAlumno').addEventListener('click', agregarAlumno);
  document.getElementById('btnRefrescarAhora').addEventListener('click', cargarEstudiantes);
  document.getElementById('inputBuscador').addEventListener('input', filtrarAlumnos);
  document.getElementById('selectFiltroEstado').addEventListener('change', filtrarAlumnos);

  if (tokenDocente) {
    mostrarDashboard();
  }
});

function cambiarTab(tab) {
  document.getElementById('authError').innerText = '';
  document.getElementById('authSuccess').innerText = '';
  if (tab === 'login') {
    document.getElementById('formLogin').classList.remove('hidden');
    document.getElementById('formRegistro').classList.add('hidden');
    document.getElementById('tabBtnLogin').classList.add('active');
    document.getElementById('tabBtnRegistro').classList.remove('active');
  } else {
    document.getElementById('formLogin').classList.add('hidden');
    document.getElementById('formRegistro').classList.remove('hidden');
    document.getElementById('tabBtnLogin').classList.remove('active');
    document.getElementById('tabBtnRegistro').classList.add('active');
  }
}

async function registrarNuevoDocente() {
  const nombre = document.getElementById('regNombre').value.trim();
  const correo = document.getElementById('regCorreo').value.trim();
  const password = document.getElementById('regPass').value;
  const clave_maestra = document.getElementById('regClaveMaestra').value.trim();
  const errBox = document.getElementById('authError');
  const succBox = document.getElementById('authSuccess');

  errBox.innerText = '';
  succBox.innerText = '';

  if (!nombre || !correo || !password || !clave_maestra) {
    errBox.innerText = 'Todos los campos son obligatorios.';
    return;
  }

  try {
    const res = await fetch('/api/profesor/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, password, clave_maestra })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar');

    succBox.innerText = '¡Docente registrado con éxito! Inicia sesión.';
    setTimeout(() => {
      cambiarTab('login');
      document.getElementById('loginCorreo').value = correo;
    }, 1200);
  } catch (err) {
    errBox.innerText = err.message;
  }
}

async function iniciarSesionDocente() {
  const correo = document.getElementById('loginCorreo').value.trim();
  const password = document.getElementById('loginPass').value;
  const errBox = document.getElementById('authError');
  errBox.innerText = '';

  try {
    const res = await fetch('/api/profesor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');

    tokenDocente = data.token;
    localStorage.setItem('tokenDocente', tokenDocente);
    mostrarDashboard();
  } catch (err) {
    errBox.innerText = err.message;
  }
}

function mostrarDashboard() {
  document.getElementById('vistaAuth').classList.add('hidden');
  document.getElementById('vistaDashboard').classList.remove('hidden');
  cargarClases();
}

function cerrarSesion() {
  if (timerAutoRefresh) clearInterval(timerAutoRefresh);
  localStorage.removeItem('tokenDocente');
  location.reload();
}

function toggleAutoRefresh() {
  const btn = document.getElementById('btnAutoRefresh');
  if (timerAutoRefresh) {
    clearInterval(timerAutoRefresh);
    timerAutoRefresh = null;
    btn.innerText = 'Auto-refresco: OFF';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-secondary');
  } else {
    timerAutoRefresh = setInterval(cargarEstudiantes, 8000);
    btn.innerText = 'Auto-refresco: ON (8s)';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-danger');
  }
}

async function cargarClases() {
  const select = document.getElementById('selectClases');
  select.innerHTML = '<option value="">Cargando clases...</option>';
  try {
    const res = await fetch('/api/profesor/clases', {
      headers: { 'Authorization': 'Bearer ' + tokenDocente }
    });
    const clases = await res.json();
    select.innerHTML = '';

    if (!clases || clases.length === 0) {
      select.innerHTML = '<option value="">No tienes aulas creadas. Crea una.</option>';
      resetearMetricas();
      return;
    }

    clases.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id_clase;
      opt.innerText = `${c.nombre_clase} — Código: [${c.codigo_clase}]`;
      select.appendChild(opt);
    });

    cargarEstudiantes();
  } catch (err) {
    select.innerHTML = '<option value="">Error al cargar clases</option>';
  }
}

async function crearClase() {
  const input = document.getElementById('inputNombreClase');
  const nombre = input.value.trim();
  if (!nombre) return alert('Ingresa un nombre para la clase');

  const res = await fetch('/api/profesor/clases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenDocente
    },
    body: JSON.stringify({ nombre_clase: nombre })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'No se pudo crear la clase');

  alert(`Clase creada con éxito. Código de clase: ${data.codigo_clase}`);
  input.value = '';
  await cargarClases();
}

async function eliminarClaseSeleccionada() {
  const idClase = document.getElementById('selectClases').value;
  if (!idClase) return alert('Selecciona una clase');

  if (!confirm('¿Seguro que deseas eliminar esta aula? Se borrarán todos los estudiantes y sus Data Centers.')) {
    return;
  }

  const res = await fetch(`/api/profesor/clases/${idClase}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + tokenDocente }
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Error al eliminar');

  alert(data.mensaje);
  cargarClases();
}

async function agregarAlumno() {
  const idClase = document.getElementById('selectClases').value;
  const input = document.getElementById('inputNombreAlumno');
  const msg = document.getElementById('msgAlumno');
  const alias = input.value.trim();

  if (!idClase) return alert('Selecciona un aula primero');
  if (!alias) return alert('Ingresa el alias del alumno');

  msg.innerText = 'Registrando...';
  msg.style.color = 'var(--primary)';

  const res = await fetch(`/api/profesor/clases/${idClase}/estudiantes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tokenDocente
    },
    body: JSON.stringify({ nombreUsuario: alias })
  });
  const data = await res.json();

  if (!res.ok) {
    msg.innerText = data.error || 'Error al agregar estudiante';
    msg.style.color = 'var(--danger)';
    return;
  }

  msg.innerText = `Estudiante "${data.nombreUsuario}" dado de alta. Ya puede acceder desde Godot.`;
  msg.style.color = 'var(--success)';
  input.value = '';
  cargarEstudiantes();
}

async function eliminarAlumno(idUsuario, nombre) {
  if (!confirm(`¿Eliminar al estudiante "${nombre}" y todo su progreso?`)) return;

  const res = await fetch(`/api/profesor/estudiantes/${idUsuario}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + tokenDocente }
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'No se pudo eliminar');

  cargarEstudiantes();
}

async function cargarEstudiantes() {
  const idClase = document.getElementById('selectClases').value;
  if (!idClase) {
    resetearMetricas();
    return;
  }

  try {
    const res = await fetch(`/api/profesor/clases/${idClase}/alumnos`, {
      headers: { 'Authorization': 'Bearer ' + tokenDocente }
    });
    const alumnos = await res.json();

    listaAlumnosActuales = Array.isArray(alumnos) ? alumnos : [];
    actualizarMetricasKPI(listaAlumnosActuales);
    filtrarAlumnos();
  } catch (err) {
    document.getElementById('tablaAlumnosBody').innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--danger);">Error al consultar alumnos.</td></tr>';
  }
}

function actualizarMetricasKPI(alumnos) {
  const total = alumnos.length;
  document.getElementById('kpiTotalAlumnos').innerText = total;

  if (total === 0) {
    resetearMetricas();
    return;
  }

  let enRiesgo = 0;
  let sumaTflops = 0;
  let sumaReputacion = 0;

  alumnos.forEach(a => {
    if (a.temperaturaCD > 60 || a.carga_electrica_actual > a.capacidad_watts) {
      enRiesgo++;
    }
    sumaTflops += (a.teraflopsCD || 0);
    sumaReputacion += (a.reputacion || 0);
  });

  document.getElementById('kpiRiesgo').innerText = enRiesgo;
  document.getElementById('kpiTflopsTotal').innerHTML = `${sumaTflops} <span style="font-size: 14px;">TFLOPS</span>`;
  document.getElementById('kpiReputacionPromedio').innerHTML = `${Math.round(sumaReputacion / total)} <span style="font-size: 14px;">pts</span>`;
}

function resetearMetricas() {
  document.getElementById('kpiTotalAlumnos').innerText = '0';
  document.getElementById('kpiRiesgo').innerText = '0';
  document.getElementById('kpiTflopsTotal').innerHTML = '0 <span style="font-size: 14px;">TFLOPS</span>';
  document.getElementById('kpiReputacionPromedio').innerHTML = '0 <span style="font-size: 14px;">pts</span>';
  document.getElementById('tablaAlumnosBody').innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--sub);">No hay estudiantes registrados.</td></tr>';
}

function filtrarAlumnos() {
  const query = document.getElementById('inputBuscador').value.toLowerCase().trim();
  const filtroEstado = document.getElementById('selectFiltroEstado').value;
  const tbody = document.getElementById('tablaAlumnosBody');
  const txtCount = document.getElementById('txtResultadosFiltro');

  if (!listaAlumnosActuales || listaAlumnosActuales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--sub);">No hay estudiantes en esta clase.</td></tr>';
    txtCount.innerText = '';
    return;
  }

  const filtrados = listaAlumnosActuales.filter(a => {
    const coincideNombre = a.nombreUsuario.toLowerCase().includes(query);
    if (!coincideNombre) return false;

    if (filtroEstado === 'RIESGO') return (a.temperaturaCD > 60 || a.carga_electrica_actual > a.capacidad_watts);
    if (filtroEstado === 'OPTIMO') return (a.temperaturaCD <= 40 && a.carga_electrica_actual <= a.capacidad_watts);
    return true;
  });

  txtCount.innerText = `Mostrando ${filtrados.length} de ${listaAlumnosActuales.length}`;

  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--sub);">No se encontraron estudiantes con esos criterios.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  filtrados.forEach(a => {
    let tempClass = 'badge-ok';
    if (a.temperaturaCD > 60) tempClass = 'badge-danger';
    else if (a.temperaturaCD > 40) tempClass = 'badge-warn';

    let wattsClass = (a.carga_electrica_actual > a.capacidad_watts) ? 'color: var(--danger); font-weight: bold;' : '';

    const safeNombre = escaparHTML(a.nombreUsuario);
    const safeId = parseInt(a.id_usuario, 10);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${safeId}</td>
      <td><strong>${safeNombre}</strong></td>
      <td>$${Number(a.creditos).toFixed(2)}</td>
      <td>${Number(a.reputacion)} pts</td>
      <td>${Number(a.teraflopsCD)} TF</td>
      <td><span class="badge ${tempClass}">${Number(a.temperaturaCD)} °C</span></td>
      <td style="${wattsClass}">${Number(a.carga_electrica_actual)} / ${Number(a.capacidad_watts)} W</td>
      <td>${Number(a.contratos_finalizados) || 0}</td>
      <td>${Number(a.ataquesResueltos) || 0}</td>
      <td>
        <button class="btn btn-danger btn-eliminar-alumno" style="padding: 3px 8px; font-size: 11px;">Borrar</button>
      </td>
    `;

    tr.querySelector('.btn-eliminar-alumno').addEventListener('click', () => {
      eliminarAlumno(safeId, safeNombre);
    });

    tbody.appendChild(tr);
  });
}
