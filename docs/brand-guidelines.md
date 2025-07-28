# DependableCalls Brand Guidelines

## Brand Identity

### Mission
DependableCalls is the most trusted pay-per-call network, connecting quality suppliers with reliable buyers through transparent, real-time call tracking and fraud prevention.

### Brand Values
- **Trust** - We build lasting relationships through transparency and reliability
- **Quality** - We maintain the highest standards for call validation and lead quality
- **Innovation** - We leverage cutting-edge technology for real-time tracking and fraud prevention
- **Partnership** - We succeed when our suppliers and buyers succeed

## Visual Identity

### Logo
The DependableCalls logo combines a phone icon with signal waves, representing:
- **Phone**: Core pay-per-call business
- **Signal Waves**: Real-time connectivity and communication
- **Green Dot**: Quality indicator and trust signal

Logo variants:
- `small`: 24x24px (h-6 w-6) - Use in compact spaces
- `default`: 32x32px (h-8 w-8) - Standard usage
- `large`: 48x48px (h-12 w-12) - Hero sections and footer

### Color System

#### Primary Colors
```css
/* Professional Blue - Trust & Reliability */
--brand-primary: hsl(217, 91%, 60%);     /* #2563eb */
--brand-primary-light: hsl(217, 91%, 80%);
--brand-primary-dark: hsl(217, 91%, 40%);

/* Trust Green - Quality & Success */
--brand-accent: hsl(158, 64%, 42%);      /* #10b981 */
--brand-accent-light: hsl(158, 64%, 62%);
--brand-accent-dark: hsl(158, 64%, 32%);

/* Warm Gray - Professional & Neutral */
--brand-secondary: hsl(220, 9%, 46%);    /* #6b7280 */
```

#### Functional Colors
```css
--brand-success: var(--brand-accent);    /* Green for positive actions */
--brand-warning: hsl(45, 100%, 51%);     /* Yellow for cautions */
--brand-error: hsl(0, 84%, 60%);         /* Red for errors */
--brand-info: hsl(199, 89%, 48%);        /* Blue for information */
```

### Typography

#### Font Stack
```css
font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
```

#### Font Weights
- **Regular (400)**: Body text and descriptions
- **Medium (500)**: Buttons and navigation
- **Semibold (600)**: Subheadings
- **Bold (700)**: Headings and emphasis

#### Text Hierarchy
- **Headings**: Bold weight, -0.025em letter spacing
- **Body**: Regular weight, 1.5 line height
- **Captions**: Regular weight, 0.025em letter spacing

### Spacing System
Based on 4px grid:
- `4px` - Tight spacing
- `8px` - Default element spacing
- `16px` - Section spacing
- `24px` - Component spacing
- `32px` - Large spacing
- `48px` - Hero spacing

### Component Styling

#### Buttons
- **Primary**: Brand primary background, white text, 8px padding
- **Secondary**: Transparent background, primary border, primary text
- **Success**: Accent color background, white text
- **Minimum size**: 44x44px for accessibility

#### Cards
- White background (light mode) / Dark secondary (dark mode)
- 1px border with `--brand-border-primary`
- 8px border radius
- Subtle shadow: `--brand-shadow-sm`

#### Forms
- Input height: 40px minimum
- Border: 1px solid `--brand-border-primary`
- Focus state: Primary color border with glow
- Error state: Error color border

### Accessibility Guidelines

1. **Color Contrast**
   - Text on backgrounds: minimum 4.5:1 ratio
   - Large text: minimum 3:1 ratio
   - Interactive elements: minimum 3:1 ratio

2. **Interactive Elements**
   - Minimum touch target: 44x44px
   - Clear focus indicators
   - Hover and active states

3. **Motion**
   - Respect `prefers-reduced-motion`
   - Smooth transitions (200-300ms)
   - No auto-playing animations

### Dark Mode
The brand colors automatically adjust for dark mode:
- Primary color lightness reduced by 10%
- Accent color lightness increased by 10%
- Text colors inverted
- Background colors use dark blue base

## Usage Examples

### Logo Implementation
```tsx
import { Logo } from '@/components/common/Logo'

// Navigation bar
<Logo variant="default" />

// Footer (white text)
<Logo variant="large" className="text-white" />

// Mobile menu
<Logo variant="small" showText={false} />
```

### Brand Colors in CSS
```css
.hero-section {
  background: var(--brand-gradient-hero);
  color: var(--brand-text-on-primary);
}

.cta-button {
  background-color: var(--brand-accent);
  color: white;
  box-shadow: var(--brand-shadow-md);
}
```

## Voice & Tone

### Writing Style
- **Professional** but approachable
- **Clear** and concise
- **Action-oriented** language
- **Trustworthy** and transparent

### Key Messages
1. "Real-time call tracking you can trust"
2. "Quality leads, verified instantly"
3. "Transparent pricing, no hidden fees"
4. "Your success is our success"

### Content Guidelines
- Use active voice
- Avoid jargon unless necessary
- Focus on benefits, not features
- Include social proof and testimonials