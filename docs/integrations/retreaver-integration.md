# Retreaver Integration Documentation

## Executive Summary

### Platform Description and Key Features
Retreaver is a sophisticated call tracking and routing platform designed for performance marketers, lead generators, and call centers. It provides real-time call attribution, dynamic number provisioning, intelligent call routing, and comprehensive analytics for inbound call campaigns.

**Key Features:**
- Dynamic Number Insertion (DNI) for tracking online sources
- Real-time call routing based on custom rules and attributes
- Comprehensive API for automation and integration
- Webhook support for real-time data processing
- Call recording and IVR capabilities
- Advanced tag-based data management
- Real-Time Bidding (RTB) for call distribution

### Primary Use Cases
1. **Performance Marketing**: Track calls back to specific campaigns, keywords, and creatives
2. **Lead Generation**: Route high-value calls to appropriate buyers based on qualifications
3. **Call Centers**: Manage agent availability and route calls intelligently
4. **Publisher Networks**: Distribute calls to multiple buyers with real-time bidding
5. **Data Enrichment**: Append caller data from external sources during call flow

### Pros/Cons for DCE Integration

**Pros:**
- Comprehensive REST API with JSON/XML support
- Real-time webhook notifications at multiple call stages
- Flexible tag-based data model allows custom attributes
- JavaScript SDK for web integration
- No API usage fees
- Supports both real-time and batch operations
- Built-in support for call recording and transcription

**Cons:**
- Current API is unversioned (though stable)
- Limited documentation on specific rate limits
- No official npm package for JavaScript SDK
- 5-second timeout limit on webhook responses
- Requires technical expertise for complex integrations

### Cost Structure Overview
- **Pricing Model**: Pay-as-you-go with no contracts
- **Base Rates**: Starting at $1 per number and $0.05 per minute
- **Entry Plan**: $25/month for 200 NA minutes and 15 NA phone numbers
- **Volume Discounts**: Available for high-volume users
- **API Access**: No additional fees for API usage
- **Free Trial**: Available
- **Custom Pricing**: Available for enterprise needs

## Technical Specifications

### API Architecture
- **Type**: RESTful API
- **Base URL**: `https://api.retreaver.com/`
- **Formats Supported**: JSON (recommended), XML
- **Pagination**: 25 results per page with Link headers
- **Design Pattern**: Resource-based endpoints
- **API Versioning**: Currently unversioned (stable, replacement in development)

### Available Endpoints
```
GET/POST /calls.json          # Call records and data
GET/POST /affiliates.json     # Affiliate management
GET/POST /targets.json        # Call routing targets
GET/POST /campaigns.json      # Campaign configuration
GET/POST /numbers.json        # Phone number management
GET/POST /number_pools.json   # Dynamic number pools
GET/POST /companies.json      # Company management
GET/POST /contacts.json       # Contact records
```

### SDK Availability
- **JavaScript SDK**: Retreaver.js (CDN-hosted, not on npm)
- **Other SDKs**: No official SDKs for other languages
- **GitHub**: https://github.com/retreaver/retreaver-js

### Authentication & Security

**Authentication Methods:**
- API Key-based authentication (query parameter)
- Company ID required for multi-company accounts

**Required Credentials:**
1. **API Key**: Found under Settings → My Account → API Access
2. **Company ID**: Found under Settings → My Company

**Authentication Example:**
```bash
curl "https://api.retreaver.com/calls.json?api_key=YOUR_API_KEY&company_id=YOUR_COMPANY_ID"
```

**Security Requirements:**
- API keys should never be exposed publicly
- HTTPS required for all API calls
- API keys should be stored securely (environment variables)
- No OAuth or JWT support currently

### Rate Limits & Quotas

**API Limits:**
- Pagination: 25 results per page (fixed)
- Tag limit: 100 tags per operation
- Webhook timeout: 5 seconds response time
- Specific rate limits: Not publicly documented (contact support)

**Other Limitations:**
- Call recording storage: Based on plan
- Number pool size: Based on plan
- Concurrent calls: Based on plan

## Data Models & Schemas

### Call Data Structure

Retreaver uses a flexible tag-based system for call data. Tags are key-value pairs that can represent any attribute.

**Core Call Fields:**
- `id`: Unique call identifier
- `caller_number`: Source phone number
- `dialed_number`: Number dialed by caller
- `target_number`: Destination number (where call was routed)
- `campaign_id`: Associated campaign
- `affiliate_id`: Source affiliate (if applicable)
- `target_id`: Destination target
- `duration`: Call duration in seconds
- `status`: Call completion status
- `created_at`: Call start timestamp
- `answered_at`: Call answer timestamp
- `ended_at`: Call end timestamp
- `recording_url`: Call recording URL (if enabled)

**Tag Data Types:**
- **Date**: ISO 8601 format (e.g., sale date, DOB)
- **Numeric**: Integer or decimal values (e.g., credit score, sale price)
- **Text**: String values (e.g., name, status)
- **Boolean**: true/false values (e.g., employed, over_18)

### Field Mapping to DCE Schema

