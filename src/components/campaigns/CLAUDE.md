# Campaign Components

# Component Structure
- `CampaignCard.tsx` - Campaign display card
- `CampaignForm.tsx` - Campaign creation/editing form
- `CampaignFilters.tsx` - Filtering and search
- `CampaignStats.tsx` - Performance metrics
- `CampaignList.tsx` - Paginated campaign list

# Campaign Management
```tsx
interface CampaignCardProps {
  campaign: Campaign;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export function CampaignCard({ campaign, onEdit, onDelete, showActions }: CampaignCardProps) {
  return (
    <div className="campaign-card">
      <h3>{campaign.name}</h3>
      <div className="campaign-stats">
        <StatItem label="Target CPA" value={formatCurrency(campaign.target_cpa)} />
        <StatItem label="Daily Budget" value={formatCurrency(campaign.daily_budget)} />
        <StatItem label="Status" value={campaign.status} />
      </div>
      {showActions && (
        <div className="campaign-actions">
          <Button onClick={() => onEdit?.(campaign.id)}>Edit</Button>
          <Button onClick={() => onDelete?.(campaign.id)} variant="danger">Delete</Button>
        </div>
      )}
    </div>
  );
}
```

# Real-time Updates
- Live call volume indicators
- Performance metrics updates
- Budget consumption tracking
- Quality score changes

# Campaign Filters
```tsx
interface CampaignFiltersProps {
  onFiltersChange: (filters: CampaignFilters) => void;
  initialFilters?: CampaignFilters;
}

export function CampaignFilters({ onFiltersChange, initialFilters }: CampaignFiltersProps) {
  const [filters, setFilters] = useState(initialFilters || {});
  
  const handleFilterChange = (key: keyof CampaignFilters, value: unknown) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };
  
  return (
    <div className="campaign-filters">
      <Select
        value={filters.vertical}
        onChange={(value) => handleFilterChange('vertical', value)}
        options={CAMPAIGN_VERTICALS}
      />
      <Select
        value={filters.status}
        onChange={(value) => handleFilterChange('status', value)}
        options={CAMPAIGN_STATUSES}
      />
    </div>
  );
}
```

# Form Components
- Geographic targeting selectors
- Budget and CPA inputs
- Time restriction settings
- Quality requirements

# Performance Visualization
- Chart components for metrics
- Real-time data updates
- Export functionality
- Comparative analysis

# DCE-Specific Features
- Vertical-specific settings
- Fraud protection toggles
- Payout calculation displays
- Lead quality thresholds

# Integration Patterns
- Supabase real-time subscriptions
- Stripe billing integration
- Analytics data fetching
- Campaign optimization suggestions

# CRITICAL RULES
- NO regex in campaign validation
- NO any types in component props
- ALWAYS handle real-time updates
- ALWAYS validate budget constraints
- IMPLEMENT proper error boundaries
- TEST all campaign operations