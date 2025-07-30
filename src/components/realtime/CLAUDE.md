# Realtime Components Directory

This directory contains components for real-time data display and live updates using Supabase Realtime.

## Directory Purpose
- Displays live call tracking data
- Shows real-time campaign updates
- Provides instant notifications
- Manages WebSocket connections

## Component Types
- **CallTracker.tsx** - Live call status display
- **LiveFeed.tsx** - Real-time activity feed
- **NotificationToast.tsx** - Instant notifications
- **OnlineStatus.tsx** - Connection indicator
- **RealtimeChart.tsx** - Live data charts
- **ActiveUsers.tsx** - Online user count
- **LiveBidding.tsx** - Real-time bid updates
- **CallDuration.tsx** - Active call timers

## Realtime Hook Pattern
```tsx
export function useRealtimeChannel<T>(
  channel: string,
  event: string,
  callback: (payload: T) => void
) {
  useEffect(() => {
    const subscription = supabase
      .channel(channel)
      .on('postgres_changes', { event, schema: 'public' }, callback)
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channel, event, callback]);
}
```

## Call Tracking Component
```tsx
export function CallTracker({ campaignId }: { campaignId: string }) {
  const [calls, setCalls] = useState<Call[]>([]);
  
  useRealtimeChannel<Call>(
    `calls:campaign=${campaignId}`,
    '*',
    (payload) => {
      if (payload.eventType === 'INSERT') {
        setCalls(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setCalls(prev => prev.map(call => 
          call.id === payload.new.id ? payload.new : call
        ));
      }
    }
  );
  
  return (
    <div className="call-tracker">
      {calls.map(call => (
        <CallStatus key={call.id} call={call} />
      ))}
    </div>
  );
}
```

## Connection Management
```tsx
export function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return (
    <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
      {isOnline ? 'Live' : 'Offline'}
    </div>
  );
}
```

## Notification System
```tsx
interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}

export function NotificationToast() {
  const notifications = useNotificationStore(state => state.notifications);
  
  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <Toast
          key={notification.id}
          {...notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}
```

## Live Data Features
- Call status updates
- Campaign metric changes
- Bid adjustments
- User activity
- System alerts
- Payment confirmations

## Performance Optimization
- Debounce rapid updates
- Batch state changes
- Virtual scrolling for lists
- Memoize expensive renders
- Clean up subscriptions

## Error Handling
```tsx
function useRealtimeWithRetry(channel: string, maxRetries = 3) {
  const [retryCount, setRetryCount] = useState(0);
  
  useEffect(() => {
    const connect = async () => {
      try {
        const subscription = await supabase.channel(channel).subscribe();
        setRetryCount(0);
      } catch (error) {
        if (retryCount < maxRetries) {
          setTimeout(() => setRetryCount(prev => prev + 1), 2000);
        }
      }
    };
    
    connect();
  }, [channel, retryCount, maxRetries]);
}
```

## State Management
- Local state for UI updates
- Global store for shared data
- Optimistic updates
- Conflict resolution
- Data synchronization

## Testing Realtime
- Mock WebSocket connections
- Test reconnection logic
- Verify data consistency
- Check memory leaks
- Monitor performance

## CRITICAL RULES
- CLEAN UP all subscriptions
- HANDLE connection failures
- OPTIMIZE for high frequency
- PREVENT memory leaks
- TEST with poor connectivity