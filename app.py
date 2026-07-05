import re
import math
from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response
from werkzeug.exceptions import HTTPException
import moleculerenderer
from database import get_db_connection
import database
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors

try:
    database.initiate_database()
    database._ensure_votes_table()
except ConnectionError:
    pass
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
    return rdMolDescriptors.CalcMolFormula(mol)

def get_empirical_formula(smiles):
    """Generate empirical formula (lowest integer ratio) from SMILES."""
    try:
        key = get_atomic_key(smiles)
        if not key:
            return get_molecular_formula(smiles)
        
        # Extract counts and find their Greatest Common Divisor
        counts = [item["count"] for item in key]
        if not counts:
            return get_molecular_formula(smiles)
        
        common_divisor = counts[0]
        for count in counts[1:]:
            common_divisor = math.gcd(common_divisor, count)
            
        # Build formula string using reduced ratios
        empirical_parts = []
        for item in key:
            reduced_count = item["count"] // common_divisor
            count_str = str(reduced_count) if reduced_count > 1 else ""
            empirical_parts.append(f"{item['symbol']}{count_str}")
            
        return "".join(empirical_parts)
    except Exception as e:
        print(f"Error computing empirical formula: {e}")
        return get_molecular_formula(smiles)

def get_condensed_formula(smiles):
    """Generate structural condensed formula layout from SMILES string."""
    try:
        mol = Chem.MolFromSmiles(smiles)
        if not mol:
            return smiles
        # Explicitly add hydrogens so CalcMolFormula counts them (e.g., NH3 instead of N)
        mol_with_h = Chem.AddHs(mol)
        return rdMolDescriptors.CalcMolFormula(mol_with_h)
    except Exception as e:
        print(f"Error computing condensed formula: {e}")
        return smiles

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
    pt = Chem.GetPeriodicTable()

    parsed_atoms = []
    for index, a in enumerate(positions):
        atomic_num = pt.GetAtomicNumber(a.symbol)
        atom_id = getattr(a, 'id', None)
        if atom_id is None:
            atom_id = index
        parsed_atoms.append({
            "id": int(atom_id),
            "symbol": a.symbol,
            "name": pt.GetElementName(atomic_num),
            "mass": round(pt.GetAtomicWeight(atomic_num), 3),
            "charge": getattr(a, 'charge', 0),
            "x": a.x, "y": a.y, "z": a.z
        })
        
    parsed_bonds = [{
        "start": b[0], "end": b[1], "type": str(b[2])
    } for b in bonds]
    
    return parsed_atoms, parsed_bonds

def get_assembly_instructions(smiles, name=None, force_polymer=False):
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

    endpoints = moleculerenderer.identify_polymer_endpoints(smiles)
    is_polymer_by_name = name and "poly" in name.lower()
    is_polymer_by_structure = has_dummy_atoms or (endpoints and num_atoms > 20)

    if force_polymer:
        if endpoints:
            return [{
                "type": "linear",
                "head_idx": endpoints["head_idx"],
                "tail_idx": endpoints["tail_idx"],
                "is_polymer": True,
                "is_heuristic": True
            }]
        if num_atoms >= 2:
            return [{
                "type": "linear",
                "head_idx": 0,
                "tail_idx": num_atoms - 1,
                "is_polymer": True,
                "is_heuristic": True
            }]

    # 2. Check for synthetic polymer hints
    if endpoints and (is_polymer_by_name or is_polymer_by_structure):
        return [{
            "type": "linear",
            "head_idx": endpoints["head_idx"],
            "tail_idx": endpoints["tail_idx"],
            "is_polymer": True
        }]

    # 3. Default to Monomer
    return [{"type": "monomer", "is_polymer": False}]

@app.route('/service-worker.js')
def service_worker():
    response = make_response(app.send_static_file('service-worker.js'))
    response.headers['Content-Type'] = 'application/javascript'
    return response

@app.route('/')
def homepage():
    return redirect(url_for('renderer'))

@app.route('/render')
def renderer():
    return render_template('renderer.html')

@app.route('/renderbackend/name')
def render_backend_name():
    name = request.args.get('name')
    methods = request.args.get('methods', 'PubChem,OPSIN').split(',')
    force_polymer = request.args.get('force_polymerization', 'false').lower() in ('1', 'true', 'yes')
    smiles = None

    for method in methods:
        if method == "PubChem":
            smiles = moleculerenderer.retrieve_smiles_pubchem(name)
        elif method == "OPSIN":
            smiles = moleculerenderer.retrieve_smiles_pyopsin(name)
        if smiles: break

    if not smiles:
        try:
            community_entries = database.query_community_entries(name)
        except ConnectionError as e:
            return jsonify({"error": "Database unavailable; please check your connection."}), 503

        response = {"error": "Molecule not found. Check your input or choose a community entry below."}
        if community_entries:
            response["community_entries"] = community_entries
        return jsonify(response), 404

    # Fix coordination complex SMILES if needed
    smiles = moleculerenderer.fix_coordination_complex_smiles(smiles)

    try:
        positions, bonds = moleculerenderer.generate_molecule_data(smiles)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    atoms, bonds_data = parse_geometry(positions, bonds)
    
    # DEBUG: Log bonds for hexaamminecobalt
    if "cobalt" in name.lower() or "co" in smiles:
        print(f"DEBUG: Name='{name}', SMILES='{smiles}'")
        print(f"DEBUG: generate_molecule_data returned {len(bonds)} bonds")
        print(f"DEBUG: parse_geometry returned {len(bonds_data)} bonds_data")
        for i, b in enumerate(bonds_data[:10]):
            print(f"  {i}: start={b['start']}, end={b['end']}, type={b['type']}")
    
    instructions = get_assembly_instructions(smiles, name, force_polymer=force_polymer)
    
    # Get molecular data
    molecular_formula = get_molecular_formula(smiles)
    empirical_formula = get_empirical_formula(smiles)
    condensed_formula = get_condensed_formula(smiles)
    structure_image = get_2d_structure_image(smiles)
    atomic_key = get_atomic_key(smiles)

    return jsonify({
        "atoms": atoms,
        "bonds": bonds_data,
        "assembly_instructions": instructions,
        "molecular_formula": molecular_formula,
        "empirical_formula": empirical_formula,
        "condensed_formula": condensed_formula,
        "smiles_formula": smiles,
        "structure_image": structure_image,
        "atomic_key": atomic_key
    })

