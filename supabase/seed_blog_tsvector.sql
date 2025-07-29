-- =====================================================
-- Blog CMS Seed Data for TSVector Word Count Testing
-- =====================================================
-- This file contains sample data specifically designed to test
-- the new tsvector-based word counting system
-- Run after migration: psql $DATABASE_URL -f seed_blog_tsvector.sql
-- =====================================================

-- Create test users if they don't exist
DO $$
DECLARE
  admin_user_id UUID;
  author1_id UUID;
  author2_id UUID;
  test_user_id UUID;
BEGIN
  -- Create admin user
  INSERT INTO users (id, email, name, role)
  VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@dependablecalls.com', 'Admin User', 'admin')
  ON CONFLICT (id) DO NOTHING;
  
  admin_user_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  
  -- Create author users
  INSERT INTO users (id, email, name, role)
  VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'john@dependablecalls.com', 'John Doe', 'supplier'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'jane@dependablecalls.com', 'Jane Smith', 'supplier'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'testuser@example.com', 'Test User', 'supplier')
  ON CONFLICT (id) DO NOTHING;
  
  author1_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
  author2_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13';
  test_user_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14';
  
  -- Create admin record
  INSERT INTO admins (user_id, created_at)
  VALUES (admin_user_id, NOW())
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- Create blog authors
INSERT INTO blog_authors (id, user_id, display_name, bio, avatar_url, social_links)
VALUES 
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Admin Team',
    'The Dependable Calls admin team manages platform updates and announcements.',
    'https://ui-avatars.com/api/?name=Admin+Team&background=3B82F6&color=fff',
    '{"twitter": "@dependablecalls", "linkedin": "dependablecalls"}'::jsonb
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'John Doe',
    'John is a pay-per-call expert with over 10 years of experience in affiliate marketing.',
    'https://ui-avatars.com/api/?name=John+Doe&background=10B981&color=fff',
    '{"twitter": "@johndoe", "linkedin": "john-doe"}'::jsonb
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'Jane Smith',
    'Jane specializes in lead generation strategies and conversion optimization.',
    'https://ui-avatars.com/api/?name=Jane+Smith&background=F59E0B&color=fff',
    '{"twitter": "@janesmith", "linkedin": "jane-smith"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Clear existing test posts for clean seed
DELETE FROM blog_post_tags WHERE post_id IN (
  SELECT id FROM blog_posts WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%'
);
DELETE FROM blog_post_categories WHERE post_id IN (
  SELECT id FROM blog_posts WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%'
);
DELETE FROM blog_comments WHERE post_id IN (
  SELECT id FROM blog_posts WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%'
);
DELETE FROM blog_posts WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%';

-- Test Post 1: Very Short Post
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count
)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
    'short-post-test',
    'Short Post Test',
    'Testing minimum word count',
    E'Quick update.',
    'A very short post to test edge cases.',
    NULL,
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'published',
    NOW() - INTERVAL '1 day',
    '{"test_type": "short_post"}'::jsonb,
    5
  );

-- Test Post 2: Normal Content with Markdown
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count
)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02',
    'standard-markdown-post',
    'Standard Markdown Post',
    'Testing typical blog content',
    E'# Understanding Pay-Per-Call Marketing\n\nPay-per-call marketing has become increasingly popular in recent years. This performance-based advertising model offers unique advantages for both advertisers and publishers.\n\n## Key Benefits\n\n### For Advertisers\n- **High Intent Leads**: Phone calls indicate serious buyer intent\n- **Real-time Connection**: Instant customer engagement\n- **Better Conversion Rates**: Phone leads convert 10x better than web forms\n\n### For Publishers\n- **Higher Payouts**: Call leads command premium prices\n- **Diverse Verticals**: Works across many industries\n- **No Landing Pages**: Simplified campaign setup\n\n## Common Verticals\n\n1. **Home Services**\n   - Plumbing repairs\n   - HVAC installation\n   - Roofing contractors\n\n2. **Legal Services**\n   - Personal injury attorneys\n   - Bankruptcy lawyers\n   - Criminal defense\n\n3. **Insurance**\n   - Auto insurance quotes\n   - Health insurance plans\n   - Life insurance policies\n\n## Best Practices\n\nWhen running pay-per-call campaigns, consider these tips:\n\n> "Quality over quantity always wins in pay-per-call. Focus on generating calls from genuinely interested prospects rather than high volume." - Industry Expert\n\n### Campaign Optimization\n\n- Target specific geographic areas\n- Use compelling call-to-action phrases\n- Test different times of day\n- Monitor call duration metrics\n- Track conversion rates carefully\n\n## Conclusion\n\nPay-per-call marketing offers tremendous opportunities for growth. By understanding the fundamentals and following best practices, you can build successful campaigns that deliver results for all parties involved.',
    'A comprehensive guide to pay-per-call marketing fundamentals and best practices.',
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'published',
    NOW() - INTERVAL '2 days',
    '{"test_type": "standard_content"}'::jsonb,
    42
  );

