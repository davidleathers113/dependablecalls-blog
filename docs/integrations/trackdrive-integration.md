# TrackDrive Integration Documentation

## Executive Summary

### Platform Description and Key Features
TrackDrive is a comprehensive call tracking and lead automation platform that provides:
- **Call Tracking**: Measure call conversions from online and offline marketing campaigns
- **Lead to Call Automation**: Automatically schedule contact with leads
- **Agent Control Center**: Configure call center agents to handle inbound/outbound calls
- **Dynamic Number Insertion (DNI)**: Dynamically display tracking numbers on websites
- **SMS AI Bots**: Automated customer engagement through text messaging
- **Multi-channel Communication**: Integrated calls, SMS, and email capabilities

### Primary Use Cases
1. **Marketing Attribution**: Track which campaigns, keywords, and sources drive phone calls
2. **Lead Management**: Automate lead distribution and follow-up
3. **Call Center Operations**: Manage agents, route calls, and monitor performance
4. **Real-time Analytics**: Access call data and insights for optimization
5. **CRM Integration**: Sync call data with existing CRM systems

### Pros for DCE Integration
- **Comprehensive REST API**: Full programmatic access to platform features
- **Real-time Webhooks**: Instant notification of call events and status changes
- **Flexible Authentication**: Supports both basic and token-based authentication
- **Multiple Integration Partners**: Pre-built integrations with major platforms
- **Custom Fields**: Support for custom contact fields and post-call tokens
- **Bulk Operations**: CSV export capabilities for reporting

### Cons for DCE Integration
- **Limited Documentation**: API documentation appears to be under construction
- **No Apparent WebSocket Support**: Real-time data limited to webhook callbacks
- **Rate Limit Information**: Not clearly documented in available resources
- **SDK Availability**: No official SDKs mentioned, only REST API access

### Cost Structure Overview
- Contact sales at (855) 387-8288 for pricing information
- Pricing not publicly available on website

## Technical Specifications

### API Architecture
- **Type**: RESTful API based on HTTPS requests and JSON responses
- **Base URL**: `https://[your-subdomain].trackdrive.com/api/v1/`
- **Response Format**: JSON
- **Request Format**: JSON with proper Content-Type headers
- **API Version**: v1 (current documented version)

### Available Documentation
- **REST API Docs**: https://trackdrive.com/api/docs
- **Alternative URL**: https://trackdrive.net/api/docs
- **Number Insertion Docs**: https://s3.amazonaws.com/trackdrive/trackdrive-php/index.html

### SDK Availability
- No official SDKs documented
- REST API direct integration required
- PHP number insertion library available

## Authentication & Security

### Authentication Methods

#### 1. Basic Authorization (Company Access Tokens)
- Uses public and private key combination
- Keys are base64 encoded and included in Authorization header
- Provides granular permissions for each keypair

**Example**:
```bash
# Generate base64 encoded credentials
echo -n 'tdpub1234:tdprv1234' | base64

# Use in API request
curl -H "Authorization: Basic BASE64_ENCODED_PUBLIC_KEY_AND_PRIVATE_KEY" \
     https://[your-subdomain].trackdrive.com/api/v1/resource
```

#### 2. Token Authorization (Developer Access Tokens)
- Uses auth_token in Authorization header
- Simpler authentication for developer integrations

**Example**:
```bash
curl -H "Authorization: Token YOUR_AUTH_TOKEN" \
     https://[your-subdomain].trackdrive.com/api/v1/resource
```

### Required Credentials
- **Public Key**: Obtained from TrackDrive profile page
- **Private Key**: Obtained from TrackDrive profile page
- **Subdomain**: Your unique TrackDrive subdomain

### Security Requirements
- HTTPS required for all API calls
- API keys should be stored securely and never exposed in client-side code
- Consider implementing webhook authentication for incoming webhooks

## Rate Limits & Quotas
*Note: Rate limit information not available in current documentation. Contact TrackDrive support for specific limits.*

## Data Models & Schemas

### Call Data Structure
Based on available documentation, call objects include:
- **Call ID**: Unique numeric identifier (e.g., 123895022)
- **Call UUID**: Unique string identifier (e.g., c3b20b12-3b3b-4322-b15d-0f1c5f653479)
- **Revenue**: Call revenue amount
- **Payout**: Amount paid to traffic source
- **Buyer Converted**: Boolean indicating buyer conversion status
- **Offer Converted**: Boolean indicating traffic source conversion status
- **Post Call Tokens**: Custom fields object (key-value pairs)
- **Contact Field Type**: Agent script field type

