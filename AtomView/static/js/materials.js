//This file was procedurally generated using gemini based on the CPK colouring scheme and Van der Waals radii.
import * as THREE from 'three';


export const standardAtomDict = {
    // --- Period 1 ---
    "H":  new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.0, roughness: 0.4 }),
    "He": new THREE.MeshStandardMaterial({ color: 0xd9ffff, metalness: 0.0, roughness: 0.2 }),

    // --- Period 2 ---
    "Li": new THREE.MeshStandardMaterial({ color: 0xcc80ff, metalness: 0.3, roughness: 0.3 }),
    "Be": new THREE.MeshStandardMaterial({ color: 0xc2ff00, metalness: 0.3, roughness: 0.3 }),
    "B":  new THREE.MeshStandardMaterial({ color: 0xffb5b5, metalness: 0.0, roughness: 0.6 }),
    "C":  new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.1, roughness: 0.8 }),
    "N":  new THREE.MeshStandardMaterial({ color: 0x3050f8, metalness: 0.0, roughness: 0.4 }),
    "O":  new THREE.MeshStandardMaterial({ color: 0xff0d0d, metalness: 0.0, roughness: 0.4 }),
    "F":  new THREE.MeshStandardMaterial({ color: 0x90e050, metalness: 0.0, roughness: 0.4 }),
    "Ne": new THREE.MeshStandardMaterial({ color: 0xb3e3f5, metalness: 0.0, roughness: 0.2 }),

    // --- Period 3 ---
    "Na": new THREE.MeshStandardMaterial({ color: 0xab5cf2, metalness: 0.3, roughness: 0.3 }),
    "Mg": new THREE.MeshStandardMaterial({ color: 0x8aff00, metalness: 0.3, roughness: 0.3 }),
    "Al": new THREE.MeshStandardMaterial({ color: 0xbfa6a6, metalness: 0.4, roughness: 0.3 }),
    "Si": new THREE.MeshStandardMaterial({ color: 0xf0c8a0, metalness: 0.2, roughness: 0.5 }),
    "P":  new THREE.MeshStandardMaterial({ color: 0xff8000, metalness: 0.0, roughness: 0.5 }),
    "S":  new THREE.MeshStandardMaterial({ color: 0xffff30, metalness: 0.0, roughness: 0.5 }),
    "Cl": new THREE.MeshStandardMaterial({ color: 0x1ff01f, metalness: 0.0, roughness: 0.4 }),
    "Ar": new THREE.MeshStandardMaterial({ color: 0x80d1e3, metalness: 0.0, roughness: 0.2 }),

    // --- Period 4 (Transition Metals start) ---
    "K":  new THREE.MeshStandardMaterial({ color: 0x8f40d4, metalness: 0.3, roughness: 0.3 }),
    "Ca": new THREE.MeshStandardMaterial({ color: 0x3dff00, metalness: 0.3, roughness: 0.3 }),
    "Sc": new THREE.MeshStandardMaterial({ color: 0xe6e6e6, metalness: 0.5, roughness: 0.2 }),
    "Ti": new THREE.MeshStandardMaterial({ color: 0xbfc2c7, metalness: 0.6, roughness: 0.2 }),
    "V":  new THREE.MeshStandardMaterial({ color: 0xa6a6ab, metalness: 0.6, roughness: 0.2 }),
    "Cr": new THREE.MeshStandardMaterial({ color: 0x8a99c7, metalness: 0.6, roughness: 0.2 }),
    "Mn": new THREE.MeshStandardMaterial({ color: 0x9c7ac7, metalness: 0.5, roughness: 0.2 }),
    "Fe": new THREE.MeshStandardMaterial({ color: 0xe06633, metalness: 0.5, roughness: 0.3 }),
    "Co": new THREE.MeshStandardMaterial({ color: 0xf090a0, metalness: 0.5, roughness: 0.2 }),
    "Ni": new THREE.MeshStandardMaterial({ color: 0x50d050, metalness: 0.5, roughness: 0.2 }),
    "Cu": new THREE.MeshStandardMaterial({ color: 0xc88033, metalness: 0.8, roughness: 0.3 }),
    "Zn": new THREE.MeshStandardMaterial({ color: 0x7d80b0, metalness: 0.5, roughness: 0.2 }),
    "Ga": new THREE.MeshStandardMaterial({ color: 0xc28f8f, metalness: 0.4, roughness: 0.2 }),
    "Ge": new THREE.MeshStandardMaterial({ color: 0x668f8f, metalness: 0.4, roughness: 0.2 }),
    "As": new THREE.MeshStandardMaterial({ color: 0xbd80ff, metalness: 0.1, roughness: 0.5 }),
    "Se": new THREE.MeshStandardMaterial({ color: 0xffa100, metalness: 0.0, roughness: 0.5 }),
    "Br": new THREE.MeshStandardMaterial({ color: 0xa62929, metalness: 0.0, roughness: 0.3 }),
    "Kr": new THREE.MeshStandardMaterial({ color: 0x5cb8d1, metalness: 0.0, roughness: 0.2 }),

    // --- Period 5 ---
    "Rb": new THREE.MeshStandardMaterial({ color: 0x702eb0, metalness: 0.3, roughness: 0.3 }),
    "Sr": new THREE.MeshStandardMaterial({ color: 0x00ff00, metalness: 0.3, roughness: 0.3 }),
    "Y":  new THREE.MeshStandardMaterial({ color: 0x94ffff, metalness: 0.5, roughness: 0.2 }),
    "Zr": new THREE.MeshStandardMaterial({ color: 0x94e3e3, metalness: 0.5, roughness: 0.2 }),
    "Nb": new THREE.MeshStandardMaterial({ color: 0x73c2c9, metalness: 0.5, roughness: 0.2 }),
    "Mo": new THREE.MeshStandardMaterial({ color: 0x54b5b5, metalness: 0.5, roughness: 0.2 }),
    "Tc": new THREE.MeshStandardMaterial({ color: 0x3b9e9e, metalness: 0.5, roughness: 0.2 }),
    "Ru": new THREE.MeshStandardMaterial({ color: 0x248f8f, metalness: 0.5, roughness: 0.2 }),
    "Rh": new THREE.MeshStandardMaterial({ color: 0x0a7d8c, metalness: 0.6, roughness: 0.2 }),
    "Pd": new THREE.MeshStandardMaterial({ color: 0x006985, metalness: 0.6, roughness: 0.2 }),
    "Ag": new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.1 }),
    "Cd": new THREE.MeshStandardMaterial({ color: 0xffd98f, metalness: 0.5, roughness: 0.2 }),
    "In": new THREE.MeshStandardMaterial({ color: 0xa67573, metalness: 0.4, roughness: 0.2 }),
    "Sn": new THREE.MeshStandardMaterial({ color: 0x668080, metalness: 0.4, roughness: 0.2 }),
    "Sb": new THREE.MeshStandardMaterial({ color: 0x9e63b5, metalness: 0.3, roughness: 0.3 }),
    "Te": new THREE.MeshStandardMaterial({ color: 0xd47a00, metalness: 0.3, roughness: 0.3 }),
    "I":  new THREE.MeshStandardMaterial({ color: 0x940094, metalness: 0.0, roughness: 0.4 }),
    "Xe": new THREE.MeshStandardMaterial({ color: 0x429eb0, metalness: 0.0, roughness: 0.2 }),

    // --- Period 6 (Lanthanides) ---
    "Cs": new THREE.MeshStandardMaterial({ color: 0x57178f, metalness: 0.3, roughness: 0.3 }),
    "Ba": new THREE.MeshStandardMaterial({ color: 0x00c900, metalness: 0.3, roughness: 0.3 }),
    "La": new THREE.MeshStandardMaterial({ color: 0x70d4ff, metalness: 0.5, roughness: 0.2 }),
    "Ce": new THREE.MeshStandardMaterial({ color: 0xffffc7, metalness: 0.4, roughness: 0.2 }),
    "Pr": new THREE.MeshStandardMaterial({ color: 0xd9ffc7, metalness: 0.4, roughness: 0.2 }),
    "Nd": new THREE.MeshStandardMaterial({ color: 0xc7ffc7, metalness: 0.4, roughness: 0.2 }),
    "Pm": new THREE.MeshStandardMaterial({ color: 0xa3ffc7, metalness: 0.4, roughness: 0.2 }),
    "Sm": new THREE.MeshStandardMaterial({ color: 0x8fffc7, metalness: 0.4, roughness: 0.2 }),
    "Eu": new THREE.MeshStandardMaterial({ color: 0x61ffc7, metalness: 0.4, roughness: 0.2 }),
    "Gd": new THREE.MeshStandardMaterial({ color: 0x45ffc7, metalness: 0.4, roughness: 0.2 }),
    "Tb": new THREE.MeshStandardMaterial({ color: 0x30ffc7, metalness: 0.4, roughness: 0.2 }),
    "Dy": new THREE.MeshStandardMaterial({ color: 0x1fffc7, metalness: 0.4, roughness: 0.2 }),
    "Ho": new THREE.MeshStandardMaterial({ color: 0x00ff9c, metalness: 0.4, roughness: 0.2 }),
    "Er": new THREE.MeshStandardMaterial({ color: 0x00e675, metalness: 0.4, roughness: 0.2 }),
    "Tm": new THREE.MeshStandardMaterial({ color: 0x00d452, metalness: 0.4, roughness: 0.2 }),
    "Yb": new THREE.MeshStandardMaterial({ color: 0x00bf38, metalness: 0.4, roughness: 0.2 }),
    "Lu": new THREE.MeshStandardMaterial({ color: 0x00ab24, metalness: 0.4, roughness: 0.2 }),
    "Hf": new THREE.MeshStandardMaterial({ color: 0x4dc2ff, metalness: 0.6, roughness: 0.2 }),
    "Ta": new THREE.MeshStandardMaterial({ color: 0x4da6ff, metalness: 0.6, roughness: 0.2 }),
    "W":  new THREE.MeshStandardMaterial({ color: 0x2194d6, metalness: 0.7, roughness: 0.2 }),
    "Re": new THREE.MeshStandardMaterial({ color: 0x267dab, metalness: 0.6, roughness: 0.2 }),
    "Os": new THREE.MeshStandardMaterial({ color: 0x266696, metalness: 0.6, roughness: 0.2 }),
    "Ir": new THREE.MeshStandardMaterial({ color: 0x175487, metalness: 0.6, roughness: 0.2 }),
    "Pt": new THREE.MeshStandardMaterial({ color: 0xd0d0e0, metalness: 0.7, roughness: 0.1 }),
    "Au": new THREE.MeshStandardMaterial({ color: 0xffd123, metalness: 0.8, roughness: 0.2 }),
    "Hg": new THREE.MeshStandardMaterial({ color: 0xb8b8d0, metalness: 0.9, roughness: 0.0 }),
    "Tl": new THREE.MeshStandardMaterial({ color: 0xa6544d, metalness: 0.4, roughness: 0.2 }),
    "Pb": new THREE.MeshStandardMaterial({ color: 0x575961, metalness: 0.4, roughness: 0.3 }),
    "Bi": new THREE.MeshStandardMaterial({ color: 0x9e4fb5, metalness: 0.4, roughness: 0.2 }),
    "Po": new THREE.MeshStandardMaterial({ color: 0xab5c00, metalness: 0.4, roughness: 0.2 }),
    "At": new THREE.MeshStandardMaterial({ color: 0x754f45, metalness: 0.1, roughness: 0.5 }),
    "Rn": new THREE.MeshStandardMaterial({ color: 0x428296, metalness: 0.0, roughness: 0.2 }),

    // --- Period 7 (Actinides) ---
    "Fr": new THREE.MeshStandardMaterial({ color: 0x420066, metalness: 0.3, roughness: 0.3 }),
    "Ra": new THREE.MeshStandardMaterial({ color: 0x007d00, metalness: 0.3, roughness: 0.3 }),
    "Ac": new THREE.MeshStandardMaterial({ color: 0x70abff, metalness: 0.4, roughness: 0.2 }),
    "Th": new THREE.MeshStandardMaterial({ color: 0x00baff, metalness: 0.4, roughness: 0.2 }),
    "Pa": new THREE.MeshStandardMaterial({ color: 0x00a1ff, metalness: 0.4, roughness: 0.2 }),
    "U":  new THREE.MeshStandardMaterial({ color: 0x008fff, metalness: 0.4, roughness: 0.2 }),
    "Np": new THREE.MeshStandardMaterial({ color: 0x0080ff, metalness: 0.4, roughness: 0.2 }),
    "Pu": new THREE.MeshStandardMaterial({ color: 0x006bff, metalness: 0.4, roughness: 0.2 }),
    "Am": new THREE.MeshStandardMaterial({ color: 0x545cf2, metalness: 0.4, roughness: 0.2 }),
    "Cm": new THREE.MeshStandardMaterial({ color: 0x785ce3, metalness: 0.4, roughness: 0.2 }),
    "Bk": new THREE.MeshStandardMaterial({ color: 0x8a4fe3, metalness: 0.4, roughness: 0.2 }),
    "Cf": new THREE.MeshStandardMaterial({ color: 0xa136d4, metalness: 0.4, roughness: 0.2 }),
    "Es": new THREE.MeshStandardMaterial({ color: 0xb31fd4, metalness: 0.4, roughness: 0.2 }),
    "Fm": new THREE.MeshStandardMaterial({ color: 0xb31fba, metalness: 0.4, roughness: 0.2 }),
    "Md": new THREE.MeshStandardMaterial({ color: 0xb30da6, metalness: 0.4, roughness: 0.2 }),
    "No": new THREE.MeshStandardMaterial({ color: 0xbd0d87, metalness: 0.4, roughness: 0.2 }),
    "Lr": new THREE.MeshStandardMaterial({ color: 0xc70066, metalness: 0.4, roughness: 0.2 }),
    "Rf": new THREE.MeshStandardMaterial({ color: 0xcc0059, metalness: 0.5, roughness: 0.2 }),
    "Db": new THREE.MeshStandardMaterial({ color: 0xd1004f, metalness: 0.5, roughness: 0.2 }),
    "Sg": new THREE.MeshStandardMaterial({ color: 0xd90045, metalness: 0.5, roughness: 0.2 }),
    "Bh": new THREE.MeshStandardMaterial({ color: 0xe00038, metalness: 0.5, roughness: 0.2 }),
    "Hs": new THREE.MeshStandardMaterial({ color: 0xe6002e, metalness: 0.5, roughness: 0.2 }),
    "Mt": new THREE.MeshStandardMaterial({ color: 0xeb0024, metalness: 0.5, roughness: 0.2 }),
    "Ds": new THREE.MeshStandardMaterial({ color: 0xff0021, metalness: 0.5, roughness: 0.2 }),
    "Rg": new THREE.MeshStandardMaterial({ color: 0xff0040, metalness: 0.5, roughness: 0.2 }),
    "Cn": new THREE.MeshStandardMaterial({ color: 0xff005c, metalness: 0.5, roughness: 0.2 }),
    "Nh": new THREE.MeshStandardMaterial({ color: 0xff0078, metalness: 0.5, roughness: 0.2 }),
    "Fl": new THREE.MeshStandardMaterial({ color: 0xff0094, metalness: 0.5, roughness: 0.2 }),
    "Mc": new THREE.MeshStandardMaterial({ color: 0xff00af, metalness: 0.5, roughness: 0.2 }),
    "Lv": new THREE.MeshStandardMaterial({ color: 0xff00c7, metalness: 0.5, roughness: 0.2 }),
    "Ts": new THREE.MeshStandardMaterial({ color: 0xff00e0, metalness: 0.5, roughness: 0.2 }),
    "Og": new THREE.MeshStandardMaterial({ color: 0xff00ff, metalness: 0.5, roughness: 0.2 }),

    // --- Fallback ---
    "Default": new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.1, roughness: 0.5 })
};

