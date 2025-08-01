# Serena MCP Server: Comprehensive Best Practices Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Installation & Setup](#installation--setup)
3. [Core Concepts](#core-concepts)
4. [Tool Usage Best Practices](#tool-usage-best-practices)
5. [Semantic Code Navigation](#semantic-code-navigation)
6. [Symbol-Based Editing](#symbol-based-editing)
7. [Memory Management](#memory-management)
8. [Project Onboarding](#project-onboarding)
9. [Advanced Techniques](#advanced-techniques)
10. [Common Pitfalls & Solutions](#common-pitfalls--solutions)

## Introduction

Serena is a powerful open-source MCP server that transforms LLMs into fully-featured coding agents with semantic code understanding capabilities. Unlike text-based code assistants, Serena leverages Language Server Protocol (LSP) to provide symbol-level intelligence, making it uniquely powerful for complex coding tasks.

### Key Advantages
- **Semantic Understanding**: Navigates code at the symbol level (functions, classes, variables)
- **IDE-like Capabilities**: Provides tools similar to modern IDEs
- **Language Server Integration**: Uses LSP for accurate code analysis
- **Free & Open Source**: No API costs when used as MCP server
- **Multi-Language Support**: Python, TypeScript, Java, Go, Rust, C#, and more

## Installation & Setup

### Quick Setup for Claude Code
```bash
# Add Serena to Claude Code
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena-mcp-server --context ide-assistant
```

### Manual Configuration (Claude Desktop)
```json
{
  "mcpServers": {
    "serena": {
      "command": "/path/to/uvx",
      "args": [
        "--from", 
        "git+https://github.com/oraios/serena", 
        "serena-mcp-server",
        "--context", "ide-assistant"
      ]
    }
  }
}
```

### Docker Setup (Experimental)
```bash
docker run --rm -i --network host -v /path/to/projects:/workspaces/projects \
  ghcr.io/oraios/serena:latest serena-mcp-server --transport stdio
```

## Core Concepts

### Contexts
Contexts define Serena's operating environment:
- **`desktop-app`** (default): For desktop applications
- **`ide-assistant`**: Recommended for IDE integrations
- **`agno-agent`**: For use with Agno framework

### Modes
Modes refine behavior for specific tasks:
- **`interactive`**: Engage with user throughout tasks
- **`editing`**: Enable file editing capabilities
- **`planning`**: Focus on task planning
- **`one-shot`**: Complete tasks without interaction
- **`onboarding`**: Perform initial project analysis

### Transport Modes
- **STDIO** (default): Client-managed server lifecycle
- **SSE**: HTTP-based, self-managed server

## Tool Usage Best Practices

### 1. Start with Initial Instructions
```
/mcp__serena__initial_instructions
```
Always run this command when starting a new conversation to load Serena's context.

### 2. Perform Onboarding
```
/mcp__serena__check_onboarding_performed
/mcp__serena__onboarding
```
Let Serena analyze your project structure and create memory files before starting work.

### 3. Use Symbolic Navigation First
Instead of reading entire files:
```
❌ BAD: Read entire file with read_file
✅ GOOD: Use get_symbols_overview first, then find_symbol for specific code
```

### 4. Efficient Code Exploration Pattern
```
1. list_dir - Understand project structure
2. get_symbols_overview - See high-level code organization
3. find_symbol - Locate specific functions/classes
4. find_referencing_symbols - Track usage across codebase
```

## Semantic Code Navigation

### Finding Symbols
Use name paths to navigate code hierarchically:
```
# Find a class
find_symbol("MyClass")

# Find a method within a class
find_symbol("MyClass/my_method")

# Find with substring matching
find_symbol("process", substring_matching=true)

# Restrict to specific directory
find_symbol("handler", relative_path="src/services")
```

### Understanding Symbol Relationships
```
# Find all references to a symbol
find_referencing_symbols("DatabaseConnection", "src/db/connection.py")

# Find subclasses
find_referencing_symbols("BaseModel", include_kinds=[5])  # 5 = Class
```

### Efficient Pattern Searching
```
# Search for patterns when symbol names unknown
search_for_pattern("async.*fetch", restrict_search_to_code_files=true)

# Include context lines
search_for_pattern("error", context_lines_before=2, context_lines_after=2)
```

## Symbol-Based Editing

### Replace Entire Symbols
```
# Replace a complete function/method
replace_symbol_body(
    name_path="process_data",
    relative_path="src/utils.py",
    body="def process_data(items):\n    return [item.strip() for item in items]"
)
```

### Insert Code Strategically
```
# Add imports at file start
insert_before_symbol(
    name_path="<first-symbol>",
    body="from typing import List, Optional\n"
)

# Add new method to class
insert_after_symbol(
    name_path="MyClass/__init__",
    body="\n    def new_method(self):\n        pass"
)
```

### Regex-Based Editing
For smaller changes within symbols:
```
# Single line replacement
replace_regex(
    relative_path="config.py",
    regex="DEBUG = False",
    repl="DEBUG = True"
)

# Multi-line with wildcards
replace_regex(
    regex="def old_function\\(\\):.*?return result",
    repl="def new_function():\n    # Updated implementation\n    return improved_result"
)
```

## Memory Management

### Creating Effective Memories
```
# Project-specific conventions
write_memory("coding_standards", content)

# Architecture decisions
write_memory("database_schema", content)

# Common patterns
write_memory("api_patterns", content)
```

### Memory Best Practices
1. **Keep memories focused**: One topic per memory file
2. **Use descriptive names**: Make purpose clear from filename
3. **Update regularly**: Keep memories current with codebase
4. **Avoid duplication**: Check existing memories before creating

## Project Onboarding

### Automated Onboarding Creates:
1. **project_overview**: Tech stack and purpose
2. **suggested_commands**: Development commands
3. **code_style_conventions**: Coding standards
4. **task_completion_checklist**: Pre-commit workflow
5. **project_structure**: Directory organization

### Manual Project Activation
```
# Activate by path
activate_project("/path/to/project")

# Activate by registered name
activate_project("my-project")
```

## Advanced Techniques

### 1. Batch Operations
Perform multiple searches simultaneously:
```
# Check multiple patterns at once
patterns = ["TODO", "FIXME", "HACK", "BUG"]
for pattern in patterns:
    search_for_pattern(pattern)
```

### 2. Smart Refactoring
```
1. find_symbol("old_function")
2. find_referencing_symbols("old_function")
3. replace_symbol_body() for the function
4. Use replace_regex() for all references
```

### 3. Context Management
```
# Use think tools to maintain context
think_about_collected_information()
think_about_task_adherence()
think_about_whether_you_are_done()
```

### 4. Language Server Management
```
# Restart if edits cause issues
restart_language_server()
```

## Common Pitfalls & Solutions

### 1. Reading Entire Files
**Problem**: Loading unnecessary code into context
**Solution**: Use `get_symbols_overview` first, then targeted `find_symbol`

### 2. Ignoring References
**Problem**: Breaking code by not updating references
**Solution**: Always use `find_referencing_symbols` before major changes

### 3. Context Window Limits
**Problem**: Running out of LLM context
**Solution**: 
- Use `max_answer_chars` parameter
- Focus on specific directories
- Work incrementally

### 4. Regex Complexity
**Problem**: Complex regex patterns failing
**Solution**: Use wildcards (.*?) and match unique surrounding code

### 5. Missing Project Context
**Problem**: Not understanding codebase conventions
**Solution**: Always perform onboarding and read relevant memories

## Performance Optimization

### 1. Index Large Projects
For projects with 1000+ files, indexing improves performance significantly.

### 2. Restrict Search Scope
```
# Limit to specific directories
find_symbol("handler", relative_path="src/api")

# Use glob patterns effectively
search_for_pattern("test", paths_include_glob="**/*_test.py")
```

### 3. Efficient Memory Usage
- Clear unnecessary memories: `delete_memory("outdated_info")`
- List before reading: `list_memories()`

## Integration Tips

### For Claude Code Users
1. Add `--context ide-assistant` for better integration
2. Use project-specific activation: `--project $(pwd)`
3. Leverage shell execution when needed

### For IDE Integration
1. Use SSE transport for persistent connections
2. Configure appropriate ports
3. Set up proper error handling

## Troubleshooting

### Common Issues:
1. **"Tool not found"**: Run initial instructions
2. **"Onboarding needed"**: Perform onboarding process
3. **"Language server error"**: Restart language server
4. **"Multiple matches"**: Make regex more specific

### Debug Commands:
```
# Check current configuration
get_current_config()

# List available tools
/help (in some clients)

# Check project activation
list_memories()
```

## Conclusion

Serena MCP Server transforms LLMs into powerful coding agents by providing semantic code understanding. By following these best practices, you can:
- Navigate large codebases efficiently
- Make precise, symbol-aware edits
- Maintain project context across sessions
- Avoid common pitfalls

Remember: Serena's power comes from its semantic understanding. Always prefer symbolic operations over text-based ones for more accurate and maintainable code modifications.