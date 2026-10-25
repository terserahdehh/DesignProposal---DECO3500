# Submission sources and regeneration

Output at the repository root: **[16_DesignPrototypeDocs.pdf](../../16_DesignPrototypeDocs.pdf)**.

The current Blackboard instructions supplied by the team specify `TeamNumber_DesignPrototypeDocs.pdf`; this filename takes precedence over the older brief's different example.

## Inputs

- [team.json](team.json): supplied cover details, with student numbers reproduced exactly. Verify `s4980036` for Serafina; no digit is inferred.
- [Design Process Overview](../wiki/Design-Process-Overview.md): the Markdown published to the wiki, including figures and references.
- [Ethical Considerations](../wiki/Ethical-Considerations.md): the Markdown published to the wiki, including risk tables and references.
- Figures are local existing project artefacts and the [production companion screenshot](../assets/companion-interface.png), captured without a hardware connection on 25 October 2026.

## Rebuild

```bash
python3 -m venv /tmp/pulseband-pdf-env
/tmp/pulseband-pdf-env/bin/python -m pip install -r docs/submission/requirements.txt
/tmp/pulseband-pdf-env/bin/python scripts/build_submission.py
```

Times New Roman is loaded from the macOS system fonts. On another platform, place legally licensed copies of the four Times New Roman TTF variants in `docs/submission/fonts/`; the script fails rather than silently changing typeface. Font files are not distributed by this repository.

The export uses A4 pages, black text, 12 pt Times New Roman, double-spaced body paragraphs, 25.4 mm margins, a 12.7 mm first-line paragraph indent, page numbers and hanging reference indents. Table cells use 11 pt with compact spacing for readability. The body is justified at the user's explicit request; [APA 7 normally specifies left alignment](https://apastyle.apa.org/style-grammar-guidelines/paper-format/paragraph-format). Citations and reference entries follow APA 7. Cover details follow the assessment's specific requirements; the brief supplies no instructor name.

The team reports that the PDF has been submitted. The export contains the required cover and two wiki pages. The exact wiki Markdown sources are retained in the main repository to make the PDF content reviewable even if the wiki changes later.
