# Billing Pages

# Page Structure
- `BillingDashboard.tsx` - Main billing overview
- `PaymentMethods.tsx` - Payment method management
- `InvoiceHistory.tsx` - Invoice viewing and management
- `BillingSettings.tsx` - Billing preferences
- `AddPaymentMethod.tsx` - New payment method form

# Billing Dashboard
```tsx
export function BillingDashboard() {
  const { user } = useAuth();
  const { data: billingData, loading } = useBilling(user?.id);
  
  if (loading) return <BillingSkeleton />;
  
  return (
    <AppLayout>
      <div className="billing-dashboard">
        <PageHeader title="Billing & Payments" />
        
        <div className="billing-overview">
          <BillingCard
            title="Current Balance"
            amount={billingData.currentBalance}
            status={billingData.accountStatus}
          />
          <BillingCard
            title="Monthly Spend"
            amount={billingData.monthlySpend}
            trend={billingData.spendTrend}
          />
          <BillingCard
            title="Next Payment"
            amount={billingData.nextPayment?.amount}
            date={billingData.nextPayment?.dueDate}
          />
        </div>
        
        <div className="billing-sections">
          <PaymentMethodsSection methods={billingData.paymentMethods} />
          <RecentInvoicesSection invoices={billingData.recentInvoices} />
          <UsageMetricsSection usage={billingData.usage} />
        </div>
      </div>
    </AppLayout>
  );
}
```

# Payment Method Management
```tsx
interface PaymentMethodsProps {
  methods: PaymentMethod[];
  onMethodAdded: (method: PaymentMethod) => void;
  onMethodRemoved: (methodId: string) => void;
}

export function PaymentMethods({ methods, onMethodAdded, onMethodRemoved }: PaymentMethodsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  
  const handleSetDefault = async (methodId: string) => {
    try {
      await billingService.setDefaultPaymentMethod(methodId);
      toast.success('Default payment method updated');
    } catch (error) {
      toast.error('Failed to update payment method');
    }
  };
  
  return (
    <div className="payment-methods">
      <div className="section-header">
        <h2>Payment Methods</h2>
        <Button onClick={() => setShowAddForm(true)}>
          Add Payment Method
        </Button>
      </div>
      
      <div className="payment-methods-list">
        {methods.map(method => (
          <PaymentMethodCard
            key={method.id}
            method={method}
            onSetDefault={() => handleSetDefault(method.id)}
            onRemove={() => onMethodRemoved(method.id)}
          />
        ))}
      </div>
      
      {showAddForm && (
        <AddPaymentMethodModal
          onClose={() => setShowAddForm(false)}
          onSuccess={onMethodAdded}
        />
      )}
    </div>
  );
}
```

