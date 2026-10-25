#!/usr/bin/env python3
"""Export the two checked-in wiki sources to the single assessment PDF.

Requires docs/submission/requirements.txt. Run from any directory.
Student details are explicit inputs, never inferred or filled with guessed digits.
"""
from __future__ import annotations

import json
import re
from html import escape
from pathlib import Path
from urllib.parse import unquote

import markdown
from lxml import html
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
    Table, TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "docs/submission/team.json").read_text())
OUT = ROOT / CONFIG["filename"]
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
FONT_FILES = {
    "TimesNewRoman": "Times New Roman.ttf",
    "TimesNewRoman-Bold": "Times New Roman Bold.ttf",
    "TimesNewRoman-Italic": "Times New Roman Italic.ttf",
    "TimesNewRoman-BoldItalic": "Times New Roman Bold Italic.ttf",
}


def register_fonts():
    for name, filename in FONT_FILES.items():
        candidate = FONT_DIR / filename
        if not candidate.exists():
            candidate = ROOT / "docs/submission/fonts" / filename
        if not candidate.exists():
            raise SystemExit(f"Install a licensed copy of {filename} in docs/submission/fonts/.")
        pdfmetrics.registerFont(TTFont(name, str(candidate)))
    pdfmetrics.registerFontFamily(
        "TimesNewRoman", normal="TimesNewRoman", bold="TimesNewRoman-Bold",
        italic="TimesNewRoman-Italic", boldItalic="TimesNewRoman-BoldItalic",
    )


def styles():
    base = dict(fontName="TimesNewRoman", fontSize=12, leading=24, textColor=colors.black,
                allowWidows=0, allowOrphans=0, splitLongWords=True)
    return {
        "body": ParagraphStyle("body", **base, alignment=TA_JUSTIFY, firstLineIndent=36),
        "navigation": ParagraphStyle("navigation", **base, alignment=TA_LEFT, spaceAfter=8),
        "title": ParagraphStyle("title", **{**base, "fontName": "TimesNewRoman-Bold"},
                                alignment=TA_CENTER, spaceAfter=12, keepWithNext=True),
        "heading": ParagraphStyle("heading", **{**base, "fontName": "TimesNewRoman-Bold"},
                                  alignment=TA_LEFT, spaceBefore=12, keepWithNext=True),
        "reference": ParagraphStyle("reference", **base, alignment=TA_LEFT,
                                    leftIndent=36, firstLineIndent=-36),
        "caption": ParagraphStyle("caption", **base, alignment=TA_LEFT, spaceAfter=12),
        "cover": ParagraphStyle("cover", **base, alignment=TA_CENTER),
        "cell": ParagraphStyle("cell", fontName="TimesNewRoman", fontSize=11, leading=15,
                               textColor=colors.black, spaceAfter=0),
    }


def inline(element):
    """Translate only supported semantic inline HTML to ReportLab markup."""
    value = escape(element.text or "")
    for child in element:
        tag = child.tag.lower()
        body = inline(child)
        if tag in ("strong", "b"):
            value += f"<b>{body}</b>"
        elif tag in ("em", "i"):
            value += f"<i>{body}</i>"
        elif tag == "a":
            target = escape(child.get("href", ""), quote=True)
            value += f'<a href="{target}" color="black">{body}</a>'
        elif tag == "br":
            value += "<br/>"
        elif tag != "img":
            value += body
        value += escape(child.tail or "")
    # Plain DOI/URL text in APA reference entries remains clickable.
    if not element.xpath(".//a"):
        value = re.sub(r"https?://[^\s<]+", lambda m: f'<a href="{m[0]}" color="black">{m[0]}</a>', value)
    return value


def local_image(url):
    marker = "/raw/refs/heads/main/"
    if marker not in url:
        raise ValueError(f"Unrecognised image source: {url}")
    path = (ROOT / unquote(url.split(marker, 1)[1])).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        raise ValueError(f"Missing or out-of-repository image: {path}")
    return path