### Related Entities

#### Campaigns/Publishers (Traffic Sources)
- Offers
- Traffic source tracking
- Conversion tracking

#### Tracking Numbers
- Dynamic number pools
- Number provisioning
- Call routing configuration

#### Buyers/Advertisers
- Buyer profiles
- Conversion settings
- Payout configurations

### Available API Resources (50+ categories)
- Leads
- Calls
- Schedules
- Offers
- Webhooks (incoming and outgoing)
- SMS
- Transcriptions
- Phone Numbers
- Call Logs
- Call Dispositions
- Contact Fields
- Buyers
- And many more...

## Integration Capabilities

### Real-time Data Access

#### Webhook Support
TrackDrive offers comprehensive webhook functionality:

**Outgoing Webhooks**:
- Send HTTP POST requests to specified URLs
- Real-time notification of call events
- Configurable event subscriptions
- Manual webhook testing available
- Webhook logging for debugging

**Incoming Webhooks**:
- PING/POST to TrackDrive platform
- State-of-the-art implementation
- Support for lead injection and status updates

**Common Webhook Use Cases**:
1. Send notification to Slack when buyer is converted
2. Update CRM with call data in real-time
3. Trigger automated workflows based on call outcomes

#### WebSocket/Streaming
- No documented WebSocket support
- Real-time updates limited to webhook callbacks

### Batch Operations

#### CSV Export
- Create one-time or recurring CSV call reports
- Filter calls and select specific columns
- Schedule automated reports (daily, weekly, monthly)
- Email notifications for team members

#### Bulk Update
- Bulk update functionality available through platform
- API support for batch operations not clearly documented

#### Historical Data Access
- Access call logs with powerful filters
- Custom date ranges supported
- Pagination through 'cursoring' technique

### Number Management
- Dynamic Number Insertion (DNI) capabilities
- Number pool management
- Call routing configuration
- Number provisioning (likely through integrated VOIP providers)

## Implementation Guide

### Quick Start

#### Step 1: Obtain API Credentials
1. Log into your TrackDrive account
2. Navigate to the "Profile" page
3. Find API keys at the bottom of the page
4. Store credentials securely

#### Step 2: Test Authentication
```bash
# Test with basic authentication
curl -H "Authorization: Basic $(echo -n 'YOUR_PUBLIC_KEY:YOUR_PRIVATE_KEY' | base64)" \
     https://your-subdomain.trackdrive.com/api/v1/calls
```

#### Step 3: Set Up Webhooks
1. Configure outgoing webhooks in TrackDrive dashboard
2. Set up endpoint URL for receiving webhook data
3. Test webhook delivery using manual testing feature

### Data Mapping Matrix

| TrackDrive Field | DCE Database Field | Data Type | Notes |
|------------------|-------------------|-----------|-------|
| Call ID | external_call_id | Integer | Unique numeric identifier |
| Call UUID | call_uuid | String | Alternative unique identifier |
| caller_number | caller_phone | String | Format may need normalization |
| called_number | tracking_number | String | TrackDrive tracking number |
| duration | call_duration | Integer | Likely in seconds |
| revenue | call_value | Decimal | Revenue from call |
| payout | publisher_payout | Decimal | Amount paid to traffic source |
| buyer_converted | is_converted | Boolean | Buyer conversion status |
| offer_converted | offer_converted | Boolean | Traffic source conversion |
| post_call_tokens | custom_data | JSON | Store as JSON object |
| recording_url | recording_url | String | If available |
| transcription | call_transcript | Text | If transcription enabled |

### Code Examples

#### Authentication Setup
```javascript
// Node.js example
const axios = require('axios');

class TrackDriveAPI {
  constructor(publicKey, privateKey, subdomain) {
    this.baseURL = `https://${subdomain}.trackdrive.com/api/v1`;
    this.authHeader = {
      'Authorization': `Basic ${Buffer.from(`${publicKey}:${privateKey}`).toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }

  async getCalls(params = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/calls`, {
        headers: this.authHeader,
        params: params
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching calls:', error);
      throw error;
    }
  }
}
```

#### Webhook Handling
```javascript
// Express.js webhook receiver example
const express = require('express');
const app = express();