# Stripe Payment Integration
```tsx
export function AddPaymentMethodModal({ onClose, onSuccess }: AddPaymentMethodModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) return;
    
    setProcessing(true);
    
    const cardElement = elements.getElement(CardElement);
    
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement!,
    });
    
    if (error) {
      toast.error(error.message);
      setProcessing(false);
      return;
    }
    
    try {
      await billingService.addPaymentMethod(paymentMethod.id);
      onSuccess(paymentMethod);
      onClose();
    } catch (error) {
      toast.error('Failed to add payment method');
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>Add Payment Method</h2>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={processing}>
            Add Payment Method
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

# Invoice Management
```tsx
export function InvoiceHistory() {
  const { data: invoices, loading } = useInvoices();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  const downloadInvoice = async (invoiceId: string) => {
    try {
      const pdf = await billingService.downloadInvoice(invoiceId);
      downloadFile(pdf, `invoice-${invoiceId}.pdf`);
    } catch (error) {
      toast.error('Failed to download invoice');
    }
  };
  
  return (
    <div className="invoice-history">
      <PageHeader title="Invoice History" />
      
      <DataTable
        data={invoices}
        columns={[
          { key: 'invoiceNumber', label: 'Invoice #' },
          { key: 'date', label: 'Date', render: (date) => formatDate(date) },
          { key: 'amount', label: 'Amount', render: (amount) => formatCurrency(amount) },
          { key: 'status', label: 'Status', render: (status) => <StatusBadge status={status} /> },
          {
            key: 'actions',
            label: 'Actions',
            render: (_, invoice) => (
              <div className="table-actions">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadInvoice(invoice.id)}
                >
                  Download
                </Button>
              </div>
            ),
          },
        ]}
        loading={loading}
      />
      
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
```

# Usage Tracking
```tsx
export function UsageMetrics() {
  const { data: usage } = useUsageMetrics();
  
  return (
    <div className="usage-metrics">
      <h3>Usage This Month</h3>
      
      <div className="usage-grid">
        <UsageCard
          title="API Calls"
          current={usage.apiCalls}
          limit={usage.apiCallsLimit}
          unit="calls"
        />
        <UsageCard
          title="Storage"
          current={usage.storage}
          limit={usage.storageLimit}
          unit="GB"
        />
        <UsageCard
          title="Bandwidth"
          current={usage.bandwidth}
          limit={usage.bandwidthLimit}
          unit="GB"
        />
      </div>
      
      <UsageChart data={usage.dailyUsage} />
    </div>
  );
}
```

# Billing Alerts
```tsx
export function BillingAlerts() {
  const { data: alerts } = useBillingAlerts();
  
  return (
    <div className="billing-alerts">
      {alerts.map(alert => (
        <Alert key={alert.id} type={alert.severity}>
          <AlertIcon type={alert.type} />
          <div className="alert-content">
            <h4>{alert.title}</h4>
            <p>{alert.description}</p>
            {alert.action && (
              <Button
                size="sm"
                onClick={() => handleAlertAction(alert.id, alert.action)}
              >
                {alert.action.label}
              </Button>
            )}
          </div>
        </Alert>
      ))}
    </div>
  );
}
```

# Auto-billing Setup
```tsx
export function AutoBillingSettings() {
  const { data: settings, update } = useAutoBillingSettings();
  
  const handleToggleAutoBilling = async (enabled: boolean) => {
    try {
      await update({ autoBillingEnabled: enabled });
      toast.success('Auto-billing settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };
  
  return (
    <div className="auto-billing-settings">
      <h3>Auto-billing Settings</h3>
      
      <div className="setting-item">
        <div className="setting-info">
          <h4>Enable Auto-billing</h4>
          <p>Automatically charge your default payment method when balance is low</p>
        </div>
        <Switch
          checked={settings.autoBillingEnabled}
          onChange={handleToggleAutoBilling}
        />
      </div>
      
      {settings.autoBillingEnabled && (
        <>
          <div className="setting-item">
            <label>Minimum Balance Threshold</label>
            <CurrencyInput
              value={settings.minBalance}
              onChange={(value) => update({ minBalance: value })}
            />
          </div>
          
          <div className="setting-item">
            <label>Auto-recharge Amount</label>
            <CurrencyInput
              value={settings.rechargeAmount}
              onChange={(value) => update({ rechargeAmount: value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
```

# Tax Management
- Tax calculation integration
- Tax exemption certificate upload
- Tax reporting for compliance
- Multi-jurisdiction support

# Payment Security
- PCI DSS compliance
- Encrypted payment data
- Fraud detection
- Secure payment processing

# Subscription Management
- Plan upgrades/downgrades
- Billing cycle management
- Proration calculations
- Cancel/reactivate subscriptions

# CRITICAL RULES
- NO regex in billing logic
- NO any types in payment interfaces
- ALWAYS handle payment errors gracefully
- ALWAYS validate payment amounts
- SECURE payment data handling
- NEVER log sensitive payment info
- IMPLEMENT proper error recovery
- TEST payment flows thoroughly
- COMPLY with financial regulations
- AUDIT all billing transactions