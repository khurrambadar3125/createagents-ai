import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 })

  try {
    const [fields, files] = await form.parse(req)
    const file = files.file?.[0]

    if (!file) return res.status(400).json({ error: 'No file provided' })

    const fileName = file.originalFilename || 'unnamed'
    const ext = path.extname(fileName).toLowerCase()
    const mimeType = file.mimetype || 'application/octet-stream'
    const fileBuffer = fs.readFileSync(file.filepath)

    // Upload to Supabase Storage
    const storagePath = `uploads/${Date.now()}-${fileName}`
    const { error: uploadError } = await supabase.storage
      .from('agent-files')
      .upload(storagePath, fileBuffer, { contentType: mimeType })

    if (uploadError) {
      return res.status(500).json({ error: `Upload failed: ${uploadError.message}` })
    }

    // Extract text based on file type
    let extractedText = ''
    try {
      if (ext === '.txt' || ext === '.csv') {
        extractedText = fileBuffer.toString('utf-8')
      } else if (ext === '.pdf') {
        const pdfParse = (await import('pdf-parse')).default
        const pdfData = await pdfParse(fileBuffer)
        extractedText = pdfData.text
      } else if (ext === '.docx') {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer: fileBuffer })
        extractedText = result.value
      }
    } catch (parseErr) {
      console.error('Text extraction error:', parseErr)
      // Continue even if extraction fails
    }

    // Save file record
    // Note: owner_id would come from auth in production
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        name: fileName,
        size: file.size,
        mime_type: mimeType,
        storage_path: storagePath,
        processed: !!extractedText,
        extracted_text: extractedText || null,
      })
      .select()
      .single()

    if (dbError) {
      return res.status(500).json({ error: dbError.message })
    }

    return res.status(200).json(fileRecord)
  } catch (err) {
    console.error('Upload error:', err)
    return res.status(500).json({ error: err.message || 'Upload failed' })
  }
}
