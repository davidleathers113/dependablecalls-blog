# Ringba Integration Documentation

## Executive Summary

### Platform Description and Key Features
Ringba is an inbound call tracking and analytics platform designed for marketers and brands. It provides:
- Real-time call tracking and management
- Intelligent call routing with AI capabilities
- Global telecommunications network (60+ countries)
- Interactive Voice Response (IVR)
- Ring Tree® real-time bidding marketplace
- Automated compliance monitoring
- White label solutions

### Primary Use Cases for DCE Integration
- Real-time call data ingestion from pay-per-call campaigns
- Automated call routing and distribution
- Call quality scoring and filtering
- Revenue attribution and conversion tracking
- Multi-channel campaign performance analysis
- Compliance monitoring and fraud detection

### Pros/Cons for DCE Integration

**Pros:**
- Comprehensive API with real-time webhooks
- No feature gatekeeping - all features available via API
- Global coverage with 60+ countries
- AI-powered call routing and scoring
- Open framework with flexible integration options
- No contracts required

**Cons:**
- OAuth authentication complexity
- MFA requirement by June 1, 2025
- Limited public documentation on specific endpoints
- One-time webhook conversion per call ID limitation
- API documentation requires developer portal access

### Cost Structure Overview
- No contracts required
- Flexible usage-based pricing model
- Pricing details available at https://www.ringba.com/pricing
- No feature gatekeeping based on pricing tier

## Technical Specifications

### API Architecture
- **Type**: RESTful API with JSON responses
- **Base URL**: `https://api.ringba.com/v2/`
- **API Versioning**: Currently on v2
- **Response Format**: JSON
- **SDK Availability**: 
  - Official samples: https://github.com/Ringba/ringba-api-samples
  - C# implementation examples available
  - No official Node.js/JavaScript SDK (use REST directly)

### Authentication & Security
- **Method**: OAuth 2.0 Bearer Token
- **Token Endpoint**: `POST https://api.ringba.com/v2/token`
- **Required Credentials**:
  - User email
  - Password
  - Account ID
- **Security Requirements**:
  - HTTPS required for all API calls
  - Multi-factor authentication (MFA) mandatory by June 1, 2025
  - Bearer token must be included in Authorization header

### Rate Limits & Quotas
- Rate limits not publicly documented
- Contact Ringba support for specific limits
- Webhook conversions limited to once per inbound call ID

## Data Models & Schemas

### Call Data Structure
The API returns call log data with three main components:

```json
{
  "callLog": {
    "data": [
      {
        "Columns": {
          // Main call information
          "callerId": "+1234567890",
          "inboundNumber": "+0987654321",
          "targetNumber": "+1112223333",
          "callLength": 180,
          "callDateTime": "2025-01-24T10:30:00Z",
          "callStatus": "completed"
        },
        "Events": [
          // Call progression events
          {
            "eventType": "call_started",
            "timestamp": "2025-01-24T10:30:00Z"
          },
          {
            "eventType": "call_completed",
            "timestamp": "2025-01-24T10:33:00Z"
          }
        ],
        "Tags": {
          // Additional metadata
          "callerState": "CA",
          "campaignId": "camp_123",
          "publisherId": "pub_456"
        }
      }
    ]
  }
}
```

### Related Entities

#### Campaigns/Publishers
- Campaign tracking and attribution
- Publisher performance metrics
- Revenue sharing configurations

#### Tracking Numbers
- Dynamic number pools
- Number provisioning and management
- Call routing rules

#### Buyers/Advertisers
- Real-time bidding configuration
- Conversion tracking
- Revenue attribution

## Integration Capabilities

### Real-time Data Access

#### Webhook Support
- **Webhook URL Format**: `https://webhook.ringba.com/hook/<WebhookID>`
- **Event Types**:
  - Call start
  - Call completion
  - Conversion events
  - Number assignment
  
#### Webhook Configuration Parameters:
```
?call_id=[callUUID]
&call_revenue=[conversionAmount]
&sale_successful=yes
```