-- Test Post 3: Code-Heavy Technical Post
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count
)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03',
    'api-integration-guide',
    'API Integration Guide',
    'Technical implementation details',
    E'# Dependable Calls API Integration\n\nThis guide covers how to integrate with our API for tracking calls programmatically.\n\n## Authentication\n\nFirst, obtain your API credentials from the dashboard. You''ll need your API key for all requests.\n\n```javascript\n// Initialize the API client\nconst DependableCalls = require(''@dependablecalls/sdk'');\n\nconst client = new DependableCalls({\n  apiKey: process.env.DC_API_KEY,\n  environment: ''production''\n});\n```\n\n## Tracking Calls\n\nHere''s how to track inbound calls:\n\n```javascript\n// Track a new call\nasync function trackCall(callData) {\n  try {\n    const response = await client.calls.create({\n      from: callData.callerNumber,\n      to: callData.trackingNumber,\n      duration: callData.duration,\n      recordingUrl: callData.recordingUrl,\n      metadata: {\n        source: callData.source,\n        campaign: callData.campaignId\n      }\n    });\n    \n    console.log(''Call tracked:'', response.id);\n    return response;\n  } catch (error) {\n    console.error(''Error tracking call:'', error);\n    throw error;\n  }\n}\n```\n\n## Webhook Configuration\n\nSet up webhooks to receive real-time notifications:\n\n```javascript\n// Express webhook handler\napp.post(''/webhooks/calls'', async (req, res) => {\n  const signature = req.headers[''x-dc-signature''];\n  \n  // Verify webhook signature\n  if (!client.webhooks.verify(req.body, signature)) {\n    return res.status(401).send(''Invalid signature'');\n  }\n  \n  // Process the webhook event\n  const event = req.body;\n  \n  switch (event.type) {\n    case ''call.completed'':\n      await handleCallCompleted(event.data);\n      break;\n    case ''call.failed'':\n      await handleCallFailed(event.data);\n      break;\n    default:\n      console.log(''Unknown event type:'', event.type);\n  }\n  \n  res.status(200).send(''OK'');\n});\n```\n\n## Error Handling\n\nAlways implement proper error handling:\n\n```javascript\nclass CallTrackingService {\n  async processCall(callData) {\n    const maxRetries = 3;\n    let attempts = 0;\n    \n    while (attempts < maxRetries) {\n      try {\n        const result = await this.trackCall(callData);\n        return result;\n      } catch (error) {\n        attempts++;\n        \n        if (error.code === ''RATE_LIMIT'') {\n          // Wait before retrying\n          await this.delay(Math.pow(2, attempts) * 1000);\n          continue;\n        }\n        \n        // Log error and throw\n        console.error(`Attempt ${attempts} failed:`, error);\n        \n        if (attempts === maxRetries) {\n          throw new Error(`Failed after ${maxRetries} attempts`);\n        }\n      }\n    }\n  }\n  \n  delay(ms) {\n    return new Promise(resolve => setTimeout(resolve, ms));\n  }\n}\n```\n\n## Performance Considerations\n\nFor high-volume integrations, consider these optimizations:\n\n1. Use connection pooling\n2. Implement request batching\n3. Cache frequently accessed data\n4. Use async/await for better flow control\n\n## Summary\n\nThis covers the basics of API integration. For more details, check our full API documentation.',
    'Learn how to integrate with the Dependable Calls API for programmatic call tracking.',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'published',
    NOW() - INTERVAL '3 days',
    '{"test_type": "code_heavy"}'::jsonb,
    78
  );