def export_markdown(source, style, width):
    document = html.fromstring("<div>" + markdown.markdown(source, extensions=["tables"]) + "</div>")
    story = []
    references = False
    for element in document:
        tag = element.tag.lower()
        if tag.startswith("h") and tag[1:].isdigit():
            title = element.text_content().strip()
            references = title == "References"
            if references:
                story.append(Spacer(1, 12))
            story.append(Paragraph(inline(element), style["title" if tag == "h1" or references else "heading"]))
        elif tag == "p":
            pictures = element.xpath(".//img")
            if pictures:
                # Keep the figure, number, title and note together.
                image_path = local_image(pictures[0].get("src"))
                with PILImage.open(image_path) as picture:
                    iw, ih = picture.size
                scale = min(width / iw, 290 / ih)
                figure = Image(str(image_path), width=iw * scale, height=ih * scale)
                figure.hAlign = "CENTER"
                nxt = element.getnext()
                caption = nxt.text_content() if nxt is not None else pictures[0].get("alt", "")
                figure_number = re.match(r"Figure (\d+)\.\s*(.*)", caption)
                if figure_number:
                    text = f'<b>Figure {figure_number[1]}</b><br/><i>{escape(figure_number[2])}</i>'
                else:
                    text = escape(caption)
                story.append(KeepTogether([Spacer(1, 12), Paragraph(text, style["caption"]), figure, Spacer(1, 12)]))
                continue
            previous = element.getprevious()
            if previous is not None and previous.xpath(".//img"):
                continue
            text = element.text_content()
            key = "reference" if references else "navigation" if text.startswith(("PulseBand ·", "Explore the outcome:", "Try the prototype:")) else "body"
            story.append(Paragraph(inline(element), style[key]))
        elif tag in ("ul", "ol"):
            for number, item in enumerate(element, 1):
                prefix = f"{number}. " if tag == "ol" else "• "
                story.append(Paragraph(prefix + inline(item), style["navigation"]))
        elif tag == "table":
            rows = []
            for row in element.xpath(".//tr"):
                rows.append([Paragraph(("<b>" + inline(cell) + "</b>") if cell.tag == "th" else inline(cell), style["cell"]) for cell in row])
            columns = len(rows[0])
            fractions = [0.27, 0.27, 0.46] if columns == 3 else [1 / columns] * columns
            table = Table(rows, colWidths=[width * x for x in fractions], repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEABOVE", (0, 0), (-1, 0), 0.7, colors.black),
                ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.black),
                ("LINEBELOW", (0, -1), (-1, -1), 0.7, colors.black),
                ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.extend([table, Spacer(1, 8)])
        else:
            raise ValueError(f"Unsupported block <{tag}>; do not silently omit wiki content")
    return story


def page_header(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.black)
    canvas.setFont("TimesNewRoman", 12)
    canvas.drawRightString(A4[0] - 72, A4[1] - 40, str(doc.page))
    canvas.restoreState()


def main():
    register_fonts()
    style = styles()
    doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=72, leftMargin=72,
                            topMargin=72, bottomMargin=72,
                            title="PulseBand: Design Prototype Documentation — Team 16",
                            author="Team 16 — PulseBand",
                            subject="DECO3500 Design Process Overview and Ethical Considerations")
    story = [Spacer(1, 90), Paragraph("PulseBand: Design Prototype Documentation", style["title"]),
             Paragraph("Team 16 — PulseBand", style["cover"]), Spacer(1, 24)]
    for member in CONFIG["members"]:
        story.append(Paragraph(escape(member["name"] + " (" + member["student_number"] + ")"), style["cover"]))
    story.extend([Spacer(1, 24), Paragraph(escape(CONFIG["institution"]), style["cover"]),
                  Paragraph(escape(CONFIG["course"]), style["cover"]),
                  Paragraph("Assignment 3: Design Project", style["cover"]),
                  Paragraph(escape(CONFIG["document_date"]), style["cover"]), Spacer(1, 24),
                  Paragraph("<b>GitHub repository</b>", style["cover"]),
                  Paragraph(f'<a href="{CONFIG["repository"]}" color="black">{CONFIG["repository"]}</a>', style["cover"]),
                  PageBreak()])
    for index, filename in enumerate(["Design-Process-Overview.md", "Ethical-Considerations.md"]):
        if index:
            story.append(PageBreak())
        story.extend(export_markdown((ROOT / "docs/wiki" / filename).read_text(), style, doc.width))
    doc.build(story, onFirstPage=page_header, onLaterPages=page_header)
    print(OUT)


if __name__ == "__main__":
    main()
