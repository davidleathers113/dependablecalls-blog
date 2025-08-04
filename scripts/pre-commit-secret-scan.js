#!/usr/bin/env node

/**
 * DCE Platform Pre-Commit Secret Scanner
 * Prevents secrets from being committed to version control
 * Phase 4.9: Secret Management Implementation
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Determine __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize('\n🔍 DCE Platform Secret Scanner', 'cyan'));
  console.log(colorize('================================', 'cyan'));
  console.log('Scanning staged files for secrets before commit...\n');
}

function printFooter(success) {
  console.log('\n' + colorize('================================', 'cyan'));
  if (success) {
    console.log(colorize('✅ Pre-commit scan passed!', 'green'));
    console.log(colorize('🚀 Commit is safe to proceed.', 'green'));
  } else {
    console.log(colorize('❌ Pre-commit scan failed!', 'red'));
    console.log(colorize('🛡️  Commit blocked for security.', 'red'));
  }
  console.log(colorize('================================\n', 'cyan'));
}

// Dynamically import the compiled scanner
let PreCommitSecretScanner;
const scannerPath = path.join(__dirname, '../dist/lib/security/secret-scanner.js');

if (fs.existsSync(scannerPath)) {
    try {
        const scannerModule = await import(`file://${scannerPath}`);
        PreCommitSecretScanner = scannerModule.PreCommitSecretScanner;
    } catch (e) {
        console.error(colorize('Error loading secret scanner module:', 'red'), e);
        PreCommitSecretScanner = null;
    }
}


async function runSecretScanner() {
  try {
    printHeader();

    // Check if we're in a git repository
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    } catch (error) {
      console.log(colorize('⚠️  Not in a git repository. Skipping secret scan.', 'yellow'));
      process.exit(0);
    }

    // Check if there are staged files
    let stagedFiles;
    try {
      stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(file => file.length > 0);
    } catch (error) {
      console.log(colorize('⚠️  No staged files found. Skipping secret scan.', 'yellow'));
      process.exit(0);
    }

    if (stagedFiles.length === 0) {
      console.log(colorize('⚠️  No staged files found. Skipping secret scan.', 'yellow'));
      process.exit(0);
    }

    console.log(colorize(`📁 Scanning ${stagedFiles.length} staged files...`, 'blue'));
    console.log('Files to scan:');
    stagedFiles.forEach(file => {
      console.log(`  ${colorize('•', 'blue')} ${file}`);
    });
    console.log();

    // Run the secret scanner
    const scanner = new PreCommitSecretScanner();
    await scanner.runPreCommitCheck();

  } catch (error) {
    if (error.code === 1) {
      // Expected exit code when secrets are found
      printFooter(false);
      process.exit(1);
    } else {
      // Unexpected error
      console.error(colorize('❌ Unexpected error during secret scanning:', 'red'));
      console.error(error.message);
      console.error(colorize('\n🔧 Please check your secret scanner configuration.', 'yellow'));
      printFooter(false);
      process.exit(1);
    }
  }
}

// Fallback manual scanner if TypeScript version not available
async function runManualScanner() {
  console.log(colorize('📦 Using fallback manual scanner...', 'yellow'));

  const secretPatterns = [
    // AWS
    { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/gi },
    { name: 'AWS Secret Key', pattern: /[A-Za-z0-9/+=]{40}/g },
    
    // Stripe
    { name: 'Stripe Secret Key', pattern: /sk_(test|live)_[0-9a-zA-Z]{24,}/gi },
    { name: 'Stripe Publishable Key', pattern: /pk_(test|live)_[0-9a-zA-Z]{24,}/gi },
    { name: 'Stripe Webhook Secret', pattern: /whsec_[0-9a-zA-Z]{32,}/gi },
    
    // JWT
    { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
    
    // Database URLs
    { name: 'PostgreSQL URL', pattern: /postgres(?:ql)?:\/\/[^\s'"]+/gi },
    { name: 'MongoDB URL', pattern: /mongodb(?:\+srv)?:\/\/[^\s'"]+/gi },
    { name: 'Redis URL', pattern: /redis:\/\/[^\s'"]+/gi },
    
    // API Keys
    { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey|secret[_-]?key|secretkey)['":\s=]+[a-zA-Z0-9_-]{16,}/gi },
    
    // Private Keys
    { name: 'Private Key', pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/gi },
    
    // GitHub Token
    { name: 'GitHub Token', pattern: /ghp_[A-Za-z0-9_]{36}/g },
    
    // Hardcoded passwords (exclude function parameters and type definitions)
    { name: 'Hardcoded Password', pattern: /(?:password|pwd|pass)[\s]*[=:]\s*["'][^\s'"]{6,}["']/gi }
  ];

  // Get staged files
  let stagedFiles;
  try {
    stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(file => file.length > 0);
  } catch (error) {
    console.log(colorize('⚠️  No staged files found.', 'yellow'));
    return true;
  }

  let foundSecrets = false;
  const results = [];

  for (const file of stagedFiles) {
    // Skip binary files and node_modules
    if (file.includes('node_modules') || 
        file.includes('.git/') ||
        /\.(jpg|jpeg|png|gif|pdf|zip|tar|gz|exe|dll|so|dylib)$/i.test(file)) {
      continue;
    }

    try {
      // Get staged content of the file
      const content = execSync(`git show :${file}`, { encoding: 'utf-8' });
      const lines = content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        // Skip comments
        if (line.trim().startsWith('//') || 
            line.trim().startsWith('#') || 
            line.trim().startsWith('*') ||
            line.trim().startsWith('/*')) {
          continue;
        }

        for (const pattern of secretPatterns) {
          const matches = Array.from(line.matchAll(pattern.pattern));
          
          for (const match of matches) {
            // Skip environment variable references
            if (line.includes('process.env.') || 
                line.includes('import.meta.env.') ||
                line.includes('Deno.env.get') ||
                line.includes('${') ||
                match[0].startsWith('$')) {
              continue;
            }

            // Skip TypeScript type definitions and function parameters
            if (line.includes(': string') || 
                line.includes('password:') ||
                line.includes('(email:') ||
                line.includes('async (') ||
                line.includes('=> {') ||
                line.includes('function ')) {
              continue;
            }

            foundSecrets = true;
            results.push({
              file,
              line: lineIndex + 1,
              pattern: pattern.name,
              match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : ''),
              context: line.trim()
            });
          }
        }
      }
    } catch (error) {
      // File might be deleted or binary
      continue;
    }
  }

  if (foundSecrets) {
    console.log(colorize('\n🚨 SECRETS DETECTED IN STAGED FILES:', 'red'));
    console.log(colorize('='.repeat(50), 'red'));
    
    for (const result of results) {
      console.log(colorize(`\n📁 ${result.file}:${result.line}`, 'yellow'));
      console.log(colorize(`🏷️  ${result.pattern}`, 'yellow'));
      console.log(colorize(`🔍 Match: ${result.match}`, 'red'));
      console.log(colorize(`📝 Context: ${result.context}`, 'yellow'));
    }

    console.log(colorize('\n❌ COMMIT BLOCKED!', 'red'));
    console.log(colorize('Please remove the secrets and try again.', 'yellow'));
    console.log(colorize('\nTo bypass this check (NOT RECOMMENDED):', 'yellow'));
    console.log(colorize('git commit --no-verify', 'cyan'));
    
    return false;
  }

  console.log(colorize('✅ No secrets detected in staged files.', 'green'));
  return true;
}

// Main execution
async function main() {
  try {
    // Try to use the TypeScript compiled version first
    if (PreCommitSecretScanner) {
      await runSecretScanner();
    } else {
      // Fall back to manual scanner
      const success = await runManualScanner();
      printFooter(success);
      if (!success) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(colorize('❌ Error running secret scanner:', 'red'), error.message);
    process.exit(1);
  }
}

// Handle SIGINT gracefully
process.on('SIGINT', () => {
  console.log(colorize('\n⚠️  Secret scan interrupted by user.', 'yellow'));
  console.log(colorize('🛡️  Commit blocked for safety.', 'yellow'));
  process.exit(1);
});

main();
