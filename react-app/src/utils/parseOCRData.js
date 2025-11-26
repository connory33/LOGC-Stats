/**
 * Parse OCR text into structured table data
 * Attempts to identify rows and columns from the OCR text
 */
export function parseOCRToTable(ocrText) {
  if (!ocrText) return { headers: [], rows: [] }

  // First, try to interpret the text as JSON coming directly from the GPT OCR.
  // We expect a shape like: { headers: [...], rows: [...], metadata: {...} }
  const trimmed = ocrText.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed.headers) && Array.isArray(parsed.rows)) {
        const headers = parsed.headers
        const rows = parsed.rows.map((row) => {
          // Rows may be arrays (aligned with headers) or objects.
          if (Array.isArray(row)) {
            const obj = {}
            headers.forEach((h, idx) => {
              obj[h] = row[idx] ?? ''
            })
            return obj
          }
          if (row && typeof row === 'object') {
            return row
          }
          return { Value: String(row) }
        })

        return {
          headers,
          rows,
          metadata: parsed.metadata || {},
        }
      }
    } catch (e) {
      // Not valid JSON – fall through to heuristic text parsing.
    }
  }

  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  // Common patterns to identify
  const datePattern = /(?:DATE|Date|date)[:\s]+([A-Za-z]+\s+\d+)/i
  const recordPattern = /(?:Record|record|Waterfowl|Matec|Hunting)/i
  const numberedLinePattern = /^(\d+)\s+(.+)$/  // "1 Name" or "2 Name"
  const keyValuePattern = /^([^:]+):\s*(.+)$/  // "Key: Value"
  
  let foundDate = null
  let foundRecordType = null
  const members = []
  const guide = []
  const otherData = []
  const keyValuePairs = []
  
  let currentSection = null
  
  // Parse the text into structured sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Extract date
    const dateMatch = line.match(datePattern)
    if (dateMatch) {
      foundDate = dateMatch[1]
      continue
    }
    
    // Extract record type
    if (recordPattern.test(line)) {
      foundRecordType = line
      continue
    }
    
    // Detect section headers
    if (line.toLowerCase().includes('member')) {
      currentSection = 'members'
      continue
    }
    if (line.toLowerCase().includes('guide')) {
      currentSection = 'guide'
      continue
    }
    if (line.toLowerCase().includes('weather') || line.toLowerCase().includes('condition')) {
      currentSection = 'weather'
      continue
    }
    if (line.toLowerCase().includes('day total') || line.toLowerCase().includes('total')) {
      currentSection = 'totals'
      continue
    }
    
    // Parse numbered lines (members, guide, etc.)
    const numberedMatch = line.match(numberedLinePattern)
    if (numberedMatch) {
      const [, number, name] = numberedMatch
      if (currentSection === 'members') {
        members.push({ Number: number, Name: name })
      } else if (currentSection === 'guide') {
        guide.push({ Number: number, Name: name })
      } else {
        // Default to members if no section specified
        members.push({ Number: number, Name: name })
      }
      continue
    }
    
    // Parse key-value pairs
    const kvMatch = line.match(keyValuePattern)
    if (kvMatch) {
      const [, key, value] = kvMatch
      keyValuePairs.push({ Key: key.trim(), Value: value.trim() })
      continue
    }
    
    // If it's a name without a number (might be continuation)
    if (currentSection === 'members' || currentSection === 'guide') {
      const namePattern = /^[A-Z][a-z]+\s+[A-Z][a-z]+/  // "First Last"
      if (namePattern.test(line) && !line.match(/^\d/)) {
        if (currentSection === 'members') {
          members.push({ Number: '', Name: line })
        } else {
          guide.push({ Number: '', Name: line })
        }
        continue
      }
    }
    
    // Collect other data
    if (line.length > 0 && !line.match(/^\d+$/)) {
      otherData.push(line)
    }
  }
  
  // Build tables based on what we found
  if (members.length > 0) {
    return {
      headers: ['Number', 'Name'],
      rows: members,
      metadata: {
        date: foundDate,
        recordType: foundRecordType,
        section: 'Members'
      }
    }
  }
  
  if (guide.length > 0) {
    return {
      headers: ['Number', 'Name'],
      rows: guide,
      metadata: {
        date: foundDate,
        recordType: foundRecordType,
        section: 'Guide'
      }
    }
  }
  
  if (keyValuePairs.length > 0) {
    return {
      headers: ['Key', 'Value'],
      rows: keyValuePairs,
      metadata: {
        date: foundDate,
        recordType: foundRecordType
      }
    }
  }
  
  // Try to find tabular structure with multiple spaces or pipes
  const tableLines = lines.filter(line => {
    const hasMultipleSeparators = (line.match(/\|/g) || []).length >= 2
    const hasMultipleSpaces = line.split(/\s{2,}/).length >= 2
    return hasMultipleSeparators || hasMultipleSpaces
  })
  
  if (tableLines.length > 0) {
    const parsedRows = tableLines.map(line => {
      if (line.includes('|')) {
        return line.split('|').map(col => col.trim()).filter(col => col.length > 0)
      }
      return line.split(/\s{2,}/).map(col => col.trim()).filter(col => col.length > 0)
    })
    
    const maxCols = Math.max(...parsedRows.map(row => row.length))
    const headerRowIndex = parsedRows.findIndex(row => row.length === maxCols)
    
    if (headerRowIndex >= 0 && parsedRows[headerRowIndex].length > 1) {
      const headers = parsedRows[headerRowIndex]
      const rows = parsedRows.slice(headerRowIndex + 1).map(row => {
        const obj = {}
        headers.forEach((header, idx) => {
          obj[header] = row[idx] || ''
        })
        return obj
      })
      
      return {
        headers,
        rows: rows.filter(row => Object.values(row).some(v => v && v.trim().length > 0)),
        metadata: {
          date: foundDate,
          recordType: foundRecordType
        }
      }
    }
  }
  
  // Fallback: create a structured view
  const structuredRows = []
  let currentRow = {}
  
  for (const line of lines) {
    const kvMatch = line.match(keyValuePattern)
    const numMatch = line.match(numberedLinePattern)
    if (kvMatch) {
      if (Object.keys(currentRow).length > 0) {
        structuredRows.push(currentRow)
      }
      currentRow = { [kvMatch[1].trim()]: kvMatch[2].trim() }
    } else if (numMatch) {
      if (Object.keys(currentRow).length > 0) {
        structuredRows.push(currentRow)
      }
      currentRow = { Number: numMatch[1], Name: numMatch[2] }
    } else {
      currentRow[`Field${Object.keys(currentRow).length + 1}`] = line
    }
  }
  
  if (Object.keys(currentRow).length > 0) {
    structuredRows.push(currentRow)
  }
  
  if (structuredRows.length > 0) {
    const allKeys = new Set()
    structuredRows.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)))
    return {
      headers: Array.from(allKeys),
      rows: structuredRows,
      metadata: {
        date: foundDate,
        recordType: foundRecordType
      }
    }
  }
  
  // Final fallback: simple list
  return {
    headers: ['Content'],
    rows: lines.map(line => ({ Content: line })),
    metadata: {
      date: foundDate,
      recordType: foundRecordType
    }
  }
}

