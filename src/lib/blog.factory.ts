import type {
  BlogPost,
  BlogPostRow,
  BlogAuthor,
  BlogAuthorRow,
  BlogCategory,
  BlogCategoryRow,
  BlogTag,
  BlogTagRow,
  BlogComment,
  BlogCommentRow,
  PostStatus,
  CommentStatus,
  PaginatedResponse,
  PaginationMeta,
  CreateBlogPostData,
  UpdateBlogPostData,
  BlogStatistics,
  PopularTag,
  BlogSEOMetadata,
  BlogPostFilters,
  GetBlogPostsParams,
} from '../types/blog'

// Utility functions for generating realistic data
const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
const generateSlug = (title: string): string => 
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const generateExcerpt = (content: string, maxLength = 150): string => 
  content.length > maxLength ? content.substring(0, maxLength) + '...' : content
const randomChoice = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)]
const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min
const randomBoolean = (): boolean => Math.random() > 0.5

// Sample data arrays
const sampleTitles = [
  'Getting Started with React and TypeScript',
  'Advanced State Management Patterns',
  'Building Scalable APIs with Node.js',
  'The Future of Web Development',
  'Mastering CSS Grid and Flexbox',
  'Database Design Best Practices',
  'Security in Modern Web Applications',
  'Performance Optimization Techniques',
  'Testing Strategies for Frontend Applications',
  'Microservices Architecture Guide',
]

const sampleContent = [
  'This is a comprehensive guide to building modern web applications with React and TypeScript. We\'ll cover everything from basic setup to advanced patterns and best practices.',
  'In this article, we explore various state management solutions including Redux, Zustand, and Context API. Learn when to use each approach and how to implement them effectively.',
  'Building scalable APIs requires careful planning and the right tools. This guide covers Node.js, Express, database integration, and deployment strategies.',
  'The web development landscape is constantly evolving. Let\'s look at emerging trends, new technologies, and what the future holds for developers.',
  'CSS Grid and Flexbox are powerful layout tools that every developer should master. This tutorial provides practical examples and real-world use cases.',
]

const sampleAuthors = [
  { name: 'Alice Johnson', bio: 'Senior Frontend Developer with 8 years of experience' },
  { name: 'Bob Smith', bio: 'Full-stack developer and tech blogger' },
  { name: 'Charlie Davis', bio: 'DevOps engineer and cloud architecture specialist' },
  { name: 'Diana Wilson', bio: 'UX/UI designer and frontend developer' },
  { name: 'Eve Brown', bio: 'Backend developer specializing in Node.js and Python' },
]

const sampleCategories = [
  { name: 'Frontend Development', description: 'Everything about frontend technologies' },
  { name: 'Backend Development', description: 'Server-side development topics' },
  { name: 'DevOps', description: 'Deployment, CI/CD, and infrastructure' },
  { name: 'Design', description: 'UI/UX design and user experience' },
  { name: 'Architecture', description: 'Software architecture and system design' },
]

const sampleTags = [
  'React', 'TypeScript', 'JavaScript', 'Node.js', 'CSS', 'HTML',
  'API', 'Database', 'Testing', 'Performance', 'Security', 'Docker',
  'AWS', 'Git', 'Webpack', 'Redux', 'GraphQL', 'REST', 'MongoDB', 'PostgreSQL',
]

