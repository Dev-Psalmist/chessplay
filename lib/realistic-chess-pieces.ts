import * as THREE from "three";

export type PieceSpriteMap = Record<string, string>;

type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
const PIECES: PieceType[] = ["P", "N", "B", "R", "Q", "K"];
const COLORS = ["w", "b"] as const;

function lathe(material: THREE.Material, profile: [number, number][], segments = 72) {
  const geometry = new THREE.LatheGeometry(
    profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    segments
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addBase(group: THREE.Group, material: THREE.Material) {
  group.add(lathe(material, [
    [0, 0], [0.19, 0], [0.245, 0.025], [0.26, 0.055],
    [0.245, 0.085], [0.19, 0.105], [0.17, 0.13],
    [0.17, 0.16], [0.145, 0.18], [0, 0.18],
  ]));
  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(0.205, 0.012, 10, 64),
    material
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.105;
  group.add(trim);
}

function addSphere(group: THREE.Group, material: THREE.Material, x: number, y: number, z: number, radius: number) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBand(group: THREE.Group, material: THREE.Material, radius: number, tube: number, y: number) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 64), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  ring.castShadow = true;
  group.add(ring);
}

function addCross(group: THREE.Group, material: THREE.Material) {
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.23, 0.055), material);
  stem.position.y = 1.09;
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 0.06), material);
  arms.position.y = 1.13;
  [stem, arms].forEach((mesh) => { mesh.castShadow = true; group.add(mesh); });
  addSphere(group, material, 0, 1.225, 0, 0.035);
}

function addRook(group: THREE.Group, material: THREE.Material, detail: THREE.Material) {
  group.add(lathe(material, [
    [0, 0.17], [0.145, 0.18], [0.17, 0.22], [0.145, 0.27],
    [0.13, 0.32], [0.13, 0.72], [0.16, 0.76], [0.19, 0.8],
    [0.19, 0.87], [0, 0.87],
  ]));
  addBand(group, detail, 0.15, 0.012, 0.31);
  addBand(group, detail, 0.17, 0.012, 0.77);

  // Dark recessed-looking lancet panels make the tower read as a castle rook.
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.2, 0.012), detail);
    panel.position.set(Math.cos(angle) * 0.132, 0.52, Math.sin(angle) * 0.132);
    panel.rotation.y = -angle;
    group.add(panel);
  }

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.075, 48), material);
  crown.position.y = 0.89;
  crown.castShadow = true;
  group.add(crown);

  // Eight broad, unmistakable castle merlons.
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.085), material);
    merlon.position.set(Math.cos(angle) * 0.135, 0.985, Math.sin(angle) * 0.135);
    merlon.rotation.y = -angle;
    merlon.castShadow = true;
    group.add(merlon);
  }
}

function addBishop(group: THREE.Group, material: THREE.Material, detail: THREE.Material) {
  group.add(lathe(material, [
    [0, 0.17], [0.145, 0.19], [0.17, 0.24], [0.13, 0.3],
    [0.105, 0.38], [0.085, 0.55], [0.105, 0.67],
    [0.12, 0.76], [0.09, 0.86], [0.045, 0.98], [0, 1.04],
  ]));
  addBand(group, detail, 0.145, 0.012, 0.29);
  addSphere(group, material, 0, 1.045, 0, 0.045);

  // Diagonal mitre cut: a dark, visible inset on the camera-facing side.
  const slash = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.23, 0.018), detail);
  slash.position.set(0.005, 0.79, 0.091);
  slash.rotation.z = -0.48;
  group.add(slash);

  // Fine pointed bishop finial.
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 24), material);
  finial.position.y = 1.105;
  finial.castShadow = true;
  group.add(finial);
}

function addQueen(group: THREE.Group, material: THREE.Material, detail: THREE.Material) {
  group.add(lathe(material, [
    [0, 0.17], [0.15, 0.19], [0.18, 0.24], [0.145, 0.3],
    [0.105, 0.4], [0.09, 0.59], [0.12, 0.7],
    [0.16, 0.78], [0.15, 0.84], [0.11, 0.88], [0, 0.88],
  ]));
  addBand(group, detail, 0.15, 0.014, 0.31);
  addBand(group, detail, 0.13, 0.012, 0.72);
  addBand(group, material, 0.145, 0.016, 0.86);

  // Open coronet with eight tall fleur-like points and pearl tips.
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * 0.145;
    const z = Math.sin(angle) * 0.145;
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.19, 20), material);
    point.position.set(x, 0.99, z);
    point.castShadow = true;
    group.add(point);
    addSphere(group, detail, x, 1.09, z, 0.027);
  }
  addSphere(group, material, 0, 1.0, 0, 0.085);
  addSphere(group, detail, 0, 1.09, 0, 0.028);
}

function addKing(group: THREE.Group, material: THREE.Material, detail: THREE.Material) {
  group.add(lathe(material, [
    [0, 0.17], [0.15, 0.19], [0.18, 0.24], [0.145, 0.3],
    [0.11, 0.42], [0.095, 0.62], [0.13, 0.73],
    [0.16, 0.8], [0.14, 0.87], [0.1, 0.91], [0, 0.91],
  ]));
  addBand(group, detail, 0.15, 0.014, 0.31);
  addBand(group, detail, 0.14, 0.013, 0.77);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.1, 48), material);
  crown.position.y = 0.94;
  crown.castShadow = true;
  group.add(crown);
  addCross(group, material);
}

