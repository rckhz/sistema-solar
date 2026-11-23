if (typeof THREE === 'undefined' || typeof THREE.OrbitControls === 'undefined') {
  document.getElementById('loading').innerHTML =
    '<div style="text-align:center;padding:16px"><b style="color:#ff9d3d">Não foi possível carregar a biblioteca Three.js.</b><br><br>' +
    'Verifique a conexão com a internet.</div>';
  throw new Error('Three.js não carregou');
}

/* ============================================================
   1. CENA, CÂMERA E RENDERIZADOR
============================================================ */
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050c);

// Escala das distâncias: modo compacto (padrão) ou distâncias reais em UA.
const AU_UNITS = 20;          // 1 UA = 20 unidades no modo "escala real"
let realScale = false;
let scaleK = 0;               // 0 = compacto, 1 = escala real (animado)
let scaleAnim = null;

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 6000);
function overviewCam(k = realScale ? 1 : 0) {
  const a = Math.min(1, camera.aspect / 0.9);
  const compact = new THREE.Vector3(0, 52 * a, 122 * a);
  const real = new THREE.Vector3(0, 430 * a, 1000 * a);
  return compact.lerp(real, k);
}
camera.position.copy(overviewCam());

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.enableZoom = false;   // zoom próprio (roda do mouse, pinça e botões), mais suave
controls.minDistance = 1.8;
controls.maxDistance = 320;

// Luz ambiente baixa para o lado noturno dos planetas ficar escuro de verdade.
const ambientLight = new THREE.AmbientLight(0x6a7aa0, 0.22);
scene.add(ambientLight);
const sunLight = new THREE.PointLight(0xfff2d2, 1.9, 0, 0);
scene.add(sunLight);

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

/* ============================================================
   2. SOM AMBIENTE (WEB AUDIO API)
============================================================ */
let audioCtx = null;
let audioGain = null;
let soundEnabled = false;

function toggleSound() {
  const btn = document.getElementById('btn-sound');
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    audioGain = audioCtx.createGain();
    audioGain.gain.value = 0.001;
    audioGain.connect(audioCtx.destination);

    [55, 82.41, 110, 164.81].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      osc.connect(filter);
      filter.connect(audioGain);
      osc.start();
    });
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  soundEnabled = !soundEnabled;
  audioGain.gain.setTargetAtTime(soundEnabled ? 0.06 : 0.0001, audioCtx.currentTime, 0.4);
  btn.classList.toggle('active', soundEnabled);
  btn.querySelector('.lbl').textContent = soundEnabled ? 'Som: On' : 'Som: Off';
}
document.getElementById('btn-sound').addEventListener('click', toggleSound);

/* ============================================================
   3. TEXTURAS
   As imagens reais ficam em textures/ (Solar System Scope, CC BY 4.0).
   Enquanto carregam, ou se o site for aberto direto do arquivo (file://),
   os planetas usam texturas desenhadas no canvas.
============================================================ */
const canLoadImages = location.protocol !== 'file:';
const texLoader = new THREE.TextureLoader();

function loadRealTexture(file, apply) {
  if (!canLoadImages) return;
  texLoader.load('textures/' + file, (tex) => {
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    apply(tex);
  });
}
function swapMap(material, file) {
  loadRealTexture(file, (tex) => {
    const old = material.map;
    material.map = tex;
    material.needsUpdate = true;
    if (old) old.dispose();
  });
}

function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function rockyTexture(base, craters) {
  return makeCanvas(512, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < craters; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 8 + 1.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.34)');
      g.addColorStop(0.75, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function venusTexture() {
  return makeCanvas(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#c9a15f'); g.addColorStop(0.5, '#ecd28e'); g.addColorStop(1, '#b98f50');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 38; i++) {
      ctx.strokeStyle = `rgba(255,235,190,${0.06 + Math.random() * 0.12})`;
      ctx.lineWidth = Math.random() * 14 + 2;
      const y0 = Math.random() * h;
      ctx.beginPath(); ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += w / 20) ctx.lineTo(x, y0 + Math.sin(x / 42 + Math.random() * 6) * 16);
      ctx.stroke();
    }
  });
}

function gasTexture(colors, spot = null) {
  return makeCanvas(512, 256, (ctx, w, h) => {
    let y = 0;
    while (y < h) {
      const bh = h * (0.02 + Math.random() * 0.065);
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillRect(0, y, w, bh);
      y += bh;
    }
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.07})`;
      ctx.lineWidth = Math.random() * 2 + 0.5;
      const yy = Math.random() * h;
      ctx.beginPath(); ctx.moveTo(0, yy);
      for (let x = 0; x <= w; x += w / 16) ctx.lineTo(x, yy + Math.sin(x / 32 + Math.random() * 5) * 4);
      ctx.stroke();
    }
    if (spot) {
      const x = w * spot.x, yy = h * spot.y, r = w * spot.r;
      const g = ctx.createRadialGradient(x, yy, r * 0.2, x, yy, r);
      g.addColorStop(0, spot.inner); g.addColorStop(1, spot.outer);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, yy, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function earthTexture() {
  return makeCanvas(1024, 512, (ctx, w, h) => {
    const sea = ctx.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, '#0a3763'); sea.addColorStop(0.5, '#17589e'); sea.addColorStop(1, '#0a3763');
    ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 75; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 48 + 12;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, '#3f9d4d'); g.addColorStop(0.65, '#2c7a38'); g.addColorStop(1, 'rgba(44,122,56,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#eef6ff';
    ctx.fillRect(0, 0, w, h * 0.05);
    ctx.fillRect(0, h * 0.95, w, h * 0.05);
  });
}

function cloudsTexture() {
  return makeCanvas(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 95; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 30 + 6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function sunTexture() {
  return makeCanvas(1024, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#fff0c2'); g.addColorStop(0.3, '#ffba5c'); g.addColorStop(0.7, '#ff8826'); g.addColorStop(1, '#e0580c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 450; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.16})`;
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 8 + 1, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,242,205,1)');
  g.addColorStop(0.25, 'rgba(255,200,90,0.62)');
  g.addColorStop(0.6, 'rgba(255,140,30,0.18)');
  g.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// Faixa radial dos anéis: o x da textura vai da borda interna (0) até a externa (1).
function ringStrip(kind) {
  return makeCanvas(512, 1, (ctx, w) => {
    const img = ctx.createImageData(w, 1);
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      let a, shade;
      if (kind === 'saturno') {
        a = 0.85;
        if (t > 0.62 && t < 0.68) a = 0.08;       // Divisão de Cassini
        a *= 0.7 + 0.3 * Math.sin(t * 40);
        if (t < 0.15) a *= 0.35;                  // anel C, mais transparente
        shade = 0.72 + 0.18 * Math.sin(t * 25);
      } else {
        // Urano: anéis estreitos e escuros
        a = 0;
        [0.08, 0.22, 0.36, 0.5, 0.64, 0.95].forEach((c) => { if (Math.abs(t - c) < 0.014) a = 0.75; });
        shade = 0.55;
      }
      a *= Math.min(1, (1 - t) * 30) * Math.min(1, t * 30 + 0.2);
      img.data[x * 4] = 205 * shade;
      img.data[x * 4 + 1] = 188 * shade;
      img.data[x * 4 + 2] = 152 * shade;
      img.data[x * 4 + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

// RingGeometry vem com UV plano; aqui o U passa a ser a distância ao centro.
function ringGeometry(inner, outer) {
  const g = new THREE.RingGeometry(inner, outer, 160, 1);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    tmpV.fromBufferAttribute(pos, i);
    uv.setXY(i, (tmpV.length() - inner) / (outer - inner), 0.5);
  }
  return g;
}

function markerTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(244, 182, 89, 0.95)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 9]);
  ctx.beginPath(); ctx.arc(128, 128, 110, 0, Math.PI * 2); ctx.stroke();
  return new THREE.CanvasTexture(c);
}

function labelTexture(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '600 32px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

/* ============================================================
   4. ESTRELAS DE FUNDO
============================================================ */
let starsPoints = null;
{
  const n = 7000;
  const pos = new Float32Array(n * 3);
  const cols = new Float32Array(n * 3);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(0xdbe8ff), new THREE.Color(0xffe9c4)];
  for (let i = 0; i < n; i++) {
    const r = 1600 + Math.random() * 800;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    const c = palette[i % palette.length];
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  starsPoints = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.4, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9
  }));
  scene.add(starsPoints);
}

// Via Láctea ao fundo (só com as imagens reais)
let milkyWay = null;
loadRealTexture('2k_stars_milky_way.jpg', (tex) => {
  milkyWay = new THREE.Mesh(
    new THREE.SphereGeometry(2800, 48, 32),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, color: 0x6a6a6a, depthWrite: false })
  );
  milkyWay.renderOrder = -1;   // fundo: desenhado antes de tudo, nunca por cima dos nomes
  milkyWay.rotation.x = THREE.MathUtils.degToRad(60);   // plano galáctico inclinado ~60° em relação à eclíptica
  scene.add(milkyWay);
});

