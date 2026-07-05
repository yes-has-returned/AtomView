from rdkit import Chem
from rdkit.Chem import AllChem, rdDepictor
import pubchempy as pcp
import requests
import glypy
from glypy.algorithms import subtree_search
import math
import re
try:
    import openbabel
    OPENBABEL_AVAILABLE = True
except ImportError:
    OPENBABEL_AVAILABLE = False

class Atom:
    def __init__(self, atom_id, symbol, x, y, z, charge=0):
        self.id = int(atom_id)
        self.symbol = symbol
        self.x = x
        self.y = y
        self.z = z
        self.charge = charge

def retrieve_smiles_pubchem(name):
    results = pcp.get_compounds(name, 'name')
    if results:
        return results[0].smiles
    else:
        return None

def generate_molecule_data(smiles, omit_hydrogens=False):
    smiles = normalize_smiles(smiles)
    # Try RDKit with sanitization first
    mol = None
    sanitized = True
    try:
        mol = Chem.MolFromSmiles(smiles, sanitize=True)
        if mol is None:
            raise ValueError("Invalid SMILES string.")
    except:
        # Fallback: try without sanitization
        try:
            mol = Chem.MolFromSmiles(smiles, sanitize=False)
            sanitized = False
            print("Used RDKit without sanitization")
        except:
            raise ValueError("Invalid SMILES string.")
    
    if mol is None:
        raise ValueError("Invalid SMILES string.")
    
    if not omit_hydrogens:
        mol = Chem.AddHs(mol)
    
    # Generate 3D Coordinates
    embedding_failed = False
    try:
        result = AllChem.EmbedMolecule(mol, AllChem.ETKDG())
        if result != 0:
            result = AllChem.EmbedMolecule(mol, useRandomCoords=True)
            if result != 0:
                embedding_failed = True
    except Exception as embed_error:
        print("RDKit 3D embedding failed, trying fallback:", embed_error)
        embedding_failed = True

    if mol.GetNumConformers() == 0:
        embedding_failed = True

    if embedding_failed:
        openbabel_success = False
        if OPENBABEL_AVAILABLE:
            print("Attempting OpenBabel fallback for 3D embedding")
            try:
                obConversion = openbabel.OBConversion()
                obConversion.SetInAndOutFormats("smi", "mol")
                obMol = openbabel.OBMol()
                obConversion.ReadString(obMol, smiles)

                if not omit_hydrogens:
                    obMol.AddHydrogens()

                builder = openbabel.OBBuilder()
                builder.Build(obMol)

                positions = []
                for atom in openbabel.OBMolAtomIter(obMol):
                    idx = atom.GetIdx()
                    atom_id = int(idx)
                    symbol = atom.GetType()
                    charge = atom.GetFormalCharge() if hasattr(atom, 'GetFormalCharge') else 0
                    pos = atom.GetVector()
                    positions.append(Atom(atom_id, symbol, pos.GetX(), pos.GetY(), pos.GetZ(), charge))

                print("Used OpenBabel for 3D embedding")
                openbabel_success = True
                embedding_failed = False
                
                # Populate RDKit conformer with OpenBabel coordinates
                conf = Chem.Conformer(mol.GetNumAtoms())
                for i, atom_obj in enumerate(positions):
                    conf.SetAtomPosition(i, (atom_obj.x, atom_obj.y, atom_obj.z))
                mol.AddConformer(conf, assignId=True)
            except Exception as e2:
                print(f"OpenBabel 3D embedding failed: {e2}")

        if not openbabel_success:
            print("Falling back to 2D coordinate generation")
            try:
                rdDepictor.Compute2DCoords(mol)
                if mol.GetNumConformers() == 0:
                    raise ValueError("No conformer generated during 2D layout fallback.")
            except Exception as e2:
                raise ValueError(f"3D embedding failed and 2D fallback also failed: {e2}")
    
    # Try optimization only if sanitized
    if sanitized:
        optimization_success = False
        try:
            AllChem.UFFOptimizeMolecule(mol)
            print("Used UFF optimization")
            optimization_success = True
        except Exception as e:
            print(f"UFF optimization failed ({e}), trying MMFF...")
            try:
                AllChem.MMFFOptimizeMolecule(mol)
                print("Used MMFF optimization")
                optimization_success = True
            except Exception as e2:
                print(f"MMFF optimization also failed ({e2})")
    
    conf = mol.GetConformer()
    positions = []

    for atom in mol.GetAtoms():
        idx = atom.GetIdx()
        atom_id = int(idx)
        symbol = atom.GetSymbol()
        charge = atom.GetFormalCharge()
        pos = conf.GetAtomPosition(idx)
        positions.append(Atom(atom_id, symbol, pos.x, pos.y, pos.z, charge))

    positions = _apply_coordination_geometry(mol, positions, bond_length=2.0)

    # If the molecule contains disconnected fragments, place each fragment apart
    # so ionic compounds and salts do not render as overlapping atoms.
    fragments = Chem.GetMolFrags(mol, asMols=False)
    if len(fragments) > 1:
        positions = _reposition_disconnected_fragments(mol, positions)

    bonds = []

    for bond in mol.GetBonds():
        start_idx = bond.GetBeginAtomIdx()
        end_idx = bond.GetEndAtomIdx()
        start_sym = mol.GetAtomWithIdx(start_idx).GetSymbol()
        end_sym = mol.GetAtomWithIdx(end_idx).GetSymbol()
        bond_type = bond.GetBondType()
        bonds.append((start_idx, end_idx, str(bond_type)))

    return positions, bonds


