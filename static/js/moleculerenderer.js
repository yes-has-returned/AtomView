import * as THREE from 'three';
import { standardAtomDict, standardRadiiDict } from './materials.js';

let moleculeState = {
    atoms: [],
    bonds: [],
    assembly_instructions: [],
    isLoaded: false,
    numChains: 1,
    lowDetailMode: false
};

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let previousHighlightedObj = null; 
let originalColor = null;

const atomTooltip = document.createElement('div');
Object.assign(atomTooltip.style, {
    position: 'absolute', display: 'none', backgroundColor: 'rgba(255,255,255,0.95)',
    padding: '10px', borderRadius: '5px', pointerEvents: 'none', zIndex: '1000',
    border: '1px solid #ccc', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
});
document.body.appendChild(atomTooltip);

let lastRenderedSettings = null;
let communityVoteState = {};
let selectedCommunityEntryId = null;
let communityPanelVisible = false;
let voterId = null;
let activeCamera = null;
let currentRenderer = null;
let currentAnimationId = null;
let sphereGeometryCache = new Map();
let shellGeometryCache = new Map();
let shellMaterialCache = new Map();
let bondGeometry = null;
const standardBondMaterial = new THREE.MeshStandardMaterial({ color: 0x999999 });
const aromaticBondMaterial = new THREE.LineDashedMaterial({
    color: 0x999999,
    dashSize: 0.15,
    gapSize: 0.1,
    transparent: true,
    opacity: 0.85
});
const ionicLinkMaterial = new THREE.LineDashedMaterial({
    color: 0x2f76d9,
    dashSize: 0.2,
    gapSize: 0.1,
    transparent: true,
    opacity: 0.9
});
let freeCameraState = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    isPointerDown: false,
    pointerX: 0,
    pointerY: 0,
    yaw: 0,
    pitch: 0,
    controlsInitialized: false,
    orbitRadius: 15
};

// Ensure a persistent voter id per browser
try {
    voterId = localStorage.getItem('atomview_voter_id');
    if (!voterId && window.crypto && crypto.randomUUID) {
        voterId = crypto.randomUUID();
        localStorage.setItem('atomview_voter_id', voterId);
    }
    if (!voterId) {
        // fallback
        voterId = 'v_' + Math.random().toString(36).slice(2);
        localStorage.setItem('atomview_voter_id', voterId);
    }
} catch (e) {
    voterId = 'v_' + Math.random().toString(36).slice(2);
}

// --- API FETCHING ---

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    if (!text || !text.trim()) {
        throw new Error(`Empty response from server (${response.status})`);
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        throw new Error(`Invalid JSON response from ${url}: ${text}`);
    }

    return { response, data };
}

async function loadMoleculeByName(name, algorithms, forcePolymerization) {
    const methods = algorithms.length > 0 ? algorithms.join(',') : 'PubChem,OPSIN';
    showLoading();
    try {
        const query = new URLSearchParams({
            name,
            methods,
            force_polymerization: String(forcePolymerization)
        });
        const { response, data } = await fetchJson(`/renderbackend/name?${query.toString()}`);
        if (!response.ok) {
            handleErr(data.error || `Request failed with status ${response.status}`);
            return;
        }
        handleResponse(data);
    } catch (e) { handleErr(e); }
}

async function loadMoleculeBySmiles(smiles, forcePolymerization) {
    showLoading();
    try {
        const query = new URLSearchParams({
            smiles,
            force_polymerization: String(forcePolymerization)
        });
        const { response, data } = await fetchJson(`/renderbackend/smiles?${query.toString()}`);
        if (!response.ok) {
            handleErr(data.error || `Request failed with status ${response.status}`);
            return;
        }
        handleResponse(data);
    } catch (e) { handleErr(e); }
}

function calculateBondAngles(atom, neighbors) {
    if (!atom || !Array.isArray(neighbors) || neighbors.length < 2) {
        return [];
    }

    const origin = new THREE.Vector3(atom.x, atom.y, atom.z);
    const vectors = neighbors.map(neighbor => {
        const pos = new THREE.Vector3(neighbor.x, neighbor.y, neighbor.z);
        return { neighbor, vector: pos.sub(origin) };
    });

    const angles = [];
    for (let i = 0; i < vectors.length; i += 1) {
        for (let j = i + 1; j < vectors.length; j += 1) {
            const v1 = vectors[i].vector.clone().normalize();
            const v2 = vectors[j].vector.clone().normalize();
            const dot = Math.min(1, Math.max(-1, v1.dot(v2)));
            const angleDeg = Math.acos(dot) * (180 / Math.PI);
            angles.push({
                atoms: [vectors[i].neighbor, vectors[j].neighbor],
                angle: angleDeg
            });
        }
    }
    return angles;
}

async function fetchHighlightedAtomData(atomID) {
    if (atomID === undefined || atomID === null) {
        return null;
    }

    const atom = moleculeState.atoms.find(entry => entry.id === atomID);
    if (!atom) {
        return null;
    }

    const neighbors = moleculeState.bonds
        .filter(bond => bond.start === atomID || bond.end === atomID)
        .map(bond => moleculeState.atoms.find(entry => entry.id === (bond.start === atomID ? bond.end : bond.start)))
        .filter(Boolean);

    return {
        id: atom.id,
        name: atom.name || atom.symbol,
        symbol: atom.symbol,
        atomicWeight: atom.mass,
        bondCount: neighbors.length,
        charge: atom.charge,
        bondNeighbors: neighbors,
        bondAngles: calculateBondAngles(atom, neighbors)
    };
}

