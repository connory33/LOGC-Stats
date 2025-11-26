import argparse
import os
import sys
from pathlib import Path
from typing import List
import csv
import requests
import time
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


def ocr_image_ocrspace(image_path: Path, api_key: str = None) -> str:
    """
    Use OCR.space API to extract text from image
    Free tier: 25,000 requests/month, no API key needed for basic usage
    """
    url = "https://api.ocr.space/parse/image"
    
    with open(image_path, 'rb') as image_file:
        files = {'file': (image_path.name, image_file, 'image/jpeg')}
        
        payload = {
            'apikey': api_key or 'helloworld',  # Free API key
            'language': 'eng',
            'isOverlayRequired': False,
            'detectOrientation': True,
            'scale': True,
            'OCREngine': 2,  # Engine 2 is more accurate
        }
        
        try:
            response = requests.post(url, files=files, data=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            
            if result.get('OCRExitCode') == 1:
                # Success
                parsed_results = result.get('ParsedResults', [])
                if parsed_results:
                    return parsed_results[0].get('ParsedText', '')
                return ''
            else:
                error_message = result.get('ErrorMessage', 'Unknown error')
                raise Exception(f"OCR.space API error: {error_message}")
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Network error: {str(e)}")
        except Exception as e:
            raise Exception(f"OCR.space error: {str(e)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract text from images using OCR.space API (free tier)"
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
        "--api-key",
        type=str,
        default=None,
        help="OCR.space API key (optional, free tier works without it)"
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay between API calls in seconds (default: 1.0, free tier rate limit)"
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
    print("Using OCR.space API (free tier)...")
    print(f"Rate limit delay: {args.delay} seconds between requests")

    ensure_directory(output_dir)
    ensure_directory(text_out_dir)

    records = []

    for idx, image_path in enumerate(images, start=1):
        try:
            print(f"[{idx}/{len(images)}] Processing {image_path.name}...", end=' ', flush=True)
            text = ocr_image_ocrspace(image_path, args.api_key)
            
            # Save individual text file
            text_file = text_out_dir / f"{image_path.stem}.txt"
            text_file.write_text(text, encoding="utf-8")
            
            records.append({
                "filename": image_path.name,
                "text": text
            })
            
            print(f"OK ({len(text)} chars)")
            
            # Rate limiting for free tier
            if idx < len(images):
                time.sleep(args.delay)
            
        except Exception as exc:
            print(f"FAILED: {exc}", file=sys.stderr)
            records.append({
                "filename": image_path.name,
                "text": f"ERROR: {str(exc)}"
            })
            # Still wait to respect rate limits
            if idx < len(images):
                time.sleep(args.delay)

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