/* ============================================================
   5. O SOL
============================================================ */
const EARTH_DIAM_KM = 12742;
const SUN_DATA = {
  nome: 'Sol', slug: 'sol', tipo: 'Estrela anã amarela (G2V)',
  cor: '#ff8a2e',
  diamKm: 1392700,
  diametro: '1.392.700 km',
  distancia: 'Centro do sistema',
  dia: '≈ 25 dias (no equador)',
  ano: '230 milhões de anos (volta na galáxia)',
  luasLabel: 'Em órbita', luas: '8 planetas',
  temperatura: '5.500 °C (superfície)',
  descricao: 'O Sol tem 99,86% da massa do Sistema Solar. No núcleo, a 15 milhões de °C, ele funde hidrogênio em hélio. A luz que sai da superfície leva cerca de 8 minutos e 20 segundos para chegar à Terra.'
};
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture() });
swapMap(sunMaterial, '2k_sun.jpg');
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 48), sunMaterial);
sunMesh.userData = SUN_DATA;
SUN_DATA.mesh = sunMesh;
SUN_DATA.radius = 5;
scene.add(sunMesh);

const glow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
}));
glow.scale.set(30, 30, 1);
scene.add(glow);

/* ============================================================
   6. PLANETAS
   el = elementos orbitais J2000 (JPL, "Approximate Positions of the Planets"):
        [a (UA), e, inclinação (°), longitude média L (°), long. do periélio (°),
         long. do nodo ascendente (°), variação de L (°/século)]
   compact = raio da órbita no modo compacto (distâncias fora de escala).
   pole = direção do polo norte (IAU), em ascensão reta e declinação (°).
          Spin negativo = rotação retrógrada (Vênus e Urano).
============================================================ */
const planetsData = [
  {
    nome: 'Mercúrio', slug: 'mercurio', tipo: 'Planeta rochoso', cor: '#a99f93', radius: 0.42, compact: 9,
    el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593, 149472.67411175],
    pole: [281.01, 61.42], spin: 0.1,
    texture: () => rockyTexture('#9a8f85', 90), file: '2k_mercury.jpg',
    diamKm: 4879, diametro: '4.879 km', distancia: '57,9 milhões de km',
    dia: '58,6 dias terrestres', ano: '88 dias terrestres',
    luas: '0', temperatura: '-173 °C a 427 °C',
    descricao: 'O menor planeta e o mais rápido em volta do Sol. Quase não tem atmosfera, então o lado iluminado esquenta muito e o lado escuro esfria muito. Sua órbita é a mais alongada entre os planetas.'
  },
  {
    nome: 'Vênus', slug: 'venus', tipo: 'Planeta rochoso', cor: '#e8c98a', radius: 0.85, compact: 13,
    el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255, 58517.81538729],
    pole: [272.76, 67.16], spin: -0.05, atmColor: 0xffd28a,
    texture: venusTexture, file: '2k_venus_atmosphere.jpg',
    diamKm: 12104, diametro: '12.104 km', distancia: '108,2 milhões de km',
    dia: '243 dias (gira ao contrário)', ano: '225 dias terrestres',
    luas: '0', temperatura: '≈ 464 °C',
    descricao: 'É o planeta mais quente, mesmo não sendo o mais perto do Sol. A atmosfera grossa de gás carbônico prende o calor. Um dia em Vênus dura mais que o seu ano, e ele gira no sentido contrário ao da maioria dos planetas.'
  },
  {
    nome: 'Terra', slug: 'terra', tipo: 'Planeta rochoso', cor: '#3f9d4d', radius: 0.9, compact: 17,
    el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 35999.37244981],
    pole: [0, 90], spin: 1.5, hasMoon: true, atmColor: 0x4da6ff,
    texture: earthTexture, file: '2k_earth_daymap.jpg',
    diamKm: 12742, diametro: '12.742 km', distancia: '149,6 milhões de km',
    dia: '24 horas', ano: '365,25 dias',
    luas: '1 (Lua)', temperatura: '≈ 15 °C',
    descricao: 'O único lugar conhecido com vida. 71% da superfície é coberta por água. O campo magnético e a atmosfera protegem a superfície de boa parte da radiação do Sol.'
  },
  {
    nome: 'Marte', slug: 'marte', tipo: 'Planeta rochoso', cor: '#c1522f', radius: 0.5, compact: 21,
    el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 19140.30268499],
    pole: [317.68, 52.89], spin: 1.2,
    texture: () => rockyTexture('#c1522f', 60), file: '2k_mars.jpg',
    diamKm: 6779, diametro: '6.779 km', distancia: '227,9 milhões de km',
    dia: '24,6 horas', ano: '687 dias terrestres',
    luas: '2 (Fobos e Deimos)', temperatura: '≈ -63 °C',
    descricao: 'A cor vermelha vem do óxido de ferro (ferrugem) na poeira. Tem o Monte Olimpo, o maior vulcão do Sistema Solar, com cerca de 22 km de altura, e sinais de que já teve água líquida.'
  },
  {
    nome: 'Júpiter', slug: 'jupiter', tipo: 'Gigante gasoso', cor: '#d8b98c', radius: 2.6, compact: 29,
    el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, 3034.74612775],
    pole: [268.06, 64.50], spin: 2.5,
    texture: () => gasTexture(['#d8b98c', '#c19a6b', '#e8d5b0', '#b08050', '#a06a3c'],
      { x: 0.34, y: 0.62, r: 0.055, inner: '#b85232', outer: 'rgba(184,82,50,0)' }), file: '2k_jupiter.jpg',
    diamKm: 139820, diametro: '139.820 km', distancia: '778,5 milhões de km',
    dia: '9,9 horas', ano: '11,9 anos terrestres',
    luas: 'mais de 90', temperatura: '≈ -110 °C',
    descricao: 'O maior planeta: caberiam mais de 1.300 Terras dentro dele. A Grande Mancha Vermelha é uma tempestade maior que a Terra, observada há mais de 150 anos.'
  },
  {
    nome: 'Saturno', slug: 'saturno', tipo: 'Gigante gasoso', cor: '#e3d5a4', radius: 2.2, compact: 38,
    el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, 1222.49362201],
    pole: [40.59, 83.54], spin: 2.2, rings: { inner: 1.24, outer: 2.27, kind: 'saturno', file: '2k_saturn_ring_alpha.png', opacity: 1 },
    texture: () => gasTexture(['#e3d5a4', '#d6c08a', '#efe6c8', '#c9b27f']), file: '2k_saturn.jpg',
    diamKm: 116460, diametro: '116.460 km', distancia: '1,43 bilhão de km',
    dia: '10,7 horas', ano: '29,4 anos terrestres',
    luas: 'mais de 270', temperatura: '≈ -140 °C',
    descricao: 'Os anéis são feitos de pedaços de gelo e rocha, de grãos de poeira até blocos do tamanho de casas. São largos, mas finos: em boa parte têm só uns 10 metros de espessura. Saturno é menos denso que a água.'
  },
  {
    nome: 'Urano', slug: 'urano', tipo: 'Gigante de gelo', cor: '#9fd8e0', radius: 1.4, compact: 47,
    el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503, 428.48202785],
    pole: [257.31, -15.18], spin: -1.8, rings: { inner: 1.6, outer: 2.0, kind: 'urano', opacity: 0.6 },
    texture: () => gasTexture(['#9fd8e0', '#bfe6ec', '#8fccd6']), file: '2k_uranus.jpg',
    diamKm: 50724, diametro: '50.724 km', distancia: '2,87 bilhões de km',
    dia: '17,2 horas', ano: '84 anos terrestres',
    luas: '29', temperatura: '≈ -195 °C',
    descricao: 'Gira "deitado": o eixo é inclinado 97,8°, provavelmente por uma grande colisão no começo do Sistema Solar. Por isso cada polo passa 42 anos iluminado e 42 no escuro. Perto de 2028 o polo norte fica virado para o Sol, e os anéis são vistos quase de frente.'
  },
  {
    nome: 'Netuno', slug: 'netuno', tipo: 'Gigante de gelo', cor: '#4f7fd8', radius: 1.35, compact: 56,
    el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 218.45945325],
    pole: [299.36, 43.46], spin: 1.9,
    texture: () => gasTexture(['#3f6bd0', '#4f7fd8', '#2f5ab8']), file: '2k_neptune.jpg',
    diamKm: 49244, diametro: '49.244 km', distancia: '4,5 bilhões de km',
    dia: '16,1 horas', ano: '165 anos terrestres',
    luas: '16', temperatura: '≈ -200 °C',
    descricao: 'Tem os ventos mais fortes medidos no Sistema Solar, acima de 2.000 km/h. Foi o primeiro planeta encontrado por cálculo: sua posição foi prevista em 1846 antes de alguém olhar no telescópio.'
  },
  {
    nome: 'Plutão', slug: 'plutao', tipo: 'Planeta anão', cor: '#cdb59a', radius: 0.3, compact: 73,
    el: [39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684, 145.20780515],
    pole: [132.99, -6.16], spin: 0.4,
    texture: () => rockyTexture('#c9b296', 40),
    diamKm: 2377, diametro: '2.377 km', distancia: '5,9 bilhões de km',
    dia: '6,4 dias (gira ao contrário)', ano: '248 anos terrestres',
    luas: '5 (a maior é Caronte)', temperatura: '≈ -230 °C',
    descricao: 'Foi o nono planeta até 2006, quando passou a ser chamado de planeta anão. A órbita é inclinada e tão alongada que, por 20 dos seus 248 anos, Plutão fica mais perto do Sol do que Netuno.'
  }
];
const EARTH = planetsData[2];

