import argparse
import json
from datetime import datetime, date
from pathlib import Path

import pandas as pd


def excel_to_json(input_path: Path, output_path: Path) -> None:
    """Convert all sheets in an Excel workbook to a JSON structure for the React app.

    Output format:
    {
      "sheets": [
        {
          "name": "Sheet1",
          "headers": ["Col1", "Col2", ...],
          "rows": [
            {"Col1": "val", "Col2": 1, ...},
            ...
          ]
        },
        ...
      ]
    }
    """

    # Read all sheets into a dict of DataFrames
    sheet_dict = pd.read_excel(input_path, sheet_name=None)

    sheets_out = []
    for sheet_name, df in sheet_dict.items():
        # Drop completely empty rows/columns
        df = df.dropna(how="all").dropna(axis=1, how="all")
        if df.empty:
            continue

        # Check if first row looks like headers (contains "Member", "Guide", etc.)
        first_row = df.iloc[0].astype(str).tolist()
        if any(keyword in str(val).lower() for val in first_row for keyword in ['member', 'guide', 'blind', 'guns']):
            # First row is headers, use it and drop it from data
            headers = [str(val) if pd.notna(val) and str(val).strip() else f"Column_{i+1}" for i, val in enumerate(first_row)]
            df = df.iloc[1:].reset_index(drop=True)
        else:
            # Use column names as headers
            headers = [str(col) if not str(col).startswith('Unnamed') else f"Column_{i+1}" for i, col in enumerate(df.columns)]
        
        # Replace NaN with empty string and convert datetimes to ISO strings for JSON friendliness
        df_serializable = df.fillna("")

        def make_json_safe(value):
            if isinstance(value, (pd.Timestamp, datetime, date)):
                return value.strftime("%Y-%m-%d")
            return value

        safe_rows = []
        for _, row in df_serializable.iterrows():
            # Map row values to headers by position, not by pandas column names
            safe_row = {}
            for i, header in enumerate(headers):
                if i < len(row):
                    value = row.iloc[i] if hasattr(row, 'iloc') else list(row.values)[i]
                    safe_row[header] = make_json_safe(value)
                else:
                    safe_row[header] = ""
            safe_rows.append(safe_row)

        rows = safe_rows

        sheets_out.append(
            {
                "name": sheet_name,
                "headers": headers,
                "rows": rows,
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"sheets": sheets_out}, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert Excel workbook to JSON for the React visualizer.")
    parser.add_argument(
        "--input",
        "-i",
        type=str,
        default="LOGC_Tracker.xlsx",
        help="Path to Excel file (default: LOGC_Tracker.xlsx)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default="react-app/public/logc_tracker.json",
        help="Path to output JSON (default: react-app/public/logc_tracker.json)",
    )
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()

    if not input_path.exists():
        raise SystemExit(f"Input Excel file not found: {input_path}")

    excel_to_json(input_path, output_path)
    print(f"Wrote JSON to {output_path}")


if __name__ == "__main__":
    main()


