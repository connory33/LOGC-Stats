import { useRef } from 'react'
import './FileUpload.css'

function FileUpload({ onFileUpload }) {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type === 'text/csv') {
      onFileUpload(file)
    } else {
      alert('Please select a CSV file')
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="file-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button onClick={handleClick} className="upload-button">
        📁 Upload CSV File
      </button>
      <span className="upload-hint">or use output/ocr_results.csv if available</span>
    </div>
  )
}

export default FileUpload

