import math
import unittest

from rdkit import Chem

from moleculerenderer import Atom, _apply_coordination_geometry, _reposition_disconnected_fragments


class CoordinationGeometryTests(unittest.TestCase):
    def test_reposition_disconnected_fragments_uses_3d_offsets(self):
        mol = Chem.MolFromSmiles("[Cl-].[Na+]")
        positions = [
            Atom(0, "Cl", 0.0, 0.0, 0.0, -1),
            Atom(1, "Na", 0.0, 0.0, 0.0, 1),
        ]

        repositioned = _reposition_disconnected_fragments(mol, positions, spacing=4.0)

        self.assertEqual(len(repositioned), 2)
        self.assertTrue(
            repositioned[0].x != repositioned[1].x
            or repositioned[0].y != repositioned[1].y
            or repositioned[0].z != repositioned[1].z
        )
        self.assertTrue(
            repositioned[1].x != 0.0
            or repositioned[1].y != 0.0
            or repositioned[1].z != 0.0
        )

    def test_apply_coordination_geometry_builds_octahedral_ligands(self):
        mol = Chem.MolFromSmiles("[Co+3](N)(N)(N)(N)(N)N.[Cl-]")
        positions = [
            Atom(atom.GetIdx(), atom.GetSymbol(), 0.0, 0.0, 0.0, atom.GetFormalCharge())
            for atom in mol.GetAtoms()
        ]

        repositioned = _apply_coordination_geometry(mol, positions, bond_length=2.0)
        metal_idx = next(atom.GetIdx() for atom in mol.GetAtoms() if atom.GetSymbol() == "Co")
        ligand_indices = [atom.GetIdx() for atom in mol.GetAtoms() if atom.GetSymbol() == "N"]

        self.assertEqual(len(ligand_indices), 6)

        metal_pos = repositioned[metal_idx]
        ligand_vectors = []
        for ligand_idx in ligand_indices:
            ligand_pos = repositioned[ligand_idx]
            ligand_vectors.append((
                ligand_pos.x - metal_pos.x,
                ligand_pos.y - metal_pos.y,
                ligand_pos.z - metal_pos.z,
            ))

        for dx, dy, dz in ligand_vectors:
            distance = math.sqrt(dx * dx + dy * dy + dz * dz)
            self.assertAlmostEqual(distance, 2.0, delta=0.05)

        expected_axes = {
            (2.0, 0.0, 0.0),
            (-2.0, 0.0, 0.0),
            (0.0, 2.0, 0.0),
            (0.0, -2.0, 0.0),
            (0.0, 0.0, 2.0),
            (0.0, 0.0, -2.0),
        }
        actual_axes = {
            (
                round(dx, 6),
                round(dy, 6),
                round(dz, 6),
            )
            for dx, dy, dz in ligand_vectors
        }

        self.assertTrue(expected_axes.issubset(actual_axes))


if __name__ == "__main__":
    unittest.main()