function setupInteraction(scene, camera, renderer) {
    renderer.domElement.addEventListener('click', (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        const atomIntersect = intersects.find(intersection => intersection.object.userData?.atomId !== undefined);

        if (atomIntersect) {
            highlightAtom(atomIntersect.object, event);
        } else {
            clearHighlight();
        }
    });

    renderer.domElement.addEventListener('pointerleave', () => {
        clearHighlight();
    });
}

function highlightAtom(mesh, event) {
    if (!mesh?.material) {
        return;
    }

    if (previousHighlightedObj && previousHighlightedObj !== mesh) {
        previousHighlightedObj.material.color.copy(originalColor || previousHighlightedObj.material.color);
    }

    if (previousHighlightedObj === mesh) {
        if (originalColor) {
            mesh.material.color.copy(originalColor);
        }
        previousHighlightedObj = null;
        atomTooltip.style.display = 'none';
        return;
    }

    originalColor = mesh.material.color.clone();
    previousHighlightedObj = mesh;
    mesh.material.color.offsetHSL(0, 0, 0.25);

    const atomId = mesh.userData?.atomId ?? mesh.userData?.atom?.id;
    if (atomId === undefined) {
        atomTooltip.style.display = 'none';
        return;
    }

    fetchHighlightedAtomData(atomId).then((data) => {
        if (!data || previousHighlightedObj !== mesh) {
            return;
        }

        let bondAngleHtml = '';
        if (Array.isArray(data.bondAngles) && data.bondAngles.length > 0) {
            bondAngleHtml = '<br><strong>Bond angles:</strong><br>' +
                data.bondAngles.map(item => {
                    const [a, b] = item.atoms;
                    const labelA = `${a.symbol}${a.id}`;
                    const labelB = `${b.symbol}${b.id}`;
                    return `${labelA} — ${labelB}: ${item.angle.toFixed(1)}°`;
                }).join('<br>');
        } else if (data.bondCount === 1) {
            bondAngleHtml = '<br><em>Only one bonded neighbor; no angle to display.</em>';
        }

        const atomLabel = `${data.symbol}${data.id}`;
        atomTooltip.innerHTML = `
            <strong>${atomLabel} — ${data.name} (${data.symbol})</strong><br>
            Weight: ${data.atomicWeight}u<br>
            Bonds: ${data.bondCount}${bondAngleHtml}
        `;
        atomTooltip.style.display = 'block';
        atomTooltip.style.left = `${event.clientX + 10}px`;
        atomTooltip.style.top = `${event.clientY + 10}px`;
    });
}

function clearHighlight() {
    if (previousHighlightedObj) {
        previousHighlightedObj.material.color.copy(originalColor || previousHighlightedObj.material.color);
        previousHighlightedObj = null;
    }
    atomTooltip.style.display = 'none';
}

function handleResponse(data) {
    if (data.error) {
        showError(data.error);
        if (data.community_entries) {
            showCommunityEntries(data.community_entries, 'Molecule not found in PubChem/OPSIN, but community entries were found for that name.', true);
        } else {
            hideCommunityEntries();
        }
        return;
    }

    hideError();
    if (!communityPanelVisible) {
        hideCommunityEntries();
    }

    updateProgress(35, 'Molecule data received. Preparing render...');

    if (!Array.isArray(data.atoms) || data.atoms.length === 0) {
        showError('Render failed: no atom coordinates received.', false);
        return;
    }
    if (!Array.isArray(data.bonds)) {
        data.bonds = [];
    }
    if (!Array.isArray(data.assembly_instructions) || data.assembly_instructions.length === 0) {
        data.assembly_instructions = [{ type: 'monomer', is_polymer: false }];
    }

    moleculeState.atoms = data.atoms.filter(atom => atom && typeof atom.x === 'number' && typeof atom.y === 'number' && typeof atom.z === 'number');
    moleculeState.bonds = data.bonds.filter(bond => {
        return bond && Number.isInteger(bond.start) && Number.isInteger(bond.end) &&
            bond.start >= 0 && bond.end >= 0 &&
            bond.start < data.atoms.length && bond.end < data.atoms.length;
    });
    moleculeState.assembly_instructions = data.assembly_instructions;
    moleculeState.isLoaded = true;
    moleculeState.numChains = getDefaultChainCount(moleculeState.atoms.length);
    moleculeState.lowDetailMode = document.getElementById('lowDetailMode')?.checked === true;
    
    // Display molecular data in right sidebar
    displayMolecularData(data);
    
    onDataReady();
}

function cleanupScene() {
    clearHighlight();
    if (currentAnimationId !== null) {
        cancelAnimationFrame(currentAnimationId);
        currentAnimationId = null;
    }
    if (currentRenderer) {
        currentRenderer.dispose();
        if (currentRenderer.domElement && currentRenderer.domElement.parentNode) {
            currentRenderer.domElement.parentNode.removeChild(currentRenderer.domElement);
        }
        currentRenderer = null;
    }
    activeCamera = null;
    freeCameraState.lastTime = null;
}

function getSphereGeometry(radius, detail) {
    const key = `${radius.toFixed(4)}:${detail}`;
    if (!sphereGeometryCache.has(key)) {
        sphereGeometryCache.set(key, new THREE.SphereGeometry(radius, detail, detail));
    }
    return sphereGeometryCache.get(key);
}

