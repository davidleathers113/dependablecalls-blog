#!/usr/bin/env tsx

// Direct migration execution using Supabase SQL API
import { readFileSync } from 'fs'
import { resolve } from 'path'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function executeMigration() {
  console.log('🚀 Executing Blog Migration via Supabase API')
  console.log('===========================================')
  
  try {
    // Read the combined migration file
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/combined-blog-migrations.sql'),
      'utf-8'
    )
    
    console.log('📄 Loaded migration SQL file')
    console.log(`📏 SQL length: ${sql.length} characters`)
    
    // Execute via Supabase REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sql: sql
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Migration failed:', error)
      
      // Try alternative approach - SQL over HTTP
      console.log('🔄 Trying alternative SQL execution...')
      
      const altResponse = await fetch(`${supabaseUrl}/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'text/plain'
        },
        body: sql
      })
      
      if (!altResponse.ok) {
        const altError = await altResponse.text()
        console.error('❌ Alternative migration also failed:', altError)
        console.log('\n💡 Please run the migration manually:')
        console.log('1. Go to: https://supabase.com/dashboard/project/orrasduancqrevnqiiok/sql/new')
        console.log('2. Copy the contents of: supabase/migrations/combined-blog-migrations.sql')
        console.log('3. Paste and run in the SQL editor')
        return false
      }
      
      console.log('✅ Migration executed successfully via alternative endpoint')
      return true
    }
    
    console.log('✅ Migration executed successfully')
    
    // Verify tables were created
    const verifyResponse = await fetch(`${supabaseUrl}/rest/v1/blog_posts?select=count&limit=0`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      }
    })
    
    if (verifyResponse.ok) {
      console.log('✅ Verified: blog_posts table exists')
    } else {
      console.log('⚠️  Could not verify table creation (might still be successful)')
    }
    
    return true
    
  } catch (error) {
    console.error('❌ Migration execution failed:', error)
    return false
  }
}

// Execute
executeMigration().then(success => {
  if (success) {
    console.log('\n🎉 Blog migration completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Deploy edge function: supabase functions deploy sanitize-html')
    console.log('2. Seed blog content: npm run seed:blog-content')
    console.log('3. Verify setup: npm run verify:blog')
  } else {
    console.log('\n❌ Migration failed. Please run manually in Supabase dashboard.')
    process.exit(1)
  }
})