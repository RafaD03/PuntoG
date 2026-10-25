let booted = false;
addEventListener('error', e => {
  const m = document.getElementById('main');
  if (!booted && m) m.textContent = 'Error al iniciar: ' + e.message + ' (línea ' + e.lineno + ')';
});

if (!window.api) window.api = {
  open: async () => null,
  readPath: async () => null,
  showInFolder: async () => null,
  getFileToOpen: async () => null,
  write: async () => true,
  writeSync: () => true,
  saveAs: async () => null,
  pdf: async () => { try { window.print(); } catch (x) {} return null; },
  onMenu: () => {}
};

const KEY = 'guion-studio-v1';
const KEY_RECENTS = 'guion-studio-recents';
const KEY_PROJ = 'guion-proj-';
const KEY_CONFIG = 'guion-studio-config';

let CFG = { scriptFocusBox: false };
try {
  const sc = localStorage.getItem(KEY_CONFIG);
  if (sc) CFG = { ...CFG, ...JSON.parse(sc) };
} catch (e) {}

function applyConfig() {
  document.body.classList.toggle('hide-script-focus-box', !CFG.scriptFocusBox);
  try { localStorage.setItem(KEY_CONFIG, JSON.stringify(CFG)); } catch (e) {}
}

const $ = s => document.querySelector(s), M = $('#main'), uid = () => Math.random().toString(36).slice(2, 8);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wc = s => (s || '').trim() ? s.trim().split(/\s+/).length : 0, st = m => $('#st').textContent = m;
const blank = () => ({ cover: {}, tag: '', syn: '', tpl: '3', beats: {}, chars: [], locs: [], scenes: [], treat: '', script: [], notes: [], vers: [] });

const PAL = ['#e0564a', '#e8963a', '#d9bd2f', '#4fae6b', '#2fa3a8', '#3f7be0', '#8a5be0', '#d65aa8'];
const OLD = { n: 'nreal', e: 'age', q: 'one', f: 'fotro', o: 'trab', d: 'lnac', fa: 'fam', mk: 'evento', pe: 'pers', vo: 'habla', va: 'filos', mz: 'habit', ob: 'metal', ne: 'need', mi: 'miedo', se: 'secre', df: 'debil', cb: 'cambia', al: 'r_al', an: 'r_an', am: 'r_am', ds: 'r_ds' };
const OLDL = { cl: 'Clase social, educación y dinero', ho: 'Qué le hace reír y qué lo saca de quicio', pq: '¿Por qué lo quiere ahora?', ap: '¿Qué se juega?', he: 'La herida o la mentira en la que cree', co: 'Lo que dice ser frente a lo que es', li: 'La línea que jamás cruzaría', ai: 'Cómo empieza la historia', af: 'Cómo termina', sm: 'Símbolo, objeto o frase que lo resume' };

function norm(o) {
  (o.chars || []).forEach((c, i) => {
    if (!c.id) c.id = uid();
    if (!c.color) c.color = PAL[i % PAL.length];
    if (!Array.isArray(c.rel)) c.rel = [];
    c.a = c.a || {};
    if (!c.v) {
      const n = {}, lg = [];
      Object.keys(c.a).forEach(k => {
        const v = c.a[k];
        if (!(v || '').trim()) return;
        if (OLD[k] && !n[OLD[k]]) n[OLD[k]] = v;
        else lg.push((OLDL[k] || k) + ': ' + v);
      });
      if (lg.length) n.legacy = lg.join('\n\n');
      c.a = n;
      c.v = 2;
    }
  });
  if (!Array.isArray(o.script)) o.script = [];
  return o;
}

function timeAgo(ts) {
  if (!ts) return 'Fecha desconocida';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Hace un momento';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Hace ${d} día${d > 1 ? 's' : ''}`;
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getRecents() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY_RECENTS) || '[]');
    return Array.isArray(r) ? r : [];
  } catch (e) {
    return [];
  }
}

function saveRecents(list) {
  try { localStorage.setItem(KEY_RECENTS, JSON.stringify(list)); } catch (e) {}
}

function initStorage() {
  let list = getRecents();
  if (!list.length) {
    try {
      const old = localStorage.getItem(KEY);
      if (old) {
        const o = JSON.parse(old);
        const pth = localStorage.getItem(KEY + '-path') || null;
        const hasOldContent = o && (o.cover?.title || (o.scenes && o.scenes.length) || (o.chars && o.chars.length) || o.treat || o.syn);
        if (hasOldContent) {
          const id = uid();
          localStorage.setItem(KEY_PROJ + id, old);
          list = [{
            id,
            title: o.cover?.title || 'Mi guion',
            author: o.cover?.author || '',
            genre: o.cover?.genre || '',
            path: pth,
            updatedAt: Date.now(),
            scenes: (o.scenes || []).length,
            chars: (o.chars || []).length
          }];
          saveRecents(list);
        }
      }
    } catch (e) {}
  }
  return list;
}

function updateCurrentInRecents() {
  if (!currentId) return;
  const list = getRecents();
  let item = list.find(x => x.id === currentId);
  if (!item) {
    item = { id: currentId };
    list.unshift(item);
  }
  item.title = (S.cover && S.cover.title) || 'Proyecto sin título';
  item.author = (S.cover && S.cover.author) || '';
  item.genre = (S.cover && S.cover.genre) || '';
  item.path = filePath || null;
  item.updatedAt = Date.now();
  item.scenes = (S.scenes || []).length;
  item.chars = (S.chars || []).length;
  list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  saveRecents(list);
}

let inLauncher = true;
let currentId = null;
let S = blank();
let tab = 'cover';
let cur = null;
let tm = null;
let dr = null;
let arm = null;
let filePath = null;
let pending = false;
let op = {};
let searchFilter = '';

// Screenplay state
let curScriptBlock = 0;
let scriptSplit = false;
let scriptRefTab = 'chars';
let isScriptFs = false;

function persist(sync) {
  if (inLauncher || !currentId) return;
  const j = JSON.stringify(S);
  try {
    localStorage.setItem(KEY_PROJ + currentId, j);
    localStorage.setItem(KEY, j);
    localStorage.setItem(KEY + '-path', filePath || '');
  } catch (e) {}
  updateCurrentInRecents();
  if (!filePath) {
    st('Borrador local · guarda con Ctrl+S');
    return;
  }
  try {
    if (sync) api.writeSync(j, filePath);
    else api.write(j, filePath).then(ok => st(ok ? 'Guardado ✓' : '⚠ No se pudo guardar el archivo'));
  } catch (e) {
    st('⚠ No se pudo guardar el archivo');
  }
}

function save() {
  if (inLauncher) return;
  st('Guardando…');
  pending = true;
  clearTimeout(tm);
  tm = setTimeout(() => {
    pending = false;
    persist();
  }, 500);
}

addEventListener('beforeunload', () => {
  if (pending) persist(true);
});

const hasData = () => JSON.stringify({ ...S, vers: [] }) != JSON.stringify(blank());

function setTtl() {
  if (inLauncher) {
    $('#ttl').textContent = '';
    document.title = 'Punto G — Mis Proyectos';
    return;
  }
  const t = S.cover.title || 'Proyecto sin título';
  $('#ttl').textContent = ' · ' + t;
  document.title = t + ' — Punto G';
}

async function openRecent(id) {
  const list = getRecents();
  const item = list.find(x => x.id === id);
  if (!item) return;

  if (item.path) {
    const r = await api.readPath(item.path);
    if (r && r.data) {
      currentId = id;
      S = norm({ ...blank(), ...r.data });
      filePath = item.path;
      inLauncher = false;
      tab = 'cover';
      cur = null;
      updateCurrentInRecents();
      render();
      st('Listo');
      return;
    } else {
      if (confirm(`No se pudo encontrar el archivo en:\n${item.path}\n\n¿Quieres quitar este proyecto de la lista?`)) {
        removeRecent(id);
      }
      return;
    }
  } else {
    const raw = localStorage.getItem(KEY_PROJ + id);
    if (raw) {
      try {
        currentId = id;
        S = norm({ ...blank(), ...JSON.parse(raw) });
        filePath = null;
        inLauncher = false;
        tab = 'cover';
        cur = null;
        updateCurrentInRecents();
        render();
        st('Borrador local · guarda con Ctrl+S');
        return;
      } catch (e) {}
    }
    alert('No se encontraron datos para este borrador local.');
  }
}