function getShellGeometry(radius, detail) {
    const key = `${radius.toFixed(4)}:${detail}`;
    if (!shellGeometryCache.has(key)) {
        shellGeometryCache.set(key, new THREE.SphereGeometry(radius, detail, detail));
    }
    return shellGeometryCache.get(key);
}

function getShellMaterial(symbol) {
    if (!shellMaterialCache.has(symbol)) {
        const base = standardAtomDict[symbol] || standardAtomDict['Default'];
        const shellMaterial = base.clone();
        shellMaterial.transparent = true;
        shellMaterial.opacity = 0.18;
        shellMaterial.depthWrite = false;
        shellMaterial.side = THREE.DoubleSide;
        shellMaterialCache.set(symbol, shellMaterial);
    }
    return shellMaterialCache.get(symbol);
}

function getSphereDetail(atomCount, lowDetail = false) {
    if (atomCount > 800) return lowDetail ? 4 : 8;
    if (atomCount > 400) return lowDetail ? 6 : 10;
    if (atomCount > 200) return lowDetail ? 8 : 12;
    return lowDetail ? 12 : 16;
}

function getBondGeometry() {
    if (!bondGeometry) {
        bondGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 6);
    }
    return bondGeometry;
}

function getDefaultChainCount(atomCount) {
    if (atomCount > 250) return 2;
    if (atomCount > 120) return 3;
    return 10;
}

function showCommunityEntries(entries, message, autoLoad = false) {
    const messageNode = document.getElementById('community-message');
    const suggestions = document.getElementById('community-suggestions');
    const list = document.getElementById('communityEntriesList');

    messageNode.style.display = 'block';
    messageNode.style.color = '#333';
    messageNode.textContent = message || 'Community entries found for this name.';

    list.innerHTML = '';
    selectedCommunityEntryId = null;
    communityPanelVisible = true;

    entries.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'community-entry';
        row.dataset.entryId = entry.id;

        const header = document.createElement('div');
        header.className = 'community-entry-header';

        const smilesText = document.createElement('span');
        smilesText.className = 'community-entry-smiles';
        smilesText.textContent = entry.smiles;
        smilesText.title = 'Click to render this SMILES entry';
        smilesText.addEventListener('click', () => selectCommunityEntry(entry.id, entry.smiles));

        const score = document.createElement('span');
        score.className = 'community-entry-score';
        score.textContent = `score ${entry.score}`;

        header.appendChild(smilesText);
        header.appendChild(score);

        const voteRow = document.createElement('div');
        voteRow.className = 'vote-row';

        const upButton = document.createElement('button');
        upButton.className = 'vote-button upvote';
        upButton.innerHTML = `▲ <span class="vote-count">${entry.upvotes}</span>`;
        upButton.type = 'button';
        upButton.addEventListener('click', (event) => {
            event.stopPropagation();
            handleCommunityVote(entry.id, 'up');
        });

        const downButton = document.createElement('button');
        downButton.className = 'vote-button downvote';
        downButton.innerHTML = `▼ <span class="vote-count">${entry.downvotes}</span>`;
        downButton.type = 'button';
        downButton.addEventListener('click', (event) => {
            event.stopPropagation();
            handleCommunityVote(entry.id, 'down');
        });

        voteRow.appendChild(upButton);
        voteRow.appendChild(downButton);

        const statusLine = document.createElement('div');
        statusLine.className = 'vote-status';
        statusLine.textContent = '';
        statusLine.style.display = 'none';

        row.appendChild(header);
        row.appendChild(voteRow);
        row.appendChild(statusLine);
        list.appendChild(row);

        const currentVote = entry.user_vote || null;
        communityVoteState[entry.id] = currentVote;
        if (currentVote) {
            updateCommunityEntryButtons(entry.id);
        }
    });

    suggestions.style.display = 'block';
    if (autoLoad && entries.length) {
        selectCommunityEntry(entries[0].id, entries[0].smiles);
    }
}

function hideCommunityEntries() {
    document.getElementById('community-message').style.display = 'none';
    document.getElementById('community-suggestions').style.display = 'none';
    document.getElementById('communityEntriesList').innerHTML = '';
    selectedCommunityEntryId = null;
    communityPanelVisible = false;
}

function selectCommunityEntry(entryId, smiles) {
    selectedCommunityEntryId = entryId;
    document.querySelectorAll('.community-entry').forEach((el) => {
        el.classList.toggle('selected', el.dataset.entryId === String(entryId));
    });

    const settings = getMoleculeSettings();
    const polymerMatch = smiles.trim().match(/^\s*\[([^\]]+)\]n\s*$/i);
    const forcePolymerization = settings.forcePolymerization || Boolean(polymerMatch);
    loadMoleculeBySmiles(smiles, forcePolymerization);
}

function setCommunityEntryButtonsEnabled(entryId, enabled) {
    const entryRow = document.querySelector(`.community-entry[data-entry-id="${entryId}"]`);
    if (!entryRow) return;
    entryRow.querySelectorAll('.vote-button').forEach((button) => {
        button.disabled = !enabled;
    });
}

