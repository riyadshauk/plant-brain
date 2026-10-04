# Plant Brain

A local-first study app for the Plant Materials course. It includes five-plant learning packets, flashcards, name practice, a searchable library, a plant-walk PDF builder, a mock final, notes, and progress tracking.

## Run it locally

1. Install Node.js and [pnpm](https://pnpm.io/installation).
2. Open a terminal in the `app` folder.
3. Run `pnpm install` and then `pnpm dev`.
4. Open the local address shown in the terminal.

The app is a React/Vite static site. The course data and images are already included in `app/public`, so you do not need to run the importer to start studying. Run `pnpm test` to check the answer-grading logic, or `pnpm build` to create a production build.

## Course materials and data

The original nine weekly presentations, nine weekly lists, and `Master Plant List.xlsx` are in the project root. `tools/import_course.py` reads these files and generates `generated_data/course.json`, `app/public/course.json`, and the images in `app/public/course-images/`. It does not alter the original files. To regenerate the data, install Python packages `pymupdf`, `openpyxl`, and `Pillow`, then run `python tools/import_course.py` from the project root. Keep `generated_data/plant-id-map.json` so plant IDs remain stable after source corrections.

The included presentations and images are instructor course material. Please respect the original creators' rights when using or sharing them.

## Your progress

Study progress and notes are stored in each browser's local storage. They are not in this repository or sent to a server. Use **Progress → Export backup** and **Import / restore** in the app to move your own data between browsers or devices.

See [course data review](docs/data-review.md) for source conflicts and missing reference facts.