function createNewProject() {
  if (!inLauncher && currentId) persist(true);
  currentId = uid();
  S = blank();
  S.cover = { title: 'Nuevo proyecto' };
  filePath = null;
  inLauncher = false;
  tab = 'cover';
  cur = null;
  persist();
  render();
  st('Borrador local · guarda con Ctrl+S');
}

function goHome() {
  if (!inLauncher && currentId) {
    persist(true);
  }
  inLauncher = true;
  currentId = null;
  arm = null;
  render();
}

function removeRecent(id) {
  const list = getRecents().filter(x => x.id !== id);
  saveRecents(list);
  try { localStorage.removeItem(KEY_PROJ + id); } catch (e) {}
  render();
}

async function fOpen() {
  const r = await api.open();
  if (!r) return;
  if (!r.data || !r.data.cover) {
    st('⚠ El archivo no es un proyecto válido');
    alert('El archivo no es un proyecto válido de Punto G.');
    return;
  }
  const list = getRecents();
  const exist = list.find(x => x.path === r.path);
  currentId = exist ? exist.id : uid();
  S = norm({ ...blank(), ...r.data });
  filePath = r.path;
  inLauncher = false;
  tab = 'cover';
  cur = null;
  persist();
  render();
  st('Listo');
}

async function fSaveAs() {
  const p = await api.saveAs(JSON.stringify(S), S.cover.title || 'Mi guion');
  if (p) {
    filePath = p;
    persist();
    render();
  }
}

async function fSave() {
  if (!filePath) return fSaveAs();
  persist();
  render();
}

async function fPdf() {
  const t = tab;
  tab = 'dos';
  render();
  await new Promise(r => setTimeout(r, 200));
  const p = await api.pdf(S.cover.title || 'Proyecto');
  tab = t;
  render();
  st(p ? 'PDF exportado ✓' : '');
}

const g = p => p.split('.').reduce((o, k) => o == null ? o : o[k], S) || '';
function setP(p, v) {
  const k = p.split('.');
  let o = S;
  while (k.length > 1) {
    const n = k.shift();
    o = o[n] == null ? (o[n] = {}) : o[n];
  }
  o[k[0]] = v;
}

const f = (p, l, t, ph) => '<div class="fl">' + (t == 'ta' ? `<textarea rows="1" data-k="${p}" placeholder="${esc(ph || ' ')}">${esc(g(p))}</textarea>` : `<input data-k="${p}" value="${esc(g(p))}" placeholder="${esc(ph || ' ')}">`) + `<label>${l}</label></div>`;
const sel = (p, l, o) => `<div class="fl"><select data-k="${p}">${o.map(x => `<option${x == (g(p) || o[0]) ? ' selected' : ''}>${x}</option>`).join('')}</select><label>${l}</label></div>`;
const head = (t, s) => `<h1>${t}</h1><p class="sub">${s}</p>`;

const SECS = [
  ['hist', 'Historia', [['metac', 'Meta a corto plazo'], ['metal', 'Meta a largo plazo'], ['need', 'Necesidad real: lo que de verdad necesita'], ['cini', 'Creencias iniciales'], ['ccamb', 'Creencias cambiadas'], ['cambia', '¿Qué lo lleva a cambiar?'], ['prim', 'Primera aparición'], ['part', 'Participación en la trama'], ['conf', 'Conflicto'], ['moment', 'Momento más decisivo']]],
  ['info', 'Información personal', [['nreal', 'Nombre real'], ['fnac', 'Fecha de nacimiento'], ['lnac', 'Lugar de nacimiento'], ['etnia', 'Etnia/raza'], ['fam', 'Familia']]],
  ['fis', 'Fisonomía', [['altura', 'Altura'], ['peso', 'Peso'], ['cuerpo', 'Cuerpo'], ['piel', 'Color de piel'], ['estc', 'Estilo de cabello'], ['colc', 'Color de cabello'], ['forj', 'Forma de los ojos'], ['colo', 'Color de ojos'], ['rost', 'Forma del rostro'], ['dist', 'Característica distintiva'], ['facial', 'Otras características faciales'], ['postura', 'Postura'], ['fotro', 'Otra apariencia física']]],
  ['vida', 'Vida', [['habil', 'Habilidades'], ['hdes', '¿Cómo se desarrollaron las habilidades?'], ['incomp', 'Incompetencia'], ['fort', 'Fortaleza/talento'], ['debil', 'Debilidades'], ['hobby', 'Hobbies'], ['habit', 'Hábitos'], ['salud', 'Salud'], ['habla', 'Forma de hablar'], ['mascota', 'Mascota'], ['vest', 'Vestimenta'], ['carga', 'Algo que siempre carga consigo/armas/herramientas'], ['acces', 'Accesorios'], ['zona', 'Zona de residencia/entorno'], ['hogar', 'Descripción del hogar'], ['vecin', 'Vecindario'], ['org', 'Organización implicada'], ['ingr', 'Ingresos'], ['trab', 'Trabajo/ocupación'], ['rango', 'Rango/puesto de trabajo'], ['satis', 'Satisfacción con el empleo']]],
  ['act', 'Actitud', [['pers', 'Personalidad'], ['moral', 'Moral'], ['motiv', 'Motivación'], ['desal', 'Desalientos'], ['filos', 'Filosofía'], ['miedo', 'Mayor miedo'], ['autoc', 'Autocontrol'], ['intel', 'Nivel de inteligencia'], ['confz', 'Nivel de confianza']]],
  ['bio', 'Biografía', [['infan', 'Infancia'], ['evento', 'Evento pasado importante'], ['logro', 'Mejor logro'], ['otlog', 'Otros logros'], ['peor', 'Peor momento'], ['fallas', 'Fallas'], ['secre', 'Secretos'], ['mejmem', 'Mejores memorias'], ['peormem', 'Peores memorias']]],
  ['rel', 'Relaciones', [['r_al', 'Aliados y mentores'], ['r_an', 'Quién o qué se le opone'], ['r_am', 'Amor, familia y vínculos clave'], ['r_ds', 'Cómo trata a los desconocidos']]]
];

const HK = ['role', 'age', 'gender', 'one', 'long', 'dream'], ALL = HK.concat(...SECS.map(x => x[2].map(q => q[0])));
const fl = (c, k) => { const v = ((c.a || {})[k] || '').trim(); return !!v && v != 'Indefinido'; };
const pct = c => Math.round(100 * ALL.filter(k => fl(c, k)).length / ALL.length);
const secN = (c, k) => SECS.find(x => x[0] == k)[2].filter(q => fl(c, q[0])).length;

const TPL = {
  '3': ['Tres actos', ['#Acto I · Planteamiento', 'Imagen inicial', 'Presentación del protagonista y su mundo', 'Detonante', 'Primer punto de giro', '#Acto II · Confrontación', 'Obstáculos crecientes', 'Punto medio', 'Todo está perdido', 'Segundo punto de giro', '#Acto III · Resolución', 'Clímax', 'Desenlace']],
  's': ['Save the Cat', ['Imagen inicial', 'Tema planteado', 'Preparación', 'Catalizador', 'Debate', 'Paso al Acto II', 'Trama B', 'Diversión y juegos', 'Punto medio', 'Los malos se acercan', 'Todo está perdido', 'Noche oscura del alma', 'Paso al Acto III', 'Final', 'Imagen final']],
  'h': ['Viaje del héroe', ['Mundo ordinario', 'Llamada a la aventura', 'Rechazo de la llamada', 'Encuentro con el mentor', 'Cruce del umbral', 'Pruebas, aliados y enemigos', 'Acercamiento a la cueva más profunda', 'Calvario', 'Recompensa', 'El camino de vuelta', 'Resurrección', 'Regreso con el elixir']]
};