def _is_transition_metal(atom):
    atomic_number = atom.GetAtomicNum()
    return atomic_number in {
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        39, 40, 41, 42, 43, 44, 45, 46, 47, 48,
        57, 72, 73, 74, 75, 76, 77, 78, 79, 80,
        89, 104, 105, 106, 107, 108, 109, 110, 111, 112,
    }


def _apply_coordination_geometry(mol, positions, bond_length=2.0):
    """Lay out octahedral coordination complexes around their metal center."""
    if mol.GetNumAtoms() < 2:
        return positions

    for atom in mol.GetAtoms():
        if not _is_transition_metal(atom):
            continue

        metal_idx = atom.GetIdx()
        neighbor_indices = [bond.GetOtherAtomIdx(metal_idx) for bond in atom.GetBonds()]
        if len(neighbor_indices) != 6:
            continue

        metal_pos = positions[metal_idx]
        axis_vectors = [
            (bond_length, 0.0, 0.0),
            (-bond_length, 0.0, 0.0),
            (0.0, bond_length, 0.0),
            (0.0, -bond_length, 0.0),
            (0.0, 0.0, bond_length),
            (0.0, 0.0, -bond_length),
        ]

        repositioned = list(positions)
        for ligand_index, vector in zip(neighbor_indices, axis_vectors):
            old = positions[ligand_index]
            repositioned[ligand_index] = Atom(
                ligand_index,
                old.symbol,
                metal_pos.x + vector[0],
                metal_pos.y + vector[1],
                metal_pos.z + vector[2],
                old.charge,
            )

        return repositioned

    return positions


def _reposition_disconnected_fragments(mol, positions, spacing=4.0):
    """Place separate ionic fragments in a 3D layout so salts and coordination complexes do not collapse into a straight line."""
    fragments = Chem.GetMolFrags(mol, asMols=False)
    if len(fragments) <= 1:
        return positions

    fragment_list = sorted(fragments, key=len, reverse=True)
    repositioned = [None] * mol.GetNumAtoms()
    total_fragments = len(fragment_list)

    for fragment_index, frag_indices in enumerate(fragment_list):
        frag_positions = [positions[atom_idx] for atom_idx in frag_indices]
        cx = sum(p.x for p in frag_positions) / len(frag_positions)
        cy = sum(p.y for p in frag_positions) / len(frag_positions)
        cz = sum(p.z for p in frag_positions) / len(frag_positions)

        if fragment_index == 0:
            offset_x = 0.0
            offset_y = 0.0
            offset_z = 0.0
        else:
            if total_fragments == 2:
                angle = math.pi / 2.0
                radius = spacing
                offset_x = radius * math.cos(angle * (fragment_index - 1))
                offset_y = 0.0
                offset_z = radius * math.sin(angle * (fragment_index - 1))
            else:
                golden_angle = math.pi * (3.0 - math.sqrt(5.0))
                theta = math.acos(1 - (2 * (fragment_index - 0.5)) / total_fragments)
                radius = spacing * (1.0 + 0.3 * (fragment_index - 1))
                offset_x = radius * math.sin(theta) * math.cos((fragment_index - 1) * golden_angle)
                offset_y = radius * math.sin(theta) * math.sin((fragment_index - 1) * golden_angle)
                offset_z = radius * math.cos(theta)

        for atom_idx in frag_indices:
            old = positions[atom_idx]
            repositioned[atom_idx] = Atom(
                atom_idx,
                old.symbol,
                old.x - cx + offset_x,
                old.y - cy + offset_y,
                old.z - cz + offset_z,
                old.charge
            )

    return repositioned


def retrieve_smiles_pyopsin(name):
# OPSIN Web API Endpoint
    url = f"https://opsin.ch.cam.ac.uk/opsin/{name}.json"
    
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return response.json().get('smiles')
        else:
            return None
    except Exception as e:
        print(f"Connection error: {e}")
        return None