export const standardRadiiDict = {
    // Period 1
    "H": 1.20, "He": 1.40,
    // Period 2
    "Li": 1.82, "Be": 1.53, "B": 1.92, "C": 1.70, "N": 1.55, "O": 1.52, "F": 1.47, "Ne": 1.54,
    // Period 3
    "Na": 2.27, "Mg": 1.73, "Al": 1.84, "Si": 2.10, "P": 1.80, "S": 1.80, "Cl": 1.75, "Ar": 1.88,
    // Period 4
    "K": 2.75, "Ca": 2.31, "Sc": 2.11, "Ti": 2.00, "V": 2.00, "Cr": 2.00, "Mn": 2.00, "Fe": 2.00,
    "Co": 2.00, "Ni": 1.63, "Cu": 1.40, "Zn": 1.39, "Ga": 1.87, "Ge": 2.11, "As": 1.85, "Se": 1.90,
    "Br": 1.85, "Kr": 2.02,
    // Period 5
    "Rb": 3.03, "Sr": 2.49, "Y": 2.00, "Zr": 2.00, "Nb": 2.00, "Mo": 2.00, "Tc": 2.00, "Ru": 2.00,
    "Rh": 2.00, "Pd": 1.63, "Ag": 1.72, "Cd": 1.58, "In": 1.93, "Sn": 2.17, "Sb": 2.06, "Te": 2.06,
    "I": 1.98, "Xe": 2.16,
    // Period 6 (including Lanthanides)
    "Cs": 3.43, "Ba": 2.68, "La": 2.00, "Ce": 2.00, "Pr": 2.00, "Nd": 2.00, "Pm": 2.00, "Sm": 2.00,
    "Eu": 2.00, "Gd": 2.00, "Tb": 2.00, "Dy": 2.00, "Ho": 2.00, "Er": 2.00, "Tm": 2.00, "Yb": 2.00,
    "Lu": 2.00, "Hf": 2.00, "Ta": 2.00, "W": 2.00, "Re": 2.00, "Os": 2.00, "Ir": 2.00, "Pt": 1.75,
    "Au": 1.66, "Hg": 1.55, "Tl": 1.96, "Pb": 2.02, "Bi": 2.07, "Po": 1.97, "At": 2.02, "Rn": 2.20,
    // Period 7 (including Actinides)
    "Fr": 3.48, "Ra": 2.83, "Ac": 2.00, "Th": 2.00, "Pa": 2.00, "U": 1.86, "Np": 2.00, "Pu": 2.00,
    "Am": 2.00, "Cm": 2.00, "Bk": 2.00, "Cf": 2.00, "Es": 2.00, "Fm": 2.00, "Md": 2.00, "No": 2.00,
    "Lr": 2.00, "Rf": 2.00, "Db": 2.00, "Sg": 2.00, "Bh": 2.00, "Hs": 2.00, "Mt": 2.00, "Ds": 2.00,
    "Rg": 2.00, "Cn": 2.00, "Nh": 2.00, "Fl": 2.00, "Mc": 2.00, "Lv": 2.00, "Ts": 2.00, "Og": 2.00,
    // Fallback
    "Default": 1.50
};