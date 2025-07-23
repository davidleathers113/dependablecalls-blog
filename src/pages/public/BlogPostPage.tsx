import { useParams, Link, Navigate } from 'react-router-dom'
import { CalendarIcon, UserIcon, ClockIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { blogPosts } from '../../data/blogPosts'

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()

  // Find the blog post by slug
  const post = blogPosts.find((p) => p.slug === slug)

  // If post not found, redirect to blog page
  if (!post) {
    return <Navigate to="/blog" replace />
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Back to Blog */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link
          to="/blog"
          className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back to Blog
        </Link>
      </div>

      {/* Article Header */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="mb-4">
            <span className="bg-primary-100 text-primary-800 text-sm font-medium px-3 py-1 rounded-full">
              {post.category}
            </span>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-6 leading-tight">{post.title}</h1>

          <div className="flex items-center text-sm text-gray-500 space-x-6 mb-6">
            <div className="flex items-center">
              <UserIcon className="h-5 w-5 mr-2" />
              {post.author}
            </div>
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              {post.date}
            </div>
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 mr-2" />
              {post.readTime}
            </div>
          </div>

          <p className="text-xl text-gray-600 leading-relaxed">{post.excerpt}</p>
        </header>

        {/* Article Content */}
        <div className="prose prose-lg prose-primary max-w-none">
          <div
            dangerouslySetInnerHTML={{
              __html: post.content
                .split('\n')
                .map((line) => {
                  if (line.startsWith('# ')) {
                    return `<h1 class="text-3xl font-bold text-gray-900 mt-8 mb-4">${line.substring(2)}</h1>`
                  }
                  if (line.startsWith('## ')) {
                    return `<h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">${line.substring(3)}</h2>`
                  }
                  if (line.startsWith('### ')) {
                    return `<h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">${line.substring(4)}</h3>`
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return `<p class="font-semibold text-gray-900 mt-4 mb-2">${line.substring(2, line.length - 2)}</p>`
                  }
                  if (line.includes('**') && line.includes(':**')) {
                    const parts = line.split('**')
                    if (parts.length >= 3) {
                      return `<p class="mt-4 mb-2"><strong class="font-semibold text-gray-900">${parts[1]}:</strong> ${parts[2]}</p>`
                    }
                  }
                  if (line.startsWith('- ')) {
                    return `<li class="mb-1">${line.substring(2)}</li>`
                  }
                  if (line.trim() === '') {
                    return '<br>'
                  }
                  if (line.startsWith('```')) {
                    if (line.length > 3) {
                      return `<div class="bg-gray-100 rounded-lg p-4 my-4 font-mono text-sm">${line.substring(3)}</div>`
                    }
                    return '<pre class="bg-gray-100 rounded-lg p-4 my-4 font-mono text-sm overflow-x-auto">'
                  }
                  return `<p class="mb-4 leading-relaxed">${line}</p>`
                })
                .join('')
                .replace(
                  /<li class="mb-1">/g,
                  '<ul class="list-disc list-inside space-y-1 mb-4"><li class="mb-1">'
                )
                .replace(/<\/li>(\s*<p|$)/g, '</li></ul>$1'),
            }}
          />
        </div>

        {/* Article Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Published on {post.date} by {post.author}
            </div>
            <Link
              to="/blog"
              className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
            >
              Read more articles
            </Link>
          </div>
        </footer>
      </article>

      {/* Related Articles */}
      <div className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Related Articles</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {blogPosts
              .filter((p) => p.id !== post.id && p.category === post.category)
              .slice(0, 2)
              .map((relatedPost) => (
                <div key={relatedPost.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="mb-3">
                    <span className="bg-primary-100 text-primary-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      {relatedPost.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    <Link to={`/blog/${relatedPost.slug}`} className="hover:text-primary-600">
                      {relatedPost.title}
                    </Link>
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">{relatedPost.excerpt}</p>
                  <div className="flex items-center text-xs text-gray-500 space-x-4">
                    <span>{relatedPost.author}</span>
                    <span>{relatedPost.readTime}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