const TABS = [
  ['cover', 'Portada'],
  ['syn', 'Tagline y sinopsis'],
  ['str', 'Estructura'],
  ['chars', 'Personajes'],
  ['locs', 'Localizaciones'],
  ['board', 'Escaleta'],
  ['treat', 'Tratamiento'],
  ['script', 'Guion'],
  ['notes', 'Notas y versiones'],
  ['dos', 'Dossier'],
  ['file', 'Archivo'],
  ['config', 'Configuración']
];

const V = {
  cover: () => head('Portada', 'Los datos de tu proyecto. Aparecen en el dossier.') + f('cover.title', 'Título') + f('cover.author', 'Autor o autora') + f('cover.genre', 'Género y tono', '', 'Ej.: thriller psicológico, comedia negra') + f('cover.contact', 'Contacto', '', 'Correo o teléfono') + f('cover.date', 'Fecha o versión', '', 'Ej.: Borrador 1, octubre 2026'),
  syn: () => head('Tagline y sinopsis', 'El tagline vende la película en una frase. La sinopsis cuenta la historia completa, final incluido.') + f('tag', 'Tagline', '', 'Una frase corta y con gancho') + '<span class="mu" data-c="tag"></span>' + f('syn', 'Sinopsis', 'ta', 'Protagonista, conflicto, giro y final. Entre 150 y 300 palabras.') + '<span class="mu" data-c="syn" data-u="w"></span>',
  str: () => {
    const bs = TPL[S.tpl][1];
    return head('Estructura', 'Elige una plantilla y coloca los giros de tu historia en cada punto.') + '<div class="row">' + Object.entries(TPL).map(([k, v]) => `<button class="btn ${k == S.tpl ? '' : 'g'}" data-a="tpl" data-v="${k}">${v[0]}</button>`).join('') + '</div>' + bs.map((b, i) => b[0] == '#' ? `<h2>${b.slice(1)}</h2>` : f('beats.' + S.tpl + '-' + i, b, 'ta')).join('');
  },
  chars: () => {
    if (cur == null || cur >= S.chars.length) cur = S.chars.length ? 0 : null;
    const av = (c, i) => `<span class="av" data-av="${i}" style="background:${c.color}">${c.photo ? `<img src="${c.photo}" alt="">` : esc((c.name || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
    const side = '<div class="side">' + S.chars.map((c, i) => `<button class="ci${i == cur ? ' on' : ''}" data-a="pick" data-i="${i}">${av(c, i)}<span class="cn"><b data-nm="${i}">${esc(c.name || 'Sin nombre')}</b><span class="mu">${fl(c, 'role') ? esc(c.a.role) + ' · ' : ''}<span data-pg="${i}">${pct(c)}</span> %</span></span></button>`).join('') + '<button class="btn g" data-a="addc">+ Personaje</button></div>';
    const c = S.chars[cur], h = head('Personajes', 'Una ficha completa por personaje. Responde solo lo que necesites: cada sección se puede plegar.');
    if (!c) return h + `<div class="cl">${side}<p class="mu">Aún no hay personajes. Crea el primero con el botón de la izquierda.</p></div>`;
    const P = 'chars.' + cur + '.', ROLES = ['Indefinido', 'Protagonista', 'Antagonista', 'Secundario', 'Mentor', 'Aliado', 'Interés romántico', 'Figurante'], GEN = ['Indefinido', 'Mujer', 'Hombre', 'No binario', 'Otro'], RK = ['Amistad', 'Familia', 'Pareja', 'Aliado', 'Mentor', 'Rival', 'Enemigo', 'Otro'];
    const sec = (k, t, body, n) => `<details class="card sec" data-sec="${k}"${(k == 'leg' ? op[k] === true : op[k] !== false) ? ' open' : ''}><summary><span>${t}</span>${n ? `<span class="mu" data-cn="${k}">${secN(c, k)} de ${n}</span>` : ''}</summary>${body}</details>`;
    const oth = S.chars.filter(x => x != c), by = oth.filter(x => x.rel.some(r => r.to == c.id)).map(x => esc(x.name || 'Sin nombre') + ' (' + esc(x.rel.find(r => r.to == c.id).kind) + ')');
    const relB = oth.length ? c.rel.map((r, k) => `<div class="rr"><div class="fl"><select data-k="${P}rel.${k}.to"><option value="">Elegir personaje…</option>${oth.map(o => `<option value="${o.id}"${o.id == r.to ? ' selected' : ''}>${esc(o.name || 'Sin nombre')}</option>`).join('')}</select><label>Relación con</label></div>${sel(P + 'rel.' + k + '.kind', 'Tipo', RK)}${f(P + 'rel.' + k + '.note', 'Cómo es esta relación')}<button class="btn g" data-a="delr" data-i="${k}">✕</button></div>`).join('') + '<p><button class="btn g" data-a="addr">+ Relación con otro personaje</button></p>' + (by.length ? `<p class="mu">También aparece en las relaciones de: ${by.join(', ')}</p>` : '') : '<p class="mu">Crea otro personaje para poder relacionarlos entre sí.</p>';
    const ph = `<div class="ph">${c.photo ? `<img src="${c.photo}" alt="">` : '<svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>'}<button class="btn g sm" data-a="addph">${c.photo ? 'Cambiar foto' : 'Añadir fotografía +'}</button>${c.photo ? '<button class="btn g sm" data-a="delph">Quitar</button>' : ''}<input type="file" id="pf" accept="image/*" hidden></div>`;
    const top = `<div class="card"><div class="hg"><div><div class="fl"><input data-k="${P}name" value="${esc(c.name)}" placeholder=" "><label>Nombre</label><input type="color" class="cdot" data-k="${P}color" value="${c.color}" title="Color del personaje"></div><div class="trio">${sel(P + 'a.role', 'Rol en la historia', ROLES)}${f(P + 'a.age', 'Edad')}${sel(P + 'a.gender', 'Género', GEN)}</div>${f(P + 'a.one', 'Descripción en una línea')}${f(P + 'a.long', 'Descripción extensa', 'ta')}${f(P + 'a.dream', 'Dreamcast', 'ta', 'Actores o actrices que lo interpretarían')}</div>${ph}</div></div>`;
    const body = SECS.map(x => sec(x[0], x[1], (x[0] == 'rel' ? relB : '') + x[2].map(q => f(P + 'a.' + q[0], q[1], 'ta')).join(''), x[2].length)).join('');
    const nav = '<div class="row jn">' + SECS.map(x => `<button class="btn g sm" data-a="jump" data-v="${x[0]}">${x[1]}</button>`).join('') + '</div>';
    return h + `<div class="cl">${side}<div>${nav}<p class="mu">Ficha completa al <span data-pg="${cur}">${pct(c)}</span> %</p>${top}${body}${c.a.legacy ? sec('leg', 'Notas del formato anterior', f(P + 'a.legacy', 'Notas migradas', 'ta'), 0) : ''}<p><button class="btn g" data-a="delc">Eliminar personaje</button></p></div></div>`;
  },
  locs: () => head('Localizaciones', 'Una ficha por lugar. Sus nombres salen como sugerencias al escribir los encabezados de la escaleta.') + S.locs.map((l, i) => `<div class="card"><div class="row"><select data-k="locs.${i}.kind" style="width:auto">${['INT.', 'EXT.', 'INT./EXT.'].map(o => `<option${o == l.kind ? ' selected' : ''}>${o}</option>`).join('')}</select><input data-k="locs.${i}.name" value="${esc(l.name)}" placeholder="Nombre del lugar" style="flex:1"><button class="btn g" data-a="dell" data-i="${i}">✕</button></div>` + f(`locs.${i}.desc`, 'Descripción y atmósfera', 'ta') + f(`locs.${i}.note`, 'Notas de producción o escenas donde aparece', 'ta') + '</div>').join('') + '<button class="btn" data-a="addl">+ Localización</button>',
  board: () => head('Escaleta', `${S.scenes.length} escenas. Arrastra el asa o usa las flechas para reordenar.`) + `<datalist id="dl">${S.locs.filter(l => l.name).map(l => `<option value="${esc((l.kind + ' ' + l.name).toUpperCase())}">`).join('')}</datalist>` + S.scenes.map((s, i) => `<div class="card sc" data-i="${i}"><span class="hd" draggable="true" data-dr="${i}" title="Arrastrar">⠿ ${i + 1}</span><div><input list="dl" data-k="scenes.${i}.head" value="${esc(s.head)}" placeholder="INT. CAFÉ – DÍA"><textarea data-k="scenes.${i}.sum" placeholder="¿Qué ocurre y qué cambia en la escena?" style="margin-top:6px">${esc(s.sum)}</textarea></div><div class="col"><button class="btn g" data-a="up" data-i="${i}">↑</button><button class="btn g" data-a="dn" data-i="${i}">↓</button><button class="btn g" data-a="dels" data-i="${i}">✕</button></div></div>`).join('') + '<button class="btn" data-a="adds">+ Escena</button>',
  treat: () => head('Tratamiento', 'La historia completa en prosa y en presente, de principio a fin, final incluido. Poco diálogo: cuenta lo que se ve y se siente.') + f('treat', 'Tratamiento', 'ta', 'Empieza aquí…').replace('<textarea', '<textarea style="min-height:60vh"') + '<p class="row"><span class="mu" data-c="treat" data-u="w"></span><button class="btn g" data-a="skel">Añadir la escaleta como esqueleto</button></p>',
  script: () => renderScriptView(),
  notes: () => head('Notas y versiones', 'Ideas sueltas y copias del proyecto para poder volver atrás.') + '<h2>Notas</h2>' + S.notes.map((n, i) => `<div class="card"><div class="row"><input data-k="notes.${i}.t" value="${esc(n.t)}" placeholder="Título de la nota" style="flex:1"><button class="btn g" data-a="deln" data-i="${i}">✕</button></div><textarea data-k="notes.${i}.b" placeholder="Escribe aquí…" style="margin-top:8px">${esc(n.b)}</textarea></div>`).join('') + '<button class="btn" data-a="addn">+ Nota</button><h2>Versiones</h2><div class="row" style="margin-bottom:12px"><input id="vl" placeholder="Nombre, p. ej. Primer borrador" style="flex:1"><button class="btn" data-a="sv">Guardar versión</button></div>' + S.vers.map((v, i) => `<div class="card row"><div style="flex:1"><b>${esc(v.l)}</b><br><span class="mu">${esc(v.d)}</span></div><button class="btn g" data-a="rv" data-i="${i}">Restaurar</button><button class="btn g" data-a="delv" data-i="${i}">✕</button></div>`).join(''),
  dos: () => {
    const c = S.cover, P = s => `<p class="pre">${esc(s)}</p>`, L = S.locs.filter(l => l.name);
    return '<div class="np row" style="justify-content:space-between"><div><h1>Dossier</h1><p class="sub">Todo el proyecto en una vista, listo para exportar como PDF.</p></div><button class="btn" data-a="pr">Exportar PDF…</button></div>' + `<section class="dc"><div class="big">${esc(c.title || 'Sin título')}</div>` + [c.genre, c.author, c.contact, c.date].filter(Boolean).map(x => `<div class="mu">${esc(x)}</div>`).join('') + '</section>'
      + (S.tag ? `<p class="tag">«${esc(S.tag)}»</p>` : '') + (S.syn ? '<h2>Sinopsis</h2>' + P(S.syn) : '')
      + (S.chars.length ? '<h2>Personajes</h2>' + S.chars.map(ch => {
        const a = ch.a || {}, q = (k, l) => fl(ch, k) ? `<p><b>${l}</b><br>${esc(a[k])}</p>` : '', nm = id => { const o = S.chars.find(x => x.id == id); return o ? esc(o.name || 'Sin nombre') : ''; }, rs = (ch.rel || []).filter(r => nm(r.to));
        return `<div class="card">${ch.photo ? `<img class="dph" src="${ch.photo}" alt="">` : ''}<h3>${esc(ch.name || 'Sin nombre')}</h3><p class="mu">${[a.role, a.age && 'Edad ' + a.age, a.gender].filter(x => x && x != 'Indefinido').map(esc).join(' · ')}</p>` + [['one', 'En una línea'], ['long', 'Descripción'], ['dream', 'Dreamcast']].map(x => q(x[0], x[1])).join('') + SECS.map(x => { const b = x[2].map(z => q(z[0], z[1])).join(''); return b ? `<h4>${x[1]}</h4>` + b : ''; }).join('') + (rs.length ? '<h4>Relaciones con otros personajes</h4>' + rs.map(r => `<p><b>${nm(r.to)}</b> · ${esc(r.kind)}${r.note ? '<br>' + esc(r.note) : ''}</p>`).join('') : '') + q('legacy', 'Notas del formato anterior') + '</div>';
      }).join('') : '')
      + (L.length ? '<h2>Localizaciones</h2>' + L.map(l => `<p><b>${esc(l.kind + ' ' + l.name)}</b><br>${esc(l.desc)}</p>`).join('') : '')
      + (S.scenes.length ? '<h2>Escaleta</h2><ol>' + S.scenes.map(s => `<li><b>${esc(s.head)}</b> ${esc(s.sum)}</li>`).join('') + '</ol>' : '')
      + (S.treat ? '<h2>Tratamiento</h2>' + P(S.treat) : '');
  },
  file: () => head('Archivo', 'Tu proyecto se guarda como un archivo .guion en tu ordenador. Mientras tenga archivo asignado, los cambios se guardan solos.') +
    `<div class="card"><b>Archivo actual</b><br><span class="mu">${esc(filePath || 'Aún sin archivo: es un borrador local. Guárdalo para no perderlo.')}</span></div>` +
    `<div class="row" style="margin-bottom:16px"><button class="btn" data-a="fsave">Guardar</button><button class="btn g" data-a="fsaveas">Guardar como…</button><button class="btn g" data-a="fopen">Abrir…</button><button class="btn g" data-a="newproj">Proyecto nuevo</button><button class="btn g" data-a="gohome">← Volver a Mis Proyectos</button></div>` +
    `<h2>Exportar</h2><p class="sub">Exporta tu guion en formato estándar de la industria (con portada) o genera el dossier completo del proyecto.</p>` +
    `<div class="row" style="margin-bottom:24px"><button class="btn" data-a="exportscriptpdf">Exportar Guion en PDF…</button><button class="btn g" data-a="pr">Exportar Dossier completo en PDF…</button></div>` +
    `<h2>Configuración</h2>` +
    `<div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;gap:20px">
      <div style="flex:1">
        <b style="font-size:15px;display:block;margin-bottom:4px">Recuadro de enfoque en el guion</b>
        <span class="mu" style="font-size:13px;line-height:1.4;display:block">
          Activa o desactiva el recuadro que rodea la línea activa y la etiqueta del bloque al escribir en el guion.
        </span>
      </div>
      <label class="switch" title="Activar / Desactivar recuadro">
        <input type="checkbox" ${CFG.scriptFocusBox ? 'checked' : ''} data-a="togglefocusbox">
        <span class="slider"></span>
      </label>
    </div>`,
  config: () => head('Configuración', 'Opciones generales y preferencias visuales de la aplicación.') +
    `<div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:18px 20px;gap:20px">
      <div style="flex:1">
        <b style="font-size:16px;display:block;margin-bottom:4px">Recuadro de enfoque en el guion</b>
        <span class="mu" style="font-size:14px;line-height:1.4;display:block">
          Muestra un recuadro sombreado sobre la línea activa y la etiqueta del tipo de bloque (ESCENA, ACCIÓN, PERSONAJE...) mientras escribes. Si lo desactivas, la hoja se ve completamente limpia como en una máquina de escribir.
        </span>
      </div>
      <label class="switch" title="Activar / Desactivar recuadro">
        <input type="checkbox" id="cfg-focusbox" ${CFG.scriptFocusBox ? 'checked' : ''} data-a="togglefocusbox">
        <span class="slider"></span>
      </label>
    </div>`
};

function renderLauncher() {
  const list = getRecents();
  let cardsHtml = '';
  if (list.length) {
    cardsHtml = '<div class="pc-list">' + list.map(item => {
      const isSaved = !!item.path;
      const badge = isSaved ? '<span class="pc-badge saved">Archivo .guion</span>' : '<span class="pc-badge">Borrador local</span>';
      const metaParts = [];
      if (item.author) metaParts.push('Por ' + esc(item.author));
      if (item.genre) metaParts.push(esc(item.genre));
      if (item.scenes) metaParts.push(item.scenes + ' ' + (item.scenes === 1 ? 'escena' : 'escenas'));
      if (item.chars) metaParts.push(item.chars + ' ' + (item.chars === 1 ? 'personaje' : 'personajes'));
      const metaLine = metaParts.length ? `<div class="pc-meta">${metaParts.join(' · ')}</div>` : '';
      const dateTxt = 'Modificado ' + timeAgo(item.updatedAt);
      const pathTxt = item.path ? `<span class="pc-path" title="${esc(item.path)}">📄 ${esc(item.path)}</span>` : '<span class="pc-path">📝 Guardado en este equipo</span>';
      const searchTerms = esc(((item.title || '') + ' ' + (item.genre || '') + ' ' + (item.author || '')).toLowerCase());

      return `<div class="pc-card" data-a="openproj" data-id="${esc(item.id)}" data-search="${searchTerms}">
        <div class="pc-top">
          <h2 class="pc-title">${esc(item.title || 'Proyecto sin título')}</h2>
          ${badge}
        </div>
        ${metaLine}
        <div class="pc-bot">
          <span>${dateTxt} · ${pathTxt}</span>
          <div class="pc-btns">
            <button class="btn sm" data-a="openproj" data-id="${esc(item.id)}">Abrir</button>
            ${item.path ? `<button class="btn g sm" data-a="showfolder" data-path="${esc(item.path)}" title="Ver archivo en el Explorador">Carpeta</button>` : ''}
            <button class="btn g sm" data-a="delproj" data-id="${esc(item.id)}" title="Quitar de la lista">✕ Quitar</button>
          </div>
        </div>
      </div>`;
    }).join('') + '<p id="no-search-results" class="mu" style="display:none;text-align:center;padding:36px">No se encontraron proyectos con ese texto.</p></div>';
  } else {
    cardsHtml = `<div class="l-empty">
      <h2>¡Bienvenido a Punto G!</h2>
      <p>Crea tu primer guion o abre un proyecto existente desde tu ordenador.</p>
      <button class="btn" data-a="newproj"><strong>+ Crear mi primer proyecto</strong></button>
    </div>`;
  }

  const searchHtml = list.length > 2 ? `<div class="l-search"><input type="search" id="search-proj" placeholder="Buscar proyecto por título, género o autor…"></div>` : '';

  return `<div class="launcher">
    <div class="l-head">
      <div>
        <h1>Mis Proyectos</h1>
        <p class="sub" style="margin:0">Elige un proyecto para continuar escribiendo o empieza uno nuevo.</p>
      </div>
      <div class="l-actions">
        <button class="btn" data-a="newproj"><strong>+ Nuevo proyecto</strong></button>
        <button class="btn g" data-a="fopen">📂 Abrir archivo…</button>
      </div>
    </div>
    ${searchHtml}
    ${cardsHtml}
  </div>`;
}

const SCRIPT_TYPES = [
  ['scene', 'Escena', '🎬'],
  ['action', 'Acción', '📝'],
  ['character', 'Personaje', '👤'],
  ['dialogue', 'Diálogo', '💬'],
  ['parenthetical', 'Acotación', '( )'],
  ['transition', 'Transición', '➡']
];

function formatParenthetical(str) {
  let s = (str || '').trim();
  if (!s) return '';
  if (!s.startsWith('(')) s = '(' + s;
  if (!s.endsWith(')')) s = s + ')';
  return s;
}

function getPlaceholderForType(type) {
  if (type === 'scene') return 'INT. / EXT. LUGAR - DÍA/NOCHE';
  if (type === 'character') return 'PERSONAJE (EN MAYÚSCULAS)';
  if (type === 'dialogue') return 'Escribe el diálogo aquí…';
  if (type === 'parenthetical') return '(acotación)';
  if (type === 'transition') return 'CORTE A:';
  return 'Descripción de la acción…';
}

function getScriptStats() {
  const blocks = S.script || [];
  const scenes = blocks.filter(b => b.type === 'scene').length;
  let totalWords = 0;
  let lines = 0;
  blocks.forEach(b => {
    const t = (b.text || '').trim();
    if (t) totalWords += t.split(/\s+/).length;
    const textLen = (b.text || '').length;
    const perLine = b.type === 'dialogue' ? 35 : (b.type === 'character' || b.type === 'parenthetical' ? 25 : 60);
    lines += Math.max(1, Math.ceil(textLen / perLine));
    if (b.type === 'scene') lines += 2;
    else if (b.type === 'character') lines += 1;
    else if (b.type === 'dialogue') lines += 1;
  });
  const pages = Math.max(1, Math.ceil(lines / 54));
  return { scenes, words: totalWords, pages };
}

function renderRefContent() {
  if (scriptRefTab === 'chars') {
    if (!S.chars || !S.chars.length) return '<p class="mu">Aún no hay personajes en este proyecto.</p>';
    return S.chars.map(c => `
      <div class="card" style="font-size:13px">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <span class="av" style="background:${c.color};width:26px;height:26px;font-size:12px">${c.photo ? `<img src="${c.photo}">` : esc((c.name || '?').charAt(0).toUpperCase())}</span>
          <b>${esc(c.name || 'Sin nombre')}</b>
          <span class="mu" style="font-size:12px">${esc(c.a?.role || '')}</span>
        </div>
        ${c.a?.one ? `<p style="margin:4px 0"><b>En una línea:</b> ${esc(c.a.one)}</p>` : ''}
        ${c.a?.pers ? `<p style="margin:4px 0"><b>Personalidad:</b> ${esc(c.a.pers)}</p>` : ''}
        ${c.a?.habla ? `<p style="margin:4px 0"><b>Forma de hablar:</b> ${esc(c.a.habla)}</p>` : ''}
        ${c.a?.need ? `<p style="margin:4px 0"><b>Necesidad:</b> ${esc(c.a.need)}</p>` : ''}
      </div>
    `).join('');
  }
  if (scriptRefTab === 'board') {
    if (!S.scenes || !S.scenes.length) return '<p class="mu">Aún no hay escenas en la escaleta.</p>';
    return S.scenes.map((s, i) => `
      <div class="card" style="font-size:13px">
        <b>${i + 1}. ${esc(s.head || 'Sin encabezado')}</b>
        <p style="margin:4px 0 0" class="mu">${esc(s.sum || '')}</p>
      </div>
    `).join('');
  }
  if (scriptRefTab === 'treat') {
    if (!S.treat) return '<p class="mu">No hay texto en el tratamiento todavía.</p>';
    return `<div class="card pre" style="font-size:13px;white-space:pre-wrap">${esc(S.treat)}</div>`;
  }
  if (scriptRefTab === 'str') {
    const bs = TPL[S.tpl][1];
    return bs.map((b, i) => b[0] == '#' ? `<h4 style="font-size:14px;margin:12px 0 4px;color:var(--ac)">${esc(b.slice(1))}</h4>` : `
      <div class="card" style="font-size:13px">
        <b>${esc(b)}</b>
        <p style="margin:4px 0 0" class="mu">${esc(S.beats[S.tpl + '-' + i] || 'Sin definir')}</p>
      </div>
    `).join('');
  }
  if (scriptRefTab === 'locs') {
    if (!S.locs || !S.locs.length) return '<p class="mu">No hay localizaciones creadas.</p>';
    return S.locs.map(l => `
      <div class="card" style="font-size:13px">
        <b>${esc(l.kind + ' ' + l.name)}</b>
        ${l.desc ? `<p style="margin:4px 0 0" class="mu">${esc(l.desc)}</p>` : ''}
      </div>
    `).join('');
  }
  if (scriptRefTab === 'notes') {
    if (!S.notes || !S.notes.length) return '<p class="mu">No hay notas creadas.</p>';
    return S.notes.map(n => `
      <div class="card" style="font-size:13px">
        <b>${esc(n.t || 'Nota')}</b>
        <p style="margin:4px 0 0;white-space:pre-wrap" class="mu">${esc(n.b || '')}</p>
      </div>
    `).join('');
  }
  if (scriptRefTab === 'syn') {
    return `
      <div class="card" style="font-size:13px">
        <b>Tagline:</b>
        <p class="mu" style="font-style:italic;margin:4px 0 8px">«${esc(S.tag || 'Sin tagline')}»</p>
        <b>Sinopsis:</b>
        <p class="mu" style="white-space:pre-wrap;margin:4px 0 0">${esc(S.syn || 'Sin sinopsis')}</p>
      </div>
    `;
  }
  return '';
}

function renderScriptView() {
  if (!S.script || !S.script.length) {
    S.script = [{ id: uid(), type: 'scene', text: '' }];
  }
  const stats = getScriptStats();
  const activeBlock = S.script[curScriptBlock] || S.script[0];
  const activeType = activeBlock ? activeBlock.type : 'action';

  const pillsHtml = SCRIPT_TYPES.map(st => `
    <button class="${st[0] === activeType ? 'on' : ''}" data-a="setscripttype" data-type="${st[0]}" title="Formatear como ${st[1]} (Tab / Ctrl+1..6)">
      ${st[2]} ${st[1]}
    </button>
  `).join('');

  const blocksHtml = S.script.map((b, i) => {
    let val = b.text || '';
    if (b.type === 'character') val = val.toUpperCase();
    else if (b.type === 'parenthetical' && val.trim()) val = formatParenthetical(val);
    return `
    <div class="sb-block sb-${b.type}" data-i="${i}" data-type="${b.type}">
      <textarea data-si="${i}" placeholder="${getPlaceholderForType(b.type)}" rows="1">${esc(val)}</textarea>
      <span class="sb-badge">${b.type}</span>
    </div>`;
  }).join('');

  const refHtml = `
    <div class="ref-pane">
      <div class="ref-head">
        <b>Panel de referencia</b>
        <select class="ref-select" data-a="pickref">
          <option value="chars"${scriptRefTab === 'chars' ? ' selected' : ''}>👤 Personajes (${(S.chars || []).length})</option>
          <option value="board"${scriptRefTab === 'board' ? ' selected' : ''}>🎞 Escaleta (${(S.scenes || []).length})</option>
          <option value="treat"${scriptRefTab === 'treat' ? ' selected' : ''}>📖 Tratamiento</option>
          <option value="str"${scriptRefTab === 'str' ? ' selected' : ''}>📐 Estructura</option>
          <option value="locs"${scriptRefTab === 'locs' ? ' selected' : ''}>📍 Lugares (${(S.locs || []).length})</option>
          <option value="notes"${scriptRefTab === 'notes' ? ' selected' : ''}>💡 Notas (${(S.notes || []).length})</option>
          <option value="syn"${scriptRefTab === 'syn' ? ' selected' : ''}>📌 Sinopsis</option>
        </select>
      </div>
      <div class="ref-body">${renderRefContent()}</div>
    </div>
  `;

  const statsTxt = `~${stats.pages} pág · ${stats.scenes} escenas · ${stats.words} palabras`;
  const fsStats = $('#fs-stats');
  if (fsStats) fsStats.textContent = statsTxt;

  return `
    <div class="script-wrap">
      <div class="script-toolbar">
        <div class="format-pills">
          ${pillsHtml}
        </div>
        <div class="script-tools-right">
          <div class="script-stats">
            <span>${statsTxt}</span>
          </div>
          ${S.scenes && S.scenes.length && S.script.length <= 1 && !S.script[0].text ? `<button class="btn g sm" data-a="importescaleta" title="Importar escenas de la escaleta">+ Importar escaleta</button>` : ''}
          <button class="btn ${scriptSplit ? '' : 'g'} sm" data-a="togglesplit" title="Mostrar u ocultar panel de referencias lateral">
            ${scriptSplit ? '✕ Cerrar panel' : '◫ Panel de referencias'}
          </button>
          <button class="btn g sm" data-a="togglescriptfs" title="Escribir a pantalla completa sin distracciones">
            ⛶ Pantalla completa
          </button>
          <button class="btn sm" data-a="exportscriptpdf" title="Exportar guion en PDF">
            📄 Exportar PDF
          </button>
        </div>
      </div>
      <div class="script-split-wrap${scriptSplit ? '' : ' no-split'}">
        <div class="script-page">
          ${blocksHtml}
        </div>
        ${scriptSplit ? refHtml : ''}
      </div>
    </div>
  `;
}

function setScriptBlockType(i, type) {
  if (!S.script[i]) return;
  if (type === 'character' && S.script[i].text) {
    S.script[i].text = S.script[i].text.toUpperCase();
  } else if (type === 'parenthetical' && S.script[i].text.trim()) {
    S.script[i].text = formatParenthetical(S.script[i].text);
  }
  S.script[i].type = type;
  curScriptBlock = i;
  save();
  const blockEl = M.querySelector(`.sb-block[data-i="${i}"]`);
  if (blockEl) {
    blockEl.className = `sb-block sb-${type}`;
    blockEl.dataset.type = type;
    const badge = blockEl.querySelector('.sb-badge');
    if (badge) badge.textContent = type;
    const ta = blockEl.querySelector('textarea');
    if (ta) {
      ta.value = S.script[i].text;
      ta.placeholder = getPlaceholderForType(type);
    }
    document.querySelectorAll('.format-pills button').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.type === type);
    });
  } else {
    render();
    focusScriptBlock(i);
  }
}

function focusScriptBlock(idx, pos) {
  setTimeout(() => {
    const ta = M.querySelector(`textarea[data-si="${idx}"]`);
    if (ta) {
      ta.focus();
      if (typeof pos === 'number') {
        ta.selectionStart = ta.selectionEnd = Math.min(pos, ta.value.length);
      }
    }
  }, 10);
}

function toggleScriptFs() {
  isScriptFs = !isScriptFs;
  document.body.classList.toggle('is-script-fullscreen', isScriptFs);
  const fsBar = $('#fs-bar');
  if (fsBar) fsBar.style.display = isScriptFs ? 'inline-flex' : 'none';
  if (isScriptFs) {
    const stats = getScriptStats();
    const fsStats = $('#fs-stats');
    if (fsStats) fsStats.textContent = `~${stats.pages} pág · ${stats.scenes} escenas · ${stats.words} palabras`;
  }
}

function importEscaletaToScript() {
  if (!S.scenes || !S.scenes.length) {
    alert('No hay escenas en la escaleta para importar.');
    return;
  }
  if (S.script && S.script.length > 1 && !confirm('¿Añadir las escenas de la escaleta al guion?')) {
    return;
  }
  const newBlocks = [];
  S.scenes.forEach(s => {
    if (s.head) newBlocks.push({ id: uid(), type: 'scene', text: s.head.toUpperCase() });
    if (s.sum) newBlocks.push({ id: uid(), type: 'action', text: s.sum });
  });
  if (newBlocks.length) {
    if (S.script.length === 1 && !S.script[0].text) {
      S.script = newBlocks;
    } else {
      S.script = S.script.concat(newBlocks);
    }
    save();
    render();
    st('Escaleta importada al guion ✓');
  }
}

async function fPdfScript() {
  const title = S.cover.title || 'Guion';
  const author = S.cover.author || '';
  const contact = S.cover.contact || '';
  const date = S.cover.date || '';

  const titlePageHtml = `
    <div class="script-title-page" style="page-break-after:always;min-height:92vh;display:flex;flex-direction:column;justify-content:space-between;text-align:center;font-family:'Courier Prime',Courier,monospace;font-size:12pt;font-weight:normal;line-height:1.4;padding:140px 50px 60px;box-sizing:border-box">
      <div></div>
      <div>
        <div style="font-size:12pt;font-weight:normal;letter-spacing:1px;text-transform:uppercase;margin:0 0 24px;color:#000">${esc(title)}</div>
        ${author ? `<div style="font-size:12pt;font-weight:normal;margin:0 0 12px;color:#000">por</div><div style="font-size:12pt;font-weight:normal;margin:0;color:#000">${esc(author)}</div>` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;text-align:left;font-size:12pt;font-weight:normal;color:#000;padding:0 10px">
        <div>${esc(contact).replace(/\n/g, '<br>')}</div>
        <div style="text-align:right">${esc(date)}</div>
      </div>
    </div>
  `;

  const scriptBodyHtml = (S.script || []).map(b => {
    const text = esc(b.text || '');
    if (b.type === 'scene') return `<div style="font-weight:normal;text-transform:uppercase;margin-top:24px;margin-bottom:8px;page-break-after:avoid">${esc(b.text.toUpperCase())}</div>`;
    if (b.type === 'character') return `<div style="font-weight:normal;text-transform:uppercase;margin-left:37%;width:40%;margin-top:14px;margin-bottom:0;page-break-after:avoid">${esc(b.text.toUpperCase())}</div>`;
    if (b.type === 'parenthetical') return `<div style="font-weight:normal;margin-left:30%;width:35%;margin-bottom:0;page-break-after:avoid">${esc(formatParenthetical(b.text))}</div>`;
    if (b.type === 'dialogue') return `<div style="font-weight:normal;margin-left:20%;width:55%;margin-bottom:14px">${text}</div>`;
    if (b.type === 'transition') return `<div style="font-weight:normal;text-align:right;margin-left:auto;width:40%;text-transform:uppercase;margin-top:16px;margin-bottom:16px">${esc(b.text.toUpperCase())}</div>`;
    return `<div style="font-weight:normal;margin-bottom:12px">${text}</div>`;
  }).join('');

  const oldContent = M.innerHTML;
  const oldClass = M.className;
  document.body.classList.add('printing-script');
  M.innerHTML = `<div class="script-print-container" style="font-family:'Courier Prime',Courier,monospace;font-size:12pt;line-height:1.2;font-weight:normal;color:#000;background:#fff">${titlePageHtml}<div style="padding:40px 30px">${scriptBodyHtml}</div></div>`;

  st('Generando PDF del guion…');
  await new Promise(r => setTimeout(r, 250));
  const p = await api.pdf(title, 'guion');

  document.body.classList.remove('printing-script');
  M.className = oldClass;
  M.innerHTML = oldContent;
  st(p ? 'PDF del guion exportado ✓' : '');
}

function cc() {
  const c = S.chars[cur];
  if (!c) return;
  M.querySelectorAll('[data-nm]').forEach(e => e.textContent = S.chars[e.dataset.nm].name || 'Sin nombre');
  M.querySelectorAll('[data-av]').forEach(e => e.style.background = S.chars[e.dataset.av].color);
  M.querySelectorAll('[data-pg]').forEach(e => e.textContent = pct(S.chars[e.dataset.pg]));
  M.querySelectorAll('[data-cn]').forEach(e => e.textContent = secN(c, e.dataset.cn) + ' de ' + SECS.find(x => x[0] == e.dataset.cn)[2].length);
}

function cnt() {
  document.querySelectorAll('[data-c]').forEach(e => {
    const v = g(e.dataset.c);
    e.textContent = e.dataset.u == 'w' ? wc(v) + ' palabras' : v.length + ' caracteres';
  });
}

function render() {
  const btnHome = $('#btn-back');
  const nav = $('#nav');
  if (inLauncher) {
    if (btnHome) btnHome.style.display = 'none';
    if (nav) nav.innerHTML = '';
    $('#ttl').textContent = '';
    document.title = 'Punto G — Mis Proyectos';
    const rec = getRecents();
    st(rec.length ? `${rec.length} proyecto${rec.length === 1 ? '' : 's'}` : '');
    M.className = 'launcher-view';
    M.innerHTML = renderLauncher();
    const si = $('#search-proj');
    if (si) {
      si.addEventListener('input', e => {
        const q = e.target.value.toLowerCase().trim();
        let vis = 0;
        M.querySelectorAll('.pc-card').forEach(card => {
          const match = !q || (card.dataset.search || '').includes(q);
          card.style.display = match ? '' : 'none';
          if (match) vis++;
        });
        const noRes = $('#no-search-results');
        if (noRes) noRes.style.display = (vis === 0 && q) ? 'block' : 'none';
      });
    }
    return;
  }

  if (btnHome) btnHome.style.display = 'inline-flex';
  if (nav) nav.innerHTML = TABS.map(t => `<button class="${t[0] == tab ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('');
  M.className = tab == 'script' ? ('script' + (scriptSplit ? '' : ' no-split')) : tab;
  M.innerHTML = V[tab]();
  setTtl();
  cnt();
}

function mv(a, b) {
  if (b < 0 || b >= S.scenes.length || a == b) return;
  const x = S.scenes.splice(a, 1)[0];
  S.scenes.splice(b, 0, x);
  save();
  render();
}

function snap(l) {
  S.vers.unshift({ l, d: new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }), s: JSON.stringify({ ...S, vers: [] }) });
  S.vers = S.vers.slice(0, 20);
}

