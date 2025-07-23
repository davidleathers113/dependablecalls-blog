import { Link } from 'react-router-dom'
import { CalendarIcon, UserIcon, ClockIcon } from '@heroicons/react/24/outline'

const blogPosts = [
  {
    id: 1,
    title: 'Getting Started with Pay-Per-Call Marketing',
    excerpt: 'Learn the fundamentals of pay-per-call marketing and how to maximize your ROI with quality traffic sources.',
    author: 'Sarah Johnson',
    date: 'January 15, 2025',
    readTime: '5 min read',
    category: 'Getting Started',
    slug: 'getting-started-pay-per-call',
  },
  {
    id: 2,
    title: 'Top 10 Traffic Sources for Call Campaigns',
    excerpt: 'Discover the most effective traffic sources for driving high-quality calls to your campaigns in 2025.',
    author: 'Mike Chen',
    date: 'January 10, 2025',
    readTime: '8 min read',
    category: 'Traffic Sources',
    slug: 'top-traffic-sources-2025',
  },
  {
    id: 3,
    title: 'Fraud Prevention: Protecting Your Campaigns',
    excerpt: 'Essential strategies and tools for detecting and preventing fraud in your pay-per-call campaigns.',
    author: 'Emily Rodriguez',
    date: 'January 5, 2025',
    readTime: '6 min read',
    category: 'Security',
    slug: 'fraud-prevention-strategies',
  },
  {
    id: 4,
    title: 'Optimizing Call Quality with Advanced Analytics',
    excerpt: 'How to use data-driven insights to improve call quality and increase conversion rates.',
    author: 'David Thompson',
    date: 'December 28, 2024',
    readTime: '7 min read',
    category: 'Analytics',
    slug: 'optimizing-call-quality',
  },
]

export default function BlogPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
              Blog
            </h1>
            <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">
              Insights, tips, and best practices for pay-per-call marketing success
            </p>
          </div>
        </div>
      </div>

      {/* Blog Posts */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {blogPosts.map((post) => (
            <article key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-center text-sm text-gray-500 mb-4">
                  <span className="bg-primary-100 text-primary-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {post.category}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  <Link to={`/blog/${post.slug}`} className="hover:text-primary-600">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 mb-4">
                  {post.excerpt}
                </p>
                <div className="flex items-center text-sm text-gray-500 space-x-4">
                  <div className="flex items-center">
                    <UserIcon className="h-4 w-4 mr-1" />
                    {post.author}
                  </div>
                  <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {post.date}
                  </div>
                  <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {post.readTime}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Pagination */}
        <div className="mt-12 flex justify-center">
          <nav className="flex items-center space-x-2">
            <button className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Previous
            </button>
            <button className="px-3 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md">
              1
            </button>
            <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              2
            </button>
            <button className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              3
            </button>
            <button className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Next
            </button>
          </nav>
        </div>
      </div>

      {/* Newsletter CTA */}
      <div className="bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Stay updated with our newsletter
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Get the latest insights and tips delivered to your inbox weekly.
            </p>
            <form className="mt-8 sm:flex sm:justify-center">
              <input
                type="email"
                className="w-full px-5 py-3 border border-gray-300 shadow-sm placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:max-w-xs rounded-md"
                placeholder="Enter your email"
              />
              <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}