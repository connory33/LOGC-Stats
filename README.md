# LOGC Stats - Hunting Data Visualization

A React-based web application for visualizing and analyzing hunting data from Excel spreadsheets.

## Features

- 📊 **Data Tables**: View hunting data from Excel sheets in organized tables
- 📈 **Analytics Dashboard**: Comprehensive analytics with charts and statistics
- 🌤️ **Weather Filtering**: Filter analytics by weather conditions
- 📋 **Summary Cards**: Quick stats including totals, averages, and more
- 🎨 **Natural Theme**: Earthy, hunting-themed color palette

## Tech Stack

- **Frontend**: React + Vite
- **Charts**: Recharts
- **Data Processing**: Python (pandas, openpyxl)
- **Deployment**: GitHub Pages

## Setup

### Prerequisites

- Node.js 18+
- Python 3.8+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/connory33/LOGC-Stats.git
cd LOGC-Stats
```

2. Install Python dependencies:
```bash
python -m venv .venv
.venv\Scripts\activate  # Windows
# or
source .venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

3. Install Node dependencies:
```bash
cd react-app
npm install
```

4. Convert Excel to JSON:
```bash
cd ..
python excel_to_json.py --input "LOGC_Tracker.xlsx" --output "react-app/public/logc_tracker.json"
```

5. Run the development server:
```bash
cd react-app
npm run dev
```

## Deployment

The app is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the `main` branch.

## Project Structure

```
.
├── react-app/              # React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── utils/         # Utility functions
│   │   └── App.jsx        # Main app component
│   └── public/            # Static assets
├── excel_to_json.py        # Excel to JSON converter
├── requirements.txt        # Python dependencies
└── LOGC_Tracker.xlsx      # Source Excel file
```

## Usage

1. Update your Excel file (`LOGC_Tracker.xlsx`) with new hunting data
2. Run `python excel_to_json.py` to regenerate the JSON
3. Refresh the app to see updated data

## License

MIT
