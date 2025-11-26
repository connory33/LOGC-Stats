import './TableSummary.css'

function TableSummary({ sheet }) {
  if (!sheet || !sheet.rows || sheet.rows.length === 0) {
    return null
  }

  const headers = sheet.headers || []
  const rows = sheet.rows || []
  
  // Identify columns to extract (totals, weather, and mixed data columns)
  // Exclude Hunter Total from totals display
  const totalColumns = headers.filter(h => {
    const lower = h.toLowerCase()
    return (lower.includes('total') || lower.includes('day total')) &&
           !lower.includes('hunter total')
  })
  
  // Find columns that contain weather/mixed data (not actual dates or member data)
  const extractColumns = headers.filter(h => {
    const lower = h.toLowerCase()
    
    // Skip member, guide, blind, guns, and species columns
    if (lower.includes('member') || lower.includes('guide') || 
        lower.includes('blind') || lower.includes('gun') ||
        lower.includes('mallard') || lower.includes('sprig') || 
        lower.includes('widgeon') || lower.includes('teal') ||
        lower.includes('wood') || lower.includes('other') ||
        lower.includes('geese') || lower.includes('pheasant') ||
        lower.includes('total')) {
      return false
    }
    
    // Include date columns that have non-date values (weather, temps, etc.)
    if (lower.includes('date') || lower.match(/^\d{4}-\d{2}-\d{2}/)) {
      // Check if it contains mixed data (not just dates)
      const hasNonDateData = rows.some(row => {
        const value = row[h]
        if (!value) return false
        const str = value.toString().trim()
        // If it's not a date format, include it
        return !str.match(/^\d{4}-\d{2}-\d{2}/)
      })
      return hasNonDateData
    }
    
    // Include weather/condition columns
    if (lower.includes('weather') || lower.includes('condition') ||
        lower.includes('temp') || lower.includes('wind')) {
      return true
    }
    
    return false
  })

  // Extract all values from extract columns (weather, temps, etc.)
  // Group by the "Date" column label if it exists
  const extractInfo = () => {
    const info = {}
    
    // Find the Date column (label column) and the date value column
    const dateLabelCol = headers.find(h => h.toLowerCase() === 'date')
    const dateValueCol = headers.find(h => h.match(/^\d{4}-\d{2}-\d{2}/))
    
    if (dateLabelCol && dateValueCol) {
      // Group values by their label from Date column
      const grouped = {}
      rows.forEach(row => {
        const label = row[dateLabelCol]
        const value = row[dateValueCol]
        if (label && value && value.toString().trim()) {
          const labelStr = label.toString().trim()
          const valueStr = value.toString().trim()
          if (!grouped[labelStr]) {
            grouped[labelStr] = []
          }
          if (!grouped[labelStr].includes(valueStr)) {
            grouped[labelStr].push(valueStr)
          }
        }
      })
      
      // Also include standalone values from date value column
      const standaloneValues = []
      rows.forEach(row => {
        const value = row[dateValueCol]
        if (value && value.toString().trim()) {
          const str = value.toString().trim()
          if (!str.match(/^\d{4}-\d{2}-\d{2}/) && !standaloneValues.includes(str)) {
            standaloneValues.push(str)
          }
        }
      })
      
      if (Object.keys(grouped).length > 0) {
        info[dateValueCol] = grouped
      } else if (standaloneValues.length > 0) {
        info[dateValueCol] = standaloneValues
      }
    } else {
      // Fallback: extract all values from extract columns
      extractColumns.forEach(col => {
        const values = []
        rows.forEach(row => {
          const value = row[col]
          if (value && value.toString().trim()) {
            const str = value.toString().trim()
            // Skip date-formatted values
            if (!str.match(/^\d{4}-\d{2}-\d{2}/)) {
              if (!values.includes(str)) {
                values.push(str)
              }
            }
          }
        })
        if (values.length > 0) {
          info[col] = values
        }
      })
    }
    
    return info
  }

  // Calculate totals
  const calculateTotals = () => {
    const totals = {}
    totalColumns.forEach(col => {
      let sum = 0
      rows.forEach(row => {
        const value = parseFloat(row[col]) || 0
        if (!isNaN(value)) {
          sum += value
        }
      })
      totals[col] = sum
    })
    return totals
  }

  const totals = calculateTotals()
  const extractedInfo = extractInfo()

  // If nothing to show, don't render
  if (Object.keys(totals).length === 0 && Object.keys(extractedInfo).length === 0) {
    return null
  }

  // Helper to determine if a value looks like weather
  const isWeatherValue = (value) => {
    const lower = value.toLowerCase()
    return lower.includes('rain') || lower.includes('wind') || 
           lower.includes('mph') || lower.includes('mph') ||
           lower.includes('high') || lower.includes('low') ||
           lower.includes('clear') || lower.includes('cloud') ||
           lower.includes('sse') || lower.includes('nw') || 
           lower.includes('ne') || lower.includes('sw') ||
           lower.includes('n') || lower.includes('s') ||
           lower.includes('e') || lower.includes('w')
  }

  // Helper to determine if a value looks like temperature
  const isTemperature = (value) => {
    return /^\d+$/.test(value.toString().trim()) && 
           parseInt(value) > 0 && parseInt(value) < 150
  }

  // Separate weather/temp info from totals
  // Weather info: High, Low, Wind, Conditions, etc.
  // Totals: numeric values that are totals (like Total Ducks, Total Mallards, etc.)
  const weatherInfo = {}
  const totalsFromExtracted = {}
  
  Object.entries(extractedInfo).forEach(([label, data]) => {
    const isGrouped = typeof data === 'object' && !Array.isArray(data)
    if (isGrouped) {
      Object.entries(data).forEach(([groupLabel, values]) => {
        const groupLower = groupLabel.toLowerCase()
        
        // First check: if label contains "total", it's a total, not weather
        const isTotalLabel = groupLower.includes('total')
        
        if (isTotalLabel) {
          // This is a total - sum the values
          const sum = values.reduce((acc, v) => acc + (parseFloat(v) || 0), 0)
          if (sum > 0) {
            totalsFromExtracted[groupLabel] = sum
          }
        } else {
          // Check if this is a weather-related label
          const isWeatherLabel = groupLower.includes('high') || 
                                 groupLower.includes('low') || 
                                 groupLower.includes('wind') || 
                                 groupLower.includes('condition') ||
                                 groupLower.includes('temp') ||
                                 groupLower.includes('rain') ||
                                 groupLower.includes('cloud')
          
          // Check if values are weather-related (not just numbers)
          const hasWeatherValues = values.some(v => {
            const vStr = v.toString().toLowerCase()
            return isWeatherValue(v) || vStr.includes('mph') || vStr.includes('rain') || 
                   vStr.includes('sse') || vStr.includes('nw') || vStr.includes('ne') ||
                   vStr.includes('sw') || vStr.includes('clear') || vStr.includes('cloud')
          })
          
          if (isWeatherLabel || hasWeatherValues) {
            // This is weather info
            if (!weatherInfo[label]) weatherInfo[label] = {}
            weatherInfo[label][groupLabel] = values
          } else {
            // Check if all values are numeric - might be totals
            const allNumeric = values.every(v => {
              const num = parseFloat(v)
              return !isNaN(num) && num > 0
            })
            if (allNumeric && values.length > 0) {
              // These are totals (like species counts)
              const sum = values.reduce((acc, v) => acc + (parseFloat(v) || 0), 0)
              if (sum > 0) {
                totalsFromExtracted[groupLabel] = sum
              }
            } else {
              // Default to weather if unsure
              if (!weatherInfo[label]) weatherInfo[label] = {}
              weatherInfo[label][groupLabel] = values
            }
          }
        }
      })
    }
  })
  
  // Merge totals from extracted info with calculated totals
  const allTotals = { ...totals, ...totalsFromExtracted }

  return (
    <div className="table-summary">
      {Object.keys(weatherInfo).length > 0 && (
        <div className="summary-section weather-section">
          <h3>🌤️ Weather & Conditions</h3>
          {Object.entries(weatherInfo).map(([label, data]) => (
            <div key={label} className="weather-container">
              {Object.entries(data).map(([groupLabel, values]) => (
                <div key={groupLabel} className="weather-card">
                  <div className="weather-card-header">
                    <span className="weather-card-icon">
                      {groupLabel.toLowerCase().includes('wind') ? '💨' :
                       groupLabel.toLowerCase().includes('condition') || groupLabel.toLowerCase().includes('rain') ? '🌧️' :
                       groupLabel.toLowerCase().includes('high') || groupLabel.toLowerCase().includes('low') ? '🌡️' :
                       '🌤️'}
                    </span>
                    <span className="weather-card-title">{groupLabel}</span>
                  </div>
                  <div className="weather-card-content">
                    {values.map((value, idx) => {
                      const isWeather = isWeatherValue(value)
                      const isTemp = isTemperature(value)
                      return (
                        <div 
                          key={idx} 
                          className={`weather-badge ${isWeather ? 'weather-type' : ''} ${isTemp ? 'temp-type' : ''}`}
                        >
                          {isWeather && <span className="badge-icon">🌤️</span>}
                          {isTemp && <span className="badge-icon">🌡️</span>}
                          <span className="badge-text">{value}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {Object.keys(allTotals).length > 0 && (
        <div className="summary-section totals-section">
          <h3>📊 Totals</h3>
          <div className="totals-grid">
            {Object.entries(allTotals).map(([label, value]) => (
              <div key={label} className="total-card">
                <div className="total-label">{label.replace('Total', '').trim() || 'Total'}</div>
                <div className="total-value">{value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TableSummary

