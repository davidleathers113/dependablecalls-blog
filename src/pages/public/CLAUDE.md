# Public Pages

# Page Structure
- `HomePage.tsx` - Main landing page
- `AboutPage.tsx` - Company information
- `FeaturesPage.tsx` - Platform features overview
- `PricingPage.tsx` - Pricing plans and comparison
- `ContactPage.tsx` - Contact form and information
- `PrivacyPage.tsx` - Privacy policy
- `TermsPage.tsx` - Terms of service

# Home Page Implementation
```tsx
export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);
  
  return (
    <PublicLayout>
      <div className="home-page">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <StatsSection />
        <CTASection />
      </div>
    </PublicLayout>
  );
}
```

# Hero Section
```tsx
export function HeroSection() {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  
  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="hero-text">
          <h1 className="hero-title">
            Connect Quality Traffic with
            <span className="text-primary"> High-Value Buyers</span>
          </h1>
          <p className="hero-description">
            DCE Platform is the premium pay-per-call network that matches 
            traffic suppliers with advertisers seeking high-quality leads. 
            Maximize your revenue with our advanced fraud detection and 
            real-time tracking.
          </p>
          
          <div className="hero-actions">
            <div className="action-buttons">
              <Button
                size="lg"
                onClick={() => navigate('/auth/register?type=supplier')}
              >
                Start as Supplier
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/auth/register?type=buyer')}
              >
                Start as Buyer
              </Button>
            </div>
            
            <button
              className="video-trigger"
              onClick={() => setVideoModalOpen(true)}
            >
              <PlayIcon className="h-6 w-6" />
              Watch How It Works
            </button>
          </div>
        </div>
        
        <div className="hero-visual">
          <img
            src="/images/hero-dashboard.png"
            alt="DCE Platform Dashboard"
            className="hero-image"
          />
        </div>
      </div>
      
      {videoModalOpen && (
        <VideoModal
          videoUrl="https://www.youtube.com/embed/demo-video"
          onClose={() => setVideoModalOpen(false)}
        />
      )}
    </section>
  );
}
```

# Features Overview
```tsx
interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  benefits: string[];
}

const FEATURES: Feature[] = [
  {
    icon: ShieldCheckIcon,
    title: 'Advanced Fraud Detection',
    description: 'AI-powered fraud detection protects your campaigns and ensures quality traffic.',
    benefits: [
      'Real-time call analysis',
      'Duplicate detection',
      'Geographic validation',
      'Quality scoring'
    ],
  },
  {
    icon: ChartBarIcon,
    title: 'Real-Time Analytics',
    description: 'Monitor performance with live dashboards and detailed reporting.',
    benefits: [
      'Live call tracking',
      'Performance metrics',
      'ROI analysis',
      'Custom reports'
    ],
  },
  {
    icon: CurrencyDollarIcon,
    title: 'Flexible Payouts',
    description: 'Choose from multiple payout options with transparent pricing.',
    benefits: [
      'Weekly payouts',
      'Multiple payment methods',
      'Transparent fees',
      'Instant notifications'
    ],
  },
];

export function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="section-header">
        <h2>Everything You Need to Succeed</h2>
        <p>Powerful tools designed for both traffic suppliers and buyers</p>
      </div>
      
      <div className="features-grid">
        {FEATURES.map((feature, index) => (
          <FeatureCard key={index} feature={feature} />
        ))}
      </div>
    </section>
  );
}
```

