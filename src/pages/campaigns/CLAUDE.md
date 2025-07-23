# Campaign Management Pages

# Page Structure
- `CampaignDashboard.tsx` - Campaign overview and management
- `CreateCampaign.tsx` - New campaign creation wizard
- `EditCampaign.tsx` - Campaign editing interface
- `CampaignDetails.tsx` - Individual campaign analytics
- `CampaignSettings.tsx` - Campaign configuration

# Campaign Dashboard
```tsx
export function CampaignDashboard() {
  const { user } = useAuth();
  const { data: campaigns, loading } = useCampaigns(user?.id);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  
  const handleCampaignAction = async (action: CampaignAction, campaignId: string) => {
    try {
      switch (action) {
        case 'pause':
          await campaignService.pauseCampaign(campaignId);
          toast.success('Campaign paused successfully');
          break;
        case 'resume':
          await campaignService.resumeCampaign(campaignId);
          toast.success('Campaign resumed successfully');
          break;
        case 'duplicate':
          const duplicated = await campaignService.duplicateCampaign(campaignId);
          navigate(`/campaigns/${duplicated.id}/edit`);
          break;
      }
    } catch (error) {
      toast.error('Failed to perform campaign action');
    }
  };
  
  return (
    <AppLayout>
      <div className="campaign-dashboard">
        <PageHeader
          title="Campaign Management"
          action={
            <Button onClick={() => navigate('/campaigns/create')}>
              <PlusIcon className="h-4 w-4" />
              Create Campaign
            </Button>
          }
        />
        
        <div className="campaign-stats">
          <CampaignStatsCards campaigns={campaigns} />
        </div>
        
        <div className="campaign-filters">
          <CampaignFilters onFiltersChange={handleFiltersChange} />
        </div>
        
        <div className="campaigns-grid">
          {campaigns.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onAction={(action) => handleCampaignAction(action, campaign.id)}
              onClick={() => navigate(`/campaigns/${campaign.id}`)}
            />
          ))}
        </div>
        
        {campaigns.length === 0 && (
          <EmptyState
            icon={FolderIcon}
            title="No campaigns yet"
            description="Create your first campaign to start receiving calls"
            action={
              <Button onClick={() => navigate('/campaigns/create')}>
                Create Campaign
              </Button>
            }
          />
        )}
      </div>
    </AppLayout>
  );
}
```

# Campaign Creation Wizard
```tsx
export function CreateCampaign() {
  const [currentStep, setCurrentStep] = useState(1);
  const [campaignData, setCampaignData] = useState<Partial<Campaign>>({});
  const navigate = useNavigate();
  
  const steps = [
    { id: 1, name: 'Basic Info', component: BasicInfoStep },
    { id: 2, name: 'Targeting', component: TargetingStep },
    { id: 3, name: 'Pricing', component: PricingStep },
    { id: 4, name: 'Review', component: ReviewStep },
  ];
  
  const handleStepComplete = (stepData: Partial<Campaign>) => {
    setCampaignData(prev => ({ ...prev, ...stepData }));
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const handleCampaignCreate = async (finalData: Campaign) => {
    try {
      const campaign = await campaignService.createCampaign(finalData);
      toast.success('Campaign created successfully!');
      navigate(`/campaigns/${campaign.id}`);
    } catch (error) {
      toast.error('Failed to create campaign');
    }
  };
  
  const CurrentStepComponent = steps[currentStep - 1].component;
  
  return (
    <AppLayout>
      <div className="create-campaign">
        <PageHeader
          title="Create New Campaign"
          breadcrumbs={[
            { label: 'Campaigns', href: '/campaigns' },
            { label: 'Create' },
          ]}
        />
        
        <div className="wizard-container">
          <WizardSteps
            steps={steps}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />
          
          <div className="wizard-content">
            <CurrentStepComponent
              data={campaignData}
              onComplete={currentStep === steps.length ? handleCampaignCreate : handleStepComplete}
              onBack={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
```

