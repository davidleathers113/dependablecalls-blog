#!/usr/bin/env node

/**
 * Secure test account setup script for DCE platform
 * Creates test accounts with randomly generated passwords
 * 
 * Security improvements:
 * - Transactional user creation
 * - Random password generation
 * - No passwords stored in files
 * - Parallel processing for performance
 * 
 * Usage: npm run setup:test-accounts
 */

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'

interface TestAccount {
  email: string
  firstName: string
  lastName: string
  userType: 'admin' | 'supplier' | 'buyer' | 'network'
  companyName?: string
  businessType?: string
  creditBalance?: number
  creditLimit?: number
  currentBalance?: number
}

interface SupplierInsertData {
  user_id: string
  company_name?: string
  business_type?: string
  status: string
  approved_at: string
  credit_balance?: number
}

interface BuyerInsertData {
  user_id: string
  company_name?: string
  business_type?: string
  status: string
  approved_at: string
  credit_limit?: number
  current_balance?: number
}

interface CreatedAccount extends TestAccount {
  id: string
  password: string
}

// Test account configurations (no passwords!)
const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: 'admin@dce-test.com',
    firstName: 'Admin',
    lastName: 'User',
    userType: 'admin',
    companyName: 'DCE Platform Admin'
  },
  {
    email: 'supplier@dce-test.com',
    firstName: 'Test',
    lastName: 'Supplier',
    userType: 'supplier',
    companyName: 'Test Traffic Co',
    businessType: 'Lead Generation',
    creditBalance: 1500.00
  },
  {
    email: 'buyer@dce-test.com',
    firstName: 'Test',
    lastName: 'Buyer',
    userType: 'buyer',
    companyName: 'Insurance Plus LLC',
    businessType: 'Insurance',
    creditLimit: 10000.00,
    currentBalance: 8500.00
  },
  {
    email: 'buyer2@dce-test.com',
    firstName: 'Premium',
    lastName: 'Buyer',
    userType: 'buyer',
    companyName: 'Premium Legal Services',
    businessType: 'Legal Services',
    creditLimit: 25000.00,
    currentBalance: 22000.00
  }
]

// Initialize Supabase client
// For local development, use the local Supabase instance
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  console.error('\n⚠️  SECURITY NOTE: Never commit the service role key to version control!')
  console.error('   Store it in CI/CD secrets or use environment-specific .env files.\n')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Generate a cryptographically secure random password
 */
function generateSecurePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const passwordLength = 20
  const randomValues = randomBytes(passwordLength)
  
  let password = ''
  for (let i = 0; i < passwordLength; i++) {
    password += chars[randomValues[i] % chars.length]
  }
  
  return password
}


/**
 * Create a single test account using the transactional database function
 */
async function createTestAccount(account: TestAccount): Promise<CreatedAccount | null> {
  const password = generateSecurePassword()
  
  try {
    // Try to use transactional function if it exists
    const { data: userId, error: rpcError } = await supabase.rpc('create_full_user', {
      p_email: account.email,
      p_password: password,
      p_first_name: account.firstName,
      p_last_name: account.lastName,
      p_user_type: account.userType,
      p_company: account.companyName,
      p_business_type: account.businessType,
      p_credit_balance: account.creditBalance,
      p_credit_limit: account.creditLimit,
      p_current_balance: account.currentBalance
    })
    
    if (!rpcError) {
      console.log(`✓ Created ${account.userType} account: ${account.email} (transactional)`)
      
      return {
        ...account,
        id: userId as string,
        password
      }
    }
    
    // Fallback: Create users directly with schema detection
    // First check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', account.email)
      .single()
    
    if (existingUser) {
      console.log(`⚠️  User ${account.email} already exists, skipping...`)
      return null
    }
    
    // For simplicity, we'll attempt to insert with credit fields and handle errors gracefully
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: account.firstName,
        last_name: account.lastName,
        user_type: account.userType
      }
    })
    
    if (authError) {
      console.error(`❌ Failed to create auth user ${account.email}:`, authError.message)
      return null
    }
    
    const authUserId = authData.user!.id
    
    // Create user profile
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        email: account.email,
        first_name: account.firstName,
        last_name: account.lastName,
        status: 'active',
        is_active: true
      })
    
    if (userError) {
      console.error(`❌ Failed to create user profile for ${account.email}:`, userError.message)
      // Cleanup auth user
      await supabase.auth.admin.deleteUser(authUserId)
      return null
    }
    
    // Create role-specific record with schema awareness
    if (account.userType === 'admin') {
      const { error } = await supabase
        .from('admins')
        .insert({
          user_id: authUserId,
          role: 'super_admin',
          permissions: {
            super_admin: true,
            user_management: true,
            financial_management: true
          },
          is_active: true
        })
      if (error) console.error(`⚠️  Failed to create admin record:`, error.message)
    } else if (account.userType === 'supplier') {
      const supplierData: SupplierInsertData = {
        user_id: authUserId,
        company_name: account.companyName,
        business_type: account.businessType,
        status: 'active',
        approved_at: new Date().toISOString()
      }
      
      // Add credit_balance if provided
      if (account.creditBalance !== undefined) {
        supplierData.credit_balance = account.creditBalance
      }
      
      const { error } = await supabase
        .from('suppliers')
        .insert(supplierData)
      if (error) console.error(`⚠️  Failed to create supplier record:`, error.message)
    } else if (account.userType === 'buyer') {
      const buyerData: BuyerInsertData = {
        user_id: authUserId,
        company_name: account.companyName,
        business_type: account.businessType,
        status: 'active',
        approved_at: new Date().toISOString()
      }
      
      // Add credit fields if provided
      if (account.creditLimit !== undefined) {
        buyerData.credit_limit = account.creditLimit
      }
      if (account.currentBalance !== undefined) {
        buyerData.current_balance = account.currentBalance
      }
      
      const { error } = await supabase
        .from('buyers')
        .insert(buyerData)
      if (error) console.error(`⚠️  Failed to create buyer record:`, error.message)
    }
    
    console.log(`✓ Created ${account.userType} account: ${account.email}`)
    
    return {
      ...account,
      id: authUserId,
      password
    }
  } catch (error) {
    console.error(`❌ Unexpected error creating ${account.email}:`, error)
    return null
  }
}

