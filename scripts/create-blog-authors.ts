#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables manually
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    const lines = envFile.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          process.env[key.trim()] = value;
        }
      }
    }
  } catch (error) {
    console.error('⚠️  Could not load .env file. Using existing environment variables.');
  }
}

// Load environment variables
loadEnv();

// Validate required environment variables
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease ensure your .env file contains these variables.');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Author data
interface AuthorData {
  email: string;
  password?: string;
  user_metadata: {
    full_name: string;
    role: string;
  };
  profile: {
    slug: string;
    name: string;
    bio: string;
    avatar_url: string | null;
    social_links?: {
      twitter?: string;
      linkedin?: string;
      github?: string;
      website?: string;
    };
  };
}

// Generate a secure password using crypto.randomBytes
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const passwordLength = 20;
  const randomBytesBuffer = randomBytes(passwordLength);
  
  let password = '';
  for (let i = 0; i < passwordLength; i++) {
    password += chars[randomBytesBuffer[i] % chars.length];
  }
  
  // Ensure password has at least one of each type
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecial) {
    // Recursively generate a new password if it doesn't meet requirements
    return generateSecurePassword();
  }
  
  return password;
}

// Store credentials (for now, just console output with security warnings)
async function storeCredentials(email: string, password: string): Promise<void> {
  console.log(`\n🔐 Credentials for ${email}:`);
  console.log(`   Password: ${password}`);
  console.log('   ⚠️  WARNING: Store these credentials securely!');
  console.log('   ⚠️  Do NOT commit them to version control!');
  console.log('   ⚠️  Consider using a password manager or secure vault.');
}

// Create blog authors
async function createAuthors() {
  console.log('🚀 Starting blog author creation process...\n');
  
  const authors: AuthorData[] = [
    {
      email: 'john.smith@dependablecalls.com',
      user_metadata: {
        full_name: 'John Smith',
        role: 'author'
      },
      profile: {
        slug: 'john-smith',
        name: 'John Smith',
        bio: 'Senior Content Strategist with over 10 years of experience in digital marketing and pay-per-call advertising. Specializes in conversion optimization and lead generation strategies.',
        avatar_url: null,
        social_links: {
          twitter: 'https://twitter.com/johnsmith',
          linkedin: 'https://linkedin.com/in/johnsmith',
          website: 'https://johnsmith.com'
        }
      }
    },
    {
      email: 'sarah.johnson@dependablecalls.com',
      user_metadata: {
        full_name: 'Sarah Johnson',
        role: 'author'
      },
      profile: {
        slug: 'sarah-johnson',
        name: 'Sarah Johnson',
        bio: 'Marketing Technology Expert focused on performance tracking and analytics. Passionate about helping businesses maximize their ROI through data-driven strategies.',
        avatar_url: null,
        social_links: {
          linkedin: 'https://linkedin.com/in/sarahjohnson',
          github: 'https://github.com/sarahjohnson'
        }
      }
    },
    {
      email: 'mike.chen@dependablecalls.com',
      user_metadata: {
        full_name: 'Mike Chen',
        role: 'author'
      },
      profile: {
        slug: 'mike-chen',
        name: 'Mike Chen',
        bio: 'Technical Content Writer specializing in telephony systems and call tracking technology. Former software engineer with expertise in VoIP and real-time communications.',
        avatar_url: null,
        social_links: {
          twitter: 'https://twitter.com/mikechen',
          github: 'https://github.com/mikechen',
          linkedin: 'https://linkedin.com/in/mikechen'
        }
      }
    }
  ];
  
  // Generate passwords for all authors
  authors.forEach(author => {
    author.password = generateSecurePassword();
  });
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const author of authors) {
    try {
      console.log(`\n📝 Creating author: ${author.profile.name}...`);
      
      // Step 1: Create auth user with admin API
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: author.email,
        password: author.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: author.user_metadata
      });
      
      if (authError) {
        throw new Error(`Auth creation failed: ${authError.message}`);
      }
      
      if (!authUser?.user) {
        throw new Error('No user data returned from auth creation');
      }
      
      console.log(`   ✅ Auth user created: ${authUser.user.id}`);
      
      // Step 2: Create blog author profile
      const { data: profile, error: profileError } = await supabase
        .from('blog_authors')
        .insert({
          user_id: authUser.user.id,
          slug: author.profile.slug,
          name: author.profile.name,
          bio: author.profile.bio,
          avatar_url: author.profile.avatar_url,
          social_links: author.profile.social_links || {}
        })
        .select()
        .single();
      
      if (profileError) {
        // If profile creation fails, we should clean up the auth user
        console.error(`   ❌ Profile creation failed: ${profileError.message}`);
        console.log(`   🧹 Attempting to clean up auth user...`);
        
        const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.user.id);
        if (deleteError) {
          console.error(`   ❌ Failed to clean up auth user: ${deleteError.message}`);
        } else {
          console.log(`   ✅ Auth user cleaned up successfully`);
        }
        
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }
      
      if (!profile) {
        throw new Error('No profile data returned');
      }
      
      console.log(`   ✅ Author profile created: ${profile.id}`);
      console.log(`   📊 Profile details:`);
      console.log(`      - Slug: ${profile.slug}`);
      console.log(`      - Bio: ${profile.bio.substring(0, 50)}...`);
      
      // Store credentials
      await storeCredentials(author.email, author.password!);
      
      successCount++;
      
    } catch (error) {
      errorCount++;
      console.error(`\n❌ Failed to create author ${author.profile.name}:`, error);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully created: ${successCount} authors`);
  if (errorCount > 0) {
    console.log(`❌ Failed to create: ${errorCount} authors`);
  }
  console.log('\n🔐 SECURITY REMINDER:');
  console.log('   1. Store all passwords in a secure password manager');
  console.log('   2. Share credentials only through secure channels');
  console.log('   3. Enable 2FA for all author accounts after first login');
  console.log('   4. Consider implementing SSO for production use');
  console.log('='.repeat(60));
}

// Run the script
createAuthors()
  .then(() => {
    console.log('\n✨ Blog author creation process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error during author creation:', error);
    process.exit(1);
  });