async function handleCommunityVote(entryId, voteType) {
    const previousVote = communityVoteState[entryId] || null;
    const newVote = previousVote === voteType ? 'none' : voteType;
    const entryRow = document.querySelector(`.community-entry[data-entry-id="${entryId}"]`);
    const upCountEl = entryRow?.querySelector('.vote-button.upvote .vote-count');
    const downCountEl = entryRow?.querySelector('.vote-button.downvote .vote-count');
    const previousUp = upCountEl ? Number(upCountEl.textContent) : 0;
    const previousDown = downCountEl ? Number(downCountEl.textContent) : 0;
    let optimisticUp = previousUp;
    let optimisticDown = previousDown;

    if (newVote === 'none') {
        if (previousVote === 'up') optimisticUp = Math.max(0, optimisticUp - 1);
        else if (previousVote === 'down') optimisticDown = Math.max(0, optimisticDown - 1);
    } else if (previousVote === null) {
        if (newVote === 'up') optimisticUp += 1;
        else optimisticDown += 1;
    } else if (previousVote !== newVote) {
        if (newVote === 'up') {
            optimisticUp += 1;
            optimisticDown = Math.max(0, optimisticDown - 1);
        } else {
            optimisticDown += 1;
            optimisticUp = Math.max(0, optimisticUp - 1);
        }
    }

    const statusNode = entryRow?.querySelector('.vote-status');
    communityVoteState[entryId] = newVote === 'none' ? null : newVote;
    updateCommunityEntryUI(entryId, optimisticUp, optimisticDown);
    updateCommunityEntryButtons(entryId);
    setCommunityEntryButtonsEnabled(entryId, false);
    entryRow?.classList.add('vote-pending');
    if (statusNode) {
        statusNode.textContent = 'Voting...';
        statusNode.style.display = 'block';
    }

    setTimeout(async () => {
        try {
            const { response, data } = await fetchJson('/renderbackend/community/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry_id: Number(entryId),
                    vote: newVote,
                    voter_id: voterId
                })
            });
            if (!response.ok) {
                console.error('Vote request failed', data);
                communityVoteState[entryId] = previousVote;
                updateCommunityEntryUI(entryId, previousUp, previousDown);
                updateCommunityEntryButtons(entryId);
                return;
            }

            communityVoteState[entryId] = data.vote || null;
            updateCommunityEntryUI(entryId, data.upvotes, data.downvotes);
            updateCommunityEntryButtons(entryId);
        } catch (error) {
            console.error('Failed to submit community vote:', error);
            communityVoteState[entryId] = previousVote;
            updateCommunityEntryUI(entryId, previousUp, previousDown);
            updateCommunityEntryButtons(entryId);
        } finally {
            if (statusNode) {
                statusNode.textContent = '';
                statusNode.style.display = 'none';
            }
            entryRow?.classList.remove('vote-pending');
            setCommunityEntryButtonsEnabled(entryId, true);
        }
    }, 0);
}

function updateCommunityEntryUI(entryId, upvotes, downvotes) {
    const entryRow = document.querySelector(`.community-entry[data-entry-id="${entryId}"]`);
    if (!entryRow) return;

    const upButton = entryRow.querySelector('.vote-button.upvote .vote-count');
    const downButton = entryRow.querySelector('.vote-button.downvote .vote-count');
    if (upButton) upButton.textContent = upvotes;
    if (downButton) downButton.textContent = downvotes;
}

function updateCommunityEntryButtons(entryId) {
    const entryRow = document.querySelector(`.community-entry[data-entry-id="${entryId}"]`);
    if (!entryRow) return;
    const upButton = entryRow.querySelector('.vote-button.upvote');
    const downButton = entryRow.querySelector('.vote-button.downvote');
    const state = communityVoteState[entryId] || null;
    if (upButton) upButton.classList.toggle('active', state === 'up');
    if (downButton) downButton.classList.toggle('active', state === 'down');
}

async function loadCommunityEntriesByName(name, autoLoad = false) {
    if (!name || name.length < 2) {
        hideCommunityEntries();
        return;
    }

    try {
            const url = `/renderbackend/community/entries?name=${encodeURIComponent(name)}` + (voterId ? `&voter_id=${encodeURIComponent(voterId)}` : '');
            const { response, data } = await fetchJson(url);
        if (!response.ok) {
            console.error('Community entries request failed', data);
            hideCommunityEntries();
            return;
        }

        if (data.community_entries && data.community_entries.length > 0) {
            showCommunityEntries(data.community_entries, 'Community entries available for this name. Select one to render it.', autoLoad);
        } else {
            hideCommunityEntries();
        }
    } catch (error) {
        console.error('Failed to load community entries:', error);
        hideCommunityEntries();
    }
}

async function submitCommunityEntry(event) {
    event.preventDefault();
    const name = document.getElementById('communityNameInput').value.trim();
    const smiles = document.getElementById('communitySmilesInput').value.trim();
    const status = document.getElementById('communityAddStatus');

    status.style.display = 'none';
    status.textContent = '';

    if (!name || !smiles) {
        status.style.display = 'block';
        status.style.color = '#cc0000';
        status.textContent = 'Please provide both a name and a SMILES string.';
        return;
    }

    try {
        const { response, data } = await fetchJson('/renderbackend/community/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, smiles })
        });

        if (response.ok) {
            status.style.display = 'block';
            status.style.color = '#006600';
            status.textContent = data.message || 'Community entry added successfully.';
        } else {
            status.style.display = 'block';
            status.style.color = '#cc0000';
            status.textContent = data.error || 'Failed to add community entry.';
        }
    } catch (error) {
        status.style.display = 'block';
        status.style.color = '#cc0000';
        status.textContent = 'Unable to reach the community API.';
    }
}

function syncCommunityName() {
    const nameInput = document.getElementById('moleculeName');
    const communityNameInput = document.getElementById('communityNameInput');
    if (nameInput && communityNameInput) {
        communityNameInput.value = nameInput.value;
    }
}