-- Test Post 4: Mixed Content with Lists and Tables
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count
)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04',
    'campaign-performance-metrics',
    'Campaign Performance Metrics Guide',
    'Understanding key metrics for success',
    E'# Campaign Performance Metrics\n\nTracking the right metrics is crucial for pay-per-call success. This guide covers the essential KPIs you should monitor.\n\n## Core Metrics Overview\n\n| Metric | Description | Target Range |\n|--------|-------------|-------------|\n| Answer Rate | Percentage of calls answered | 85-95% |\n| Call Duration | Average length of calls | 90+ seconds |\n| Conversion Rate | Calls that convert to sales | 15-25% |\n| Cost Per Call | Average cost to generate a call | Varies by vertical |\n| ROI | Return on investment | 200%+ |\n\n## Detailed Metric Analysis\n\n### 1. Call Volume Metrics\n\n**Daily Call Volume**\n- Track trends over time\n- Identify peak hours\n- Plan staffing accordingly\n\n**Unique Callers**\n- Measure reach effectiveness\n- Detect duplicate calls\n- Calculate true audience size\n\n### 2. Quality Metrics\n\n**Call Duration Distribution:**\n- 0-30 seconds: 15% (likely wrong numbers)\n- 31-90 seconds: 25% (information seekers)\n- 91-180 seconds: 35% (qualified prospects)\n- 180+ seconds: 25% (high-intent buyers)\n\n### 3. Financial Metrics\n\n```\nRevenue Per Call = Total Revenue / Total Calls\nProfit Margin = (Revenue - Costs) / Revenue × 100\nCustomer Lifetime Value = Avg Order Value × Purchase Frequency × Customer Lifespan\n```\n\n## Advanced Analytics\n\n### Geographic Performance\n\n1. **Top Performing States:**\n   - California: 23% of calls\n   - Texas: 18% of calls\n   - Florida: 15% of calls\n   - New York: 12% of calls\n   - Others: 32% of calls\n\n### Time-of-Day Analysis\n\n- **Morning (6am-12pm)**: High intent, lower volume\n- **Afternoon (12pm-5pm)**: Peak volume, moderate intent\n- **Evening (5pm-9pm)**: High conversion rates\n- **Night (9pm-6am)**: Low volume, emergency services\n\n## Optimization Strategies\n\n### A/B Testing Elements:\n\n- [ ] Call-to-action wording\n- [ ] Phone number placement\n- [ ] Color schemes\n- [ ] Urgency indicators\n- [ ] Trust signals\n\n### Performance Benchmarks by Industry:\n\n**Home Services:**\n- Answer rate: 90%+\n- Avg duration: 3-5 minutes\n- Conversion: 20-30%\n\n**Legal Services:**\n- Answer rate: 95%+\n- Avg duration: 5-10 minutes\n- Conversion: 10-15%\n\n**Insurance:**\n- Answer rate: 85%+\n- Avg duration: 8-12 minutes\n- Conversion: 15-20%\n\n## Reporting Best Practices\n\n1. **Daily Reports Should Include:**\n   - Call volume\n   - Answer rate\n   - Average duration\n   - Top traffic sources\n\n2. **Weekly Analysis:**\n   - Conversion trends\n   - Cost per acquisition\n   - Partner performance\n   - Quality scores\n\n3. **Monthly Reviews:**\n   - ROI analysis\n   - Campaign optimization opportunities\n   - Competitive benchmarking\n   - Strategic planning\n\n## Tools and Technology\n\n### Recommended Analytics Platforms:\n\n- **Dependable Calls Dashboard**: Real-time metrics\n- **Google Analytics**: Traffic analysis\n- **Call Tracking Software**: Detailed call data\n- **CRM Integration**: Full funnel visibility\n\n## Conclusion\n\nConsistent tracking and analysis of these metrics will help you optimize campaigns and maximize ROI. Remember, what gets measured gets improved!',
    'A comprehensive guide to tracking and optimizing pay-per-call campaign performance metrics.',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'published',
    NOW() - INTERVAL '4 days',
    '{"test_type": "mixed_content"}'::jsonb,
    156
  );

