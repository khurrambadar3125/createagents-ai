/**
 * CreateAgent Memory Tool — Supabase-backed handler for Anthropic's memory_20250818 tool.
 *
 * Implements all 6 commands: view, create, str_replace, insert, delete, rename.
 * Each memory file is scoped to (agent_id, visitor_id) and stored in agent_memory_files.
 * Path-traversal protection: rejects anything not starting with /memories or containing "..".
 */

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

// --- Path validation ---

function validatePath(filePath) {
  if (!filePath) return { valid: false, error: 'file_path is required' }
  if (filePath.includes('..')) return { valid: false, error: 'Path traversal not allowed' }
  if (!filePath.startsWith('/memories')) return { valid: false, error: 'Path must start with /memories' }
  if (filePath.length > 500) return { valid: false, error: 'Path too long (max 500 chars)' }
  return { valid: true }
}

// --- Audit logging ---

async function logAccess(agentId, visitorId, operation, filePath, detail = null) {
  await supabase.from('agent_memory_access_log').insert({
    agent_id: agentId,
    visitor_id: visitorId,
    operation,
    file_path: filePath,
    detail,
  }).catch(() => {}) // non-blocking
}

// --- The 6 memory commands ---

/**
 * VIEW — list directory or read file content
 */
async function handleView(agentId, visitorId, filePath) {
  const check = validatePath(filePath)
  if (!check.valid) return { error: check.error }

  // Check if this is a directory listing (path ends with / or is exactly /memories)
  const isDir = filePath === '/memories' || filePath.endsWith('/')
  const normalizedDir = filePath.replace(/\/$/, '')

  if (isDir) {
    // List all files under this directory for this agent+visitor
    const { data, error } = await supabase
      .from('agent_memory_files')
      .select('file_path, updated_at')
      .eq('agent_id', agentId)
      .eq('visitor_id', visitorId)
      .like('file_path', `${normalizedDir}%`)
      .order('file_path')

    if (error) return { error: error.message }

    await logAccess(agentId, visitorId, 'view', filePath, { type: 'directory', count: data?.length || 0 })

    if (!data || data.length === 0) {
      return { content: `Directory ${filePath} is empty. No memory files exist yet.` }
    }

    const listing = data.map(f => f.file_path).join('\n')
    return { content: `Files in ${filePath}:\n${listing}` }
  }

  // Read specific file
  const { data, error } = await supabase
    .from('agent_memory_files')
    .select('content, updated_at')
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', filePath)
    .single()

  if (error || !data) {
    return { error: `File not found: ${filePath}` }
  }

  await logAccess(agentId, visitorId, 'view', filePath, { type: 'file' })
  return { content: data.content }
}

/**
 * CREATE — create a new file with content
 */
async function handleCreate(agentId, visitorId, filePath, content) {
  const check = validatePath(filePath)
  if (!check.valid) return { error: check.error }
  if (content === undefined || content === null) return { error: 'content is required' }

  // Check if file already exists
  const { data: existing } = await supabase
    .from('agent_memory_files')
    .select('id')
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', filePath)
    .single()

  if (existing) {
    return { error: `File already exists: ${filePath}. Use str_replace to modify it.` }
  }

  // Enforce memory budget: max 50 files per agent+visitor, max 10KB per file
  const { count } = await supabase
    .from('agent_memory_files')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)

  if (count >= 50) {
    return { error: 'Memory limit reached (50 files). Delete old files before creating new ones.' }
  }

  if (content.length > 10000) {
    return { error: 'File content too large (max 10,000 characters).' }
  }

  const { error } = await supabase
    .from('agent_memory_files')
    .insert({ agent_id: agentId, visitor_id: visitorId, file_path: filePath, content })

  if (error) return { error: error.message }

  await logAccess(agentId, visitorId, 'create', filePath, { size: content.length })
  return { content: `Created ${filePath} (${content.length} chars)` }
}

/**
 * STR_REPLACE — replace a specific string in a file
 */
async function handleStrReplace(agentId, visitorId, filePath, oldStr, newStr) {
  const check = validatePath(filePath)
  if (!check.valid) return { error: check.error }
  if (!oldStr) return { error: 'old_str is required' }
  if (newStr === undefined) return { error: 'new_str is required' }

  const { data, error: readError } = await supabase
    .from('agent_memory_files')
    .select('content')
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', filePath)
    .single()

  if (readError || !data) return { error: `File not found: ${filePath}` }

  if (!data.content.includes(oldStr)) {
    return { error: `old_str not found in ${filePath}. Make sure it matches exactly.` }
  }

  const occurrences = data.content.split(oldStr).length - 1
  if (occurrences > 1) {
    return { error: `old_str appears ${occurrences} times in ${filePath}. It must be unique. Add more context to make it unique.` }
  }

  const updatedContent = data.content.replace(oldStr, newStr)

  if (updatedContent.length > 10000) {
    return { error: 'Updated content would exceed 10,000 character limit.' }
  }

  const { error } = await supabase
    .from('agent_memory_files')
    .update({ content: updatedContent })
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', filePath)

  if (error) return { error: error.message }

  await logAccess(agentId, visitorId, 'str_replace', filePath, { old_len: oldStr.length, new_len: newStr.length })
  return { content: `Updated ${filePath}` }
}