# Campaign Targeting Configuration
```tsx
interface TargetingStepProps {
  data: Partial<Campaign>;
  onComplete: (data: Partial<Campaign>) => void;
  onBack: () => void;
}

export function TargetingStep({ data, onComplete, onBack }: TargetingStepProps) {
  const form = useForm({
    resolver: zodResolver(campaignTargetingSchema),
    defaultValues: {
      geoTargeting: data.geo_targeting || {},
      timeTargeting: data.time_targeting || {},
      deviceTargeting: data.device_targeting || {},
      filters: data.filters || {},
    },
  });
  
  const handleSubmit = (formData: TargetingFormData) => {
    onComplete({
      geo_targeting: formData.geoTargeting,
      time_targeting: formData.timeTargeting,
      device_targeting: formData.deviceTargeting,
      filters: formData.filters,
    });
  };
  
  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="targeting-step">
      <div className="step-header">
        <h2>Campaign Targeting</h2>
        <p>Define who should see your campaign</p>
      </div>
      
      <div className="targeting-sections">
        <div className="targeting-section">
          <h3>Geographic Targeting</h3>
          <GeographicTargeting
            value={form.watch('geoTargeting')}
            onChange={(value) => form.setValue('geoTargeting', value)}
          />
          {form.formState.errors.geoTargeting && (
            <ErrorMessage>{form.formState.errors.geoTargeting.message}</ErrorMessage>
          )}
        </div>
        
        <div className="targeting-section">
          <h3>Time Targeting</h3>
          <TimeTargeting
            value={form.watch('timeTargeting')}
            onChange={(value) => form.setValue('timeTargeting', value)}
          />
        </div>
        
        <div className="targeting-section">
          <h3>Device Targeting</h3>
          <DeviceTargeting
            value={form.watch('deviceTargeting')}
            onChange={(value) => form.setValue('deviceTargeting', value)}
          />
        </div>
        
        <div className="targeting-section">
          <h3>Advanced Filters</h3>
          <AdvancedFilters
            value={form.watch('filters')}
            onChange={(value) => form.setValue('filters', value)}
          />
        </div>
      </div>
      
      <div className="step-actions">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">
          Continue
        </Button>
      </div>
    </form>
  );
}
```

