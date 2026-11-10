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

  const DEFAULTS = {
    institucion: 'Alcaldía de Chacao · Dirección de Desarrollo y Apoyo Social',
    titulo: 'Certificado',
    subtitulo: 'de culminación',
    textoA: 'Se otorga el presente certificado a',
    textoB: 'por haber culminado satisfactoriamente el curso del Servicio Comunitario',
    lugar: 'Chacao, Caracas',
    firma1Nombre: 'Gustavo Duque Sáez',
    firma1Cargo: 'Alcalde del Municipio Chacao',
    firma2Nombre: 'Dirección de Desarrollo Social',
    firma2Cargo: 'Desarrollo y Apoyo Social Chacao',
    fuenteNombre: 'script',
    mostrarCedula: true,
    logo: '',
    logoPreset: 'duo',
    plantilla: '',
    plantillaW: 0,
    plantillaH: 0,
    campos: null,
    camposAuto: null,
    colorTexto: '#004fc8',
  };

  const CLAVES_CAMPO = ['nombre', 'cedula', 'curso', 'fecha'];
  const FUENTES = {
    script: "'Great Vibes', cursive",
    serif: "700 1em 'Playfair Display', serif",
    times: "'Times New Roman', Times, serif",
    sans: "600 1em 'Geist', sans-serif",
    arial: 'Arial, Helvetica, sans-serif',
  };

  // Posición y estilo inicial de cada dato sobre un modelo (x, y, ancho en % del lienzo)
  function camposBase(s = {}, k = 1) {
    const color = s.colorTexto || DEFAULTS.colorTexto;
    const yN = s.posNombre ?? 45;
    const campo = (y, size, fuente, extra = {}) => ({
      x: 50, y, ancho: 80, size: Math.round(size * k), color, fuente, align: 'center',
      mayus: false, visible: true, prefijo: '', tapar: false, taparColor: '', taparEscala: 100, ...extra,
    });
    return {
      nombre: campo(yN, 54, s.fuenteNombre || 'script'),
      cedula: campo(yN + 7, 16, 'sans', { prefijo: 'C.I. ', visible: s.mostrarCedula !== false }),
      curso: campo(s.posCurso ?? 62, 30, 'serif'),
      fecha: campo(s.posFecha ?? 72, 19, 'sans'),
    };
  }

  const now = new Date();
  const SAMPLE = {
    cedula: '12345678', nombre: 'María Fernanda Pérez',
    curso: 'Formación Comunitaria Chacao', mes: now.getMonth() + 1, anio: now.getFullYear(),
  };

  /* ---------------- utilidades ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const clean = s => String(s ?? '').trim().replace(/\s+/g, ' ');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const fecha = c => `${MESES[c.mes - 1]} ${c.anio}`;
  const byDate = (a, b) => (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes) || b.creado - a.creado;

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
  function getSettings() {
    const s = { ...DEFAULTS, ...store.read(K.settings, {}) };
    if (!s.campos) s.campos = camposBase(s);
    return s;
  }
  const setSettings = v => store.write(K.settings, v);

  function currentUser() {
    const c = sessionStorage.getItem(K.session);
    return c ? getUsers().find(u => u.cedula === c) || null : null;
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

    // Datos de demostración iniciales para mostrar avances
    const certs = getCerts();
    if (!certs.some(c => c.cedula === demoCed)) {
      certs.push({
        id: uid(),
        cedula: demoCed,
        nombre: demoName,
        curso: 'Formación Comunitaria Chacao (Servicio Comunitario)',
        area: 'Servicio Comunitario',
        mes: now.getMonth() + 1,
        anio: now.getFullYear(),
        creado: Date.now() - 86400000,
      }, {
        id: uid(),
        cedula: demoCed,
        nombre: demoName,
        curso: 'Taller de Oficio y Capacitación Técnica (Oficio)',
        area: 'Oficio',
        mes: now.getMonth() + 1,
        anio: now.getFullYear(),
        creado: Date.now() - 43200000,
      }, {
        id: uid(),
        cedula: demoCed,
        nombre: demoName,
        curso: 'Taller de Emprendimiento Social Chacao (Emprendimiento)',
        area: 'Emprendimiento',
        mes: now.getMonth() || 12,
        anio: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
        creado: Date.now() - 172800000,
      });
      setCerts(certs);
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

  // Tamaño del lienzo: el lado largo mide siempre 1123 px y el otro sigue al modelo
  function tamano(s) {
    if (!s.plantilla || !s.plantillaW || !s.plantillaH) return { w: CERT_W, h: 794 };
    const k = CERT_W / Math.max(s.plantillaW, s.plantillaH);
    return { w: Math.round(s.plantillaW * k), h: Math.round(s.plantillaH * k) };
  }

  function textoCampo(clave, f, c) {
    let t = '';
    if (clave === 'nombre') t = c.nombre;
    if (clave === 'curso') t = c.curso;
    if (clave === 'cedula') t = /^\d+$/.test(c.cedula) ? fmtCedula(c.cedula) : '';
    if (clave === 'fecha') {
      const mes = MESES[c.mes - 1];
      t = `${f.prefijo ? mes.toLowerCase() : mes} de ${c.anio}`;
    }
    if (!t) return '';
    t = (f.prefijo || '') + t;
    return f.mayus ? t.toUpperCase() : t;
  }

  // Reduce la letra si el texto no cabe en el ancho del campo (nombres y cursos largos)
  const medidor = document.createElement('canvas').getContext('2d');
  function letraQueCabe(texto, f, anchoPx) {
    const familia = FUENTES[f.fuente] || FUENTES.sans;
    const m = familia.match(/^(\d+) 1em (.*)$/);
    medidor.font = m ? `${m[1]} ${f.size}px ${m[2]}` : `${f.size}px ${familia}`;
    const w = medidor.measureText(texto).width;
    return w > anchoPx ? Math.max(f.size * 0.4, f.size * anchoPx / w * 0.98) : f.size;
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
      campos += `<div class="tpl-field f-${esc(f.fuente)}" data-campo="${clave}" style="left:${+f.x}%;top:${+f.y}%;width:${+f.ancho}%;font-size:${size.toFixed(1)}px;color:${esc(f.color)};text-align:${esc(f.align)}">${esc(texto)}</div>`;
    });
    return `<div class="cert cert--tpl" style="width:${w}px;height:${h}px;background-image:url('${s.plantilla}')">${parches}${campos}</div>`;
  }

  function certHTML(c, s = getSettings()) {
    if (s.plantilla) return modeloHTML(c, s);

    const font = `f-${s.fuenteNombre || 'script'}`;
    const nSize = nameSize(c.nombre, s.fuenteNombre);
    const cSize = courseSize(c.curso);
    const ced = s.mostrarCedula && /^\d+$/.test(c.cedula)
      ? `<div class="cert-ced">C.I. ${fmtCedula(c.cedula)}</div>` : '';
    const date = `${esc(s.lugar ? s.lugar + ', ' : '')}${MESES[c.mes - 1]} de ${c.anio}`;

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
    const { w, h } = tamano(settings);
    frame.style.aspectRatio = `${w} / ${h}`;
    frame.style.maxWidth = h > w ? '520px' : '';          // un modelo vertical no ocupa toda la pantalla
    frame.style.marginInline = h > w ? 'auto' : '';
    frame.innerHTML = certHTML(cert, settings);
    fitFrame(frame);
    ro.observe(frame);
  }

  const loadImg = src => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = src; });

  // Prepara el área de impresión y la página del PDF con las medidas del modelo
  async function prepararImpresion(c, s) {
    const area = $('#print-area');
    area.innerHTML = certHTML(c, s);
    await Promise.all([s.plantilla, s.logo].filter(Boolean).map(loadImg));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    area.innerHTML = certHTML(c, s);                      // ya con las letras cargadas, para medir bien
    const estilo = $('#estilo-pagina') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'estilo-pagina' }));
    if (s.plantilla) {
      const { w, h } = tamano(s);
      estilo.textContent = `@media print { @page { size: ${w}px ${h}px; margin: 0; } #print-area .cert { height: ${h - 1}px !important; } }`;
    } else {
      estilo.textContent = '';
    }
  }

  async function printCert(c) {
    const s = getSettings();
    const area = $('#print-area');
    await prepararImpresion(c, s);
    // El título sugiere el nombre del archivo PDF
    document.title = `Certificado - ${c.nombre} - ${c.curso}`;
    window.addEventListener('afterprint', () => {
      document.title = APP_TITLE;
      area.innerHTML = '';
    }, { once: true });
    toast('Elige “Guardar como PDF” en la ventana de impresión.');
    setTimeout(() => window.print(), 50);
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
    if (areas.length < 2) return fail('Escribe al menos un área de servicio comunitario (o selecciona de las sugerencias).');
    if (f.password.value.length < 6) return fail('La contraseña debe tener al menos 6 caracteres.');
    if (f.password.value !== f.password2.value) return fail('Las contraseñas no coinciden.');
    const users = getUsers();
    if (users.some(u => u.cedula === cedula)) return fail('Esa cédula ya está registrada. Inicia sesión.');
    if (users.some(u => u.email && u.email.toLowerCase() === email)) return fail('Ese correo ya está registrado por otro estudiante.');
    users.push({
      cedula, nombre, email, areas, role: 'user',
      pass: await hashPass(cedula, f.password.value), creado: Date.now()
    });
    if (!setUsers(users)) return;
    sessionStorage.setItem(K.session, cedula);
    toast('¡Cuenta creada! Bienvenido(a).');
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
    show(isAdmin ? 'emitir' : 'mis');
    if (isAdmin && u.cedula === ADMIN_CEDULA) checkDefaultAdminPass(u);
  }

  async function checkDefaultAdminPass(u) {
    if (u.pass === await hashPass(ADMIN_CEDULA, ADMIN_PASS)) {
      toast('Estás usando la contraseña inicial. Cámbiala con el botón de la llave.', 'error');
    }
  }

  const renderers = {
    mis: renderMis, emitir: renderEmitir, lista: renderLista,
    usuarios: renderUsuarios, config: renderConfig,
  };

  function show(view) {
    const u = currentUser();
    if (!u) return startApp();
    if (u.role !== 'admin') view = 'mis';
    else if (view === 'mis') view = 'emitir';
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

    // Áreas registradas del estudiante
    const userAreas = (u.areas || 'Bienestar Social, Salud').split(',').map(s => s.trim()).filter(Boolean);
    const areasList = $('#mis-areas-list');
    if (areasList) {
      areasList.innerHTML = userAreas.length
        ? userAreas.map(a => `<span class="badge-area">${esc(a)}</span>`).join('')
        : '<span class="muted small">Sin áreas registradas aún</span>';
    }

    // Selector de áreas en el generador de certificados
    const selArea = $('#sel-user-area');
    if (selArea) {
      selArea.innerHTML = userAreas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')
        + (userAreas.length === 0 ? '<option value="Bienestar Social">Bienestar Social</option>' : '');
    }

    const certs = getCerts().filter(c => c.cedula === u.cedula).sort(byDate);
    const grid = $('#mis-grid');
    $('#mis-count').textContent = 0;
    fx.count($('#mis-count'), certs.length);
    if (!certs.length) {
      grid.innerHTML = `<div class="empty">
        <div class="brand-mark">${ic('award')}</div>
        <h3>Aún no tienes certificados</h3>
        <p>Genera tu certificado arriba indicando tu área y actividad, o espera la emisión directa de la coordinación.</p>
      </div>`;
      return;
    }
    const s = getSettings();
    grid.innerHTML = certs.map((c, i) => `
      <article class="cert-card">
        <div class="cert-frame" data-act="ver" data-id="${c.id}"></div>
        <div class="cert-card-body">
          <span class="cert-card-index">Nº ${String(certs.length - i).padStart(2, '0')}</span>
          <h3>${esc(c.curso)}</h3>
          <p>${fecha(c)}</p>
          <div class="cert-card-actions">
            <button class="btn btn-light" data-act="ver" data-id="${c.id}">${ic('eye')}Ver</button>
            <button class="btn btn-primary" data-act="pdf" data-id="${c.id}">${ic('download')}PDF</button>
          </div>
        </div>
      </article>`).join('');
    $$('.cert-frame', grid).forEach(f => mount(f, certs.find(c => c.id === f.dataset.id), s));
    $$('.cert-card', grid).forEach(card => fx.tilt(card, 8));
  }

  // Generación de certificado propia por el estudiante según su área
  const formUserGenerar = $('#form-user-generar');
  formUserGenerar?.addEventListener('submit', e => {
    e.preventDefault();
    const u = currentUser();
    if (!u) return;
    const f = formUserGenerar;
    const area = clean(f.area?.value || '');
    const actividad = clean(f.curso?.value || '');
    const mes = +f.mes?.value || (now.getMonth() + 1);
    const anio = +f.anio?.value || now.getFullYear();

    if (actividad.length < 3) {
      toast('Escribe la actividad, proyecto o motivo del certificado.', 'error');
      f.curso?.focus();
      return;
    }
    if (!(anio >= 2000 && anio <= 2100)) {
      toast('Escribe un año válido.', 'error');
      return;
    }

    const cursoCompleto = actividad + (area && !actividad.toLowerCase().includes(area.toLowerCase()) ? ` (${area})` : '');
    const cert = {
      id: uid(),
      cedula: u.cedula,
      nombre: u.nombre,
      curso: cursoCompleto,
      area: area,
      mes,
      anio,
      creado: Date.now(),
    };

    const certs = getCerts();
    certs.push(cert);
    if (!setCerts(certs)) return;

    toast(`¡Certificado generado con éxito! Abriendo vista oficial...`);
    f.curso.value = '';
    renderMis();
    viewCert(cert);
  });

  // Botón para que el estudiante modifique sus áreas asignadas
  $('#btn-editar-mis-areas')?.addEventListener('click', () => {
    const u = currentUser();
    if (u) openEditAreasModal(u);
  });

  /* ---------------- Admin: emitir ---------------- */
  function fillDatalists() {
    $('#dl-cedulas').innerHTML = getUsers().filter(u => u.role !== 'admin')
      .map(u => `<option value="${esc(u.cedula)}">${esc(u.nombre)}</option>`).join('');
    $('#dl-cursos').innerHTML = [...new Set(getCerts().map(c => c.curso))]
      .map(c => `<option value="${esc(c)}"></option>`).join('');
  }

  function renderEmitir() {
    fillDatalists();
    updatePreview($('#form-emitir'));
    updateStats();
  }

  function updateStats() {
    const certs = getCerts();
    fx.count($('#st-users'), getUsers().filter(u => u.role !== 'admin').length);
    fx.count($('#st-certs'), certs.length);
    fx.count($('#st-cursos'), new Set(certs.map(c => c.curso.toLowerCase())).size);
  }

  function previewData(f) {
    if (f.id === 'form-lote') {
      const first = parseLote(f.lista.value).ok[0];
      return {
        cedula: first ? first.cedula : SAMPLE.cedula,
        nombre: first ? first.nombre : 'Nombre del participante',
        curso: clean(f.curso.value) || 'Nombre del curso',
        mes: +f.mes.value, anio: +f.anio.value || now.getFullYear(),
      };
    }
    return {
      cedula: validCedula(normCedula(f.cedula.value)) ? normCedula(f.cedula.value) : SAMPLE.cedula,
      nombre: clean(f.nombre.value) || 'Nombre del participante',
      curso: clean(f.curso.value) || 'Nombre del curso',
      mes: +f.mes.value, anio: +f.anio.value || now.getFullYear(),
    };
  }
  const updatePreview = f => mount($('#emitir-preview'), previewData(f));

  const formEmitir = $('#form-emitir');
  formEmitir.addEventListener('input', e => {
    const f = formEmitir;
    if (e.target === f.cedula) {
      const u = getUsers().find(x => x.cedula === normCedula(f.cedula.value) && x.role !== 'admin');
      if (u && (!f.nombre.value || f.nombre.dataset.auto)) {
        f.nombre.value = u.nombre;
        f.nombre.dataset.auto = '1';
      } else if (!u && f.nombre.dataset.auto) {
        f.nombre.value = '';
        delete f.nombre.dataset.auto;
      }
    }
    if (e.target === f.nombre) delete f.nombre.dataset.auto;
    updatePreview(f);
  });
  formEmitir.addEventListener('change', () => updatePreview(formEmitir));

  const isDup = (list, c) => list.some(x => x.cedula === c.cedula && x.mes === c.mes && x.anio === c.anio
    && x.curso.toLowerCase() === c.curso.toLowerCase());

  function readCommon(f) {
    const curso = clean(f.curso.value), mes = +f.mes.value, anio = +f.anio.value;
    if (curso.length < 3) { toast('Escribe el nombre del curso.', 'error'); return null; }
    if (!(anio >= 2000 && anio <= 2100)) { toast('Escribe un año válido.', 'error'); return null; }
    return { curso, mes, anio };
  }

  formEmitir.addEventListener('submit', e => {
    e.preventDefault();
    const f = formEmitir;
    const common = readCommon(f);
    if (!common) return;
    const cedula = normCedula(f.cedula.value), nombre = clean(f.nombre.value);
    if (!validCedula(cedula)) { toast('Escribe una cédula válida (solo números).', 'error'); return; }
    if (nombre.length < 3) { toast('Escribe el nombre que aparecerá en el certificado.', 'error'); return; }
    const cert = { id: uid(), cedula, nombre, ...common, creado: Date.now() };
    const certs = getCerts();
    if (isDup(certs, cert) && !confirm('Esta persona ya tiene un certificado de ese curso en esa fecha. ¿Crear otro igual?')) return;
    certs.push(cert);
    if (!setCerts(certs)) return;
    const registrado = getUsers().some(u => u.cedula === cedula);
    toast(`Certificado emitido para ${nombre}.${registrado ? '' : ' Lo verá cuando se registre con su cédula.'}`);
    f.cedula.value = '';
    f.nombre.value = '';
    delete f.nombre.dataset.auto;
    f.cedula.focus();
    fillDatalists();
    fx.stamp($('#emitir-preview'));
    updateStats();
    updatePreview(f);
  });

  /* Lote: "cédula, nombre" por línea (coma, punto y coma o tabulación de Excel) */
  function parseLote(text) {
    const users = new Map(getUsers().map(u => [u.cedula, u]));
    const ok = [], bad = [];
    text.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const parts = line.split(/\t|;|,/).map(p => p.trim().replace(/^"(.*)"$/, '$1'));
      if (!/\d/.test(parts[0])) return; // encabezado u otra línea sin cédula
      const cedula = normCedula(parts[0]);
      const nombre = clean(parts.slice(1).filter(p => p && !/[@\d]/.test(p)).join(' '))
        || (users.get(cedula) || {}).nombre || '';
      if (!validCedula(cedula) || !nombre) { bad.push(i + 1); return; }
      ok.push({ cedula, nombre });
    });
    return { ok, bad };
  }

  const formLote = $('#form-lote');
  function updateLoteInfo() {
    const info = $('#lote-info');
    const { ok, bad } = parseLote(formLote.lista.value);
    if (!ok.length && !bad.length) {
      info.textContent = 'También puedes copiar y pegar las dos columnas desde Excel.';
      info.classList.remove('ok');
      return;
    }
    info.textContent = `${ok.length} participante(s) listo(s)` + (bad.length ? ` · revisa la(s) línea(s) ${bad.join(', ')}` : '');
    info.classList.toggle('ok', !bad.length);
  }
  formLote.addEventListener('input', () => { updateLoteInfo(); updatePreview(formLote); });
  formLote.addEventListener('change', () => updatePreview(formLote));

  $('#in-csv').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    formLote.lista.value = (await file.text()).trim();
    e.target.value = '';
    updateLoteInfo();
    updatePreview(formLote);
  });

  formLote.addEventListener('submit', e => {
    e.preventDefault();
    const common = readCommon(formLote);
    if (!common) return;
    const { ok, bad } = parseLote(formLote.lista.value);
    if (!ok.length) { toast('Agrega al menos un participante (cédula, nombre).', 'error'); return; }
    if (bad.length && !confirm(`Hay ${bad.length} línea(s) con errores que se omitirán (${bad.join(', ')}). ¿Continuar?`)) return;
    const certs = getCerts();
    let creados = 0, omitidos = 0;
    ok.forEach(p => {
      const cert = { id: uid(), ...p, ...common, creado: Date.now() };
      if (isDup(certs, cert)) { omitidos++; return; }
      certs.push(cert);
      creados++;
    });
    if (!setCerts(certs)) return;
    toast(`Se emitieron ${creados} certificado(s)` + (omitidos ? ` · ${omitidos} ya existían` : '') + '.');
    formLote.lista.value = '';
    updateLoteInfo();
    fillDatalists();
    fx.stamp($('#emitir-preview'));
    updateStats();
  });

  /* ---------------- Admin: lista ---------------- */
  function renderLista() {
    const q = clean($('#lista-buscar').value).toLowerCase();
    const all = getCerts().sort(byDate);
    const certs = all.filter(c => !q || `${c.cedula} ${c.nombre} ${c.curso}`.toLowerCase().includes(q));
    $('#lista-count').textContent = q ? `${certs.length} de ${all.length} certificado(s)` : `${all.length} certificado(s) en total`;
    $('#lista-body').innerHTML = certs.length ? certs.map(c => `
      <tr>
        <td class="nowrap">${fmtCedula(c.cedula)}</td>
        <td class="strong">${esc(c.nombre)}</td>
        <td>${esc(c.curso)}</td>
        <td class="nowrap">${fecha(c)}</td>
        <td><div class="t-actions">
          <button class="btn btn-light btn-icon" data-act="ver" data-id="${c.id}" title="Ver" aria-label="Ver">${ic('eye')}</button>
          <button class="btn btn-light btn-icon" data-act="pdf" data-id="${c.id}" title="Descargar PDF" aria-label="Descargar PDF">${ic('download')}</button>
          <button class="btn btn-danger btn-icon" data-act="del" data-id="${c.id}" title="Eliminar" aria-label="Eliminar">${ic('trash')}</button>
        </div></td>
      </tr>`).join('')
      : `<tr><td colspan="5" class="t-empty">${q ? 'Sin resultados.' : 'Todavía no se ha emitido ningún certificado.'}</td></tr>`;
  }
  $('#lista-buscar').addEventListener('input', renderLista);

  /* ---------------- Admin: usuarios ---------------- */
  function renderUsuarios() {
    const certs = getCerts();
    const me = currentUser();
    const users = getUsers().sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || b.creado - a.creado);
    $('#usuarios-body').innerHTML = users.map(u => {
      const n = certs.filter(c => c.cedula === u.cedula).length;
      const isMe = u.cedula === me.cedula;
      const userAreas = (u.areas || '').split(',').map(s => s.trim()).filter(Boolean);
      const emailTxt = u.email ? `<small class="muted" style="word-break:break-all;">${esc(u.email)}</small>` : '<span class="muted small">—</span>';
      const areasHtml = userAreas.length
        ? `<div class="table-areas-list">${userAreas.map(a => `<span class="user-area-pill">${esc(a)}</span>`).join('')}</div>`
        : (u.role === 'admin' ? '<span class="muted small">Administración</span>' : '<span class="muted small">Sin área</span>');

      const actions = isMe ? '<span class="muted small">Sesión activa</span>' : `
        <button class="btn btn-light btn-sm" data-act="editareas" data-id="${esc(u.cedula)}" title="Editar áreas de servicio">${ic('pen')}Áreas</button>
        <button class="btn btn-light btn-sm" data-act="reset" data-id="${esc(u.cedula)}" title="Restablecer clave a la cédula">${ic('refresh')}Restablecer clave</button>
        <button class="btn btn-light btn-sm" data-act="role" data-id="${esc(u.cedula)}">${ic('shield')}${u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}</button>
        <button class="btn btn-danger btn-icon" data-act="deluser" data-id="${esc(u.cedula)}" title="Eliminar cuenta" aria-label="Eliminar">${ic('trash')}</button>`;
      return `<tr>
        <td class="nowrap">${fmtCedula(u.cedula)}</td>
        <td class="strong">${esc(u.nombre)} ${u.role === 'admin' ? '<span class="badge">Admin</span>' : ''}</td>
        <td>${emailTxt}</td>
        <td>${areasHtml}</td>
        <td>${n}</td>
        <td class="nowrap">${new Date(u.creado).toLocaleDateString('es-VE')}</td>
        <td><div class="t-actions">${actions}</div></td>
      </tr>`;
    }).join('');
  }

  /* ---------------- Admin: diseño ---------------- */
  let draft = getSettings();
  const formConfig = $('#form-config');

  function renderConfig(d = getSettings()) {
    draft = d;
    for (const el of formConfig.elements) {
      if (!el.name || !(el.name in draft) || el.type === 'file') continue;
      if (el.type === 'checkbox') el.checked = !!draft[el.name];
      else el.value = draft[el.name];
    }
    prepararMuestra(draft.plantilla);
    syncConfig();
  }

  function syncConfig() {
    const tpl = !!draft.plantilla;
    $('#tpl-controls').classList.toggle('hidden', !tpl);
    $('#default-controls').classList.toggle('hidden', tpl);
    $('#btn-quitar-plantilla').classList.toggle('hidden', !tpl);
    $('#btn-quitar-logo').classList.toggle('hidden', !draft.logo);
    $('#editor-ayuda').classList.toggle('hidden', !tpl);

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
    const f = draft.campos[campoActivo];
    $$('.campo-chip').forEach(b => {
      b.classList.toggle('activo', b.dataset.campo === campoActivo);
      b.classList.toggle('oculto', !draft.campos[b.dataset.campo].visible);
    });
    $$('[data-f]', formConfig).forEach(el => {
      const v = f[el.dataset.f];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.value !== String(v ?? '')) el.value = v ?? '';
    });
    $('[data-out="size"]').textContent = `${f.size}`;
    $('[data-out="ancho"]').textContent = `${f.ancho}%`;
    $('[data-out="taparEscala"]').textContent = `${f.taparEscala || 100}%`;
    $('#campo-parche').classList.toggle('hidden', !f.tapar);
    $$('#config-preview .tpl-field').forEach(el => el.classList.toggle('sel', el.dataset.campo === campoActivo));
  }

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

  // Arrastrar un dato sobre la vista previa
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
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        muestra = { src, ctx, w: img.width, h: img.height };
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
  }

  // Borra una zona de la imagen del modelo rellenándola con lo que hay justo encima y debajo
  function borrarZona(x, y, ancho, alto) {
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
  }

  function colorDelParche(f) {
    const { h } = tamano(draft);
    const [x, y, w, alto] = cajaParche(f, h);
    const z = leerZona(x, y, w, alto * 1.6);
    f.taparColor = z ? z.fondo : '#ffffff';
  }

  // Coloca los datos según el modelo recién subido
  async function adaptarAlModelo(modelo) {
    draft.plantilla = modelo.data;
    draft.plantillaW = modelo.w;
    draft.plantillaH = modelo.h;
    await prepararMuestra(modelo.data);
    const { w, h } = tamano(draft);
    const campos = camposBase({ fuenteNombre: draft.fuenteNombre, mostrarCedula: draft.mostrarCedula }, w / CERT_W);
    CLAVES_CAMPO.forEach(clave => {
      const f = campos[clave];
      const z = leerZona(f.x, f.y, f.ancho, 8);
      if (z && z.oscuro) f.color = '#ffffff';              // sobre un fondo oscuro, letra clara
    });
    const marcadores = modelo.marcadores || [];
    if (marcadores.length) {
      CLAVES_CAMPO.forEach(clave => { campos[clave].visible = false; });
      marcadores.forEach(m => {
        const f = campos[m.campo];
        const z = leerZona(m.x, m.y, m.w * 1.08, m.h * 1.5);
        Object.assign(f, {
          visible: true, x: +m.x.toFixed(2), y: +m.y.toFixed(2),
          size: Math.max(8, Math.round(m.h / 100 * h)),
          ancho: Math.round(Math.min(92, Math.max(m.w * 1.5, m.campo === 'cedula' || m.campo === 'fecha' ? 30 : 60))),
          prefijo: m.campo === 'cedula' ? f.prefijo : '',
        });
        if (z && z.tinta) f.color = z.tinta;
      });
      // Ya leídos sus colores, los marcadores desaparecen del modelo
      marcadores.forEach(m => borrarZona(m.x, m.y, m.w * 1.08, m.h * 1.5));
      draft.plantilla = muestra.ctx.canvas.toDataURL('image/jpeg', 0.86);
      muestra.src = draft.plantilla;
    }
    draft.campos = campos;
    draft.camposAuto = JSON.parse(JSON.stringify(campos));
    campoActivo = marcadores.length ? marcadores[0].campo : 'nombre';
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
    if (setSettings(draft)) toast('Diseño guardado. Todos los certificados usan el nuevo diseño.');
  });

  $('#btn-restablecer').addEventListener('click', () => {
    const { logo, plantilla, plantillaW, plantillaH, camposAuto } = draft;
    const campos = camposAuto ? JSON.parse(JSON.stringify(camposAuto)) : camposBase();
    renderConfig({ ...DEFAULTS, logo, plantilla, plantillaW, plantillaH, camposAuto, campos });
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

  // Busca marcadores como {{nombre}}, {{curso}}, {{fecha}}, {{cedula}} en el texto del PDF
  async function buscarMarcadores(page, viewport) {
    const { items } = await page.getTextContent();
    const lineas = new Map();
    items.forEach(it => {
      if (!it.str) return;
      const [x, y] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
      const fila = Math.round(y / 4);
      if (!lineas.has(fila)) lineas.set(fila, []);
      lineas.get(fila).push({
        x, y, str: it.str, ancho: it.width * viewport.scale,
        alto: Math.hypot(it.transform[2], it.transform[3]) * viewport.scale,
      });
    });
    const encontrados = [];
    lineas.forEach(partes => {
      partes.sort((a, b) => a.x - b.x);
      let texto = '';
      const tramos = partes.map(p => { const t = { p, ini: texto.length }; texto += p.str; t.fin = texto.length; return t; });
      for (const m of texto.matchAll(RE_MARCADOR)) {
        const fin = m.index + m[0].length;
        const tocados = tramos.filter(t => t.ini < fin && t.fin > m.index);
        if (!tocados.length) continue;
        // Posición proporcional dentro de cada tramo, por si el marcador comparte línea con otro texto
        const a = tocados[0], z = tocados[tocados.length - 1];
        const x0 = a.p.x + a.p.ancho * (m.index - a.ini) / (a.fin - a.ini);
        const x1 = z.p.x + z.p.ancho * (fin - z.ini) / (z.fin - z.ini);
        const alto = Math.max(...tocados.map(t => t.p.alto));
        
        const rawKey = m[1].toLowerCase().replace(/[.\s]+/g, ' ').trim();
        let clave = 'curso';
        if (/^(nombre|apellido|participante|alumno|estudiante)/.test(rawKey)) clave = 'nombre';
        else if (/^(c[eé]dula|ci|c i)/.test(rawKey)) clave = 'cedula';
        else if (/^(fecha|mes|a[nñ]o)/.test(rawKey)) clave = 'fecha';
        else clave = 'curso';

        encontrados.push({
          campo: clave,
          x: (x0 + x1) / 2 / viewport.width * 100,
          y: (a.p.y - alto * 0.32) / viewport.height * 100,
          w: (x1 - x0) / viewport.width * 100,
          h: alto / viewport.height * 100,
        });
      }
    });
    return encontrados;
  }

  // Convierte la primera página de un PDF en imagen (usa pdf.js solo cuando hace falta)
  async function pdfToDataURL(file) {
    if (!window.pdfjsLib) {
      await loadScript(PDFJS + 'pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    }
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const page = await pdf.getPage(1);
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
    return { data: cv.toDataURL('image/jpeg', 0.86), w: cv.width, h: cv.height, marcadores };
  }

  $('#in-plantilla').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      toast('Procesando modelo…');
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const modelo = isPdf ? await pdfToDataURL(file) : await imageToDataURL(file, LADO_MODELO, 'image/jpeg');
      const n = await adaptarAlModelo(modelo);
      if (n) toast(`Encontré ${n} marcador(es) en tu PDF y coloqué los datos ahí. Revisa y pulsa “Guardar diseño”.`);
      else toast('Modelo cargado. Arrastra cada dato a su lugar y pulsa “Guardar diseño”.');
    } catch (err) {
      console.error(err);
      toast('No se pudo leer el archivo. Si es PDF, revisa tu conexión a internet.', 'error');
    }
  });
  $('#btn-quitar-plantilla').addEventListener('click', () => {
    Object.assign(draft, { plantilla: '', plantillaW: 0, plantillaH: 0, camposAuto: null });
    prepararMuestra('');
    syncConfig();
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
    return cert && u && (u.role === 'admin' || u.cedula === cert.cedula);
  }

  function viewCert(cert) {
    modalCert = cert;
    $('#mc-title').textContent = cert.curso;
    $('#mc-date').textContent = fecha(cert);
    $('#mc-sub').textContent = `${cert.nombre} · C.I. ${fmtCedula(cert.cedula)}`;
    openModal('#modal-cert');
    mount($('#mc-frame'), cert);
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
      }
      return;
    }

    if (currentUser()?.role !== 'admin') return;
    const users = getUsers();
    const user = users.find(u => u.cedula === id);
    if (!user) return;

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

  /* Modal de edición de áreas */
  function openEditAreasModal(user) {
    const m = $('#modal-edit-areas');
    if (!m) return;
    $('#mea-cedula').value = user.cedula;
    $('#mea-areas').value = user.areas || '';
    $('#mea-title').textContent = `Áreas de ${user.nombre}`;
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
      err.textContent = 'Indica al menos un área de servicio.';
      return;
    }
    const users = getUsers();
    const user = users.find(u => u.cedula === cedula);
    if (!user) return;
    user.areas = areas;
    setUsers(users);
    closeModals();
    toast('Áreas de servicio comunitario actualizadas.');
    const cur = currentUser();
    if (cur && cur.cedula === cedula) renderMis();
    if (cur && cur.role === 'admin') renderUsuarios();
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
  $$('.in-anio').forEach(inp => { inp.value = now.getFullYear(); });
  $$('.footer-year, #year').forEach(el => { el.textContent = now.getFullYear(); });

  seedAdmin().then(startApp);
})();
