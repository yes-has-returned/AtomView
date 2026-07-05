from rdkit import Chem
from moleculerenderer import generate_molecule_data, _is_transition_metal

# Test the hexaamminecobalt(III) chloride complex
test_smiles = "[Co+3](N)(N)(N)(N)(N)N.[Cl-].[Cl-].[Cl-]"
print(f"Testing SMILES: {test_smiles}")

mol = Chem.MolFromSmiles(test_smiles)
if not mol:
    print("Failed to parse SMILES")
else:
    print(f"Molecule has {mol.GetNumAtoms()} atoms")
    
    # Check for transition metals and their neighbors
    for atom in mol.GetAtoms():
        if _is_transition_metal(atom):
            print(f"\nFound transition metal: {atom.GetSymbol()} (idx={atom.GetIdx()})")
            neighbors = [bond.GetOtherAtomIdx(atom.GetIdx()) for bond in atom.GetBonds()]
            print(f"  Number of bonds: {len(neighbors)}")
            print(f"  Neighbor atoms: {[mol.GetAtomWithIdx(n).GetSymbol() for n in neighbors]}")
    
    # Try generating molecule data
    print("\nGenerating molecule coordinates...")
    try:
        positions, bonds = generate_molecule_data(test_smiles)
        print(f"Generated {len(positions)} atom positions")
        
        # Find cobalt and its neighbors
        for i, pos in enumerate(positions):
            if pos.symbol == "Co":
                print(f"\nCobalt at index {i}: ({pos.x:.2f}, {pos.y:.2f}, {pos.z:.2f})")
                # Find bonded atoms
                bonded = [b for b in bonds if b[0] == i or b[1] == i]
                print(f"  Bonds involving Co: {bonded}")
                for bond in bonded:
                    other_idx = bond[1] if bond[0] == i else bond[0]
                    other = positions[other_idx]
                    print(f"    Bond to {other.symbol}(idx={other_idx}): ({other.x:.2f}, {other.y:.2f}, {other.z:.2f})")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
