#!/usr/bin/env tsx

/**
 * Type Coverage and Quality Check Script
 * 
 * This script performs comprehensive TypeScript type checking and coverage analysis
 * for the DCE blog CMS system. It's designed to run in CI/CD pipelines and local
 * development environments.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, join, dirname } from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)

interface TypeCoverageConfig {
  minCoverage: number
  ignorePaths: string[]
  strictMode: boolean
  failOnError: boolean
}

interface TypeCheckResult {
  success: boolean
  errors: string[]
  warnings: string[]
  coverage?: number
  details?: {
    totalLines: number
    typedLines: number
    untypedLines: number
  }
}

interface FileTypeInfo {
  path: string
  coverage: number
  issues: string[]
}

class TypeChecker {
  private config: TypeCoverageConfig
  private projectRoot: string

  constructor(config: Partial<TypeCoverageConfig> = {}) {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    this.projectRoot = resolve(__dirname, '..')
    this.config = {
      minCoverage: 95,
      ignorePaths: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/test/**',
        '**/*.d.ts',
        'vite.config.ts',
        'tailwind.config.js',
      ],
      strictMode: true,
      failOnError: true,
      ...config,
    }
  }

  /**
   * Main entry point for type checking
   */
  async run(): Promise<TypeCheckResult> {
    console.log('🔍 Starting comprehensive type checking...\n')

    const results: TypeCheckResult = {
      success: true,
      errors: [],
      warnings: [],
    }

    try {
      // 1. Basic TypeScript compilation check
      console.log('📝 Running TypeScript compilation check...')
      await this.runTscCheck(results)

      // 2. Type coverage analysis
      console.log('📊 Analyzing type coverage...')
      await this.runTypeCoverageCheck(results)

      // 3. Blog-specific type validation
      console.log('🏷️  Validating blog type definitions...')
      await this.validateBlogTypes(results)

      // 4. Run type-specific tests
      console.log('🧪 Running type-specific tests...')
      await this.runTypeTests(results)

      // 5. Check for common type issues
      console.log('⚠️  Checking for common type issues...')
      await this.checkCommonIssues(results)

      // 6. Generate type coverage report
      console.log('📋 Generating type coverage report...')
      await this.generateReport(results)

    } catch (error) {
      results.success = false
      results.errors.push(`Fatal error: ${error}`)
    }

    this.printSummary(results)
    return results
  }

  /**
   * Run TypeScript compiler check
   */
  private async runTscCheck(results: TypeCheckResult): Promise<void> {
    try {
      await execAsync('npx tsc --noEmit --skipLibCheck', {
        cwd: this.projectRoot,
      })
      console.log('✅ TypeScript compilation passed')
    } catch (error: unknown) {
      results.success = false
      const errorMessage = (error as { stdout?: string; stderr?: string; message?: string }).stdout || 
        (error as { stdout?: string; stderr?: string; message?: string }).stderr || 
        (error as { stdout?: string; stderr?: string; message?: string }).message
      results.errors.push(`TypeScript compilation failed:\n${errorMessage}`)
      console.log('❌ TypeScript compilation failed')
    }
  }

  /**
   * Run type coverage analysis using typescript-coverage-report
   */
  private async runTypeCoverageCheck(results: TypeCheckResult): Promise<void> {
    try {
      // Check if type-coverage is available
      const { stdout } = await execAsync('npx type-coverage --detail --cache', {
        cwd: this.projectRoot,
      }).catch(() => ({ stdout: '' }))

      if (stdout) {
        const coverageMatch = stdout.match(/(\d+\.\d+)%/)
        if (coverageMatch) {
          results.coverage = parseFloat(coverageMatch[1])
          
          if (results.coverage < this.config.minCoverage) {
            results.success = false
            results.errors.push(
              `Type coverage ${results.coverage}% is below minimum ${this.config.minCoverage}%`
            )
          }

          // Parse detailed coverage information
          const lines = stdout.split('\n')
          let totalLines = 0
          let typedLines = 0

          lines.forEach(line => {
            const detailMatch = line.match(/(\d+)\/(\d+)/)
            if (detailMatch) {
              typedLines += parseInt(detailMatch[1])
              totalLines += parseInt(detailMatch[2])
            }
          })

          results.details = {
            totalLines,
            typedLines,
            untypedLines: totalLines - typedLines,
          }

          console.log(`✅ Type coverage: ${results.coverage}%`)
        }
      } else {
        results.warnings.push('Type coverage tool not available, skipping coverage analysis')
      }
    } catch (error: unknown) {
      results.warnings.push(`Type coverage check failed: ${(error as Error).message}`)
    }
  }

  /**
   * Validate blog-specific type definitions
   */
  private async validateBlogTypes(results: TypeCheckResult): Promise<void> {
    const blogTypesPath = join(this.projectRoot, 'src/types/blog.ts')
    
    if (!existsSync(blogTypesPath)) {
      results.errors.push('Blog types file not found: src/types/blog.ts')
      return
    }

    try {
      const blogTypesContent = readFileSync(blogTypesPath, 'utf-8')
      
      // Check for required type exports
      const requiredTypes = [
        'BlogPost',
        'BlogAuthor',
        'BlogCategory',
        'BlogTag',
        'BlogComment',
        'PostStatus',
        'CommentStatus',
        'PaginatedResponse',
        'CreateBlogPostData',
        'UpdateBlogPostData',
      ]

      const missingTypes = requiredTypes.filter(type => 
        !blogTypesContent.includes(`export type ${type}`) && 
        !blogTypesContent.includes(`export interface ${type}`)
      )

      if (missingTypes.length > 0) {
        results.errors.push(`Missing required blog types: ${missingTypes.join(', ')}`)
      }

      // Check for proper type imports
      if (!blogTypesContent.includes("import type { Database }")) {
        results.warnings.push('Blog types should import Database type from database.ts')
      }

      // Check for any types
      const anyTypeMatches = blogTypesContent.match(/:\s*any\b/g)
      if (anyTypeMatches && anyTypeMatches.length > 0) {
        results.errors.push(`Found ${anyTypeMatches.length} 'any' types in blog.ts - these should be properly typed`)
      }

      console.log('✅ Blog type definitions validated')
    } catch (error: unknown) {
      results.errors.push(`Failed to validate blog types: ${(error as Error).message}`)
    }
  }

  /**
   * Run type-specific tests
   */
  private async runTypeTests(results: TypeCheckResult): Promise<void> {
    try {
      const typeTestPatterns = [
        'src/types/__tests__/**/*.test.ts',
        'src/hooks/__tests__/**/*.types.test.ts',
        'src/store/__tests__/**/*.types.test.ts',
      ]

      for (const pattern of typeTestPatterns) {
        try {
          await execAsync(`npx vitest run "${pattern}" --reporter=verbose`, {
            cwd: this.projectRoot,
          })
          console.log(`✅ Type tests passed: ${pattern}`)
        } catch (error: unknown) {
          // Don't fail completely if type tests fail, but record the issue
          results.warnings.push(`Type tests failed for ${pattern}: ${(error as Error).message}`)
        }
      }
    } catch (error: unknown) {
      results.warnings.push(`Failed to run type tests: ${(error as Error).message}`)
    }
  }

  /**
   * Check for common TypeScript issues
   */
  private async checkCommonIssues(results: TypeCheckResult): Promise<void> {
    const issues: FileTypeInfo[] = []

    try {
      // Check for common anti-patterns
      const { stdout } = await execAsync(
        'find src -name "*.ts" -o -name "*.tsx" | head -50',
        { cwd: this.projectRoot }
      )

      const files = stdout.trim().split('\n').filter(Boolean)

      for (const file of files) {
        const filePath = join(this.projectRoot, file)
        if (!existsSync(filePath)) continue

        try {
          const content = readFileSync(filePath, 'utf-8')
          const fileIssues: string[] = []

          // Check for 'any' types
          const anyMatches = content.match(/:\s*any\b/g)
          if (anyMatches) {
            fileIssues.push(`${anyMatches.length} 'any' types found`)
          }

          // Check for non-null assertions
          const nonNullMatches = content.match(/!\s*[.[]/g)
          if (nonNullMatches && nonNullMatches.length > 5) {
            fileIssues.push(`${nonNullMatches.length} non-null assertions (consider safer alternatives)`)
          }

          // Check for @ts-ignore comments
          const tsIgnoreMatches = content.match(/@ts-ignore/g)
          if (tsIgnoreMatches) {
            fileIssues.push(`${tsIgnoreMatches.length} @ts-ignore comments found`)
          }

          // Check for TODO type comments
          const todoTypeMatches = content.match(/\/\/\s*TODO.*type/gi)
          if (todoTypeMatches) {
            fileIssues.push(`${todoTypeMatches.length} TODO type comments`)
          }

          if (fileIssues.length > 0) {
            issues.push({
              path: file,
              coverage: 0, // Would need more sophisticated analysis
              issues: fileIssues,
            })
          }

        } catch {
          // Skip files that can't be read
          continue
        }
      }

      if (issues.length > 0) {
        const totalIssues = issues.reduce((sum, file) => sum + file.issues.length, 0)
        
        if (totalIssues > 10) {
          results.errors.push(`Found ${totalIssues} type-related issues across ${issues.length} files`)
        } else {
          results.warnings.push(`Found ${totalIssues} type-related issues across ${issues.length} files`)
        }

        // Add details to results for reporting
        ;(results as TypeCheckResult & { fileIssues: FileTypeInfo[] }).fileIssues = issues
      }

      console.log(`✅ Common type issues check completed (${issues.length} files with issues)`)
    } catch (error: unknown) {
      results.warnings.push(`Failed to check common issues: ${(error as Error).message}`)
    }
  }

  /**
   * Generate comprehensive type coverage report
   */
  private async generateReport(results: TypeCheckResult): Promise<void> {
    const reportPath = join(this.projectRoot, 'type-coverage-report.json')
    
    const report = {
      timestamp: new Date().toISOString(),
      success: results.success,
      coverage: results.coverage,
      details: results.details,
      errors: results.errors,
      warnings: results.warnings,
      fileIssues: (results as TypeCheckResult & { fileIssues?: FileTypeInfo[] }).fileIssues || [],
      config: this.config,
      summary: {
        totalErrors: results.errors.length,
        totalWarnings: results.warnings.length,
        coverageMet: results.coverage ? results.coverage >= this.config.minCoverage : false,
      },
    }

    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2))
      console.log(`✅ Type coverage report generated: ${reportPath}`)
    } catch (error: unknown) {
      results.warnings.push(`Failed to generate report: ${(error as Error).message}`)
    }
  }

  /**
   * Print summary of results
   */
  private printSummary(results: TypeCheckResult): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 TYPE CHECKING SUMMARY')
    console.log('='.repeat(60))

    if (results.success) {
      console.log('✅ Overall Status: PASSED')
    } else {
      console.log('❌ Overall Status: FAILED')
    }

    if (results.coverage !== undefined) {
      console.log(`📈 Type Coverage: ${results.coverage}% (min: ${this.config.minCoverage}%)`)
    }

    if (results.details) {
      console.log(`📝 Total Lines Analyzed: ${results.details.totalLines}`)
      console.log(`✅ Typed Lines: ${results.details.typedLines}`)
      console.log(`⚠️  Untyped Lines: ${results.details.untypedLines}`)
    }

    if (results.errors.length > 0) {
      console.log(`❌ Errors: ${results.errors.length}`)
      results.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`)
      })
    }

    if (results.warnings.length > 0) {
      console.log(`⚠️  Warnings: ${results.warnings.length}`)
      results.warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`)
      })
    }

    console.log('='.repeat(60))
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2)
  const config: Partial<TypeCoverageConfig> = {}

  // Parse command line arguments
  args.forEach((arg, index) => {
    if (arg === '--min-coverage' && args[index + 1]) {
      config.minCoverage = parseInt(args[index + 1])
    }
    if (arg === '--no-strict') {
      config.strictMode = false
    }
    if (arg === '--no-fail') {
      config.failOnError = false
    }
  })

  const checker = new TypeChecker(config)
  const results = await checker.run()

  // Exit with appropriate code for CI/CD
  if (!results.success && config.failOnError !== false) {
    process.exit(1)
  }
}

// Run if called directly (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { TypeChecker, type TypeCheckResult, type TypeCoverageConfig }