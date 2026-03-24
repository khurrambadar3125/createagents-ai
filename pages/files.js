import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import FileUpload from '@/components/FileUpload'
import withAuth from '@/lib/withAuth'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

function FilesPage({ user, profile }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadFiles() {
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }

  useEffect(() => { loadFiles() }, [user.id])

  function formatSize(bytes) {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  function mimeIcon(mime) {
    if (mime?.includes('pdf')) return '📕'
    if (mime?.includes('word') || mime?.includes('docx')) return '📄'
    if (mime?.includes('csv') || mime?.includes('spreadsheet')) return '📊'
    return '📝'
  }

  async function handleDelete(fileId, storagePath) {
    if (!confirm('Delete this file?')) return
    await supabase.storage.from('agent-files').remove([storagePath])
    await supabase.from('files').delete().eq('id', fileId)
    setFiles(files.filter((f) => f.id !== fileId))
  }

  return (
    <Layout user={user} profile={profile}>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest">Files</h1>
          <p className="text-gray-400 text-sm mt-1">Upload documents for your agents to use as context</p>
        </div>

        <FileUpload onUploadComplete={() => loadFiles()} />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-50 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-3">📂</div>
            <h3 className="font-serif text-lg font-bold text-forest mb-2">No files yet</h3>
            <p className="text-sm text-gray-400">Upload PDF, DOCX, CSV, or TXT files to give your agents context.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">File</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Size</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider hidden md:table-cell">Status</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Uploaded</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{mimeIcon(file.mime_type)}</span>
                        <span className="font-medium text-forest">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{formatSize(file.size)}</td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${file.processed ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                        {file.processed ? 'Processed' : 'Processing'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{formatDate(file.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(file.id, file.storage_path)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default withAuth(FilesPage)
