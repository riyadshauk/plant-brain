import json
import unittest
from pathlib import Path

from import_course import identity, size_parts, stable_id

ROOT = Path(__file__).resolve().parents[1]


class ImportCourseTests(unittest.TestCase):
    def test_explicit_synonym_only(self):
        self.assertEqual(identity("Rhamnus californica"), identity("Rhamnus (frangula) californica"))
        self.assertNotEqual(identity("Arctostaphylos sp. + cvs"), identity("Arctostaphylos glauca"))

    def test_name_correction_keeps_stable_id(self):
        prior = {"week-4-position-20": {"name": "Sequioia sempervirens", "id": "sequioia-sempervirens"}}
        self.assertEqual(stable_id(4, 20, "Sequoia sempervirens", prior, {}), "sequioia-sempervirens")
        self.assertEqual(stable_id(4, 20, "Quercus agrifolia", prior, {}), "quercus-agrifolia")

    def test_dimension_parsing_preserves_unknowns(self):
        self.assertEqual(size_parts("45'x45'"), ("45'", "45'"))
        self.assertEqual(size_parts("Varies"), (None, None))
        self.assertEqual(size_parts("2'xspreading"), ("2'", "spreading"))

    def test_generated_relationships(self):
        data = json.loads((ROOT / "generated_data" / "course.json").read_text(encoding="utf-8"))
        self.assertEqual(len(data["memberships"]), 185)
        self.assertEqual(len(data["modules"]), 9)
        self.assertEqual(len(data["plants"]), 182)
        ids = {p["id"] for p in data["plants"]}
        self.assertEqual(len(ids), len(data["plants"]))
        self.assertTrue(all(m["plantId"] in ids for m in data["memberships"]))
        self.assertTrue(all(i["plantId"] is None or i["plantId"] in ids for i in data["images"]))
        coffeeberry = [m for m in data["memberships"] if m["plantId"] == "rhamnus-californica"]
        self.assertEqual({m["moduleId"] for m in coffeeberry}, {"week-8", "week-9"})
        self.assertEqual(len([i for i in data["images"] if i["plantId"] is None]), 3)


if __name__ == "__main__":
    unittest.main()
