from rdkit import Chem
from rdkit.Chem import AllChem
import pubchempy as pcp
import requests
import glypy
from glypy.algorithms import subtree_search
import re
try:
    import openbabel
    OPENBABEL_AVAILABLE = True
except ImportError:
    OPENBABEL_AVAILABLE = False

class Atom:
    def __init__(self, id, symbol, x, y, z, charge=0):
        self.id = id
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
    try:
        if AllChem.EmbedMolecule(mol, AllChem.ETKDG()) != 0:
            AllChem.EmbedMolecule(mol, useRandomCoords=True)
    except:
        print("RDKit 3D embedding failed, trying OpenBabel")
        if not OPENBABEL_AVAILABLE:
            raise ValueError("3D embedding failed and OpenBabel not available.")
        
        # Fallback to OpenBabel for 3D
        try:
            obConversion = openbabel.OBConversion()
            obConversion.SetInAndOutFormats("smi", "mol")
            obMol = openbabel.OBMol()
            obConversion.ReadString(obMol, smiles)
            
            if not omit_hydrogens:
                obMol.AddHydrogens()
            
            # Generate 3D
            builder = openbabel.OBBuilder()
            builder.Build(obMol)
            
            # Extract positions
            positions = []
            for atom in openbabel.OBMolAtomIter(obMol):
                idx = atom.GetIdx()
                symbol = atom.GetType()  # Approximate symbol
                charge = atom.GetFormalCharge() if hasattr(atom, 'GetFormalCharge') else 0
                pos = atom.GetVector()
                positions.append(Atom(idx, symbol, pos.GetX(), pos.GetY(), pos.GetZ(), charge))
            
            # Extract bonds
            bonds = []
            for bond in openbabel.OBMolBondIter(obMol):
                start_idx = bond.GetBeginAtomIdx()
                end_idx = bond.GetEndAtomIdx()
                bond_type = bond.GetBondOrder()
                bonds.append((start_idx, end_idx, str(bond_type)))
            
            print("Used OpenBabel for 3D embedding")
            return positions, bonds
        
        except Exception as e2:
            raise ValueError(f"3D embedding failed: {e2}")
    
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
        symbol = atom.GetSymbol()
        charge = atom.GetFormalCharge()
        pos = conf.GetAtomPosition(idx)
        positions.append(Atom(idx, symbol, pos.x, pos.y, pos.z, charge))

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


def _reposition_disconnected_fragments(mol, positions, spacing=4.0):
    """Place separate ionic fragments on distinct offsets so disconnected ions render visibly."""
    fragments = Chem.GetMolFrags(mol, asMols=False)
    if len(fragments) <= 1:
        return positions

    offset = 0.0
    repositioned = [None] * mol.GetNumAtoms()

    for frag_indices in fragments:
        frag_positions = [positions[atom_idx] for atom_idx in frag_indices]
        cx = sum(p.x for p in frag_positions) / len(frag_positions)
        cy = sum(p.y for p in frag_positions) / len(frag_positions)
        cz = sum(p.z for p in frag_positions) / len(frag_positions)

        for atom_idx in frag_indices:
            old = positions[atom_idx]
            repositioned[atom_idx] = Atom(
                atom_idx,
                old.symbol,
                old.x - cx + offset,
                old.y - cy,
                old.z - cz,
                old.charge
            )

        offset += spacing

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
    # Regex breakdown:
    # (\d)       -> Capture the first digit (The "Head")
    # [,-]       -> Match a comma or hyphen separator
    # (\d)       -> Capture the second digit (The "Tail")
    # .*?        -> Any characters in between
    # (alpha|beta) -> Capture the stereochemistry type
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
    return None




def validate_smiles(smiles):
    mol = Chem.MolFromSmiles(smiles)
    return mol is not None


# molname = input("Enter the name of the molecule: ")
# smiles = retrieve_smiles(molname)
# if smiles:
#     positions, bonds = generate_molecule_data(smiles)
#     for i in positions:
#         print(f"Atom ID: {i.id}, Symbol: {i.symbol}, Position: ({i.x:.2f}, {i.y:.2f}, {i.z:.2f})")
#     print(bonds)
# else:
#     print("Molecule not found.")