-- Test Post 5: Very Long Post
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count
)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05',
    'complete-guide-pay-per-call',
    'The Complete Guide to Pay-Per-Call Marketing',
    'Everything you need to know about pay-per-call',
    E'# The Complete Guide to Pay-Per-Call Marketing\n\nPay-per-call marketing has revolutionized the performance marketing landscape. This comprehensive guide covers everything you need to know to succeed in this dynamic industry.\n\n## Table of Contents\n\n1. Introduction to Pay-Per-Call\n2. How Pay-Per-Call Works\n3. Key Players in the Ecosystem\n4. Setting Up Campaigns\n5. Traffic Sources\n6. Optimization Strategies\n7. Compliance and Regulations\n8. Technology and Tools\n9. Case Studies\n10. Future Trends\n\n## Chapter 1: Introduction to Pay-Per-Call\n\nPay-per-call is a performance marketing model where advertisers pay publishers for qualified phone calls. Unlike traditional advertising where you pay for impressions or clicks, pay-per-call ensures you only pay for actual phone conversations with potential customers.\n\n### The Evolution of Pay-Per-Call\n\nThe pay-per-call model emerged in the early 2000s as businesses recognized the value of phone leads. Initially dominated by directory services, the industry has evolved to encompass sophisticated tracking technology, real-time bidding, and AI-powered optimization.\n\n### Why Pay-Per-Call Matters\n\nPhone calls remain the highest converting form of lead generation:\n\n- **65% of customers** prefer to contact businesses by phone\n- **Phone leads convert 10-15x** higher than web leads\n- **Average order values** are 28% higher for phone orders\n- **Customer satisfaction** rates are higher with phone interactions\n\n## Chapter 2: How Pay-Per-Call Works\n\n### The Basic Flow\n\n1. **Publisher generates call**: Through various marketing channels\n2. **Call routes through platform**: Tracking and qualification occurs\n3. **Call connects to buyer**: If it meets criteria\n4. **Transaction recorded**: Duration and quality verified\n5. **Payment processed**: Publisher compensated for valid call\n\n### Key Components\n\n#### Tracking Numbers\n\nDynamic phone numbers are the backbone of pay-per-call:\n\n```\nLocal Numbers: (555) 123-4567\nToll-Free: 1-800-EXAMPLE\nVanity Numbers: 1-800-LAWYERS\n```\n\n#### Call Routing\n\nSophisticated routing ensures calls reach the right buyer:\n\n- Geographic routing\n- Time-based routing\n- Skill-based routing\n- Priority routing\n- Overflow routing\n\n#### Recording and Compliance\n\nAll calls must be recorded for quality assurance:\n\n- Compliance verification\n- Dispute resolution\n- Training purposes\n- Quality scoring\n\n## Chapter 3: Key Players in the Ecosystem\n\n### Publishers (Affiliates)\n\nPublishers generate calls through various marketing efforts:\n\n**Types of Publishers:**\n- Digital marketers\n- Media buyers\n- SEO specialists\n- Content creators\n- App developers\n\n**Publisher Responsibilities:**\n- Generate quality traffic\n- Follow compliance guidelines\n- Optimize campaigns\n- Maintain transparency\n\n### Advertisers (Buyers)\n\nBusinesses that need phone leads:\n\n**Common Advertiser Verticals:**\n- Home services\n- Legal services\n- Insurance\n- Healthcare\n- Financial services\n- Education\n- Travel\n\n### Networks and Platforms\n\nIntermediaries that connect publishers and advertisers:\n\n**Platform Services:**\n- Call tracking\n- Real-time reporting\n- Fraud prevention\n- Payment processing\n- Compliance tools\n\n## Chapter 4: Setting Up Campaigns\n\n### Campaign Planning\n\n#### Define Your Goals\n\n- Target cost per acquisition\n- Daily/monthly call volume\n- Geographic coverage\n- Business hours coverage\n\n#### Select Your Vertical\n\nChoose verticals based on:\n\n1. **Market demand**\n2. **Payout potential**\n3. **Competition level**\n4. **Compliance requirements**\n5. **Your expertise**\n\n### Campaign Configuration\n\n#### Basic Settings\n\n```yaml\nCampaign Name: "Home Services - Plumbing - California"\nVertical: Home Services\nSub-vertical: Plumbing\nGeo-targets: California (All Cities)\nBusiness Hours: Mon-Fri 7am-7pm, Sat 8am-5pm\nMin Call Duration: 90 seconds\nPayout: $35 per qualified call\n```\n\n#### Advanced Filters\n\n- Caller age requirements\n- Income demographics\n- Property ownership\n- Insurance status\n- Previous purchase history\n\n### Creative Development\n\n#### Landing Pages\n\nEffective landing pages include:\n\n- Clear value proposition\n- Prominent phone number\n- Trust indicators\n- Urgency elements\n- Mobile optimization\n\n#### Ad Copy\n\nCompelling ad copy focuses on:\n\n- Problem identification\n- Solution benefits\n- Call-to-action\n- Credibility markers\n- Special offers\n\n## Chapter 5: Traffic Sources\n\n### Paid Search (PPC)\n\n**Google Ads Best Practices:**\n\n- Use call-only campaigns\n- Implement call extensions\n- Target high-intent keywords\n- Optimize for mobile\n- Track offline conversions\n\n**Keyword Research:**\n\n```\nHigh Intent Keywords:\n- "plumber near me"\n- "emergency plumber [city]"\n- "24 hour plumber"\n- "plumbing repair service"\n```\n\n### Search Engine Optimization (SEO)\n\n**Local SEO Strategies:**\n\n1. Google My Business optimization\n2. Local directory submissions\n3. Schema markup implementation\n4. Review generation\n5. Local content creation\n\n### Social Media Marketing\n\n**Facebook Ads:**\n- Lookalike audiences\n- Interest targeting\n- Behavioral targeting\n- Retargeting campaigns\n\n**Other Platforms:**\n- Instagram Stories\n- LinkedIn (B2B)\n- YouTube pre-roll\n- TikTok (emerging)\n\n### Display Advertising\n\n**Native Advertising:**\n- Content recommendation\n- In-feed placements\n- Contextual targeting\n\n**Banner Campaigns:**\n- Programmatic buying\n- Retargeting pixels\n- Geo-fencing\n\n## Chapter 6: Optimization Strategies\n\n### Data Analysis\n\n#### Key Metrics to Track\n\n| Metric | Formula | Target |\n|--------|---------|--------|\n| Conversion Rate | Qualified Calls / Total Calls × 100 | >20% |\n| Average Call Duration | Total Duration / Number of Calls | >120 sec |\n| Cost Per Call | Total Spend / Qualified Calls | <$30 |\n| ROI | (Revenue - Cost) / Cost × 100 | >150% |\n\n### A/B Testing\n\n**Elements to Test:**\n\n- Headlines\n- Call-to-actions\n- Phone number placement\n- Color schemes\n- Form fields\n- Trust badges\n- Urgency indicators\n\n### Quality Optimization\n\n**Pre-qualification Methods:**\n\n1. **IVR Systems**: Interactive voice response\n2. **Call Whispers**: Pre-connection messages\n3. **Screening Questions**: Automated qualification\n4. **Time Filters**: Business hours only\n5. **Geo Verification**: Caller location check\n\n## Chapter 7: Compliance and Regulations\n\n### TCPA Compliance\n\n**Key Requirements:**\n\n- Express written consent\n- Clear disclosures\n- Opt-out mechanisms\n- Record retention\n- Time restrictions\n\n### State Regulations\n\n**California (strictest):**\n- Additional consent requirements\n- Enhanced privacy rights\n- Specific disclosure language\n\n**Florida:**\n- Call recording notifications\n- Marketing restrictions\n- License requirements\n\n### Industry Standards\n\n**Best Practices:**\n\n1. Transparent pricing\n2. Honest advertising\n3. Quality assurance\n4. Dispute resolution\n5. Data protection\n\n## Chapter 8: Technology and Tools\n\n### Call Tracking Platforms\n\n**Essential Features:**\n\n- Dynamic number insertion\n- Call recording\n- Real-time analytics\n- API integration\n- Multi-channel attribution\n\n### Analytics and Reporting\n\n**Dashboard Requirements:**\n\n```javascript\nconst dashboardMetrics = {\n  realTime: {\n    activeCalls: count,\n    callsToday: total,\n    revenue: sum,\n    topSources: array\n  },\n  historical: {\n    dailyTrends: graph,\n    weeklyComparison: chart,\n    monthlyROI: calculation,\n    sourcePerformance: table\n  }\n};\n```\n\n### Integration Tools\n\n**CRM Integration:**\n- Salesforce\n- HubSpot\n- Pipedrive\n- Custom APIs\n\n**Marketing Platforms:**\n- Google Ads\n- Facebook Business\n- Email systems\n- SMS platforms\n\n## Chapter 9: Case Studies\n\n### Case Study 1: Home Services Success\n\n**Background:**\nA plumbing company increased leads by 300% using pay-per-call.\n\n**Strategy:**\n- Focused on emergency keywords\n- 24/7 call coverage\n- Mobile-first approach\n- Local SEO optimization\n\n**Results:**\n- 300% increase in calls\n- 45% reduction in cost per lead\n- 25% higher conversion rate\n- $2.5M additional revenue\n\n### Case Study 2: Legal Services Transformation\n\n**Background:**\nPersonal injury law firm expanded nationally through pay-per-call.\n\n**Implementation:**\n- State-by-state rollout\n- Compliance-first approach\n- Quality over quantity\n- Partner network development\n\n**Outcomes:**\n- 50 state coverage achieved\n- 200+ daily qualified calls\n- 18% conversion rate\n- 350% ROI\n\n## Chapter 10: Future Trends\n\n### Artificial Intelligence\n\n**AI Applications:**\n\n1. **Call Scoring**: Automated quality assessment\n2. **Predictive Routing**: ML-based matching\n3. **Voice Analytics**: Sentiment analysis\n4. **Fraud Detection**: Pattern recognition\n5. **Optimization**: Automated bidding\n\n### Voice Technology\n\n**Emerging Technologies:**\n\n- Voice search optimization\n- Smart speaker integration\n- Conversational AI\n- Voice biometrics\n- Real-time translation\n\n### Market Evolution\n\n**Industry Predictions:**\n\n- Market size: $15B by 2025\n- Mobile-first dominance\n- Video call integration\n- Blockchain verification\n- Global expansion\n\n## Conclusion\n\nPay-per-call marketing represents one of the most effective performance marketing channels available today. Success requires understanding the ecosystem, implementing best practices, maintaining compliance, and continuously optimizing based on data.\n\n### Key Takeaways\n\n1. **Quality over Quantity**: Focus on generating high-intent calls\n2. **Compliance First**: Always prioritize regulatory requirements\n3. **Data-Driven Decisions**: Let metrics guide optimization\n4. **Continuous Learning**: Stay updated with industry changes\n5. **Partnership Approach**: Build strong relationships\n\n### Getting Started Checklist\n\n- [ ] Choose your vertical\n- [ ] Research competition\n- [ ] Set up tracking\n- [ ] Create campaigns\n- [ ] Launch traffic\n- [ ] Monitor performance\n- [ ] Optimize continuously\n- [ ] Scale successful campaigns\n\n### Resources\n\n**Industry Associations:**\n- Performance Marketing Association\n- Contact Center Association\n- Digital Marketing Institute\n\n**Educational Resources:**\n- Webinars and conferences\n- Online courses\n- Industry publications\n- Networking groups\n\n**Tools and Services:**\n- Call tracking providers\n- Analytics platforms\n- Compliance services\n- Consulting firms\n\nThe pay-per-call industry continues to grow and evolve. By mastering the fundamentals covered in this guide and staying adaptive to change, you can build a successful and profitable pay-per-call business. Remember, success in pay-per-call comes from delivering value to all parties: publishers, advertisers, and most importantly, the consumers making the calls.',
    'A comprehensive 3000+ word guide covering all aspects of pay-per-call marketing.',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1600&h=900&fit=crop',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'published',
    NOW() - INTERVAL '5 days',
    '{"test_type": "very_long_post"}'::jsonb,
    523
  );

