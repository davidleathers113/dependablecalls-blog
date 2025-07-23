# Call Tracking Pages

# Page Structure
- `CallDashboard.tsx` - Real-time call monitoring
- `CallDetails.tsx` - Individual call analysis
- `CallHistory.tsx` - Historical call data
- `CallRecordings.tsx` - Call recording playback
- `LiveCallTracker.tsx` - Active call monitoring

# Real-time Call Dashboard
```tsx
export function CallDashboard() {
  const { user } = useAuth();
  const { data: activeCalls, loading } = useActiveCalls();
  const { data: callStats } = useCallStats();
  
  // Real-time subscription for call updates
  useEffect(() => {
    const subscription = supabase
      .channel('call-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
      }, (payload) => {
        handleCallUpdate(payload);
      })
      .subscribe();
      
    return () => supabase.removeChannel(subscription);
  }, []);
  
  return (
    <AppLayout>
      <div className="call-dashboard">
        <PageHeader title="Call Tracking" />
        
        <div className="call-stats-grid">
          <StatCard
            title="Active Calls"
            value={callStats.activeCalls}
            icon={PhoneIcon}
            status="success"
          />
          <StatCard
            title="Calls Today"
            value={callStats.callsToday}
            trend={callStats.todayTrend}
            icon={ChartBarIcon}
          />
          <StatCard
            title="Conversion Rate"
            value={`${callStats.conversionRate}%`}
            trend={callStats.conversionTrend}
            icon={TrendingUpIcon}
          />
          <StatCard
            title="Avg Duration"
            value={formatDuration(callStats.avgDuration)}
            icon={ClockIcon}
          />
        </div>
        
        <div className="call-monitoring">
          <LiveCallList calls={activeCalls} loading={loading} />
          <CallActivityFeed />
        </div>
        
        <CallPerformanceCharts data={callStats.chartData} />
      </div>
    </AppLayout>
  );
}
```

# Live Call Monitoring
```tsx
interface LiveCallListProps {
  calls: ActiveCall[];
  loading: boolean;
}

export function LiveCallList({ calls, loading }: LiveCallListProps) {
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  
  if (loading) return <CallListSkeleton />;
  
  return (
    <div className="live-call-list">
      <div className="section-header">
        <h3>Active Calls ({calls.length})</h3>
        <div className="call-controls">
          <Button size="sm" onClick={() => window.location.reload()}>
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
      
      <div className="call-list">
        {calls.map(call => (
          <CallListItem
            key={call.id}
            call={call}
            isSelected={selectedCall === call.id}
            onClick={() => setSelectedCall(call.id)}
          />
        ))}
      </div>
      
      {calls.length === 0 && (
        <EmptyState
          icon={PhoneIcon}
          title="No active calls"
          description="When calls are in progress, they'll appear here"
        />
      )}
    </div>
  );
}
```

# Call Details Analysis
```tsx
interface CallDetailsPageProps {
  callId: string;
}

export function CallDetailsPage({ callId }: CallDetailsPageProps) {
  const { data: call, loading } = useCall(callId);
  const { data: fraudAnalysis } = useFraudAnalysis(callId);
  const { data: recordings } = useCallRecordings(callId);
  
  if (loading) return <CallDetailsSkeleton />;
  if (!call) return <NotFound />;
  
  return (
    <AppLayout>
      <div className="call-details">
        <PageHeader
          title={`Call #${call.id.slice(0, 8)}`}
          breadcrumbs={[
            { label: 'Calls', href: '/calls' },
            { label: 'Call Details' },
          ]}
        />
        
        <div className="call-overview">
          <CallStatusCard call={call} />
          <CallMetricsCard call={call} />
          <CallTimelineCard call={call} />
        </div>
        
        <div className="call-analysis">
          <CallQualityAnalysis call={call} />
          {fraudAnalysis && (
            <FraudAnalysisCard analysis={fraudAnalysis} />
          )}
          {recordings.length > 0 && (
            <CallRecordingsSection recordings={recordings} />
          )}
        </div>
        
        <CallActivityLog callId={callId} />
      </div>
    </AppLayout>
  );
}
```

# Call Quality Analysis
```tsx
interface CallQualityAnalysisProps {
  call: Call;
}

