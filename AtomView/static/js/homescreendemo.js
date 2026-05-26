import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { standardAtomDict } from './materials.js';
import { standardRadiiDict } from './materials.js';

let moleculeState = {
    atoms: [],
    bonds: [],
    isLoaded: false
};

async function loadMolecule(name) {
    console.log(`Fetching data for: ${name}...`);
    
    try {
        const response = await fetch(`/demobackend?name=${encodeURIComponent(name)}`);
        const data = await response.json();

        // 1. Update the global state variables
        moleculeState.atoms = data.atoms;
        moleculeState.bonds = data.bonds;
        moleculeState.isLoaded = true;

        console.log("Data successfully stored in global state.");

        // 2. Trigger the rest of your code now that data exists
        onDataReady();

    } catch (error) {
        console.error("Error loading molecule data:", error);
    }
}

function onDataReady() {
    const container = document.getElementById('scene-container');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 5, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const moleculeGroup = new THREE.Group();
    scene.add(moleculeGroup);

    // --- Configuration ---
    const SCALE_FACTOR = 0.3; // Adjust atom/bond sizes
    const BOND_RADIUS = 0.1;
    const DOUBLE_BOND_SPACING = 0.2;

    // --- 1. Render Atoms ---
    moleculeState.atoms.forEach(atom => {
        const material = standardAtomDict[atom.symbol] || standardAtomDict["Default"];
        const rawRadius = standardRadiiDict[atom.symbol] || standardRadiiDict["Default"];
        
        const geometry = new THREE.SphereGeometry(rawRadius * SCALE_FACTOR, 32, 32);
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(atom.x, atom.y, atom.z);
        moleculeGroup.add(mesh);
    });

    // --- 2. Render Bonds (Multi-Cylinder) ---
    moleculeState.bonds.forEach(bond => {
        const atomA = moleculeState.atoms[bond.start];
        const atomB = moleculeState.atoms[bond.end];

        const start = new THREE.Vector3(atomA.x, atomA.y, atomA.z);
        const end = new THREE.Vector3(atomB.x, atomB.y, atomB.z);
        const distance = start.distanceTo(end);
        const direction = new THREE.Vector3().subVectors(end, start).normalize();

        // Determine multiplicity
        let count = 1;
        if (bond.type.includes("DOUBLE")) count = 2;
        if (bond.type.includes("TRIPLE")) count = 3;

        // Calculate a perpendicular vector for offsetting double/triple bonds
        let axis = new THREE.Vector3(0, 1, 0);
        if (Math.abs(direction.dot(axis)) > 0.9) axis.set(1, 0, 0);
        const perp = new THREE.Vector3().crossVectors(direction, axis).normalize();

        for (let i = 0; i < count; i++) {
            const bondGeom = new THREE.CylinderGeometry(BOND_RADIUS, BOND_RADIUS, distance, 8);
            const bondMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
            const cylinder = new THREE.Mesh(bondGeom, bondMat);

            // Offset math
            const offsetScalar = (i - (count - 1) / 2) * DOUBLE_BOND_SPACING;
            const offsetVec = perp.clone().multiplyScalar(offsetScalar);
            const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

            cylinder.position.copy(midpoint.add(offsetVec));
            cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            
            moleculeGroup.add(cylinder);
        }
    });

    // --- 3. Centering Logic ---
    scene.updateMatrixWorld(true);
    const computeBox = new THREE.Box3().setFromObject(moleculeGroup);
    const centerOffset = new THREE.Vector3();
    computeBox.getCenter(centerOffset);
    moleculeGroup.position.sub(centerOffset);

    // --- 4. Lighting ---
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);

    // --- 5. Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        moleculeGroup.rotation.y += 0.002;
        renderer.render(scene, camera);
    }
    animate();
}
const demoMolecule = ["propyl ethanoate"];
const randomMolecule = demoMolecule[Math.floor(Math.random() * demoMolecule.length)];

loadMolecule(randomMolecule);