function displayMolecularData(data) {
    // Display molecular / alternate formulas and enable cycling on click
    const formulaDisplay = document.getElementById('molecularFormulaDisplay');
    const formulaLabel = document.getElementById('molecularFormulaLabel');

    const formulas = {
        molecular: data.molecular_formula.replace(/(\d+)/g, "<sub>$1</sub>") || '',
        empirical: data.empirical_formula.replace(/(\d+)/g, "<sub>$1</sub>") || '',
        condensed: data.condensed_formula.replace(/(\d+)/g, "<sub>$1</sub>") || '',
        smiles: data.smiles || data.smiles_string || ''
    };

    const labelFor = {
        molecular: 'Molecular Formula',
        empirical: 'Empirical Formula',
        condensed: 'Condensed Formula',
        smiles: 'SMILES Formula'
    };

    const order = ['molecular', 'empirical', 'condensed', 'smiles'];
    const available = order.filter(k => formulas[k] && String(formulas[k]).trim());

    const parentSection = formulaDisplay ? formulaDisplay.closest('.info-section') : null;

    function updateFormulaView(availList, idx) {
        const key = availList[idx];
        const val = (formulaDisplay._formulaData && formulaDisplay._formulaData[key]) || '';
        formulaDisplay.innerHTML = val || '-';
        if (formulaLabel) formulaLabel.textContent = labelFor[key] || 'Formula';
    }

    if (available.length === 0) {
        formulaDisplay.textContent = '-';
        if (formulaLabel) formulaLabel.textContent = 'Formula';
        if (parentSection) parentSection.style.cursor = 'default';
        formulaDisplay.style.cursor = 'default';
        formulaDisplay.removeAttribute('role');
        formulaDisplay.removeAttribute('aria-label');
        formulaDisplay.removeAttribute('title');
        formulaDisplay.tabIndex = -1;
        // clear previous state
        formulaDisplay._formulaData = {};
        formulaDisplay._available = [];
        formulaDisplay._index = 0;
    } else {
        // initialize element state (reset on every update)
        formulaDisplay._formulaData = formulas;
        formulaDisplay._available = available;
        formulaDisplay._index = 0;
        updateFormulaView(available, 0);
        if (parentSection) parentSection.style.cursor = 'pointer';
        formulaDisplay.style.cursor = 'pointer';
        formulaDisplay.setAttribute('role', 'button');
        formulaDisplay.setAttribute('aria-label', 'Cycle formula formats');
        formulaDisplay.setAttribute('title', 'Click or press Enter/Space to cycle formula formats');
        formulaDisplay.tabIndex = 0;

        const attachTo = parentSection || formulaDisplay;
        if (!attachTo._formulaClickAttached) {
            const doCycle = (e) => {
                // ignore when no available
                const avail = formulaDisplay._available || available;
                if (!avail || avail.length === 0) return;
                formulaDisplay._index = (Number(formulaDisplay._index) + 1) % avail.length;
                updateFormulaView(avail, formulaDisplay._index);
            };

            attachTo.addEventListener('click', doCycle);
            attachTo.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    doCycle();
                }
            });
            attachTo._formulaClickAttached = true;
        }
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
    cleanupScene();
    container.innerHTML = ''; 
    showLoading('Rendering molecule...', 40);
    document.getElementById('error-message').style.display = 'none';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const deviceRatio = Math.min(window.devicePixelRatio || 1, moleculeState.atoms.length > 300 ? 1 : 1.5);
    renderer.setPixelRatio(deviceRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    currentRenderer = renderer;

    setActiveCamera(camera);
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const instr = moleculeState.assembly_instructions[0];

    // Branching logic: Monomer vs Polymer
    if (instr && instr.is_polymer) {
        renderPolymerChain(mainGroup, instr);
    } else {
        renderSingleMonomer(mainGroup, moleculeState.atoms, moleculeState.bonds);
    }

    setupInteraction(scene, camera, renderer);

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
    updateProgress(100, 'Render complete');
    hideLoading();

    function animate(time) {
        currentAnimationId = requestAnimationFrame(animate);
        updateCameraMovement(time);
        renderer.render(scene, camera);
    }
    animate();
}

