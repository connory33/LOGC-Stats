import argparse
import os
import sys
from pathlib import Path
from typing import List
import csv
import easyocr
import pandas as pd

# Fix Windows console encoding
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def gather_images(input_dir: Path) -> List[Path]:
    """Find all image files in directory"""
    extensions = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"]
    paths: List[Path] = []
    for ext in extensions:
        paths.extend(input_dir.glob(f"*{ext}"))
    return sorted(paths)


def ensure_directory(path: Path) -> None:
    """Create directory if it doesn't exist"""
    path.mkdir(parents=True, exist_ok=True)


def ocr_image_easyocr(reader: easyocr.Reader, image_path: Path, detail: int = 0) -> str:
    """
    Use EasyOCR to extract text from image
    
    Args:
        reader: EasyOCR reader instance
        image_path: Path to image file
        detail: 0 = text only, 1 = text with bounding boxes
    """
    try:
        results = reader.readtext(str(image_path), detail=detail, paragraph=True)
        
        if detail == 0:
            # Simple text extraction
            return '\n'.join(results) if results else ''
        else:
            # Detailed results with bounding boxes
            # Group by approximate Y position to preserve structure
            lines = []
            current_line = []
            last_y = None
            
            for (bbox, text, confidence) in results:
                # Get average Y position of bounding box
                avg_y = sum([point[1] for point in bbox]) / len(bbox)
                
                # Group text on similar Y positions (same line)
                if last_y is None or abs(avg_y - last_y) < 20:
                    current_line.append((text, confidence))
                else:
                    # New line detected
                    if current_line:
                        line_text = ' '.join([t[0] for t in current_line])
                        lines.append(line_text)
                    current_line = [(text, confidence)]
                
                last_y = avg_y
            
            # Add last line
            if current_line:
                line_text = ' '.join([t[0] for t in current_line])
                lines.append(line_text)
            
            return '\n'.join(lines)
            
    except Exception as e:
        raise Exception(f"EasyOCR error: {str(e)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract text from images using EasyOCR (free, deep learning OCR)"
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        default=".",
        help="Input directory containing images. Default: current directory."
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default="output",
        help="Output directory. Text goes to output/text, CSV to output/ocr_results.csv"
    )
    parser.add_argument(
        "--lang",
        type=str,
        default="en",
        help="Language code (default: en). Can specify multiple: en,es,fr"
    )
    parser.add_argument(
        "--gpu",
        action="store_true",
        help="Use GPU if available (faster but requires CUDA)"
    )
    args = parser.parse_args()

    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    text_out_dir = output_dir / "text"

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Input directory does not exist: {input_dir}", file=sys.stderr)
        sys.exit(1)

    images = gather_images(input_dir)
    if not images:
        print(f"No images found in {input_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(images)} images.")
    print("Initializing EasyOCR (this may take a moment on first run)...")
    
    # Initialize EasyOCR reader
    # First run will download models (~100-200MB)
    languages = args.lang.split(',')
    try:
        reader = easyocr.Reader(languages, gpu=args.gpu)
        print(f"EasyOCR initialized successfully for languages: {languages}")
    except Exception as e:
        print(f"Failed to initialize EasyOCR: {e}", file=sys.stderr)
        print("Make sure EasyOCR is installed: pip install easyocr", file=sys.stderr)
        sys.exit(1)

    ensure_directory(output_dir)
    ensure_directory(text_out_dir)

    records = []

    for idx, image_path in enumerate(images, start=1):
        try:
            print(f"[{idx}/{len(images)}] Processing {image_path.name}...", end=' ', flush=True)
            text = ocr_image_easyocr(reader, image_path, detail=1)
            
            # Save individual text file
            text_file = text_out_dir / f"{image_path.stem}.txt"
            text_file.write_text(text, encoding="utf-8")
            
            records.append({
                "filename": image_path.name,
                "text": text
            })
            
            print(f"OK ({len(text)} chars)")
            
        except Exception as exc:
            print(f"FAILED: {exc}", file=sys.stderr)
            records.append({
                "filename": image_path.name,
                "text": f"ERROR: {str(exc)}"
            })

    # Save CSV
    if records:
        csv_path = output_dir / "ocr_results.csv"
        df = pd.DataFrame.from_records(records, columns=["filename", "text"])
        df.to_csv(csv_path, index=False, encoding="utf-8", quoting=csv.QUOTE_ALL)
        print(f"\n[SUCCESS] Wrote aggregate CSV: {csv_path}")
        successful = len([r for r in records if not r['text'].startswith('ERROR')])
        print(f"[SUCCESS] Processed {successful}/{len(images)} images successfully")
    
    print("\nDone!")


if __name__ == "__main__":
    main()