const A = {
  gohome() { goHome(); return false; },
  newproj() { createNewProject(); return false; },
  delproj(i, t) {
    const id = t.dataset.id;
    if (id) removeRecent(id);
    return false;
  },
  showfolder(i, t) {
    if (t.dataset.path) api.showInFolder(t.dataset.path);
    return false;
  },
  openproj(i, t) {
    const id = t.dataset.id;
    if (id) openRecent(id);
    return false;
  },
  addc() { S.chars.push({ id: uid(), v: 2, name: '', a: {}, rel: [], color: PAL[S.chars.length % PAL.length] }); cur = S.chars.length - 1; },
  pick(i) { cur = i; },
  delc() {
    const id = S.chars[cur].id;
    S.chars.splice(cur, 1);
    S.chars.forEach(x => x.rel = (x.rel || []).filter(r => r.to != id));
    cur = null;
  },
  addr() { S.chars[cur].rel.push({ to: '', kind: 'Amistad', note: '' }); },
  delr(i) { S.chars[cur].rel.splice(i, 1); },
  addph() { $('#pf').click(); return false; },
  delph() { S.chars[cur].photo = ''; },
  jump(i, t) {
    const d = M.querySelector('[data-sec="' + t.dataset.v + '"]');
    if (d) {
      d.open = true;
      op[t.dataset.v] = true;
      d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return false;
  },
  addl() { S.locs.push({ kind: 'INT.', name: '', desc: '', note: '' }); },
  dell(i) { S.locs.splice(i, 1); },
  adds() { S.scenes.push({ head: '', sum: '' }); },
  dels(i) { S.scenes.splice(i, 1); },
  up(i) { mv(i, i - 1); },
  dn(i) { mv(i, i + 1); },
  addn() { S.notes.push({ t: '', b: '' }); },
  deln(i) { S.notes.splice(i, 1); },
  sv() { snap($('#vl').value || 'Versión sin nombre'); },
  delv(i) { S.vers.splice(i, 1); },
  rv(i) {
    const v = S.vers[i];
    snap('Antes de restaurar');
    S = norm({ ...blank(), ...JSON.parse(v.s), vers: S.vers });
    cur = null;
  },
  tpl(i, t) { S.tpl = t.dataset.v; },
  skel() {
    S.treat += (S.treat ? '\n\n' : '') + S.scenes.map((s, i) => `${i + 1}. ${s.head || ''}${s.sum ? ': ' + s.sum : ''}`).join('\n\n');
  },
  fopen() { fOpen(); return false; },
  fsave() { fSave(); return false; },
  fsaveas() { fSaveAs(); return false; },
  pr() { fPdf(); return false; },
  togglesplit() { scriptSplit = !scriptSplit; render(); return false; },
  togglescriptfs() { toggleScriptFs(); return false; },
  exportscriptpdf() { fPdfScript(); return false; },
  importescaleta() { importEscaletaToScript(); return false; },
  setscripttype(i, t) { setScriptBlockType(curScriptBlock, t.dataset.type); return false; },
  togglefocusbox(i, t) {
    CFG.scriptFocusBox = t.checked;
    applyConfig();
    return false;
  }
};

api.onMenu(c => {
  if (c == 'home') goHome();
  else if (c == 'new') createNewProject();
  else if (c == 'open') fOpen();
  else if (c == 'save' && !inLauncher) fSave();
  else if (c == 'saveas' && !inLauncher) fSaveAs();
  else if (c == 'pdf' && !inLauncher) fPdf();
  else if (c == 'pdf-script' && !inLauncher) fPdfScript();
  else if (c == 'config') {
    inLauncher = false;
    tab = 'config';
    render();
  }
});

document.addEventListener('click', e => {
  const t = e.target.closest('[data-t],[data-a],.pc-card');
  if (!t) return;

  if (t.classList.contains('pc-card') && !e.target.closest('button')) {
    const id = t.dataset.id;
    if (id) openRecent(id);
    return;
  }

  if (t.dataset.t) {
    tab = t.dataset.t;
    render();
    scrollTo(0, 0);
    return;
  }

  const a = t.dataset.a, i = +t.dataset.i;
  if (!a || typeof A[a] !== 'function') return;

  if (/^(del|rv)/.test(a)) {
    const armKey = a + (t.dataset.id || i);
    if (arm != armKey) {
      arm = armKey;
      const o = t.textContent;
      t.textContent = '¿Seguro?';
      setTimeout(() => {
        if (arm == armKey) {
          arm = null;
          t.textContent = o;
        }
      }, 3000);
      return;
    }
  }

  arm = null;
  if (A[a](i, t) !== false) {
    save();
    render();
  }
});

M.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.si != null) {
    const idx = +t.dataset.si;
    if (S.script[idx]) {
      if (S.script[idx].type === 'character') {
        const start = t.selectionStart, end = t.selectionEnd;
        t.value = t.value.toUpperCase();
        t.setSelectionRange(start, end);
      }
      S.script[idx].text = t.value;
      save();
      const stats = getScriptStats();
      const txt = `~${stats.pages} pág · ${stats.scenes} escenas · ${stats.words} palabras`;
      const stEl = document.querySelector('.script-stats span');
      if (stEl) stEl.textContent = txt;
      const fsStats = $('#fs-stats');
      if (fsStats) fsStats.textContent = txt;
    }
    return;
  }
  const p = t.dataset.k;
  if (!p) return;
  setP(p, t.value);
  if (p == 'cover.title') setTtl();
  if (p.startsWith('chars.')) cc();
  cnt();
  save();
});