# Pricing Page
```tsx
interface PricingTier {
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  ctaText: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    description: 'Perfect for new suppliers getting started',
    price: '0',
    period: 'Setup Fee',
    features: [
      'Up to 100 calls/month',
      'Basic analytics',
      'Email support',
      'Standard fraud protection',
    ],
    ctaText: 'Get Started Free',
  },
  {
    name: 'Professional',
    description: 'Best for growing businesses',
    price: '299',
    period: 'per month',
    features: [
      'Up to 1,000 calls/month',
      'Advanced analytics',
      'Priority support',
      'Enhanced fraud detection',
      'Custom reporting',
      'API access',
    ],
    highlighted: true,
    ctaText: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    description: 'For high-volume operations',
    price: 'Custom',
    period: 'pricing',
    features: [
      'Unlimited calls',
      'White-label solution',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantees',
      '24/7 phone support',
    ],
    ctaText: 'Contact Sales',
  },
];

export function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  
  return (
    <PublicLayout>
      <div className="pricing-page">
        <PageHeader
          title="Simple, Transparent Pricing"
          subtitle="Choose the plan that's right for your business"
        />
        
        <div className="billing-toggle">
          <SegmentedControl
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly (20% off)' },
            ]}
            value={billingPeriod}
            onChange={setBillingPeriod}
          />
        </div>
        
        <div className="pricing-grid">
          {PRICING_TIERS.map((tier, index) => (
            <PricingCard
              key={index}
              tier={tier}
              billingPeriod={billingPeriod}
              onSelect={() => handlePlanSelect(tier)}
            />
          ))}
        </div>
        
        <PricingFAQ />
        <PricingComparison />
      </div>
    </PublicLayout>
  );
}
```

# Contact Page
```tsx
export function ContactPage() {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
  });
  
  const handleSubmit = async (data: ContactFormData) => {
    try {
      await contactService.submitInquiry(data);
      toast.success('Thank you! We\'ll get back to you within 24 hours.');
      form.reset();
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    }
  };
  
  return (
    <PublicLayout>
      <div className="contact-page">
        <PageHeader
          title="Get in Touch"
          subtitle="Have questions? We'd love to hear from you."
        />
        
        <div className="contact-content">
          <div className="contact-info">
            <h3>Contact Information</h3>
            
            <div className="contact-methods">
              <div className="contact-method">
                <EnvelopeIcon className="h-6 w-6" />
                <div>
                  <h4>Email Us</h4>
                  <p>support@dependablecalls.com</p>
                  <p>Response within 4 hours</p>
                </div>
              </div>
              
              <div className="contact-method">
                <PhoneIcon className="h-6 w-6" />
                <div>
                  <h4>Call Us</h4>
                  <p>+1 (555) 123-4567</p>
                  <p>Mon-Fri 9AM-6PM PST</p>
                </div>
              </div>
              
              <div className="contact-method">
                <ChatBubbleLeftIcon className="h-6 w-6" />
                <div>
                  <h4>Live Chat</h4>
                  <p>Available 24/7</p>
                  <Button size="sm" onClick={() => openLiveChat()}>
                    Start Chat
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="contact-form">
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <h3>Send us a Message</h3>
              
              <div className="form-grid">
                <Input
                  {...form.register('firstName')}
                  label="First Name"
                  error={form.formState.errors.firstName?.message}
                />
                <Input
                  {...form.register('lastName')}
                  label="Last Name"
                  error={form.formState.errors.lastName?.message}
                />
              </div>
              
              <Input
                {...form.register('email')}
                type="email"
                label="Email Address"
                error={form.formState.errors.email?.message}
              />
              
              <Input
                {...form.register('company')}
                label="Company (Optional)"
                error={form.formState.errors.company?.message}
              />
              
              <Select
                {...form.register('inquiryType')}
                label="Inquiry Type"
                options={[
                  { value: 'general', label: 'General Question' },
                  { value: 'sales', label: 'Sales Inquiry' },
                  { value: 'support', label: 'Technical Support' },
                  { value: 'partnership', label: 'Partnership' },
                ]}
                error={form.formState.errors.inquiryType?.message}
              />
              
              <Textarea
                {...form.register('message')}
                label="Message"
                rows={6}
                error={form.formState.errors.message?.message}
              />
              
              <Button
                type="submit"
                loading={form.formState.isSubmitting}
                className="w-full"
              >
                Send Message
              </Button>
            </form>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
```