function addKnight(group: THREE.Group, material: THREE.Material, detail: THREE.Material) {
  // Neck and chest give the knight a sculpted horse profile, not a generic blob.
  group.add(lathe(material, [
    [0, 0.17], [0.15, 0.19], [0.17, 0.24], [0.13, 0.3],
    [0.105, 0.42], [0.13, 0.55], [0.12, 0.66], [0, 0.7],
  ]));
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.39, 8, 20), material);
  neck.position.set(-0.015, 0.67, 0);
  neck.rotation.z = -0.22;
  neck.castShadow = true;
  group.add(neck);

  const muzzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.23, 6, 16), material);
  muzzle.position.set(0.08, 0.87, 0.015);
  muzzle.rotation.z = Math.PI / 2.7;
  muzzle.castShadow = true;
  group.add(muzzle);

  const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.17, 5), material);
  ear.position.set(-0.045, 1.02, 0);
  ear.rotation.z = -0.25;
  group.add(ear);

  // Layered mane ridges along the back of the head.
  for (let i = 0; i < 5; i += 1) {
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.15, 5), material);
    ridge.position.set(-0.105 - i * 0.018, 0.83 - i * 0.075, 0);
    ridge.rotation.z = -0.55;
    group.add(ridge);
  }
  addSphere(group, detail, 0.11, 0.91, 0.078, 0.018);
  addSphere(group, detail, 0.11, 0.91, -0.078, 0.018);
}

function addPawn(group: THREE.Group, material: THREE.Material, detail: THREE.Material) {
  group.add(lathe(material, [
    [0, 0.17], [0.14, 0.19], [0.16, 0.23], [0.12, 0.28],
    [0.09, 0.35], [0.075, 0.44], [0.095, 0.49],
    [0.115, 0.52], [0, 0.52],
  ]));
  addBand(group, detail, 0.12, 0.012, 0.29);
  addSphere(group, material, 0, 0.64, 0, 0.12);
  addBand(group, material, 0.085, 0.012, 0.52);
}

function buildPiece(type: PieceType, material: THREE.Material, detail: THREE.Material) {
  const group = new THREE.Group();
  addBase(group, material);

  switch (type) {
    case "P": addPawn(group, material, detail); break;
    case "N": addKnight(group, material, detail); break;
    case "B": addBishop(group, material, detail); break;
    case "R": addRook(group, material, detail); break;
    case "Q": addQueen(group, material, detail); break;
    case "K": addKing(group, material, detail); break;
  }
  return group;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

function renderPiece(renderer: THREE.WebGLRenderer, type: PieceType, color: "w" | "b") {
  const scene = new THREE.Scene();
  const ivory = new THREE.MeshPhysicalMaterial({
    color: "#f4e8d0", roughness: 0.2, metalness: 0.025,
    clearcoat: 0.85, clearcoatRoughness: 0.16,
  });
  const ebony = new THREE.MeshPhysicalMaterial({
    color: "#24150f", roughness: 0.19, metalness: 0.06,
    clearcoat: 0.9, clearcoatRoughness: 0.14,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: color === "w" ? "#b58a4b" : "#b18a55",
    metalness: 0.78, roughness: 0.25,
  });
  const inset = new THREE.MeshStandardMaterial({
    color: color === "w" ? "#8c6a3d" : "#080605",
    roughness: 0.48, metalness: 0.12,
  });
  const material = color === "w" ? ivory : ebony;
  const detail = type === "B" || type === "R" ? inset : gold;
  const model = buildPiece(type, material, detail);
  model.rotation.y = -0.24;
  scene.add(model);

  scene.add(new THREE.HemisphereLight("#fff7e8", "#35251d", 2.0));
  const key = new THREE.DirectionalLight("#fff0d8", 3.4);
  key.position.set(3.5, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#c6d4ff", 1.25);
  fill.position.set(-4, 2.5, -3);
  scene.add(fill);
  const rim = new THREE.PointLight("#ffffff", 18, 8);
  rim.position.set(-2, 3.5, 2);
  scene.add(rim);

  const camera = new THREE.OrthographicCamera(-0.72, 0.72, 0.72, -0.72, 0.1, 20);
  camera.position.set(2.8, 3.0, 4.8);
  camera.lookAt(0, 0.56, 0);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  const image = renderer.domElement.toDataURL("image/png");

  disposeObject(model);
  [ivory, ebony, gold, inset].forEach((entry) => entry.dispose());
  return image;
}

/** Render a complete set of high-detail, transparent 3D Staunton chessmen. */
export function renderChessPieceSprites(): PieceSpriteMap {
  const renderer = new THREE.WebGLRenderer({
    alpha: true, antialias: true, preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  renderer.setSize(512, 512, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const sprites: PieceSpriteMap = {};
  try {
    for (const color of COLORS) {
      for (const type of PIECES) sprites[`${color}${type}`] = renderPiece(renderer, type, color);
    }
  } finally {
    renderer.dispose();
  }
  return sprites;
}