const DEG = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86400000;

// Posição na órbita para a anomalia excêntrica E, com a = 1.
// Converte de coordenadas da eclíptica para a cena (y da cena = norte da eclíptica).
function orbitPoint(el, E, out) {
  const [, e, I, , wbar, node] = el;
  const w = (wbar - node) * DEG, O = node * DEG, i = I * DEG;
  const xp = Math.cos(E) - e;
  const yp = Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(i), sI = Math.sin(i);
  const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const z = (sw * sI) * xp + (cw * sI) * yp;
  return out.set(x, z, -y);
}

// Resolve a equação de Kepler para a data (dias desde J2000).
function orbitPosition(el, days, out) {
  const T = days / 36525;
  const e = el[1];
  const M = ((el[3] + el[6] * T - el[4]) % 360) * DEG;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return orbitPoint(el, E, out);
}

// Converte o polo (coordenadas equatoriais) para a direção do eixo na cena.
function poleVector(raDeg, decDeg) {
  const ra = raDeg * DEG, dec = decDeg * DEG, eps = 23.4393 * DEG;
  const xe = Math.cos(dec) * Math.cos(ra), ye = Math.cos(dec) * Math.sin(ra), ze = Math.sin(dec);
  const x = xe;
  const y = ye * Math.cos(eps) + ze * Math.sin(eps);
  const z = -ye * Math.sin(eps) + ze * Math.cos(eps);
  return new THREE.Vector3(x, z, -y).normalize();
}

function orbitRadius(p, k = scaleK) {
  return THREE.MathUtils.lerp(p.compact, p.el[0] * AU_UNITS, k);
}

const clickables = [sunMesh];
const orbitLines = [];
let moonDataRef = null;
const MOON_BASE = 0.9;

planetsData.forEach((p) => {
  // body: posição na órbita. tilt: inclinação do eixo. mesh: gira em torno do próprio eixo.
  const body = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleVector(p.pole[0], p.pole[1]));
  body.add(tilt);

  const material = new THREE.MeshStandardMaterial({ map: p.texture(), roughness: 0.9, metalness: 0 });
  if (p.file) swapMap(material, p.file);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 48, 32), material);
  mesh.userData = p;
  tilt.add(mesh);

  if (p.atmColor) {
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * 1.06, 36, 24),
      new THREE.MeshBasicMaterial({
        color: p.atmColor, transparent: true, opacity: 0.14,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    body.add(atm);
  }

  if (p === EARTH) {
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudsTexture(), transparent: true, opacity: 0.6, depthWrite: false, roughness: 1
    });
    loadRealTexture('2k_earth_clouds.jpg', (tex) => {
      cloudMat.map = null;
      cloudMat.alphaMap = tex;
      cloudMat.opacity = 0.85;
      cloudMat.needsUpdate = true;
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.012, 48, 32), cloudMat);
    clouds.userData = p;
    tilt.add(clouds);
    p.clouds = clouds;
    clickables.push(clouds);
  }

  if (p.hasMoon) {
    const moonGroup = new THREE.Group();
    const moonMat = new THREE.MeshStandardMaterial({ map: rockyTexture('#b9b2a8', 45), roughness: 1, metalness: 0 });
    moonMat.color.setScalar(MOON_BASE);
    swapMap(moonMat, '2k_moon.jpg');
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), moonMat);
    moon.position.x = 1.7;
    moon.rotation.y = Math.PI;   // a mesma face sempre virada para a Terra
    moonDataRef = {
      nome: 'Lua', slug: 'lua', tipo: 'Satélite natural da Terra', cor: '#cfc9c0',
      diamKm: 3474, diametro: '3.474 km', distancia: '384.400 km da Terra',
      dia: '27,3 dias', ano: '27,3 dias (volta na Terra)',
      luas: '—', temperatura: '-173 °C a 127 °C',
      descricao: 'A Lua gira em torno de si no mesmo tempo em que dá a volta na Terra, por isso vemos sempre o mesmo lado. Ela é 400 vezes menor que o Sol, mas está 400 vezes mais perto, e por isso os dois parecem ter o mesmo tamanho no céu.',
      mesh: moon, radius: 0.22
    };
    moon.userData = moonDataRef;
    moonGroup.add(moon);
    body.add(moonGroup);
    p.moonGroup = moonGroup;
    p.moon = moon;
    clickables.push(moon);
  }

  if (p.rings) {
    const r = p.rings;
    const ringMat = new THREE.MeshBasicMaterial({
      map: ringStrip(r.kind), side: THREE.DoubleSide, transparent: true,
      opacity: r.opacity, depthWrite: false
    });
    if (r.file) swapMap(ringMat, r.file);
    const ring = new THREE.Mesh(ringGeometry(r.inner * p.radius, r.outer * p.radius), ringMat);
    ring.rotation.x = -Math.PI / 2;   // no plano do equador do planeta
    tilt.add(ring);
  }

  // Órbita desenhada com a = 1; a escala do objeto define o tamanho.
  const orbitPts = [];
  for (let i = 0; i <= 256; i++) orbitPts.push(orbitPoint(p.el, (i / 256) * Math.PI * 2, new THREE.Vector3()));
  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(orbitPts),
    new THREE.LineBasicMaterial({ color: p === planetsData[8] ? 0x6b5f88 : 0x426bb0, transparent: true, opacity: 0.3 })
  );
  scene.add(orbitLine);
  p.orbitLine = orbitLine;
  orbitLines.push(orbitLine);

  scene.add(body);
  p.body = body;
  p.mesh = mesh;
  clickables.push(mesh);
});

/* Cinturão de asteroides entre Marte e Júpiter */
const BELT_COMPACT_R = 25.25;
let beltRef = null;
{
  const n = 2600;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 23.5 + Math.random() * 3.5;
    const a = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 1.1;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  beltRef = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x99958c, size: 0.085, sizeAttenuation: true, transparent: true, opacity: 0.75
  }));
  scene.add(beltRef);
}

/* ============================================================
   7. TEMPO SIMULADO
============================================================ */
const SPEEDS = [
  { days: 1, label: '1 dia/s' },
  { days: 7, label: '1 semana/s' },
  { days: 30, label: '1 mês/s' },
  { days: 91, label: '3 meses/s' },
  { days: 365, label: '1 ano/s' }
];
let speedIdx = 1;
let paused = false;
const todayDays = () => (Date.now() - J2000_MS) / DAY_MS;
let simDays = todayDays();

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function formatSimDate(days) {
  const d = new Date(J2000_MS + days * DAY_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function updatePositions() {
  const moonLon = (218.3165 + 13.17639648 * simDays) * DEG;   // longitude média da Lua
  planetsData.forEach((p) => {
    orbitPosition(p.el, simDays, p.body.position).multiplyScalar(orbitRadius(p));
    p.orbitLine.scale.setScalar(orbitRadius(p));
  });
  if (EARTH.moonGroup) EARTH.moonGroup.rotation.y = moonLon;
  beltRef.scale.setScalar(THREE.MathUtils.lerp(1, 2.7 * AU_UNITS / BELT_COMPACT_R, scaleK));
}
updatePositions();

/* ============================================================
   8. DOCK, MARCADOR E RÓTULOS
============================================================ */
const dockEl = document.getElementById('dock');
const dockItems = [SUN_DATA, ...planetsData.slice(0, 3), moonDataRef, ...planetsData.slice(3)];
const dockButtons = new Map();

dockItems.forEach((item) => {
  const btn = document.createElement('button');
  btn.className = 'dock-btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = `<span class="dock-dot" style="background:${item.cor}"></span><span>${item.nome}</span>`;
  btn.addEventListener('click', () => {
    if (eclipse) endEclipse(false);
    selectObject(item);
  });
  dockEl.appendChild(btn);
  dockButtons.set(item, btn);
});

const marker = new THREE.Sprite(new THREE.SpriteMaterial({
  map: markerTexture(), transparent: true, depthTest: false
}));
marker.visible = false;
scene.add(marker);

const labels = [];
[SUN_DATA, ...planetsData].forEach((p) => {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture(p.nome), transparent: true, depthTest: false
  }));
  spr.visible = false;
  spr.userData.target = p;
  scene.add(spr);
  labels.push(spr);
});
let labelsVisible = false;