#### WebSocket/Streaming
- Not documented in public API
- Contact Ringba for real-time streaming options

#### Latency Expectations
- Webhooks fire in near real-time
- API responses typically < 1 second

### Batch Operations

#### Bulk Data Export
- Call logs endpoint supports date range queries
- Default query returns current day's logs
- Flexible field selection for custom reports

#### Historical Data Access
```http
POST https://api.ringba.com/v2/{{account_id}}/calllogs
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "startDate": "2025-01-01",
  "endDate": "2025-01-24",
  "filters": {
    "campaignId": "camp_123"
  }
}
```

### Number Management

#### Number Pool Management
- Dynamic number assignment to visitors
- Each user linked to unique tracking number
- Automatic number recycling

#### Call Routing Configuration
- IVR setup and management
- Ring Tree® bidding configuration
- Intelligent routing based on buyer criteria

## Implementation Guide

### Quick Start

#### 1. Obtain API Credentials
```bash
# Request API access from Ringba
# Store credentials securely
export RINGBA_EMAIL="your-email@example.com"
export RINGBA_PASSWORD="your-password"
export RINGBA_ACCOUNT_ID="your-account-id"
```

#### 2. Authenticate and Get Token
```javascript
const axios = require('axios');

async function getAccessToken() {
  try {
    const response = await axios.post('https://api.ringba.com/v2/token', {
      email: process.env.RINGBA_EMAIL,
      password: process.env.RINGBA_PASSWORD,
      accountId: process.env.RINGBA_ACCOUNT_ID
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}
```

