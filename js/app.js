/* =========================================================
   Portal de Certificados — lógica (HTML + JS puro)
   Los datos se guardan en localStorage del navegador.
   ========================================================= */
(() => {
  'use strict';

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const K = { users: 'cc_users', certs: 'cc_certs', settings: 'cc_settings', session: 'cc_session' };
  const CERT_W = 1123;
  const APP_TITLE = document.title;
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

  // Usuario interno que se crea la primera vez
  const ADMIN_CEDULA = 'ADMIN';
  const ADMIN_PASS = 'admin123';

  const MODELO_VERSION = 2;
  const MODELOS_OFICIALES = {
    emprende1: {
      nombre: 'Modelo 1 · Chacao Emprende',
      plantilla: 'assets/modelo-emprende-1.png',
      plantillaW: 2199,
      plantillaH: 1699,
    },
    emprende2: {
      nombre: 'Modelo 2 · Convenio UCV / FaCES',
      plantilla: 'assets/modelo-emprende-2.png',
      plantillaW: 2199,
      plantillaH: 1699,
    },
  };

  const DEFAULTS = {
    modeloVersion: MODELO_VERSION,
    modeloPreset: 'emprende1',
    institucion: 'Alcaldía de Chacao · Dirección de Desarrollo y Apoyo Social',
    titulo: 'Certificado',
    subtitulo: 'de culminación',
    textoA: 'Se otorga el presente certificado a',
    textoB: 'por haber culminado satisfactoriamente el curso del Servicio Comunitario',
    lugar: 'Chacao, Caracas',
    firma1Nombre: 'Gustavo Duque Sáez',
    firma1Cargo: 'Alcalde del Municipio Chacao',
    firma2Nombre: 'Carlos Luis García Povea',
    firma2Cargo: 'Director de Desarrollo y Apoyo Social',
    fuenteNombre: 'script',
    mostrarCedula: true,
    logo: '',
    logoPreset: 'duo',
    plantilla: MODELOS_OFICIALES.emprende1.plantilla,
    plantillaW: MODELOS_OFICIALES.emprende1.plantillaW,
    plantillaH: MODELOS_OFICIALES.emprende1.plantillaH,
    campos: null,
    camposAuto: null,
    colorTexto: '#2d4fca',
  };

  const CLAVES_CAMPO = ['intro', 'nombre', 'cedula', 'curso', 'fecha'];
  const FUENTES = {
    script: "'Great Vibes', cursive",
    serif: "700 1em 'Playfair Display', serif",
    times: "'Times New Roman', Times, serif",
    sans: "600 1em 'Geist', sans-serif",
    arial: 'Arial, Helvetica, sans-serif',
  };

  function mkCampo(x, y, ancho, size, fuente, extra = {}) {
    return {
      x, y, ancho, size, color: '#232425', fuente, align: 'center',
      mayus: false, visible: true, prefijo: '', sufijo: '', textoFijo: '',
      formatoFecha: 'completo', tapar: false, taparColor: '', taparEscala: 100, ...extra,
    };
  }

  function camposOficial(presetKey = 'emprende1', k = 1) {
    const s = n => Math.max(8, Math.round(n * k));
    const introTexto = 'La Dirección de **Desarrollo y Apoyo Social** de la Alcaldía de Chacao\na través del **Programa Chacao Emprende** otorga el presente certificado a:';
    if (presetKey === 'emprende2') {
      return {
        intro: mkCampo(50, 41.5, 84, s(21), 'sans', { textoFijo: introTexto }),
        nombre: mkCampo(50, 52.0, 88, s(76), 'sans', { color: '#2d4fca' }),
        cedula: mkCampo(50, 59.3, 60, s(18), 'sans', { color: '#4b5563', prefijo: 'C.I. ' }),
        curso: mkCampo(50, 68.0, 84, s(20), 'sans', {
          prefijo: 'Por su participación en el taller\n“',
          sufijo: '” con una duración de ({horas}) horas',
        }),
        fecha: mkCampo(50, 34.2, 70, s(16), 'arial', { prefijo: 'Chacao, ', formatoFecha: 'completo' }),
      };
    }
    return {
      intro: mkCampo(50, 38.8, 84, s(21), 'sans', { textoFijo: introTexto }),
      nombre: mkCampo(50, 51.8, 88, s(76), 'sans', { color: '#2d4fca' }),
      cedula: mkCampo(50, 59.5, 60, s(18), 'sans', { color: '#4b5563', prefijo: 'C.I. ' }),
      curso: mkCampo(50, 70.0, 84, s(20), 'sans', {
        prefijo: 'Por su participación en el taller\n“',
        sufijo: '” con una duración de ({horas}) horas',
      }),
      fecha: mkCampo(50, 93.4, 70, s(16), 'arial', { prefijo: 'Chacao, ', formatoFecha: 'completo' }),
    };
  }

  // Posición y estilo inicial de cada dato sobre un modelo genérico (x, y, ancho en % del lienzo)
  function camposBase(s = {}, k = 1) {
    const color = s.colorTexto || DEFAULTS.colorTexto;
    const yN = s.posNombre ?? 48;
    const sz = n => Math.max(8, Math.round(n * k));
    return {
      intro: mkCampo(50, 38, 84, sz(20), 'sans', {
        visible: false,
        textoFijo: 'La Dirección de **Desarrollo y Apoyo Social** de la Alcaldía de Chacao\na través del **Programa Chacao Emprende** otorga el presente certificado a:',
      }),
      nombre: mkCampo(50, yN, 86, sz(68), s.fuenteNombre || 'sans', { color }),
      cedula: mkCampo(50, yN + 7.5, 60, sz(18), 'sans', { color: '#4b5563', prefijo: 'C.I. ', visible: s.mostrarCedula !== false }),
      curso: mkCampo(50, s.posCurso ?? 67, 84, sz(20), 'sans', {
        prefijo: 'Por su participación en el taller\n“',
        sufijo: '” con una duración de ({horas}) horas',
      }),
      fecha: mkCampo(50, s.posFecha ?? 90, 70, sz(16), 'arial', { prefijo: 'Chacao, ', formatoFecha: 'completo' }),
    };
  }

  function crearSettingsPreset(presetKey = 'emprende1') {
    if (presetKey === 'digital') {
      return {
        ...DEFAULTS,
        modeloVersion: MODELO_VERSION,
        modeloPreset: 'digital',
        plantilla: '',
        plantillaW: 0,
        plantillaH: 0,
        campos: camposBase({ ...DEFAULTS, fuenteNombre: 'script' }),
        camposAuto: null,
      };
    }
    const m = MODELOS_OFICIALES[presetKey] || MODELOS_OFICIALES.emprende1;
    const key = MODELOS_OFICIALES[presetKey] ? presetKey : 'emprende1';
    const campos = camposOficial(key);
    return {
      ...DEFAULTS,
      modeloVersion: MODELO_VERSION,
      modeloPreset: key,
      plantilla: m.plantilla,
      plantillaW: m.plantillaW,
      plantillaH: m.plantillaH,
      campos,
      camposAuto: JSON.parse(JSON.stringify(campos)),
    };
  }

  const now = new Date();
  const SAMPLE = {
    cedula: '12345678',
    nombre: 'María Fernanda Pérez',
    curso: 'Marketing Digital y Emprendimiento',
    horas: 5,
    dia: now.getDate(),
    mes: now.getMonth() + 1,
    anio: now.getFullYear(),
  };

  /* ---------------- utilidades ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const clean = s => String(s ?? '').trim().replace(/\s+/g, ' ');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const fecha = c => c && c.dia
    ? `${c.dia} de ${MESES[(c.mes || 1) - 1].toLowerCase()} de ${c.anio}`
    : `${MESES[(c.mes || 1) - 1]} ${c.anio}`;
  const byDate = (a, b) => (b.anio * 400 + b.mes * 32 + (b.dia || 1)) - (a.anio * 400 + a.mes * 32 + (a.dia || 1)) || b.creado - a.creado;

  function normCedula(v) {
    let c = String(v ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (/^[VE]\d+$/.test(c)) c = c.slice(1);
    return c;
  }
  const validCedula = c => /^\d{5,10}$/.test(c);
  const fmtCedula = c => /^\d+$/.test(c) ? c.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : c;
  const initials = n => clean(n).split(' ').slice(0, 2).map(p => p[0] || '').join('').toUpperCase();

  /* ---------------- animación (GSAP) ---------------- */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = !reduceMotion && window.gsap ? window.gsap : null;
  if (G) document.body.classList.add('has-gsap');
  const canHover = matchMedia('(hover: hover)').matches;
  const ic = name => `<svg class="i"><use href="#i-${name}"/></svg>`;
  const toArr = t => t == null ? [] : t instanceof Element ? [t] : [...t];

  /* ---------------- Sistema unificado de movimiento físico (giroscopio y acelerómetro) ---------------- */
  const Motion = {
    x: 0,
    y: 0,
    hasSensor: false,
    listeners: new Set(),
    subscribe(fn) {
      this.listeners.add(fn);
      if (this.hasSensor) fn(this.x, this.y);
      return () => this.listeners.delete(fn);
    },
    emit() {
      this.listeners.forEach(fn => {
        try { fn(this.x, this.y); } catch (e) {}
      });
    },
    init() {
      let requested = false;
      const requestSensor = async () => {
        if (requested) return;
        requested = true;
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          try {
            const res = await DeviceOrientationEvent.requestPermission();
            if (res !== 'granted') return;
          } catch (e) { return; }
        }
        window.addEventListener('deviceorientation', e => this.handleOrientation(e), { passive: true });
      };

      if (typeof window.DeviceOrientationEvent !== 'undefined') {
        window.addEventListener('deviceorientation', e => this.handleOrientation(e), { passive: true });
      }

      window.addEventListener('touchstart', requestSensor, { once: true, passive: true });
      window.addEventListener('click', requestSensor, { once: true, passive: true });
    },
    handleOrientation(e) {
      if (e.beta == null || e.gamma == null) return;
      this.hasSensor = true;
      // Inclinación suave y responsiva: un leve giro de mano (±20°) genera efecto visible inmediato
      const pitch = Math.max(-1, Math.min(1, (e.beta - 48) / 22));
      const roll = Math.max(-1, Math.min(1, e.gamma / 20));
      this.x = roll;
      this.y = pitch;
      this.emit();
    }
  };
  Motion.init();

  const fx = {
    // Entrada: sube y aparece, en cascada
    in(targets, o = {}) {
      const list = toArr(targets).filter(Boolean);
      if (!G || !list.length) return;
      G.killTweensOf(list);
      G.fromTo(list, { y: o.y ?? 26, opacity: 0 }, {
        y: 0, opacity: 1, duration: o.d ?? .9, ease: o.ease ?? 'power3.out',
        stagger: o.stagger ?? .07, delay: o.delay ?? 0, clearProps: 'transform,opacity',
      });
    },
    count(el, to) {
      if (!el) return;
      if (!G) { el.textContent = to; return; }
      const o = { v: +el.textContent || 0 };
      G.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
    },
    shake(el) {
      if (G) G.fromTo(el, { x: -10 }, { x: 0, duration: .7, ease: 'elastic.out(1, .3)', clearProps: 'transform' });
    },
    // "Sello" dorado al emitir un certificado
    stamp(el) {
      if (!G) return;
      G.fromTo(el, { scale: .95, boxShadow: '0 0 0 10px rgba(217,187,116,.55)' },
        { scale: 1, boxShadow: '0 0 0 0 rgba(217,187,116,0)', duration: 1, ease: 'elastic.out(1, .55)', clearProps: 'transform,boxShadow' });
    },
    tilt(el, max = 8) {
      if (!G || !el) return;
      const rx = G.quickTo(el, 'rotationX', { duration: .65, ease: 'power3' });
      const ry = G.quickTo(el, 'rotationY', { duration: .65, ease: 'power3' });
      
      let isInteracting = false;
      let ambientTween = null;

      // 1. Escritorio con mouse: tilt preciso con el cursor
      if (canHover) {
        el.addEventListener('pointermove', e => {
          if (e.pointerType === 'mouse') {
            const r = el.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - .5) * max);
            rx(-((e.clientY - r.top) / r.height - .5) * max);
          }
        });
        el.addEventListener('pointerleave', () => { rx(0); ry(0); });
      }

      // 2. Dispositivos móviles y táctiles:
      // A) Inclinación 3D táctil directa al tocar o arrastrar el dedo sobre el elemento
      const handleTouchTilt = e => {
        const t = e.touches ? e.touches[0] : e;
        if (!t) return;
        isInteracting = true;
        if (ambientTween) ambientTween.pause();
        const r = el.getBoundingClientRect();
        const cx = Math.max(-1, Math.min(1, ((t.clientX - r.left) / r.width) - 0.5));
        const cy = Math.max(-1, Math.min(1, ((t.clientY - r.top) / r.height) - 0.5));
        ry(cx * max * 1.5);
        rx(-cy * max * 1.5);
      };

      el.addEventListener('touchstart', e => {
        handleTouchTilt(e);
        G.to(el, { scale: 0.982, duration: 0.18, ease: 'power2.out' });
      }, { passive: true });

      el.addEventListener('touchmove', handleTouchTilt, { passive: true });

      el.addEventListener('touchend', () => {
        isInteracting = false;
        G.to(el, { scale: 1, duration: 0.45, ease: 'back.out(1.6)' });
        if (!Motion.hasSensor) {
          rx(0); ry(0);
          if (ambientTween) ambientTween.resume();
        } else {
          rx(-Motion.y * max);
          ry(Motion.x * max);
        }
      }, { passive: true });

      // B) Reacción física al giroscopio del teléfono
      Motion.subscribe((roll, pitch) => {
        if (isInteracting) return;
        rx(-pitch * max);
        ry(roll * max);
      });

      // C) Reacción al scroll vertical en móvil (profundidad 3D dinámica al deslizar)
      const handleScrollTilt = () => {
        if (isInteracting || Motion.hasSensor) return;
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const viewCenter = window.innerHeight / 2;
        const cardCenter = r.top + r.height / 2;
        const offsetNorm = Math.max(-1, Math.min(1, (cardCenter - viewCenter) / (window.innerHeight * 0.6)));
        rx(offsetNorm * (max * 0.75));
      };
      window.addEventListener('scroll', handleScrollTilt, { passive: true });

      // D) Movimiento 3D sutil continuo ("respiración / flotación") para que el elemento siempre luzca vivo
      if (!canHover) {
        ambientTween = G.timeline({ repeat: -1, yoyo: true })
          .to(el, { rotationY: max * 0.35, rotationX: -max * 0.25, duration: 3.2, ease: 'sine.inOut' })
          .to(el, { rotationY: -max * 0.35, rotationX: max * 0.25, duration: 3.8, ease: 'sine.inOut' });
      }
    },
  };

  // Divide un título en palabras para revelarlas una a una
  function splitWords(el) {
    if (!el.dataset.split) {
      const walk = node => [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span');
            const i = document.createElement('span');
            w.className = 'w';
            i.textContent = part;
            w.append(i);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
      walk(el);
      el.dataset.split = '1';
    }
    return $$('.w > span', el);
  }

  function toast(msg, type = 'ok') {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    $('#toasts').append(t);
    if (G) {
      G.fromTo(t, { y: 24, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .6, ease: 'back.out(1.7)' });
      setTimeout(() => G.to(t, { y: 12, opacity: 0, duration: .4, ease: 'power2.in', onComplete: () => t.remove() }), 3800);
    } else {
      setTimeout(() => t.remove(), 4000);
    }
  }

  async function hashPass(cedula, pass) {
    const text = `${cedula}::${pass}`;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Respaldo si el navegador no ofrece crypto.subtle
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'x' + (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }

  /* ---------------- almacenamiento ---------------- */
  const store = {
    read(k, def) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
    },
    write(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch {
        toast('No hay espacio suficiente en el navegador. Usa imágenes más livianas.', 'error');
        return false;
      }
    },
  };
  const getUsers = () => store.read(K.users, []);
  const setUsers = v => store.write(K.users, v);
  const getCerts = () => store.read(K.certs, []);
  const setCerts = v => store.write(K.certs, v);
  function migrarCampos(campos, s) {
    const base = MODELOS_OFICIALES[s.modeloPreset] ? camposOficial(s.modeloPreset) : camposBase(s);
    const out = {};
    CLAVES_CAMPO.forEach(cl => {
      out[cl] = { ...base[cl], ...(campos[cl] || {}) };
    });
    return out;
  }

  function getSettings() {
    const raw = store.read(K.settings, null);
    if (!raw || (!raw.modeloVersion && !raw.plantilla)) {
      return crearSettingsPreset('emprende1');
    }
    const s = { ...DEFAULTS, ...raw };
    if (!s.campos) s.campos = MODELOS_OFICIALES[s.modeloPreset] ? camposOficial(s.modeloPreset) : camposBase(s);
    else s.campos = migrarCampos(s.campos, s);
    return s;
  }
  const setSettings = v => store.write(K.settings, v);

  function currentUser() {
    const c = sessionStorage.getItem(K.session);
    return c ? getUsers().find(u => u.cedula === c) || null : null;
  }

  function parseTalleres(areasStr) {
    const seen = new Set();
    const out = [];
    String(areasStr || '')
      .split(',')
      .map(s => clean(s))
      .filter(s => s.length >= 2)
      .forEach(t => {
        const key = t.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(t);
        }
      });
    return out;
  }

  // Genera automáticamente un certificado (pendiente por defecto) por cada taller registrado del usuario usando sus propios datos
  function sincronizarCertificadosUsuario(user, opts = {}) {
    if (!user || user.role === 'admin') return 0;
    const talleres = parseTalleres(user.areas);
    if (!talleres.length) return 0;
    const certs = getCerts();
    const delUsuario = certs.filter(c => c.cedula === user.cedula);
    const habilitado = opts.habilitado === true;
    const horas = Math.min(500, Math.max(1, +opts.horas || 5));
    const modelo = opts.modelo || '';
    let added = 0;

    const hoy = new Date();
    talleres.forEach((taller, idx) => {
      const k = taller.toLowerCase();
      const yaExiste = delUsuario.some(c =>
        clean(c.curso).toLowerCase() === k || (c.area && clean(c.area).toLowerCase() === k)
      );
      if (yaExiste) return;
      const nuevo = {
        id: uid(),
        cedula: user.cedula,
        nombre: user.nombre,
        curso: taller,
        area: taller,
        horas,
        dia: hoy.getDate(),
        mes: hoy.getMonth() + 1,
        anio: hoy.getFullYear(),
        modelo,
        habilitado,
        origen: 'registro',
        creado: Date.now() + idx,
      };
      certs.push(nuevo);
      delUsuario.push(nuevo);
      added++;
    });

    if (added > 0) setCerts(certs);
    return added;
  }

  function updatePendingBadge() {
    const badge = $('#nav-pending-badge');
    if (!badge) return;
    const u = currentUser();
    if (!u || u.role !== 'admin') {
      badge.classList.add('hidden');
      return;
    }
    const pending = getCerts().filter(c => c.habilitado === false).length;
    badge.textContent = pending;
    badge.classList.toggle('hidden', pending === 0);
    if ($('.nav-link.active')) moveIndicator(true);
  }

  async function seedAdmin() {
    const users = getUsers();
    if (!users.some(u => u.role === 'admin')) {
      users.push({
        cedula: ADMIN_CEDULA, nombre: 'Administrador', role: 'admin',
        pass: await hashPass(ADMIN_CEDULA, ADMIN_PASS), creado: Date.now(),
      });
      setUsers(users);
    }

    // Asegurar siempre la existencia de la cuenta demo estudiante (12345678 / 123456)
    const demoCed = '12345678';
    const demoName = 'María Fernanda Pérez';
    const demoEmail = 'maria.perez@estudiante.com';
    const demoAreas = 'Emprendimiento, Oficio, Servicio Comunitario';
    let demoUser = users.find(u => u.cedula === demoCed);
    const demoPassHash = await hashPass(demoCed, '123456');

    if (!demoUser) {
      demoUser = {
        cedula: demoCed, nombre: demoName, email: demoEmail, areas: demoAreas, role: 'user', pass: demoPassHash, creado: Date.now(),
      };
      users.push(demoUser);
      setUsers(users);
    } else {
      demoUser.email = demoUser.email || demoEmail;
      demoUser.areas = demoUser.areas || demoAreas;
      if (demoUser.pass !== demoPassHash && !demoUser.customPass) {
        demoUser.pass = demoPassHash;
        setUsers(users);
      }
    }

    // Datos de demostración iniciales para mostrar certificados habilitados y pendientes
    const certs = getCerts();
    if (!certs.some(c => c.cedula === demoCed)) {
      certs.push({
        id: uid(),
        cedula: demoCed,
        nombre: demoName,
        curso: 'Formación Comunitaria y Liderazgo Local',
        area: 'Servicio Comunitario',
        horas: 5,
        dia: now.getDate(),
        mes: now.getMonth() + 1,
        anio: now.getFullYear(),
        modelo: '',
        habilitado: true,
        creado: Date.now() - 86400000,
      }, {
        id: uid(),
        cedula: demoCed,
        nombre: demoName,
        curso: 'Capacitación Técnica en Barbería y Oficios',
        area: 'Oficio',
        horas: 8,
        dia: Math.max(1, now.getDate() - 2),
        mes: now.getMonth() + 1,
        anio: now.getFullYear(),
        modelo: '',
        habilitado: true,
        creado: Date.now() - 43200000,
      }, {
        id: uid(),
        cedula: demoCed,
        nombre: demoName,
        curso: 'Planificación Financiera para Emprendedores',
        area: 'Emprendimiento',
        horas: 5,
        dia: 15,
        mes: now.getMonth() || 12,
        anio: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
        modelo: '',
        habilitado: false,
        creado: Date.now() - 172800000,
      });
      setCerts(certs);
    }

    // Sembrar un participante pendiente de demostración la primera vez para mostrar la habilitación admin
    if (!localStorage.getItem('cc_seed_v2')) {
      const ced2 = '24567890';
      if (!users.some(u => u.cedula === ced2)) {
        const carlos = {
          cedula: ced2,
          nombre: 'Carlos Eduardo Silva',
          email: 'carlos.silva@emprende.ve',
          areas: 'Marketing Digital y Emprendimiento, Panadería Artesanal',
          role: 'user',
          pass: await hashPass(ced2, '123456'),
          creado: Date.now() - 3600000,
        };
        users.push(carlos);
        setUsers(users);
        sincronizarCertificadosUsuario(carlos, { habilitado: false });
      }
      localStorage.setItem('cc_seed_v2', '1');
    }

    // Asegurar que usuarios existentes tengan propiedad areas
    let modified = false;
    users.forEach(u => {
      if (u.role !== 'admin' && !u.areas) {
        u.areas = 'Bienestar Social, Salud';
        modified = true;
      }
    });
    if (modified) setUsers(users);
  }

  /* =========================================================
     CERTIFICADO
     ========================================================= */
  function nameSize(nombre, fuente) {
    const sizes = fuente === 'script' ? [62, 52, 44] : [44, 38, 32];
    return nombre.length > 38 ? sizes[2] : nombre.length > 28 ? sizes[1] : sizes[0];
  }
  const courseSize = curso => curso.length > 70 ? 22 : curso.length > 45 ? 26 : 30;

  // Resuelve la configuración efectiva de un certificado; si se subió un modelo PDF personalizado global, lo aplica a todos salvo asignación manual explícita
  function resolveSettings(c, s = getSettings()) {
    if (c && c.modelo && MODELOS_OFICIALES[c.modelo] && (c.modeloManual || s.modeloPreset !== 'custom') && c.modelo !== s.modeloPreset) {
      const m = MODELOS_OFICIALES[c.modelo];
      return {
        ...s,
        modeloPreset: c.modelo,
        plantilla: m.plantilla,
        plantillaW: m.plantillaW,
        plantillaH: m.plantillaH,
        campos: camposOficial(c.modelo),
      };
    }
    return s;
  }

  // Resuelve los datos vivos del participante (nombre, cédula) y asigna automáticamente la fecha actual (fecha de descarga)
  function datosCertificado(c, hoy = new Date()) {
    if (!c) return c;
    const u = getUsers().find(x => x.cedula === c.cedula);
    const nombre = (u && u.nombre) ? u.nombre : (c.nombre || '');
    const cedula = (u && u.cedula) ? u.cedula : (c.cedula || '');
    if (c.fechaFija) {
      return { ...c, nombre, cedula };
    }
    return {
      ...c,
      nombre,
      cedula,
      dia: hoy.getDate(),
      mes: hoy.getMonth() + 1,
      anio: hoy.getFullYear(),
    };
  }

  function fechaTimestamp(ts) {
    const d = new Date(ts);
    return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
  }

  // Tamaño del lienzo: el lado largo mide siempre 1123 px y el otro sigue al modelo
  function tamano(s) {
    if (!s.plantilla || !s.plantillaW || !s.plantillaH) return { w: CERT_W, h: 794 };
    const k = CERT_W / Math.max(s.plantillaW, s.plantillaH);
    return { w: Math.round(s.plantillaW * k), h: Math.round(s.plantillaH * k) };
  }

  function textoCampo(clave, f, c) {
    let t = '';
    if (clave === 'intro') {
      t = f.textoFijo || 'La Dirección de **Desarrollo y Apoyo Social** de la Alcaldía de Chacao\na través del **Programa Chacao Emprende** otorga el presente certificado a:';
    } else if (clave === 'nombre') {
      t = c.nombre || '';
    } else if (clave === 'curso') {
      t = c.curso || '';
    } else if (clave === 'cedula') {
      const ci = normCedula(c.cedula);
      t = /^\d+$/.test(ci) ? fmtCedula(ci) : (c.cedula || '');
    } else if (clave === 'fecha') {
      const ahora = new Date();
      const dia = c.dia || ahora.getDate();
      const mesIdx = Math.max(0, Math.min(11, (+c.mes || (ahora.getMonth() + 1)) - 1));
      const mesNombre = MESES[mesIdx];
      const anio = c.anio || ahora.getFullYear();
      const fmt = f.formatoFecha || 'completo';
      if (fmt === 'completo') {
        t = `${dia} de ${mesNombre.toLowerCase()} de ${anio}`;
      } else if (fmt === 'numerico') {
        t = `${String(dia).padStart(2, '0')}/${String(mesIdx + 1).padStart(2, '0')}/${anio}`;
      } else {
        t = `${f.prefijo ? mesNombre.toLowerCase() : mesNombre} de ${anio}`;
      }
    }
    if (!t) return '';
    const pref = f.prefijo || '';
    let suf = f.sufijo || '';
    if (suf.includes('{horas}')) {
      const hVal = (c.horas !== undefined && c.horas !== null && String(c.horas).trim() !== '') ? c.horas : '5';
      suf = suf.replace(/\{horas\}/g, hVal);
    }
    const res = pref + t + suf;
    return f.mayus ? res.toUpperCase() : res;
  }

  // Renderiza texto seguro manteniendo saltos de línea y negrita Chacao (**texto**) en el encabezado
  function renderCampoTextoHTML(clave, texto) {
    let html = esc(texto);
    if (clave === 'intro') {
      html = html.replace(/\*\*([\s\S]+?)\*\*/g, '<strong style="color:#2d4fca;font-weight:700;">$1</strong>');
    }
    return html;
  }

  // Reduce la letra si el texto no cabe en el ancho del campo (soporta saltos de línea y marcas **)
  const medidor = document.createElement('canvas').getContext('2d');
  function letraQueCabe(texto, f, anchoPx) {
    const familia = FUENTES[f.fuente] || FUENTES.sans;
    const m = familia.match(/^(\d+) 1em (.*)$/);
    medidor.font = m ? `${m[1]} ${f.size}px ${m[2]}` : `${f.size}px ${familia}`;
    const lineas = String(texto).replace(/\*\*/g, '').split('\n');
    let maxW = 0;
    for (const l of lineas) {
      const w = medidor.measureText(l).width;
      if (w > maxW) maxW = w;
    }
    return maxW > anchoPx ? Math.max(f.size * 0.4, f.size * anchoPx / maxW * 0.98) : f.size;
  }

  function cajaParche(f, h) {
    return [f.x, f.y, f.ancho, f.size * 1.35 * ((f.taparEscala || 100) / 100) / h * 100];
  }

  function modeloHTML(c, s) {
    const { w, h } = tamano(s);
    let parches = '', campos = '';
    CLAVES_CAMPO.forEach(clave => {
      const f = s.campos[clave];
      if (!f || !f.visible) return;
      const texto = textoCampo(clave, f, c);
      if (!texto) return;
      if (f.tapar && f.taparColor) {
        const [bx, by, bw, bh] = cajaParche(f, h);
        parches += `<div class="tpl-parche" data-parche="${clave}" style="left:${bx}%;top:${by}%;width:${bw}%;height:${bh}%;background:${esc(f.taparColor)}"></div>`;
      }
      const size = letraQueCabe(texto, f, w * f.ancho / 100);
      campos += `<div class="tpl-field f-${esc(f.fuente)}" data-campo="${clave}" style="left:${+f.x}%;top:${+f.y}%;width:${+f.ancho}%;font-size:${size.toFixed(1)}px;color:${esc(f.color)};text-align:${esc(f.align)}">${renderCampoTextoHTML(clave, texto)}</div>`;
    });
    return `<div class="cert cert--tpl" style="width:${w}px;height:${h}px;background-image:url('${s.plantilla}')">${parches}${campos}</div>`;
  }

  function certHTML(c, rawSettings = getSettings()) {
    const s = resolveSettings(c, rawSettings);
    if (s.plantilla) return modeloHTML(c, s);

    const font = `f-${s.fuenteNombre || 'script'}`;
    const nSize = nameSize(c.nombre, s.fuenteNombre);
    const cSize = courseSize(c.curso);
    const ced = s.mostrarCedula && /^\d+$/.test(c.cedula)
      ? `<div class="cert-ced">C.I. ${fmtCedula(c.cedula)}</div>` : '';
    const diaTxt = c.dia ? `${c.dia} de ` : '';
    const date = `${esc(s.lugar ? s.lugar + ', ' : '')}${diaTxt}${MESES[c.mes - 1]} de ${c.anio}`;

    const signs = [[s.firma1Nombre, s.firma1Cargo], [s.firma2Nombre, s.firma2Cargo]]
      .filter(([n, k]) => clean(n) || clean(k))
      .map(([n, k]) => `<div class="cert-sign"><strong>${esc(n)}</strong><small>${esc(k)}</small></div>`);
    const seal = '<div class="cert-seal"><span>✦</span></div>';
    const signsHTML = signs.length === 2 ? signs[0] + seal + signs[1] : (signs[0] || seal);

    let logosHTML = '';
    if (s.logo) {
      logosHTML = `<div class="cert-logos"><img class="cert-logo" src="${s.logo}" alt="Logo"></div>`;
    } else {
      const p = s.logoPreset || 'duo';
      if (p === 'bienestar') {
        logosHTML = `<div class="cert-logos"><img class="cert-logo" src="assets/logo-bienestar.png" alt="Chacao Bienestar"></div>`;
      } else if (p === 'emprende') {
        logosHTML = `<div class="cert-logos"><img class="cert-logo" src="assets/logo-emprende.png" alt="Chacao Emprende"></div>`;
      } else if (p === 'alcaldia') {
        logosHTML = `<div class="cert-logos"><img class="cert-logo" src="assets/logo-alcaldia.png" alt="Alcaldía de Chacao"></div>`;
      } else {
        logosHTML = `<div class="cert-logos">
          <img class="cert-logo cert-logo--alcaldia" src="assets/logo-alcaldia.png" alt="Alcaldía de Chacao">
          <span class="cert-logo-divider"></span>
          <img class="cert-logo cert-logo--social" src="assets/logo-desarrollo-social.png" alt="Desarrollo Social Chacao">
        </div>`;
      }
    }

    return `<div class="cert">
      <div class="cert-deco cert-deco--tl"></div><div class="cert-deco cert-deco--br"></div>
      <div class="cert-border"></div>
      <div class="cert-content">
        ${logosHTML}
        <div class="cert-inst">${esc(s.institucion)}</div>
        <div class="cert-title">${esc(s.titulo)}</div>
        <div class="cert-sub">${esc(s.subtitulo)}</div>
        <p class="cert-text">${esc(s.textoA)}</p>
        <div class="cert-name ${font}" style="font-size:${nSize}px">${esc(c.nombre)}</div>
        ${ced}
        <p class="cert-text">${esc(s.textoB)}</p>
        <div class="cert-course" style="font-size:${cSize}px">${esc(c.curso)}</div>
        <div class="cert-date">${date}</div>
        <div class="cert-signs">${signsHTML}</div>
      </div>
    </div>`;
  }

  // Escala el lienzo fijo del certificado al ancho de su contenedor
  const ro = new ResizeObserver(entries => entries.forEach(e => fitFrame(e.target)));
  function fitFrame(frame) {
    const cert = frame.firstElementChild;
    if (cert && frame.clientWidth) cert.style.transform = `scale(${frame.clientWidth / cert.offsetWidth})`;
  }
  function mount(frame, cert, settings = getSettings()) {
    const eff = resolveSettings(cert, settings);
    const { w, h } = tamano(eff);
    frame.style.aspectRatio = `${w} / ${h}`;
    frame.style.maxWidth = h > w ? '520px' : '';          // un modelo vertical no ocupa toda la pantalla
    frame.style.marginInline = h > w ? 'auto' : '';
    frame.innerHTML = certHTML(cert, eff);
    fitFrame(frame);
    ro.observe(frame);
  }

  const loadImg = src => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = src; });

  function loadCanvasImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith('data:') && !src.startsWith('blob:') && typeof location !== 'undefined' && /^https?:/i.test(location.protocol)) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar imagen: ${src}`));
      img.src = src;
    });
  }

  function safeFileName(str) {
    return clean(str).replace(/[/\\?%*:|"<>]/g, '-').slice(0, 140) || 'Certificado';
  }

  function base64ToBytes(dataUrl) {
    const b64 = String(dataUrl).split(',')[1] || '';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Empaqueta un JPEG de alta resolución en un archivo PDF estándar (%PDF-1.4) para descarga directa sin diálogo de impresión
  function buildPdfFromJpeg(jpegBytes, imgW, imgH) {
    const landscape = imgW >= imgH;
    const pageW = landscape ? 841.89 : +(595.28 * imgW / imgH).toFixed(2);
    const pageH = landscape ? +(841.89 * imgH / imgW).toFixed(2) : 595.28;
    const enc = new TextEncoder();
    const parts = [];
    let offset = 0;
    const offsets = [0];
    const pushStr = s => { const b = enc.encode(s); parts.push(b); offset += b.length; };
    const pushBin = b => { parts.push(b); offset += b.length; };

    pushStr('%PDF-1.4\n');
    pushBin(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

    offsets.push(offset);
    pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    offsets.push(offset);
    pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

    offsets.push(offset);
    pushStr(`3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> /MediaBox [0 0 ${pageW} ${pageH}] /Contents 5 0 R >>\nendobj\n`);

    offsets.push(offset);
    pushStr(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    pushBin(jpegBytes);
    pushStr('\nendstream\nendobj\n');

    const stream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
    offsets.push(offset);
    pushStr(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);

    const xrefStart = offset;
    pushStr(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    for (let i = 1; i < offsets.length; i++) {
      pushStr(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    }
    pushStr(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  function canvasFontSpec(fuente, px, clave, forceBold = false) {
    const fam = {
      script: '"Great Vibes", cursive',
      serif: '"Playfair Display", serif',
      times: '"Times New Roman", Times, serif',
      sans: 'Geist, sans-serif',
      arial: 'Arial, Helvetica, sans-serif',
    }[fuente] || 'Geist, sans-serif';
    let w = '600';
    if (forceBold) w = '700';
    else if (fuente === 'serif') w = '700';
    else if (fuente === 'script' || fuente === 'times') w = '400';
    else if (fuente === 'arial') w = '500';
    else if (clave === 'nombre') w = '700';
    else if (clave === 'intro') w = '400';
    else if (clave === 'fecha') w = '500';
    return `${w} ${px.toFixed(1)}px ${fam}`;
  }

  function parseStyledRuns(texto, baseColor, hasBoldTokens) {
    if (!hasBoldTokens) return [{ text: texto, bold: false, color: baseColor }];
    const runs = [];
    const re = /\*\*([\s\S]+?)\*\*/g;
    let last = 0, m;
    while ((m = re.exec(texto)) !== null) {
      if (m.index > last) runs.push({ text: texto.slice(last, m.index), bold: false, color: baseColor });
      runs.push({ text: m[1], bold: true, color: '#2d4fca' });
      last = m.index + m[0].length;
    }
    if (last < texto.length) runs.push({ text: texto.slice(last), bold: false, color: baseColor });
    return runs;
  }

  function drawFieldOnCanvas(ctx, clave, f, c, cvW, cvH, scale) {
    const texto = textoCampo(clave, f, c);
    if (!texto) return;

    const wCss = cvW / scale;
    const hCss = cvH / scale;
    if (f.tapar && f.taparColor) {
      const [bx, by, bw, bh] = cajaParche(f, hCss);
      ctx.fillStyle = f.taparColor;
      ctx.fillRect((bx - bw / 2) / 100 * cvW, (by - bh / 2) / 100 * cvH, bw / 100 * cvW, bh / 100 * cvH);
    }

    const sizeCss = letraQueCabe(texto, f, wCss * f.ancho / 100);
    const px = sizeCss * scale;
    const lh = px * (clave === 'intro' ? 1.38 : clave === 'curso' ? 1.32 : 1.25);
    const boxW = f.ancho / 100 * cvW;
    const cx = f.x / 100 * cvW;
    const cy = f.y / 100 * cvH;

    // Dividir en líneas respetando saltos de línea y ancho máximo del campo
    const lines = [];
    String(texto).split('\n').forEach(rawPara => {
      const runs = parseStyledRuns(rawPara, f.color || '#232425', clave === 'intro');
      const tokens = [];
      runs.forEach(r => {
        r.text.split(/(\s+)/).filter(Boolean).forEach(part => {
          tokens.push({ text: part, space: /^\s+$/.test(part), bold: r.bold, color: r.color });
        });
      });
      if (!tokens.length) { lines.push([]); return; }

      let curLine = [], curW = 0;
      tokens.forEach(tok => {
        ctx.font = canvasFontSpec(f.fuente, px, clave, tok.bold);
        const tw = ctx.measureText(tok.text).width;
        if (curLine.length && !tok.space && curW + tw > boxW) {
          while (curLine.length && curLine[curLine.length - 1].space) curLine.pop();
          if (curLine.length) lines.push(curLine);
          curLine = [tok];
          curW = tw;
        } else {
          curLine.push(tok);
          curW += tw;
        }
      });
      while (curLine.length && curLine[curLine.length - 1].space) curLine.pop();
      lines.push(curLine);
    });

    const totalH = lines.length * lh;
    let y = cy - totalH / 2 + lh / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    lines.forEach(lineTokens => {
      const lineW = lineTokens.reduce((sum, t) => {
        ctx.font = canvasFontSpec(f.fuente, px, clave, t.bold);
        return sum + ctx.measureText(t.text).width;
      }, 0);
      let x = cx - lineW / 2;
      if (f.align === 'left') x = cx - boxW / 2;
      else if (f.align === 'right') x = cx + boxW / 2 - lineW;

      lineTokens.forEach(t => {
        ctx.font = canvasFontSpec(f.fuente, px, clave, t.bold);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, x, y);
        x += ctx.measureText(t.text).width;
      });
      y += lh;
    });
  }

  function wrapSimpleLines(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const out = [];
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = cur + ' ' + words[i];
      if (ctx.measureText(next).width <= maxW) cur = next;
      else { out.push(cur); cur = words[i]; }
    }
    out.push(cur);
    return out;
  }

  async function renderDigitalToCanvas(ctx, c, s, K) {
    const W = CERT_W * K, H = 794 * K;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const rad = ctx.createRadialGradient(W * 0.5, H * 0.48, 0, W * 0.5, H * 0.48, W * 0.45);
    rad.addColorStop(0, 'rgba(0, 150, 242, 0.05)');
    rad.addColorStop(1, 'rgba(0, 150, 242, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);

    // Ribbons de esquinas Chacao
    const poly = (pts, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * K, pts[0][1] * K);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * K, pts[i][1] * K);
      ctx.closePath();
      ctx.fill();
    };
    poly([[0, 0], [192, 0], [0, 192]], '#004fc8');
    poly([[192, 0], [210, 0], [0, 210], [0, 192]], '#0096f2');
    poly([[210, 0], [222, 0], [0, 222], [0, 210]], '#38b6ff');
    poly([[1123, 794], [931, 794], [1123, 602]], '#004fc8');
    poly([[931, 794], [913, 794], [1123, 584], [1123, 602]], '#0096f2');
    poly([[913, 794], [901, 794], [1123, 572], [1123, 584]], '#38b6ff');

    // Doble marco
    ctx.strokeStyle = '#004fc8';
    ctx.lineWidth = 2.5 * K;
    ctx.strokeRect(26 * K, 26 * K, (1123 - 52) * K, (794 - 52) * K);
    ctx.strokeStyle = 'rgba(0, 150, 242, 0.55)';
    ctx.lineWidth = 1.5 * K;
    ctx.strokeRect(33 * K, 33 * K, (1123 - 66) * K, (794 - 66) * K);

    // Logos
    const logoUrls = s.logo ? [s.logo] : ({
      bienestar: ['assets/logo-bienestar.png'],
      emprende: ['assets/logo-emprende.png'],
      alcaldia: ['assets/logo-alcaldia.png'],
    }[s.logoPreset || 'duo'] || ['assets/logo-alcaldia.png', 'assets/logo-desarrollo-social.png']);
    const loadedLogos = (await Promise.all(logoUrls.map(u => loadCanvasImg(u).catch(() => null)))).filter(Boolean);
    if (loadedLogos.length) {
      const maxH = 98 * K;
      const sized = loadedLogos.map(im => {
        const sc = Math.min(maxH / im.height, (260 * K) / im.width);
        return { im, w: im.width * sc, h: im.height * sc };
      });
      const gap = sized.length > 1 ? 44 * K : 0;
      const totW = sized.reduce((acc, it) => acc + it.w, 0) + gap * (sized.length - 1);
      let lx = W / 2 - totW / 2;
      const cyLogo = 102 * K;
      sized.forEach((it, idx) => {
        ctx.drawImage(it.im, lx, cyLogo - it.h / 2, it.w, it.h);
        lx += it.w;
        if (idx === 0 && sized.length > 1) {
          ctx.fillStyle = '#0096f2';
          ctx.fillRect(lx + gap / 2 - K, cyLogo - 34 * K, 2 * K, 68 * K);
          lx += gap;
        }
      });
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#666666';
    ctx.font = `600 ${13.5 * K}px Geist, sans-serif`;
    ctx.fillText(String(s.institucion || '').toUpperCase(), W / 2, 182 * K);

    ctx.fillStyle = '#004fc8';
    ctx.font = `700 ${62 * K}px "Playfair Display", serif`;
    ctx.fillText(String(s.titulo || 'Certificado').toUpperCase(), W / 2, 234 * K);

    ctx.fillStyle = '#0096f2';
    ctx.font = `600 ${15 * K}px Geist, sans-serif`;
    ctx.fillText(String(s.subtitulo || '').toUpperCase(), W / 2, 280 * K);

    ctx.fillStyle = '#666666';
    ctx.font = `italic 400 ${19 * K}px "Playfair Display", serif`;
    ctx.fillText(String(s.textoA || ''), W / 2, 330 * K);

    const fName = s.fuenteNombre || 'script';
    const nSize = nameSize(c.nombre, fName) * K;
    ctx.fillStyle = '#004fc8';
    ctx.font = canvasFontSpec(fName, nSize, 'nombre');
    ctx.fillText(String(c.nombre || ''), W / 2, 386 * K);
    const nameW = Math.max(560 * K, ctx.measureText(String(c.nombre || '')).width + 80 * K);
    ctx.fillStyle = '#0096f2';
    ctx.fillRect(W / 2 - nameW / 2, 424 * K, nameW, 2 * K);

    let yNext = 446 * K;
    if (s.mostrarCedula && /^\d+$/.test(c.cedula)) {
      ctx.fillStyle = '#666666';
      ctx.font = `600 ${13.5 * K}px Geist, sans-serif`;
      ctx.fillText(`C.I. ${fmtCedula(c.cedula)}`, W / 2, yNext);
      yNext += 34 * K;
    } else {
      yNext += 14 * K;
    }

    ctx.fillStyle = '#666666';
    ctx.font = `italic 400 ${19 * K}px "Playfair Display", serif`;
    ctx.fillText(String(s.textoB || ''), W / 2, yNext);
    yNext += 40 * K;

    const cSize = courseSize(c.curso) * K;
    ctx.fillStyle = '#004fc8';
    ctx.font = `700 ${cSize}px "Playfair Display", serif`;
    const cLines = wrapSimpleLines(ctx, c.curso, 820 * K);
    cLines.forEach(l => { ctx.fillText(l, W / 2, yNext); yNext += cSize * 1.28; });

    const diaTxt = c.dia ? `${c.dia} de ` : '';
    const dateStr = `${s.lugar ? s.lugar + ', ' : ''}${diaTxt}${MESES[(c.mes || 1) - 1]} de ${c.anio}`;
    ctx.fillStyle = '#666666';
    ctx.font = `500 ${15.5 * K}px Geist, sans-serif`;
    ctx.fillText(dateStr, W / 2, Math.min(615 * K, yNext + 14 * K));

    // Sello y firmas abajo
    const ySign = 695 * K;
    const drawSign = (x, nom, car) => {
      ctx.fillStyle = '#004fc8';
      ctx.fillRect(x - 125 * K, ySign - 18 * K, 250 * K, 1.5 * K);
      ctx.fillStyle = '#353535';
      ctx.font = `600 ${15 * K}px Geist, sans-serif`;
      ctx.fillText(nom, x, ySign + 4 * K);
      ctx.fillStyle = '#666666';
      ctx.font = `400 ${13 * K}px Geist, sans-serif`;
      ctx.fillText(car, x, ySign + 24 * K);
    };
    const signs = [[s.firma1Nombre, s.firma1Cargo], [s.firma2Nombre, s.firma2Cargo]]
      .filter(([n, k]) => clean(n) || clean(k));

    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, ySign - 8 * K, 46 * K, 0, Math.PI * 2);
    const sg = ctx.createRadialGradient(W / 2 - 14 * K, ySign - 24 * K, 4 * K, W / 2, ySign - 8 * K, 46 * K);
    sg.addColorStop(0, '#38b6ff');
    sg.addColorStop(0.5, '#0096f2');
    sg.addColorStop(1, '#004fc8');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.setLineDash([4 * K, 4 * K]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5 * K;
    ctx.beginPath();
    ctx.arc(W / 2, ySign - 8 * K, 35 * K, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${26 * K}px sans-serif`;
    ctx.fillText('✦', W / 2, ySign - 7 * K);
    ctx.restore();

    if (signs.length >= 1) drawSign(W / 2 - 245 * K, signs[0][0], signs[0][1]);
    if (signs.length >= 2) drawSign(W / 2 + 245 * K, signs[1][0], signs[1][1]);
  }

  async function certToCanvas(c, rawSettings) {
    const s = resolveSettings(c, rawSettings);
    if (document.fonts) {
      if (document.fonts.ready) await document.fonts.ready;
      if (typeof document.fonts.load === 'function') {
        await Promise.allSettled([
          document.fonts.load('600 40px Geist'),
          document.fonts.load('700 40px "Playfair Display"'),
          document.fonts.load('40px "Great Vibes"'),
        ]);
      }
    }
    const { w, h } = tamano(s);
    const K = 2;
    const cv = document.createElement('canvas');
    cv.width = w * K;
    cv.height = h * K;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);

    if (s.plantilla) {
      const bg = await loadCanvasImg(s.plantilla);
      ctx.drawImage(bg, 0, 0, cv.width, cv.height);
      CLAVES_CAMPO.forEach(clave => {
        const f = s.campos[clave];
        if (!f || !f.visible) return;
        drawFieldOnCanvas(ctx, clave, f, c, cv.width, cv.height, K);
      });
    } else {
      await renderDigitalToCanvas(ctx, c, s, K);
    }
    return cv;
  }

  // Prepara el área de impresión (solo respaldo si canvas en file:// es bloqueado por CORS)
  async function prepararImpresion(c, rawSettings) {
    const s = resolveSettings(c, rawSettings);
    const area = $('#print-area');
    area.innerHTML = certHTML(c, s);
    await Promise.all([s.plantilla, s.logo].filter(Boolean).map(loadImg));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    area.innerHTML = certHTML(c, s);
    const estilo = $('#estilo-pagina') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'estilo-pagina' }));
    if (s.plantilla) {
      const { w, h } = tamano(s);
      estilo.textContent = `@media print { @page { size: ${w}px ${h}px; margin: 0; } #print-area .cert { height: ${h - 1}px !important; } }`;
    } else {
      estilo.textContent = '';
    }
  }

  async function printCert(c) {
    const hoy = new Date();
    const resolved = datosCertificado(c, hoy);
    const u = currentUser();
    if (u && u.role !== 'admin') {
      const certs = getCerts();
      const stored = certs.find(x => x.id === c.id);
      if (stored) {
        stored.dia = hoy.getDate();
        stored.mes = hoy.getMonth() + 1;
        stored.anio = hoy.getFullYear();
        stored.descargadoEn = hoy.getTime();
        setCerts(certs);
      }
    }

    const s = getSettings();
    const nombreArchivo = `${safeFileName(`Certificado - ${resolved.nombre} - ${resolved.curso}`)}.pdf`;

    try {
      const cv = await certToCanvas(resolved, s);
      const dataUrl = cv.toDataURL('image/jpeg', 0.94);
      const jpegBytes = base64ToBytes(dataUrl);
      const pdfBlob = buildPdfFromJpeg(jpegBytes, cv.width, cv.height);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      toast(`¡Descargado! ${nombreArchivo}`);
      if (!$('#view-mis').classList.contains('hidden')) renderMis();
      if (!$('#view-lista').classList.contains('hidden')) renderLista();
    } catch (err) {
      console.warn('Descarga directa bloqueada en modo local sin servidor, usando impresión:', err);
      const area = $('#print-area');
      await prepararImpresion(resolved, s);
      document.title = nombreArchivo.replace(/\.pdf$/i, '');
      window.addEventListener('afterprint', () => {
        document.title = APP_TITLE;
        area.innerHTML = '';
        if (!$('#view-mis').classList.contains('hidden')) renderMis();
        if (!$('#view-lista').classList.contains('hidden')) renderLista();
      }, { once: true });
      toast('Elige “Guardar como PDF” para completar la descarga.');
      setTimeout(() => window.print(), 50);
    }
  }

  /* =========================================================
     LOGIN / REGISTRO
     ========================================================= */
  const AUTH_COPY = {
    login: ['Inicia sesión', 'Ingresa con tu cédula y contraseña.'],
    register: ['Crea tu cuenta', 'Solo necesitas tu cédula y una contraseña.'],
  };

  function switchTab(tab, animate = true) {
    const changed = $('.tabs').dataset.active !== tab;
    $('.tabs').dataset.active = tab;
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('#form-login').classList.toggle('hidden', tab !== 'login');
    $('#form-register').classList.toggle('hidden', tab !== 'register');
    $$('#auth .form-error').forEach(e => { e.textContent = ''; });
    $('#auth-title').textContent = AUTH_COPY[tab][0];
    $('#auth-sub').textContent = AUTH_COPY[tab][1];
    renderOdo($(`#form-${tab}`).cedula.value);
    if (animate && changed) {
      fx.in([$('#auth-title'), $('#auth-sub')], { y: 14, d: .7, stagger: .06 });
      fx.in($(`#form-${tab}`).children, { y: 16, d: .7, stagger: .05, delay: .08 });
    }
  }
  $$('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  /* =========================================================
     LOGIN: roseta guilloché, luz, contador de cédula
     ========================================================= */
  const NS = 'http://www.w3.org/2000/svg';

  // Patrón guilloché (como en billetes y diplomas): ondas senoidales entrelazadas en anillos
  function buildRosette() {
    const svg = $('#rosette');
    if (svg.childElementCount) return;
    const bands = [
      // radio, amplitud, ondas, ondulación del anillo, amplitud de ondulación, líneas
      { r: 118, a: 26, k: 12, m: 4, b: 8, n: 14, cls: 'band-1' },
      { r: 226, a: 36, k: 18, m: 6, b: 10, n: 18, cls: 'band-2' },
      { r: 342, a: 30, k: 26, m: 8, b: 12, n: 20, cls: 'band-3' },
      { r: 450, a: 16, k: 40, m: 0, b: 0, n: 10, cls: 'band-4' },
    ];
    const STEPS = 720;
    bands.forEach(B => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', B.cls);
      for (let i = 0; i < B.n; i++) {
        const phase = (i / B.n) * Math.PI * 2;
        let d = '';
        for (let s = 0; s <= STEPS; s++) {
          const t = (s / STEPS) * Math.PI * 2;
          const rr = B.r + B.a * Math.sin(B.k * t + phase) + B.b * Math.sin(B.m * t);
          d += `${s ? 'L' : 'M'}${(rr * Math.cos(t)).toFixed(1)} ${(rr * Math.sin(t)).toFixed(1)}`;
        }
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d + 'Z');
        g.append(p);
      }
      svg.append(g);
    });
    // Anillos finos de contorno
    [62, 66, 492].forEach(r => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('r', r);
      c.setAttribute('class', 'band-2');
      svg.append(c);
    });
  }

  // Cifras gigantes que "ruedan" al escribir la cédula
  const ODO_MIN = 8;
  function renderOdo(value) {
    const odo = $('#odo');
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    const n = Math.max(ODO_MIN, digits.length);
    while (odo.children.length < n) {
      const slot = document.createElement('span');
      slot.className = 'odo-slot';
      slot.innerHTML = '<span>0</span>';
      odo.append(slot);
    }
    while (odo.children.length > n) odo.lastElementChild.remove();
    [...odo.children].forEach((slot, i) => {
      slot.classList.toggle('gap', i > 0 && (n - i) % 3 === 0);
      const filled = i < digits.length;
      const ch = filled ? digits[i] : '0';
      const cur = slot.lastElementChild;
      if (cur.textContent === ch && slot.classList.contains('on') === filled) return;
      slot.classList.toggle('on', filled);
      const next = document.createElement('span');
      next.textContent = ch;
      if (!G) { slot.replaceChildren(next); return; }
      const dir = filled ? 1 : -1;
      slot.append(next);
      G.fromTo(next, { yPercent: 100 * dir }, { yPercent: 0, duration: .7, ease: 'expo.out' });
      G.to(cur, { yPercent: -100 * dir, duration: .7, ease: 'expo.out', onComplete: () => cur.remove() });
    });
  }
  $$('#auth input[name="cedula"]').forEach(inp => inp.addEventListener('input', () => renderOdo(inp.value)));

  let authTl = null;
  function introAuth() {
    buildRosette();
    renderOdo('');
    if (!G) return;
    if (authTl) { authTl.restart(); return; }

    const paths = $$('#rosette path, #rosette circle');
    paths.forEach(p => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });

    authTl = G.timeline({ defaults: { ease: 'power4.out' } })
      .to(paths, { strokeDashoffset: 0, duration: 2.8, ease: 'power2.inOut', stagger: .022 }, 0)
      .from('#rosette', { scale: .82, opacity: 0, duration: 2.6, ease: 'expo.out' }, 0)
      .from('.auth-top > *', { y: -14, opacity: 0, duration: .9, stagger: .1 }, .2)
      .from('.brand-pill', { y: 12, opacity: 0, duration: .8 }, .25)
      .from('.auth-left .eyebrow', { y: 14, opacity: 0, duration: .9 }, .3)
      .from(splitWords($('#auth-headline')), { yPercent: 120, duration: 1.4, stagger: .08 }, .35)
      .from('.auth-lead', { y: 20, opacity: 0, duration: 1 }, .85)
      .from('.auth-programs', { y: 20, opacity: 0, duration: 1 }, .95)
      .from('.odo-wrap', { y: 24, opacity: 0, duration: 1.1 }, 1)
      .from('.auth-card', { y: 70, opacity: 0, scale: .96, duration: 1.5, ease: 'expo.out' }, .5)
      .from('.auth-card > *', { y: 18, opacity: 0, duration: .9, stagger: .05 }, .8)
      .from('.auth-steps li', { y: 14, opacity: 0, duration: .8, stagger: .08 }, 1.2)
      .from('.auth-institution', { opacity: 0, duration: .9 }, 1.3);

    // Movimiento continuo hipnótico: la roseta gira elegantemente y la banda interior en sentido opuesto
    G.to('#rosette', { rotation: 360, duration: 90, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
    G.to('#rosette .band-2', { rotation: -360, svgOrigin: '0 0', duration: 60, repeat: -1, ease: 'none' });
    // Brillo que recorre la palabra dorada
    G.to('#auth-headline em .w > span', { backgroundPosition: '-150% 0', duration: 7, repeat: -1, ease: 'none' });

    // Luz dinámica y roseta reactiva a cursor en PC, tacto continuo y movimiento físico del celular
    const auth = $('#auth');
    const isMobile = window.innerWidth <= 1000;
    const spot = {
      x: isMobile ? auth.clientWidth * 0.5 : auth.clientWidth * 0.74,
      y: isMobile ? auth.clientHeight * 0.38 : auth.clientHeight * 0.5
    };
    const paint = () => {
      auth.style.setProperty('--mx', `${spot.x}px`);
      auth.style.setProperty('--my', `${spot.y}px`);
    };
    paint();

    const qx = G.quickTo(spot, 'x', { duration: 0.8, ease: 'power3', onUpdate: paint });
    const qy = G.quickTo(spot, 'y', { duration: 0.8, ease: 'power3', onUpdate: paint });
    const rx = G.quickTo('#rosette', 'x', { duration: 1.4, ease: 'power3' });
    const ry = G.quickTo('#rosette', 'y', { duration: 1.4, ease: 'power3' });

    // 1. Escritorio con mouse: seguimiento fluido del cursor
    auth.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' || canHover) {
        const r = auth.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        qx(px);
        qy(py);
        rx(((px / r.width) - .5) * -34);
        ry(((py / r.height) - .5) * -34);
      }
    });

    // 2. Interacción táctil en celulares: al tocar o arrastrar el dedo en cualquier punto de la pantalla
    let touchInteracting = false;
    const handleTouchSpot = e => {
      const t = e.touches ? e.touches[0] : e;
      if (!t) return;
      touchInteracting = true;
      const r = auth.getBoundingClientRect();
      const px = t.clientX - r.left;
      const py = t.clientY - r.top;
      qx(px);
      qy(py);
      rx(((px / r.width) - .5) * -28);
      ry(((py / r.height) - .5) * -28);
    };

    auth.addEventListener('touchstart', handleTouchSpot, { passive: true });
    auth.addEventListener('touchmove', handleTouchSpot, { passive: true });
    auth.addEventListener('touchend', () => { touchInteracting = false; }, { passive: true });

    // 3. Reacción a la inclinación del teléfono (giroscopio y acelerómetro)
    Motion.subscribe((roll, pitch) => {
      if (touchInteracting) return;
      const targetX = auth.clientWidth * (0.5 + roll * 0.42);
      const targetY = auth.clientHeight * (isMobile ? 0.38 : 0.5 + pitch * 0.35);
      qx(targetX);
      qy(targetY);
      rx(roll * -30);
      ry(pitch * -24);
    });

    // 4. Parallax con scroll en celular
    window.addEventListener('scroll', () => {
      if (touchInteracting || Motion.hasSensor) return;
      const sy = window.scrollY || window.pageYOffset;
      ry(sy * -0.15);
    }, { passive: true });

    // 5. Animación ambiental flotante por si el teléfono está inmóvil
    G.timeline({ repeat: -1, yoyo: true })
      .to(spot, {
        x: () => auth.clientWidth * (isMobile ? 0.38 : 0.62),
        y: () => auth.clientHeight * (isMobile ? 0.44 : 0.58),
        duration: 5.5,
        ease: 'sine.inOut',
        onUpdate: () => {
          if (!touchInteracting && !Motion.hasSensor) paint();
        }
      });

    // Tilt 3D reactivo en la tarjeta de autenticación
    fx.tilt($('.auth-card'), isMobile ? 8 : 6);
  }

  // Transición al entrar: la roseta se expande y la pantalla se abre en círculo
  const AUTH_FX = ['#auth', '#rosette', '.auth-card', '.auth-left > *', '.auth-top > *', '.auth-steps li', '.auth-institution'];
  function authExit() {
    if (!G) return Promise.resolve();
    const isMobile = window.innerWidth <= 1000;
    const center = isMobile ? '50% 40%' : '74% 50%';
    return G.timeline()
      .to('.auth-card', { y: -30, opacity: 0, scale: .97, duration: .55, ease: 'power3.in' }, 0)
      .to(['.auth-left > *', '.auth-top > *', '.auth-steps li'], { y: -24, opacity: 0, duration: .5, stagger: .03, ease: 'power3.in' }, 0)
      .to('#rosette', { scale: 2.6, opacity: 0, duration: 1.2, ease: 'expo.in' }, .1)
      .fromTo('#auth', { clipPath: `circle(150% at ${center})` }, { clipPath: `circle(0% at ${center})`, duration: .9, ease: 'expo.inOut' }, .55);
  }
  function resetAuthFx() {
    if (G) G.set(AUTH_FX, { clearProps: 'opacity,scale,y,clipPath' });
  }

  async function enterApp(form) {
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    form.reset();
    // La animación es solo adorno: si el navegador la pausa (pestaña en segundo plano), se entra igual
    const salida = authExit();
    await Promise.race([salida, new Promise(r => setTimeout(r, 1800))]);
    if (salida.kill) salida.kill();
    startApp();
    resetAuthFx();
    renderOdo('');
    btn.disabled = false;
  }

  $('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, err = $('.form-error', f);
    const cedula = normCedula(f.cedula.value);
    const user = getUsers().find(u => u.cedula === cedula);
    if (!user || user.pass !== await hashPass(cedula, f.password.value)) {
      err.textContent = 'Cédula o contraseña incorrecta.';
      fx.shake(f);
      return;
    }
    sessionStorage.setItem(K.session, cedula);
    enterApp(f);
  });

  /* Helper para agregar tags/áreas desde chips interactivos */
  function setupTagChips(containerSelector, inputSelector) {
    const container = $(containerSelector);
    const input = $(inputSelector);
    if (!container || !input) return;
    container.addEventListener('click', e => {
      const chip = e.target.closest('.area-chip');
      if (!chip) return;
      const tag = chip.dataset.tag;
      if (!tag) return;
      const current = input.value.split(',').map(s => s.trim()).filter(Boolean);
      if (!current.some(c => c.toLowerCase() === tag.toLowerCase())) {
        current.push(tag);
        input.value = current.join(', ');
      }
      input.focus();
    });
  }
  setupTagChips('#reg-area-chips', '#reg-areas');
  setupTagChips('#mea-chips', '#mea-areas');

  $('#form-register').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, err = $('.form-error', f);
    const cedula = normCedula(f.cedula.value);
    const nombre = clean(f.nombre.value);
    const email = clean(f.email?.value || '').toLowerCase();
    const areas = clean(f.areas?.value || '');
    const fail = msg => { err.textContent = msg; fx.shake(f); };
    if (!validCedula(cedula)) return fail('Ingresa una cédula válida (solo números).');
    if (nombre.length < 3) return fail('Escribe tu nombre y apellido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Ingresa un correo electrónico válido.');
    if (areas.length < 2) return fail('Escribe al menos un taller o área realizada (o selecciona de las sugerencias).');
    if (f.password.value.length < 6) return fail('La contraseña debe tener al menos 6 caracteres.');
    if (f.password.value !== f.password2.value) return fail('Las contraseñas no coinciden.');
    const users = getUsers();
    if (users.some(u => u.cedula === cedula)) return fail('Esa cédula ya está registrada. Inicia sesión.');
    if (users.some(u => u.email && u.email.toLowerCase() === email)) return fail('Ese correo ya está registrado por otro estudiante.');
    const newUser = {
      cedula, nombre, email, areas, role: 'user',
      pass: await hashPass(cedula, f.password.value), creado: Date.now()
    };
    users.push(newUser);
    if (!setUsers(users)) return;
    const creados = sincronizarCertificadosUsuario(newUser, { habilitado: false });
    sessionStorage.setItem(K.session, cedula);
    toast(creados
      ? `¡Cuenta creada! Registramos ${creados} taller(es) con tus datos. En espera de habilitación.`
      : '¡Cuenta creada! Bienvenido(a).');
    enterApp(f);
  });

  /* =========================================================
     APP / NAVEGACIÓN
     ========================================================= */
  function startApp() {
    const u = currentUser();
    if (!u) {
      sessionStorage.removeItem(K.session);
      $('#app').classList.add('hidden');
      $('#auth').classList.remove('hidden');
      switchTab('login', false);
      introAuth();
      return;
    }
    const isAdmin = u.role === 'admin';
    document.body.classList.toggle('is-admin', isAdmin);
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#nav-name').textContent = u.nombre;
    $('#nav-role').textContent = isAdmin ? 'Administrador' : `C.I. ${fmtCedula(u.cedula)}`;
    $('#nav-avatar').textContent = initials(u.nombre);
    $('.nav-indicator').style.opacity = 0;
    if (G) G.fromTo('.navbar', { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', clearProps: 'transform,opacity' });
    show(isAdmin ? 'usuarios' : 'mis');
    updatePendingBadge();
    if (isAdmin && u.cedula === ADMIN_CEDULA) checkDefaultAdminPass(u);
  }

  async function checkDefaultAdminPass(u) {
    if (u.pass === await hashPass(ADMIN_CEDULA, ADMIN_PASS)) {
      toast('Estás usando la contraseña inicial. Cámbiala con el botón de la llave.', 'error');
    }
  }

  const renderers = {
    mis: renderMis, lista: renderLista,
    usuarios: renderUsuarios, config: renderConfig,
  };

  function show(view) {
    const u = currentUser();
    if (!u) return startApp();
    if (u.role !== 'admin') view = 'mis';
    else if (!view || view === 'mis' || view === 'emitir') view = 'usuarios';
    const section = $(`#view-${view}`);
    $$('.view').forEach(v => v.classList.toggle('hidden', v !== section));
    $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    closeMenu();
    renderers[view]();
    window.scrollTo(0, 0);
    moveIndicator();
    animateView(section);
  }

  function animateView(section) {
    if (!G) return;
    fx.in($$('.page-head .eyebrow, .page-head h2, .page-head .lead, .stat, .page-head .search', section), { stagger: .08, d: 1 });
    fx.in($$('.reveal, .cert-card, .empty', section), { y: 50, d: 1.2, delay: .2, stagger: .1, ease: 'expo.out' });
    fx.in($$('tbody tr', section).slice(0, 30), { y: 14, d: .7, delay: .4, stagger: .03 });
  }

  // Pastilla dorada que se desliza bajo el enlace activo
  function moveIndicator(instant) {
    const ind = $('.nav-indicator'), a = $('.nav-link.active');
    if (!a || !a.offsetWidth) return;
    const first = ind.style.opacity === '0' || !ind.style.opacity;
    const props = { x: a.offsetLeft, width: a.offsetWidth, opacity: 1 };
    if (G && !instant && !first) G.to(ind, { ...props, duration: .7, ease: 'expo.out' });
    else if (G) G.set(ind, props);
    else Object.assign(ind.style, { transform: `translateX(${props.x}px)`, width: `${props.width}px`, opacity: 1 });
  }
  window.addEventListener('resize', () => moveIndicator(true));
  if (document.fonts) document.fonts.ready.then(() => moveIndicator(true));
  window.addEventListener('scroll', () => {
    $('#navbar-wrap').classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  $$('.nav-link').forEach(a => a.addEventListener('click', e => { e.preventDefault(); show(a.dataset.view); }));
  $('#nav-home').addEventListener('click', e => { e.preventDefault(); show('mis'); });
  $('#nav-toggle').addEventListener('click', () => {
    const open = $('#nav-menu').classList.toggle('open');
    $('#nav-toggle').classList.toggle('open', open);
    if (open) fx.in($$('#nav-menu .nav-link, #nav-menu .nav-user'), { y: -10, d: .5, stagger: .04 });
  });
  function closeMenu() {
    $('#nav-menu').classList.remove('open');
    $('#nav-toggle').classList.remove('open');
  }
  $('#btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem(K.session);
    document.body.classList.remove('is-admin');
    startApp();
  });

  /* ---------------- Usuario: mis certificados ---------------- */
  function renderMis() {
    const u = currentUser();
    if (!u) return;
    $('#hello-name').textContent = clean(u.nombre).split(' ')[0];

    // Talleres o áreas registradas del usuario
    const userAreas = parseTalleres(u.areas || '');
    const areasList = $('#mis-areas-list');
    if (areasList) {
      areasList.innerHTML = userAreas.length
        ? userAreas.map(a => `<span class="badge-area">${esc(a)}</span>`).join('')
        : '<span class="muted small">Sin talleres registrados aún</span>';
    }

    const certs = getCerts().filter(c => c.cedula === u.cedula).sort(byDate);
    const habilitados = certs.filter(c => c.habilitado !== false);
    const pendientes = certs.filter(c => c.habilitado === false);

    const grid = $('#mis-grid');
    $('#mis-count').textContent = 0;
    fx.count($('#mis-count'), habilitados.length);
    if ($('#mis-pending-count')) {
      $('#mis-pending-count').textContent = 0;
      fx.count($('#mis-pending-count'), pendientes.length);
    }

    const s = getSettings();
    const hoy = new Date();
    fillDatalists();
    if (!habilitados.length) {
      grid.innerHTML = `<div class="empty">
        <div class="brand-mark">${ic('award')}</div>
        <h3>${pendientes.length ? 'Aún no tienes certificados habilitados' : 'Aún no tienes certificados'}</h3>
        <p>${pendientes.length
          ? 'Tus talleres registrados aparecen abajo en espera. En cuanto el administrador los habilite podrás descargar tu certificado con tus datos y la fecha de descarga.'
          : 'Agrega arriba el taller que realizaste para que el administrador lo habilite.'}</p>
      </div>`;
    } else {
      const resueltos = habilitados.map(c => datosCertificado(c, hoy));
      grid.innerHTML = resueltos.map((c, i) => `
        <article class="cert-card">
          <div class="cert-frame" data-act="ver" data-id="${c.id}"></div>
          <div class="cert-card-body">
            <div>
              <span class="cert-card-index">Nº ${String(resueltos.length - i).padStart(2, '0')}</span>
              ${c.area ? `<span class="cert-card-area">${esc(c.area)}</span>` : ''}
            </div>
            <h3>${esc(c.curso)}</h3>
            <p>${c.descargadoEn ? `Descargado el ${fechaTimestamp(c.descargadoEn)}` : `Listo · se emite con fecha ${fecha(c)}`}${c.horas ? ` · ${c.horas} horas` : ''}</p>
            <div class="cert-card-actions">
              <button class="btn btn-light" data-act="ver" data-id="${c.id}">${ic('eye')}Ver</button>
              <button class="btn btn-primary" data-act="pdf" data-id="${c.id}">${ic('download')}Descargar PDF</button>
            </div>
          </div>
        </article>`).join('');
      $$('.cert-frame', grid).forEach(f => mount(f, resueltos.find(c => c.id === f.dataset.id), s));
      $$('.cert-card', grid).forEach(card => fx.tilt(card, 8));
    }

    // Sección de certificados pendientes por habilitación del administrador
    const pendSec = $('#mis-pendientes-section');
    const pendGrid = $('#mis-pendientes-grid');
    if (pendSec && pendGrid) {
      pendSec.classList.toggle('hidden', pendientes.length === 0);
      if (pendientes.length) {
        pendGrid.innerHTML = pendientes.map((c, i) => `
          <article class="cert-card cert-pending-card">
            <div class="cert-pending-preview">
              <div class="cert-pending-icon">${ic('shield')}</div>
              <span class="cert-pending-badge">En espera de habilitación</span>
              <p class="cert-pending-note">Datos vinculados: <strong>${esc(u.nombre)}</strong> · C.I. ${fmtCedula(u.cedula)}</p>
            </div>
            <div class="cert-card-body">
              <div>
                <span class="cert-card-index">Taller #${i + 1}</span>
                ${c.area ? `<span class="cert-card-area">${esc(c.area)}</span>` : ''}
              </div>
              <h3>${esc(c.curso)}</h3>
              <p>Pendiente · Fecha automática al descargar${c.horas ? ` · ${c.horas} horas` : ''}</p>
            </div>
            <div class="cert-pending-foot">
              El administrador solo debe habilitar este taller para activar tu descarga.
            </div>
          </article>`).join('');
      } else {
        pendGrid.innerHTML = '';
      }
    }
  }

  // Registro rápido de un taller adicional por parte del usuario (queda pendiente hasta que el admin lo habilite)
  const formUserSolicitar = $('#form-user-solicitar');
  formUserSolicitar?.addEventListener('submit', e => {
    e.preventDefault();
    const u = currentUser();
    if (!u) return;
    const f = formUserSolicitar;
    const curso = clean(f.curso?.value || '');
    const horas = Math.min(500, Math.max(1, +f.horas?.value || 5));

    if (curso.length < 3) {
      toast('Escribe el nombre del taller o curso que realizaste.', 'error');
      f.curso?.focus();
      return;
    }

    const users = getUsers();
    const user = users.find(x => x.cedula === u.cedula);
    if (!user) return;
    const actuales = parseTalleres(user.areas);
    if (!actuales.some(t => t.toLowerCase() === curso.toLowerCase())) {
      actuales.push(curso);
      user.areas = actuales.join(', ');
      if (!setUsers(users)) return;
    }

    const certs = getCerts();
    const yaCert = certs.some(c => c.cedula === user.cedula && clean(c.curso).toLowerCase() === curso.toLowerCase());
    if (yaCert) {
      toast('Ese taller ya se encuentra registrado en tu cuenta.', 'error');
      return;
    }

    sincronizarCertificadosUsuario(user, { habilitado: false, horas });
    const certsNow = getCerts();
    if (!certsNow.some(c => c.cedula === user.cedula && clean(c.curso).toLowerCase() === curso.toLowerCase())) {
      const hoy = new Date();
      certsNow.push({
        id: uid(),
        cedula: user.cedula,
        nombre: user.nombre,
        curso,
        area: curso,
        horas,
        dia: hoy.getDate(),
        mes: hoy.getMonth() + 1,
        anio: hoy.getFullYear(),
        modelo: '',
        habilitado: false,
        origen: 'solicitud',
        creado: Date.now(),
      });
      if (!setCerts(certsNow)) return;
    }

    toast('Taller registrado con tus datos. Queda en espera de habilitación.');
    f.curso.value = '';
    if (f.horas) f.horas.value = 5;
    renderMis();
  });

  // Botón para que el estudiante modifique sus áreas asignadas
  $('#btn-editar-mis-areas')?.addEventListener('click', () => {
    const u = currentUser();
    if (u) openEditAreasModal(u);
  });

  /* ---------------- Admin: utilidades y listas ---------------- */
  function fillDatalists() {
    const dlCursos = $('#dl-cursos');
    if (dlCursos) {
      dlCursos.innerHTML = [...new Set(getCerts().map(c => c.curso))]
        .map(c => `<option value="${esc(c)}"></option>`).join('');
    }
  }

  function updateStats() {
    const certs = getCerts();
    const pending = certs.filter(c => c.habilitado === false).length;
    const enabled = certs.length - pending;
    if ($('#st-users')) fx.count($('#st-users'), getUsers().filter(u => u.role !== 'admin').length);
    if ($('#st-pendientes')) fx.count($('#st-pendientes'), pending);
    if ($('#st-certs')) fx.count($('#st-certs'), enabled);
  }

  /* ---------------- Admin: lista ---------------- */
  function renderLista() {
    const q = clean($('#lista-buscar').value).toLowerCase();
    const all = getCerts().sort(byDate);
    const certs = all.filter(c => {
      const d = datosCertificado(c);
      return !q || `${d.cedula} ${d.nombre} ${d.curso}`.toLowerCase().includes(q);
    });
    $('#lista-count').textContent = q ? `${certs.length} de ${all.length} certificado(s)` : `${all.length} certificado(s) en total`;
    $('#lista-body').innerHTML = certs.length ? certs.map(c => {
      const d = datosCertificado(c);
      const hab = c.habilitado !== false;
      const fechaCol = c.descargadoEn
        ? `<span>${fechaTimestamp(c.descargadoEn)}</span> <span class="muted small">(Descargado)</span>`
        : `<span class="muted small">Al descargar</span>`;
      return `
      <tr>
        <td class="nowrap">${fmtCedula(d.cedula)}</td>
        <td class="strong">${esc(d.nombre)}</td>
        <td>${esc(d.curso)}${d.horas ? ` <span class="muted small">(${d.horas}h)</span>` : ''}</td>
        <td class="nowrap">${fechaCol}</td>
        <td>
          <button class="cert-status-pill ${hab ? 'is-enabled' : 'is-pending'}" data-act="toggle-hab" data-id="${c.id}" title="${hab ? 'Habilitado · clic para pausar' : 'Pendiente · clic para habilitar'}">
            ${hab ? '✓ Habilitado' : '⏳ Pendiente'}
          </button>
        </td>
        <td><div class="t-actions">
          <button class="btn btn-light btn-icon" data-act="ver" data-id="${c.id}" title="Ver certificado" aria-label="Ver certificado">${ic('eye')}</button>
          <button class="btn btn-light btn-icon" data-act="pdf" data-id="${c.id}" title="Descargar PDF" aria-label="Descargar PDF">${ic('download')}</button>
          <button class="btn btn-danger btn-icon" data-act="del" data-id="${c.id}" title="Eliminar" aria-label="Eliminar">${ic('trash')}</button>
        </div></td>
      </tr>`;
    }).join('')
      : `<tr><td colspan="6" class="t-empty">${q ? 'Sin resultados.' : 'Todavía no hay certificados registrados.'}</td></tr>`;
    updatePendingBadge();
  }
  $('#lista-buscar').addEventListener('input', renderLista);

  /* ---------------- Admin: usuarios ---------------- */
  function renderUsuarios() {
    const certs = getCerts();
    const me = currentUser();
    const q = clean($('#usuarios-buscar')?.value || '').toLowerCase();
    const allUsers = getUsers().sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || b.creado - a.creado);
    const users = allUsers.filter(u => {
      if (!q) return true;
      const uCerts = certs.filter(c => c.cedula === u.cedula).map(c => c.curso).join(' ');
      return `${u.cedula} ${u.nombre} ${u.email || ''} ${u.areas || ''} ${uCerts}`.toLowerCase().includes(q);
    });
    updateStats();

    $('#usuarios-body').innerHTML = users.length ? users.map(u => {
      const userCerts = certs.filter(c => c.cedula === u.cedula).sort((a, b) => (a.habilitado === false ? -1 : 1) || byDate(a, b));
      const pend = userCerts.filter(c => c.habilitado === false).length;
      const hab = userCerts.length - pend;
      const isMe = u.cedula === me.cedula;
      const userAreas = parseTalleres(u.areas || '');
      const emailTxt = u.email ? `<small class="muted" style="word-break:break-all;">${esc(u.email)}</small>` : '<span class="muted small">—</span>';

      // Pills interactivos de talleres/certificados (clic directo habilita o pausa)
      const certKeys = new Set(userCerts.map(c => clean(c.curso).toLowerCase()));
      const extraAreas = userAreas.filter(a => !certKeys.has(a.toLowerCase()) && !userCerts.some(c => c.area && clean(c.area).toLowerCase() === a.toLowerCase()));
      let talleresHtml = '';
      if (userCerts.length || extraAreas.length) {
        talleresHtml = `<div class="user-certs-pills">` +
          userCerts.map(c => {
            const on = c.habilitado !== false;
            return `<button type="button" class="cert-status-pill ${on ? 'is-enabled' : 'is-pending'}" data-act="toggle-hab" data-id="${c.id}" title="${on ? 'Habilitado · clic para pausar' : 'Pendiente · clic para habilitar'}">${on ? '✓' : '⏳'} ${esc(c.curso)}</button>`;
          }).join('') +
          extraAreas.map(a => `<span class="user-area-pill">${esc(a)}</span>`).join('') +
          `</div>`;
      } else {
        talleresHtml = u.role === 'admin'
          ? '<span class="muted small">Administración</span>'
          : '<span class="muted small">Sin talleres registrados</span>';
      }

      const statusCol = u.role === 'admin' && !userCerts.length
        ? '<span class="muted small">—</span>'
        : userCerts.length
          ? `<span class="cert-status-pill cert-status-pill--static ${pend ? 'is-pending' : 'is-enabled'}">${hab}/${userCerts.length} ${pend ? `(${pend} pend.)` : 'listo'}</span>`
          : '<span class="muted small">0 certificados</span>';

      const actions = isMe ? '<span class="muted small">Sesión activa</span>' : `
        ${pend > 0 ? `<button class="btn btn-sm btn-enable-ok" data-act="habilitar-todo" data-id="${esc(u.cedula)}" title="Habilitar los ${pend} certificado(s) pendiente(s)">${ic('check')}Habilitar (${pend})</button>` : ''}
        <button class="btn btn-light btn-sm" data-act="gestionar-certs" data-id="${esc(u.cedula)}" title="Gestionar y habilitar talleres">${ic('list')}Gestionar</button>
        <button class="btn btn-light btn-sm" data-act="editareas" data-id="${esc(u.cedula)}" title="Editar talleres registrados">${ic('pen')}Talleres</button>
        <button class="btn btn-light btn-sm" data-act="reset" data-id="${esc(u.cedula)}" title="Restablecer clave a la cédula">${ic('refresh')}Clave</button>
        <button class="btn btn-light btn-sm" data-act="role" data-id="${esc(u.cedula)}">${ic('shield')}${u.role === 'admin' ? 'Quitar admin' : 'Admin'}</button>
        <button class="btn btn-danger btn-icon" data-act="deluser" data-id="${esc(u.cedula)}" title="Eliminar cuenta" aria-label="Eliminar">${ic('trash')}</button>`;
      return `<tr>
        <td class="nowrap">${fmtCedula(u.cedula)}</td>
        <td class="strong">${esc(u.nombre)} ${u.role === 'admin' ? '<span class="badge">Admin</span>' : ''}</td>
        <td>${emailTxt}</td>
        <td>${talleresHtml}</td>
        <td>${statusCol}</td>
        <td class="nowrap">${new Date(u.creado).toLocaleDateString('es-VE')}</td>
        <td><div class="t-actions">${actions}</div></td>
      </tr>`;
    }).join('')
      : `<tr><td colspan="7" class="t-empty">No se encontraron participantes con "${esc(q)}".</td></tr>`;
    updatePendingBadge();
  }
  $('#usuarios-buscar')?.addEventListener('input', renderUsuarios);

  /* ---------------- Admin: diseño ---------------- */
  let draft = getSettings();
  const formConfig = $('#form-config');

  let pdfDocActivo = null;
  let pdfPageCache = new Map();
  let pdfPaginaActual = 1;

  function renderTestInputs() {
    if ($('#test-nombre')) $('#test-nombre').value = SAMPLE.nombre;
    if ($('#test-cedula')) $('#test-cedula').value = SAMPLE.cedula;
    if ($('#test-curso')) $('#test-curso').value = SAMPLE.curso;
    if ($('#test-horas')) $('#test-horas').value = SAMPLE.horas ?? 5;
    if ($('#test-dia')) $('#test-dia').value = SAMPLE.dia ?? now.getDate();
    if ($('#test-mes')) $('#test-mes').value = SAMPLE.mes ?? (now.getMonth() + 1);
    if ($('#test-anio')) $('#test-anio').value = SAMPLE.anio ?? now.getFullYear();
  }

  function seleccionarPresetOficial(presetKey) {
    const next = crearSettingsPreset(presetKey);
    // Conservar logos e info institucional personalizada del modo digital si el usuario cambia
    draft = {
      ...draft,
      modeloVersion: MODELO_VERSION,
      modeloPreset: next.modeloPreset,
      plantilla: next.plantilla,
      plantillaW: next.plantillaW,
      plantillaH: next.plantillaH,
      campos: next.campos,
      camposAuto: next.camposAuto,
    };
    pdfDocActivo = null;
    pdfPageCache.clear();
    $('#pdf-page-selector')?.classList.add('hidden');
    prepararMuestra(draft.plantilla);
    syncConfig();
  }

  function renderConfig(d = getSettings()) {
    draft = d;
    for (const el of formConfig.elements) {
      if (!el.name || !(el.name in draft) || el.type === 'file') continue;
      if (el.type === 'checkbox') el.checked = !!draft[el.name];
      else el.value = draft[el.name];
    }
    renderTestInputs();
    prepararMuestra(draft.plantilla);
    syncConfig();
  }

  function syncConfig() {
    const tpl = !!draft.plantilla;
    $('#tpl-controls').classList.toggle('hidden', !tpl);
    $('#default-controls').classList.toggle('hidden', tpl);
    $('#btn-quitar-plantilla').classList.toggle('hidden', draft.modeloPreset === 'emprende1');
    $('#btn-quitar-logo').classList.toggle('hidden', !draft.logo);
    $('#editor-ayuda').classList.toggle('hidden', !tpl);

    const activeModel = tpl ? (MODELOS_OFICIALES[draft.modeloPreset] ? draft.modeloPreset : 'custom') : 'digital';
    const customCard = $('#model-picker-custom');
    if (customCard) {
      customCard.classList.toggle('hidden', activeModel !== 'custom');
      if (activeModel === 'custom' && $('#model-custom-thumb')) {
        $('#model-custom-thumb').src = draft.plantilla;
      }
    }
    $$('.model-picker-card').forEach(card => {
      card.classList.toggle('active', card.dataset.modelo === activeModel);
    });

    const activePreset = draft.logo ? '' : (draft.logoPreset || 'duo');
    $$('.preset-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.preset === activePreset);
    });

    const vista = $('#config-preview');
    vista.classList.toggle('editor', tpl);
    mount(vista, SAMPLE, draft);
    if (tpl) sincronizarPanel();
  }

  /* ---------------- Editor visual del modelo ---------------- */
  let campoActivo = 'nombre';

  function sincronizarPanel() {
    if (!draft.campos || !draft.campos[campoActivo]) campoActivo = 'nombre';
    const f = draft.campos[campoActivo];
    $$('.campo-chip').forEach(b => {
      const cObj = draft.campos[b.dataset.campo];
      b.classList.toggle('activo', b.dataset.campo === campoActivo);
      b.classList.toggle('oculto', !cObj || !cObj.visible);
    });
    $$('[data-f]', formConfig).forEach(el => {
      const v = f[el.dataset.f];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.value !== String(v ?? '')) el.value = v ?? '';
    });

    // Mostrar controles contextuales según el campo seleccionado
    const isIntro = campoActivo === 'intro';
    const isFecha = campoActivo === 'fecha';
    $('#wrap-textoFijo')?.classList.toggle('hidden', !isIntro);
    $('#wrap-formatoFecha')?.classList.toggle('hidden', !isFecha);
    $('#wrap-afijos')?.classList.toggle('hidden', isIntro);

    $('[data-out="size"]').textContent = `${f.size}`;
    $('[data-out="ancho"]').textContent = `${f.ancho}%`;
    $('[data-out="taparEscala"]').textContent = `${f.taparEscala || 100}%`;
    $('#campo-parche').classList.toggle('hidden', !f.tapar);
    $$('#config-preview .tpl-field').forEach(el => el.classList.toggle('sel', el.dataset.campo === campoActivo));
  }

  $('#model-picker-grid')?.addEventListener('click', e => {
    const card = e.target.closest('.model-picker-card');
    if (!card) return;
    const key = card.dataset.modelo;
    if (key === 'custom') return;
    seleccionarPresetOficial(key);
    setSettings(draft);
    toast(key === 'digital' ? 'Diseño Digital Clásico activado.' : `Activado: ${MODELOS_OFICIALES[key]?.nombre || key}`);
  });

  $('#campo-chips').addEventListener('click', e => {
    const b = e.target.closest('.campo-chip');
    if (!b) return;
    campoActivo = b.dataset.campo;
    sincronizarPanel();
  });

  $('#tpl-controls').addEventListener('input', e => {
    const el = e.target;
    const prop = el.dataset.f;
    if (!prop) return;
    const f = draft.campos[campoActivo];
    f[prop] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    if (prop === 'tapar' || prop === 'taparEscala') colorDelParche(f);
    syncConfig();
  });

  // Edición rápida de prueba en tiempo real
  $('#card-live-test')?.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'test-nombre') SAMPLE.nombre = el.value || 'Nombre Apellido';
    else if (el.id === 'test-cedula') SAMPLE.cedula = el.value;
    else if (el.id === 'test-curso') SAMPLE.curso = el.value || 'Nombre taller';
    else if (el.id === 'test-horas') SAMPLE.horas = el.value || '5';
    else if (el.id === 'test-dia') SAMPLE.dia = Math.min(31, Math.max(1, +el.value || 1));
    else if (el.id === 'test-mes') SAMPLE.mes = +el.value || 1;
    else if (el.id === 'test-anio') SAMPLE.anio = +el.value || now.getFullYear();
    else return;
    mount($('#config-preview'), SAMPLE, draft);
    if (draft.plantilla) {
      $$('#config-preview .tpl-field').forEach(fld => fld.classList.toggle('sel', fld.dataset.campo === campoActivo));
    }
  });
  $('#card-live-test')?.addEventListener('change', e => {
    if (e.target.id === 'test-mes') {
      SAMPLE.mes = +e.target.value || 1;
      mount($('#config-preview'), SAMPLE, draft);
      if (draft.plantilla) {
        $$('#config-preview .tpl-field').forEach(fld => fld.classList.toggle('sel', fld.dataset.campo === campoActivo));
      }
    }
  });

  // Arrastrar o hacer doble clic para editar sobre la vista previa
  const vistaEditor = $('#config-preview');
  let arrastre = null;
  vistaEditor.addEventListener('pointerdown', e => {
    const el = e.target.closest('.tpl-field');
    if (!el || !draft.plantilla) return;
    e.preventDefault();
    campoActivo = el.dataset.campo;
    const r = vistaEditor.getBoundingClientRect();
    const f = draft.campos[campoActivo];
    arrastre = { el, f, r, dx: e.clientX - (r.left + f.x / 100 * r.width), dy: e.clientY - (r.top + f.y / 100 * r.height) };
    vistaEditor.setPointerCapture(e.pointerId);
    sincronizarPanel();
  });
  vistaEditor.addEventListener('dblclick', e => {
    const el = e.target.closest('.tpl-field');
    if (!el || !draft.plantilla) return;
    const c = el.dataset.campo;
    const mapFocus = { nombre: '#test-nombre', cedula: '#test-cedula', curso: '#test-curso', fecha: '#test-dia', intro: '[data-f="textoFijo"]' };
    const target = $(mapFocus[c]);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { target.focus(); target.select?.(); }, 180);
    }
  });
  vistaEditor.addEventListener('pointermove', e => {
    if (!arrastre) return;
    const { el, f, r, dx, dy } = arrastre;
    let x = (e.clientX - dx - r.left) / r.width * 100;
    const y = (e.clientY - dy - r.top) / r.height * 100;
    if (Math.abs(x - 50) < 1.2) x = 50;                    // se imanta al centro de la hoja
    f.x = +Math.min(100, Math.max(0, x)).toFixed(2);
    f.y = +Math.min(100, Math.max(0, y)).toFixed(2);
    el.style.left = `${f.x}%`;
    el.style.top = `${f.y}%`;
    const p = vistaEditor.querySelector(`[data-parche="${campoActivo}"]`);
    if (p) { p.style.left = `${f.x}%`; p.style.top = `${f.y}%`; }
  });
  const soltar = () => {
    if (!arrastre) return;
    const { f } = arrastre;
    arrastre = null;
    if (f.tapar) colorDelParche(f);
    syncConfig();
  };
  vistaEditor.addEventListener('pointerup', soltar);
  vistaEditor.addEventListener('pointercancel', soltar);

  /* ---------------- Lectura de colores del modelo ---------------- */
  let muestra = null;
  function prepararMuestra(src) {
    if (!src) { muestra = null; return Promise.resolve(); }
    if (muestra && muestra.src === src) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement('canvas');
          cv.width = img.width;
          cv.height = img.height;
          const ctx = cv.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          muestra = { src, ctx, w: img.width, h: img.height };
        } catch {
          muestra = null;
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  const aHex = rgb => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

  // Lee una zona del modelo (en %): su color de fondo y el color de lo que está escrito ahí
  function leerZona(x, y, ancho, alto) {
    if (!muestra) return null;
    try {
      const x0 = Math.max(0, Math.floor((x - ancho / 2) / 100 * muestra.w));
      const y0 = Math.max(0, Math.floor((y - alto / 2) / 100 * muestra.h));
      const w = Math.max(1, Math.min(muestra.w - x0, Math.ceil(ancho / 100 * muestra.w)));
      const h = Math.max(1, Math.min(muestra.h - y0, Math.ceil(alto / 100 * muestra.h)));
      const d = muestra.ctx.getImageData(x0, y0, w, h).data;
      // El fondo se toma solo del borde de la zona, para que la letra del centro no lo contamine
      const canales = [[], [], []];
      for (let f = 0; f < h; f++) {
        for (let col = 0; col < w; col++) {
          if (f > 1 && f < h - 2 && col > 1 && col < w - 2) continue;
          const i = (f * w + col) * 4;
          for (let c = 0; c < 3; c++) canales[c].push(d[i + c]);
        }
      }
      const fondo = canales.map(v => v.sort((a, b) => a - b)[v.length >> 1]);
      let tinta = null, mayor = 90;
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.abs(d[i] - fondo[0]) + Math.abs(d[i + 1] - fondo[1]) + Math.abs(d[i + 2] - fondo[2]);
        if (dist > mayor) { mayor = dist; tinta = [d[i], d[i + 1], d[i + 2]]; }
      }
      const oscuro = 0.3 * fondo[0] + 0.59 * fondo[1] + 0.11 * fondo[2] < 110;
      return { fondo: aHex(fondo), tinta: tinta && aHex(tinta), oscuro };
    } catch {
      return null;
    }
  }

  // Borra una zona de la imagen del modelo rellenándola con lo que hay justo encima y debajo
  function borrarZona(x, y, ancho, alto) {
    if (!muestra) return;
    try {
      const { ctx, w: W, h: H } = muestra;
      const x0 = Math.max(0, Math.floor((x - ancho / 2) / 100 * W));
      const y0 = Math.max(1, Math.floor((y - alto / 2) / 100 * H));
      const w = Math.min(W - x0, Math.ceil(ancho / 100 * W));
      const h = Math.min(H - y0 - 1, Math.ceil(alto / 100 * H));
      if (w < 1 || h < 1) return;
      const arriba = ctx.getImageData(x0, y0 - 1, w, 1).data;
      const abajo = ctx.getImageData(x0, y0 + h, w, 1).data;
      const zona = ctx.createImageData(w, h);
      for (let f = 0; f < h; f++) {
        const t = (f + 1) / (h + 1);
        for (let col = 0; col < w; col++) {
          const i = col * 4, j = (f * w + col) * 4;
          for (let c = 0; c < 3; c++) zona.data[j + c] = arriba[i + c] * (1 - t) + abajo[i + c] * t;
          zona.data[j + 3] = 255;
        }
      }
      ctx.putImageData(zona, x0, y0);
    } catch {
      // Canvas protegido en file:// sin servidor
    }
  }

  function colorDelParche(f) {
    const { h } = tamano(draft);
    const [x, y, w, alto] = cajaParche(f, h);
    const z = leerZona(x, y, w, alto * 1.6);
    f.taparColor = z ? z.fondo : '#ffffff';
  }

  // Coloca los datos según el modelo recién subido y lo adapta a Nombre, Cédula, Taller y Día/Mes/Año
  async function adaptarAlModelo(modelo) {
    draft.modeloVersion = MODELO_VERSION;
    draft.modeloPreset = modelo.presetName || 'custom';
    draft.plantilla = modelo.data;
    draft.plantillaW = modelo.w;
    draft.plantillaH = modelo.h;
    await prepararMuestra(modelo.data);
    const { w, h } = tamano(draft);
    const campos = camposBase({ fuenteNombre: 'sans', mostrarCedula: true }, w / CERT_W);

    CLAVES_CAMPO.forEach(clave => {
      const f = campos[clave];
      const z = leerZona(f.x, f.y, f.ancho, 8);
      if (z && z.oscuro) f.color = '#ffffff';              // sobre un fondo oscuro, letra clara
    });

    const marcadores = modelo.marcadores || [];
    if (marcadores.length) {
      campos.intro.visible = false;
      let hasCedulaMarker = false;
      const encontradosSet = new Set();
      marcadores.forEach(m => {
        const f = campos[m.campo];
        if (!f) return;
        encontradosSet.add(m.campo);
        if (m.campo === 'cedula') hasCedulaMarker = true;
        const z = leerZona(m.x, m.y, m.w * 1.08, m.h * 1.5);
        Object.assign(f, {
          visible: true,
          x: +m.x.toFixed(2),
          y: +m.y.toFixed(2),
          size: Math.max(8, Math.round(m.h / 100 * h)),
          ancho: Math.round(Math.min(92, Math.max(m.w * 1.5, (m.campo === 'cedula' || m.campo === 'fecha') ? 45 : 80))),
        });
        if (m.fuente) f.fuente = m.fuente;
        if (m.prefijo !== undefined) f.prefijo = m.prefijo;
        if (m.sufijo !== undefined) f.sufijo = m.sufijo;
        if (m.textoFijo !== undefined) f.textoFijo = m.textoFijo;
        if (m.formatoFecha !== undefined) f.formatoFecha = m.formatoFecha;
        if (z && z.tinta && m.campo !== 'intro') f.color = z.tinta;
      });

      // Mantener siempre visibles Nombre, Cédula, Taller y Fecha en posiciones seguras aunque el PDF no trajera texto explícito para alguno
      if (!encontradosSet.has('curso') && encontradosSet.has('nombre')) {
        campos.curso.y = +Math.min(82, Math.max(64, campos.nombre.y + 15)).toFixed(2);
      }
      if (!encontradosSet.has('fecha') && encontradosSet.has('curso')) {
        campos.fecha.y = +Math.min(93, Math.max(86, campos.curso.y + 16)).toFixed(2);
      }

      // Borrar limpiamente todos los textos marcadores del fondo rasterizado del PDF
      marcadores.forEach(m => {
        const boxes = m.eraseBoxes || [{ x: m.x, y: m.y, w: m.w * 1.12, h: m.h * 1.6 }];
        boxes.forEach(b => borrarZona(b.x, b.y, b.w, b.h));
      });
      try {
        draft.plantilla = muestra.ctx.canvas.toDataURL('image/jpeg', 0.88);
        muestra.src = draft.plantilla;
      } catch {}

      // Si el PDF traía "Nombre Apellido" pero no traía etiqueta de Cédula explícita, activamos la Cédula debajo del Nombre
      if (campos.nombre.visible && !hasCedulaMarker) {
        const maxY = campos.curso.visible ? Math.min(campos.curso.y - 6.2, campos.nombre.y + 7.6) : campos.nombre.y + 7.6;
        Object.assign(campos.cedula, {
          visible: true,
          x: campos.nombre.x,
          y: +maxY.toFixed(2),
          size: Math.max(12, Math.round(17 * w / CERT_W)),
          ancho: 60,
          fuente: 'sans',
          color: '#4b5563',
          prefijo: 'C.I. ',
        });
      }
    }

    draft.campos = campos;
    draft.camposAuto = JSON.parse(JSON.stringify(campos));
    campoActivo = campos.nombre.visible ? 'nombre' : (marcadores[0]?.campo || 'nombre');
    syncConfig();
    return marcadores.length;
  }

  formConfig.addEventListener('input', e => {
    const el = e.target;
    if (!el.name || el.type === 'file') return;
    draft[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    syncConfig();
  });

  formConfig.addEventListener('submit', e => {
    e.preventDefault();
    if (setSettings(draft)) toast('Diseño guardado. Todos los certificados usan este modelo.');
  });

  $('#btn-restablecer').addEventListener('click', () => {
    seleccionarPresetOficial('emprende1');
    setSettings(draft);
    toast('Restablecido al Modelo 1 Oficial Chacao Emprende.');
  });

  function imageToDataURL(file, maxSide, type) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k);
        cv.height = Math.round(img.height * k);
        const ctx = cv.getContext('2d');
        if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        resolve({ data: cv.toDataURL(type, 0.88), w: cv.width, h: cv.height });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen no válida')); };
      img.src = url;
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.append(s);
    });
  }

  const LADO_MODELO = 2000;                               // resolución con la que se guarda el modelo
  const RE_MARCADOR = /(?:\{\{?|\[\[?|<<?|«)\s*(nombre(?:\s+(?:completo|y\s+apellido))?|apellido|participante|alumno|estudiante|c[eé]dula|c\.?i\.?|curso|area|motivo|actividad|proyecto|taller|fecha|mes(?:\s+y\s+a[nñ]o)?|a[nñ]o)\s*(?:\}\}?|\]\]?|>>?|»)/gi;

  // Detecta tanto marcadores {{...}} como los textos reales de Chacao Emprende (Nombre Apellido, Taller, Chacao dia de mes de año)
  async function buscarMarcadores(page, viewport) {
    const { items } = await page.getTextContent();
    const rowMap = new Map();
    items.forEach(it => {
      if (!it.str) return;
      const [x, y] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      const fila = Math.round(y / 5);
      if (!rowMap.has(fila)) rowMap.set(fila, []);
      rowMap.get(fila).push({
        x, y, str: it.str, ancho: it.width * viewport.scale,
        alto: Math.hypot(it.transform[2], it.transform[3]) * viewport.scale,
      });
    });

    const lineasOrd = [...rowMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, partes]) => {
        partes.sort((a, b) => a.x - b.x);
        let texto = '';
        const tramos = partes.map(p => { const t = { p, ini: texto.length }; texto += p.str; t.fin = texto.length; return t; });
        const x0 = partes[0].x;
        const ult = partes[partes.length - 1];
        const x1 = ult.x + ult.ancho;
        const yBase = partes.reduce((acc, p) => acc + p.y, 0) / partes.length;
        const alto = Math.max(...partes.map(p => p.alto));
        return { texto, cleanText: clean(texto), tramos, x0, x1, yBase, alto };
      })
      .filter(l => l.cleanText.length > 0);

    const usados = new Set();
    const encontrados = [];
    const pctX = px => px / viewport.width * 100;
    const pctY = py => py / viewport.height * 100;
    const makeEraseBox = l => ({
      x: pctX((l.x0 + l.x1) / 2),
      y: pctY(l.yBase - l.alto * 0.28),
      w: Math.max(4, pctX(l.x1 - l.x0) + 1.8),
      h: Math.max(1.5, pctY(l.alto * 1.65)),
    });

    // 1. Buscar marcadores con llaves {{nombre}}, [curso], etc.
    lineasOrd.forEach((l, idx) => {
      for (const m of l.texto.matchAll(RE_MARCADOR)) {
        const fin = m.index + m[0].length;
        const tocados = l.tramos.filter(t => t.ini < fin && t.fin > m.index);
        if (!tocados.length) continue;
        const a = tocados[0], z = tocados[tocados.length - 1];
        const lenA = Math.max(1, a.fin - a.ini), lenZ = Math.max(1, z.fin - z.ini);
        const x0 = a.p.x + a.p.ancho * (m.index - a.ini) / lenA;
        const x1 = z.p.x + z.p.ancho * (fin - z.ini) / lenZ;
        const alto = Math.max(...tocados.map(t => t.p.alto));
        const rawKey = m[1].toLowerCase().replace(/[.\s]+/g, ' ').trim();
        let clave = 'curso';
        if (/^(nombre|apellido|participante|alumno|estudiante)/.test(rawKey)) clave = 'nombre';
        else if (/^(c[eé]dula|ci|c i)/.test(rawKey)) clave = 'cedula';
        else if (/^(fecha|mes|a[nñ]o)/.test(rawKey)) clave = 'fecha';

        usados.add(idx);
        encontrados.push({
          campo: clave,
          x: pctX((x0 + x1) / 2),
          y: pctY(a.p.y - alto * 0.30),
          w: pctX(x1 - x0),
          h: pctY(alto * 1.05),
          eraseBoxes: [{
            x: pctX((x0 + x1) / 2),
            y: pctY(a.p.y - alto * 0.28),
            w: pctX(x1 - x0) + 1.5,
            h: pctY(alto * 1.65),
          }],
        });
      }
    });

    const yaTiene = clave => encontrados.some(e => e.campo === clave);

    // 2. Detectar textos genéricos literales del certificado (Nombre Apellido, Taller + Horas, Chacao dia de mes de año, Encabezado)
    for (let i = 0; i < lineasOrd.length; i++) {
      if (usados.has(i)) continue;
      const l = lineasOrd[i];
      const txt = l.cleanText;

      // Encabezado (La Dirección de Desarrollo y Apoyo Social ... otorga el presente certificado a:)
      if (!yaTiene('intro') && /direcci[oó]n\s+de\s+desarrollo/i.test(txt)) {
        const next = (i + 1 < lineasOrd.length && !usados.has(i + 1) && /otorga\s+el\s+presente/i.test(lineasOrd[i + 1].cleanText))
          ? lineasOrd[i + 1] : null;
        usados.add(i);
        if (next) usados.add(i + 1);
        const yMid = next ? (l.yBase + next.yBase) / 2 : l.yBase;
        const maxAlto = Math.max(l.alto, next ? next.alto : 0);
        const minX = Math.min(l.x0, next ? next.x0 : l.x0);
        const maxX = Math.max(l.x1, next ? next.x1 : l.x1);
        encontrados.push({
          campo: 'intro',
          x: 50,
          y: pctY(yMid - maxAlto * 0.32),
          w: Math.max(60, pctX(maxX - minX)),
          h: pctY(maxAlto * 1.05),
          fuente: 'sans',
          textoFijo: 'La Dirección de **Desarrollo y Apoyo Social** de la Alcaldía de Chacao\na través del **Programa Chacao Emprende** otorga el presente certificado a:',
          eraseBoxes: next ? [makeEraseBox(l), makeEraseBox(next)] : [makeEraseBox(l)],
        });
        continue;
      }

      // Nombre Apellido / Participante
      if (!yaTiene('nombre') && /^(?:nombre\s+(?:y\s+)?apellido|nombres?\s+y\s+apellidos?|nombre\s+completo|nombre\s+del\s+(?:participante|estudiante)|participante|estudiante)$/i.test(txt)) {
        usados.add(i);
        encontrados.push({
          campo: 'nombre',
          x: 50,
          y: pctY(l.yBase - l.alto * 0.30),
          w: pctX(l.x1 - l.x0),
          h: pctY(l.alto * 0.85),
          fuente: 'sans',
          prefijo: '',
          sufijo: '',
          eraseBoxes: [makeEraseBox(l)],
        });
        continue;
      }

      // Bloque taller ("Por su participación en el taller" + "“Nombre taller” con una duración de (5) horas")
      if (!yaTiene('curso') && /por\s+su\s+participaci[oó]n\s+en\s+el\s+(?:taller|curso)/i.test(txt)) {
        const next = (i + 1 < lineasOrd.length && !usados.has(i + 1) && /nombre\s*(?:del\s*)?(?:taller|curso)|taller|curso/i.test(lineasOrd[i + 1].cleanText))
          ? lineasOrd[i + 1] : null;
        usados.add(i);
        if (next) usados.add(i + 1);
        const yMid = next ? (l.yBase + next.yBase) / 2 : l.yBase;
        const maxAlto = Math.max(l.alto, next ? next.alto : 0);
        let suf = '” con una duración de ({horas}) horas';
        if (next) {
          const mT = next.cleanText.match(/nombre\s*(?:del\s*)?(?:taller|curso)(.*)/i);
          if (mT && clean(mT[1])) {
            const after = mT[1].replace(/^["“”'\s]+/, '').trim();
            if (after) suf = '” ' + after.replace(/\(\s*\d+\s*\)/, '({horas})');
          }
        }
        encontrados.push({
          campo: 'curso',
          x: 50,
          y: pctY(yMid - maxAlto * 0.30),
          w: pctX(Math.max(l.x1 - l.x0, next ? next.x1 - next.x0 : 0)),
          h: pctY(maxAlto * 1.05),
          fuente: 'sans',
          prefijo: `${txt}\n“`,
          sufijo: suf,
          eraseBoxes: next ? [makeEraseBox(l), makeEraseBox(next)] : [makeEraseBox(l)],
        });
        continue;
      }

      // Línea suelta con Nombre taller / curso / actividad
      if (!yaTiene('curso') && /nombre\s*(?:del\s*)?(?:taller|curso|actividad)|t[ií]tulo\s+del\s+(?:taller|curso)/i.test(txt)) {
        usados.add(i);
        encontrados.push({
          campo: 'curso',
          x: 50,
          y: pctY(l.yBase - l.alto * 0.30),
          w: pctX(l.x1 - l.x0),
          h: pctY(l.alto * 1.05),
          fuente: 'sans',
          prefijo: 'Por su participación en el taller\n“',
          sufijo: '” con una duración de ({horas}) horas',
          eraseBoxes: [makeEraseBox(l)],
        });
        continue;
      }

      // Fecha ("Chacao, dia de mes de año", "__ de ____ de 202_", etc.)
      if (!yaTiene('fecha') && /(?:d[ií]a|_{2,})\s+de\s+(?:mes|_{2,})\s+de\s+(?:a[ñn]o|(?:20)?_{1,})|mes\s+de\s+a[ñn]o/i.test(txt)) {
        usados.add(i);
        const mPref = txt.match(/^(.*?)(?:d[ií]a\s+de\s+mes\s+de\s+a[ñn]o|mes\s+de\s+a[ñn]o|_{2,}\s+de)/i);
        const ciudadPref = mPref && mPref[1] ? clean(mPref[1]) + ' ' : '';
        encontrados.push({
          campo: 'fecha',
          x: 50,
          y: pctY(l.yBase - l.alto * 0.30),
          w: pctX(l.x1 - l.x0),
          h: pctY(l.alto * 1.02),
          fuente: 'arial',
          prefijo: ciudadPref,
          sufijo: '',
          formatoFecha: /d[ií]a|_{2,}/i.test(txt) ? 'completo' : 'mes_anio',
          eraseBoxes: [makeEraseBox(l)],
        });
        continue;
      }

      // Cédula literal
      if (!yaTiene('cedula') && /c[eé]dula|c\.?i\.?\s*(?:v-?)?\s*(?:x+|_+|\.\.\.)/i.test(txt)) {
        usados.add(i);
        encontrados.push({
          campo: 'cedula',
          x: pctX((l.x0 + l.x1) / 2),
          y: pctY(l.yBase - l.alto * 0.30),
          w: pctX(l.x1 - l.x0),
          h: pctY(l.alto * 1.02),
          fuente: 'sans',
          prefijo: 'C.I. ',
          sufijo: '',
          eraseBoxes: [makeEraseBox(l)],
        });
      }
    }

    return encontrados;
  }

  async function renderPdfPage(pdf, pageNum) {
    if (pdfPageCache.has(pageNum)) return pdfPageCache.get(pageNum);
    const page = await pdf.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: LADO_MODELO / Math.max(base.width, base.height) });
    const cv = document.createElement('canvas');
    cv.width = Math.round(viewport.width);
    cv.height = Math.round(viewport.height);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const marcadores = await buscarMarcadores(page, viewport);
    const res = { data: cv.toDataURL('image/jpeg', 0.88), w: cv.width, h: cv.height, marcadores, presetName: 'custom' };
    pdfPageCache.set(pageNum, res);
    return res;
  }

  function actualizarSelectorPaginasPDF(pdf) {
    const wrap = $('#pdf-page-selector');
    const tabs = $('#pdf-page-tabs');
    if (!wrap || !tabs) return;
    if (!pdf || pdf.numPages <= 1) {
      wrap.classList.add('hidden');
      tabs.innerHTML = '';
      return;
    }
    wrap.classList.remove('hidden');
    const total = Math.min(pdf.numPages, 10);
    tabs.innerHTML = Array.from({ length: total }, (_, idx) => {
      const p = idx + 1;
      const label = p === 1 ? 'Página 1 (Modelo 1)' : p === 2 ? 'Página 2 (Modelo 2)' : `Página ${p}`;
      return `<button type="button" class="pdf-page-btn${p === pdfPaginaActual ? ' active' : ''}" data-pdf-page="${p}">${label}</button>`;
    }).join('');
  }

  $('#pdf-page-tabs')?.addEventListener('click', async e => {
    const btn = e.target.closest('[data-pdf-page]');
    if (!btn || !pdfDocActivo) return;
    const p = +btn.dataset.pdfPage;
    if (!p || p === pdfPaginaActual) return;
    pdfPaginaActual = p;
    actualizarSelectorPaginasPDF(pdfDocActivo);
    try {
      toast(`Cargando página ${p}…`);
      const modelo = await renderPdfPage(pdfDocActivo, p);
      const n = await adaptarAlModelo(modelo);
      setSettings(draft);
      toast(n
        ? `Página ${p} activada y guardada con ${n} zona(s) detectada(s).`
        : `Página ${p} activada y guardada automáticamente.`);
    } catch {
      toast('No se pudo cargar esa página del PDF.', 'error');
    }
  });

  // Carga un PDF (soporta 1 o varias páginas y selecciona la primera automáticamente)
  async function pdfToDataURL(file) {
    if (!window.pdfjsLib) {
      await loadScript(PDFJS + 'pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    }
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    pdfDocActivo = pdf;
    pdfPageCache = new Map();
    pdfPaginaActual = 1;
    actualizarSelectorPaginasPDF(pdf);
    return renderPdfPage(pdf, 1);
  }

  $('#in-plantilla').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      toast('Procesando y activando nuevo modelo…');
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        pdfDocActivo = null;
        pdfPageCache.clear();
        $('#pdf-page-selector')?.classList.add('hidden');
      }
      const modelo = isPdf ? await pdfToDataURL(file) : await imageToDataURL(file, LADO_MODELO, 'image/jpeg');
      const n = await adaptarAlModelo(modelo);
      setSettings(draft);
      if (n) {
        toast(`¡Listo! Nuevo modelo activado y guardado automáticamente (${n} zonas detectadas).`);
      } else {
        toast('¡Nuevo modelo activado y guardado! Ya aplica automáticamente a los certificados.');
      }
    } catch (err) {
      console.error(err);
      toast('No se pudo leer el archivo. Si es PDF, revisa tu conexión a internet.', 'error');
    }
  });
  $('#btn-quitar-plantilla').addEventListener('click', () => {
    seleccionarPresetOficial('emprende1');
    setSettings(draft);
    toast('Restablecido al Modelo 1 Oficial Chacao Emprende.');
  });

  $('#in-logo').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      draft.logo = (await imageToDataURL(file, 500, 'image/png')).data;
      syncConfig();
    } catch {
      toast('No se pudo leer la imagen.', 'error');
    }
  });
  $('#btn-quitar-logo').addEventListener('click', () => {
    draft.logo = '';
    draft.logoPreset = 'duo';
    syncConfig();
  });

  $('#logo-presets')?.addEventListener('click', e => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    draft.logo = '';
    draft.logoPreset = btn.dataset.preset;
    syncConfig();
  });

  /* Respaldo */
  $('#btn-export').addEventListener('click', () => {
    const data = {
      app: 'portal-certificados', version: 1, exportado: new Date().toISOString(),
      users: getUsers(), certs: getCerts(), settings: store.read(K.settings, {}),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = `respaldo-certificados-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#in-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.users) || !Array.isArray(data.certs)) throw new Error('Formato inválido');
      if (!confirm(`El respaldo tiene ${data.users.length} usuario(s) y ${data.certs.length} certificado(s). Reemplazará los datos actuales. ¿Continuar?`)) return;
      setUsers(data.users);
      setCerts(data.certs);
      setSettings(data.settings || {});
      await seedAdmin();
      toast('Respaldo restaurado.');
      startApp();
    } catch {
      toast('El archivo no es un respaldo válido.', 'error');
    }
  });

  /* =========================================================
     ACCIONES (delegadas) Y MODALES
     ========================================================= */
  let modalCert = null;

  function openModal(id) {
    const m = $(id);
    m.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    if (G) {
      G.killTweensOf([m, $('.modal-box', m)]);
      G.fromTo(m, { opacity: 0 }, { opacity: 1, duration: .35, ease: 'power2.out' });
      G.fromTo($('.modal-box', m), { y: 40, scale: .96, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: .8, ease: 'expo.out', clearProps: 'transform' });
    }
    return m;
  }
  function closeModals() {
    const open = $$('.modal:not(.hidden)');
    if (!open.length) return;
    const done = () => {
      open.forEach(m => m.classList.add('hidden'));
      document.body.classList.remove('no-scroll');
      if (G) G.set(open, { clearProps: 'opacity' });
    };
    if (!G) return done();
    G.to(open.map(m => $('.modal-box', m)), { y: 20, scale: .98, opacity: 0, duration: .25, ease: 'power2.in' });
    G.to(open, { opacity: 0, duration: .3, ease: 'power2.in', onComplete: done });
  }
  $$('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close]')) closeModals();
  }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });

  function canSee(cert) {
    const u = currentUser();
    if (!cert || !u) return false;
    if (u.role === 'admin') return true;
    return u.cedula === cert.cedula && cert.habilitado !== false;
  }

  function viewCert(cert) {
    modalCert = cert;
    const resolved = datosCertificado(cert);
    $('#mc-title').textContent = resolved.curso;
    $('#mc-date').textContent = `Fecha al descargar: ${fecha(resolved)}`;
    $('#mc-sub').textContent = `${resolved.nombre} · C.I. ${fmtCedula(resolved.cedula)}`;
    openModal('#modal-cert');
    mount($('#mc-frame'), resolved);
  }
  $('#mc-pdf').addEventListener('click', () => { if (modalCert) printCert(modalCert); });

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act, id } = b.dataset;

    if (act === 'ver' || act === 'pdf' || act === 'del') {
      const cert = getCerts().find(c => c.id === id);
      if (!canSee(cert)) return;
      if (act === 'ver') viewCert(cert);
      if (act === 'pdf') printCert(cert);
      if (act === 'del' && confirm(`¿Eliminar el certificado de ${cert.nombre} (${cert.curso})?`)) {
        setCerts(getCerts().filter(c => c.id !== id));
        toast('Certificado eliminado.');
        renderLista();
        if (currentUser()?.role === 'admin') { updateStats(); updatePendingBadge(); }
      }
      return;
    }

    if (currentUser()?.role !== 'admin') return;

    if (act === 'toggle-hab') {
      const certs = getCerts();
      const cert = certs.find(c => c.id === id);
      if (!cert) return;
      cert.habilitado = cert.habilitado === false ? true : false;
      if (!setCerts(certs)) return;
      toast(cert.habilitado ? `Certificado de ${cert.nombre} (${cert.curso}) habilitado.` : `Certificado de ${cert.nombre} pausado.`);
      if (!$('#view-lista').classList.contains('hidden')) renderLista();
      if (!$('#view-usuarios').classList.contains('hidden')) renderUsuarios();
      updatePendingBadge();
      return;
    }

    const users = getUsers();
    const user = users.find(u => u.cedula === id);
    if (!user) return;

    if (act === 'habilitar-todo') {
      const certs = getCerts();
      let count = 0;
      certs.forEach(c => {
        if (c.cedula === user.cedula && c.habilitado === false) {
          c.habilitado = true;
          count++;
        }
      });
      if (!count) {
        toast(`${user.nombre} no tiene certificados pendientes.`);
        return;
      }
      if (!setCerts(certs)) return;
      toast(`¡${count} certificado(s) de ${user.nombre} habilitado(s)!`);
      renderUsuarios();
      if (!$('#view-lista').classList.contains('hidden')) renderLista();
      updatePendingBadge();
      return;
    }

    if (act === 'gestionar-certs') {
      openHabilitarUserModal(user);
      return;
    }

    if (act === 'editareas') {
      openEditAreasModal(user);
      return;
    }

    if (act === 'reset' && confirm(`¿Restablecer la contraseña de ${user.nombre}? Su nueva contraseña será su número de cédula.`)) {
      user.pass = await hashPass(user.cedula, user.cedula);
      setUsers(users);
      toast(`Listo. La contraseña de ${user.nombre} ahora es su cédula: ${user.cedula}`);
    }
    if (act === 'role') {
      user.role = user.role === 'admin' ? 'user' : 'admin';
      setUsers(users);
      toast(`${user.nombre} ahora es ${user.role === 'admin' ? 'administrador' : 'usuario normal'}.`);
      renderUsuarios();
    }
    if (act === 'deluser' && confirm(`¿Eliminar la cuenta de ${user.nombre}? Sus certificados se conservan y volverá a verlos si se registra de nuevo.`)) {
      setUsers(users.filter(u => u.cedula !== id));
      toast('Usuario eliminado.');
      renderUsuarios();
    }
  });

  /* Modal de edición de áreas / talleres */
  function openEditAreasModal(user) {
    const m = $('#modal-edit-areas');
    if (!m) return;
    $('#mea-cedula').value = user.cedula;
    $('#mea-areas').value = user.areas || '';
    $('#mea-title').textContent = `Talleres de ${user.nombre}`;
    $('#form-edit-areas .form-error').textContent = '';
    openModal('#modal-edit-areas');
    $('#mea-areas').focus();
  }

  $('#form-edit-areas')?.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const cedula = f.cedula.value;
    const areas = clean(f.areas.value);
    const err = $('.form-error', f);
    if (areas.length < 2) {
      err.textContent = 'Indica al menos un taller o área realizada.';
      return;
    }
    const users = getUsers();
    const user = users.find(u => u.cedula === cedula);
    if (!user) return;
    user.areas = areas;
    setUsers(users);
    const nuevos = sincronizarCertificadosUsuario(user, { habilitado: false });
    closeModals();
    toast(nuevos
      ? `Talleres actualizados. Se registraron ${nuevos} nuevo(s) en espera de habilitación.`
      : 'Talleres y áreas actualizados.');
    const cur = currentUser();
    if (cur && cur.cedula === cedula) renderMis();
    if (cur && cur.role === 'admin') renderUsuarios();
    updatePendingBadge();
  });

  /* Modal admin: habilitar y configurar certificados de un usuario */
  function renderMhuList(cedula) {
    const listEl = $('#mhu-list');
    if (!listEl) return;
    const certs = getCerts()
      .filter(c => c.cedula === cedula)
      .sort((a, b) => (a.habilitado === false ? -1 : 1) || byDate(a, b));
    if (!certs.length) {
      listEl.innerHTML = '<div class="muted small" style="padding:14px;text-align:center;border:1px dashed var(--line);border-radius:12px;">Este usuario aún no tiene talleres registrados. Agrega uno abajo para generarlo con sus datos.</div>';
      return;
    }
    listEl.innerHTML = certs.map(c => {
      const hab = c.habilitado !== false;
      return `<div class="mhu-item ${hab ? 'is-enabled' : 'is-pending'}" data-cert-id="${c.id}">
        <div class="mhu-info">
          <div class="mhu-title-row">
            <span class="mhu-curso">${esc(c.curso)}</span>
            <span class="muted small">${c.descargadoEn ? `· Descargado el ${fechaTimestamp(c.descargadoEn)}` : '· Fecha automática al descargar'}</span>
          </div>
          <div class="mhu-controls">
            <label>Horas: <input type="number" min="1" max="500" value="${c.horas || 5}" data-mhu-horas></label>
            <label>Modelo:
              <select data-mhu-modelo>
                <option value="" ${!c.modelo ? 'selected' : ''}>Predeterminado</option>
                <option value="emprende1" ${c.modelo === 'emprende1' ? 'selected' : ''}>Modelo 1 · Chacao Emprende</option>
                <option value="emprende2" ${c.modelo === 'emprende2' ? 'selected' : ''}>Modelo 2 · Convenio UCV / FaCES</option>
              </select>
            </label>
          </div>
        </div>
        <label class="mhu-switch">
          <input type="checkbox" data-mhu-check ${hab ? 'checked' : ''}>
          <span class="mhu-slider"></span>
          <span class="mhu-switch-txt">${hab ? 'Habilitado' : 'Pendiente'}</span>
        </label>
      </div>`;
    }).join('');
  }

  function openHabilitarUserModal(user) {
    const m = $('#modal-habilitar-user');
    if (!m || !user) return;
    // Si el usuario tiene áreas registradas y ningún certificado generado aún, los creamos automáticamente en pendiente
    if (!getCerts().some(c => c.cedula === user.cedula) && user.areas) {
      sincronizarCertificadosUsuario(user, { habilitado: false });
    }
    $('#mhu-cedula').value = user.cedula;
    $('#mhu-title').textContent = `Certificados de ${user.nombre}`;
    $('#mhu-sub').textContent = `C.I. ${fmtCedula(user.cedula)}${user.email ? ' · ' + user.email : ''} · Usa los datos del usuario y fecha al descargar`;
    if ($('#mhu-new-curso')) $('#mhu-new-curso').value = '';
    if ($('#mhu-new-horas')) $('#mhu-new-horas').value = 5;
    renderMhuList(user.cedula);
    openModal('#modal-habilitar-user');
  }

  $('#mhu-list')?.addEventListener('change', e => {
    const chk = e.target.closest('input[data-mhu-check]');
    if (!chk) return;
    const item = chk.closest('.mhu-item');
    if (!item) return;
    const on = chk.checked;
    item.classList.toggle('is-enabled', on);
    item.classList.toggle('is-pending', !on);
    const txt = $('.mhu-switch-txt', item);
    if (txt) txt.textContent = on ? 'Habilitado' : 'Pendiente';
  });

  $('#mhu-btn-add')?.addEventListener('click', () => {
    const cedula = $('#mhu-cedula')?.value;
    const curso = clean($('#mhu-new-curso')?.value || '');
    const horas = Math.min(500, Math.max(1, +$('#mhu-new-horas')?.value || 5));
    if (!cedula) return;
    if (curso.length < 3) {
      toast('Escribe el nombre del taller que deseas agregar.', 'error');
      $('#mhu-new-curso')?.focus();
      return;
    }
    const users = getUsers();
    const user = users.find(u => u.cedula === cedula);
    if (!user) return;
    const actuales = parseTalleres(user.areas);
    if (!actuales.some(t => t.toLowerCase() === curso.toLowerCase())) {
      actuales.push(curso);
      user.areas = actuales.join(', ');
      setUsers(users);
    }
    const hoy = new Date();
    const certs = getCerts();
    certs.push({
      id: uid(),
      cedula: user.cedula,
      nombre: user.nombre,
      curso,
      area: curso,
      horas,
      dia: hoy.getDate(),
      mes: hoy.getMonth() + 1,
      anio: hoy.getFullYear(),
      modelo: '',
      habilitado: true,
      creado: Date.now(),
    });
    if (!setCerts(certs)) return;
    $('#mhu-new-curso').value = '';
    renderMhuList(cedula);
    renderUsuarios();
    if (!$('#view-lista').classList.contains('hidden')) renderLista();
    updatePendingBadge();
    toast(`Taller "${curso}" agregado y habilitado para ${user.nombre}.`);
  });

  function saveMhuChanges(forceEnableAll = false) {
    const cedula = $('#mhu-cedula')?.value;
    if (!cedula) return;
    const certs = getCerts();
    $$('#mhu-list .mhu-item[data-cert-id]').forEach(item => {
      const cert = certs.find(c => c.id === item.dataset.certId);
      if (!cert) return;
      const chk = $('input[data-mhu-check]', item);
      const horasInp = $('input[data-mhu-horas]', item);
      const modeloSel = $('select[data-mhu-modelo]', item);
      cert.habilitado = forceEnableAll ? true : !!chk?.checked;
      if (horasInp) cert.horas = Math.min(500, Math.max(1, +horasInp.value || 5));
      if (modeloSel) {
        cert.modelo = modeloSel.value || '';
        cert.modeloManual = !!cert.modelo;
      }
    });
    if (!setCerts(certs)) return;
    closeModals();
    renderUsuarios();
    if (!$('#view-lista').classList.contains('hidden')) renderLista();
    updatePendingBadge();
    toast(forceEnableAll ? 'Todos los certificados del usuario han sido habilitados.' : 'Cambios guardados y estado actualizado.');
  }

  $('#mhu-enable-all')?.addEventListener('click', () => saveMhuChanges(true));
  $('#form-habilitar-user')?.addEventListener('submit', e => {
    e.preventDefault();
    saveMhuChanges(false);
  });

  /* Modal de recuperación de contraseña ("¿Olvidaste tu contraseña?") */
  let recoveryTargetUser = null;
  let simulatedSecurityCode = '';

  $('#btn-olvide-pass')?.addEventListener('click', () => {
    recoveryTargetUser = null;
    simulatedSecurityCode = '';
    const f = $('#form-recuperar');
    if (!f) return;
    f.reset();
    $('#recuperar-step1').classList.remove('hidden');
    $('#recuperar-step2').classList.add('hidden');
    $('#rec-btn-reset-ci').classList.add('hidden');
    $('#rec-code-field').classList.add('hidden');
    $('#rec-code-badge').classList.add('hidden');
    $('#rec-btn-submit').textContent = 'Continuar';
    $('#rec-error').textContent = '';
    openModal('#modal-recuperar');
    $('#rec-identificador')?.focus();
  });

  // Botón para enviar código simulado al correo
  $('#rec-btn-send-code')?.addEventListener('click', () => {
    if (!recoveryTargetUser) return;
    const email = recoveryTargetUser.email;
    if (!email) {
      toast('Este usuario no tiene correo registrado. Puedes restablecer directamente con tu cédula.', 'error');
      return;
    }
    // Generar código aleatorio de 6 dígitos
    simulatedSecurityCode = String(Math.floor(100000 + Math.random() * 900000));
    $('#rec-code-field').classList.remove('hidden');
    $('#rec-code-badge').classList.remove('hidden');
    $('#rec-code-input').value = simulatedSecurityCode; // se autorrellena para comodidad de prueba
    toast(`Código de verificación enviado a ${email}. Código de prueba: ${simulatedSecurityCode}`);
  });

  $('#form-recuperar')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const err = $('#rec-error');
    err.textContent = '';

    // Paso 1: Validación de cédula o correo
    if (!recoveryTargetUser) {
      const inputVal = clean(f.identificador?.value || '');
      const cedula = normCedula(inputVal);
      const email = inputVal.toLowerCase();
      
      const users = getUsers();
      const user = users.find(u => u.cedula === cedula || (u.email && u.email.toLowerCase() === email));
      if (!user) {
        err.textContent = 'No encontramos ninguna cuenta registrada con esa cédula o correo.';
        fx.shake(f);
        return;
      }
      recoveryTargetUser = user;
      $('#rec-user-name').textContent = user.nombre;
      $('#rec-user-meta').textContent = `C.I. ${fmtCedula(user.cedula)}${user.email ? ' · ' + user.email : ''}`;
      
      const emailText = $('#rec-email-text');
      if (emailText) {
        if (user.email) {
          emailText.textContent = `Se enviará un código de verificación al correo ${user.email}`;
          $('#rec-btn-send-code').classList.remove('hidden');
        } else {
          emailText.textContent = 'Esta cuenta no tiene correo electrónico vinculado. Puedes redefinir tu clave a continuación.';
          $('#rec-btn-send-code').classList.add('hidden');
        }
      }

      $('#recuperar-step1').classList.add('hidden');
      $('#recuperar-step2').classList.remove('hidden');
      $('#rec-btn-reset-ci').classList.remove('hidden');
      $('#rec-btn-submit').textContent = 'Guardar nueva contraseña';
      $('#rec-nueva').focus();
      return;
    }

    // Paso 2: Si se generó código, validar que coincida
    if (simulatedSecurityCode) {
      const codeEntered = clean(f.codigo?.value || '');
      if (codeEntered !== simulatedSecurityCode) {
        err.textContent = 'El código de verificación no coincide con el enviado a tu correo.';
        fx.shake(f);
        return;
      }
    }

    // Validación de nueva contraseña
    const n1 = f.nueva.value;
    const n2 = f.nueva2.value;
    if (n1.length < 6) {
      err.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
      fx.shake(f);
      return;
    }
    if (n1 !== n2) {
      err.textContent = 'Las contraseñas no coinciden.';
      fx.shake(f);
      return;
    }

    const users = getUsers();
    const user = users.find(u => u.cedula === recoveryTargetUser.cedula);
    if (user) {
      user.pass = await hashPass(user.cedula, n1);
      setUsers(users);
    }
    closeModals();
    toast('¡Contraseña actualizada con éxito! Ya puedes entrar.');
    const logInp = $('#form-login input[name="cedula"]');
    if (logInp) logInp.value = recoveryTargetUser.cedula;
    $('#form-login input[name="password"]')?.focus();
    recoveryTargetUser = null;
    simulatedSecurityCode = '';
  });

  // Botón directo: restablecer a la cédula
  $('#rec-btn-reset-ci')?.addEventListener('click', async () => {
    if (!recoveryTargetUser) return;
    const users = getUsers();
    const user = users.find(u => u.cedula === recoveryTargetUser.cedula);
    if (user) {
      user.pass = await hashPass(user.cedula, user.cedula);
      setUsers(users);
    }
    closeModals();
    toast(`Contraseña restablecida a tu número de cédula (${recoveryTargetUser.cedula}).`);
    const logInp = $('#form-login input[name="cedula"]');
    if (logInp) logInp.value = recoveryTargetUser.cedula;
    $('#form-login input[name="password"]')?.focus();
    recoveryTargetUser = null;
    simulatedSecurityCode = '';
  });

  /* Cambiar contraseña */
  $('#btn-pass').addEventListener('click', () => {
    closeMenu();
    $('#form-pass').reset();
    $('#form-pass .form-error').textContent = '';
    openModal('#modal-pass');
    $('#form-pass').actual.focus();
  });
  $('#form-pass').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, err = $('.form-error', f);
    const users = getUsers();
    const u = users.find(x => x.cedula === sessionStorage.getItem(K.session));
    if (!u) return startApp();
    if (u.pass !== await hashPass(u.cedula, f.actual.value)) { err.textContent = 'La contraseña actual no es correcta.'; return; }
    if (f.nueva.value.length < 6) { err.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.'; return; }
    if (f.nueva.value !== f.nueva2.value) { err.textContent = 'Las contraseñas no coinciden.'; return; }
    u.pass = await hashPass(u.cedula, f.nueva.value);
    setUsers(users);
    closeModals();
    toast('Contraseña actualizada.');
  });

  /* =========================================================
     INICIO
     ========================================================= */
  $$('.sel-mes').forEach(sel => {
    sel.innerHTML = MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    sel.value = now.getMonth() + 1;
  });
  $$('.in-dia').forEach(inp => { inp.value = now.getDate(); });
  $$('.in-anio').forEach(inp => { inp.value = now.getFullYear(); });
  $$('.in-horas').forEach(inp => { if (!inp.value) inp.value = 5; });
  $$('.footer-year, #year').forEach(el => { el.textContent = now.getFullYear(); });

  seedAdmin().then(startApp);
})();
