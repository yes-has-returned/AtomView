import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { standardAtomDict, standardRadiiDict } from './materials.js';

let moleculeState = {
    atoms: [],
    bonds: [],
    assembly_instructions: [],
    isLoaded: false,
    numChains: 10
};

let lastRenderedSettings = null;

// --- API FETCHING ---

async function loadMoleculeByName(name, algorithms) {
    const methods = algorithms.length > 0 ? algorithms.join(',') : 'PubChem,OPSIN';
    showLoading();
    try {
        const response = await fetch(`/renderbackend/name?name=${encodeURIComponent(name)}&methods=${methods}`);
        const data = await response.json();
        handleResponse(data);
    } catch (e) { handleErr(e); }
}

async function loadMoleculeBySmiles(smiles) {
    showLoading();
    try {
        const response = await fetch(`/renderbackend/smiles?smiles=${encodeURIComponent(smiles)}`);
        const data = await response.json();
        handleResponse(data);
    } catch (e) { handleErr(e); }
}

function handleResponse(data) {
    if (data.error) { showError(data.error); return; }
    moleculeState.atoms = data.atoms;
    moleculeState.bonds = data.bonds;
    moleculeState.assembly_instructions = data.assembly_instructions;
    moleculeState.isLoaded = true;
    moleculeState.numChains = 10; // default
    
    // Display molecular data in right sidebar
    displayMolecularData(data);
    
    onDataReady();
}

function displayMolecularData(data) {
    // Display molecular formula
    const formulaDisplay = document.getElementById('molecularFormulaDisplay');
    if (data.molecular_formula) {
        formulaDisplay.textContent = data.molecular_formula;
    }
    
    // Display 2D structure image
    if (data.structure_image) {
        const img = document.getElementById('structure2dImage');
        const placeholder = document.getElementById('structure2dPlaceholder');
        img.src = data.structure_image;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    }
    
    // Display atomic key
    if (data.atomic_key && data.atomic_key.length > 0) {
        const atomicKeyTable = document.getElementById('atomicKeyTable');
        const atomicKeyPlaceholder = document.getElementById('atomicKeyPlaceholder');
        
        atomicKeyTable.innerHTML = '';
        data.atomic_key.forEach(atom => {
            const row = document.createElement('div');
            row.className = 'atomic-key-row';
            row.innerHTML = `
                <span class="atomic-key-symbol">${atom.symbol}</span>
                <span class="atomic-key-count">${atom.count}</span>
            `;
            atomicKeyTable.appendChild(row);
        });
        
        atomicKeyTable.style.display = 'flex';
        atomicKeyPlaceholder.style.display = 'none';
    }
    
    // Display polymerization diagram if it's a polymer
    const polymerizationSection = document.getElementById('polymerizationSection');
    if (data.is_polymer && data.polymerization_diagram) {
        const polyImg = document.getElementById('polymerizationImage');
        const polyPlaceholder = document.getElementById('polymerizationPlaceholder');
        polyImg.src = data.polymerization_diagram;
        polyImg.style.display = 'block';
        polyPlaceholder.style.display = 'none';
        polymerizationSection.style.display = 'flex';
    } else {
        polymerizationSection.style.display = 'none';
    }
}

// --- RENDERING ENGINE ---

function onDataReady() {
    const container = document.getElementById('scene-container');
    if (!container) return;
    container.innerHTML = ''; 
    hideLoading();
    document.getElementById('error-message').style.display = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const instr = moleculeState.assembly_instructions[0];

    // Branching logic: Monomer vs Polymer
    if (instr && instr.is_polymer) {
        renderPolymerChain(mainGroup, instr);
    } else {
        renderSingleMonomer(mainGroup, moleculeState.atoms, moleculeState.bonds);
    }

    // Update UI for polymer settings
    const polymerSettings = document.getElementById('polymer-settings');
    if (instr && instr.is_polymer) {
        polymerSettings.style.display = 'block';
        document.getElementById('numChains').value = moleculeState.numChains;
        document.getElementById('numChainsValue').textContent = moleculeState.numChains;
    } else {
        polymerSettings.style.display = 'none';
    }

    finalizeScene(mainGroup, scene);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        mainGroup.rotation.y += 0.001;
        renderer.render(scene, camera);
    }
    animate();
}