app.post('/webhooks/trackdrive', express.json(), (req, res) => {
  const webhookData = req.body;
  
  // Verify webhook authenticity (if TrackDrive provides signature)
  // const signature = req.headers['x-trackdrive-signature'];
  
  // Process webhook data
  console.log('Received webhook:', webhookData);
  
  // Handle different event types
  if (webhookData.event === 'call.completed') {
    // Process completed call
    processCompletedCall(webhookData.data);
  } else if (webhookData.event === 'buyer.converted') {
    // Process buyer conversion
    processBuyerConversion(webhookData.data);
  }
  
  // Acknowledge receipt
  res.status(200).send('OK');
});

function processCompletedCall(callData) {
  // Store in DCE database
  // Update analytics
  // Trigger notifications
}
```

#### Data Fetching Example
```javascript
// Fetch calls with filters
async function fetchRecentCalls(api) {
  const params = {
    start_date: '2025-01-01',
    end_date: '2025-01-31',
    per_page: 100,
    cursor: null
  };
  
  let allCalls = [];
  let hasMore = true;
  
  while (hasMore) {
    const response = await api.getCalls(params);
    allCalls = allCalls.concat(response.calls);
    
    if (response.next_cursor) {
      params.cursor = response.next_cursor;
    } else {
      hasMore = false;
    }
  }
  
  return allCalls;
}
```

#### Update Call Data
```javascript
// Update call with post-call tokens
async function updateCallData(api, callId, data) {
  const updateData = {
    post_call_tokens: {
      lead_quality: 'high',
      loan_amount: '5000',
      appointment_set: 'yes'
    },
    revenue: 150.00,
    buyer_converted: true
  };
  
  try {
    const response = await axios.post(
      `${api.baseURL}/calls/${callId}`,
      updateData,
      { headers: api.authHeader }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating call:', error);
    throw error;
  }
}
```

## Testing & Development

### Sandbox Environment
- Sandbox availability not documented
- Contact TrackDrive support for test account options

### Test Data Generation
- Manual webhook testing available through dashboard
- May need to use production data with filtering

### Debugging Tools
- Webhook logging available in TrackDrive dashboard
- Standard HTTP debugging tools (Postman, curl) for API testing
- Monitor API responses for error codes and messages

### Integration Testing Checklist
1. [ ] Test authentication with both methods
2. [ ] Verify webhook delivery and processing
3. [ ] Test pagination with large result sets
4. [ ] Validate data mapping and field transformations
5. [ ] Test error handling and retry logic
6. [ ] Verify real-time data accuracy
7. [ ] Test bulk export functionality
8. [ ] Validate custom field handling

## Integration Partners
TrackDrive has existing integrations with:
- Zoho CRM
- AWS S3
- Google AdWords
- Salesforce
- Twilio, Plivo, Telnyx (VOIP providers)
- Cake
- HasOffers
- Infusionsoft
- Voluum

## Support and Resources
- **Phone**: (855) 387-8288
- **API Documentation**: https://trackdrive.com/api/docs
- **Platform Features**: https://trackdrive.com/features

## Special Considerations

### Limitations
1. API documentation appears to be under active development
2. No official SDKs available - direct REST API integration required
3. Rate limits not publicly documented
4. Full field-level documentation may require support contact

### Best Practices
1. Implement robust error handling for API calls
2. Use webhook callbacks for real-time updates rather than polling
3. Store TrackDrive IDs for data synchronization
4. Implement retry logic with exponential backoff
5. Monitor webhook delivery and implement fallback polling if needed
6. Use cursoring for large data sets to avoid timeouts

### Security Recommendations
1. Store API credentials securely (environment variables, secrets manager)
2. Implement webhook signature verification when available
3. Use HTTPS for all webhook endpoints
4. Regularly rotate API keys
5. Monitor API usage for unusual patterns
6. Implement proper access controls for team members

## Next Steps for DCE Integration
1. Contact TrackDrive support for:
   - Complete API documentation
   - Rate limit information
   - Sandbox/test environment access
   - Webhook event types and payloads
2. Design webhook receiver infrastructure
3. Implement data synchronization strategy
4. Create monitoring and alerting for integration health
5. Build error handling and retry mechanisms
6. Document field mappings and transformations