import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import ImageTable from './components/ImageTable'
import FileUpload from './components/FileUpload'
import DateSummaryTable from './components/DateSummaryTable'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import IndividualMemberStats from './components/IndividualMemberStats'
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
  const [viewMode, setViewMode] = useState('table') // 'table', 'club-wide', or 'individual'

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
      // Filter out template sheets (e.g., "sheet3")
      // Also filter out sheets with "TODO" in the name (incomplete data)
      const filteredSheets = json.sheets.filter(sheet => {
        const nameLower = sheet.name.toLowerCase()
        return !nameLower.includes('sheet3') && 
               !nameLower.includes('template') &&
               !nameLower.includes('todo')
      })
      if (filteredSheets.length === 0) {
        return false
      }
      
      // Sort sheets by date (most recent first)
      const sortedSheets = filteredSheets.sort((a, b) => {
        const parseDate = (dateStr) => {
          if (dateStr.includes('_')) {
            const parts = dateStr.split('_')
            if (parts.length === 3) {
              const month = parseInt(parts[0], 10) - 1
              const day = parseInt(parts[1], 10)
              let year = parseInt(parts[2], 10)
              if (year < 100) year += 2000
              return new Date(year, month, day).getTime()
            }
          }
          // Try YYYY-MM-DD format
          const date = new Date(dateStr + 'T00:00:00')
          return isNaN(date.getTime()) ? 0 : date.getTime()
        }
        return parseDate(b.name) - parseDate(a.name) // Most recent first
      })
      
      setExcelSheets(sortedSheets)
      setSelectedSheet(sortedSheets[0].name)
      return true
    } catch (e) {
      console.log('No Excel JSON found or failed to load:', e)
      return false
    }
  }

  const loadDefaultCSV = async () => {
    // Try multiple possible locations for the CSV file.
    // Prefer the GPT-based results if present.
    const baseUrl = import.meta.env.BASE_URL || '/'
    const csvPaths = [
      `${baseUrl}ocr_results_gpt.csv`,      // GPT vision results (public)
      `${baseUrl}ocr_results.csv`,          // OCR.space / Tesseract results (public)
      `${baseUrl}../output/ocr_results.csv`  // Parent output directory
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
            <h1>🦆 LOGC Shoot Logs and Stats</h1>
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
                  📋 Shoot Logs
                </button>
                <button
                  className={`tab-button ${viewMode === 'club-wide' ? 'active' : ''}`}
                  onClick={() => setViewMode('club-wide')}
                >
                  📊 Club-Wide Stats
                </button>
                <button
                  className={`tab-button ${viewMode === 'individual' ? 'active' : ''}`}
                  onClick={() => setViewMode('individual')}
                >
                  👤 Individual Member Stats
                </button>
            </div>

            {viewMode === 'table' ? (
              <>
                <div className="date-select-row">
                  <label htmlFor="sheet-select">Select shoot date:</label>
                  <select
                    id="sheet-select"
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                  >
                    {excelSheets.map((sheet) => {
                      // Format date as "Sunday, November 16, 2025"
                      const formatDateWithDay = (dateStr) => {
                        try {
                          let date
                          
                          // Try parsing MM_DD_YY format (e.g., "11_19_25")
                          if (dateStr.includes('_')) {
                            const parts = dateStr.split('_')
                            if (parts.length === 3) {
                              const month = parseInt(parts[0], 10) - 1 // Month is 0-indexed
                              const day = parseInt(parts[1], 10)
                              let year = parseInt(parts[2], 10)
                              // Handle 2-digit year (assume 2000s)
                              if (year < 100) {
                                year += 2000
                              }
                              date = new Date(year, month, day)
                            } else {
                              return dateStr
                            }
                          } else {
                            // Try parsing as YYYY-MM-DD format
                            date = new Date(dateStr + 'T00:00:00')
                          }
                          
                          if (isNaN(date.getTime())) {
                            // If not a valid date, return as-is
                            return dateStr
                          }
                          
                          const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
                          return date.toLocaleDateString('en-US', options)
                        } catch (e) {
                          return dateStr
                        }
                      }
                      return (
                        <option key={sheet.name} value={sheet.name}>
                          {formatDateWithDay(sheet.name)}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {selectedSheet && (() => {
                  const currentSheet = excelSheets.find((s) => s.name === selectedSheet)
                  if (!currentSheet) return null
                  
                  // Filter out columns that will be displayed in TableSummary
                  // Always include Geese column even if empty
                  const displayHeaders = currentSheet.headers.filter(h => {
                    const lower = h.toLowerCase()
                    // Always include Geese
                    if (lower.includes('geese')) return true
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
                  
                  // Ensure Geese is included even if not in headers
                  const hasGeese = displayHeaders.some(h => h.toLowerCase().includes('geese'))
                  if (!hasGeese) {
                    // Find Geese in original headers and add it
                    const geeseHeader = currentSheet.headers.find(h => h.toLowerCase().includes('geese'))
                    if (geeseHeader) {
                      displayHeaders.push(geeseHeader)
                    }
                  }
                  
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
                              {(() => {
                                // Separate Day Total row from regular rows
                                const memberHeader = displayHeaders.find(h => h.toLowerCase().includes('member')) || displayHeaders[0]
                                const regularRows = []
                                const dayTotalRow = []
                                
                                currentSheet.rows.forEach((row, idx) => {
                                  const memberValue = (row[memberHeader] || '').toString().trim().toLowerCase()
                                  if (memberValue.includes('day total')) {
                                    dayTotalRow.push({ row, idx })
                                  } else {
                                    regularRows.push({ row, idx })
                                  }
                                })
                                
                                // Combine: regular rows first, then Day Total at the bottom
                                const allRows = [...regularRows, ...dayTotalRow]
                                
                                return allRows.map(({ row, idx }) => {
                                  const memberValue = (row[memberHeader] || '').toString().trim().toLowerCase()
                                  const isDayTotal = memberValue.includes('day total')
                                  
                                  return (
                                    <tr key={idx} className={isDayTotal ? 'day-total-row' : ''}>
                                      {displayHeaders.map((h) => {
                                        const value = row[h]
                                        // Show "-" for empty cells (including Geese)
                                        return (
                                          <td key={h} style={isDayTotal ? { fontWeight: 'bold' } : {}}>
                                            {value || '-'}
                                          </td>
                                        )
                                      })}
                                    </tr>
                                  )
                                })
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </>
            ) : viewMode === 'club-wide' ? (
              <AnalyticsDashboard sheets={excelSheets} />
            ) : (
              <IndividualMemberStats sheets={excelSheets} />
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

