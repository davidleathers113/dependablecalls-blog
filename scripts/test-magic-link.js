// Quick test script for magic link authentication
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testMagicLink() {
  const email = 'test@example.com'
  
  console.log('Testing magic link for:', email)
  
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'http://localhost:5173/auth/callback',
    },
  })
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Success! Check email at http://127.0.0.1:54324')
    console.log('Response:', data)
  }
}

testMagicLink()