-- Test Post 6: Code Blocks Only
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count
)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06',
    'code-snippets-collection',
    'Useful Code Snippets',
    'Quick reference for developers',
    E'```javascript
// Call tracking implementation
const trackCall = async (data) => {
  const payload = {
    from: data.from,
    to: data.to,
    duration: data.duration,
    timestamp: new Date().toISOString()
  };
  
  return await api.post("/calls", payload);
};
```

```python
# Python webhook handler
@app.route("/webhook", methods=["POST"])
def handle_webhook():
    data = request.json
    signature = request.headers.get("X-Signature")
    
    if not verify_signature(data, signature):
        return jsonify({"error": "Invalid signature"}), 401
    
    process_event(data)
    return jsonify({"status": "ok"}), 200
```

```sql
-- Get call statistics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_calls,
  AVG(duration) as avg_duration,
  SUM(CASE WHEN duration >= 90 THEN 1 ELSE 0 END) as qualified_calls
FROM calls
WHERE created_at >= NOW() - INTERVAL ''30 days''
GROUP BY DATE(created_at)
ORDER BY date DESC;
```',
    'A collection of useful code snippets for pay-per-call integration.',
    NULL,
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'published',
    NOW() - INTERVAL '6 days',
    '{"test_type": "code_only"}'::jsonb,
    89
  );

-- Test Post 7: Empty Content
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count
)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07',
    'empty-post-test',
    'Empty Post Test',
    'Testing null/empty content',
    '',
    'This post has no content.',
    NULL,
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'draft',
    NULL,
    '{"test_type": "empty_content"}'::jsonb,
    0
  );

-- Test Post 8: Special Characters and Unicode
INSERT INTO blog_posts (
  id, slug, title, subtitle, content, excerpt, featured_image_url,
  author_id, status, published_at, metadata, view_count
)
VALUES 
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08',
    'special-characters-test',
    'Special Characters & Unicode Test',
    'Testing word count with special chars',
    E'# Special Characters Test 🎯\n\nThis post tests how the system handles special characters and unicode.\n\n## Emoji Usage 🚀\n\n- Phone calls 📞 are important\n- Analytics 📊 drive decisions\n- Global reach 🌍 matters\n\n## Special Punctuation\n\nHere''s some text with various punctuation: Hello... World! How are you??? That''s great—really great!\n\n## Unicode Characters\n\n- Café (with accent)\n- Résumé building\n- Naïve approach\n- 日本語 (Japanese)\n- 中文 (Chinese)\n- العربية (Arabic)\n\n## Currency Symbols\n\n- USD: $100\n- EUR: €100\n- GBP: £100\n- JPY: ¥100\n\n## Mathematical Symbols\n\n- Addition: 2 + 2 = 4\n- Multiplication: 3 × 3 = 9\n- Division: 10 ÷ 2 = 5\n- Approximately: π ≈ 3.14\n\n## Code with Special Characters\n\n```javascript\nconst greeting = "Hello, 世界! 👋";\nconst price = "$99.99";\nconst success = true; // ✓\nconst failed = false; // ✗\n```\n\nThat''s all for the special character test!',
    'Testing how word count handles special characters, emoji, and unicode.',
    NULL,
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'published',
    NOW() - INTERVAL '7 days',
    '{"test_type": "special_characters"}'::jsonb,
    34
  );