def retrieve_structure_glypy(name):
    results = pcp.get_compounds(name, 'name')
    if not results:
        return None
    
    compound = results[0]
    synonyms = compound.synonyms
    repeat_unit_pattern = re.compile(r'\((.*?)\)n', re.IGNORECASE)
    
    potential_units = []
    for s in synonyms:
        match = repeat_unit_pattern.search(s)
        if match:
            potential_units.append(match.group(1))
    sugars = ['glucose', 'galactose', 'mannose', 'xylose', 'fructose']
    found_sugars = [sugar for sugar in sugars if any(sugar in s.lower() for s in synonyms)]

    return {
        "Common Name": name,
        "CID": compound.cid,
        "SMILES": compound.smiles,
        "Repeating Unit Hints": list(set(potential_units)),
        "Detected Sugars": list(set(found_sugars))
    }

def parse_linkage_hints(hints):
    # Regex breakdown checklist:
    # (\d)       -> Capture the first digit (The "Head") done
    # [,-]       -> Match a comma or hyphen separator done
    # (\d)       -> Capture the second digit (The "Tail") done
    # .*?        -> Any characters in between done
    # (alpha|beta) -> Capture the stereochemistry type done
    pattern = re.compile(r'(\d)[,-](\d).*?(alpha|beta)', re.IGNORECASE)
    
    parsed_results = []
    
    for hint in hints:
        match = pattern.search(hint)
        if match:
            parsed_results.append({
                "original": hint,
                "head_carbon": int(match.group(1)), # e.g., 1
                "tail_carbon": int(match.group(2)), # e.g., 4
                "type": match.group(3).lower()      # e.g., "beta"
            })
            
    return parsed_results

def identify_glycosidic_atoms(smiles, head_num=1, tail_num=4):
    """
    Identifies the RDKit indices for the biochemical Carbon 1 and Carbon 4.
    """
    mol = Chem.MolFromSmiles(smiles)
    if not mol:
        return None

    # SMARTS Pattern: 
    # [C:1] is Carbon 1 (the anomeric carbon next to the ring oxygen)
    # [O:6] is the Ring Oxygen
    # [C:4] is the Carbon 4 (usually opposite the anomeric carbon)
    # This pattern matches a standard 6-membered sugar ring.
    sugar_pattern = Chem.MolFromSmarts("[C:1]1[C:2][C:3][C:4][C:5][O:6]1")
    
    matches = mol.GetSubstructMatch(sugar_pattern)
    
    if not matches:
        # Fallback for 5-membered rings (Furanose) if necessary
        furanose_pattern = Chem.MolFromSmarts("[C:1]1[C:2][C:3][C:4][O:5]1")
        matches = mol.GetSubstructMatch(furanose_pattern)

    if matches:
        # The indices in the 'matches' tuple correspond to the labels in the SMARTS
        # index 0 = Label :1 (Carbon 1)
        # index 3 = Label :4 (Carbon 4)
        return {
            "head": matches[head_num - 1],
            "tail": matches[tail_num - 1]
        }
    
    return None

def identify_polymer_endpoints(smiles):
    mol = Chem.MolFromSmiles(smiles)
    if not mol: return None

    # In many polymer SMILES, the connection points are 
    # atoms with only one bond or specific 'dummy' atoms (*).
    # We look for terminal carbons or oxygens as a fallback.
    endpoints = []
    dummy_atoms = []  # Track dummy atoms (*) which mark polymer endpoints
    
    for atom in mol.GetAtoms():
        # Check for dummy atoms (*) first - these are polymer markers
        if atom.GetAtomicNum() == 0:
            dummy_atoms.append(atom.GetIdx())
        # Also find atoms with only 1 neighbor (terminal atoms)
        elif atom.GetDegree() == 1 and atom.GetSymbol() in ['C', 'O', 'N']:
            endpoints.append(atom.GetIdx())
    
    # Prefer dummy atoms as endpoints (they mark polymer connection points)
    if len(dummy_atoms) >= 2:
        return {
            "head_idx": dummy_atoms[0],
            "tail_idx": dummy_atoms[-1]
        }
    
    # Fall back to terminal C/O/N atoms
    if len(endpoints) >= 2:
        return {
            "head_idx": endpoints[0],
            "tail_idx": endpoints[-1] # Usually the furthest atom in the chain
        }
    
    # If no terminals found but molecule has reasonable size, use first and last atom
    # This helps with cyclic or fully-substituted aromatics that don't have terminal atoms
    if mol.GetNumAtoms() >= 5:
        return {
            "head_idx": 0,
            "tail_idx": mol.GetNumAtoms() - 1
        }
    
    return None




def normalize_smiles(smiles):
    """Normalize SMILES input by allowing polymer repeat notation [smiles]n."""
    if not isinstance(smiles, str):
        return smiles
    polymer_match = re.match(r'^\s*\[([^\]]+)\]n\s*$', smiles, re.IGNORECASE)
    if polymer_match:
        return polymer_match.group(1).strip()
    return smiles.strip()


