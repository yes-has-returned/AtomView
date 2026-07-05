from rdkit import Chem
from moleculerenderer import generate_molecule_data

# Test the hexaamminecobalt(III) chloride complex
test_smiles = "[Co+3](N)(N)(N)(N)(N)N.[Cl-].[Cl-].[Cl-]"
print(f"Testing SMILES: {test_smiles}")

positions, bonds = generate_molecule_data(test_smiles)
print(f"\nGenerated {len(positions)} atom positions and {len(bonds)} bonds")

print("\nAll bonds:")
for bond in bonds:
    start_idx, end_idx, bond_type = bond
    start_atom = positions[start_idx].symbol
    end_atom = positions[end_idx].symbol
    print(f"  {start_idx}({start_atom}) - {end_idx}({end_atom}) [type={bond_type}]")

print("\nBonds involving cobalt (index 0):")
co_bonds = [b for b in bonds if b[0] == 0 or b[1] == 0]
print(f"  Found {len(co_bonds)} bonds")
for bond in co_bonds:
    start_idx, end_idx, bond_type = bond
    start_atom = positions[start_idx].symbol
    end_atom = positions[end_idx].symbol
    print(f"  {start_idx}({start_atom}) - {end_idx}({end_atom}) [type={bond_type}]")