-- =====================================================
-- Verification Queries
-- =====================================================

-- Test 1: Basic word count for all posts
SELECT 
  title,
  word_count_tsvector(content) as tsvector_word_count,
  word_count_tsvector(content_sanitized) as sanitized_word_count,
  LENGTH(content) as char_count,
  metadata->>'test_type' as test_type
FROM blog_posts
WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%'
ORDER BY created_at DESC;

-- Test 2: Reading statistics for all posts
SELECT 
  title,
  get_reading_stats(content) as reading_stats,
  metadata->>'test_type' as test_type
FROM blog_posts
WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%'
ORDER BY created_at DESC;

-- Test 3: Code block word counts
SELECT 
  title,
  count_code_block_words(content) as code_words,
  word_count_tsvector(content) as total_words,
  ROUND((count_code_block_words(content)::numeric / NULLIF(word_count_tsvector(content), 0) * 100), 2) as code_percentage,
  metadata->>'test_type' as test_type
FROM blog_posts
WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%'
  AND content LIKE '%```%'
ORDER BY code_percentage DESC;

-- Test 4: Detailed breakdown for specific test cases
SELECT 
  title,
  jsonb_build_object(
    'total_words', word_count_tsvector(content),
    'content_words', word_count_tsvector(content) - count_code_block_words(content),
    'code_words', count_code_block_words(content),
    'reading_time_min', (get_reading_stats(content)->>'reading_time_minutes')::int,
    'char_count', LENGTH(content),
    'has_sanitized', content_sanitized IS NOT NULL,
    'test_type', metadata->>'test_type'
  ) as detailed_stats
