#!/usr/bin/env tsx

// Blog Setup Verification Script
// Checks if the blog system is properly configured and ready to use

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load environment variables
config()

interface VerificationResult {
  step: string
  status: 'pass' | 'fail' | 'warning'
  message: string
}

const results: VerificationResult[] = []

function addResult(step: string, status: VerificationResult['status'], message: string) {
  results.push({ step, status, message })
  const emoji = status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌'
  console.log(`${emoji} ${step}: ${message}`)
}

async function verifyEnvironment() {
  console.log('🔍 Verifying environment variables...\n')
  
  if (!process.env.VITE_SUPABASE_URL) {
    addResult('Environment', 'fail', 'VITE_SUPABASE_URL is not set')
    return false
  }
  
  if (!process.env.VITE_SUPABASE_ANON_KEY) {
    addResult('Environment', 'fail', 'VITE_SUPABASE_ANON_KEY is not set')
    return false
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    addResult('Environment', 'warning', 'SUPABASE_SERVICE_ROLE_KEY is not set (required for seeding)')
  }
  
  addResult('Environment', 'pass', 'Required environment variables are set')
  return true
}

async function verifyDatabaseConnection() {
  console.log('\n🔗 Verifying database connection...\n')
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
    )
    
    // Test connection by checking if tables exist
    const { error } = await supabase.from('blog_posts').select('id').limit(1)
    
    if (error && error.code === '42P01') {
      addResult('Database', 'fail', 'Blog tables not found - migrations may not have run')
      return false
    }
    
    if (error) {
      addResult('Database', 'fail', `Database connection error: ${error.message}`)
      return false
    }
    
    addResult('Database', 'pass', 'Successfully connected to database')
    return true
  } catch (error) {
    addResult('Database', 'fail', `Connection failed: ${error}`)
    return false
  }
}

async function verifyTables() {
  console.log('\n📋 Verifying database tables...\n')
  
  const requiredTables = [
    'blog_posts',
    'blog_categories',
    'blog_authors',
    'blog_post_categories',
    'blog_comments',
    'blog_media',
    'blog_analytics_events',
    'blog_analytics_sessions',
    'monitoring_events'
  ]
  
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
  )
  
  let allTablesExist = true
  
  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select('*').limit(0)
    
    if (error && error.code === '42P01') {
      addResult('Tables', 'fail', `Table '${table}' does not exist`)
      allTablesExist = false
    } else if (error) {
      addResult('Tables', 'warning', `Cannot verify table '${table}': ${error.message}`)
    } else {
      addResult('Tables', 'pass', `Table '${table}' exists`)
    }
  }
  
  return allTablesExist
}

async function verifyStorageBucket() {
  console.log('\n🪣 Verifying storage bucket...\n')
  
  try {
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/storage/v1/bucket/blog-images`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!}`
        }
      }
    )
    
    if (response.status === 404) {
      addResult('Storage', 'fail', 'blog-images bucket does not exist')
      return false
    }
    
    if (!response.ok) {
      addResult('Storage', 'warning', `Cannot verify storage bucket: ${response.statusText}`)
      return false
    }
    
    const bucket = await response.json()
    if (bucket.public) {
      addResult('Storage', 'pass', 'blog-images bucket exists and is public')
    } else {
      addResult('Storage', 'warning', 'blog-images bucket exists but is not public')
    }
    
    return true
  } catch (error) {
    addResult('Storage', 'fail', `Storage verification failed: ${error}`)
    return false
  }
}

async function verifyEdgeFunction() {
  console.log('\n🚀 Verifying edge functions...\n')
  
  try {
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/sanitize-html`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY!}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: '<p>Test</p>',
          mode: 'strict'
        })
      }
    )
    
    if (response.status === 404) {
      addResult('Edge Functions', 'fail', 'sanitize-html function not deployed')
      return false
    }
    
    if (!response.ok) {
      addResult('Edge Functions', 'warning', `Edge function returned ${response.status}`)
      return false
    }
    
    addResult('Edge Functions', 'pass', 'sanitize-html function is deployed and working')
    return true
  } catch (error) {
    addResult('Edge Functions', 'fail', `Edge function verification failed: ${error}`)
    return false
  }
}

async function checkBlogData() {
  console.log('\n📚 Checking blog data...\n')
  
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
  )
  
  // Check posts
  const { data: posts, error: postsError } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('status', 'published')
  
  if (postsError) {
    addResult('Blog Data', 'fail', `Cannot query blog posts: ${postsError.message}`)
  } else if (!posts || posts.length === 0) {
    addResult('Blog Data', 'warning', 'No published blog posts found - run npm run seed:blog-content')
  } else {
    addResult('Blog Data', 'pass', `Found ${posts.length} published blog posts`)
  }
  
  // Check categories
  const { data: categories, error: categoriesError } = await supabase
    .from('blog_categories')
    .select('id')
  
  if (categoriesError) {
    addResult('Blog Data', 'fail', `Cannot query categories: ${categoriesError.message}`)
  } else if (!categories || categories.length === 0) {
    addResult('Blog Data', 'warning', 'No categories found')
  } else {
    addResult('Blog Data', 'pass', `Found ${categories.length} categories`)
  }
  
  // Check authors
  const { data: authors, error: authorsError } = await supabase
    .from('blog_authors')
    .select('id')
  
  if (authorsError) {
    addResult('Blog Data', 'fail', `Cannot query authors: ${authorsError.message}`)
  } else if (!authors || authors.length === 0) {
    addResult('Blog Data', 'warning', 'No authors found - run npm run setup:blog-authors')
  } else {
    addResult('Blog Data', 'pass', `Found ${authors.length} authors`)
  }
}

async function main() {
  console.log('🏥 DCE Blog Setup Verification\n')
  console.log('=' .repeat(50))
  
  // Run verifications
  const envOk = await verifyEnvironment()
  if (!envOk) {
    console.log('\n❌ Environment setup incomplete. Please check your .env file.')
    process.exit(1)
  }
  
  const dbOk = await verifyDatabaseConnection()
  if (!dbOk) {
    console.log('\n❌ Database connection failed. Please check your Supabase credentials.')
    process.exit(1)
  }
  
  await verifyTables()
  await verifyStorageBucket()
  await verifyEdgeFunction()
  await checkBlogData()
  
  // Summary
  console.log('\n' + '=' .repeat(50))
  console.log('📊 Verification Summary\n')
  
  const passed = results.filter(r => r.status === 'pass').length
  const warnings = results.filter(r => r.status === 'warning').length
  const failed = results.filter(r => r.status === 'fail').length
  
  console.log(`✅ Passed: ${passed}`)
  console.log(`⚠️  Warnings: ${warnings}`)
  console.log(`❌ Failed: ${failed}`)
  
  if (failed > 0) {
    console.log('\n❌ Setup verification failed. Please fix the errors above.')
    process.exit(1)
  } else if (warnings > 0) {
    console.log('\n⚠️  Setup complete with warnings. The blog should work but some features may be limited.')
  } else {
    console.log('\n✅ All checks passed! Your blog is ready to use.')
    console.log('\nNext steps:')
    console.log('1. Run `npm run dev` to start the development server')
    console.log('2. Visit http://localhost:5173/blog')
  }
}

main().catch(console.error)