/**
 * Create all test accounts in parallel for better performance
 */
async function createAllTestAccounts(): Promise<CreatedAccount[]> {
  console.log('🚀 Setting up test accounts for DCE platform...\n')
  
  // Create all accounts in parallel
  const results = await Promise.allSettled(
    TEST_ACCOUNTS.map(account => createTestAccount(account))
  )
  
  // Filter out successful creations
  const createdAccounts: CreatedAccount[] = []
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      createdAccounts.push(result.value)
    }
  }
  
  return createdAccounts
}

/**
 * Update seed.sql file with actual UUIDs
 * Uses Node.js compatible string replacement
 */
async function updateSeedFile(accounts: CreatedAccount[]): Promise<void> {
  console.log('\n📄 Updating seed.sql file with actual UUIDs...')
  
  const seedPath = join(process.cwd(), 'supabase', 'seed.sql')
  let seedContent = await readFile(seedPath, 'utf-8')
  
  // Map of placeholder UUIDs to actual UUIDs
  const uuidMap = new Map([
    ['00000000-0000-0000-0000-000000000001', accounts.find(a => a.userType === 'admin')?.id],
    ['11111111-1111-1111-1111-111111111111', accounts.find(a => a.email === 'supplier@dce-test.com')?.id],
    ['22222222-2222-2222-2222-222222222222', accounts.find(a => a.email === 'buyer@dce-test.com')?.id],
    ['33333333-3333-3333-3333-333333333333', accounts.find(a => a.email === 'buyer2@dce-test.com')?.id]
  ])
  
  // Replace placeholder UUIDs with actual ones (Node 14 compatible)
  for (const [placeholder, actualId] of uuidMap) {
    if (actualId) {
      // Use split/join for Node 14 compatibility instead of replaceAll
      seedContent = seedContent.split(placeholder).join(actualId)
    }
  }
  
  await writeFile(seedPath, seedContent)
  console.log('   ✅ seed.sql updated successfully')
}

/**
 * Display account credentials securely (only to stdout, never to files)
 */
function displayCredentials(accounts: CreatedAccount[]): void {
  console.log('\n' + '='.repeat(80))
  console.log('🔐 TEST ACCOUNT CREDENTIALS (Save these securely!)')
  console.log('='.repeat(80))
  console.log('\n⚠️  SECURITY NOTES:')
  console.log('   • These passwords are shown ONCE and not stored anywhere')
  console.log('   • Copy them to a secure password manager immediately')
  console.log('   • Never commit these credentials to version control')
  console.log('   • For CI/CD, use environment variables or secret management')
  console.log('\n' + '-'.repeat(80))
  
  for (const account of accounts) {
    console.log(`\n${account.userType.toUpperCase()} Account:`)
    console.log(`   Email:    ${account.email}`)
    console.log(`   Password: ${account.password}`)
    console.log(`   User ID:  ${account.id}`)
    if (account.companyName) {
      console.log(`   Company:  ${account.companyName}`)
    }
  }
  
  console.log('\n' + '='.repeat(80))
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    // Check if we can connect to Supabase
    const { error: healthError } = await supabase.from('users').select('count').limit(1)
    if (healthError) {
      console.error('❌ Cannot connect to Supabase:', healthError.message)
      console.error('   Ensure your local Supabase instance is running: npx supabase start')
      process.exit(1)
    }
    
    // Create test accounts
    const accounts = await createAllTestAccounts()
    
    if (accounts.length === 0) {
      console.error('\n❌ No accounts were created successfully')
      process.exit(1)
    }
    
    console.log(`\n✅ Successfully created ${accounts.length} test accounts`)
    
    // Update seed file with actual UUIDs
    await updateSeedFile(accounts)
    
    // Display credentials (only to stdout)
    displayCredentials(accounts)
    
    console.log('\n✨ Test account setup complete!')
    console.log('\nNext steps:')
    console.log('1. Save the credentials shown above to a secure location')
    console.log('2. Run "npx supabase db reset" to apply seed data')
    console.log('3. Start the dev server with "npm run dev"')
    console.log('4. Log in with any test account credentials')
    console.log('\nTo regenerate accounts with new passwords, run this script again.')
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  }
}

// Run the script
main()