| Retreaver Field | DCE Database Field | Notes |
|----------------|-------------------|-------|
| `id` | `call_id` | Unique identifier |
| `caller_number` | `caller_phone` | E.164 format |
| `dialed_number` | `tracking_number` | DNI number |
| `target_number` | `destination_number` | Where call was routed |
| `campaign_id` | `campaign_id` | Campaign identifier |
| `affiliate_id` | `publisher_id` | Traffic source |
| `duration` | `call_duration` | Seconds |
| `status` | `call_status` | completed/failed/busy |
| `created_at` | `call_start_time` | UTC timestamp |
| `answered_at` | `call_answer_time` | UTC timestamp |
| `ended_at` | `call_end_time` | UTC timestamp |
| `recording_url` | `recording_url` | S3 or CDN URL |
| Custom tags | `call_metadata` | JSON field for flexibility |

### Related Entities

**Campaigns:**
- Controls call routing rules
- Defines conversion criteria
- Sets IVR and whisper messages
- Manages webhooks and integrations

**Publishers/Affiliates:**
- Traffic sources sending calls
- Can have custom payouts
- Tagged for attribution

**Buyers/Targets:**
- Call destinations
- Business hours configuration
- Capacity limits
- Custom routing rules

**Number Pools:**
- Dynamic number assignment
- Geographic targeting
- Rotation strategies

## Integration Capabilities

### Real-time Data Access

**Webhook Support:**
Retreaver supports webhooks at multiple stages of a call lifecycle:

1. **Start Webhook**: Triggered immediately when call is received
2. **Selected Webhook**: Fired when a buyer/target is chosen
3. **Timer Webhook**: Triggered at specified call duration
4. **Postback Webhook**: Fired when external postback received
5. **Always Webhook**: Executed at call completion

**Webhook Configuration Example:**
```json
{
  "webhook_url": "https://your-api.com/retreaver-webhook",
  "trigger_type": "always",
  "method": "POST",
  "timeout": 5000,
  "retry_attempts": 3
}
```

**Real-Time Features:**
- 5-second response timeout for webhooks
- Automatic JSON parsing of responses
- Tag application from webhook responses
- Support for synchronous data enrichment

### Batch Operations

**Bulk Data Export:**
```bash
# Fetch calls for a date range
curl "https://api.retreaver.com/calls.json?api_key=KEY&company_id=ID&created_at_start=2024-01-01&created_at_end=2024-01-31"
```

**Pagination Handling:**
```javascript
// Parse Link header for pagination
// Example: <https://api.retreaver.com/calls.json?page=2>; rel="next"
```

**Historical Data Access:**
- Full call history available via API
- Filterable by date range, campaign, status
- CSV export available through UI

### Number Management

**Number Provisioning:**
```bash
# Create a new number
curl -X POST "https://api.retreaver.com/numbers.json" \
  -d "api_key=KEY&company_id=ID&area_code=415&campaign_id=123"
```

**Number Pool Management:**
```bash
# Create number pool
curl -X POST "https://api.retreaver.com/number_pools.json" \
  -d "api_key=KEY&company_id=ID&name=West Coast Pool&area_codes[]=415&area_codes[]=310"
```

**Call Routing Configuration:**
- Rule-based routing by tags
- Time-of-day routing
- Geographic routing
- Percentage-based distribution
- Priority-based routing

## Implementation Guide

### Quick Start

1. **Get API Credentials**
   - Log into Retreaver account
   - Navigate to Settings → My Account → API Access
   - Copy API Key
   - Navigate to Settings → My Company
   - Copy Company ID

2. **Test API Connection**
   ```bash
   curl "https://api.retreaver.com/campaigns.json?api_key=YOUR_API_KEY&company_id=YOUR_COMPANY_ID"
   ```

3. **Set Up Basic Campaign**
   ```bash
   curl -X POST "https://api.retreaver.com/campaigns.json" \
     -d "api_key=KEY&company_id=ID&name=DCE Test Campaign&type=search"
   ```

4. **Configure Webhook Endpoint**
   ```javascript
   // Express.js webhook handler
   app.post('/webhooks/retreaver', (req, res) => {
     const callData = req.body;
     
     // Process call data
     console.log('Call ID:', callData.id);
     console.log('Duration:', callData.duration);
     console.log('Tags:', callData.tags);
     
     // Return tags to apply to call
     res.json({
       lead_score: 85,
       qualified: true
     });
   });
   ```

### JavaScript Integration Example

```html
<!-- Include Retreaver.js -->
<script src="https://d1a32x6bfz4b86.cloudfront.net/jsapi/v1/retreaver.min.js"></script>

<script>
// Initialize campaign
var campaign = new Retreaver.Campaign({ 
  campaign_key: 'YOUR_CAMPAIGN_KEY' 
});

// Request tracking number with tags
var visitorTags = {
  utm_source: 'google',
  utm_campaign: 'summer-sale',
  page_url: window.location.href,
  visitor_id: getCookieValue('visitor_id')
};

campaign.request_number(visitorTags, function(number) {
  // Display the number
  document.getElementById('phone-number').innerHTML = 
    '<a href="tel:' + number.get('number') + '">' + 
    number.get('formatted_number') + '</a>';
  
  // Add additional tags after display
  number.add_tags({
    displayed_at: new Date().toISOString(),
    device_type: detectDevice()
  });
});
</script>
```

