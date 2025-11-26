# Hunting Data Visualizer

This repository contains tools to OCR images and visualize the extracted data in a React web application.

## Components

1. **OCR Script** (`ocr_images.py`) - Python tool to OCR all images and generate CSV data
2. **React App** (`react-app/`) - Web application to visualize OCR data in a beautiful table format

## Prerequisites

- Python 3.9+ installed and available on PATH
- Tesseract OCR installed (recommended)
  - Windows (Chocolatey): `choco install tesseract -y`
  - Or download installer: https://github.com/UB-Mannheim/tesseract/wiki
  - Default Windows path: `C:\Program Files\Tesseract-OCR\tesseract.exe`

The script will attempt to auto-detect `tesseract.exe`. If not found, it will print guidance. You can still install Tesseract afterwards and re-run.

## Setup

From PowerShell in this folder:

```powershell
python -m venv .venv
.\\.venv\\Scripts\\Activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## Run OCR

Run the script from this folder. By default it scans the current directory and writes outputs to `output/`.

```powershell
python ocr_images.py --input "." --output ".\\output" --lang eng --psm 6 --oem 3
```

- Text files: `output/text/<image_basename>.txt`
- Aggregate CSV: `output/ocr_results.csv`
- Optional PDFs (add `--pdf`): `output/pdf/<image_basename>.pdf`

### Useful Flags

- `--lang`: Language(s) for OCR, e.g. `eng`, `eng+spa`
- `--psm`: Page segmentation mode (common values: 6 or 3)
- `--oem`: Engine mode (3 is a good default)
- `--pdf`: Also generate searchable PDFs

## React Visualization App

After running OCR and generating the CSV file, you can visualize the data in a React web app.

### Setup React App

```powershell
cd react-app
npm install
```

### Run React App

```powershell
npm run dev
```

The app will open in your browser at `http://localhost:3000`.

### Features

- 📊 **Table View**: Displays all OCR data in a sortable, searchable table
- 🔍 **Search**: Filter data by any column
- 📁 **File Upload**: Upload CSV files directly or use the generated `output/ocr_results.csv`
- 🎨 **Modern UI**: Beautiful, responsive design with gradient styling
- 📱 **Responsive**: Works on desktop and mobile devices

The app automatically tries to load `output/ocr_results.csv` on startup. You can also upload any CSV file with the same format (filename, text columns).

## Notes

- Supported image formats: jpg, jpeg, png, tif, tiff, bmp, webp
- For best results, ensure images are upright and reasonably sharp. The script applies light preprocessing (grayscale, autocontrast, sharpen) before OCR.

