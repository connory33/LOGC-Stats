import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import ImageTable from './components/ImageTable'
import FileUpload from './components/FileUpload'
import DateSummaryTable from './components/DateSummaryTable'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import TableSummary from './components/TableSummary'
import { parseOCRToTable } from './utils/parseOCRData'
import './App.css'

function App() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tablesByDate, setTablesByDate] = useState({})
  const [selectedDate, setSelectedDate] = useState('')
  const [excelSheets, setExcelSheets] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [viewMode, setViewMode] = useState('table') // 'table' or 'analytics'

  // On mount, prefer Excel-based visualization; fall back to CSV/OCR if not found.
  useEffect(() => {
    const init = async () => {
      const excelLoaded = await loadExcelJson()
      if (!excelLoaded) {
        await loadDefaultCSV()
      }
    }
    init()
  }, [])

  const loadExcelJson = async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}logc_tracker.json`)
      if (!response.ok) return false
      const json = await response.json()
      if (!json || !Array.isArray(json.sheets) || json.sheets.length === 0) {
        return false
      }
      setExcelSheets(json.sheets)
      setSelectedSheet(json.sheets[0].name)
      return true
    } catch (e) {
      console.log('No Excel JSON found or failed to load:', e)
      return false
    }
  }

  const loadDefaultCSV = async () => {
    // Try multiple possible locations for the CSV file.
    // Prefer the GPT-based results if present.
    const csvPaths = [
      '/ocr_results_gpt.csv',      // GPT vision results (public)
      '/ocr_results.csv',          // OCR.space / Tesseract results (public)
      '../output/ocr_results.csv'  // Parent output directory
    ]
    
    for (const path of csvPaths) {
      try {
        const response = await fetch(path)
        
        // Check if response is actually CSV (not HTML fallback)
        const contentType = response.headers.get('content-type') || ''
        const isCSV = contentType.includes('text/csv') || 
                       contentType.includes('application/csv') ||
                       contentType.includes('text/plain')
        
        if (response.ok) {
          const text = await response.text()
          // Critical check: make sure it's not HTML
          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            console.log(`Received HTML instead of CSV from ${path}, trying next location...`)
            continue
          }
          // If it looks like CSV, parse it
          if (isCSV || text.includes(',') || text.includes('filename')) {
            parseCSV(text)
            return // Success, stop trying other paths
          }
        }
      } catch (err) {
        // Try next path
        continue
      }
    }
    
    console.log('CSV file not found in any expected location, waiting for user upload')
  }

  const parseCSV = (csvText) => {
    setLoading(true)
    setError(null)
    
    // Safety check: don't parse HTML files
    const trimmed = csvText.trim()
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<?xml')) {
      setError('Invalid file: This appears to be an HTML/XML file, not a CSV file.')
      setLoading(false)
      return
    }
    
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      delimiter: ',',
      quoteChar: '"',
      escapeChar: '"',
      newline: '\n',
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (results) => {
        // Filter out parsing errors that are just warnings
        const criticalErrors = results.errors.filter(
          err => err.type !== 'Quotes' && err.type !== 'Delimiter'
        )
        
        if (criticalErrors.length > 0) {
          setError(`CSV parsing errors: ${criticalErrors.map(e => e.message).join(', ')}`)
        }
        
        // Use the data even if there are minor warnings
        if (results.data && results.data.length > 0) {
          // Filter out completely empty rows and error entries
          const validData = results.data.filter(row => {
            const hasContent = Object.values(row).some(val => val && String(val).trim().length > 0)
            const isNotError = !String(row.text || '').startsWith('ERROR:')
            return hasContent && isNotError
          })
          setData(validData)

          // Build tables grouped by date (from GPT JSON metadata when available)
          const byDate = {}
          validData.forEach(row => {
            const parsed = parseOCRToTable(row.text || '')
            const dateKey =
              (parsed.metadata && parsed.metadata.date) ||
              row.filename ||
              'Unknown'

            if (!byDate[dateKey]) {
              byDate[dateKey] = []
            }
            byDate[dateKey].push(row)
          })
          setTablesByDate(byDate)
          const firstKey = Object.keys(byDate)[0]
          if (firstKey) {
            setSelectedDate(firstKey)
          }
        } else {
          setError('No valid data found in CSV file')
        }
        setLoading(false)
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`)
        setLoading(false)
      }
    })
  }

  const handleFileUpload = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      parseCSV(e.target.result)
    }
    reader.onerror = () => {
      setError('Failed to read file')
      setLoading(false)
    }
    reader.readAsText(file)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🦌 Hunting Data Visualizer</h1>
        <p>Visualize hunting data from Excel or OCR</p>
      </header>

      <div className="app-content">
        {/* If Excel data is present, show it as primary view */}
        {excelSheets.length > 0 ? (
          <>
            {/* View Mode Tabs */}
            <div className="view-tabs">
              <button
                className={`tab-button ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                📋 Tables
              </button>
              <button
                className={`tab-button ${viewMode === 'analytics' ? 'active' : ''}`}
                onClick={() => setViewMode('analytics')}
              >
                📊 Analytics
              </button>
            </div>

            {viewMode === 'table' ? (
              <>
                <div className="date-select-row">
                  <label htmlFor="sheet-select">Select table:</label>
                  <select
                    id="sheet-select"
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                  >
                    {excelSheets.map((sheet) => (
                      <option key={sheet.name} value={sheet.name}>
                        {sheet.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSheet && (() => {
                  const currentSheet = excelSheets.find((s) => s.name === selectedSheet)
                  if (!currentSheet) return null
                  
                  // Filter out columns that will be displayed in TableSummary
                  const displayHeaders = currentSheet.headers.filter(h => {
                    const lower = h.toLowerCase()
                    // Exclude total columns
                    if (lower.includes('total')) return false
                    // Exclude weather/condition/temp/wind columns
                    if (lower.includes('weather') || lower.includes('condition') ||
                        lower.includes('temp') || lower.includes('wind')) return false
                    // Exclude Date columns that contain non-date data (weather, temps, etc.)
                    if (lower.includes('date') || lower.match(/^\d{4}-\d{2}-\d{2}/)) {
                      // Check if this column has non-date values
                      const hasNonDateData = currentSheet.rows.some(row => {
                        const value = row[h]
                        if (!value) return false
                        const str = value.toString().trim()
                        return !str.match(/^\d{4}-\d{2}-\d{2}/)
                      })
                      if (hasNonDateData) return false
                    }
                    return true
                  })
                  
                  return (
                    <>
                      <TableSummary sheet={currentSheet} />
                      <div className="date-table-container">
                        <div className="table-wrapper">
                          <table className="data-table fixed-layout">
                            <thead>
                              <tr>
                                {displayHeaders.map((h) => (
                                  <th key={h}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {currentSheet.rows.map((row, idx) => (
                                <tr key={idx}>
                                  {displayHeaders.map((h) => (
                                    <td key={h}>{row[h] || ''}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </>
            ) : (
              <AnalyticsDashboard sheets={excelSheets} />
            )}
          </>
        ) : (
          <>
            <FileUpload onFileUpload={handleFileUpload} />

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Loading data...</p>
              </div>
            ) : data.length > 0 ? (
              <>
                {/* Date dropdown + fixed layout table */}
                <div className="date-select-row">
                  <label htmlFor="date-select">Select date/file:</label>
                  <select
                    id="date-select"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  >
                    {Object.keys(tablesByDate).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDate && tablesByDate[selectedDate] && (
                  <DateSummaryTable
                    date={selectedDate}
                    records={tablesByDate[selectedDate]}
                  />
                )}

                {/* Existing per-image expandable views, if you still want them */}
                <div className="images-container" style={{ marginTop: '30px' }}>
                  <div className="images-header">
                    <h2>📋 Per-image tables</h2>
                    <p className="images-count">{data.length} images processed</p>
                  </div>
                  {data.map((row, index) => (
                    <ImageTable
                      key={index}
                      filename={row.filename || `Image ${index + 1}`}
                      text={row.text || ''}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>📊 No data loaded yet.</p>
                <p>Upload a CSV file or ensure <code>output/ocr_results.csv</code> exists.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App