def fix_coordination_complex_smiles(smiles):
    """
    Fix SMILES for coordination complexes that are broken into fragments.
    For example, 'N.N.N.N.N.N.[Cl-].[Cl-].[Cl-].[Co+3]' should become '[Co+3](N)(N)(N)(N)(N)N.[Cl-].[Cl-].[Cl-]'
    """
    if not smiles or '.' not in smiles:
        return smiles
    
    try:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None or mol.GetNumAtoms() < 2:
            return smiles
        
        # Find transition metals and potential ligands
        fragments = Chem.GetMolFrags(mol, asMols=False)
        metal_idx = None
        metal_atom_idx = None
        ligand_frag_indices = []
        counter_ion_frags = []
        
        for frag_idx, frag in enumerate(fragments):
            if len(frag) == 1:
                atom_idx = frag[0]
                atom = mol.GetAtomWithIdx(atom_idx)
                if _is_transition_metal(atom):
                    metal_idx = frag_idx
                    metal_atom_idx = atom_idx
                elif atom.GetSymbol() in ['N', 'O', 'S', 'P']:
                    ligand_frag_indices.append(frag_idx)
                else:
                    counter_ion_frags.append(frag_idx)
            else:
                # Multi-atom fragments are likely ligands or counterions
                has_heteroatom = any(mol.GetAtomWithIdx(i).GetSymbol() in ['N', 'O', 'S', 'P'] for i in frag)
                if has_heteroatom:
                    ligand_frag_indices.append(frag_idx)
                else:
                    counter_ion_frags.append(frag_idx)
        
        # If we found a metal and ligands, rebuild the SMILES with coordination bonds
        if metal_idx is not None and len(ligand_frag_indices) >= 2:
            # Get the SMILES for each fragment
            metal_smiles = Chem.MolToSmiles(mol, rootedAtAtom=metal_atom_idx, canonical=False)
            ligand_smiles_list = []
            for ligand_frag_idx in ligand_frag_indices:
                for atom_idx in fragments[ligand_frag_idx]:
                    ligand_mol = Chem.MolToSmiles(mol, rootedAtAtom=atom_idx, canonical=False)
                    # For simple single atoms, just get the atom symbol
                    if len(fragments[ligand_frag_idx]) == 1:
                        ligand_smiles_list.append(mol.GetAtomWithIdx(atom_idx).GetSymbol())
                    break
            
            # Build coordination complex SMILES: [Metal](Ligand1)(Ligand2)...
            if len(ligand_smiles_list) >= 2:
                # Extract just the metal with charge
                metal_atom = mol.GetAtomWithIdx(metal_atom_idx)
                metal_symbol = metal_atom.GetSymbol()
                charge = metal_atom.GetFormalCharge()
                if charge > 0:
                    complex_smiles = f"[{metal_symbol}+{charge}]"
                elif charge < 0:
                    complex_smiles = f"[{metal_symbol}{charge}]"
                else:
                    complex_smiles = f"[{metal_symbol}]"
                
                # Add ligands as disconnected fragments
                for ligand_smiles in ligand_smiles_list:
                    complex_smiles += f"({ligand_smiles})"
                
                # Add counterions
                counter_smiles = ""
                for counter_frag_idx in counter_ion_frags:
                    for atom_idx in fragments[counter_frag_idx]:
                        atom = mol.GetAtomWithIdx(atom_idx)
                        counter_smiles += f".{Chem.MolToSmiles(Chem.MolFromSmiles(atom.GetSymbol()))}"
                        break
                
                fixed_smiles = complex_smiles + counter_smiles
                
                # Verify the fixed SMILES is valid
                test_mol = Chem.MolFromSmiles(fixed_smiles)
                if test_mol is not None and test_mol.GetNumAtoms() == mol.GetNumAtoms():
                    print(f"Fixed coordination complex SMILES from '{smiles}' to '{fixed_smiles}'")
                    return fixed_smiles
    except Exception as e:
        print(f"Could not fix coordination complex SMILES: {e}")
    
    return smiles


def validate_smiles(smiles):
    normalized = normalize_smiles(smiles)
    mol = Chem.MolFromSmiles(normalized)
    return mol is not None

#deprecated testing code
# molname = input("Enter the name of the molecule: ")
# smiles = retrieve_smiles(molname)
# if smiles:
#     positions, bonds = generate_molecule_data(smiles)
#     for i in positions:
#         print(f"Atom ID: {i.id}, Symbol: {i.symbol}, Position: ({i.x:.2f}, {i.y:.2f}, {i.z:.2f})")
#     print(bonds)
# else:
#     print("Molecule not found.")