# About Page
```tsx
export function AboutPage() {
  return (
    <PublicLayout>
      <div className="about-page">
        <section className="about-hero">
          <div className="hero-content">
            <h1>About DCE Platform</h1>
            <p className="hero-subtitle">
              We're building the future of performance marketing by connecting 
              quality traffic providers with serious advertisers.
            </p>
          </div>
        </section>
        
        <section className="mission-section">
          <div className="mission-content">
            <h2>Our Mission</h2>
            <p>
              To create a transparent, fraud-free marketplace where traffic 
              suppliers and advertisers can build mutually beneficial 
              relationships based on quality and performance.
            </p>
          </div>
        </section>
        
        <section className="values-section">
          <h2>Our Values</h2>
          <div className="values-grid">
            <ValueCard
              icon={ShieldCheckIcon}
              title="Transparency"
              description="Open, honest relationships with all our partners"
            />
            <ValueCard
              icon={TrendingUpIcon}
              title="Quality First"
              description="We prioritize quality over quantity in every transaction"
            />
            <ValueCard
              icon={UserGroupIcon}
              title="Partnership"
              description="Your success is our success - we grow together"
            />
          </div>
        </section>
        
        <section className="team-section">
          <h2>Leadership Team</h2>
          <div className="team-grid">
            {TEAM_MEMBERS.map(member => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
          </div>
        </section>
        
        <section className="stats-section">
          <div className="stats-grid">
            <StatCard title="$50M+" subtitle="Revenue Generated" />
            <StatCard title="10,000+" subtitle="Successful Campaigns" />
            <StatCard title="500+" subtitle="Active Partners" />
            <StatCard title="99.9%" subtitle="Uptime Guarantee" />
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
```

# SEO Optimization
```tsx
// SEO component for public pages
export function SEOHead({ page }: { page: string }) {
  const seoData = getSEOData(page);
  
  useEffect(() => {
    // Update document title
    document.title = seoData.title;
    
    // Update meta tags
    updateMetaTag('description', seoData.description);
    updateMetaTag('keywords', seoData.keywords);
    
    // Update Open Graph tags
    updateMetaTag('og:title', seoData.title);
    updateMetaTag('og:description', seoData.description);
    updateMetaTag('og:image', seoData.image);
    updateMetaTag('og:url', window.location.href);
    
    // Update Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', seoData.title);
    updateMetaTag('twitter:description', seoData.description);
    updateMetaTag('twitter:image', seoData.image);
  }, [seoData]);
  
  return null;
}

function updateMetaTag(property: string, content: string) {
  let element = document.querySelector(`meta[name="${property}"], meta[property="${property}"]`);
  
  if (!element) {
    element = document.createElement('meta');
    if (property.startsWith('og:') || property.startsWith('twitter:')) {
      element.setAttribute('property', property);
    } else {
      element.setAttribute('name', property);
    }
    document.head.appendChild(element);
  }
  
  element.setAttribute('content', content);
}
```

# Performance Optimization
- Lazy loading for images and components
- Code splitting by route
- CDN optimization for static assets
- Critical CSS inlining
- Preload key resources

# Analytics Integration
```tsx
export function usePageAnalytics(pageName: string) {
  useEffect(() => {
    // Track page view
    analytics.page(pageName, {
      path: window.location.pathname,
      title: document.title,
      url: window.location.href,
    });
    
    // Track time on page
    const startTime = Date.now();
    
    return () => {
      const timeOnPage = Date.now() - startTime;
      analytics.track('Page Time', {
        page: pageName,
        duration: timeOnPage,
      });
    };
  }, [pageName]);
}
```

# Conversion Tracking
- Lead form submissions
- Registration completions
- Contact form submissions
- Download tracking
- Video engagement

# Mobile Optimization
- Touch-friendly navigation
- Responsive images
- Mobile-specific CTAs
- Faster mobile loading
- App-like experience

# CRITICAL RULES
- NO regex in public pages
- NO any types in page interfaces
- ALWAYS optimize for SEO
- ALWAYS ensure fast loading times
- IMPLEMENT proper analytics
- TEST across all devices
- ENSURE accessibility compliance
- MAINTAIN consistent branding