/* ============================================================
   9. INTERAÇÃO, SELEÇÃO E CÂMERA
============================================================ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');
const panel = document.getElementById('panel');
const telTarget = document.getElementById('tel-target');
const intro = document.getElementById('intro');
const HINT = 'Clique em um planeta para ver os dados';

let dragStart = null;
let followPlanet = null;
let viewAnim = null;
let wheelDist = null;
let eclipse = null;
let pinch = null;

function setPointer(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  dragStart = pinch ? null : { x: e.clientX, y: e.clientY, t: performance.now() };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!dragStart) return;
  const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
  const dt = performance.now() - dragStart.t;
  const wasClick = moved < 6 && dt < 500;
  dragStart = null;
  if (wasClick) handleClick(e);
});

function handleClick(e) {
  if (eclipse) return;   // durante o eclipse a câmera fica travada
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickables, false);
  if (hits.length) selectObject(hits[0].object.userData);
  else deselect();
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function flyTo(endCam, endTarget, dur) {
  viewAnim = {
    t: 0, dur,
    startCam: camera.position.clone(),
    startTarget: controls.target.clone(),
    endCam, endTarget
  };
}

function updateDockActive(activeData) {
  dockButtons.forEach((btn, item) => {
    const on = item === activeData;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
}

function setHash(h) {
  history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
}

function selectObject(data) {
  if (eclipse) return;
  showInfo(data);
  followPlanet = data;
  updateDockActive(data);
  setHash(data.slug);

  const noZoom = data === SUN_DATA && camera.aspect < 0.8;
  if (!noZoom) {
    const pos = data.mesh.getWorldPosition(new THREE.Vector3());
    const dist = Math.max(data.radius * 6.5, 2.6);
    let dir;
    if (data === SUN_DATA) {
      dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0.4, 1);
    } else {
      // Câmera do lado do Sol, um pouco de lado e acima: mostra o lado iluminado e a linha do dia/noite.
      const toSun = pos.clone().negate().setY(0).normalize();
      const side = new THREE.Vector3(0, 1, 0).cross(toSun).normalize();
      dir = toSun.multiplyScalar(0.7).add(side.multiplyScalar(0.62)).add(new THREE.Vector3(0, 0.38, 0));
    }
    dir.normalize();
    flyTo(pos.clone().add(dir.multiplyScalar(dist)), pos, 1.35);
  }
  marker.visible = true;
  marker.material.rotation = 0;
}

function deselect() {
  followPlanet = null;
  marker.visible = false;
  panel.classList.remove('open');
  updateDockActive(null);
  setHash(realScale ? 'escala-real' : '');
}

function fmtNum(n, digits = 1) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function sizeVsEarth(data) {
  if (data === EARTH) return 'referência';
  const k = data.diamKm / EARTH_DIAM_KM;
  return k >= 1 ? `${fmtNum(k, k >= 20 ? 0 : 1)}× a Terra` : `${fmtNum(k * 100, 0)}% da Terra`;
}

function liveDistance(data) {
  if (!data.el) return null;
  const au = orbitPosition(data.el, simDays, tmpV2).length() * data.el[0];
  const km = au * 149.6e6;
  const txt = km >= 1e9 ? `${fmtNum(km / 1e9, 2)} bilhões de km` : `${fmtNum(km / 1e6, 1)} milhões de km`;
  return `${txt} (${fmtNum(au, 2)} UA)`;
}

let panelData = null;
function showInfo(data) {
  panelData = data;
  document.getElementById('panel-name').textContent = data.nome;
  document.getElementById('panel-type').textContent = data.tipo;
  const dot = document.getElementById('panel-dot');
  dot.style.background = data.cor;
  dot.style.color = data.cor;
  document.getElementById('panel-desc').textContent = data.descricao;
  const facts = [
    ['Diâmetro', data.diametro],
    ['Tamanho', sizeVsEarth(data)],
    ['Distância média', data.distancia]
  ];
  if (data.el) facts.push(['Distância nesta data', `<span id="live-dist">${liveDistance(data)}</span>`]);
  facts.push(
    ['Dia (rotação)', data.dia],
    ['Ano (órbita)', data.ano],
    [data.luasLabel || 'Luas', data.luas],
    ['Temperatura', data.temperatura]
  );
  document.getElementById('panel-facts').innerHTML =
    facts.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('');
  panel.classList.add('open');
}

/* Tooltip ao passar o mouse */
renderer.domElement.addEventListener('pointermove', (e) => {
  if (dragStart || eclipse || e.pointerType === 'touch') {
    tooltip.style.display = 'none';
    if (eclipse) renderer.domElement.style.cursor = 'default';
    return;
  }
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickables, false);
  if (hits.length) {
    const d = hits[0].object.userData;
    document.getElementById('tooltip-name').textContent = d.nome;
    tooltip.style.display = 'block';
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top = e.clientY + 'px';
    renderer.domElement.style.cursor = 'pointer';
  } else {
    tooltip.style.display = 'none';
    renderer.domElement.style.cursor = 'grab';
  }
});
renderer.domElement.addEventListener('pointerleave', () => { tooltip.style.display = 'none'; });

/* Zoom: roda do mouse, pinça (dois dedos) e botões */
function zoomTo(dist) {
  if (eclipse) return;
  wheelDist = THREE.MathUtils.clamp(dist, controls.minDistance, controls.maxDistance);
}
function currentDist() {
  return camera.position.distanceTo(controls.target);
}
function zoomBy(factor) { zoomTo(currentDist() * factor); }

function updateIntro() {
  const overviewDistance = Math.hypot(52, 122) * Math.min(1, camera.aspect / 0.9);
  const visible = !realScale && scaleK === 0 && !eclipse && !followPlanet && !viewAnim
    && controls.target.lengthSq() < 1 && currentDist() >= overviewDistance * 0.47;
  if (intro.classList.contains('is-visible') === visible) return;
  intro.classList.toggle('is-visible', visible);
  intro.setAttribute('aria-hidden', String(!visible));
}

renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  const sensitivity = !realScale && e.deltaY > 0 ? 0.0014 : 0.0028;
  zoomBy(1 + e.deltaY * sensitivity);
}, { passive: false });

function touchGap(t) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}
renderer.domElement.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    dragStart = null;
    pinch = { gap: touchGap(e.touches), dist: wheelDist ?? currentDist() };
  }
}, { passive: true });
renderer.domElement.addEventListener('touchmove', (e) => {
  if (!pinch || e.touches.length !== 2) return;
  zoomTo(pinch.dist * pinch.gap / Math.max(touchGap(e.touches), 1));
}, { passive: true });
renderer.domElement.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) pinch = null;
});

document.getElementById('zoom-in').addEventListener('click', () => zoomBy(0.75));
document.getElementById('zoom-out').addEventListener('click', () => zoomBy(1.33));

/* Botões da barra superior */
function goOverview() {
  if (eclipse) { endEclipse(true); return; }
  deselect();
  wheelDist = null;
  flyTo(overviewCam(), new THREE.Vector3(0, 0, 0), 1.2);
}
document.getElementById('btn-overview').addEventListener('click', goOverview);

let orbitsVisible = true;
document.getElementById('btn-orbits').addEventListener('click', function () {
  if (eclipse) return;
  orbitsVisible = !orbitsVisible;
  orbitLines.forEach(l => l.visible = orbitsVisible);
  this.classList.toggle('active', orbitsVisible);
});

function setLabels(show) {
  labelsVisible = show;
  labels.forEach(l => l.visible = show);
  document.getElementById('btn-labels').classList.toggle('active', show);
}
document.getElementById('btn-labels').addEventListener('click', () => {
  if (eclipse) return;
  setLabels(!labelsVisible);
});

const scaleBtn = document.getElementById('btn-scale');
const scaleNote = document.getElementById('scale-note');
function setRealScale(on, animated = true) {
  const targetScale = on ? 1 : 0;
  if (eclipse || (on === realScale && (animated || scaleK === targetScale))) return;
  realScale = on;
  scaleBtn.classList.toggle('active', on);
  scaleNote.hidden = !on;
  controls.maxDistance = on ? 1400 : 320;
  if (on && !labelsVisible) setLabels(true);   // de longe os planetas viram pontos; os nomes ajudam
  if (animated) scaleAnim = { from: scaleK, to: targetScale, t: 0, dur: 2.2 };
  else { scaleAnim = null; scaleK = targetScale; updatePositions(); }
  if (!followPlanet) {
    flyTo(overviewCam(), new THREE.Vector3(0, 0, 0), animated ? 2.2 : 0.01);
    setHash(on ? 'escala-real' : '');
  }
}
scaleBtn.addEventListener('click', () => setRealScale(!realScale));