// Factory functions for database row types
export const createBlogPostRow = (overrides: Partial<BlogPostRow> = {}): BlogPostRow => {
  const title = overrides.title || randomChoice(sampleTitles)
  const content = overrides.content || randomChoice(sampleContent)
  const now = new Date().toISOString()
  
  return {
    id: generateId(),
    title,
    slug: generateSlug(title),
    subtitle: randomBoolean() ? `Subtitle for ${title}` : null,
    content,
    content_sanitized: null, // Add required field
    excerpt: generateExcerpt(content),
    featured_image_url: randomBoolean() ? `https://picsum.photos/800/400?random=${Math.random()}` : null,
    status: randomChoice(['draft', 'published', 'archived'] as PostStatus[]),
    published_at: randomBoolean() ? now : null,
    view_count: randomInt(0, 10000),
    reading_time_minutes: randomInt(3, 15),
    metadata: randomBoolean() ? { featured: randomBoolean(), priority: randomInt(1, 5) } : null,
    search_vector: null, // Add required field
    author_id: generateId(),
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export const createBlogAuthorRow = (overrides: Partial<BlogAuthorRow> = {}): BlogAuthorRow => {
  const author = randomChoice(sampleAuthors)
  const now = new Date().toISOString()
  
  // const userId = generateId() // unused
  
  return {
    id: generateId(),
    display_name: author.name,
    email: `${author.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    bio: author.bio,
    avatar_url: `https://i.pravatar.cc/150?u=${Math.random()}`,
    social_links: {
      twitter: randomBoolean() ? `@${author.name.toLowerCase().replace(/\s+/g, '')}` : undefined,
      linkedin: randomBoolean() ? `linkedin.com/in/${author.name.toLowerCase().replace(/\s+/g, '-')}` : undefined,
      github: randomBoolean() ? `github.com/${author.name.toLowerCase().replace(/\s+/g, '')}` : undefined,
    }, // Remove type cast, it's already Json compatible
    storage_quota_mb: 100, // Add missing field
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export const createBlogCategoryRow = (overrides: Partial<BlogCategoryRow> = {}): BlogCategoryRow => {
  const category = randomChoice(sampleCategories)
  const now = new Date().toISOString()
  
  return {
    id: generateId(),
    name: category.name,
    slug: generateSlug(category.name),
    description: category.description,
    parent_id: randomBoolean() ? generateId() : null,
    display_order: randomInt(0, 100), // Changed from sort_order to display_order
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export const createBlogTagRow = (overrides: Partial<BlogTagRow> = {}): BlogTagRow => {
  const tagName = overrides.name || randomChoice(sampleTags)
  const now = new Date().toISOString()
  
  return {
    id: generateId(),
    name: tagName,
    slug: generateSlug(tagName),
    created_at: now,
    ...overrides,
  }
}

export const createBlogCommentRow = (overrides: Partial<BlogCommentRow> = {}): BlogCommentRow => {
  const now = new Date().toISOString()
  const authorNum = randomInt(1, 1000)
  
  return {
    id: generateId(),
    post_id: overrides.post_id || generateId(),
    author_name: `User ${authorNum}`,
    author_email: `user${authorNum}@example.com`,
    content: overrides.content || 'This is a sample comment with some meaningful content.',
    content_sanitized: null, // Add required field
    status: randomChoice(['pending', 'approved', 'spam', 'deleted'] as CommentStatus[]),
    parent_id: randomBoolean() ? generateId() : null,
    user_agent: 'Mozilla/5.0 (compatible; TestBot/1.0)',
    ip_address: `192.168.1.${randomInt(1, 254)}`,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

// Factory functions for extended types with relations
export const createBlogPost = (overrides: Partial<BlogPost> = {}): BlogPost => {
  const basePost = createBlogPostRow(overrides)
  
  return {
    ...basePost,
    author: overrides.author || (randomBoolean() ? createBlogAuthor() : undefined),
    categories: overrides.categories || (randomBoolean() ? [createBlogCategory(), createBlogCategory()] : undefined),
    tags: overrides.tags || (randomBoolean() ? Array.from({ length: randomInt(1, 4) }, () => createBlogTag()) : undefined),
    comments: overrides.comments || (randomBoolean() ? Array.from({ length: randomInt(0, 5) }, () => createBlogComment()) : undefined),
  }
}

export const createBlogAuthor = (overrides: Partial<BlogAuthor> = {}): BlogAuthor => {
  const baseAuthor = createBlogAuthorRow(overrides)
  
  return {
    ...baseAuthor,
    posts: overrides.posts,
    postsCount: overrides.postsCount || randomInt(0, 50),
    user: overrides.user || {
      id: generateId(),
      email: `${baseAuthor.display_name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      username: baseAuthor.display_name.toLowerCase().replace(/\s+/g, '_'),
    },
  }
}

export const createBlogCategory = (overrides: Partial<BlogCategory> = {}): BlogCategory => {
  const baseCategory = createBlogCategoryRow(overrides)
  
  return {
    ...baseCategory,
    posts: overrides.posts,
    postsCount: overrides.postsCount || randomInt(0, 100),
    parent: overrides.parent,
    children: overrides.children,
  }
}

export const createBlogTag = (overrides: Partial<BlogTag> = {}): BlogTag => {
  const baseTag = createBlogTagRow(overrides)
  
  return {
    ...baseTag,
    posts: overrides.posts,
    postsCount: overrides.postsCount || randomInt(0, 25),
  }
}

export const createBlogComment = (overrides: Partial<BlogComment> = {}): BlogComment => {
  const baseComment = createBlogCommentRow(overrides)
  
  return {
    ...baseComment,
    post: overrides.post,
    user: overrides.user || (baseComment.author_email ? {
      id: generateId(),
      email: baseComment.author_email,
      username: baseComment.author_name || 'Anonymous',
      avatar_url: `https://i.pravatar.cc/40?u=${Math.random()}`,
    } : undefined),
    parent: overrides.parent,
    replies: overrides.replies,
  }
}

// Factory functions for pagination and responses
export const createPaginationMeta = (overrides: Partial<PaginationMeta> = {}): PaginationMeta => {
  const page = overrides.page || 1
  const limit = overrides.limit || 10
  const total = overrides.total || randomInt(50, 500)
  const totalPages = Math.ceil(total / limit)
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    ...overrides,
  }
}

export const createPaginatedResponse = <T>(
  items: T[],
  metaOverrides: Partial<PaginationMeta> = {}
): PaginatedResponse<T> => {
  const meta = createPaginationMeta({
    total: items.length,
    ...metaOverrides,
  })
  
  return {
    data: items,
    meta,
  }
}

// Factory functions for request types
export const createBlogPostData = (overrides: Partial<CreateBlogPostData> = {}): CreateBlogPostData => {
  const title = overrides.title || randomChoice(sampleTitles)
  const content = overrides.content || randomChoice(sampleContent)
  
  return {
    title,
    subtitle: overrides.subtitle,
    content,
    excerpt: overrides.excerpt || generateExcerpt(content),
    featured_image_url: overrides.featured_image_url,
    status: overrides.status || 'draft',
    published_at: overrides.published_at,
    metadata: overrides.metadata,
    categoryIds: overrides.categoryIds || [generateId()],
    tagIds: overrides.tagIds || [generateId(), generateId()],
  }
}

export const createUpdateBlogPostData = (overrides: Partial<UpdateBlogPostData> = {}): UpdateBlogPostData => {
  return {
    id: overrides.id || generateId(),
    title: overrides.title,
    content: overrides.content,
    status: overrides.status,
    ...overrides,
  }
}

export const createBlogPostFilters = (overrides: Partial<BlogPostFilters> = {}): BlogPostFilters => {
  return {
    status: overrides.status,
    authorId: overrides.authorId,
    categoryId: overrides.categoryId,
    categorySlug: overrides.categorySlug,
    tagId: overrides.tagId,
    tagSlug: overrides.tagSlug,
    search: overrides.search,
    startDate: overrides.startDate,
    endDate: overrides.endDate,
  }
}

export const createGetBlogPostsParams = (overrides: Partial<GetBlogPostsParams> = {}): GetBlogPostsParams => {
  return {
    page: overrides.page || 1,
    limit: overrides.limit || 10,
    offset: overrides.offset,
    filters: overrides.filters,
    sort: overrides.sort,
    includeAuthor: overrides.includeAuthor,
    includeCategories: overrides.includeCategories,
    includeTags: overrides.includeTags,
  }
}

// Factory functions for statistics and metadata
export const createBlogStatistics = (overrides: Partial<BlogStatistics> = {}): BlogStatistics => {
  const totalPosts = overrides.totalPosts || randomInt(50, 500)
  const publishedPosts = overrides.publishedPosts || randomInt(Math.floor(totalPosts * 0.6), totalPosts)
  const draftPosts = totalPosts - publishedPosts
  
  return {
    totalPosts,
    publishedPosts,
    draftPosts,
    totalViews: overrides.totalViews || randomInt(1000, 100000),
    totalComments: overrides.totalComments || randomInt(100, 5000),
    avgReadingTime: overrides.avgReadingTime || randomInt(3, 12),
  }
}

export const createPopularTag = (overrides: Partial<PopularTag> = {}): PopularTag => {
  const name = overrides.name || randomChoice(sampleTags)
  
  return {
    id: overrides.id || generateId(),
    name,
    slug: overrides.slug || generateSlug(name),
    count: overrides.count || randomInt(1, 50),
  }
}

export const createBlogSEOMetadata = (overrides: Partial<BlogSEOMetadata> = {}): BlogSEOMetadata => {
  return {
    title: overrides.title,
    description: overrides.description,
    keywords: overrides.keywords || randomChoice(sampleTags.map(tag => [tag, randomChoice(sampleTags)])),
    ogImage: overrides.ogImage,
    ogTitle: overrides.ogTitle,
    ogDescription: overrides.ogDescription,
    canonicalUrl: overrides.canonicalUrl,
    noIndex: overrides.noIndex || false,
    noFollow: overrides.noFollow || false,
  }
}

// Batch factory functions
export const createBlogPosts = (count: number, overrides: Partial<BlogPost> = {}): BlogPost[] => {
  return Array.from({ length: count }, (_, index) => 
    createBlogPost({ ...overrides, title: `${overrides.title || 'Blog Post'} ${index + 1}` })
  )
}

export const createBlogAuthors = (count: number, overrides: Partial<BlogAuthor> = {}): BlogAuthor[] => {
  return Array.from({ length: count }, (_, index) => 
    createBlogAuthor({ ...overrides, display_name: `Author ${index + 1}` })
  )
}

export const createBlogCategories = (count: number, overrides: Partial<BlogCategory> = {}): BlogCategory[] => {
  return Array.from({ length: count }, (_, index) => 
    createBlogCategory({ ...overrides, name: `Category ${index + 1}` })
  )
}

export const createBlogTags = (count: number, overrides: Partial<BlogTag> = {}): BlogTag[] => {
  return Array.from({ length: count }, (_, index) => 
    createBlogTag({ ...overrides, name: `Tag${index + 1}` })
  )
}

export const createBlogComments = (count: number, postId: string, overrides: Partial<BlogComment> = {}): BlogComment[] => {
  return Array.from({ length: count }, () => 
    createBlogComment({ ...overrides, post_id: postId })
  )
}

// Special factory for creating realistic blog post hierarchies
export const createBlogPostHierarchy = (
  postsCount = 10,
  authorsCount = 3,
  categoriesCount = 5,
  tagsCount = 8
) => {
  const authors = createBlogAuthors(authorsCount)
  const categories = createBlogCategories(categoriesCount)
  const tags = createBlogTags(tagsCount)
  
  const posts = Array.from({ length: postsCount }, () => {
    const author = randomChoice(authors)
    const postCategories = Array.from(
      { length: randomInt(1, 3) }, 
      () => randomChoice(categories)
    )
    const postTags = Array.from(
      { length: randomInt(1, 4) }, 
      () => randomChoice(tags)
    )
    
    return createBlogPost({
      author,
      categories: postCategories,
      tags: postTags,
      comments: Array.from(
        { length: randomInt(0, 5) }, 
        () => createBlogComment()
      ),
    })
  })
  
  return {
    posts,
    authors,
    categories,
    tags,
  }
}