FROM blog_posts
WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%'
ORDER BY 
  CASE metadata->>'test_type'
    WHEN 'short_post' THEN 1
    WHEN 'standard_content' THEN 2
    WHEN 'code_heavy' THEN 3
    WHEN 'mixed_content' THEN 4
    WHEN 'very_long_post' THEN 5
    WHEN 'code_only' THEN 6
    WHEN 'empty_content' THEN 7
    WHEN 'special_characters' THEN 8
  END;

-- Test 5: Compare different word counting methods
WITH comparison AS (
  SELECT 
    title,
    content,
    -- TSVector method (new)
    word_count_tsvector(content) as tsvector_count,
    -- Simple split method (old way for comparison)
    array_length(string_to_array(trim(content), ' '), 1) as simple_split_count,
    -- Regex word boundary method (for comparison)
    array_length(
      string_to_array(
        regexp_replace(
          regexp_replace(content, '[^a-zA-Z0-9\s]', ' ', 'g'),
          '\s+', ' ', 'g'
        ),
        ' '
      ), 
      1
    ) as regex_count
  FROM blog_posts
  WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%'
    AND content != ''
)
SELECT 
  title,
  tsvector_count,
  simple_split_count,
  regex_count,
  ROUND(((simple_split_count - tsvector_count)::numeric / tsvector_count * 100), 2) as simple_diff_percent,
  ROUND(((regex_count - tsvector_count)::numeric / tsvector_count * 100), 2) as regex_diff_percent
