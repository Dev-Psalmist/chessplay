import * as THREE from "three";

export type PieceSpriteMap = Record<string, string>;

const PIECES = ["P", "N", "B", "R", "Q", "K"] as const;
const COLORS = ["w", "b"] as const;

function lathe(
  material: THREE.Material,
  profile: [number, number][],
  segments = 64
) {
  const points = profile.map(([radius, height]) => new THREE.Vector2(radius, height));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points, segments), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addBase(group: THREE.Group, material: THREE.Material) {
  group.add(
    lathe(material, [
      [0, 0],
      [0.2, 0],
      [0.245, 0.025],
      [0.25, 0.055],
      [0.235, 0.078],
      [0.18, 0.105],
      [0.155, 0.135],
      [0.15, 0.17],
      [0, 0.17],
    ])
  );
}

function addBall(
  group: THREE.Group,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  radius: number
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    material
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function addCross(group: THREE.Group, material: THREE.Material) {
  const vertical = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.24, 0.055),
    material
  );
  vertical.position.y = 0.91;
  vertical.castShadow = true;
  const horizontal = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.055, 0.055),
    material
  );
  horizontal.position.y = 0.94;
  horizontal.castShadow = true;
  group.add(vertical, horizontal);
}

function buildPiece(type: (typeof PIECES)[number], material: THREE.Material) {
  const group = new THREE.Group();
  addBase(group, material);

  if (type === "P") {
    group.add(
      lathe(material, [
        [0, 0.16], [0.105, 0.18], [0.115, 0.22], [0.075, 0.27],
        [0.055, 0.36], [0.08, 0.4], [0.11, 0.43], [0.1, 0.46], [0, 0.46],
      ])
    );
    addBall(group, material, 0, 0.57, 0, 0.115);
  }

  if (type === "R") {
    group.add(
      lathe(material, [
        [0, 0.16], [0.14, 0.18], [0.15, 0.23], [0.12, 0.28],
        [0.12, 0.66], [0.16, 0.7], [0.17, 0.76], [0, 0.76],
      ])
    );
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.09, 48),
      material
    );
    crown.position.y = 0.79;
    crown.castShadow = true;
    group.add(crown);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const merlon = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.105, 0.075),
        material
      );
      merlon.position.set(Math.cos(angle) * 0.12, 0.87, Math.sin(angle) * 0.12);
      merlon.castShadow = true;
      group.add(merlon);
    }
  }

  if (type === "B") {
    group.add(
      lathe(material, [
        [0, 0.16], [0.14, 0.18], [0.15, 0.23], [0.1, 0.3],
        [0.075, 0.48], [0.11, 0.58], [0.12, 0.66],
        [0.085, 0.75], [0.045, 0.84], [0, 0.91],
      ])
    );
    addBall(group, material, 0, 0.91, 0, 0.055);
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.15, 0.014),
      new THREE.MeshStandardMaterial({ color: "#33251d", roughness: 0.8 })
    );
    slit.position.set(0.012, 0.72, 0.07);
    slit.rotation.z = -0.42;
    group.add(slit);
  }

  if (type === "Q" || type === "K") {
    group.add(
      lathe(material, [
        [0, 0.16], [0.145, 0.18], [0.16, 0.23], [0.12, 0.3],
        [0.085, 0.48], [0.11, 0.57], [0.145, 0.65],
        [0.14, 0.71], [0.1, 0.75], [0, 0.75],
      ])
    );
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.018, 12, 48),
      material
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.76;
    group.add(collar);

    if (type === "Q") {
      addBall(group, material, 0, 0.84, 0, 0.065);
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        addBall(group, material, Math.cos(angle) * 0.12, 0.82, Math.sin(angle) * 0.12, 0.035);
      }
    } else {
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 0.11, 48),
        material
      );
      crown.position.y = 0.82;
      crown.castShadow = true;
      group.add(crown);
      addCross(group, material);
    }
  }

  if (type === "N") {
    const horse = new THREE.Shape();
    horse.moveTo(-0.15, 0.2);
    horse.bezierCurveTo(-0.2, 0.36, -0.13, 0.5, -0.04, 0.58);
    horse.bezierCurveTo(-0.09, 0.69, -0.04, 0.82, 0.04, 0.91);
    horse.lineTo(0.1, 0.79);
    horse.bezierCurveTo(0.2, 0.77, 0.23, 0.68, 0.18, 0.6);
    horse.bezierCurveTo(0.28, 0.52, 0.24, 0.4, 0.13, 0.35);
    horse.lineTo(0.11, 0.2);
    horse.closePath();
    const geometry = new THREE.ExtrudeGeometry(horse, {
      depth: 0.13,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      curveSegments: 16,
    });
    geometry.translate(0, 0, -0.065);
    const head = new THREE.Mesh(geometry, material);
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    const mane = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.28, 5),
      material
    );
    mane.position.set(-0.1, 0.62, -0.005);
    mane.rotation.z = -0.42;
    mane.castShadow = true;
    group.add(mane);

    const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#24170f", roughness: 0.35 });
    addBall(group, eyeMaterial, 0.105, 0.69, 0.075, 0.018);
  }

  return group;
}

function renderPiece(
  renderer: THREE.WebGLRenderer,
  type: (typeof PIECES)[number],
  color: "w" | "b"
) {
  const scene = new THREE.Scene();
  scene.background = null;

  const ivory = new THREE.MeshPhysicalMaterial({
    color: "#f3e7ce",
    roughness: 0.24,
    metalness: 0.02,
    clearcoat: 0.72,
    clearcoatRoughness: 0.2,
  });
  const ebony = new THREE.MeshPhysicalMaterial({
    color: "#241711",
    roughness: 0.22,
    metalness: 0.04,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  });
  const material = color === "w" ? ivory : ebony;

  const model = buildPiece(type, material);
  model.rotation.y = -0.28;
  scene.add(model);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.004;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight("#fff7e9", "#40302a", 2.1));

  const key = new THREE.DirectionalLight("#fff0d8", 3.2);
  key.position.set(3.5, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  scene.add(key);

  const fill = new THREE.DirectionalLight("#c8d5ff", 1.35);
  fill.position.set(-4, 2.5, -3);
  scene.add(fill);

  const rim = new THREE.PointLight("#ffffff", 24, 8);
  rim.position.set(-2, 3.5, 2);
  scene.add(rim);

  const camera = new THREE.OrthographicCamera(-0.68, 0.68, 0.68, -0.68, 0.1, 20);
  camera.position.set(2.6, 2.8, 4.5);
  camera.lookAt(0, 0.47, 0);

  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  const image = renderer.domElement.toDataURL("image/png");

  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((entry) => entry.dispose());
    }
  });
  ground.geometry.dispose();
  ground.material.dispose();
  return image;
}

/** Render one set of polished 3D chessmen into transparent, high-resolution sprites. */
export function renderChessPieceSprites(): PieceSpriteMap {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });

  renderer.setSize(384, 384, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const sprites: PieceSpriteMap = {};

  try {
    for (const color of COLORS) {
      for (const type of PIECES) {
        sprites[`${color}${type}`] = renderPiece(renderer, type, color);
      }
    }
  } finally {
    renderer.dispose();
  }

  return sprites;
}