/**
 * INSERT — insert text at a specific line number
 */
async function handleInsert(agentId, visitorId, filePath, insertLine, newStr) {
  const check = validatePath(filePath)
  if (!check.valid) return { error: check.error }
  if (insertLine === undefined) return { error: 'insert_line is required' }
  if (!newStr) return { error: 'new_str is required' }

  const { data, error: readError } = await supabase
    .from('agent_memory_files')
    .select('content')
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', filePath)
    .single()

  if (readError || !data) return { error: `File not found: ${filePath}` }

  const lines = data.content.split('\n')
  const lineNum = Math.max(0, Math.min(insertLine, lines.length))
  lines.splice(lineNum, 0, newStr)
  const updatedContent = lines.join('\n')

  if (updatedContent.length > 10000) {
    return { error: 'Updated content would exceed 10,000 character limit.' }
  }

  const { error } = await supabase
    .from('agent_memory_files')
    .update({ content: updatedContent })
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', filePath)

  if (error) return { error: error.message }

  await logAccess(agentId, visitorId, 'insert', filePath, { line: insertLine })
  return { content: `Inserted at line ${insertLine} in ${filePath}` }
}

/**
 * DELETE — delete a file
 */
async function handleDelete(agentId, visitorId, filePath) {
  const check = validatePath(filePath)
  if (!check.valid) return { error: check.error }

  const { data, error: readError } = await supabase
    .from('agent_memory_files')
    .select('id')
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', filePath)
    .single()

  if (readError || !data) return { error: `File not found: ${filePath}` }

  const { error } = await supabase
    .from('agent_memory_files')
    .delete()
    .eq('id', data.id)

  if (error) return { error: error.message }

  await logAccess(agentId, visitorId, 'delete', filePath)
  return { content: `Deleted ${filePath}` }
}

/**
 * RENAME — rename/move a file
 */
async function handleRename(agentId, visitorId, oldPath, newPath) {
  const checkOld = validatePath(oldPath)
  if (!checkOld.valid) return { error: checkOld.error }
  const checkNew = validatePath(newPath)
  if (!checkNew.valid) return { error: checkNew.error }

  const { data: existing } = await supabase
    .from('agent_memory_files')
    .select('id')
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', newPath)
    .single()

  if (existing) return { error: `Target path already exists: ${newPath}` }

  const { error } = await supabase
    .from('agent_memory_files')
    .update({ file_path: newPath })
    .eq('agent_id', agentId)
    .eq('visitor_id', visitorId)
    .eq('file_path', oldPath)

  if (error) return { error: error.message }

  await logAccess(agentId, visitorId, 'rename', oldPath, { new_path: newPath })
  return { content: `Renamed ${oldPath} → ${newPath}` }
}

// --- Main dispatcher ---

/**
 * Handle a memory tool_use block from Claude's response.
 * Returns the tool_result content to feed back to Claude.
 */
export async function handleMemoryToolUse(agentId, visitorId, toolInput) {
  const { command, file_path, content, old_str, new_str, insert_line, new_file_path } = toolInput

  switch (command) {
    case 'view':
      return handleView(agentId, visitorId, file_path)
    case 'create':
      return handleCreate(agentId, visitorId, file_path, content)
    case 'str_replace':
      return handleStrReplace(agentId, visitorId, file_path, old_str, new_str)
    case 'insert':
      return handleInsert(agentId, visitorId, file_path, insert_line, new_str)
    case 'delete':
      return handleDelete(agentId, visitorId, file_path)
    case 'rename':
      return handleRename(agentId, visitorId, file_path, new_file_path)
    default:
      return { error: `Unknown memory command: ${command}` }
  }
}

/**
 * The memory protocol system prompt snippet.
 * Append this to every agent's system prompt to enable memory behavior.
 */
export const MEMORY_SYSTEM_PROMPT = `

MEMORY SYSTEM:
You have access to a persistent memory directory at /memories. This memory persists across all conversations with this user. Use it to remember important facts, preferences, and context.

IMPORTANT: At the start of every conversation, ALWAYS check your memory directory first by viewing /memories to see what you already know about this user. This ensures continuity across sessions.

Guidelines for memory:
- Store user preferences, important facts, and context that will be useful in future conversations
- Keep memory files organized and concise
- Update existing files rather than creating duplicates
- Use descriptive file names like /memories/user_preferences.md or /memories/project_context.md
- Delete outdated information to keep memory clean
- Never store sensitive data like passwords, API keys, or financial details`
