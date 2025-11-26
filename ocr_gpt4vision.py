import argparse
import os
import sys
from pathlib import Path
from typing import List
import base64
import json
import csv
from openai import OpenAI
import pandas as pd


def encode_image(image_path: Path) -> str:
    """Encode image to base64 string"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')


def analyze_image_with_gpt4(client: OpenAI, image_path: Path, model: str = "gpt-4o") -> str:
    """Use GPT-4 Vision to extract a STRICT, machine-readable table as JSON."""

    base64_image = encode_image(image_path)

    # IMPORTANT: We want the model to behave like "convert to a table",
    # not like a free-form OCR description. We enforce a strict JSON schema.
    system_prompt = (
        "You are an OCR and table extraction assistant. "
        "You take an image of a hunting club scorecard or similar form and "
        "return ONLY a JSON object describing the main people table."
    )

    user_instructions = """
Look at this image of a hunting club card / scorecard and extract the main TABLE of hunting results.

The table layout is FIXED. Each row represents one member. Columns are:
- Member        (one of the fixed member names below)
- Guide         (guide name for that member, if present)
- Blind         (blind number)
- Guns          (number of guns)
- MallardDrake
- MallardHen
- Sprig
- Widgeon
- Teal
- Wood
- Other
- Geese
- Pheasant

The ONLY valid member names and row order are:
1. Kevin Harvey
2. Daniel Davis
3. JB Ferrarone
4. Jay Abbe
5. Mike Mountanos
6. Tom Messervy
7. Bob Lashinski
8. Pete Sonsini
9. Buster Posey
10. Jean Young
11. Casey Safreno
12. Hank Wetzel
13. Gavin Holles
14. Dave Brett

Your job is to:
1. For each of the 14 members above, read any clearly legible data in that image.
2. Produce EXACTLY 14 rows in the fixed order above.
3. For each row, fill a value for each column (Member, Guide, Blind, Guns, MallardDrake, MallardHen, Sprig, Widgeon, Teal, Wood, Other, Geese, Pheasant).
4. Also capture high-level metadata (date, location/club name, record/notes) if visible.

OUTPUT FORMAT (VERY IMPORTANT):
- Return ONLY a single JSON object with EXACTLY these keys:
  {
    "headers": [
      "Member",
      "Guide",
      "Blind",
      "Guns",
      "MallardDrake",
      "MallardHen",
      "Sprig",
      "Widgeon",
      "Teal",
      "Wood",
      "Other",
      "Geese",
      "Pheasant"
    ],
    "rows": [
      ["Kevin Harvey",   null, "4", 2, 3, 1, 0, 0, 0, 0, 0, 0, 0],
      ["Daniel Davis",   null, "4", 2, 3, 1, 0, 0, 0, 0, 0, 0, 0],
      ...
    ],
    "metadata": {
      "date": "November 22",
      "location": "Live Oak Gun Club 2025-2026",
      "notes": "Waterfowl Record"
    }
  }

RULES:
- You MUST output exactly 14 rows in the \"rows\" array, in the member order listed above.
- The first column in each row (Member) MUST be that member's name exactly as written above.
- If a numeric cell (e.g., species count) is illegible or not present, use null for that cell.
- Use numbers (integers) for counts and guns when possible.
- Do NOT invent new member names or extra rows.
- Do NOT output any explanations, markdown, or text outside of the JSON object.
"""

    try:
        response = client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": user_instructions,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )

        content = response.choices[0].message.content

        # Validate that the model really returned JSON. If not, raise so the caller
        # can record an ERROR entry for this image.
        try:
            json.loads(content)
        except json.JSONDecodeError as exc:
            raise Exception(f"Model output was not valid JSON: {exc}: {content[:200]!r}")

        return content
    except Exception as e:
        raise Exception(f"GPT-4 Vision API error: {str(e)}")


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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract text from images using GPT-4 Vision API"
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
        help="OpenAI API key (or set OPENAI_API_KEY environment variable)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gpt-4o",
        help="OpenAI model to use (default: gpt-4o, alternatives: gpt-4o-mini, gpt-4-turbo)"
    )
    parser.add_argument(
        "--max-images",
        type=int,
        default=None,
        help="Optional limit on number of images to process (e.g., 3 to process only the first 3 images)."
    )
    args = parser.parse_args()

    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    text_out_dir = output_dir / "text"

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Input directory does not exist: {input_dir}", file=sys.stderr)
        sys.exit(1)

    # Get API key
    api_key = args.api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OpenAI API key required!", file=sys.stderr)
        print("Set it via --api-key argument or OPENAI_API_KEY environment variable", file=sys.stderr)
        print("Get your API key from: https://platform.openai.com/api-keys", file=sys.stderr)
        sys.exit(1)

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)

    images = gather_images(input_dir)
    if not images:
        print(f"No images found in {input_dir}", file=sys.stderr)
        sys.exit(1)

    # Optionally limit the number of images processed
    if args.max_images is not None and args.max_images > 0:
        images = images[: args.max_images]

    print(f"Processing {len(images)} images with GPT-4 Vision...")
    print(f"Using model: {args.model}")
    ensure_directory(output_dir)
    ensure_directory(text_out_dir)

    records = []

    for idx, image_path in enumerate(images, start=1):
        try:
            print(f"[{idx}/{len(images)}] Processing {image_path.name}...")
            text = analyze_image_with_gpt4(client, image_path, args.model)
            
            # Save individual text file
            text_file = text_out_dir / f"{image_path.stem}.txt"
            text_file.write_text(text, encoding="utf-8")
            
            records.append({
                "filename": image_path.name,
                "text": text
            })
            
            # Avoid non-ASCII symbols here because Windows console encoding (cp1252)
            # cannot render characters like '✓' and will raise a charmap error.
            print(f"  [OK] Extracted {len(text)} characters")
            
        except Exception as exc:
            print(f"[{idx}/{len(images)}] Failed: {image_path.name} ({exc})", file=sys.stderr)
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
        print(f"[SUCCESS] Processed {len([r for r in records if not r['text'].startswith('ERROR')])} images successfully")
    
    print("\nDone!")


if __name__ == "__main__":
    main()

