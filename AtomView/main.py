from flask import Flask, render_template, request, jsonify, redirect, url_for
import moleculerenderer
from rdkit import Chem
from rdkit.Chem import Draw, Descriptors
import io
import base64
from collections import Counter

app = Flask(__name__)

def get_molecular_formula(smiles):
    """Generate molecular formula from SMILES string."""
    mol = Chem.MolFromSmiles(smiles)
    if not mol:
        return None
    return Chem.rdMolDescriptors.CalcMolFormula(mol)

def get_2d_structure_image(smiles, size=300):
    """Generate 2D molecular structure image as base64."""
    mol = Chem.MolFromSmiles(smiles)
    if not mol:
        return None
    
    # Draw the molecule
    img = Draw.MolToImage(mol, size=(size, size))
    
    # Convert to base64
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    img_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
    
    return f"data:image/png;base64,{img_base64}"

def get_atomic_key(smiles):
    """Generate atomic key from SMILES string."""
    mol = Chem.MolFromSmiles(smiles)
    if not mol:
        return []
    
    # Get list of atoms with their counts
    atom_symbols = []
    for atom in mol.GetAtoms():
        atom_symbols.append(atom.GetSymbol())
    
    # Count occurrences
    atom_counts = Counter(atom_symbols)
    
    # Sort by symbol for consistent ordering
    sorted_atoms = sorted(atom_counts.items())
    
    return [{"symbol": symbol, "count": count} for symbol, count in sorted_atoms]

def parse_geometry(positions, bonds):
    """Utility to convert RDKit objects into serializable JSON."""
    parsed_atoms = [{
        "id": a.id, "symbol": a.symbol, 
        "x": a.x, "y": a.y, "z": a.z
    } for a in positions]
    
    parsed_bonds = [{
        "start": b[0], "end": b[1], "type": str(b[2])
    } for b in bonds]
    
    return parsed_atoms, parsed_bonds

def get_assembly_instructions(smiles, name=None):
    """
    Unified checker: Determines if the input is a monomer or polymer.
    """
    from rdkit import Chem
    mol = Chem.MolFromSmiles(smiles)
    num_atoms = len(mol.GetAtoms()) if mol else 0
    has_dummy_atoms = any(atom.GetAtomicNum() == 0 for atom in mol.GetAtoms()) if mol else False

    # 1. Check for Sugar/Polysaccharide nature
    if name:
        struct_data = moleculerenderer.retrieve_structure_glypy(name)
        if struct_data and struct_data["Detected Sugars"]:
            atom_map = moleculerenderer.identify_glycosidic_atoms(smiles, 1, 4)
            if atom_map:
                return [{
                    "type": "alpha", 
                    "head_idx": atom_map["head"],
                    "tail_idx": atom_map["tail"],
                    "is_polymer": True,
                    "is_heuristic": True
                }]
    
    # 2. Check for synthetic polymer hints
    endpoints = moleculerenderer.identify_polymer_endpoints(smiles)
    # Trigger polymer if:
    # - Has dummy atoms (*) marking polymer endpoints, OR
    # - Name contains 'poly', OR
    # - Has terminal endpoints and enough atoms
    is_polymer_by_name = name and "poly" in name.lower()
    is_polymer_by_structure = has_dummy_atoms or (endpoints and num_atoms > 20)
    
    if endpoints and (is_polymer_by_name or is_polymer_by_structure):
        return [{
            "type": "linear",
            "head_idx": endpoints["head_idx"],
            "tail_idx": endpoints["tail_idx"],
            "is_polymer": True
        }]

    # 3. Default to Monomer
    return [{"type": "monomer", "is_polymer": False}]

@app.route('/')
def homepage():
   return render_template('home.html')

@app.route('/render')
def renderer():
    return render_template('renderer.html')

@app.route('/renderbackend/name')
def render_backend_name():
    name = request.args.get('name')
    methods = request.args.get('methods', 'PubChem,OPSIN').split(',')
    smiles = None

    for method in methods:
        if method == "PubChem":
            smiles = moleculerenderer.retrieve_smiles_pubchem(name)
        elif method == "OPSIN":
            smiles = moleculerenderer.retrieve_smiles_pyopsin(name)
        if smiles: break

    if not smiles:
        return jsonify({"error": "Molecule not found."}), 404

    try:
        positions, bonds = moleculerenderer.generate_molecule_data(smiles)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    atoms, bonds_data = parse_geometry(positions, bonds)
    instructions = get_assembly_instructions(smiles, name)
    
    # Get molecular data
    molecular_formula = get_molecular_formula(smiles)
    structure_image = get_2d_structure_image(smiles)
    atomic_key = get_atomic_key(smiles)

    return jsonify({
        "atoms": atoms,
        "bonds": bonds_data,
        "assembly_instructions": instructions,
        "molecular_formula": molecular_formula,
        "structure_image": structure_image,
        "atomic_key": atomic_key
    })

@app.route('/renderbackend/smiles')
def render_backend_smiles():
    smiles = request.args.get('smiles')
    if not smiles:
        return jsonify({"error": "No SMILES string provided."}), 400

    try:
        positions, bonds = moleculerenderer.generate_molecule_data(smiles)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    atoms, bonds_data = parse_geometry(positions, bonds)
    instructions = get_assembly_instructions(smiles)
    
    # Get molecular data
    molecular_formula = get_molecular_formula(smiles)
    structure_image = get_2d_structure_image(smiles)
    atomic_key = get_atomic_key(smiles)

    return jsonify({
        "atoms": atoms,
        "bonds": bonds_data,
        "assembly_instructions": instructions,
        "molecular_formula": molecular_formula,
        "structure_image": structure_image,
        "atomic_key": atomic_key
    })

if __name__ == "__main__":
   app.run(debug=True, host="0.0.0.0", port=5000)