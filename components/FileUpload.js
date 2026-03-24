import { useState, useRef } from 'react'

export default function FileUpload({ onUploadComplete }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef(null)

  async function uploadFiles(files) {
    setUploading(true)
    setProgress(0)

    const total = files.length
    let done = 0
    const results = []

    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (res.ok) results.push(data)
      } catch (err) {
        console.error('Upload failed:', err)
      }

      done++
      setProgress(Math.round((done / total) * 100))
    }

    setUploading(false)
    setProgress(0)
    onUploadComplete?.(results)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }

  function handleChange(e) {
    const files = Array.from(e.target.files)
    if (files.length) uploadFiles(files)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
        dragging
          ? 'border-terracotta bg-terracotta/5'
          : 'border-gray-200 hover:border-terracotta/40 hover:bg-cream'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.csv,.txt"
        onChange={handleChange}
        className="hidden"
      />

      {uploading ? (
        <div className="space-y-3">
          <div className="animate-spin w-8 h-8 border-3 border-terracotta border-t-transparent rounded-full mx-auto" />
          <div className="text-sm text-forest font-medium">Uploading... {progress}%</div>
          <div className="w-48 h-1.5 bg-gray-100 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full bg-terracotta rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-3xl">📄</div>
          <div className="text-sm font-medium text-forest">
            Drop files here or click to upload
          </div>
          <div className="text-xs text-gray-400">
            PDF, DOCX, CSV, TXT — up to 10MB each
          </div>
        </div>
      )}
    </div>
  )
}
