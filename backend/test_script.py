import io
from reportlab.pdfgen import canvas
import pdfplumber

packet = io.BytesIO()
can = canvas.Canvas(packet)
can.drawString(10, 800, "ARTICLE 1")
can.drawString(10, 780, "This is the first paragraph of the legal document.")
can.showPage()
can.drawString(10, 800, "This is page 2.")
can.save()
packet.seek(0)

with pdfplumber.open(packet) as pdf:
    for i, page in enumerate(pdf.pages):
        print(f"Page {i+1}: '{page.extract_text()}'")