export function CallQualityAnalysis({ call }: CallQualityAnalysisProps) {
  const qualityMetrics = [
    {
      name: 'Duration Score',
      value: call.quality_metrics.duration_score,
      description: 'Based on call length vs. expected duration',
    },
    {
      name: 'Engagement Score',
      value: call.quality_metrics.engagement_score,
      description: 'Based on conversation analysis',
    },
    {
      name: 'Intent Score',
      value: call.quality_metrics.intent_score,
      description: 'Likelihood of genuine purchase intent',
    },
  ];
  
  return (
    <div className="call-quality-analysis">
      <h3>Quality Analysis</h3>
      
      <div className="overall-score">
        <div className="score-circle">
          <span className="score-value">{call.quality_score}</span>
          <span className="score-label">Overall Score</span>
        </div>
      </div>
      
      <div className="quality-metrics">
        {qualityMetrics.map(metric => (
          <div key={metric.name} className="metric-item">
            <div className="metric-header">
              <span className="metric-name">{metric.name}</span>
              <span className="metric-value">{metric.value}/100</span>
            </div>
            <ProgressBar value={metric.value} max={100} />
            <p className="metric-description">{metric.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

# Call Recording Playback
```tsx
export function CallRecordingsSection({ recordings }: { recordings: CallRecording[] }) {
  const [currentRecording, setCurrentRecording] = useState<CallRecording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const playRecording = (recording: CallRecording) => {
    setCurrentRecording(recording);
    if (audioRef.current) {
      audioRef.current.src = recording.url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };
  
  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  return (
    <div className="call-recordings">
      <h3>Call Recordings</h3>
      
      <div className="recordings-list">
        {recordings.map(recording => (
          <div key={recording.id} className="recording-item">
            <div className="recording-info">
              <span className="recording-name">{recording.name}</span>
              <span className="recording-duration">
                {formatDuration(recording.duration)}
              </span>
            </div>
            <div className="recording-controls">
              <Button
                size="sm"
                onClick={() => playRecording(recording)}
                disabled={!recording.url}
              >
                <PlayIcon className="h-4 w-4" />
                Play
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadRecording(recording)}
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      {currentRecording && (
        <div className="audio-player">
          <audio
            ref={audioRef}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          <div className="player-controls">
            <Button onClick={togglePlayback}>
              {isPlaying ? (
                <PauseIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5" />
              )}
            </Button>
            <span className="player-title">{currentRecording.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

# Call History with Filtering
```tsx
export function CallHistory() {
  const [filters, setFilters] = useState<CallFilters>({
    dateRange: { start: '', end: '' },
    status: 'all',
    campaign: '',
    supplier: '',
  });
  
  const { data: calls, loading, hasMore, loadMore } = useCallHistory(filters);
  
  return (
    <AppLayout>
      <div className="call-history">
        <PageHeader title="Call History" />
        
        <CallFilters
          filters={filters}
          onChange={setFilters}
        />
        
        <DataTable
          data={calls}
          columns={[
            {
              key: 'created_at',
              label: 'Time',
              render: (date) => formatDateTime(date),
            },
            {
              key: 'caller_number',
              label: 'Caller',
              render: (number) => formatPhoneNumber(number),
            },
            {
              key: 'campaign',
              label: 'Campaign',
              render: (campaign) => campaign?.name || 'N/A',
            },
            {
              key: 'duration',
              label: 'Duration',
              render: (duration) => formatDuration(duration),
            },
            {
              key: 'status',
              label: 'Status',
              render: (status) => <StatusBadge status={status} />,
            },
            {
              key: 'quality_score',
              label: 'Quality',
              render: (score) => (
                <QualityScore score={score} />
              ),
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (_, call) => (
                <CallActions call={call} />
              ),
            },
          ]}
          loading={loading}
          onRowClick={(call) => navigate(`/calls/${call.id}`)}
        />
        
        {hasMore && (
          <div className="load-more">
            <Button onClick={loadMore} loading={loading}>
              Load More Calls
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

# Real-time Call Notifications
```tsx
export function useCallNotifications() {
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;
    
    const subscription = supabase
      .channel('call-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'calls',
        filter: `supplier_id=eq.${user.id}`,
      }, (payload) => {
        const newCall = payload.new as Call;
        
        // Show notification for new calls
        toast.success(`New call received: ${newCall.caller_number}`, {
          action: {
            label: 'View',
            onClick: () => navigate(`/calls/${newCall.id}`),
          },
        });
        
        // Play notification sound
        playNotificationSound();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `supplier_id=eq.${user.id}`,
      }, (payload) => {
        const updatedCall = payload.new as Call;
        
        // Notify on call completion
        if (updatedCall.status === 'completed') {
          toast.info(`Call completed: $${updatedCall.payout_amount}`);
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(subscription);
  }, [user]);
}
```

# Call Analytics
- Real-time call volume tracking
- Conversion rate analysis
- Quality score trends
- Fraud detection patterns
- Revenue attribution

# Mobile Optimization
- Touch-friendly call controls
- Responsive call tables
- Mobile audio player
- Offline call data viewing

# Performance Features
- Virtual scrolling for large call lists
- Progressive data loading
- Efficient real-time updates
- Background call status sync

# CRITICAL RULES
- NO regex in call tracking logic
- NO any types in call interfaces
- ALWAYS handle real-time data safely
- ALWAYS validate call data integrity
- IMPLEMENT proper error recovery
- TEST real-time features thoroughly
- ENSURE data consistency
- MAINTAIN call privacy standards