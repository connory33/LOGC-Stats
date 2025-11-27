import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import './AnalyticsDashboard.css'

// Varied color palette for pie chart - less green, more diversity
const COLORS = ['#5a7c4a', '#8b6f47', '#a0826d', '#6b8e5a', '#9d7e5f', '#4a6b3a', '#c4a574', '#7a9c6a', '#d4a574', '#6d8b5a', '#b8956a', '#8b7355', '#9d8b6f', '#a68b6d']

function AnalyticsDashboard({ sheets }) {
  const [selectedCondition, setSelectedCondition] = useState('all')
  const [membersView, setMembersView] = useState('total')
  const [blindsView, setBlindsView] = useState('total')
  const [guidesView, setGuidesView] = useState('total')
  const [hoveredSpecies, setHoveredSpecies] = useState(null)
  
  // Process all sheets data into analytics
  const analytics = useMemo(() => {
    if (!sheets || sheets.length === 0) {
      console.log('AnalyticsDashboard: No sheets provided')
      return null
    }
    
    try {

    const allRecords = []
    const memberStats = {}
    const blindStats = {}
    const blindMallardStats = {}
    const speciesStats = {}
    const dateStats = {}
    const guideStats = {}
    const guideMallardStats = {}
    const memberBlindStats = {}
    const memberSpeciesStats = {}
    let totalMallardsCount = 0

    // Process each sheet
    sheets.forEach(sheet => {
      const headers = sheet.headers || []
      const rows = sheet.rows || []
      const date = sheet.name || 'Unknown'

      // Find column indices
      const memberIdx = headers.findIndex(h => h.toLowerCase().includes('member'))
      const guideIdx = headers.findIndex(h => h.toLowerCase().includes('guide'))
      const blindIdx = headers.findIndex(h => h.toLowerCase().includes('blind'))
      const gunsIdx = headers.findIndex(h => h.toLowerCase().includes('gun'))
      const dateColIdx = headers.findIndex(h => h.toLowerCase() === 'date')
      const weatherIdx = headers.findIndex(h => h.toLowerCase().includes('weather') || h.toLowerCase().includes('condition'))
      
      // Find the date value column (the one with actual date format or weather values)
      const dateValueCol = headers.find(h => h.match(/^\d{4}-\d{2}-\d{2}/))
      
      // Extract condition for this sheet (one condition per hunt/sheet)
      let sheetCondition = 'Unknown'
      const conditionRow = rows.find(r => {
        if (dateColIdx >= 0 && r[headers[dateColIdx]]) {
          const label = r[headers[dateColIdx]].toString().trim().toLowerCase()
          return label === 'conditions' || label === 'condition'
        }
        return false
      })
      
      if (conditionRow && dateValueCol && conditionRow[dateValueCol]) {
        const conditionValue = conditionRow[dateValueCol].toString().trim()
        if (conditionValue && !conditionValue.match(/^\d{4}-\d{2}-\d{2}/)) {
          sheetCondition = conditionValue
        }
      }
      
      // Species columns (exclude "Day Total" and "Hunter Total")
      const speciesCols = headers
        .map((h, idx) => ({ name: h, idx }))
        .filter(({ name }) => {
          const lower = name.toLowerCase()
          return (lower.includes('mallard') || lower.includes('sprig') || lower.includes('widgeon') ||
                 lower.includes('teal') || lower.includes('wood') || lower.includes('other') ||
                 lower.includes('geese') || lower.includes('pheasant')) &&
                 !lower.includes('day total') && !lower.includes('hunter total')
        })

      rows.forEach(row => {
        // Access row by header name directly, not by index
        const member = (row[headers[memberIdx]] || '').toString().trim()
        const guide = (row[headers[guideIdx]] || '').toString().trim()
        const blind = (row[headers[blindIdx]] || '').toString().trim()
        const guns = parseFloat(row[headers[gunsIdx]] || 0) || 0
        
        // Use the condition extracted for this sheet (one condition per hunt)
        const condition = sheetCondition
        
        // Skip header row, empty rows, and "Day Total" entries
        const memberLower = member.toLowerCase()
        if (!member || memberLower === 'member' || member === '' || 
            memberLower.includes('day total') || memberLower.includes('total')) {
          return
        }

        let totalDucks = 0
        let totalGeese = 0
        const speciesKills = {}

        speciesCols.forEach(({ name, idx }) => {
          const rawValue = row[name] || row[headers[idx]] || ''
          const value = parseFloat(rawValue) || 0
          if (!isNaN(value) && value > 0) {
            speciesKills[name] = value
            // Separate ducks from geese
            const nameLower = name.toLowerCase()
            if (nameLower.includes('geese')) {
              totalGeese += value
            } else {
              // All other species are ducks (mallard, sprig, widgeon, teal, wood, other, pheasant)
              totalDucks += value
            }
          }
        })
        
        // Calculate total mallards for this record (Drake + Hen)
        const drakeMallard = parseFloat(row['Drake Mallard'] || row[headers.find(h => h.toLowerCase().includes('drake') && h.toLowerCase().includes('mallard'))] || 0) || 0
        const henMallard = parseFloat(row['Hen Mallard'] || row[headers.find(h => h.toLowerCase().includes('hen') && h.toLowerCase().includes('mallard'))] || 0) || 0
        const recordMallards = drakeMallard + henMallard

        if (totalDucks === 0 && totalGeese === 0 && guns === 0) return // Skip empty rows

        const record = {
          date,
          member,
          guide,
          blind: String(blind || 'Unknown'),
          guns,
          condition,
          totalDucks,
          totalGeese,
          speciesKills,
          totalMallards: recordMallards
        }

        allRecords.push(record)
        totalMallardsCount += recordMallards

        // Aggregate stats - separate ducks and geese
        if (member) {
          if (!memberStats[member]) {
            memberStats[member] = { ducks: 0, geese: 0 }
          }
          memberStats[member].ducks += totalDucks
          memberStats[member].geese += totalGeese
          if (!memberSpeciesStats[member]) memberSpeciesStats[member] = {}
          Object.entries(speciesKills).forEach(([species, count]) => {
            memberSpeciesStats[member][species] = (memberSpeciesStats[member][species] || 0) + count
          })
        }

        if (blind && blind !== 'Unknown') {
          const blindKey = String(blind)
          if (!blindStats[blindKey]) {
            blindStats[blindKey] = { ducks: 0, geese: 0 }
          }
          blindStats[blindKey].ducks += totalDucks
          blindStats[blindKey].geese += totalGeese
          blindMallardStats[blindKey] = (blindMallardStats[blindKey] || 0) + recordMallards
          if (member && blind) {
            const key = `${member}-${blindKey}`
            if (!memberBlindStats[key]) {
              memberBlindStats[key] = { ducks: 0, geese: 0 }
            }
            memberBlindStats[key].ducks += totalDucks
            memberBlindStats[key].geese += totalGeese
          }
        }

        if (guide) {
          if (!guideStats[guide]) {
            guideStats[guide] = { ducks: 0, geese: 0 }
          }
          guideStats[guide].ducks += totalDucks
          guideStats[guide].geese += totalGeese
          guideMallardStats[guide] = (guideMallardStats[guide] || 0) + recordMallards
        }

        Object.entries(speciesKills).forEach(([species, count]) => {
          speciesStats[species] = (speciesStats[species] || 0) + count
        })

        if (!dateStats[date]) {
          dateStats[date] = { ducks: 0, geese: 0 }
        }
        dateStats[date].ducks += totalDucks
        dateStats[date].geese += totalGeese
      })
    })

    // Calculate number of hunts (unique dates)
    const numHunts = Object.keys(dateStats).length || 1

    // Convert to arrays for charts with averages
    const allMembersArray = Object.entries(memberStats)
      .map(([name, stats]) => {
        // Count how many hunts this member participated in
        const memberHunts = allRecords.filter(r => r.member === name).length || 1
        const totalDucks = stats.ducks || 0
        const totalGeese = stats.geese || 0
        const total = totalDucks + totalGeese
        return { 
          name, 
          ducks: totalDucks,
          geese: totalGeese,
          total,
          avgDucks: totalDucks / memberHunts,
          avgGeese: totalGeese / memberHunts,
          average: total / memberHunts,
          hunts: memberHunts
        }
      })
      .sort((a, b) => b.total - a.total)

    const topMembers = allMembersArray.slice(0, 10)

    const topMembersAvg = [...topMembers]
      .sort((a, b) => b.average - a.average)
      .slice(0, 10)

    const topBlinds = Object.entries(blindStats)
      .filter(([name]) => name && name !== 'Unknown' && name !== '')
      .map(([name, stats]) => {
        // Count how many hunts this blind was used (convert to string for comparison)
        const blindHunts = allRecords.filter(r => String(r.blind) === String(name)).length || 1
        const totalDucks = stats.ducks || 0
        const totalGeese = stats.geese || 0
        const total = totalDucks + totalGeese
        const mallards = blindMallardStats[name] || 0
        const otherDucks = totalDucks - mallards
        return { 
          name: String(name), 
          ducks: totalDucks,
          geese: totalGeese,
          total,
          mallards,
          otherDucks,
          average: total / blindHunts,
          avgDucks: totalDucks / blindHunts,
          avgGeese: totalGeese / blindHunts,
          avgMallards: mallards / blindHunts,
          avgOtherDucks: otherDucks / blindHunts,
          hunts: blindHunts
        }
      })
      .sort((a, b) => b.total - a.total)

    const topBlindsAvg = [...topBlinds]
      .sort((a, b) => b.average - a.average)

    const topSpecies = Object.entries(speciesStats)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
    
    // Get species columns in original sheet order (from first sheet)
    let speciesOrder = []
    if (sheets.length > 0 && sheets[0].headers) {
      const firstSheetHeaders = sheets[0].headers
      speciesOrder = firstSheetHeaders
        .filter(h => {
          const lower = h.toLowerCase()
          return (lower.includes('mallard') || lower.includes('sprig') || lower.includes('widgeon') ||
                 lower.includes('teal') || lower.includes('wood') || lower.includes('other') ||
                 lower.includes('geese') || lower.includes('pheasant')) &&
                 !lower.includes('day total') && !lower.includes('hunter total')
        })
    }

    // Get all unique dates from all sheets
    const allDates = new Set()
    sheets.forEach(sheet => {
      const date = sheet.name || 'Unknown'
      if (date !== 'Unknown') {
        allDates.add(date)
      }
    })
    
    // Parse dates for sorting
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
      return new Date(dateStr).getTime()
    }
    
    // Format date for display
    const formatDate = (dateStr) => {
      if (dateStr.includes('_')) {
        const parts = dateStr.split('_')
        if (parts.length === 3) {
          return `${parts[0]}/${parts[1]}/${parts[2]}`
        }
      }
      try {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          const month = date.getMonth() + 1
          const day = date.getDate()
          const year = date.getFullYear().toString().slice(-2)
          return `${month}/${day}/${year}`
        }
      } catch (e) {
        // Fallback
      }
      return dateStr
    }
    
    // Build dateTrends with all dates, including those with no data
    const dateTrends = Array.from(allDates).map(date => {
      const stats = dateStats[date]
      if (stats) {
        // Calculate mallards for this date
        const dateMallards = allRecords
          .filter(r => r.date === date)
          .reduce((sum, r) => sum + (r.totalMallards || 0), 0)
        
        // Calculate number of unique blinds for this date
        const dateRecords = allRecords.filter(r => r.date === date)
        const uniqueBlinds = new Set()
        dateRecords.forEach(r => {
          if (r.blind && r.blind !== 'Unknown' && r.blind.trim() !== '') {
            uniqueBlinds.add(String(r.blind).trim())
          }
        })
        const blindCount = uniqueBlinds.size
        
        return {
          date,
          dateFormatted: formatDate(date),
          dateSort: parseDate(date),
          ducks: stats.ducks || 0,
          geese: stats.geese || 0,
          mallards: dateMallards,
          total: (stats.ducks || 0) + (stats.geese || 0),
          blindCount: blindCount,
          status: 'hunted'
        }
      } else {
        // No data for this date - show "DNH"
        return {
          date,
          dateFormatted: formatDate(date),
          dateSort: parseDate(date),
          ducks: 0,
          geese: 0,
          mallards: 0,
          total: 0,
          blindCount: 0,
          status: 'DNH'
        }
      }
    }).sort((a, b) => a.dateSort - b.dateSort)


    const topGuides = Object.entries(guideStats)
      .filter(([name]) => name)
      .map(([name, stats]) => {
        // Count how many hunts this guide participated in
        const guideHunts = allRecords.filter(r => r.guide === name).length || 1
        const totalDucks = stats.ducks || 0
        const totalGeese = stats.geese || 0
        const total = totalDucks + totalGeese
        const mallards = guideMallardStats[name] || 0
        const otherDucks = totalDucks - mallards
        return { 
          name, 
          ducks: totalDucks,
          geese: totalGeese,
          total,
          mallards,
          otherDucks,
          average: total / guideHunts,
          avgDucks: totalDucks / guideHunts,
          avgGeese: totalGeese / guideHunts,
          avgMallards: mallards / guideHunts,
          avgOtherDucks: otherDucks / guideHunts,
          hunts: guideHunts
        }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const topGuidesAvg = [...topGuides]
      .sort((a, b) => b.average - a.average)

    const totalHunts = sheets.length
    const totalDucks = Object.values(memberStats).reduce((sum, stats) => sum + (stats.ducks || 0), 0)
    const totalGeese = Object.values(memberStats).reduce((sum, stats) => sum + (stats.geese || 0), 0)
    const total = totalDucks + totalGeese
    
    // Calculate total member-hunt participations (how many times members hunted total)
    const totalMemberHunts = allRecords.length
    
    // Calculate average ducks and geese per member per hunt
    const avgDucksPerMember = totalMemberHunts > 0 ? totalDucks / totalMemberHunts : 0
    const avgGeesePerMember = totalMemberHunts > 0 ? totalGeese / totalMemberHunts : 0
    
    // Calculate total ducks and geese per hunt
    const totalDucksPerHunt = totalHunts > 0 ? totalDucks / totalHunts : 0
    const totalGeesePerHunt = totalHunts > 0 ? totalGeese / totalHunts : 0
    
    // Get unique conditions (filter out empty and Unknown)
    const uniqueConditions = [...new Set(allRecords.map(r => r.condition).filter(c => c && c.toString().trim() && c !== 'Unknown' && c.toLowerCase() !== 'unknown'))].sort()

      return {
        allRecords,
        uniqueConditions,
        topMembers,
        topMembersAvg,
        allMembers: allMembersArray,
        topBlinds,
        topBlindsAvg,
        topSpecies,
        speciesOrder,
        dateTrends,
        topGuides,
        topGuidesAvg,
        memberBlindStats,
        memberSpeciesStats,
        stats: {
          totalHunts,
          totalDucks,
          totalGeese,
          totalMallards: totalMallardsCount,
          avgDucksPerMember,
          avgGeesePerMember,
          totalDucksPerHunt,
          totalGeesePerHunt,
          uniqueBlinds: Object.keys(blindStats).length
        }
      }
    } catch (error) {
      console.error('Error processing analytics:', error)
      return null
    }
  }, [sheets])

  if (!analytics) {
    return <div className="analytics-empty">No data available for analytics</div>
  }

  // Filter records based on selected condition
  const filteredRecords = useMemo(() => {
    if (selectedCondition === 'all') {
      return analytics.allRecords || []
    }
    return (analytics.allRecords || []).filter(r => r.condition === selectedCondition)
  }, [analytics, selectedCondition])

  // Recalculate stats based on filtered records
  const filteredAnalytics = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) {
      return null
    }

    const memberStats = {}
    const blindStats = {}
    const blindMallardStats = {}
    const speciesStats = {}
    const dateStats = {}
    const guideStats = {}
    const guideMallardStats = {}
    const memberBlindStats = {}
    const memberSpeciesStats = {}

    let filteredTotalMallards = 0
    filteredRecords.forEach(record => {
      const { member, guide, blind, condition, totalDucks = 0, totalGeese = 0, speciesKills, date, totalMallards = 0 } = record
      filteredTotalMallards += totalMallards

      if (member) {
        if (!memberStats[member]) {
          memberStats[member] = { ducks: 0, geese: 0 }
        }
        memberStats[member].ducks += totalDucks
        memberStats[member].geese += totalGeese
        if (!memberSpeciesStats[member]) memberSpeciesStats[member] = {}
        Object.entries(speciesKills || {}).forEach(([species, count]) => {
          memberSpeciesStats[member][species] = (memberSpeciesStats[member][species] || 0) + count
        })
      }

      if (blind && blind !== 'Unknown') {
        const blindKey = String(blind)
        if (!blindStats[blindKey]) {
          blindStats[blindKey] = { ducks: 0, geese: 0 }
        }
        blindStats[blindKey].ducks += totalDucks
        blindStats[blindKey].geese += totalGeese
        blindMallardStats[blindKey] = (blindMallardStats[blindKey] || 0) + totalMallards
        if (member && blind) {
          const key = `${member}-${blindKey}`
          if (!memberBlindStats[key]) {
            memberBlindStats[key] = { ducks: 0, geese: 0 }
          }
          memberBlindStats[key].ducks += totalDucks
          memberBlindStats[key].geese += totalGeese
        }
      }

      if (guide) {
        if (!guideStats[guide]) {
          guideStats[guide] = { ducks: 0, geese: 0 }
        }
        guideStats[guide].ducks += totalDucks
        guideStats[guide].geese += totalGeese
        guideMallardStats[guide] = (guideMallardStats[guide] || 0) + totalMallards
      }

      Object.entries(speciesKills || {}).forEach(([species, count]) => {
        speciesStats[species] = (speciesStats[species] || 0) + count
      })

      if (!dateStats[date]) {
        dateStats[date] = { ducks: 0, geese: 0 }
      }
      dateStats[date].ducks += totalDucks
      dateStats[date].geese += totalGeese
    })

    const allMembersArrayFiltered = Object.entries(memberStats)
      .map(([name, stats]) => {
        const memberHunts = filteredRecords.filter(r => r.member === name).length || 1
        const totalDucks = stats.ducks || 0
        const totalGeese = stats.geese || 0
        const total = totalDucks + totalGeese
        return { 
          name, 
          ducks: totalDucks,
          geese: totalGeese,
          total,
          avgDucks: totalDucks / memberHunts,
          avgGeese: totalGeese / memberHunts,
          average: total / memberHunts, 
          hunts: memberHunts 
        }
      })
      .sort((a, b) => b.total - a.total)

    const topMembers = allMembersArrayFiltered.slice(0, 10)

    const topMembersAvg = [...topMembers]
      .sort((a, b) => b.average - a.average)
      .slice(0, 10)

    const topBlinds = Object.entries(blindStats)
      .filter(([name]) => name && name !== 'Unknown' && name !== '')
      .map(([name, stats]) => {
        const blindHunts = filteredRecords.filter(r => String(r.blind) === String(name)).length || 1
        const totalDucks = stats.ducks || 0
        const totalGeese = stats.geese || 0
        const total = totalDucks + totalGeese
        const mallards = blindMallardStats[name] || 0
        const otherDucks = totalDucks - mallards
        return { 
          name: String(name), 
          ducks: totalDucks,
          geese: totalGeese,
          total,
          mallards,
          otherDucks,
          average: total / blindHunts,
          avgDucks: totalDucks / blindHunts,
          avgGeese: totalGeese / blindHunts,
          avgMallards: mallards / blindHunts,
          avgOtherDucks: otherDucks / blindHunts,
          hunts: blindHunts 
        }
      })
      .sort((a, b) => b.total - a.total)

    const topBlindsAvg = [...topBlinds]
      .sort((a, b) => b.average - a.average)

    const topSpecies = Object.entries(speciesStats)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
    
    // Get species columns in original sheet order (from first sheet)
    let speciesOrderFiltered = []
    if (sheets.length > 0 && sheets[0].headers) {
      const firstSheetHeaders = sheets[0].headers
      speciesOrderFiltered = firstSheetHeaders
        .filter(h => {
          const lower = h.toLowerCase()
          return (lower.includes('mallard') || lower.includes('sprig') || lower.includes('widgeon') ||
                 lower.includes('teal') || lower.includes('wood') || lower.includes('other') ||
                 lower.includes('geese') || lower.includes('pheasant')) &&
                 !lower.includes('day total') && !lower.includes('hunter total')
        })
    }

    // Get all unique dates from all sheets (to show all dates, even if filtered)
    const filteredDates = new Set()
    sheets.forEach(sheet => {
      const date = sheet.name || 'Unknown'
      if (date !== 'Unknown') {
        filteredDates.add(date)
      }
    })
    
    // Parse dates for sorting
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
      return new Date(dateStr).getTime()
    }
    
    // Format date for display
    const formatDate = (dateStr) => {
      if (dateStr.includes('_')) {
        const parts = dateStr.split('_')
        if (parts.length === 3) {
          return `${parts[0]}/${parts[1]}/${parts[2]}`
        }
      }
      try {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          const month = date.getMonth() + 1
          const day = date.getDate()
          const year = date.getFullYear().toString().slice(-2)
          return `${month}/${day}/${year}`
        }
      } catch (e) {
        // Fallback
      }
      return dateStr
    }
    
    // Build dateTrends with all dates, including those with no data
    const dateTrends = Array.from(filteredDates).map(date => {
      const stats = dateStats[date]
      if (stats) {
        // Calculate mallards for this date
        const dateMallards = filteredRecords
          .filter(r => r.date === date)
          .reduce((sum, r) => sum + (r.totalMallards || 0), 0)
        
        // Calculate number of unique blinds for this date
        const dateRecords = filteredRecords.filter(r => r.date === date)
        const uniqueBlinds = new Set()
        dateRecords.forEach(r => {
          if (r.blind && r.blind !== 'Unknown' && r.blind.trim() !== '') {
            uniqueBlinds.add(String(r.blind).trim())
          }
        })
        const blindCount = uniqueBlinds.size
        
        return {
          date,
          dateFormatted: formatDate(date),
          dateSort: parseDate(date),
          ducks: stats.ducks || 0,
          geese: stats.geese || 0,
          mallards: dateMallards,
          total: (stats.ducks || 0) + (stats.geese || 0),
          blindCount: blindCount,
          status: 'hunted'
        }
      } else {
        // No data for this date - show "DNH"
        return {
          date,
          dateFormatted: formatDate(date),
          dateSort: parseDate(date),
          ducks: 0,
          geese: 0,
          mallards: 0,
          total: 0,
          blindCount: 0,
          status: 'DNH'
        }
      }
    }).sort((a, b) => a.dateSort - b.dateSort)

    const topGuides = Object.entries(guideStats)
      .filter(([name]) => name)
      .map(([name, stats]) => {
        const guideHunts = filteredRecords.filter(r => r.guide === name).length || 1
        const totalDucks = stats.ducks || 0
        const totalGeese = stats.geese || 0
        const total = totalDucks + totalGeese
        const mallards = guideMallardStats[name] || 0
        const otherDucks = totalDucks - mallards
        return { 
          name, 
          ducks: totalDucks,
          geese: totalGeese,
          total,
          mallards,
          otherDucks,
          average: total / guideHunts,
          avgDucks: totalDucks / guideHunts,
          avgGeese: totalGeese / guideHunts,
          avgMallards: mallards / guideHunts,
          avgOtherDucks: otherDucks / guideHunts,
          hunts: guideHunts 
        }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const topGuidesAvg = [...topGuides]
      .sort((a, b) => b.average - a.average)

    const totalHunts = new Set(filteredRecords.map(r => r.date)).size
    const totalDucks = Object.values(memberStats).reduce((sum, stats) => sum + (stats.ducks || 0), 0)
    const totalGeese = Object.values(memberStats).reduce((sum, stats) => sum + (stats.geese || 0), 0)
    const total = totalDucks + totalGeese
    
    // Calculate total member-hunt participations (how many times members hunted total)
    const totalMemberHunts = filteredRecords.length
    
    // Calculate average ducks and geese per member per hunt
    const avgDucksPerMember = totalMemberHunts > 0 ? totalDucks / totalMemberHunts : 0
    const avgGeesePerMember = totalMemberHunts > 0 ? totalGeese / totalMemberHunts : 0
    
    // Calculate total ducks and geese per hunt
    const totalDucksPerHunt = totalHunts > 0 ? totalDucks / totalHunts : 0
    const totalGeesePerHunt = totalHunts > 0 ? totalGeese / totalHunts : 0

    return {
      topMembers,
      topMembersAvg,
      allMembers: allMembersArrayFiltered,
      topBlinds,
      topBlindsAvg,
      topSpecies,
      speciesOrder: speciesOrderFiltered,
      dateTrends,
      topGuides,
      topGuidesAvg,
      stats: {
        totalHunts,
        totalDucks,
        totalGeese,
        totalMallards: filteredTotalMallards,
        avgDucksPerMember,
        avgGeesePerMember,
        totalDucksPerHunt,
        totalGeesePerHunt,
        uniqueBlinds: Object.keys(blindStats).length
      }
    }
  }, [filteredRecords, sheets, selectedCondition])

  // Use filtered analytics if available, otherwise use full analytics
  const displayAnalytics = filteredAnalytics || analytics

  // Safely destructure with defaults
  const stats = displayAnalytics.stats || {}
  const topMembers = displayAnalytics.topMembers || []
  const topMembersAvg = displayAnalytics.topMembersAvg || []
  // For the detailed table, show all members (not just top 10)
  const allMembers = displayAnalytics.allMembers || topMembers
  const topBlinds = displayAnalytics.topBlinds || []
  const topBlindsAvg = displayAnalytics.topBlindsAvg || []
  const topSpecies = displayAnalytics.topSpecies || []
  const speciesOrder = displayAnalytics.speciesOrder || []
  const dateTrends = displayAnalytics.dateTrends || []
  const topGuides = displayAnalytics.topGuides || []
  const topGuidesAvg = displayAnalytics.topGuidesAvg || []
  const uniqueConditions = analytics.uniqueConditions || []

  return (
    <div className="analytics-dashboard">

      {/* Condition Filter */}
      <div className="analytics-filters">
        <label htmlFor="condition-filter">Filter by Condition:</label>
        <select
          id="condition-filter"
          value={selectedCondition}
          onChange={(e) => setSelectedCondition(e.target.value)}
          className="weather-filter-select"
        >
          <option value="all">All Conditions</option>
          {uniqueConditions.length > 0 ? (
            uniqueConditions.map(condition => (
              <option key={condition} value={condition}>{condition}</option>
            ))
          ) : (
            <option disabled>No condition data available</option>
          )}
        </select>
        {selectedCondition !== 'all' && (
          <span className="filter-indicator">
            Showing data for: <strong>{selectedCondition}</strong>
          </span>
        )}
        <div className="stats-hunts-display">
          <div className="stats-hunts-label">Total Hunts</div>
          <div className="stats-hunts-value">{stats.totalHunts}</div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-container">
        <div className="stats-main">
          <div className="stats-section">
            <h4 className="stats-section-title">Totals</h4>
            <div className="stats-table">
              <div className="stat-row">
                <div className="stat-label">Total Ducks:</div>
                <div className="stat-value">{stats.totalDucks || 0}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Total Geese:</div>
                <div className="stat-value">{stats.totalGeese || 0}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Total Mallards:</div>
                <div className="stat-value">{stats.totalMallards || 0}</div>
              </div>
            </div>
          </div>
          <div className="stats-section">
            <h4 className="stats-section-title">Averages</h4>
            <div className="stats-table">
              <div className="stat-row">
                <div className="stat-label">Avg Ducks/Member:</div>
                <div className="stat-value">{Math.round(stats.avgDucksPerMember || 0)}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Avg Geese/Member:</div>
                <div className="stat-value">{Math.round(stats.avgGeesePerMember || 0)}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Avg Ducks/Hunt:</div>
                <div className="stat-value">{Math.round(stats.totalDucksPerHunt || 0)}</div>
              </div>
              <div className="stat-row">
                <div className="stat-label">Avg Geese/Hunt:</div>
                <div className="stat-value">{Math.round(stats.totalGeesePerHunt || 0)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trends Over Time - Full Width */}
      <div className="chart-card" style={{ width: '100%', marginBottom: '30px' }}>
        <h3>Birds Per Shoot Day</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dateTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="dateFormatted" 
              angle={-90} 
              textAnchor="end" 
              height={120}
              interval={0}
              tickFormatter={(value, index) => {
                const entry = dateTrends[index]
                if (entry && entry.status === 'DNH') {
                  return `${value}\n(DNH)`
                }
                return value
              }}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={() => ''}
              formatter={(value, name, props) => {
                if (props.payload.status === 'DNH') {
                  return ['DNH', 'Status']
                }
                return [value, name]
              }}
              content={({ active, payload }) => {
                if (active && payload && payload.length > 0) {
                  const data = payload[0].payload
                  if (data.status === 'DNH') {
                    return (
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '10px'
                      }}>
                        <p style={{ margin: '0', fontWeight: 'bold' }}>DNH</p>
                      </div>
                    )
                  }
                  return (
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '10px'
                    }}>
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
                        Blinds Hunted: {data.blindCount || 0}
                      </p>
                      {payload.map((entry, index) => (
                        <p key={index} style={{ margin: '2px 0', color: entry.color }}>
                          {entry.name}: {entry.value}
                        </p>
                      ))}
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Bar dataKey="ducks" stackId="a" fill="#000000" name="Ducks" />
            <Bar dataKey="geese" stackId="a" fill="#d4a574" name="Geese" />
            <Bar dataKey="mallards" stackId="a" fill="#2d5016" name="Mallards" />
          </BarChart>
        </ResponsiveContainer>
        {dateTrends.some(d => d.status === 'DNH') && (
          <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
            Dates marked "(DNH)" indicate no hunting activity on that day
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Top Members - Combined with Toggle */}
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Birds per Member</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setMembersView('total')}
                style={{
                  padding: '5px 15px',
                  backgroundColor: membersView === 'total' ? '#5a7c4a' : '#e8e0d0',
                  color: membersView === 'total' ? 'white' : '#2c2416',
                  border: '1px solid #b8a68a',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: membersView === 'total' ? 'bold' : 'normal'
                }}
              >
                Total
              </button>
              <button
                onClick={() => setMembersView('average')}
                style={{
                  padding: '5px 15px',
                  backgroundColor: membersView === 'average' ? '#5a7c4a' : '#e8e0d0',
                  color: membersView === 'average' ? 'white' : '#2c2416',
                  border: '1px solid #b8a68a',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: membersView === 'average' ? 'bold' : 'normal'
                }}
              >
                Average
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={membersView === 'total' ? topMembers : topMembersAvg}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={membersView === 'average' ? (value) => value.toFixed(1) : undefined} />
              <Legend />
              {membersView === 'total' ? (
                <>
                  <Bar dataKey="ducks" stackId="a" fill="#000000" name="Ducks" />
                  <Bar dataKey="geese" stackId="a" fill="#d4a574" name="Geese" />
                </>
              ) : (
                <>
                  <Bar dataKey="avgDucks" stackId="a" fill="#000000" name="Avg Ducks" />
                  <Bar dataKey="avgGeese" stackId="a" fill="#d4a574" name="Avg Geese" />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Species Breakdown */}
        <div className="chart-card">
          <h3>Species Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={topSpecies}
                dataKey="total"
                nameKey="name"
                cx="35%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => {
                  // Show label only for hovered item
                  if (hoveredSpecies === name) {
                    return value
                  }
                  return null
                }}
                labelLine={false}
              >
                {topSpecies.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    opacity={hoveredSpecies === null || hoveredSpecies === entry.name ? 1 : 0.3}
                    onMouseEnter={() => setHoveredSpecies(entry.name)}
                    onMouseLeave={() => setHoveredSpecies(null)}
                    style={{ 
                      transition: 'opacity 0.2s',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend 
                layout="vertical" 
                verticalAlign="middle" 
                align="right"
                wrapperStyle={{ paddingLeft: '20px' }}
                content={({ payload }) => (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {payload.map((entry, index) => {
                      const speciesData = topSpecies.find(s => s.name === entry.value)
                      const value = speciesData ? speciesData.total : 0
                      return (
                        <li
                          key={`legend-${index}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '8px',
                            cursor: 'pointer',
                            opacity: hoveredSpecies === null || hoveredSpecies === entry.value ? 1 : 0.3,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={() => {
                            setHoveredSpecies(entry.value)
                          }}
                          onMouseLeave={() => setHoveredSpecies(null)}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: '14px',
                              height: '14px',
                              backgroundColor: entry.color,
                              marginRight: '8px',
                              borderRadius: '2px'
                            }}
                          />
                          <span>{entry.value}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Blinds - Combined with Toggle */}
        <div className="chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Birds per Blind</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setBlindsView('total')}
                style={{
                  padding: '5px 15px',
                  backgroundColor: blindsView === 'total' ? '#5a7c4a' : '#e8e0d0',
                  color: blindsView === 'total' ? 'white' : '#2c2416',
                  border: '1px solid #b8a68a',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: blindsView === 'total' ? 'bold' : 'normal'
                }}
              >
                Total
              </button>
              <button
                onClick={() => setBlindsView('average')}
                style={{
                  padding: '5px 15px',
                  backgroundColor: blindsView === 'average' ? '#5a7c4a' : '#e8e0d0',
                  color: blindsView === 'average' ? 'white' : '#2c2416',
                  border: '1px solid #b8a68a',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: blindsView === 'average' ? 'bold' : 'normal'
                }}
              >
                Average
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={blindsView === 'total' ? topBlinds : topBlindsAvg}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                labelFormatter={() => ''}
                formatter={blindsView === 'average' ? (value) => value.toFixed(1) : (value, name) => [value, name]}
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload
                    return (
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '10px'
                      }}>
                        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
                          Times Hunted: {data.hunts || 0}
                        </p>
                        {payload.map((entry, index) => (
                          <p key={index} style={{ margin: '2px 0', color: entry.color }}>
                            {entry.name}: {blindsView === 'average' ? parseFloat(entry.value).toFixed(1) : entry.value}
                          </p>
                        ))}
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              {blindsView === 'total' ? (
                <>
                  <Bar dataKey="mallards" stackId="a" fill="#2d5016" name="Mallards" />
                  <Bar dataKey="otherDucks" stackId="a" fill="#000000" name="Other Ducks" />
                  <Bar dataKey="geese" stackId="a" fill="#d4a574" name="Geese" />
                </>
              ) : (
                <>
                  <Bar dataKey="avgMallards" stackId="a" fill="#2d5016" name="Avg Mallards" />
                  <Bar dataKey="avgOtherDucks" stackId="a" fill="#000000" name="Avg Other Ducks" />
                  <Bar dataKey="avgGeese" stackId="a" fill="#d4a574" name="Avg Geese" />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Guides - Combined with Toggle */}
        {(topGuides.length > 0 || topGuidesAvg.length > 0) && (
          <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Birds per Guide</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setGuidesView('total')}
                  style={{
                    padding: '5px 15px',
                    backgroundColor: guidesView === 'total' ? '#5a7c4a' : '#e8e0d0',
                    color: guidesView === 'total' ? 'white' : '#2c2416',
                    border: '1px solid #b8a68a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: guidesView === 'total' ? 'bold' : 'normal'
                  }}
                >
                  Total
                </button>
                <button
                  onClick={() => setGuidesView('average')}
                  style={{
                    padding: '5px 15px',
                    backgroundColor: guidesView === 'average' ? '#5a7c4a' : '#e8e0d0',
                    color: guidesView === 'average' ? 'white' : '#2c2416',
                    border: '1px solid #b8a68a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: guidesView === 'average' ? 'bold' : 'normal'
                  }}
                >
                  Average
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={guidesView === 'total' ? topGuides : topGuidesAvg}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  labelFormatter={() => ''}
                  formatter={guidesView === 'average' ? (value) => value.toFixed(1) : (value, name) => [value, name]}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload
                      return (
                        <div style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          padding: '10px'
                        }}>
                          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
                            Times Hunted: {data.hunts || 0}
                          </p>
                          {payload.map((entry, index) => (
                            <p key={index} style={{ margin: '2px 0', color: entry.color }}>
                              {entry.name}: {guidesView === 'average' ? parseFloat(entry.value).toFixed(1) : entry.value}
                            </p>
                          ))}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                {guidesView === 'total' ? (
                  <>
                    <Bar dataKey="mallards" stackId="a" fill="#2d5016" name="Mallards" />
                    <Bar dataKey="otherDucks" stackId="a" fill="#000000" name="Other Ducks" />
                    <Bar dataKey="geese" stackId="a" fill="#d4a574" name="Geese" />
                  </>
                ) : (
                  <>
                    <Bar dataKey="avgMallards" stackId="a" fill="#2d5016" name="Avg Mallards" />
                    <Bar dataKey="avgOtherDucks" stackId="a" fill="#000000" name="Avg Other Ducks" />
                    <Bar dataKey="avgGeese" stackId="a" fill="#d4a574" name="Avg Geese" />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Member Performance Table */}
      <div className="table-card">
        <h3>Season Totals</h3>
        <div className="performance-table">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Hunt Days</th>
                {speciesOrder.map(species => (
                  <th key={species}>{species}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {allMembers.map(member => {
                const speciesData = analytics.memberSpeciesStats[member.name] || {}
                return (
                  <tr key={member.name}>
                    <td><strong>{member.name}</strong></td>
                    <td>{member.hunts || 0}</td>
                    {speciesOrder.map(species => (
                      <td key={species}>{speciesData[species] || 0}</td>
                    ))}
                    <td><strong>{member.total}</strong></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard

