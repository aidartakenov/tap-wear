"""The sales book as a PDF file: the same numbers as the "Продажи" tab, on paper."""

from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo

from fpdf import FPDF
from fpdf.enums import TableCellFillMode
from fpdf.fonts import FontFace

# DejaVu Sans: a free font with Russian and Kyrgyz letters (see fonts/LICENSE_DEJAVU).
FONTS = Path(__file__).parent.parent / "fonts"
ZONE = ZoneInfo("Asia/Bishkek")
MAX_ROWS = 1000

INK = (17, 24, 39)
MUTED = (107, 114, 128)
LINE = (229, 231, 235)
SHADE = (243, 244, 246)


def money(minor: int) -> str:
    """450050 -> "4 500,50 сом"; whole soms are shown without the tyiyn part."""
    whole, rest = divmod(abs(minor), 100)
    text = f"{whole:,}".replace(",", " ")
    if rest:
        text += f",{rest:02d}"
    return f"{'-' if minor < 0 else ''}{text} сом"


def day(value: date) -> str:
    return value.strftime("%d.%m.%Y")


def render(store_name: str, report) -> bytes:
    """`report` is the SalesReport the sales tab is built from."""
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(15, 15, 15)
    pdf.add_font("DejaVu", "", FONTS / "DejaVuSans.ttf")
    pdf.add_font("DejaVu", "B", FONTS / "DejaVuSans-Bold.ttf")
    pdf.set_title(f"Продажи — {store_name}")
    pdf.set_creator("TapWear")
    pdf.add_page()
    pdf.set_draw_color(*LINE)

    def heading(text: str) -> None:
        pdf.ln(5)
        pdf.set_font("DejaVu", "B", 12)
        pdf.set_text_color(*INK)
        pdf.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")

    def table(header: list[str], rows: list[list[str]], widths: tuple, right: tuple) -> None:
        pdf.set_font("DejaVu", "", 8.5)
        pdf.set_text_color(*INK)
        aligns = ["RIGHT" if index in right else "LEFT" for index in range(len(header))]
        with pdf.table(
            col_widths=widths,
            text_align=aligns,
            headings_style=FontFace(emphasis="BOLD", fill_color=SHADE),
            cell_fill_color=(250, 250, 251),
            cell_fill_mode=TableCellFillMode.ROWS,
            line_height=5.5,
            borders_layout="HORIZONTAL_LINES",
        ) as output:
            output.row(header)
            for row in rows:
                output.row(row)

    summary = report.summary
    first, last = report.by_day[0].date, report.by_day[-1].date

    pdf.set_font("DejaVu", "B", 17)
    pdf.set_text_color(*INK)
    pdf.cell(0, 9, store_name, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(*MUTED)
    period = day(first) if first == last else f"{day(first)} — {day(last)}"
    pdf.cell(0, 6, f"Продажи за период: {period}", new_x="LMARGIN", new_y="NEXT")

    heading("Итоги")
    table(
        ["Показатель", "Значение"],
        [
            ["Выручка", money(summary.revenue_minor)],
            ["Продано вещей", f"{summary.pieces} шт."],
            ["Продаж (заказы на сайте и продажи в магазине)", str(summary.sales)],
            ["Средний чек", money(summary.average_minor)],
            ["Через сайт", f"{money(summary.site_revenue_minor)} · {summary.site_pieces} шт."],
            ["В магазине", f"{money(summary.shop_revenue_minor)} · {summary.shop_pieces} шт."],
            ["Возвраты", f"{summary.refunds} · {money(summary.refunds_minor)}"],
        ],
        widths=(3, 2),
        right=(1,),
    )

    if report.products:
        heading("Что продаётся")
        table(
            ["Товар", "Размеры и цвета", "Штук", "Сумма"],
            [
                [
                    product.title,
                    ", ".join(
                        " ".join(filter(None, [variant.size_label, variant.color_name]))
                        + f" × {variant.pieces}"
                        for variant in product.variants
                    ),
                    str(product.pieces),
                    money(product.revenue_minor),
                ]
                for product in report.products
            ],
            widths=(5, 5, 1.2, 2.6),
            right=(2, 3),
        )

    heading(f"Журнал продаж: {len(report.lines)}")
    if not report.lines:
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 6, "За этот период продаж нет.", new_x="LMARGIN", new_y="NEXT")
    else:
        table(
            ["Когда", "Товар", "Размер, цвет", "Шт.", "Сумма", "Где продано"],
            [
                [
                    line.sold_at.astimezone(ZONE).strftime("%d.%m.%Y %H:%M"),
                    line.title,
                    ", ".join(filter(None, [line.size_label, line.color_name])),
                    str(line.quantity),
                    money(line.total_minor),
                    f"Заказ №{line.order_number}" if line.channel == "site" else "Магазин",
                ]
                for line in report.lines[:MAX_ROWS]
            ],
            widths=(3, 5, 3, 1, 2.6, 2.4),
            right=(3, 4),
        )
        if len(report.lines) > MAX_ROWS:
            pdf.set_font("DejaVu", "", 8)
            pdf.set_text_color(*MUTED)
            pdf.cell(0, 6, f"Показаны первые {MAX_ROWS} продаж.", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)
    pdf.set_font("DejaVu", "", 8)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 5, "TapWear", new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())