FROM comparison
ORDER BY tsvector_count;

-- Test 6: Performance comparison (if you want to test speed)
DO $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  test_content text;
BEGIN
  -- Get the longest post for performance testing
  SELECT content INTO test_content
  FROM blog_posts
  WHERE id = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05';
  
  -- Test tsvector method
  start_time := clock_timestamp();
  PERFORM word_count_tsvector(test_content);
  end_time := clock_timestamp();
  RAISE NOTICE 'TSVector method: % ms', EXTRACT(MILLISECOND FROM end_time - start_time);
  
  -- Test reading stats (includes code detection)
  start_time := clock_timestamp();
  PERFORM get_reading_stats(test_content);
  end_time := clock_timestamp();
  RAISE NOTICE 'Reading stats method: % ms', EXTRACT(MILLISECOND FROM end_time - start_time);
END $$;

-- Test 7: Verify all functions work correctly
SELECT 
  'word_count_tsvector' as function_name,
  CASE 
    WHEN word_count_tsvector('Hello world') = 2 THEN 'PASS'
    ELSE 'FAIL'
  END as basic_test,
  CASE 
    WHEN word_count_tsvector('') = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as empty_test,
  CASE 
    WHEN word_count_tsvector(NULL) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as null_test
UNION ALL
SELECT 
  'count_code_block_words' as function_name,
  CASE 
    WHEN count_code_block_words('```js\nconst x = 1;\n```') > 0 THEN 'PASS'
    ELSE 'FAIL'
  END as basic_test,
  CASE 
    WHEN count_code_block_words('no code here') = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as empty_test,
  CASE 
    WHEN count_code_block_words(NULL) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as null_test
UNION ALL
SELECT 
  'get_reading_stats' as function_name,
  CASE 
    WHEN (get_reading_stats('Hello world')->>'word_count')::int = 2 THEN 'PASS'
    ELSE 'FAIL'
  END as basic_test,
  CASE 
    WHEN (get_reading_stats('')->>'word_count')::int = 0 THEN 'PASS'
    ELSE 'FAIL'
  END as empty_test,
  CASE 
    WHEN get_reading_stats(NULL) IS NOT NULL THEN 'PASS'
    ELSE 'FAIL'
  END as null_test;

-- Summary statistics
SELECT 
  COUNT(*) as total_test_posts,
  COUNT(*) FILTER (WHERE word_count_tsvector(content) > 0) as posts_with_content,
  MIN(word_count_tsvector(content)) as min_words,
  MAX(word_count_tsvector(content)) as max_words,
  ROUND(AVG(word_count_tsvector(content))) as avg_words,
  SUM(count_code_block_words(content)) as total_code_words,
  COUNT(*) FILTER (WHERE count_code_block_words(content) > 0) as posts_with_code
FROM blog_posts
WHERE id LIKE 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380%';