@app.route('/renderbackend/community/add', methods=['POST'])
def add_community_entry():
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    smiles = data.get('smiles')
    if not name or not smiles:
        return jsonify({"error": "Both name and SMILES must be provided."}), 400

    if not moleculerenderer.validate_smiles(smiles):
        return jsonify({"error": "Invalid SMILES string."}), 400

    try:
        database.insert_community_sourced(name, smiles)
        return jsonify({"message": "Community entry added successfully."})
    except ConnectionError:
        return jsonify({"error": "Database unavailable; please check your connection."}), 503
    except Exception as e:
        return jsonify({"error": f"Failed to add community entry: {e}"}), 500

@app.route('/renderbackend/community/entries')
def get_community_entries():
    name = request.args.get('name')
    if not name:
        return jsonify({"error": "No name provided."}), 400

    try:
        entries = database.query_community_entries(name)
    except ConnectionError:
        return jsonify({"error": "Database unavailable; please check your connection."}), 503

    # Optionally include the requesting user's vote for each entry when a voter_id is provided
    voter_id = request.args.get('voter_id')
    if voter_id:
        try:
            # Ensure votes table exists
            if hasattr(database, '_ensure_votes_table'):
                try:
                    database._ensure_votes_table()
                except ConnectionError:
                    # DB unavailable; skip attaching user votes
                    for e in entries:
                        e['user_vote'] = None
                    return jsonify({"community_entries": entries, "warning": "Database unavailable; user votes omitted."})

            entry_ids = [e['id'] for e in entries]
            if entry_ids:
                with database.get_db_connection() as con:
                    if con is None:
                        # DB unavailable; skip attaching user votes
                        vote_map = {}
                    else:
                        cur = con.cursor()
                        placeholders = ','.join('%s' for _ in entry_ids)
                        q = f"SELECT entry_id, vote FROM community_votes WHERE voter_id = %s AND entry_id IN ({placeholders})"
                        params = [voter_id] + entry_ids
                        cur.execute(q, tuple(params))
                        rows = cur.fetchall()
                        vote_map = {r[0]: r[1] for r in rows}
                        cur.close()
            else:
                vote_map = {}

            for e in entries:
                e['user_vote'] = vote_map.get(e['id']) if vote_map.get(e['id']) else None
        except ConnectionError:
            for e in entries:
                e['user_vote'] = None
            return jsonify({"community_entries": entries, "warning": "Database unavailable; user votes omitted."})
        except Exception:
            # If anything else goes wrong, don't block the entries; just omit user_vote
            for e in entries:
                e['user_vote'] = None

    return jsonify({"community_entries": entries})

@app.route('/renderbackend/community/vote', methods=['POST'])
def vote_community_entry():
    data = request.get_json(silent=True) or {}
    entry_id = data.get('entry_id')
    vote = data.get('vote')
    previous_vote = data.get('previous_vote')

    if entry_id is None:
        return jsonify({"error": "No entry_id provided."}), 400
    if vote not in ('up', 'down', 'none'):
        return jsonify({"error": "Invalid vote type."}), 400

    voter_id = data.get('voter_id')
    if not voter_id:
        return jsonify({"error": "No voter_id provided."}), 400

    try:
        counts = database.adjust_community_vote(entry_id, voter_id, vote)
        return jsonify(counts)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except ConnectionError:
        return jsonify({"error": "Database unavailable; please check your connection."}), 503
    except Exception as e:
        return jsonify({"error": f"Failed to update vote: {e}"}), 500

@app.route('/renderbackend/smiles')
def render_backend_smiles():
    smiles = request.args.get('smiles')
    if not smiles:
        return jsonify({"error": "No SMILES string provided."}), 400

    force_polymer = request.args.get('force_polymerization', 'false').lower() in ('1', 'true', 'yes')
    polymer_smiles_match = re.match(r'^\s*\[([^\]]+)\]n\s*$', smiles, re.IGNORECASE)
    if polymer_smiles_match:
        smiles = polymer_smiles_match.group(1)
        force_polymer = True

    try:
        positions, bonds = moleculerenderer.generate_molecule_data(smiles)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    atoms, bonds_data = parse_geometry(positions, bonds)
    instructions = get_assembly_instructions(smiles, force_polymer=force_polymer)
    
    # Get molecular data
    molecular_formula = get_molecular_formula(smiles)
    empirical_formula = get_empirical_formula(smiles)
    condensed_formula = get_condensed_formula(smiles)
    structure_image = get_2d_structure_image(smiles)
    atomic_key = get_atomic_key(smiles)

    return jsonify({
        "atoms": atoms,
        "bonds": bonds_data,
        "assembly_instructions": instructions,
        "molecular_formula": molecular_formula,
        "empirical_formula": empirical_formula,
        "condensed_formula": condensed_formula,
        "smiles_formula": smiles,
        "structure_image": structure_image,
        "atomic_key": atomic_key
    })

@app.route('/renderbackend/atom')
def fetch_atom_data():
    id = request.args.get('id')


@app.errorhandler(Exception)
def handle_unhandled_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    return jsonify({"error": "Internal server error."}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)