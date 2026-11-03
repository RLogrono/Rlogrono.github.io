"use strict";

(() => {
  const THREE = window.THREE;
  const track = window.RALLY_TRACK;
  if (!THREE) throw new Error("No se ha cargado Three.js desde js/vendor/three.min.js.");
  if (!track) throw new Error("No se ha cargado la configuración del circuito.");

  const viewport = document.getElementById("viewport");
  const canvas = document.getElementById("game-canvas");
  const ui = {
    name: document.getElementById("track-name"),
    title: document.getElementById("track-title"),
    stage: document.getElementById("stage-number"),
    location: document.getElementById("track-location"),
    distance: document.getElementById("track-distance"),
    lap: document.getElementById("lap-number"),
    time: document.getElementById("lap-time"),
    speed: document.getElementById("speed"),
    gear: document.getElementById("gear"),
    progress: document.getElementById("progress-bar"),
    status: document.getElementById("run-status"),
    overlay: document.getElementById("start-screen"),
    start: document.getElementById("start-button"),
    startTitle: document.querySelector(".start-card h2"),
    startDescription: document.querySelector(".start-card p"),
    toast: document.getElementById("toast"),
    best: document.getElementById("best-time"),
    bestDate: document.getElementById("best-date"),
    leaderboard: document.getElementById("leaderboard"),
    clear: document.getElementById("clear-times"),
    saveStatus: document.querySelector(".local-save span:last-child"),
    resetTuning: document.getElementById("reset-tuning")
  };
  const SETTINGS = Object.freeze({
    storageKey: `rally-club-times-v2:${track.id}`,
    sampleStep: 1.5,
    wheelBase: 2.45,
    maxSpeed: Math.min(track.maxSpeed || 32, 140 / 3.6),
    acceleration: 8.5,
    brakePower: 19,
    roadEdge: track.roadWidth / 2,
    guardrailOffset: track.roadWidth / 2 + 4.6,
    carHalfWidth: 1.02,
    grassSpeedLimit: 7.5,
    grassDecelerationStart: 4,
    grassDecelerationMax: 10,
    grassDecelerationRamp: 1.25,
    cameraHeight: 12,
    cameraBehind: 5.2,
    cameraLookAhead: 7.5,
    cameraSmoothing: 4.2,
    maxFrameSeconds: 0.04
  });
  const TUNING_DEFAULTS = Object.freeze({
    maxAngle: 30,
    highSpeedReduction: 65,
    steeringResponse: 150,
    wheelReturnRate: 180,
    corneringThreshold: 50,
    corneringDeceleration: 18
  });
  const tuning = { ...TUNING_DEFAULTS };
  const tuningInputs = [...document.querySelectorAll("[data-tuning]")];

  function updateTuningControl(input) {
    const key = input.dataset.tuning;
    tuning[key] = Number(input.value);
    const output = document.getElementById(`${input.id}-value`);
    const suffix = key === "maxAngle" ? "°"
      : key === "highSpeedReduction" ? " %"
        : key === "steeringResponse" || key === "wheelReturnRate" ? "°/s"
          : key === "corneringThreshold" ? " km/h"
            : " m/s²";
    output.value = `${tuning[key]}${suffix}`;
    output.textContent = output.value;
  }

  tuningInputs.forEach(input => {
    updateTuningControl(input);
    input.addEventListener("input", () => updateTuningControl(input));
  });
  ui.resetTuning.addEventListener("click", () => {
    tuningInputs.forEach(input => {
      input.value = TUNING_DEFAULTS[input.dataset.tuning];
      updateTuningControl(input);
    });
  });

  let scene;
  let camera;
  let renderer;
  let car;
  let frontWheels = [];
  let rollingWheels = [];
  let samples = [];
  let trackLength = 0;
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let state = "ready";
  let progressDistance = 0;
  let previousProgress = 0;
  let elapsedTime = 0;
  let lapStartedAt = 0;
  let completedLaps = 0;
  let speed = 0;
  let steeringAngle = 0;
  let timeOffroad = 0;
  let blockedByWall = false;
  let toastTimer = 0;
  let lastFrame = 0;
  let storageAvailable = true;
  let times = readTimes();
  const input = { left: false, right: false, brake: false };
  const carPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();
  const desiredCameraPosition = new THREE.Vector3();
  const cameraAim = new THREE.PerspectiveCamera();
  const forward = new THREE.Vector3();
  const trackPoint = new THREE.Vector3();
  const lookAtPoint = new THREE.Vector3();

  function makeSamples() {
    const scale = track.courseScale || 1;
    const points = track.points.map(([x, z]) => new THREE.Vector3(x * scale, 0, z * scale));
    const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
    trackLength = curve.getLength();
    const count = Math.max(100, Math.ceil(trackLength / SETTINGS.sampleStep));
    samples = curve.getSpacedPoints(count).slice(0, count);
    return curve;
  }

  const curve = makeSamples();
  const spacing = trackLength / samples.length;
  const sampleIndex = distance => {
    const wrapped = ((distance % trackLength) + trackLength) % trackLength;
    return Math.round(wrapped / spacing) % samples.length;
  };
  const pointAt = (distance, target = new THREE.Vector3()) => {
    const position = curve.getPointAt((((distance % trackLength) + trackLength) % trackLength) / trackLength);
    return target.set(position.x, position.y, position.z);
  };
  const tangentAt = (distance, target = new THREE.Vector3()) => {
    const tangent = curve.getTangentAt((((distance % trackLength) + trackLength) % trackLength) / trackLength);
    return target.set(tangent.x, tangent.y, tangent.z).normalize();
  };
  function makeNoiseTexture(base, seed, size = 256) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = size;
    textureCanvas.height = size;
    const textureContext = textureCanvas.getContext("2d");
    const image = textureContext.createImageData(size, size);
    const baseRed = Number.parseInt(base.slice(1, 3), 16);
    const baseGreen = Number.parseInt(base.slice(3, 5), 16);
    const baseBlue = Number.parseInt(base.slice(5, 7), 16);
    let value = seed;
    const random = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
    for (let i = 0; i < image.data.length; i += 4) {
      const grain = Math.floor(random() * 27) - 13;
      image.data[i] = Math.max(0, Math.min(255, baseRed + grain));
      image.data[i + 1] = Math.max(0, Math.min(255, baseGreen + grain));
      image.data[i + 2] = Math.max(0, Math.min(255, baseBlue + grain));
      image.data[i + 3] = 255;
    }
    textureContext.putImageData(image, 0, 0);
    textureContext.globalAlpha = 0.11;
    textureContext.fillStyle = "#d5cfaa";
    for (let i = 0; i < size * 2; i++) {
      const x = random() * size;
      const y = random() * size;
      textureContext.fillRect(x, y, 1 + random() * 2, 1);
    }
    textureContext.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  function makeRoadGeometry(innerOffset, outerOffset, repeatLength) {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= samples.length; i++) {
      const index = i % samples.length;
      const center = samples[index];
      const tangent = curve.getTangentAt(index / samples.length);
      const nx = tangent.z;
      const nz = -tangent.x;
      for (const offset of [innerOffset, outerOffset]) {
        positions.push(center.x + nx * offset, 0.015, center.z + nz * offset);
        uvs.push(offset === innerOffset ? 0 : 1, (i * spacing) / repeatLength);
      }
      if (i < samples.length) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function addRibbon(inner, outer, material, repeatLength) {
    const mesh = new THREE.Mesh(makeRoadGeometry(inner, outer, repeatLength), material);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function addGuardrail(side, material) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= samples.length; i++) {
      const index = i % samples.length;
      const center = samples[index];
      const tangent = curve.getTangentAt(index / samples.length);
      const nx = tangent.z * side;
      const nz = -tangent.x * side;
      for (const y of [0.57, 0.91]) {
        for (const offset of [-0.08, 0.08]) {
          positions.push(center.x + nx * (SETTINGS.guardrailOffset + offset), y, center.z + nz * (SETTINGS.guardrailOffset + offset));
        }
      }
      if (i < samples.length) {
        const base = i * 4;
        indices.push(
          base, base + 4, base + 1,
          base + 1, base + 4, base + 5,
          base + 2, base + 3, base + 6,
          base + 3, base + 7, base + 6,
          base, base + 2, base + 4,
          base + 2, base + 6, base + 4,
          base + 1, base + 5, base + 3,
          base + 3, base + 5, base + 7
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const rail = new THREE.Mesh(geometry, material);
    rail.castShadow = true;
    rail.receiveShadow = true;
    scene.add(rail);

    const postGeometry = new THREE.BoxGeometry(0.13, 0.74, 0.13);
    const postMaterial = new THREE.MeshStandardMaterial({ color: "#686d64", roughness: 0.72, metalness: 0.52 });
    const reflectorMaterial = new THREE.MeshStandardMaterial({ color: "#e5d7a7", emissive: "#242012", roughness: 0.55 });
    for (let distance = 0; distance < trackLength; distance += 4.2) {
      const point = pointAt(distance, trackPoint);
      const tangent = tangentAt(distance, forward);
      const nx = tangent.z * side;
      const nz = -tangent.x * side;
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(point.x + nx * SETTINGS.guardrailOffset, 0.38, point.z + nz * SETTINGS.guardrailOffset);
      post.rotation.y = Math.atan2(tangent.x, tangent.z);
      post.castShadow = true;
      scene.add(post);
      if (Math.floor(distance / 4.2) % 3 === 0) {
        const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.18), reflectorMaterial);
        reflector.position.set(point.x + nx * SETTINGS.guardrailOffset * 1.03, 0.77, point.z + nz * SETTINGS.guardrailOffset * 1.03);
        reflector.rotation.y = Math.atan2(tangent.x, tangent.z);
        scene.add(reflector);
      }
    }
  }

  function createEnvironment() {
    const grass = makeNoiseTexture("#647446", 3721);
    grass.repeat.set(90, 90);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    ground.receiveShadow = true;
    scene.add(ground);

    const earth = makeNoiseTexture("#a28a56", 5123);
    earth.repeat.set(1, 1);
    const asphalt = makeNoiseTexture("#41423e", 9043, 512);
    asphalt.repeat.set(1, 1);
    const shoulderMaterial = new THREE.MeshStandardMaterial({ map: earth, roughness: 1 });
    const roadMaterial = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.94, metalness: 0.02 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: "#e5ddc2", roughness: 0.9 });
    const guardrailMaterial = new THREE.MeshStandardMaterial({
      color: "#c5c6b8",
      roughness: 0.46,
      metalness: 0.72,
      side: THREE.DoubleSide
    });
    addRibbon(SETTINGS.roadEdge + 0.18, SETTINGS.roadEdge + 4.6, shoulderMaterial, 18);
    addRibbon(-SETTINGS.roadEdge - 4.6, -SETTINGS.roadEdge - 0.18, shoulderMaterial, 18);
    addRibbon(-SETTINGS.roadEdge, SETTINGS.roadEdge, roadMaterial, 14);
    addRibbon(SETTINGS.roadEdge - 0.17, SETTINGS.roadEdge + 0.04, edgeMaterial, 10);
    addRibbon(-SETTINGS.roadEdge - 0.04, -SETTINGS.roadEdge + 0.17, edgeMaterial, 10);
    addGuardrail(-1, guardrailMaterial);
    addGuardrail(1, guardrailMaterial);

    const startPoint = pointAt(0, trackPoint);
    const startTangent = tangentAt(0, forward);
    const startNormal = new THREE.Vector3(startTangent.z, 0, -startTangent.x);
    const startBar = new THREE.Group();
    const tileWidth = track.roadWidth / 12;
    for (let i = 0; i < 12; i++) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(tileWidth, 0.025, 0.38),
        new THREE.MeshStandardMaterial({ color: i % 2 ? "#242923" : "#f2ecd8", roughness: 0.8 })
      );
      tile.position.set(-SETTINGS.roadEdge + tileWidth * (i + 0.5), 0.035, 0);
      startBar.add(tile);
    }
    startBar.position.copy(startPoint);
    startBar.rotation.y = Math.atan2(startTangent.x, startTangent.z);
    scene.add(startBar);

    const kerbGeometry = new THREE.BoxGeometry(0.22, 0.08, 1.7);
    const kerbRed = new THREE.MeshStandardMaterial({ color: "#b95742", roughness: 0.9 });
    for (let distance = 7; distance < trackLength; distance += 9) {
      const center = pointAt(distance, trackPoint);
      const tangent = tangentAt(distance, forward);
      const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
      const stripe = Math.floor(distance / 9) % 2 === 0;
      for (const side of [-1, 1]) {
        const curb = new THREE.Mesh(kerbGeometry, stripe ? kerbRed : edgeMaterial);
        curb.position.set(
          center.x + normal.x * side * (SETTINGS.roadEdge - 0.12),
          0.05,
          center.z + normal.z * side * (SETTINGS.roadEdge - 0.12)
        );
        curb.rotation.y = Math.atan2(tangent.x, tangent.z);
        curb.receiveShadow = true;
        scene.add(curb);
      }
    }
  }

  function makeBox(parent, name, size, position, color, materialOptions = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      new THREE.MeshStandardMaterial({ color, roughness: 0.56, metalness: 0.12, ...materialOptions })
    );
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function createCar() {
    car = new THREE.Group();
    car.name = "Ibiza rally car";
    scene.add(car);
    const body = makeBox(car, "body", [1.78, 0.48, 3.75], [0, 0.56, 0], "#e7e5d9");
    body.scale.set(1, 1, 1);
    makeBox(car, "underbody", [1.58, 0.2, 3.1], [0, 0.4, 0], "#292d2a");

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.46, 0.72, 1.78),
      new THREE.MeshStandardMaterial({ color: "#25393d", roughness: 0.27, metalness: 0.1 })
    );
    cabin.position.set(0, 1.08, -0.12);
    cabin.castShadow = true;
    car.add(cabin);
    for (const side of [-1, 1]) {
      makeBox(car, "side window", [0.025, 0.36, 1.16], [side * 0.743, 1.16, -0.12], "#506569", { roughness: 0.24, metalness: 0.08 });
    }
    makeBox(car, "roof", [1.49, 0.12, 1.42], [0, 1.47, -0.14], "#eceadd");
    makeBox(car, "front windshield", [1.34, 0.05, 0.53], [0, 1.18, 0.72], "#496166").rotation.x = -0.36;
    makeBox(car, "rear windshield", [1.32, 0.05, 0.42], [0, 1.19, -0.97], "#33494b").rotation.x = 0.42;
    makeBox(car, "rear wing", [1.98, 0.1, 0.34], [0, 1.35, -1.93], "#272b28");
    makeBox(car, "front bumper", [1.82, 0.22, 0.28], [0, 0.38, 1.94], "#292d2a");
    makeBox(car, "rear bumper", [1.82, 0.2, 0.24], [0, 0.4, -1.92], "#343834");

    const stripeRed = new THREE.MeshStandardMaterial({ color: "#b7312e", roughness: 0.52 });
    const stripeGold = new THREE.MeshStandardMaterial({ color: "#e5bf3d", roughness: 0.52 });
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.018, 3.05), stripeRed);
      stripe.position.set(side * 0.62, 0.813, -0.03);
      car.add(stripe);
      const pinstripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.019, 3.02), stripeGold);
      pinstripe.position.set(side * 0.48, 0.82, -0.04);
      car.add(pinstripe);
      const headlight = new THREE.Mesh(
        new THREE.BoxGeometry(0.47, 0.1, 0.06),
        new THREE.MeshStandardMaterial({ color: "#f7e9b5", emissive: "#443711", roughness: 0.3 })
      );
      headlight.position.set(side * 0.47, 0.68, 1.89);
      car.add(headlight);
      makeBox(car, "tail light", [0.43, 0.14, 0.06], [side * 0.48, 0.7, -1.9], "#b72e27", { emissive: "#270b09" });
    }

    const tireMaterial = new THREE.MeshStandardMaterial({ color: "#161817", roughness: 0.98 });
    const hubMaterial = new THREE.MeshStandardMaterial({ color: "#b9b9ae", roughness: 0.4, metalness: 0.65 });
    const spokeMaterial = new THREE.MeshStandardMaterial({ color: "#d0d0c3", roughness: 0.45, metalness: 0.55 });
    for (const z of [-1.22, 1.2]) {
      for (const side of [-1, 1]) {
        const x = side * 1.02;
        const mount = new THREE.Group();
        mount.position.set(x, 0.42, z);
        car.add(mount);
        const roller = new THREE.Group();
        mount.add(roller);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 20), tireMaterial);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        roller.add(tire);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12), hubMaterial);
        hub.rotation.z = Math.PI / 2;
        roller.add(hub);
        const outside = side * 0.19;
        const wheelFace = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.035, 12), spokeMaterial);
        wheelFace.rotation.z = Math.PI / 2;
        wheelFace.position.x = outside;
        roller.add(wheelFace);
        for (let spoke = 0; spoke < 5; spoke++) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.21, 0.045), spokeMaterial);
          bar.position.set(outside + side * 0.021, 0, 0);
          bar.rotation.x = spoke * Math.PI * 2 / 5;
          roller.add(bar);
        }
        const archPoints = [];
        for (let segment = 0; segment <= 12; segment++) {
          const angle = Math.PI * segment / 12;
          archPoints.push(new THREE.Vector3(side * 0.91, 0.42 + Math.sin(angle) * 0.47, z + Math.cos(angle) * 0.47));
        }
        const arch = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints), 24, 0.055, 7, false),
          new THREE.MeshStandardMaterial({ color: "#313633", roughness: 0.88 })
        );
        car.add(arch);
        if (z > 0) frontWheels.push(mount);
        rollingWheels.push(roller);
      }
    }
    return car;
  }

  function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#60704a");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
    scene.add(new THREE.HemisphereLight("#e4e6d6", "#454c35", 2.15));
    const sunlight = new THREE.DirectionalLight("#fff2d6", 3.15);
    sunlight.position.set(-32, 48, 19);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    sunlight.shadow.camera.left = -48;
    sunlight.shadow.camera.right = 48;
    sunlight.shadow.camera.top = 48;
    sunlight.shadow.camera.bottom = -48;
    sunlight.shadow.camera.near = 0.5;
    sunlight.shadow.camera.far = 120;
    sunlight.shadow.bias = -0.00015;
    scene.add(sunlight);

    createEnvironment();
    createCar();
    placeCarAtStart();
    resize();
  }

  function placeCarAtStart() {
    pointAt(0, carPosition);
    tangentAt(0, forward);
    car.position.set(carPosition.x, 0, carPosition.z);
    car.rotation.y = Math.atan2(forward.x, forward.z);
    progressDistance = 0;
    previousProgress = 0;
    steeringAngle = 0;
    timeOffroad = 0;
    blockedByWall = false;
    speed = 0;
    camera.position.set(car.position.x - forward.x * SETTINGS.cameraBehind, SETTINGS.cameraHeight, car.position.z - forward.z * SETTINGS.cameraBehind);
    updateCamera(1);
  }

  function readTimes() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS.storageKey) || "[]");
      if (!Array.isArray(stored)) return [];
      return stored
        .filter(record => record && Number.isFinite(record.time) && record.time > 0 && typeof record.date === "string")
        .sort((a, b) => a.time - b.time)
        .slice(0, 10);
    } catch (error) {
      storageAvailable = false;
      return [];
    }
  }

  function writeTimes() {
    try {
      localStorage.setItem(SETTINGS.storageKey, JSON.stringify(times));
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
    }
    updateLeaderboard();
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const wholeSeconds = Math.floor(safeSeconds % 60);
    const milliseconds = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 1000);
    return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
  }

  function prettyDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date).toUpperCase();
  }

  function updateLeaderboard() {
    ui.leaderboard.textContent = "";
    if (!times.length) {
      const empty = document.createElement("li");
      empty.className = "empty-times";
      empty.textContent = "Completa una vuelta para estrenar la tabla.";
      ui.leaderboard.append(empty);
      ui.best.textContent = "--:--.---";
      ui.bestDate.textContent = "AÚN SIN REGISTRO";
    } else {
      for (const [index, record] of times.entries()) {
        const row = document.createElement("li");
        const rank = document.createElement("span");
        const time = document.createElement("span");
        const date = document.createElement("span");
        rank.className = "rank";
        rank.textContent = String(index + 1).padStart(2, "0");
        time.className = "rank-time";
        time.textContent = formatTime(record.time);
        date.className = "rank-date";
        date.textContent = prettyDate(record.date);
        row.append(rank, time, date);
        ui.leaderboard.append(row);
      }
      ui.best.textContent = formatTime(times[0].time);
      ui.bestDate.textContent = prettyDate(times[0].date);
    }
    ui.saveStatus.textContent = storageAvailable ? "GUARDADO EN ESTE DISPOSITIVO" : "SOLO DURANTE ESTA SESIÓN";
  }

  function setTrackLabels() {
    document.title = `${track.name} — Rally Club`;
    ui.name.textContent = track.name.toUpperCase();
    ui.title.innerHTML = `${track.titleLines[0].toUpperCase()}<br><span>${track.titleLines[1].toUpperCase()}</span>`;
    ui.stage.textContent = track.stage;
    ui.location.textContent = track.location.toUpperCase();
    ui.distance.textContent = `${(trackLength / 1000).toFixed(1)} KM · ${track.surface}`.toUpperCase();
    ui.lap.textContent = `— / ${track.laps}`;
  }

  function updateStatus(text, offroad = false) {
    ui.status.lastChild.textContent = text;
    ui.status.classList.toggle("offroad", offroad);
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => ui.toast.classList.remove("is-visible"), 1500);
  }

  function beginRun() {
    state = "running";
    elapsedTime = 0;
    lapStartedAt = 0;
    completedLaps = 0;
    input.left = false;
    input.right = false;
    input.brake = false;
    placeCarAtStart();
    ui.overlay.classList.add("is-hidden");
    ui.lap.textContent = `1 / ${track.laps}`;
    ui.time.textContent = formatTime(0);
    ui.speed.textContent = "0";
    ui.gear.textContent = "N";
    ui.progress.style.width = "0%";
    updateStatus("ETAPA EN CURSO");
  }

  function resetToStart() {
    state = "ready";
    elapsedTime = 0;
    lapStartedAt = 0;
    completedLaps = 0;
    placeCarAtStart();
    ui.startTitle.innerHTML = `¿LISTO PARA<br><span>EL TRAMO?</span>`;
    ui.startDescription.textContent = "Un toque breve ya mueve las ruedas; mantén una dirección para girar más. A mayor velocidad, menor es el ángulo máximo y las curvas rápidas reducen velocidad.";
    ui.start.querySelector("span").textContent = "ARRANCAR MOTOR";
    ui.overlay.classList.remove("is-hidden");
    ui.lap.textContent = `— / ${track.laps}`;
    ui.time.textContent = formatTime(0);
    ui.speed.textContent = "0";
    ui.gear.textContent = "N";
    ui.progress.style.width = "0%";
    updateStatus("LISTO EN LA SALIDA");
  }

  function finishRun() {
    state = "finished";
    speed = 0;
    ui.speed.textContent = "0";
    ui.gear.textContent = "N";
    ui.startTitle.innerHTML = `TRAMO<br><span>COMPLETADO</span>`;
    ui.startDescription.textContent = `Has marcado ${completedLaps} vueltas. Mejor tiempo: ${times.length ? formatTime(times[0].time) : "--:--.---"}. ¿Otra pasada?`;
    ui.start.querySelector("span").textContent = "REPETIR TRAMO";
    ui.overlay.classList.remove("is-hidden");
    ui.lap.textContent = `${track.laps} / ${track.laps}`;
    ui.progress.style.width = "100%";
    updateStatus("ETAPA COMPLETADA");
  }

  function finishLap() {
    const lapTime = elapsedTime - lapStartedAt;
    lapStartedAt = elapsedTime;
    completedLaps++;
    times.push({ time: lapTime, date: new Date().toISOString() });
    times.sort((a, b) => a.time - b.time);
    times = times.slice(0, 10);
    writeTimes();
    showToast(`VUELTA ${completedLaps}  ·  ${formatTime(lapTime)}`);
    if (completedLaps >= track.laps) {
      finishRun();
      return;
    }
    ui.lap.textContent = `${completedLaps + 1} / ${track.laps}`;
  }

  function findProgress(position, expected, searchRadius) {
    const first = Math.floor((expected - searchRadius) / spacing);
    const last = Math.ceil((expected + searchRadius) / spacing);
    let nearest = expected;
    let nearestDistance = Infinity;
    for (let step = first; step <= last; step++) {
      const point = samples[((step % samples.length) + samples.length) % samples.length];
      const dx = point.x - position.x;
      const dz = point.z - position.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared < nearestDistance) {
        nearestDistance = distanceSquared;
        nearest = step * spacing;
      }
    }
    return nearest;
  }

  function updatePhysics(dt) {
    if (state !== "running") return;
    elapsedTime += dt;
    const steeringInput = Number(input.left) - Number(input.right);
    const speedFraction = THREE.MathUtils.clamp(speed / SETTINGS.maxSpeed, 0, 1);
    const maxSteeringAtSpeed = tuning.maxAngle * Math.PI / 180
      * (1 - tuning.highSpeedReduction / 100 * speedFraction);
    const steeringTarget = steeringInput * maxSteeringAtSpeed;
    const steeringRate = (steeringInput ? tuning.steeringResponse : tuning.wheelReturnRate) * Math.PI / 180;
    steeringAngle += THREE.MathUtils.clamp(steeringTarget - steeringAngle, -steeringRate * dt, steeringRate * dt);
    steeringAngle = THREE.MathUtils.clamp(steeringAngle, -maxSteeringAtSpeed, maxSteeringAtSpeed);

    forward.set(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    const roadDistance = findProgress(car.position, progressDistance + speed * dt, Math.max(6, speed * dt + 4));
    const roadPoint = pointAt(roadDistance, trackPoint);
    const roadTangent = tangentAt(roadDistance, cameraTarget);
    const roadNormalX = roadTangent.z;
    const roadNormalZ = -roadTangent.x;
    const lateralOffset = (car.position.x - roadPoint.x) * roadNormalX + (car.position.z - roadPoint.z) * roadNormalZ;
    const offroad = Math.abs(lateralOffset) > SETTINGS.roadEdge - 0.9;

    if (offroad) {
      timeOffroad += dt;
      if (input.brake) {
        speed = Math.max(0, speed - SETTINGS.brakePower * dt);
      } else if (speed < SETTINGS.grassSpeedLimit) {
        speed = Math.min(SETTINGS.grassSpeedLimit, speed + SETTINGS.acceleration * dt);
      } else {
        const ramp = Math.min(1, timeOffroad / SETTINGS.grassDecelerationRamp);
        const grassDeceleration = SETTINGS.grassDecelerationStart
          + (SETTINGS.grassDecelerationMax - SETTINGS.grassDecelerationStart) * ramp;
        speed = Math.max(SETTINGS.grassSpeedLimit, speed - grassDeceleration * dt);
      }
    } else {
      timeOffroad = 0;
      if (input.brake) {
        speed = Math.max(0, speed - SETTINGS.brakePower * dt);
      } else {
        speed = Math.min(SETTINGS.maxSpeed, speed + SETTINGS.acceleration * dt);
        speed = Math.max(0, speed - 0.48 * dt);
      }
      if (!input.brake && Math.abs(steeringAngle) > 0) {
        const corneringSpeedThreshold = tuning.corneringThreshold / 3.6;
        const fastTurnFraction = THREE.MathUtils.clamp(
          (speed - corneringSpeedThreshold)
            / Math.max(1, SETTINGS.maxSpeed - corneringSpeedThreshold),
          0,
          1
        );
        const steeringFraction = THREE.MathUtils.clamp(Math.abs(steeringAngle) / maxSteeringAtSpeed, 0, 1);
        speed = Math.max(
          0,
          speed - tuning.corneringDeceleration * fastTurnFraction * steeringFraction * dt
        );
      }
    }

    const yawRate = speed / SETTINGS.wheelBase * Math.tan(steeringAngle);
    const recoveryYawRate = blockedByWall && steeringInput !== 0 ? steeringInput * 0.9 : 0;
    car.rotation.y += (yawRate + recoveryYawRate) * dt;
    forward.set(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    const movementDistance = speed * dt;
    car.position.x += forward.x * movementDistance;
    car.position.z += forward.z * movementDistance;

    for (const wheel of frontWheels) wheel.rotation.y = steeringAngle;
    const wheelRoll = speed * dt / 0.38;
    for (const wheel of rollingWheels) wheel.rotation.x -= wheelRoll;

    previousProgress = progressDistance;
    const expected = progressDistance + movementDistance;
    const wallCenter = pointAt(expected, trackPoint);
    const wallTangent = tangentAt(expected, cameraTarget);
    const wallNormalX = wallTangent.z;
    const wallNormalZ = -wallTangent.x;
    const wallOffset = (car.position.x - wallCenter.x) * wallNormalX + (car.position.z - wallCenter.z) * wallNormalZ;
    const collisionLimit = SETTINGS.guardrailOffset - SETTINGS.carHalfWidth;
    blockedByWall = Math.abs(wallOffset) > collisionLimit;
    if (blockedByWall) {
      const wallSide = Math.sign(wallOffset);
      car.position.x = wallCenter.x + wallNormalX * wallSide * collisionLimit;
      car.position.z = wallCenter.z + wallNormalZ * wallSide * collisionLimit;
      const headingIntoWall = (forward.x * wallNormalX + forward.z * wallNormalZ) * wallSide;
      if (headingIntoWall > 0) speed = 0;
    }

    const updatedProgress = findProgress(car.position, expected, Math.max(7, speed * dt + 5));
    progressDistance = Math.max(progressDistance - 1.5, Math.min(expected + 2, updatedProgress));
    const crossing = Math.floor(progressDistance / trackLength) > Math.floor(previousProgress / trackLength);
    const facingAlongTrack = forward.x * wallTangent.x + forward.z * wallTangent.z > 0.5;
    if (crossing && !offroad && !blockedByWall && facingAlongTrack) finishLap();
    if (state !== "running") return;

    const lapDistance = progressDistance % trackLength;
    ui.time.textContent = formatTime(elapsedTime - lapStartedAt);
    ui.progress.style.width = `${(lapDistance / trackLength) * 100}%`;
    ui.speed.textContent = String(Math.round(speed * 3.6));
    ui.gear.textContent = input.brake ? "D" : String(Math.min(5, Math.max(1, Math.floor(speed / 6) + 1)));
    updateStatus(
      blockedByWall ? "MURO · GIRA PARA SALIR" : offroad ? "FUERA DE PISTA" : "ETAPA EN CURSO",
      offroad || blockedByWall
    );
  }

  function updateCamera(dt) {
    forward.set(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    desiredCameraPosition.set(
      car.position.x - forward.x * SETTINGS.cameraBehind,
      SETTINGS.cameraHeight,
      car.position.z - forward.z * SETTINGS.cameraBehind
    );
    if (dt >= 1) camera.position.copy(desiredCameraPosition);
    lookAtPoint.set(
      car.position.x + forward.x * SETTINGS.cameraLookAhead,
      0.15,
      car.position.z + forward.z * SETTINGS.cameraLookAhead
    );
    cameraAim.position.copy(desiredCameraPosition);
    cameraAim.lookAt(lookAtPoint);
    camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-SETTINGS.cameraSmoothing * dt));
    camera.quaternion.slerp(cameraAim.quaternion, 1 - Math.exp(-SETTINGS.cameraSmoothing * dt));
  }

  function resize() {
    const rect = viewport.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate(now) {
    const dt = lastFrame ? Math.min(SETTINGS.maxFrameSeconds, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    updatePhysics(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  }

  function setControl(control, pressed) {
    input[control] = pressed;
    document.querySelectorAll(`[data-control="${control}"]`).forEach(button => button.classList.toggle("is-pressed", pressed));
  }

  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (event.target instanceof HTMLInputElement && event.target.type === "range") return;
    if (["arrowleft", "arrowright", "arrowdown", " ", "a", "d", "s", "r"].includes(key)) event.preventDefault();
    if (key === "arrowleft" || key === "a") setControl("left", true);
    if (key === "arrowright" || key === "d") setControl("right", true);
    if (key === "arrowdown" || key === " " || key === "s") setControl("brake", true);
    if (key === "r" && (state === "running" || state === "finished")) resetToStart();
    if ((key === "enter" || key === " ") && state !== "running") beginRun();
  });
  window.addEventListener("keyup", event => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") setControl("left", false);
    if (key === "arrowright" || key === "d") setControl("right", false);
    if (key === "arrowdown" || key === " " || key === "s") setControl("brake", false);
  });
  window.addEventListener("blur", () => {
    setControl("left", false);
    setControl("right", false);
    setControl("brake", false);
  });
  document.querySelectorAll("[data-control]").forEach(button => {
    const control = button.dataset.control;
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setControl(control, true);
    });
    const release = () => setControl(control, false);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
  ui.start.addEventListener("click", beginRun);
  ui.clear.addEventListener("click", () => {
    if (!window.confirm("¿Borrar las diez mejores vueltas guardadas en este dispositivo?")) return;
    times = [];
    try {
      localStorage.removeItem(SETTINGS.storageKey);
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
    }
    updateLeaderboard();
  });
  window.addEventListener("resize", resize, { passive: true });

  setTrackLabels();
  updateLeaderboard();
  initThree();
  window.requestAnimationFrame(animate);
})();
