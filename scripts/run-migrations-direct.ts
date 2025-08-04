#!/usr/bin/env tsx

// Direct migration runner using Supabase API
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Define migrations in order
const migrations = [
  '018_blog_cms_tables.sql',
  '019_blog_content_sanitization.sql',
  '019_blog_infrastructure_fixes.sql',
  '020_blog_storage_quota_fixes.sql',
  '021_blog_rls_consolidation.sql',
  '022_blog_word_count_tsvector.sql',
  '023_blog_analytics_tables.sql',
  '024_blog_extensions_fix.sql',
  '024_blog_monitoring_infrastructure.sql',
  '025_blog_content_sanitization_trigger.sql',
  '026_blog_audit_retention.sql',
  '027_blog_api_performance_fixes.sql'
]

// Unused function - kept for future direct migration execution
// async function runMigration(filename: string): Promise<void> {
//   console.log(`\n📄 Running migration: ${filename}`)
//   
//   try {
//     const sql = readFileSync(
//       join(process.cwd(), 'supabase', 'migrations', filename),
//       'utf-8'
//     )
//     
//     // Execute the SQL
//     const { error } = await supabase.rpc('exec_sql', {
//       sql_query: sql
//     }).single()
//     
//     if (error && error.message.includes('exec_sql')) {
//       // Try direct execution as fallback
//       const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${supabaseServiceKey}`,
//           'Content-Type': 'application/json',
//           'apikey': supabaseServiceKey
//         },
//         body: JSON.stringify({ query: sql })
//       })
//       
//       if (!response.ok) {
//         // Last resort: execute statements one by one
//         const statements = sql
//           .split(';')
//           .map(s => s.trim())
//           .filter(s => s.length > 0)
//         
//         for (const statement of statements) {
//           const { error: stmtError } = await supabase.from('_migrations').select('*').limit(0)
//           if (stmtError) {
//             console.error(`   ❌ Error: ${stmtError.message}`)
//           }
//         }
//         console.log(`   ⚠️  Migration may require manual execution in Supabase dashboard`)
//       } else {
//         console.log(`   ✅ Migration applied successfully`)
//       }
//     } else if (error) {
//       console.error(`   ❌ Error: ${error.message}`)
//       throw error
//     } else {
//       console.log(`   ✅ Migration applied successfully`)
//     }
//   } catch (error) {
//     console.error(`   ❌ Failed to run ${filename}:`, error)
//     throw error
//   }
// }

async function createStorageBucket(): Promise<void> {
  console.log('\n🪣 Creating storage bucket...')
  
  try {
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: 'blog-images',
        name: 'blog-images',
        public: true,
        file_size_limit: 10485760,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      })
    })
    
    if (response.status === 409) {
      console.log('   ℹ️  Storage bucket already exists')
    } else if (!response.ok) {
      const error = await response.text()
      console.error('   ❌ Failed to create bucket:', error)
    } else {
      console.log('   ✅ Storage bucket created')
    }
  } catch (error) {
    console.error('   ❌ Error creating bucket:', error)
  }
}

async function main() {
  console.log('🚀 Running Blog Migrations Directly')
  console.log('===================================')
  
  // Test connection
  console.log('\n🔗 Testing database connection...')
  const { error: testError } = await supabase.from('_test').select('*').limit(0)
  
  if (testError && !testError.message.includes('does not exist')) {
    console.error('❌ Cannot connect to database:', testError.message)
    console.log('\n💡 Please run the migrations manually in your Supabase dashboard:')
    console.log('   1. Go to the SQL Editor')
    console.log('   2. Run each migration file in order')
    console.log('   3. Start with 018_blog_cms_tables.sql')
    return
  }
  
  console.log('✅ Connected to database')
  
  // Provide manual instructions
  console.log('\n📋 Manual Migration Instructions:')
  console.log('Since direct migration execution requires special permissions,')
  console.log('please run the migrations manually in your Supabase dashboard:')
  console.log('\n1. Go to: https://supabase.com/dashboard/project/orrasduancqrevnqiiok/sql/new')
  console.log('2. Copy and paste each migration file content in order:')
  
  migrations.forEach((migration, index) => {
    console.log(`   ${index + 1}. ${migration}`)
  })
  
  console.log('\n3. Execute each one by clicking "Run"')
  console.log('\nMigration files are located in: supabase/migrations/')
  
  // Create storage bucket
  await createStorageBucket()
  
  console.log('\n✅ Setup partially complete!')
  console.log('\nNext steps:')
  console.log('1. Run migrations manually as described above')
  console.log('2. Deploy edge function: supabase functions deploy sanitize-html')
  console.log('3. Run: npm run seed:blog-content')
}

main().catch(console.error)