M.addEventListener('focusout', e => {
  const t = e.target;
  if (t.dataset && t.dataset.si != null) {
    const idx = +t.dataset.si;
    const b = S.script[idx];
    if (b) {
      if (b.type === 'character') {
        b.text = b.text.toUpperCase();
        t.value = b.text;
      } else if (b.type === 'parenthetical' && b.text.trim()) {
        b.text = formatParenthetical(b.text);
        t.value = b.text;
      }
      save();
    }
  }
});

M.addEventListener('keydown', e => {
  const t = e.target;
  if (!t.dataset || t.dataset.si == null) return;
  const i = +t.dataset.si;
  const block = S.script[i];
  if (!block) return;

  if (e.ctrlKey && !e.shiftKey && !e.altKey) {
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 6) {
      e.preventDefault();
      setScriptBlockType(i, SCRIPT_TYPES[num - 1][0]);
      return;
    }
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    if (block.type === 'parenthetical' && t.value.trim()) {
      t.value = formatParenthetical(t.value);
      block.text = t.value;
    } else if (block.type === 'character' && t.value) {
      t.value = t.value.toUpperCase();
      block.text = t.value;
    }
    const order = ['scene', 'action', 'character', 'dialogue', 'parenthetical', 'transition'];
    const curIdx = order.indexOf(block.type);
    const nextIdx = e.shiftKey ? (curIdx - 1 + order.length) % order.length : (curIdx + 1) % order.length;
    setScriptBlockType(i, order[nextIdx]);
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (block.type === 'parenthetical' && t.value.trim()) {
      t.value = formatParenthetical(t.value);
      block.text = t.value;
    } else if (block.type === 'character' && t.value) {
      t.value = t.value.toUpperCase();
      block.text = t.value;
    }
    let nextType = 'action';
    if (block.type === 'scene') nextType = 'action';
    else if (block.type === 'action') nextType = 'action';
    else if (block.type === 'character') nextType = 'dialogue';
    else if (block.type === 'parenthetical') nextType = 'dialogue';
    else if (block.type === 'dialogue') nextType = 'action';
    else if (block.type === 'transition') nextType = 'scene';

    const pos = t.selectionStart;
    const full = t.value;
    const before = full.slice(0, pos);
    const after = full.slice(pos);

    block.text = before;
    t.value = before;

    const newBlock = { id: uid(), type: nextType, text: after };
    S.script.splice(i + 1, 0, newBlock);
    curScriptBlock = i + 1;
    save();
    render();
    focusScriptBlock(i + 1, 0);
    return;
  }

  if (e.key === 'Backspace' && t.selectionStart === 0 && t.selectionEnd === 0) {
    if (S.script.length > 1) {
      e.preventDefault();
      if (i > 0) {
        const prevBlock = S.script[i - 1];
        const prevLen = prevBlock.text.length;
        prevBlock.text += block.text;
        S.script.splice(i, 1);
        curScriptBlock = i - 1;
        save();
        render();
        focusScriptBlock(i - 1, prevLen);
      }
      return;
    }
  }

  if (e.key === 'ArrowUp' && t.selectionStart === 0 && i > 0) {
    e.preventDefault();
    focusScriptBlock(i - 1, S.script[i - 1].text.length);
  } else if (e.key === 'ArrowDown' && t.selectionStart === t.value.length && i < S.script.length - 1) {
    e.preventDefault();
    focusScriptBlock(i + 1, 0);
  }
});

