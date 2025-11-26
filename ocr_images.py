import argparse
import csv
import os
import sys
from pathlib import Path
from typing import List, Tuple
import shutil
import pytesseract
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import pandas as pd


def find_tesseract_executable() -> str:
	tesseract_path = shutil.which("tesseract")
	if tesseract_path:
		return tesseract_path
	windows_default = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
	if Path(windows_default).exists():
		return windows_default
	return ""


def preprocess_image(image_path: Path) -> Image.Image:
	"""Enhanced preprocessing for better OCR accuracy"""
	image = Image.open(image_path)
	
	# Convert to grayscale
	image = image.convert("L")
	
	# Increase contrast
	image = ImageOps.autocontrast(image, cutoff=2)
	
	# Apply unsharp mask for better text clarity
	from PIL import ImageEnhance
	enhancer = ImageEnhance.Sharpness(image)
	image = enhancer.enhance(2.0)
	
	# Additional contrast enhancement
	enhancer = ImageEnhance.Contrast(image)
	image = enhancer.enhance(1.5)
	
	# Brightness adjustment
	enhancer = ImageEnhance.Brightness(image)
	image = enhancer.enhance(1.1)
	
	# Apply median filter to reduce noise
	image = image.filter(ImageFilter.MedianFilter(size=3))
	
	return image


def ocr_image(image_path: Path, language: str, oem: int, psm: int) -> str:
	image = preprocess_image(image_path)
	# Use better PSM mode for forms/tables (PSM 6 = uniform block, PSM 4 = single column)
	# Try multiple PSM modes and combine results
	configs = [
		f"--oem {oem} --psm {psm}",  # User specified
		f"--oem {oem} --psm 4",     # Single column
		f"--oem {oem} --psm 6",     # Uniform block
	]
	
	results = []
	for config in configs:
		try:
			text = pytesseract.image_to_string(image, lang=language, config=config)
			if text.strip():
				results.append(text.strip())
		except:
			pass
	
	# Return the longest result (usually most complete)
	if results:
		return max(results, key=len)
	return pytesseract.image_to_string(image, lang=language, config=f"--oem {oem} --psm {psm}")


def ensure_directory(path: Path) -> None:
	path.mkdir(parents=True, exist_ok=True)


def gather_images(input_dir: Path) -> List[Path]:
	extensions = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"]
	paths: List[Path] = []
	for ext in extensions:
		paths.extend(input_dir.glob(f"*{ext}"))
	return sorted(paths)


def write_outputs(
	image_path: Path,
	text: str,
	text_out_dir: Path,
	pdf_out_dir: Path,
	write_pdf: bool,
	language: str,
	oem: int,
	psm: int
) -> Tuple[Path, Path]:
	ensure_directory(text_out_dir)
	text_path = text_out_dir / f"{image_path.stem}.txt"
	text_path.write_text(text, encoding="utf-8")

	pdf_path = Path()
	if write_pdf:
		ensure_directory(pdf_out_dir)
		image = preprocess_image(image_path)
		config = f"--oem {oem} --psm {psm}"
		pdf_bytes = pytesseract.image_to_pdf_or_hocr(image, extension="pdf", lang=language, config=config)
		pdf_path = pdf_out_dir / f"{image_path.stem}.pdf"
		pdf_path.write_bytes(pdf_bytes)
	return text_path, pdf_path


def main() -> None:
	parser = argparse.ArgumentParser(description="OCR all images in a folder to text (and optional PDFs).")
	parser.add_argument("--input", "-i", type=str, default=".", help="Input directory containing images. Default: current directory.")
	parser.add_argument("--output", "-o", type=str, default="output", help="Output directory. Text goes to output/text, PDFs to output/pdf.")
	parser.add_argument("--lang", "-l", type=str, default="eng", help="Tesseract language(s), e.g., 'eng' or 'eng+spa'. Default: eng.")
	parser.add_argument("--psm", type=int, default=6, help="Tesseract Page Segmentation Mode (PSM). Default: 6 (assume a block of text).")
	parser.add_argument("--oem", type=int, default=3, help="Tesseract OCR Engine Mode (OEM). Default: 3 (default LSTM).")
	parser.add_argument("--pdf", action="store_true", help="Also generate searchable PDF per image.")
	args = parser.parse_args()

	input_dir = Path(args.input).resolve()
	output_dir = Path(args.output).resolve()
	text_out_dir = output_dir / "text"
	pdf_out_dir = output_dir / "pdf"

	if not input_dir.exists() or not input_dir.is_dir():
		print(f"Input directory does not exist or is not a directory: {input_dir}", file=sys.stderr)
		sys.exit(1)

	tesseract_exec = find_tesseract_executable()
	if not tesseract_exec:
		print("Tesseract executable not found. Please install Tesseract OCR for best results.", file=sys.stderr)
		print("Windows: Install via Chocolatey:  choco install tesseract  or download installer from https://github.com/UB-Mannheim/tesseract/wiki", file=sys.stderr)
	else:
		pytesseract.pytesseract.tesseract_cmd = tesseract_exec

	images = gather_images(input_dir)
	if not images:
		print(f"No images found in {input_dir}. Supported: jpg, jpeg, png, tif, tiff, bmp, webp", file=sys.stderr)
		sys.exit(1)

	print(f"Found {len(images)} images. Starting OCR...")
	ensure_directory(output_dir)
	records = []

	for idx, image_path in enumerate(images, start=1):
		try:
			text = ocr_image(image_path, language=args.lang, oem=args.oem, psm=args.psm)
			text_file, pdf_file = write_outputs(
				image_path=image_path,
				text=text,
				text_out_dir=text_out_dir,
				pdf_out_dir=pdf_out_dir,
				write_pdf=args.pdf,
				language=args.lang,
				oem=args.oem,
				psm=args.psm
			)
			records.append({"filename": image_path.name, "text": text})
			print(f"[{idx}/{len(images)}] OCR complete: {image_path.name} -> {text_file.name}{' + PDF' if args.pdf else ''}")
		except Exception as exc:
			print(f"[{idx}/{len(images)}] Failed: {image_path.name} ({exc})", file=sys.stderr)

	if records:
		csv_path = output_dir / "ocr_results.csv"
		df = pd.DataFrame.from_records(records, columns=["filename", "text"])
		# Ensure proper CSV formatting with quotes for text fields containing commas
		df.to_csv(csv_path, index=False, encoding="utf-8", quoting=csv.QUOTE_ALL)
		print(f"Wrote aggregate CSV: {csv_path}")
	else:
		print("No successful OCR results to aggregate.", file=sys.stderr)

	print("Done.")


if __name__ == "__main__":
	main()

