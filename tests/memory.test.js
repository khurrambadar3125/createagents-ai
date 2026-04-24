/**
 * Memory Tool Integration Test
 *
 * Tests that the memory layer works end-to-end:
 * 1. Agent stores a fact via memory tool
 * 2. New session — agent recalls the fact from memory
 *
 * Requires: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: node tests/memory.test.js
 * (or: ANTHROPIC_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tests/memory.test.js)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  console.log('=== Memory Tool Integration Test ===\n')

  // 1. Find or create a test agent
  let agentId
  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('name', '__memory_test_agent__')
    .single()

  if (existing) {
    agentId = existing.id
    console.log(`Using existing test agent: ${agentId}`)
  } else {
    const { data: created, error } = await supabase
      .from('agents')
      .insert({
        name: '__memory_test_agent__',
        description: 'Automated test agent for memory layer',
        config: { system_prompt: 'You are a helpful test assistant. Always use your memory tool to store and recall information.' },
        status: 'active',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create test agent:', error.message)
      process.exit(1)
    }
    agentId = created.id
    console.log(`Created test agent: ${agentId}`)
  }

  // 2. Clean up any existing memory for this agent
  await supabase
    .from('agent_memory_files')
    .delete()
    .eq('agent_id', agentId)
    .eq('visitor_id', 'test-visitor-001')

  console.log('Cleaned up old memory files\n')

  // 3. Session 1: Tell the agent a fact and ask it to remember
  console.log('--- Session 1: Store a fact ---')
  const storeResponse = await fetch(`${API_BASE}/api/agents/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      user_input: 'My favorite color is cerulean blue. Please remember this in your memory for future conversations.',
      visitor_id: 'test-visitor-001',
    }),
  })

  if (!storeResponse.ok) {
    const err = await storeResponse.json()
    console.error('Session 1 failed:', err)
    process.exit(1)
  }

  const storeResult = await storeResponse.json()
  console.log(`Response: ${storeResult.output?.slice(0, 200)}...`)
  console.log(`Tokens: ${storeResult.tokens_used}, Memory enabled: ${storeResult.memory_enabled}`)

  // 4. Verify the memory was actually written to Supabase
  const { data: memFiles } = await supabase
    .from('agent_memory_files')
    .select('file_path, content')
    .eq('agent_id', agentId)
    .eq('visitor_id', 'test-visitor-001')

  console.log(`\nMemory files after Session 1: ${memFiles?.length || 0}`)
  if (memFiles?.length > 0) {
    for (const f of memFiles) {
      console.log(`  ${f.file_path}: ${f.content.slice(0, 100)}...`)
    }
  }

  // 5. Check access log
  const { data: logs } = await supabase
    .from('agent_memory_access_log')
    .select('operation, file_path')
    .eq('agent_id', agentId)
    .eq('visitor_id', 'test-visitor-001')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log(`Access log entries: ${logs?.length || 0}`)
  if (logs?.length > 0) {
    for (const l of logs) {
      console.log(`  ${l.operation}: ${l.file_path}`)
    }
  }

  // 6. Session 2: New conversation — ask the agent to recall
  console.log('\n--- Session 2: Recall the fact ---')
  const recallResponse = await fetch(`${API_BASE}/api/agents/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      user_input: 'What is my favorite color? Check your memory.',
      visitor_id: 'test-visitor-001',
    }),
  })

  if (!recallResponse.ok) {
    const err = await recallResponse.json()
    console.error('Session 2 failed:', err)
    process.exit(1)
  }

  const recallResult = await recallResponse.json()
  console.log(`Response: ${recallResult.output?.slice(0, 300)}`)
  console.log(`Tokens: ${recallResult.tokens_used}`)

  // 7. Verify recall
  const recallLower = (recallResult.output || '').toLowerCase()
  const hasCerulean = recallLower.includes('cerulean')
  const hasBlue = recallLower.includes('blue')

  console.log(`\n=== TEST RESULTS ===`)
  console.log(`Memory files created: ${memFiles?.length > 0 ? 'PASS' : 'FAIL'}`)
  console.log(`Recall includes "cerulean": ${hasCerulean ? 'PASS' : 'FAIL'}`)
  console.log(`Recall includes "blue": ${hasBlue ? 'PASS' : 'FAIL'}`)
  console.log(`Memory enabled flag: ${storeResult.memory_enabled ? 'PASS' : 'FAIL'}`)

  const allPassed = memFiles?.length > 0 && (hasCerulean || hasBlue) && storeResult.memory_enabled

  if (allPassed) {
    console.log(`\n✓ ALL TESTS PASSED — Memory persists across sessions`)
  } else {
    console.log(`\n✗ SOME TESTS FAILED`)
    process.exit(1)
  }

  // 8. Cleanup
  await supabase.from('agent_memory_files').delete().eq('agent_id', agentId).eq('visitor_id', 'test-visitor-001')
  await supabase.from('agent_memory_access_log').delete().eq('agent_id', agentId).eq('visitor_id', 'test-visitor-001')
  console.log('\nCleaned up test data')
}

run().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})
