from rdkit import Chem
from moleculerenderer import generate_molecule_data
import math

# Test the hexaamminecobalt(III) chloride complex
test_smiles = "[Co+3](N)(N)(N)(N)(N)N.[Cl-].[Cl-].[Cl-]"
print(f"Testing SMILES: {test_smiles}")

positions, bonds = generate_molecule_data(test_smiles)
print(f"\nGenerated {len(positions)} atom positions")

# Find cobalt and its ligands
cobalt_pos = None
ligand_positions = {}
for i, pos in enumerate(positions):
    if pos.symbol == "Co":
        cobalt_pos = (pos.x, pos.y, pos.z)
        print(f"\nCobalt at index {i}: ({pos.x:.3f}, {pos.y:.3f}, {pos.z:.3f})")
    elif pos.symbol == "N":
        ligand_positions[i] = (pos.x, pos.y, pos.z)

print(f"\n{len(ligand_positions)} nitrogen ligands:")
for idx, (x, y, z) in ligand_positions.items():
    dx = x - cobalt_pos[0]
    dy = y - cobalt_pos[1]
    dz = z - cobalt_pos[2]
    distance = math.sqrt(dx**2 + dy**2 + dz**2)
    print(f"  N[{idx}]: offset ({dx:.3f}, {dy:.3f}, {dz:.3f}) distance={distance:.3f}")

# Check if they're on the octahedral axes (±2, 0, 0), (0, ±2, 0), (0, 0, ±2)
print("\nChecking for octahedral pattern:")
expected_axes = [
    (2.0, 0.0, 0.0),
    (-2.0, 0.0, 0.0),
    (0.0, 2.0, 0.0),
    (0.0, -2.0, 0.0),
    (0.0, 0.0, 2.0),
    (0.0, 0.0, -2.0),
]

actual_vectors = []
for idx, (x, y, z) in ligand_positions.items():
    dx = x - cobalt_pos[0]
    dy = y - cobalt_pos[1]
    dz = z - cobalt_pos[2]
    actual_vectors.append((round(dx, 2), round(dy, 2), round(dz, 2)))

actual_set = set(actual_vectors)
expected_set = set((round(x, 2), round(y, 2), round(z, 2)) for x, y, z in expected_axes)

print(f"Expected axes: {sorted(expected_set)}")
print(f"Actual vectors: {sorted(actual_set)}")
print(f"Match: {expected_set == actual_set}")