#### 3. Fetch Call Logs
```javascript
async function getCallLogs(accessToken, date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  
  try {
    const response = await axios.post(
      `https://api.ringba.com/v2/${process.env.RINGBA_ACCOUNT_ID}/calllogs`,
      {
        startDate: dateStr,
        endDate: dateStr
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to fetch call logs:', error);
    throw error;
  }
}
```

### Data Mapping Matrix

| Ringba Field | DCE Database Field | Data Type | Notes |
|--------------|-------------------|-----------|-------|
| callerId | caller_phone | VARCHAR(20) | E.164 format |
| inboundNumber | tracking_number | VARCHAR(20) | DCE tracking number |
| targetNumber | destination_number | VARCHAR(20) | Final destination |
| callLength | duration_seconds | INTEGER | Call duration in seconds |
| callDateTime | call_started_at | TIMESTAMP | UTC timestamp |
| callStatus | status | VARCHAR(50) | completed/failed/busy |
| campaignId | campaign_id | VARCHAR(100) | External campaign ID |
| publisherId | publisher_id | VARCHAR(100) | Traffic source ID |
| callerState | caller_state | VARCHAR(2) | US state code |
| conversionAmount | revenue | DECIMAL(10,2) | Revenue if converted |

### Code Examples

#### Webhook Handler (Express.js)
```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Webhook endpoint for Ringba
app.post('/webhooks/ringba', async (req, res) => {
  try {
    const {
      call_id,
      call_revenue,
      sale_successful,
      caller_id,
      inbound_number,
      call_length
    } = req.query;

    // Validate webhook data
    if (!call_id) {
      return res.status(400).json({ error: 'Missing call_id' });
    }

    // Process the webhook
    const callData = {
      externalCallId: call_id,
      revenue: parseFloat(call_revenue) || 0,
      converted: sale_successful === 'yes',
      callerId: caller_id,
      trackingNumber: inbound_number,
      duration: parseInt(call_length) || 0
    };

    // Store in DCE database
    await storeCallData(callData);

    // Acknowledge webhook
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to store call data in DCE database
async function storeCallData(callData) {
  // Implement database storage logic here
  console.log('Storing call data:', callData);
}
```

#### Real-time Call Monitoring
```javascript
class RingbaCallMonitor {
  constructor(config) {
    this.config = config;
    this.accessToken = null;
  }

  async initialize() {
    this.accessToken = await getAccessToken();
    // Refresh token every hour
    setInterval(() => this.refreshToken(), 3600000);
  }

  async refreshToken() {
    try {
      this.accessToken = await getAccessToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }

  async pollCallLogs(interval = 60000) {
    setInterval(async () => {
      try {
        const logs = await getCallLogs(this.accessToken);
        await this.processNewCalls(logs);
      } catch (error) {
        console.error('Call log polling failed:', error);
      }
    }, interval);
  }

  async processNewCalls(logs) {
    // Process new call data
    for (const call of logs.callLog.data) {
      // Check if call is new
      // Process and store in DCE
      console.log('Processing call:', call.Columns.callerId);
    }
  }
}
```

## Testing & Development

### Sandbox Environment
- No public sandbox environment documented
- Contact Ringba support for test account access
- Recommend using a separate Ringba account for development

### Test Data Generation
```javascript
// Generate test webhook calls for development
function generateTestWebhookCall() {
  const testData = {
    call_id: `test_${Date.now()}`,
    caller_id: '+15551234567',
    inbound_number: '+15557654321',
    call_length: Math.floor(Math.random() * 300),
    call_revenue: (Math.random() * 100).toFixed(2),
    sale_successful: Math.random() > 0.5 ? 'yes' : 'no'
  };
  
  return testData;
}

// Simulate webhook calls
async function simulateWebhooks(webhookUrl, count = 10) {
  for (let i = 0; i < count; i++) {
    const testData = generateTestWebhookCall();
    const params = new URLSearchParams(testData).toString();
    
    try {
      await axios.post(`${webhookUrl}?${params}`);
      console.log(`Test webhook ${i + 1} sent`);
    } catch (error) {
      console.error(`Test webhook ${i + 1} failed:`, error.message);
    }
    
    // Wait 1 second between calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### Debugging Tools
```javascript
// Request/Response logger middleware
function ringbaApiLogger(req, res, next) {
  console.log('Ringba API Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });
  
  const originalSend = res.send;
  res.send = function(data) {
    console.log('Ringba API Response:', {
      statusCode: res.statusCode,
      data: JSON.parse(data)
    });
    originalSend.call(this, data);
  };
  
  next();
}

// Error handler for Ringba API calls
class RingbaAPIError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'RingbaAPIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

// Wrapper for API calls with error handling
async function ringbaAPICall(method, endpoint, data, token) {
  try {
    const response = await axios({
      method,
      url: `https://api.ringba.com/v2/${endpoint}`,
      data,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new RingbaAPIError(
        error.response.data.message || 'API call failed',
        error.response.status,
        error.response.data
      );
    }
    throw error;
  }
}
```

## Limitations and Special Considerations

### Known Limitations
1. **Webhook Conversions**: Each inbound call ID can only be converted once via webhook
2. **MFA Requirement**: Mandatory multi-factor authentication by June 1, 2025
3. **Documentation Access**: Full API documentation requires developer portal access
4. **Real-time Streaming**: No documented WebSocket support for real-time events

### Special Considerations
1. **Data Freshness**: Poll call logs API regularly for near real-time data
2. **Number Pool Management**: Plan for number inventory based on expected traffic
3. **Compliance**: Implement proper TCPA compliance measures
4. **Error Handling**: Implement robust retry logic for API failures
5. **Token Management**: Implement automatic token refresh before expiration

### Integration Best Practices
1. Use webhooks for real-time conversion tracking
2. Implement call log polling for comprehensive data capture
3. Store all raw API responses for debugging
4. Map Ringba campaign/publisher IDs to DCE entities
5. Implement proper logging and monitoring
6. Use environment variables for all credentials
7. Implement circuit breakers for API calls
8. Cache frequently accessed data (campaigns, publishers)

### Support Resources
- Developer Portal: https://developers.ringba.com/
- Support Site: https://support.ringba.com/
- GitHub Samples: https://github.com/Ringba/ringba-api-samples
- Contact: (800) 824-5000

---

*Last Updated: January 24, 2025*