### Call Data Processing Example

```javascript
// Node.js example for processing call webhooks
const express = require('express');
const app = express();

app.post('/webhooks/retreaver/call-complete', async (req, res) => {
  const {
    id: retreaverId,
    caller_number,
    dialed_number,
    duration,
    status,
    created_at,
    answered_at,
    ended_at,
    recording_url,
    tags
  } = req.body;

  // Map to DCE schema
  const dceCallRecord = {
    call_id: retreaverId,
    caller_phone: caller_number,
    tracking_number: dialed_number,
    call_duration: duration,
    call_status: mapStatus(status),
    call_start_time: created_at,
    call_answer_time: answered_at,
    call_end_time: ended_at,
    recording_url: recording_url,
    call_metadata: {
      retreaver_tags: tags,
      utm_source: tags.utm_source,
      utm_campaign: tags.utm_campaign,
      lead_score: tags.lead_score
    }
  };

  // Save to DCE database
  await saveCallRecord(dceCallRecord);

  // Return success
  res.json({ success: true });
});

function mapStatus(retreaver_status) {
  const statusMap = {
    'completed': 'completed',
    'no-answer': 'no_answer',
    'busy': 'busy',
    'failed': 'failed'
  };
  return statusMap[retreaver_status] || 'unknown';
}
```

### Real-Time Bidding Integration

```javascript
// RTB endpoint for receiving bid requests
app.post('/rtb/retreaver', async (req, res) => {
  const {
    caller_number,
    dialed_number,
    tags,
    campaign_id
  } = req.body;

  // Evaluate lead quality
  const leadScore = await evaluateLead(caller_number, tags);
  
  if (leadScore >= 70) {
    // We want this call
    res.json({
      bid: true,
      payout: calculatePayout(leadScore, tags),
      buyer_number: '+14155551234',
      conversion_timer: 90 // seconds
    });
  } else {
    // Pass on this call
    res.json({
      bid: false
    });
  }
});
```

## Testing & Development

### Sandbox Environment
- **Availability**: No dedicated sandbox (use test campaigns)
- **Test Numbers**: Can provision test numbers in your account
- **Test Mode**: Create campaigns with test routing rules

### Test Data Generation
1. Create test campaign with specific routing
2. Use test phone numbers for placing calls
3. Use webhook testing tools (ngrok, RequestBin)
4. Monitor via Retreaver dashboard

### Debugging Tools

**Call Logs:**
- Detailed call logs in dashboard
- Webhook execution history
- Tag timeline for each call

**Postback Logs:**
- Settings → Company → Postback Logs
- Shows all received postbacks
- Includes response codes and payloads

**API Testing:**
```bash
# Test with curl and jq for pretty printing
curl "https://api.retreaver.com/calls.json?api_key=KEY&company_id=ID&limit=1" | jq .
```

### Common Integration Issues

1. **Webhook Timeouts**
   - Ensure response within 5 seconds
   - Use async processing for heavy operations
   - Return minimal response, process async

2. **Tag Limits**
   - Maximum 100 tags per operation
   - Use batch operations for large datasets
   - Consider tag naming conventions

3. **Number Pool Exhaustion**
   - Monitor pool usage
   - Set up alerts for low inventory
   - Implement number recycling strategy

4. **Data Synchronization**
   - Use call ID as unique identifier
   - Implement idempotent webhook handlers
   - Store Retreaver ID for reference

## Best Practices

1. **Security**
   - Store API keys in environment variables
   - Use HTTPS for all webhooks
   - Validate webhook signatures (if implemented)
   - Implement rate limiting on your endpoints

2. **Performance**
   - Cache frequently accessed data
   - Use pagination for large datasets
   - Implement exponential backoff for retries
   - Process webhooks asynchronously

3. **Reliability**
   - Implement webhook retry logic
   - Log all API interactions
   - Monitor API response times
   - Set up alerting for failures

4. **Data Quality**
   - Validate phone numbers before sending
   - Normalize data formats
   - Handle missing optional fields
   - Map all possible status values

## Additional Resources

- **Official Documentation**: https://help.retreaver.com/
- **API Reference**: https://retreaver.github.io/core-api-docs/
- **JavaScript SDK**: https://github.com/retreaver/retreaver-js
- **Support Center**: https://help.retreaver.com/hc/en-us
- **GitHub Organization**: https://github.com/retreaver

## Integration Checklist

- [ ] Obtain API key and Company ID
- [ ] Test API connectivity
- [ ] Set up webhook endpoints
- [ ] Implement call data mapping
- [ ] Configure number provisioning
- [ ] Set up call routing rules
- [ ] Implement error handling
- [ ] Add monitoring and logging
- [ ] Test end-to-end flow
- [ ] Document custom tag mappings