function renderSingleMonomer(group, atoms, bonds) {
    const mode = document.getElementById('displayMode').value;
    atoms.forEach(atom => {
        const baseRadius = (standardRadiiDict[atom.symbol] || standardRadiiDict["Default"]) * 0.3;
        const atomMaterial = standardAtomDict[atom.symbol] || standardAtomDict["Default"];

        // Render the solid atom sphere always.
        const coreGeometry = new THREE.SphereGeometry(baseRadius, 32, 32);
        const coreMesh = new THREE.Mesh(coreGeometry, atomMaterial);
        coreMesh.position.set(atom.x, atom.y, atom.z);
        group.add(coreMesh);

        // Space-filling mode adds a transparent outer shell.
        if (mode === 'space-filling') {
            const shellRadius = (standardRadiiDict[atom.symbol] || standardRadiiDict["Default"]);
            const shellMaterial = atomMaterial.clone();
            shellMaterial.transparent = true;
            shellMaterial.opacity = 0.18;
            shellMaterial.depthWrite = false;
            shellMaterial.side = THREE.DoubleSide;

            const shellGeometry = new THREE.SphereGeometry(shellRadius, 32, 32);
            const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
            shellMesh.position.copy(coreMesh.position);
            group.add(shellMesh);
        }
    });

    bonds.forEach(bond => {
        const v1 = new THREE.Vector3(atoms[bond.start].x, atoms[bond.start].y, atoms[bond.start].z);
        const v2 = new THREE.Vector3(atoms[bond.end].x, atoms[bond.end].y, atoms[bond.end].z);
        group.add(createBond(v1, v2));
    });
}

function renderPolymerChain(parentGroup, instr) {
    const atoms = moleculeState.atoms;
    const head = new THREE.Vector3(atoms[instr.head_idx].x, atoms[instr.head_idx].y, atoms[instr.head_idx].z);
    const tail = new THREE.Vector3(atoms[instr.tail_idx].x, atoms[instr.tail_idx].y, atoms[instr.tail_idx].z);
    const offset = new THREE.Vector3().subVectors(tail, head);
    const twist = instr.type === 'beta' ? Math.PI : 0.4;

    for (let i = 0; i < moleculeState.numChains; i++) {
        const unit = new THREE.Group();
        renderSingleMonomer(unit, atoms, moleculeState.bonds);
        unit.position.addScaledVector(offset, i);
        unit.rotateOnAxis(offset.clone().normalize(), twist * i);
        parentGroup.add(unit);
    }
}

// --- AUTO-RENDER & UI HELPERS ---

function getMoleculeSettings() {
    const inputType = document.querySelector('input[name="input-type"]:checked').value;
    const moleculeData = inputType === "name" ? 
        document.getElementById('moleculeName').value : 
        document.getElementById('smilesValue').value;

    return {
        omitHydrogens: document.getElementById('omitHydrogens').checked,
        algorithms: Array.from(document.querySelectorAll('#algorithms input:checked')).map(cb => cb.value),
        moleculeData: moleculeData,
        inputType: inputType,
        displayMode: document.getElementById('displayMode').value
    };
}

function triggerAutoRender() {
    const data = getMoleculeSettings();
    
    if (lastRenderedSettings &&
        lastRenderedSettings.moleculeData === data.moleculeData &&
        lastRenderedSettings.inputType === data.inputType &&
        JSON.stringify(lastRenderedSettings.algorithms.sort()) === JSON.stringify(data.algorithms.sort()) &&
        lastRenderedSettings.omitHydrogens === data.omitHydrogens &&
        lastRenderedSettings.displayMode === data.displayMode) {
        return;
    }
    
    lastRenderedSettings = { ...data, algorithms: [...data.algorithms] };
    if (!data.moleculeData || data.moleculeData.length < 2) return;
    
    if (data.inputType === "name") {
        loadMoleculeByName(data.moleculeData, data.algorithms);
    } else {
        loadMoleculeBySmiles(data.moleculeData);
    }
}

function debounce(func, timeout = 800) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

function setupAutoRender() {
    const triggers = document.querySelectorAll('.render-trigger');
    const debouncedRender = debounce(() => triggerAutoRender(), 800);

    triggers.forEach(el => {
        if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') {
            el.addEventListener('change', triggerAutoRender);
        }
        if (el.type === 'text' || el.tagName === 'TEXTAREA') {
            el.addEventListener('input', debouncedRender);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(debouncedRender);
                    triggerAutoRender();
                }
            });
            el.addEventListener('blur', triggerAutoRender);
        }
    });
}

function createBond(vStart, vEnd) {
    const dist = vStart.distanceTo(vEnd);
    const geom = new THREE.CylinderGeometry(0.1, 0.1, dist, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x999999 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(vStart).add(vEnd).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vEnd.clone().sub(vStart).normalize());
    return mesh;
}

function finalizeScene(group, scene) {
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.position.sub(center);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(10, 10, 10);
    scene.add(light);
}

function showLoading() { document.getElementById('loading-screen').style.display = 'block'; }
function hideLoading() { document.getElementById('loading-screen').style.display = 'none'; }
function showError(m) { hideLoading(); document.getElementById('error-message').innerText = m; document.getElementById('error-message').style.display = 'block'; }
function handleErr(e) { console.error(e); showError("Connection failed."); }

document.getElementById('numChains').addEventListener('input', function() {
    moleculeState.numChains = parseInt(this.value);
    document.getElementById('numChainsValue').textContent = this.value;
    onDataReady();
});

document.addEventListener('DOMContentLoaded', setupAutoRender);