# Campaign Performance Analytics
```tsx
interface CampaignDetailsProps {
  campaignId: string;
}

export function CampaignDetails({ campaignId }: CampaignDetailsProps) {
  const { data: campaign, loading } = useCampaign(campaignId);
  const { data: analytics } = useCampaignAnalytics(campaignId);
  const { data: calls } = useCampaignCalls(campaignId);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfMonth(new Date()),
    end: new Date(),
  });
  
  if (loading) return <CampaignDetailsSkeleton />;
  if (!campaign) return <NotFound />;
  
  return (
    <AppLayout>
      <div className="campaign-details">
        <PageHeader
          title={campaign.name}
          subtitle={`Campaign #${campaign.id.slice(0, 8)}`}
          breadcrumbs={[
            { label: 'Campaigns', href: '/campaigns' },
            { label: campaign.name },
          ]}
          action={
            <div className="campaign-actions">
              <CampaignStatusToggle
                campaign={campaign}
                onStatusChange={handleStatusChange}
              />
              <Button
                variant="outline"
                onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}
              >
                <PencilIcon className="h-4 w-4" />
                Edit
              </Button>
            </div>
          }
        />
        
        <div className="campaign-overview">
          <CampaignMetricsCards
            campaign={campaign}
            analytics={analytics}
          />
        </div>
        
        <div className="analytics-section">
          <div className="section-header">
            <h2>Performance Analytics</h2>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
          </div>
          
          <div className="analytics-grid">
            <CallVolumeChart
              data={analytics.callVolume}
              dateRange={dateRange}
            />
            <ConversionChart
              data={analytics.conversions}
              dateRange={dateRange}
            />
            <RevenueChart
              data={analytics.revenue}
              dateRange={dateRange}
            />
            <QualityChart
              data={analytics.quality}
              dateRange={dateRange}
            />
          </div>
        </div>
        
        <div className="calls-section">
          <CampaignCallsTable
            calls={calls}
            campaignId={campaignId}
          />
        </div>
      </div>
    </AppLayout>
  );
}
```

# Campaign Budget Management
```tsx
export function CampaignBudgetSettings({ campaign }: { campaign: Campaign }) {
  const [budgetSettings, setBudgetSettings] = useState({
    dailyBudget: campaign.daily_budget,
    monthlyBudget: campaign.monthly_budget,
    bidAmount: campaign.bid_amount,
    autoBudget: campaign.auto_budget_enabled,
  });
  
  const handleBudgetUpdate = async () => {
    try {
      await campaignService.updateBudget(campaign.id, budgetSettings);
      toast.success('Budget settings updated');
    } catch (error) {
      toast.error('Failed to update budget settings');
    }
  };
  
  return (
    <div className="budget-settings">
      <h3>Budget & Bidding</h3>
      
      <div className="budget-form">
        <div className="form-group">
          <label>Daily Budget</label>
          <CurrencyInput
            value={budgetSettings.dailyBudget}
            onChange={(value) => setBudgetSettings(prev => ({
              ...prev,
              dailyBudget: value,
            }))}
            placeholder="Enter daily budget"
          />
        </div>
        
        <div className="form-group">
          <label>Monthly Budget</label>
          <CurrencyInput
            value={budgetSettings.monthlyBudget}
            onChange={(value) => setBudgetSettings(prev => ({
              ...prev,
              monthlyBudget: value,
            }))}
            placeholder="Enter monthly budget"
          />
        </div>
        
        <div className="form-group">
          <label>Bid Amount per Call</label>
          <CurrencyInput
            value={budgetSettings.bidAmount}
            onChange={(value) => setBudgetSettings(prev => ({
              ...prev,
              bidAmount: value,
            }))}
            placeholder="Enter bid amount"
          />
        </div>
        
        <div className="form-group">
          <div className="checkbox-group">
            <Checkbox
              checked={budgetSettings.autoBudget}
              onChange={(checked) => setBudgetSettings(prev => ({
                ...prev,
                autoBudget: checked,
              }))}
            />
            <div className="checkbox-content">
              <label>Enable Auto Budget Optimization</label>
              <p>Automatically adjust bids based on performance</p>
            </div>
          </div>
        </div>
        
        <Button onClick={handleBudgetUpdate}>
          Update Budget Settings
        </Button>
      </div>
    </div>
  );
}
```

# Campaign A/B Testing
```tsx
export function CampaignABTesting({ campaignId }: { campaignId: string }) {
  const { data: tests, loading } = useABTests(campaignId);
  const [showCreateTest, setShowCreateTest] = useState(false);
  
  return (
    <div className="ab-testing">
      <div className="section-header">
        <h3>A/B Tests</h3>
        <Button onClick={() => setShowCreateTest(true)}>
          Create Test
        </Button>
      </div>
      
      <div className="tests-list">
        {tests.map(test => (
          <ABTestCard
            key={test.id}
            test={test}
            onViewResults={() => navigate(`/campaigns/${campaignId}/tests/${test.id}`)}
          />
        ))}
      </div>
      
      {showCreateTest && (
        <CreateABTestModal
          campaignId={campaignId}
          onClose={() => setShowCreateTest(false)}
          onSuccess={() => {
            setShowCreateTest(false);
            // Refresh tests
          }}
        />
      )}
    </div>
  );
}
```

# Campaign Fraud Prevention
```tsx
export function CampaignFraudSettings({ campaign }: { campaign: Campaign }) {
  const [fraudSettings, setFraudSettings] = useState({
    enableFraudDetection: campaign.fraud_detection_enabled,
    qualityThreshold: campaign.quality_threshold,
    blockDuplicates: campaign.block_duplicate_calls,
    geoValidation: campaign.geo_validation_enabled,
  });
  
  return (
    <div className="fraud-settings">
      <h3>Fraud Prevention</h3>
      
      <div className="settings-list">
        <div className="setting-item">
          <div className="setting-info">
            <h4>Enable Fraud Detection</h4>
            <p>Automatically screen calls for fraudulent activity</p>
          </div>
          <Switch
            checked={fraudSettings.enableFraudDetection}
            onChange={(checked) => setFraudSettings(prev => ({
              ...prev,
              enableFraudDetection: checked,
            }))}
          />
        </div>
        
        <div className="setting-item">
          <div className="setting-info">
            <h4>Quality Threshold</h4>
            <p>Minimum quality score required for payout</p>
          </div>
          <Slider
            value={fraudSettings.qualityThreshold}
            onChange={(value) => setFraudSettings(prev => ({
              ...prev,
              qualityThreshold: value,
            }))}
            min={0}
            max={100}
            step={5}
          />
        </div>
        
        <div className="setting-item">
          <div className="setting-info">
            <h4>Block Duplicate Calls</h4>
            <p>Prevent multiple calls from the same number</p>
          </div>
          <Switch
            checked={fraudSettings.blockDuplicates}
            onChange={(checked) => setFraudSettings(prev => ({
              ...prev,
              blockDuplicates: checked,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
```

# Campaign Optimization
- Performance-based bid adjustments
- Quality score optimization
- Conversion rate improvements
- Cost per acquisition tracking
- ROI analysis and recommendations

# Real-time Campaign Monitoring
- Live campaign status updates
- Budget spend tracking
- Call volume alerts
- Performance notifications
- Quality score changes

# Campaign Templates
- Industry-specific templates
- Best practice configurations
- Quick setup wizards
- Template sharing between users

# CRITICAL RULES
- NO regex in campaign logic
- NO any types in campaign interfaces
- ALWAYS validate campaign settings
- ALWAYS handle budget limits properly
- IMPLEMENT proper access controls
- TEST campaign creation flows
- ENSURE data consistency
- MAINTAIN campaign performance metrics