function renderSingleMonomer(group, atoms, bonds) {
    if (!Array.isArray(atoms) || atoms.length === 0) {
        console.error('renderSingleMonomer: no atoms to render.');
        return;
    }
    const mode = document.getElementById('displayMode').value;
    const lowDetail = moleculeState.lowDetailMode;
    const sphereDetail = getSphereDetail(atoms.length, lowDetail);
    const totalRenderSteps = Math.max(1, atoms.length + bonds.length);
    let processedSteps = 0;
    const updateStep = () => {
        processedSteps += 1;
        if (processedSteps % 5 === 0 || processedSteps === totalRenderSteps) {
            updateProgress(40 + Math.round(50 * processedSteps / totalRenderSteps), 'Rendering molecule...');
        }
    };
    atoms.forEach(atom => {
        if (!atom || typeof atom.x !== 'number' || typeof atom.y !== 'number' || typeof atom.z !== 'number') {
            console.warn('Skipping invalid atom during render:', atom);
            return;
        }
        const baseRadius = (standardRadiiDict[atom.symbol] || standardRadiiDict["Default"]) * 0.3;
        const atomMaterial = standardAtomDict[atom.symbol] || standardAtomDict["Default"];

        // Render the solid atom sphere always.
        const coreGeometry = getSphereGeometry(baseRadius, sphereDetail);
        const coreMesh = new THREE.Mesh(coreGeometry, atomMaterial);
        coreMesh.position.set(atom.x, atom.y, atom.z);
        coreMesh.userData.atomId = atom.id;
        coreMesh.userData.atom = atom;
        group.add(coreMesh);

        if (!lowDetail && atom.charge && atom.charge !== 0) {
            const chargeText = formatChargeSymbol(atom.charge);
            const label = createChargeLabel(`${atom.symbol}${chargeText}`);
            label.position.copy(coreMesh.position);
            label.position.y += baseRadius + 0.25;
            group.add(label);
        }

        // Space-filling mode adds a transparent outer shell.
        if (mode === 'space-filling') {
            const shellRadius = (standardRadiiDict[atom.symbol] || standardRadiiDict["Default"]);
            const shellMaterial = getShellMaterial(atom.symbol);
            const shellGeometry = getShellGeometry(shellRadius, sphereDetail);
            const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
            shellMesh.position.copy(coreMesh.position);
            group.add(shellMesh);
        }
        updateStep();
    });

    bonds.forEach(bond => {
        if (!bond || typeof bond.start !== 'number' || typeof bond.end !== 'number') {
            console.warn('Skipping invalid bond during render:', bond);
            return;
        }
        const atomA = atoms[bond.start];
        const atomB = atoms[bond.end];
        if (!atomA || !atomB) {
            console.warn('Skipping bond with missing atom indices:', bond);
            return;
        }
        const v1 = new THREE.Vector3(atomA.x, atomA.y, atomA.z);
        const v2 = new THREE.Vector3(atomB.x, atomB.y, atomB.z);
        const bondType = bond.type ? String(bond.type).toUpperCase() : 'SINGLE';
        const isIonicBond = bondType === 'IONIC';
        group.add(isIonicBond ? createIonicLink(v1, v2) : createBond(v1, v2, bondType));
        updateStep();
    });

    renderIonicInteractions(group, atoms, bonds);
}

function renderPolymerChain(parentGroup, instr) {
    const atoms = moleculeState.atoms;
    if (!Array.isArray(atoms) || atoms.length === 0) {
        console.error('renderPolymerChain: no atoms available.');
        return;
    }
    const headAtom = atoms[instr.head_idx];
    const tailAtom = atoms[instr.tail_idx];
    if (!headAtom || !tailAtom) {
        console.warn('renderPolymerChain: invalid polymer indices, falling back to monomer render.', instr);
        renderSingleMonomer(parentGroup, atoms, moleculeState.bonds);
        return;
    }
    const head = new THREE.Vector3(headAtom.x, headAtom.y, headAtom.z);
    const tail = new THREE.Vector3(tailAtom.x, tailAtom.y, tailAtom.z);
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
    let moleculeData = inputType === "name" ? 
        document.getElementById('moleculeName').value : 
        document.getElementById('smilesValue').value;

    const forcePolymerizationInput = document.getElementById('forcePolymerization');
    let forcePolymerization = forcePolymerizationInput ? forcePolymerizationInput.checked : false;

    if (inputType === 'smiles') {
        const polymerMatch = moleculeData.trim().match(/^\s*\[([^\]]+)\]n\s*$/i);
        if (polymerMatch) {
            moleculeData = polymerMatch[1];
            forcePolymerization = true;
        }
    }

    return {
        omitHydrogens: document.getElementById('omitHydrogens').checked,
        lowDetailMode: document.getElementById('lowDetailMode').checked,
        forcePolymerization,
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
        lastRenderedSettings.lowDetailMode === data.lowDetailMode &&
        lastRenderedSettings.forcePolymerization === data.forcePolymerization &&
        lastRenderedSettings.displayMode === data.displayMode) {
        return;
    }
    
    lastRenderedSettings = { ...data, algorithms: [...data.algorithms] };
    if (!data.moleculeData || data.moleculeData.length < 2) {
        hideCommunityEntries();
        return;
    }

    if (data.inputType === "name") {
        loadMoleculeByName(data.moleculeData, data.algorithms, data.forcePolymerization);
        loadCommunityEntriesByName(data.moleculeData, false);
    } else {
        hideCommunityEntries();
        loadMoleculeBySmiles(data.moleculeData, data.forcePolymerization);
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

    const communityAddButton = document.getElementById('communityAddButton');
    const moleculeNameInput = document.getElementById('moleculeName');
    const communityNameInput = document.getElementById('communityNameInput');

    if (communityAddButton) {
        communityAddButton.addEventListener('click', submitCommunityEntry);
    }

    if (moleculeNameInput && communityNameInput) {
        moleculeNameInput.addEventListener('input', syncCommunityName);
        syncCommunityName();
    }

    const advancedMovementToggle = document.getElementById('advancedMovement');
    if (advancedMovementToggle) {
        advancedMovementToggle.addEventListener('change', () => {
            syncCameraControlMode();
        });
    }

    setupCameraControls(document.getElementById('scene-container'));
}