document.getElementById('btn-home').addEventListener('click', () => {
  if (eclipse) endEclipse(false);
  setRealScale(false, false);
  goOverview();
});

document.getElementById('panel-close').addEventListener('click', deselect);

/* Controle do tempo */
const playBtn = document.getElementById('time-play');
const speedLabel = document.getElementById('time-speed');
const dateBtn = document.getElementById('sim-date');

function applyTime() {
  playBtn.textContent = paused ? '▶' : '❚❚';
  speedLabel.textContent = SPEEDS[speedIdx].label;
}
function togglePause() {
  if (eclipse) { toggleEclipsePause(); return; }
  paused = !paused;
  applyTime();
}
playBtn.addEventListener('click', togglePause);
document.getElementById('time-slow').addEventListener('click', () => { speedIdx = Math.max(0, speedIdx - 1); applyTime(); });
document.getElementById('time-fast').addEventListener('click', () => { speedIdx = Math.min(SPEEDS.length - 1, speedIdx + 1); applyTime(); });
dateBtn.addEventListener('click', () => {
  if (eclipse) return;
  simDays = todayDays();
  updatePositions();
});
applyTime();

/* ============================================================
   10. ECLIPSE SOLAR TOTAL, VISTO DO CHÃO
   Depois do voo até a Terra, a tela troca para uma cena 2D própria
   (câmera ortográfica, unidades em pixels): céu, Sol, coroa, Lua,
   contas de Baily, planetas e a silhueta do horizonte.
   O brilho do céu depende da fração do Sol ainda descoberta.
============================================================ */
const ECLIPSE_TWEEN = 1.45;       // voo até a Terra (s)
const ECLIPSE_SWEEP = 30;         // duração base do eclipse inteiro (s)
const ECLIPSE_FADE = 0.35;
const MOON_K = 1.06;              // raio aparente da Lua / raio do Sol (eclipse total)
const PATH_LEN = 4.9;             // deslocamento da Lua ao longo do caminho, em raios do Sol
const PATH_DIR = new THREE.Vector2(1, 0.28).normalize();
const PATH_PERP = new THREE.Vector2(-PATH_DIR.y, PATH_DIR.x);
const ECLIPTIC_TILT = 22 * DEG;   // inclinação da eclíptica no céu desta cena

const eclipseHud = document.getElementById('eclipse-hud');
const eclipseSlider = document.getElementById('eclipse-slider');
const eclipsePauseBtn = document.getElementById('btn-eclipse-pause');
const eclipsePhaseEl = document.getElementById('eclipse-phase');
const eclipseObscEl = document.getElementById('ec-obsc');
const eclipseDescEl = document.getElementById('eclipse-desc');
const fadeEl = document.getElementById('fade');

const eScene = new THREE.Scene();
const eCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

