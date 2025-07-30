/**
 * Hook to generate FAQ structured data for blog posts
 */
export function useFAQStructuredData(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/**
 * Hook to generate How-to structured data for tutorial blog posts
 */
export function useHowToStructuredData(
  title: string,
  description: string,
  steps: Array<{ name: string; text: string; image?: string }>,
  totalTime?: string,
  estimatedCost?: { currency: string; value: string }
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    description: description,
    ...(totalTime && { totalTime }),
    ...(estimatedCost && { estimatedCost }),
    supply: [],
    tool: [],
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image && {
        image: {
          '@type': 'ImageObject',
          url: step.image
        }
      })
    }))
  };
}

/**
 * Hook to generate Article series structured data
 */
export function useArticleSeriesStructuredData(
  seriesName: string,
  articles: Array<{ title: string; url: string; position: number }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: seriesName,
    numberOfItems: articles.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: articles.map(article => ({
      '@type': 'ListItem',
      position: article.position,
      name: article.title,
      url: article.url
    }))
  };
}