function setupCameraControls(container) {
    if (!container || freeCameraState.controlsInitialized) return;
    freeCameraState.controlsInitialized = true;

    const handleKey = (event, isDown) => {
        switch (event.key.toLowerCase()) {
            case 'w': freeCameraState.moveForward = isDown; break;
            case 's': freeCameraState.moveBackward = isDown; break;
            case 'a': freeCameraState.moveLeft = isDown; break;
            case 'd': freeCameraState.moveRight = isDown; break;
            case 'q': freeCameraState.moveDown = isDown; break;
            case 'e': freeCameraState.moveUp = isDown; break;
        }
    };

    window.addEventListener('keydown', (event) => handleKey(event, true));
    window.addEventListener('keyup', (event) => handleKey(event, false));

    container.addEventListener('pointerdown', (event) => {
        freeCameraState.isPointerDown = true;
        freeCameraState.pointerX = event.clientX;
        freeCameraState.pointerY = event.clientY;
        container.style.cursor = 'grabbing';
    });

    container.addEventListener('pointermove', (event) => {
        if (!freeCameraState.isPointerDown) return;
        const deltaX = event.clientX - freeCameraState.pointerX;
        const deltaY = event.clientY - freeCameraState.pointerY;
        freeCameraState.pointerX = event.clientX;
        freeCameraState.pointerY = event.clientY;

        const turnSpeed = 0.003;
        freeCameraState.yaw -= deltaX * turnSpeed;
        freeCameraState.pitch += deltaY * turnSpeed;
        freeCameraState.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, freeCameraState.pitch));
        if (!activeCamera) return;

        if (getAdvancedMovementEnabled()) {
            activeCamera.rotation.order = 'YXZ';
            activeCamera.rotation.y = freeCameraState.yaw;
            activeCamera.rotation.x = freeCameraState.pitch;
        } else {
            updateOrbitPosition();
        }
    });

    container.addEventListener('wheel', (event) => {
        if (getAdvancedMovementEnabled() || !activeCamera) return;
        event.preventDefault();
        freeCameraState.orbitRadius = Math.max(3, freeCameraState.orbitRadius + event.deltaY * 0.02);
        updateOrbitPosition();
    }, { passive: false });

    container.addEventListener('pointerup', () => {
        freeCameraState.isPointerDown = false;
        container.style.cursor = 'grab';
    });

    container.addEventListener('pointerleave', () => {
        freeCameraState.isPointerDown = false;
        container.style.cursor = 'grab';
    });
}

function setActiveCamera(camera) {
    activeCamera = camera;
    if (activeCamera) {
        activeCamera.rotation.order = 'YXZ';
        freeCameraState.yaw = activeCamera.rotation.y;
        freeCameraState.pitch = activeCamera.rotation.x;
        freeCameraState.orbitRadius = activeCamera.position.length();
        syncCameraControlMode();
    }
}

function getAdvancedMovementEnabled() {
    return document.getElementById('advancedMovement')?.checked === true;
}

function updateOrbitPosition() {
    if (!activeCamera) return;
    const radius = Math.max(3, freeCameraState.orbitRadius);
    const phi = Math.max(0.1, Math.min(Math.PI - 0.1, Math.PI / 2 - freeCameraState.pitch));
    const x = radius * Math.sin(phi) * Math.sin(freeCameraState.yaw);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(freeCameraState.yaw);
    activeCamera.position.set(x, y, z);
    activeCamera.lookAt(0, 0, 0);
}

function syncCameraControlMode() {
    if (!activeCamera) return;
    if (getAdvancedMovementEnabled()) {
        activeCamera.rotation.order = 'YXZ';
        freeCameraState.yaw = activeCamera.rotation.y;
        freeCameraState.pitch = activeCamera.rotation.x;
    } else {
        freeCameraState.moveForward = false;
        freeCameraState.moveBackward = false;
        freeCameraState.moveLeft = false;
        freeCameraState.moveRight = false;
        freeCameraState.moveUp = false;
        freeCameraState.moveDown = false;
        freeCameraState.orbitRadius = Math.max(3, activeCamera.position.length());
        updateOrbitPosition();
    }
}

function updateCameraMovement(timestamp) {
    if (!activeCamera || !getAdvancedMovementEnabled()) return;
    if (!freeCameraState.lastTime) {
        freeCameraState.lastTime = timestamp || performance.now();
    }
    const delta = ((timestamp || performance.now()) - freeCameraState.lastTime) / 1000;
    freeCameraState.lastTime = timestamp || performance.now();

    const speed = 6.0;
    const velocity = new THREE.Vector3();
    if (freeCameraState.moveForward) velocity.z -= 1;
    if (freeCameraState.moveBackward) velocity.z += 1;
    if (freeCameraState.moveLeft) velocity.x += 1;
    if (freeCameraState.moveRight) velocity.x -= 1;
    if (freeCameraState.moveUp) velocity.y += 1;
    if (freeCameraState.moveDown) velocity.y -= 1;
    if (velocity.lengthSq() === 0) return;

    velocity.normalize().multiplyScalar(speed * delta);
    const move = new THREE.Vector3();
    activeCamera.getWorldDirection(move);
    move.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(activeCamera.up, move).normalize();

    activeCamera.position.addScaledVector(move, -velocity.z);
    activeCamera.position.addScaledVector(right, velocity.x);
    activeCamera.position.y += velocity.y;
}

function createChargeLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.8, 0.9, 1);
    return sprite;
}

function formatChargeSymbol(charge) {
    if (!charge || charge === 0) return '';
    const absCharge = Math.abs(charge);
    const sign = charge > 0 ? '+' : '−';
    return absCharge === 1 ? sign : `${absCharge}${sign}`;
}

function createBond(vStart, vEnd, type = 'SINGLE') {
    type = String(type || 'SINGLE').toUpperCase();
    if (type === '2' || type === 'DOUBLE') {
        return createMultipleBond(vStart, vEnd, 2);
    }
    if (type === '3' || type === 'TRIPLE') {
        return createMultipleBond(vStart, vEnd, 3);
    }
    if (type === 'AROMATIC') {
        return createAromaticBond(vStart, vEnd);
    }
    return createSingleBond(vStart, vEnd);
}