// Gerador pseudoaleatório com semente: o horizonte e as contas são sempre iguais
function seeded(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const VERT_WORLD = `
  varying vec2 vPos;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = w.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

// Uniforms do céu, usados também pela Lua (ela tem a cor do céu à sua frente)
const skyUniforms = {
  uDay: { value: 1 },        // 1 = dia claro, 0 = totalidade
  uHalo: { value: 1 },       // luz espalhada em volta do Sol
  uSun: { value: new THREE.Vector2() },
  uR: { value: 50 },
  uHorizon: { value: -300 },
  uTop: { value: 400 }
};
const SKY_GLSL = `
  uniform float uDay, uHalo, uR, uHorizon, uTop;
  uniform vec2 uSun;
  vec3 skyBase(vec2 pos) {
    float h = clamp((pos.y - uHorizon) / (uTop - uHorizon), 0.0, 1.0);
    vec3 day = mix(vec3(0.66, 0.79, 0.92), vec3(0.15, 0.36, 0.68), pow(h, 0.6));
    vec3 night = mix(vec3(0.05, 0.06, 0.11), vec3(0.008, 0.013, 0.035), pow(h, 0.45));
    // na totalidade o horizonte inteiro fica com cor de pôr do sol
    night += vec3(0.95, 0.45, 0.16) * exp(-h * 10.0) * 0.8;
    night += vec3(0.30, 0.16, 0.26) * exp(-h * 3.5) * 0.22;
    return mix(night, day, uDay);
  }
  vec3 skyColor(vec2 pos) {
    float d = max(length(pos - uSun) / uR - 1.0, 0.0);
    vec3 halo = vec3(1.0, 0.95, 0.86) * (0.55 * exp(-d * 0.9) + 0.22 * exp(-d * 0.16));
    return skyBase(pos) + halo * uHalo;
  }`;

function eMesh(material, order) {
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  m.renderOrder = order;
  m.frustumCulled = false;
  eScene.add(m);
  return m;
}

const skyMesh = eMesh(new THREE.ShaderMaterial({
  uniforms: skyUniforms, vertexShader: VERT_WORLD,
  fragmentShader: SKY_GLSL + `
    varying vec2 vPos;
    void main() { gl_FragColor = vec4(skyColor(vPos), 1.0); }`
}), 0);

// Estrelas: só aparecem perto da totalidade
const eStars = (() => {
  const rnd = seeded(7);
  const n = 260;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rnd() - 0.5;
    pos[i * 3 + 1] = -0.36 + rnd() * 0.86;
    pos[i * 3 + 2] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0,
    depthTest: false, depthWrite: false, toneMapped: false
  }));
  pts.renderOrder = 1;
  pts.frustumCulled = false;
  eScene.add(pts);
  return pts;
})();

// Coroa, proeminências e cromosfera (aditivos, atrás da Lua)
const coronaUniforms = { uSun: skyUniforms.uSun, uR: skyUniforms.uR, uOpacity: { value: 0 } };
const coronaMesh = eMesh(new THREE.ShaderMaterial({
  uniforms: coronaUniforms, vertexShader: VERT_WORLD,
  transparent: true, blending: THREE.AdditiveBlending,
  fragmentShader: `
    varying vec2 vPos;
    uniform vec2 uSun; uniform float uR, uOpacity;
    const float TAU = 6.2831853;
    float adist(float a, float b) { return mod(a - b + 3.1415927, TAU) - 3.1415927; }
    float lobe(float a, float c, float w) { float d = adist(a, c) / w; return exp(-d * d); }
    float fine(float a) {
      return 0.5 + 0.5 * (0.5 * sin(a * 23.0 + 1.3) + 0.3 * sin(a * 41.0 + 4.1) + 0.2 * sin(a * 67.0 + 2.2));
    }
    // proeminência: arco avermelhado preso à borda do Sol
    float prom(float a, float x, float c, float w, float h) {
      float d = adist(a, c);
      if (abs(d) > w) return 0.0;
      float k = (d + w) / (2.0 * w);
      float top = h * sin(3.1415927 * k) * (0.75 + 0.25 * sin(k * 17.0 + c * 5.0));
      if (top < 1e-4) return 0.0;
      float q = (x - top) / (0.006 + 0.08 * h);
      float arch = exp(-q * q);
      float fill = (1.0 - smoothstep(top * 0.3, top, x)) * 0.55;
      return max(arch, fill);
    }
    void main() {
      vec2 p = (vPos - uSun) / uR;
      float r = length(p);
      if (r < 0.99) discard;
      float a = atan(p.y, p.x);
      float x = r - 1.0;
      // serpentinas longas perto do equador do Sol, curtas e finas nos polos
      float st = lobe(a, 0.30, 0.34) * 1.0 + lobe(a, 3.42, 0.30) * 0.9
               + lobe(a, 0.95, 0.12) * 0.55 + lobe(a, 2.58, 0.15) * 0.5
               + lobe(a, 4.05, 0.10) * 0.45 + lobe(a, 5.62, 0.13) * 0.4 + lobe(a, 2.05, 0.08) * 0.3;
      float polar = pow(abs(sin(a - 0.30)), 6.0);
      float I = 0.5 * pow(r, -6.0)
              + st * 0.55 * pow(r, -2.3) * (0.75 + 0.25 * fine(a))
              + polar * fine(a * 1.7) * 0.32 * pow(r, -5.0)
              + 0.8 * exp(-x / 0.03);
      I *= 1.0 - smoothstep(2.6, 4.4, r);
      vec3 col = mix(vec3(1.0, 0.93, 0.82), vec3(0.88, 0.92, 1.0), smoothstep(1.0, 2.6, r)) * I;
      float pr = prom(a, x, 0.72, 0.06, 0.10) + prom(a, x, 2.30, 0.035, 0.07)
               + prom(a, x, 3.95, 0.09, 0.13) + prom(a, x, 5.10, 0.03, 0.05)
               + prom(a, x, 1.75, 0.025, 0.045);
      col += vec3(1.0, 0.30, 0.42) * (pr * 1.5 + 1.3 * exp(-x / 0.012));
      gl_FragColor = vec4(col * uOpacity, 1.0);
    }`
}), 3);

// Disco do Sol: mais claro no centro e escurecendo na borda
const sunDiskMesh = eMesh(new THREE.ShaderMaterial({
  uniforms: { uSun: skyUniforms.uSun, uR: skyUniforms.uR },
  vertexShader: VERT_WORLD, transparent: true,
  fragmentShader: `
    varying vec2 vPos;
    uniform vec2 uSun; uniform float uR;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
      vec2 p = (vPos - uSun) / uR;
      float r = length(p);
      float edge = 1.0 - smoothstep(1.0 - 1.5 / uR, 1.0, r);
      if (edge <= 0.0) discard;
      float mu = sqrt(max(1.0 - r * r, 0.0));
      float I = 1.0 - 0.45 * (1.0 - mu) - 0.15 * (1.0 - mu) * (1.0 - mu);
      I *= 0.95 + 0.05 * (0.6 * noise(p * 40.0) + 0.4 * noise(p * 90.0));
      vec3 col = mix(vec3(1.0, 0.74, 0.48), vec3(1.0, 0.97, 0.9), pow(mu, 0.35)) * I * 1.25;
      gl_FragColor = vec4(col, edge);
    }`
}), 4);

// Lua: tem a cor do céu à frente dela, então some contra o céu claro
// e vira um disco preto quando o céu escurece
const moonUniforms = Object.assign({ uMoon: { value: new THREE.Vector2() }, uRm: { value: 50 } }, skyUniforms);
const moonDiskMesh = eMesh(new THREE.ShaderMaterial({
  uniforms: moonUniforms, vertexShader: VERT_WORLD, transparent: true,
  fragmentShader: SKY_GLSL + `
    varying vec2 vPos;
    uniform vec2 uMoon; uniform float uRm;
    void main() {
      float r = length(vPos - uMoon);
      float edge = 1.0 - smoothstep(uRm - 1.2, uRm + 0.3, r);
      if (edge <= 0.0) discard;
      float inSun = 1.0 - smoothstep(uR - 1.5, uR + 1.5, length(vPos - uSun));
      // fora do Sol: exatamente a cor do céu (a Lua some); sobre o Sol: um recorte escuro
      vec3 col = mix(skyColor(vPos), skyBase(vPos) * 0.22, inSun * smoothstep(0.0, 0.35, uDay));
      gl_FragColor = vec4(col, edge);
    }`
}), 5);

function spriteTex(draw, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return new THREE.CanvasTexture(c);
}
function softDot(ctx, s, stops) {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
}
const glareTex = spriteTex((ctx, s) => softDot(ctx, s, [
  [0, 'rgba(255,250,235,1)'], [0.12, 'rgba(255,240,210,0.65)'], [0.4, 'rgba(255,225,180,0.16)'], [1, 'rgba(255,220,170,0)']
]));
const beadTex = spriteTex((ctx, s) => softDot(ctx, s, [
  [0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,245,220,0.8)'], [0.6, 'rgba(255,225,180,0.15)'], [1, 'rgba(255,220,170,0)']
]), 64);
// Anel de diamante: ponto muito brilhante com raios finos
const diamondTex = spriteTex((ctx, s) => {
  const C = s / 2;
  softDot(ctx, s, [[0, 'rgba(255,255,255,1)'], [0.06, 'rgba(255,252,240,0.95)'], [0.2, 'rgba(255,240,215,0.3)'], [0.5, 'rgba(255,230,200,0.06)'], [1, 'rgba(255,230,200,0)']]);
  ctx.globalCompositeOperation = 'lighter';
  [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.45], [3 * Math.PI / 4, 0.45]].forEach(([ang, len]) => {
    ctx.save(); ctx.translate(C, C); ctx.rotate(ang);
    const g = ctx.createLinearGradient(-C * len, 0, C * len, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-C * len, -1.2, 2 * C * len, 2.4);
    ctx.restore();
  });
}, 512);

function eSprite(tex, order, color = 0xffffff) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, toneMapped: false, opacity: 0
  }));
  s.renderOrder = order;
  s.frustumCulled = false;
  eScene.add(s);
  return s;
}
const glareSprite = eSprite(glareTex, 6);

// Contas de Baily: pontos de luz nos vales da borda da Lua
const beads = (() => {
  const rnd = seeded(31);
  return Array.from({ length: 14 }, (_, i) => ({
    phi: (i / 13 - 0.5) * 1.15 + (rnd() - 0.5) * 0.05,
    depth: 0.004 + rnd() * 0.022,
    sprite: eSprite(beadTex, 7)
  }));
})();
const diamondSprite = eSprite(diamondTex, 8);

// Planetas no céu escuro (posição da data simulada; distância ao Sol comprimida)
const SKY_PLANETS = [
  { nome: 'Vênus', size: 11, color: 0xfffbe8, early: true },
  { nome: 'Júpiter', size: 8.5, color: 0xfff1d6, early: true },
  { nome: 'Mercúrio', size: 5.5, color: 0xe8dccb },
  { nome: 'Marte', size: 6.5, color: 0xffb08a },
  { nome: 'Saturno', size: 6.5, color: 0xffe8b8 }
].map((sp) => {
  sp.data = planetsData.find(p => p.nome === sp.nome);
  sp.dot = eSprite(beadTex, 2, sp.color);
  sp.label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture(sp.nome), transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0
  }));
  sp.label.renderOrder = 10;
  eScene.add(sp.label);
  return sp;
});

function updateSkyPlanets() {
  const E = orbitPosition(EARTH.el, simDays, new THREE.Vector3()).multiplyScalar(EARTH.el[0]);
  const toSun = E.clone().negate().normalize();
  const lonSun = Math.atan2(-toSun.z, toSun.x);
  SKY_PLANETS.forEach((sp) => {
    const v = orbitPosition(sp.data.el, simDays, new THREE.Vector3()).multiplyScalar(sp.data.el[0]).sub(E).normalize();
    sp.elong = Math.acos(THREE.MathUtils.clamp(v.dot(toSun), -1, 1));
    sp.dLon = Math.atan2(Math.sin(Math.atan2(-v.z, v.x) - lonSun), Math.cos(Math.atan2(-v.z, v.x) - lonSun));
    sp.beta = Math.asin(THREE.MathUtils.clamp(v.y, -1, 1));
  });
}

// Silhueta do horizonte (morros e árvores), repetível na horizontal
const groundTex = (() => {
  const W = 2048, H = 256, rnd = seeded(12);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const hill = (x) => H * (0.55
    + 0.10 * Math.sin(2 * Math.PI * x / W * 2 + 0.7)
    + 0.06 * Math.sin(2 * Math.PI * x / W * 5 + 2.1)
    + 0.025 * Math.sin(2 * Math.PI * x / W * 13 + 4.0));
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, hill(x));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, base = hill(x) + 3;
    if (rnd() < 0.55) {
      const h = 18 + rnd() * 34, w = h * 0.38;   // pinheiro
      ctx.beginPath(); ctx.moveTo(x - w, base); ctx.lineTo(x, base - h); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
    } else {
      const r = 7 + rnd() * 12;                   // árvore redonda
      ctx.fillRect(x - 1.5, base - r, 3, r);
      ctx.beginPath(); ctx.arc(x, base - r * 1.4, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.6, base - r * 1.1, r * 0.75, 0, Math.PI * 2); ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
})();
const groundMesh = eMesh(new THREE.MeshBasicMaterial({ alphaMap: groundTex, color: 0x0c1310, transparent: true }), 9);

// Fração do disco do Sol (raio R) coberta pela Lua (raio Rm) com centros a distância d
function circleOverlap(R, Rm, d) {
  if (d >= R + Rm) return 0;
  if (d <= Rm - R) return 1;
  const a1 = R * R * Math.acos((d * d + R * R - Rm * Rm) / (2 * d * R));
  const a2 = Rm * Rm * Math.acos((d * d + Rm * Rm - R * R) / (2 * d * Rm));
  const a3 = 0.5 * Math.sqrt((-d + R + Rm) * (d + R - Rm) * (d - R + Rm) * (d + R + Rm));
  return (a1 + a2 - a3) / (Math.PI * R * R);
}

const PHASE_TEXT = {
  antes: ['Antes do eclipse', 'A Lua nova está chegando perto do Sol. Ela está ali, mas não aparece: o lado virado para nós está no escuro.'],
  parcial: ['Eclipse parcial: a Lua cobre o Sol', 'A luz quase não muda, mesmo com boa parte do Sol coberta. Nunca olhe para o Sol sem óculos de eclipse.'],
  escurecendo: ['Eclipse parcial: o céu escurece', 'Com mais de 90% coberto, a luz cai rápido. As cores ficam estranhas e a temperatura diminui.'],
  contas: ['Contas de Baily e anel de diamante', 'Os últimos raios passam pelos vales da borda da Lua. Quando sobra um ponto só, ele forma o anel de diamante.'],
  total: ['Totalidade: a coroa solar aparece', 'O céu escurece e aparecem a coroa, estrelas e planetas (do lado certo do Sol para esta data, mas mais perto dele que na realidade).'],
  voltando: ['Eclipse parcial: o Sol reaparece', 'O Sol volta pelo outro lado da Lua e a luz do dia retorna depressa.'],
  fim: ['Fim do eclipse', 'A Lua já passou. Daqui a pouco nem dá mais para saber onde ela está.']
};
let shownPhase = '';

function setEclipseButton() {
  eclipsePauseBtn.textContent = eclipse.s >= 1 ? '↺ Recomeçar' : (eclipse.paused ? '▶ Continuar' : '❚❚ Pausar');
}

function startEclipse() {
  if (eclipse) return;
  deselect();
  if (realScale) setRealScale(false, false);
  scaleAnim = null;
  wheelDist = null;
  controls.enabled = false;
  eclipse = { t: 0, s: 0.04, paused: false, autoPausedAtTotality: false, view: false };
  eclipseSlider.value = eclipse.s;
  setEclipseButton();
  shownPhase = '';
  eclipseHud.hidden = false;
  dockEl.style.display = 'none';
  telTarget.textContent = 'Eclipse solar visto da Terra';
  setOthersVisible(false);
  setHash('eclipse');
  updateSkyPlanets();

  // voa até logo acima da superfície da Terra, olhando para o Sol
  EARTH.mesh.getWorldPosition(tmpV);
  const endCam = tmpV.clone().sub(tmpV2.copy(tmpV).normalize().multiplyScalar(1.0));
  flyTo(endCam, new THREE.Vector3(0, 0, 0), ECLIPSE_TWEEN);
}

function endEclipse(returnToOverview = true) {
  if (!eclipse) return;
  eclipse = null;
  eclipseHud.hidden = true;
  document.body.classList.remove('eclipse-on');
  fadeEl.style.opacity = 0;
  dockEl.style.display = '';
  controls.enabled = true;
  setOthersVisible(true);
  updatePositions();
  telTarget.textContent = HINT;
  setHash('');
  if (returnToOverview) flyTo(overviewCam(), new THREE.Vector3(0, 0, 0), 1.4);
}

function setOthersVisible(v) {
  planetsData.forEach((p) => { if (p !== EARTH) p.body.visible = v; });
  orbitLines.forEach(l => { l.visible = v ? orbitsVisible : false; });
  beltRef.visible = v;
  labels.forEach(l => { l.visible = v ? labelsVisible : false; });
}

function toggleEclipsePause() {
  if (!eclipse) return;
  if (eclipse.s >= 1) {
    eclipse.s = 0.04;
    eclipse.autoPausedAtTotality = false;
    eclipse.paused = false;
  } else {
    eclipse.paused = !eclipse.paused;
  }
  setEclipseButton();
}

document.getElementById('btn-eclipse').addEventListener('click', () => {
  if (eclipse) endEclipse(true);
  else startEclipse();
});
eclipsePauseBtn.addEventListener('click', toggleEclipsePause);
document.getElementById('btn-eclipse-totality').addEventListener('click', () => {
  if (!eclipse) return;
  eclipse.s = 0.5;
  eclipse.paused = true;
  eclipse.autoPausedAtTotality = true;
  eclipseSlider.value = 0.5;
  setEclipseButton();
});
document.getElementById('btn-eclipse-exit').addEventListener('click', () => endEclipse(true));

eclipseSlider.addEventListener('input', (e) => {
  if (!eclipse) return;
  eclipse.s = parseFloat(e.target.value);
  eclipse.paused = true;
  setEclipseButton();
});

// Um quadro da cena do eclipse
const eTmp = new THREE.Vector2();
const eTmp2 = new THREE.Vector2();
function updateEclipseView(dt) {
  const W = innerWidth, H = innerHeight;
  eCam.left = -W / 2; eCam.right = W / 2; eCam.top = H / 2; eCam.bottom = -H / 2;
  eCam.updateProjectionMatrix();

  // Sol centralizado no espaço livre entre o cabeçalho e o painel
  const topPx = document.getElementById('header').getBoundingClientRect().bottom + 16;
  const bottomPx = eclipseHud.getBoundingClientRect().top - 16;
  const freeH = Math.max(140, bottomPx - topPx);
  const R = Math.max(26, Math.min(freeH * 0.17, W * 0.11));
  const sun = skyUniforms.uSun.value.set(0, H / 2 - (topPx + bottomPx) / 2);
  skyUniforms.uR.value = R;

  const groundH = Math.min(H * 0.16, 150);
  skyUniforms.uHorizon.value = -H / 2 + groundH * 0.45;
  skyUniforms.uTop.value = H / 2;
  skyMesh.scale.set(W, H, 1);
  groundMesh.scale.set(W, groundH, 1);
  groundMesh.position.set(0, -H / 2 + groundH / 2, 0);
  groundTex.repeat.set(W / (groundH * 8), 1);
  eStars.scale.set(W, H, 1);
  coronaMesh.position.set(sun.x, sun.y, 0); coronaMesh.scale.setScalar(R * 9);
  sunDiskMesh.position.set(sun.x, sun.y, 0); sunDiskMesh.scale.setScalar(R * 2 + 4);

  // Avança o eclipse: bem mais devagar perto da totalidade
  if (!eclipse.paused && eclipse.s < 1) {
    const near = Math.abs(eclipse.s - 0.5);
    const rate = (0.06 + 0.94 * THREE.MathUtils.smoothstep(near, 0, 0.09)) / ECLIPSE_SWEEP;
    const prev = eclipse.s;
    eclipse.s = Math.min(eclipse.s + dt * rate, 1);
    if (prev < 0.5 && eclipse.s >= 0.5 && !eclipse.autoPausedAtTotality) {
      eclipse.s = 0.5;
      eclipse.paused = true;
      eclipse.autoPausedAtTotality = true;
    }
    if (eclipse.s >= 1 || eclipse.paused) setEclipseButton();
    eclipseSlider.value = eclipse.s;
  }

  // Posição da Lua e geometria da sobreposição
  const Rm = R * MOON_K;
  const off = eTmp.copy(PATH_DIR).multiplyScalar((eclipse.s - 0.5) * PATH_LEN * R).addScaledVector(PATH_PERP, 0.025 * R);
  const o = off.length();
  moonUniforms.uMoon.value.set(sun.x + off.x, sun.y + off.y);
  moonUniforms.uRm.value = Rm;
  moonDiskMesh.position.set(sun.x + off.x, sun.y + off.y, 0);
  moonDiskMesh.scale.setScalar(Rm * 2 + 4);

  const covered = circleOverlap(R, Rm, o);
  const u = 1 - covered;                       // fração do Sol ainda visível
  const day = Math.pow(THREE.MathUtils.clamp(u / 0.15, 0, 1), 0.55);
  skyUniforms.uDay.value = day;
  skyUniforms.uHalo.value = Math.pow(u, 0.5);
  groundMesh.material.color.setRGB(0.03 + 0.03 * day, 0.04 + 0.05 * day, 0.04 + 0.04 * day);

  const coronaVis = Math.pow(THREE.MathUtils.clamp(1 - u / 0.006, 0, 1), 1.5);
  coronaUniforms.uOpacity.value = coronaVis;
  eStars.material.opacity = 0.85 * THREE.MathUtils.clamp(1 - u / 0.004, 0, 1);

  // Brilho ofuscante do pedaço de Sol que sobra, centrado no crescente
  const dirAway = o > 1e-6 ? eTmp2.copy(off).multiplyScalar(-1 / o) : eTmp2.set(-1, 0);
  glareSprite.position.set(sun.x + dirAway.x * R * covered * 0.75, sun.y + dirAway.y * R * covered * 0.75, 0);
  glareSprite.scale.setScalar(R * (4 + 3 * u));
  glareSprite.material.opacity = 0.9 * Math.pow(u, 0.6);

  // Contas de Baily: a borda da Lua tem vales; onde o vale passa da borda do Sol, aparece um ponto de luz
  const thick = (R + o - Rm) / R;              // espessura do crescente, em raios do Sol
  const beadPhase = THREE.MathUtils.clamp(1 - thick / 0.035, 0, 1);
  let best = null, bestB = 0;
  const baseAng = Math.atan2(dirAway.y, dirAway.x);
  beads.forEach((b) => {
    const D = Math.sqrt(R * R + o * o + 2 * R * o * Math.cos(b.phi));
    const g = D - (Rm - b.depth * R);
    const br = THREE.MathUtils.clamp(g / (0.012 * R), 0, 1) * beadPhase;
    const ang = baseAng + b.phi;
    b.sprite.position.set(sun.x + Math.cos(ang) * R, sun.y + Math.sin(ang) * R, 0);
    b.sprite.scale.setScalar(R * (0.1 + 0.14 * br));
    b.sprite.material.opacity = br;
    if (br > bestB) { bestB = br; best = b; }
  });
  diamondSprite.material.opacity = best ? bestB * (0.4 + 0.6 * coronaVis) : 0;
  if (best) {
    diamondSprite.position.copy(best.sprite.position);
    diamondSprite.scale.setScalar(R * (2 + 1.8 * bestB));
  }
  const total = covered >= 1 && bestB <= 0;

  // Planetas: aparecem conforme o céu escurece
  const maxPx = Math.min(W * 0.46, 560);
  SKY_PLANETS.forEach((sp) => {
    const vis = sp.elong < 75 * DEG
      ? THREE.MathUtils.clamp(1 - u / (sp.early ? 0.03 : 0.006), 0, 1) : 0;
    const dist = R * 2.4 + (maxPx - R * 2.4) * Math.pow(sp.elong / (75 * DEG), 0.7);
    const ang = Math.atan2(sp.beta * 4, -sp.dLon) + ECLIPTIC_TILT;   // leste à esquerda
    const x = sun.x + Math.cos(ang) * dist, y = sun.y + Math.sin(ang) * dist;
    const ok = vis > 0 && y > -H / 2 + groundH + 10 && y < H / 2 - topPx - 10 && Math.abs(x) < W / 2 - 50;
    sp.dot.material.opacity = ok ? vis : 0;
    sp.dot.position.set(x, y, 0);
    sp.dot.scale.setScalar(sp.size * 2.4);
    sp.label.material.opacity = ok ? vis * 0.85 : 0;
    sp.label.position.set(x, y - 20, 0);
    sp.label.scale.set(88, 22, 1);
  });

  // Textos
  eclipseObscEl.textContent = total ? '100%' : covered <= 0 ? '0%' : (Math.min(covered, 0.999) * 100).toFixed(1).replace('.', ',') + '%';
  let phase;
  if (covered <= 0) phase = eclipse.s < 0.5 ? 'antes' : 'fim';
  else if (total) phase = 'total';
  else if (beadPhase > 0.05 && bestB > 0) phase = 'contas';
  else if (eclipse.s < 0.5) phase = covered > 0.9 ? 'escurecendo' : 'parcial';
  else phase = 'voltando';
  if (phase !== shownPhase) {
    shownPhase = phase;
    eclipsePhaseEl.textContent = PHASE_TEXT[phase][0];
    eclipseDescEl.textContent = PHASE_TEXT[phase][1];
  }
}

addEventListener('keydown', (e) => {
  if (e.target.closest('input')) return;
  if (e.key === '+' || e.key === '=') zoomBy(0.75);
  if (e.key === '-') zoomBy(1.33);
  if (e.code === 'Space' && !e.target.closest('button')) {
    e.preventDefault();
    togglePause();
  }
  if (e.key === 'Escape') {
    if (eclipse) { endEclipse(true); return; }
    if (followPlanet) goOverview();
    else deselect();
  }
});

/* ============================================================
   11. LOOP DE ANIMAÇÃO
============================================================ */
const clock = new THREE.Clock();
let loadingEl = document.getElementById('loading');
let panelTick = 0;
let shownDate = '';
const followPrev = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const running = !eclipse && !paused;

  if (running) simDays += dt * SPEEDS[speedIdx].days;

  // Transição entre escala compacta e real
  if (scaleAnim) {
    scaleAnim.t += dt / scaleAnim.dur;
    scaleK = THREE.MathUtils.lerp(scaleAnim.from, scaleAnim.to, easeInOutCubic(Math.min(scaleAnim.t, 1)));
    if (scaleAnim.t >= 1) scaleAnim = null;
  }

  if (!eclipse) updatePositions();

  // Rotação dos planetas: velocidade visual, não proporcional ao tempo simulado
  const spinRate = running ? 1 : 0;
  planetsData.forEach(p => { p.mesh.rotation.y += p.spin * dt * spinRate; });
  if (EARTH.clouds) EARTH.clouds.rotation.y += dt * spinRate * 1.6;
  beltRef.rotation.y += dt * spinRate * 0.01;
  sunMesh.rotation.y += dt * spinRate * 0.03;

  glow.scale.setScalar(28 + Math.sin(t * 1.2) * 1.5);

  const date = formatSimDate(simDays);
  if (date !== shownDate) { dateBtn.textContent = date; shownDate = date; }

  // Câmera: animação de voo ou acompanhando o astro selecionado
  if (viewAnim) {
    viewAnim.t += dt / viewAnim.dur;
    const e = easeInOutCubic(Math.min(viewAnim.t, 1));
    // o destino acompanha o astro durante o voo, para não chegar atrasado
    if (followPlanet && !eclipse) {
      followPlanet.mesh.getWorldPosition(tmpV);
      viewAnim.endCam.add(tmpV2.copy(tmpV).sub(viewAnim.endTarget));
      viewAnim.endTarget.copy(tmpV);
    }
    camera.position.lerpVectors(viewAnim.startCam, viewAnim.endCam, e);
    controls.target.lerpVectors(viewAnim.startTarget, viewAnim.endTarget, e);
    if (viewAnim.t >= 1) viewAnim = null;
  } else if (followPlanet && !eclipse) {
    // move câmera e alvo juntos, para o astro não se afastar enquanto anda na órbita
    followPrev.copy(controls.target);
    followPlanet.mesh.getWorldPosition(tmpV);
    controls.target.lerp(tmpV, 1 - Math.pow(0.0005, dt));
    camera.position.add(tmpV2.copy(controls.target).sub(followPrev));
  }

  // Zoom suave
  if (wheelDist !== null && !viewAnim && !eclipse) {
    const dir = tmpV.copy(camera.position).sub(controls.target);
    const dist = dir.length();
    const next = THREE.MathUtils.lerp(dist, wheelDist, 1 - Math.pow(0.001, dt));
    camera.position.copy(controls.target).add(dir.normalize().multiplyScalar(next));
    if (Math.abs(dist - wheelDist) < 0.05) wheelDist = null;
  }

  // Marcador do astro selecionado
  if (marker.visible && followPlanet) {
    followPlanet.mesh.getWorldPosition(marker.position);
    const s = followPlanet.radius * 3.4 + Math.sin(t * 3) * followPlanet.radius * 0.22;
    marker.scale.set(s, s, 1);
    marker.material.rotation += dt * 0.5;
  }

  // Rótulos: tamanho constante na tela
  if (labelsVisible && !eclipse) {
    const fovK = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / innerHeight;
    labels.forEach((s) => {
      const p = s.userData.target;
      p.mesh.getWorldPosition(s.position);
      const h = Math.max(camera.position.distanceTo(s.position) * fovK * 22, p.radius * 0.6);
      s.scale.set(h * 4, h, 1);
      s.position.y += p.radius * 1.25 + h * 0.6;
    });
  }

  // Distância ao Sol no painel, atualizada 4 vezes por segundo
  panelTick += dt;
  if (panelTick > 0.25 && panelData && panelData.el && panel.classList.contains('open')) {
    panelTick = 0;
    const el = document.getElementById('live-dist');
    if (el) el.textContent = liveDistance(panelData);
  }

  // Eclipse: voo até a Terra e depois a troca para a cena vista do chão
  let eclipseView = false;
  if (eclipse) {
    eclipse.t += dt;
    const fade = eclipse.t < ECLIPSE_TWEEN
      ? THREE.MathUtils.clamp((eclipse.t - (ECLIPSE_TWEEN - ECLIPSE_FADE)) / ECLIPSE_FADE, 0, 1)
      : THREE.MathUtils.clamp(1 - (eclipse.t - ECLIPSE_TWEEN) / 0.6, 0, 1);
    fadeEl.style.opacity = fade;
    if (eclipse.t >= ECLIPSE_TWEEN) {
      if (!eclipse.view) { eclipse.view = true; document.body.classList.add('eclipse-on'); }
      updateEclipseView(dt);
      eclipseView = true;
    }
  }

  if (!eclipseView) controls.update();
  updateIntro();
  renderer.render(eclipseView ? eScene : scene, eclipseView ? eCam : camera);

  if (loadingEl) {
    loadingEl.style.opacity = '0';
    setTimeout(() => loadingEl && loadingEl.remove(), 450);
    loadingEl = null;
  }
}

/* Link direto: #terra, #saturno, #eclipse, #escala-real... */
function applyHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return;
  if (h === 'eclipse') { startEclipse(); return; }
  if (h === 'escala-real') { setRealScale(true, false); return; }
  const item = dockItems.find(d => d.slug === h);
  if (item) selectObject(item);
}
telTarget.textContent = HINT;
applyHash();
animate();

/* ============================================================
   12. REDIMENSIONAMENTO
============================================================ */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