M.addEventListener('focusin', e => {
  const t = e.target;
  if (t.dataset && t.dataset.si != null) {
    curScriptBlock = +t.dataset.si;
    const block = S.script[curScriptBlock];
    if (block) {
      document.querySelectorAll('.format-pills button').forEach(btn => {
        btn.classList.toggle('on', btn.dataset.type === block.type);
      });
    }
  }
});

M.addEventListener('dragstart', e => {
  const h = e.target.closest('[data-dr]');
  if (h) {
    dr = +h.dataset.dr;
    e.dataTransfer.setData('text/plain', 's');
    e.dataTransfer.setDragImage(h.closest('.card'), 10, 10);
  }
});

M.addEventListener('dragover', e => {
  if (dr != null && e.target.closest('.sc')) e.preventDefault();
});

M.addEventListener('drop', e => {
  const c = e.target.closest('.sc');
  if (c && dr != null) {
    e.preventDefault();
    const a = dr;
    dr = null;
    mv(a, +c.dataset.i);
  }
});

M.addEventListener('toggle', e => {
  const d = e.target;
  if (d.dataset && d.dataset.sec) op[d.dataset.sec] = d.open;
}, true);

M.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.a === 'pickref') {
    scriptRefTab = t.value;
    const refBody = M.querySelector('.ref-body');
    if (refBody) refBody.innerHTML = renderRefContent();
    return;
  }
  if (t.id != 'pf' || !t.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 400 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
      cv.width = Math.round(im.width * k);
      cv.height = Math.round(im.height * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      S.chars[cur].photo = cv.toDataURL('image/jpeg', .82);
      save();
      render();
    };
    im.src = r.result;
  };
  r.readAsDataURL(t.files[0]);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isScriptFs) {
    toggleScriptFs();
  }
});

// Initialization
initStorage();
applyConfig();

if (window.api && api.getFileToOpen) {
  api.getFileToOpen().then(f => {
    if (f && f.data) {
      const list = getRecents();
      const exist = list.find(x => x.path === f.path);
      currentId = exist ? exist.id : uid();
      S = norm({ ...blank(), ...f.data });
      filePath = f.path;
      inLauncher = false;
      tab = 'cover';
      updateCurrentInRecents();
      persist();
      render();
      st('Listo');
    } else {
      render();
    }
  }).catch(() => render());
} else {
  render();
}

booted = true;