function createSingleBond(vStart, vEnd) {
    const dist = vStart.distanceTo(vEnd);
    const geom = getBondGeometry();
    const mesh = new THREE.Mesh(geom, standardBondMaterial);
    mesh.position.copy(vStart).add(vEnd).multiplyScalar(0.5);
    mesh.scale.set(1, dist, 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vEnd.clone().sub(vStart).normalize());
    return mesh;
}

function getPerpendicularVector(direction) {
    const axis = Math.abs(direction.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    return new THREE.Vector3().crossVectors(direction, axis).normalize();
}

function createMultipleBond(vStart, vEnd, count) {
    const group = new THREE.Group();
    const direction = vEnd.clone().sub(vStart).normalize();
    const offsetDir = getPerpendicularVector(direction).multiplyScalar(0.15);
    for (let i = 0; i < count; i++) {
        const offset = offsetDir.clone().multiplyScalar(i - (count - 1) / 2);
        const start = vStart.clone().add(offset);
        const end = vEnd.clone().add(offset);
        group.add(createSingleBond(start, end));
    }
    return group;
}

function createAromaticBond(vStart, vEnd) {
    const group = new THREE.Group();
    group.add(createSingleBond(vStart, vEnd));
    const points = [vStart.clone(), vEnd.clone()];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geom, aromaticBondMaterial);
    line.computeLineDistances();
    group.add(line);
    return group;
}

function createIonicLink(vStart, vEnd) {
    const points = [vStart.clone(), vEnd.clone()];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geom, ionicLinkMaterial);
    line.computeLineDistances();
    return line;
}

function renderIonicInteractions(group, atoms, bonds) {
    const covalentPairs = new Set(bonds.map(b => {
        const start = Math.min(b.start, b.end);
        const end = Math.max(b.start, b.end);
        return `${start}-${end}`;
    }));

    const chargedAtoms = atoms.filter(atom => atom.charge && atom.charge !== 0);
    const positives = chargedAtoms.filter(atom => atom.charge > 0);
    const negatives = chargedAtoms.filter(atom => atom.charge < 0);
    if (positives.length === 0 || negatives.length === 0) {
        return;
    }

    const drawnPairs = new Set();
    positives.forEach(pos => {
        let nearest = null;
        let minDist = Infinity;
        negatives.forEach(neg => {
            const key = `${Math.min(pos.id, neg.id)}-${Math.max(pos.id, neg.id)}`;
            if (covalentPairs.has(key)) return;
            const v1 = new THREE.Vector3(pos.x, pos.y, pos.z);
            const v2 = new THREE.Vector3(neg.x, neg.y, neg.z);
            const d = v1.distanceTo(v2);
            if (d < minDist) {
                minDist = d;
                nearest = neg;
            }
        });

        if (nearest) {
            const key = `${Math.min(pos.id, nearest.id)}-${Math.max(pos.id, nearest.id)}`;
            if (!drawnPairs.has(key)) {
                drawnPairs.add(key);
                const v1 = new THREE.Vector3(pos.x, pos.y, pos.z);
                const v2 = new THREE.Vector3(nearest.x, nearest.y, nearest.z);
                group.add(createIonicLink(v1, v2));
            }
        }
    });
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

function setLoadingMessage(message) {
    const label = document.getElementById('progress-message');
    if (label) label.textContent = String(message || 'Loading molecule...');
}

function setProgress(value, message) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const normalized = Math.min(100, Math.max(0, Number(value) || 0));
    if (progressBar) progressBar.style.width = `${normalized}%`;
    if (progressText) progressText.textContent = message ? `${String(message)} (${Math.round(normalized)}%)` : `${Math.round(normalized)}%`;
}

function updateProgress(value, message) {
    if (message) setLoadingMessage(message);
    setProgress(value, message);
}

function showLoading(message = 'Loading molecule...', initialProgress = 0) {
    const loading = document.getElementById('loading-screen');
    if (!loading) return;
    loading.style.display = 'block';
    setLoadingMessage(message);
    setProgress(initialProgress, message);
}

function hideLoading() { document.getElementById('loading-screen').style.display = 'none'; }
function showError(m, allowRetry = true) {
    hideLoading();
    const el = document.getElementById('error-message');
    const safeMsg = String(m || 'Unknown error');
    el.innerHTML = `<div>${safeMsg}</div>` + (allowRetry ? `<div style="margin-top:8px"><button id='err-retry' style='margin-right:8px'>Retry</button><button id='err-dismiss'>Dismiss</button></div>` : `<div style="margin-top:8px"><button id='err-dismiss'>Dismiss</button></div>`);
    el.style.display = 'block';
    const retryBtn = document.getElementById('err-retry');
    const dismissBtn = document.getElementById('err-dismiss');
    if (retryBtn) retryBtn.addEventListener('click', () => { hideError(); triggerAutoRender(); });
    if (dismissBtn) dismissBtn.addEventListener('click', hideError);
}
function hideError() { const el = document.getElementById('error-message'); if (el) el.style.display = 'none'; }
function handleErr(e) { console.error('Network/error:', e); const msg = (e && e.message) ? `Connection failed: ${e.message}` : `Connection failed: ${String(e)}`; showError(msg, true); }

document.getElementById('numChains').addEventListener('input', function() {
    moleculeState.numChains = parseInt(this.value);
    document.getElementById('numChainsValue').textContent = this.value;
    onDataReady();
});

document.addEventListener('DOMContentLoaded', setupAutoRender);