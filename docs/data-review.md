# Course data review

## Sources and import policy

- `Master Plant List.xlsx` is the primary source for names, dimensions, origin, and plant factor. All 185 numbered rows match entries in the nine weekly list PDFs.
- The weekly list PDFs supply module order and grouping. The nine presentations supply photographs. Their pages contain plant titles and images, but generally no written distinguishing features or other plant notes.
- The original PDFs and workbook are left untouched. `tools/import_course.py` regenerates `generated_data/course.json`, `app/public/course.json`, and the extracted images. Study history lives separately in the browser and survives regeneration.
- `generated_data/plant-id-map.json` preserves plant IDs across row moves and minor instructor spelling corrections so existing review history continues to attach to the right plant. Keep this mapping file when regenerating data.
- Source text, including apparent botanical or spelling errors, is preserved for current-course grading. No internet facts were added.

## Coverage

The import report in `generated_data/import-report.json` has the exact current counts. There are nine weekly modules and 185 weekly entries. Three plants recur in another week: *Ribes viburnifolium*, *Salvia spathacea*, and Coffeeberry. The Coffeeberry labels `Rhamnus californica` and `Rhamnus (frangula) californica` are merged explicitly into one plant with two course memberships. Other similar names and cultivars remain separate.

## Issues to review

1. **Conflicting plant factor:** For *Rhus ovata* in Week 3, the master workbook says **VL** while the weekly PDF says **L**. The app uses the master value and retains the PDF as a supporting source. Confirm with the instructor if this will be tested.
2. **Plant factor labeling:** Source tables label the field `PF` without a printed WUCOLS zone. The app treats it as the requested Zone 3 course value based on the exam instructions in the prompt. A separate exam handout was not present in the folder.
3. **Missing feature notes:** Neither the master nor the weekly list tables include distinguishing characteristics or additional important facts. Presentation text is mostly a title; the images alone cannot justify written botanical descriptions. These study fields therefore show as missing rather than invented.
4. **List entries without a matching presentation page:** Week 3 *Salvia (Rosmarinus) officinalis*; Week 8 *Rhamnus californica*; Week 9 generic *Arctostaphylos sp. + cvs* and *Ceanothus cvs*.
5. **Unassociated presentation page:** Week 9 page 2 is specifically *Arctostaphylos glauca* (Bigberry Manzanita). The list says generic *Arctostaphylos sp. + cvs*, so its three images are preserved but not attached to the generic record.
6. **Additional variants in slides:** Week 8 has *Pittosporum tobira* cultivar slides (`Wheeler's Dwarf` and `Variegata`), attached to the species record with the original slide title as the caption. They are not separate list entries. Week 4 labels *Cercis canadensis* as `Forest Pansy`; the list gives only the species.
7. **Other slide/list differences:** Numerous slide titles use alternate spelling, taxonomic synonyms, cultivar names, or common names. Photo association relies on the clearly matching one-plant-per-slide sequence and the labeled titles. The original title and page number remain on every image.
8. **Variable or ambiguous dimensions:** `Varies`, `spreading`, `vining`, missing units, and values such as `4'x'7` are preserved verbatim. Automatic dimension grading is only applied when numeric feet values can be parsed confidently; otherwise the answer is self-graded.
9. **Duplicate source copy:** `Week 1 Plant List - Sheet1 (1).pdf` is byte-for-byte identical to `Week 1 Plant List - Sheet1.pdf` and is ignored by the importer.

## Import limits

Image part labels (habit, leaf, flower, bark, etc.) are left blank because the slide labels identify plants but do not identify the plant part in each photograph. The user can still rotate through all associated photographs. Photos remain instructor material intended for personal study.
