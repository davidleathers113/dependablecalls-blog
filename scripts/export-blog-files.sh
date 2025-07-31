#!/bin/bash

# Export Blog CMS Files to Markdown
# This script combines all newly created blog-related files into a single markdown document

OUTPUT_FILE="BLOG_CMS_IMPLEMENTATION_FILES.md"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Create or overwrite the output file
cat > "$OUTPUT_FILE" << EOF
# Blog CMS Implementation Files

Generated on: $TIMESTAMP

This document contains all the files created for the Supabase Blog CMS implementation.

---

EOF

# Function to add a file to the output
add_file_to_output() {
    local file_path=$1
    local file_type=$2
    
    if [ -f "$file_path" ]; then
        echo "Adding: $file_path"
        cat >> "$OUTPUT_FILE" << EOF

## File: \`$file_path\`

\`\`\`$file_type
$(cat "$file_path")
\`\`\`

---

EOF
    else
        echo "Warning: File not found - $file_path"
    fi
}

# Add all blog-related files

echo "# Database Files" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Migration files
add_file_to_output "supabase/migrations/018_blog_cms_tables.sql" "sql"
add_file_to_output "supabase/migrations/README_blog_migration.md" "markdown"
add_file_to_output "supabase/seed_blog.sql" "sql"

echo "" >> "$OUTPUT_FILE"
echo "# Documentation Files" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Documentation
add_file_to_output "SUPABASE_BLOG_CMS_IMPLEMENTATION_GUIDE.md" "markdown"

# TypeScript files (if they exist)
echo "" >> "$OUTPUT_FILE"
echo "# TypeScript Implementation Files" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

add_file_to_output "src/types/blog.ts" "typescript"
add_file_to_output "src/services/blog/index.ts" "typescript"
add_file_to_output "src/services/blog/post.service.ts" "typescript"
add_file_to_output "src/services/blog/author.service.ts" "typescript"
add_file_to_output "src/services/blog/taxonomy.service.ts" "typescript"
add_file_to_output "src/services/blog/comment.service.ts" "typescript"
add_file_to_output "src/services/blog/analytics.service.ts" "typescript"
add_file_to_output "src/hooks/useBlog.ts" "typescript"
add_file_to_output "src/hooks/useBlogRealtime.ts" "typescript"
add_file_to_output "src/store/blogStore.ts" "typescript"

# Frontend components (if they exist)
echo "" >> "$OUTPUT_FILE"
echo "# Frontend Components" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Public blog pages
add_file_to_output "src/pages/public/blog/BlogHomePage.tsx" "tsx"
add_file_to_output "src/pages/public/blog/BlogPostPage.tsx" "tsx"
add_file_to_output "src/pages/public/blog/BlogCategoryPage.tsx" "tsx"
add_file_to_output "src/pages/public/blog/BlogTagPage.tsx" "tsx"
add_file_to_output "src/pages/public/blog/BlogSearchPage.tsx" "tsx"

# Blog components
add_file_to_output "src/components/blog/BlogPostCard.tsx" "tsx"
add_file_to_output "src/components/blog/BlogPostContent.tsx" "tsx"
add_file_to_output "src/components/blog/BlogSidebar.tsx" "tsx"
add_file_to_output "src/components/blog/BlogPagination.tsx" "tsx"
add_file_to_output "src/components/blog/BlogSearch.tsx" "tsx"

# Admin components
add_file_to_output "src/components/blog/admin/BlogPostEditor.tsx" "tsx"
add_file_to_output "src/components/blog/admin/BlogPostList.tsx" "tsx"
add_file_to_output "src/components/blog/admin/BlogCategoryManager.tsx" "tsx"
add_file_to_output "src/components/blog/admin/BlogTagManager.tsx" "tsx"
add_file_to_output "src/components/blog/admin/BlogMediaUploader.tsx" "tsx"

# Add summary at the end
cat >> "$OUTPUT_FILE" << EOF

---

## Summary

This document contains all the files created for the Supabase Blog CMS implementation.

### Completed Files:
- Database migration (018_blog_cms_tables.sql)
- Migration documentation (README_blog_migration.md)
- Seed data (seed_blog.sql)
- Implementation guide (SUPABASE_BLOG_CMS_IMPLEMENTATION_GUIDE.md)

### Pending Implementation:
- TypeScript types and services
- Frontend components
- Admin interface
- Advanced features (search, SEO, analytics)

Generated on: $TIMESTAMP
EOF

echo ""
echo "✅ Export complete! Check $OUTPUT_FILE"
echo ""
echo "File statistics:"
wc -l "$OUTPUT_FILE"