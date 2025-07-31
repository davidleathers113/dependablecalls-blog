/**
 * Mock Data Service for DCE Platform Development
 *
 * This service provides realistic mock data for development and testing
 * when the full database schema is not available.
 */

import type { Database } from '../types/database-extended'

type CallRecord = Database['public']['Tables']['calls']['Row']
type CampaignRecord = Database['public']['Tables']['campaigns']['Row']
type BuyerRecord = Database['public']['Tables']['buyers']['Row']

// Check if we're in development mode and should use mock data
// This allows development without requiring full DCE platform database tables
const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_DATA === 'true'

// Log mock data usage in development
if (isDevelopment && import.meta.env.DEV) {
  console.info('🔧 DCE Platform running in mock data mode')
  console.info('ℹ️  Set VITE_USE_MOCK_DATA=false to use real database')
}

// Mock data generators
export class MockDataService {
  private static campaigns: CampaignRecord[] = [
    {
      id: 'camp-1',
      name: 'Home Improvement - National',
      supplier_id: 'supplier-1',
      vertical: 'home-improvement',
      description: 'National home improvement leads',
      bid_floor: 12.50,
      daily_cap: 100,
      monthly_cap: 3000,
      quality_threshold: 8.0,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'camp-2',
      name: 'Insurance - California',
      supplier_id: 'supplier-1',
      vertical: 'insurance',
      description: 'California insurance leads',
      bid_floor: 18.00,
      daily_cap: 50,
      monthly_cap: 1500,
      quality_threshold: 9.0,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
      updated_at: new Date().toISOString(),
    }
  ]

  private static buyers: BuyerRecord[] = [
    {
      id: 'buyer-1',
      user_id: 'user-buyer-1',
      company_name: 'Demo Buyer Co.',
      contact_email: 'buyer@demobuyerco.com',
      phone: '+1-555-0123',
      website: 'https://demobuyerco.com',
      description: 'Leading home improvement buyer',
      is_verified: true,
      credit_limit: 50000,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'buyer-2',
      user_id: 'user-buyer-2',
      company_name: 'Insurance Pro LLC',
      contact_email: 'contact@insurancepro.com',
      phone: '+1-555-0456',
      website: 'https://insurancepro.com',
      description: 'Insurance leads specialist',
      is_verified: true,
      credit_limit: 75000,
      created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
      updated_at: new Date().toISOString(),
    }
  ]

  private static calls: CallRecord[] = [
    {
      id: 'call-1',
      campaign_id: 'camp-1',
      supplier_id: 'supplier-1',
      buyer_campaign_id: 'buyer-camp-1',
      caller_number: '+1-555-123-4567',
      tracking_number: '+1-800-DEMO-123',
      started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      duration_seconds: 180,
      status: 'completed',
      quality_score: 8.5,
      payout_amount: 12.50,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'call-2',
      campaign_id: 'camp-2',
      supplier_id: 'supplier-1',
      buyer_campaign_id: 'buyer-camp-2',
      caller_number: '+1-555-987-6543',
      tracking_number: '+1-800-DEMO-456',
      started_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      duration_seconds: 245,
      status: 'completed',
      quality_score: 9.2,
      payout_amount: 18.00,
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'call-3',
      campaign_id: 'camp-1',
      supplier_id: 'supplier-1',
      buyer_campaign_id: 'buyer-camp-1',
      caller_number: '+1-555-111-2222',
      tracking_number: '+1-800-DEMO-789',
      started_at: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
      duration_seconds: 95,
      status: 'failed',
      quality_score: 3.0,
      payout_amount: 0,
      created_at: new Date(Date.now() - 10800000).toISOString(),
      updated_at: new Date(Date.now() - 10800000).toISOString(),
    }
  ]

  // Mock API methods
  static async getSupplierStats(supplierId: string, timeRange: string) {
    if (!isDevelopment) {
      throw new Error('Mock data service should only be used in development')
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200))

    // In a real implementation, supplierId would filter the stats
    console.debug(`Getting stats for supplier ${supplierId} with timeRange ${timeRange}`)
    
    const multiplier = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30
    
    return {
      totalCalls: Math.floor(Math.random() * 50 + 20) * multiplier,
      callsTrend: Math.round((Math.random() * 10 - 5) * 10) / 10,
      totalMinutes: Math.floor(Math.random() * 400 + 200) * multiplier,
      minutesTrend: Math.round((Math.random() * 8 - 4) * 10) / 10,
      conversionRate: Math.round((Math.random() * 20 + 10) * 10) / 10,
      conversionTrend: Math.round((Math.random() * 4 - 2) * 10) / 10,
      qualityScore: Math.floor(Math.random() * 20 + 80),
      qualityTrend: Math.round((Math.random() * 2 - 1) * 10) / 10,
    }
  }

  static async getRecentCalls(supplierId: string): Promise<Array<{
    id: string
    created_at: string
    caller_number: string
    duration: number
    status: 'active' | 'completed' | 'failed'
    buyer_name: string
    campaign_name: string
    payout: number
    quality_score?: number
  }>> {
    if (!isDevelopment) {
      throw new Error('Mock data service should only be used in development')
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 150))

    // Filter calls for this supplier and enrich with related data
    const supplierCalls = this.calls
      .filter(call => call.supplier_id === supplierId)
      .slice(0, 10) // Limit to 10 recent calls

    return supplierCalls.map(call => {
      const campaign = this.campaigns.find(c => c.id === call.campaign_id)
      const buyer = this.buyers[Math.floor(Math.random() * this.buyers.length)] // Random buyer for demo

      return {
        id: call.id,
        created_at: call.started_at || call.created_at,
        caller_number: call.caller_number,
        duration: call.duration_seconds || 0,
        status: this.mapCallStatus(call.status),
        buyer_name: buyer?.company_name || 'Unknown Buyer',
        campaign_name: campaign?.name || 'Unknown Campaign',
        payout: call.payout_amount || 0,
        quality_score: call.quality_score ?? undefined
      }
    })
  }

  static async getActiveCampaigns(supplierId: string) {
    if (!isDevelopment) {
      throw new Error('Mock data service should only be used in development')
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))

    // Filter campaigns for this supplier and enrich with stats
    return this.campaigns
      .filter(campaign => campaign.supplier_id === supplierId)
      .map(campaign => {
        const buyer = this.buyers[Math.floor(Math.random() * this.buyers.length)]
        
        return {
          id: campaign.id,
          name: campaign.name,
          buyer_name: buyer?.company_name || 'Unknown Buyer',
          status: campaign.status,
          bid_amount: campaign.bid_floor,
          daily_cap: campaign.daily_cap || 100,
          calls_today: Math.floor(Math.random() * 50 + 10),
          revenue_today: Math.floor(Math.random() * 500 + 100),
          conversion_rate: Math.round((Math.random() * 25 + 10) * 10) / 10,
          quality_score: Math.round((Math.random() * 30 + 70) * 10) / 10,
          created_at: campaign.created_at
        }
      })
  }

  private static mapCallStatus(status: string): 'active' | 'completed' | 'failed' {
    switch (status) {
      case 'initiated':
      case 'ringing':
      case 'connected':
        return 'active'
      case 'completed':
        return 'completed'
      case 'failed':
      case 'rejected':
        return 'failed'
      default:
        return 'completed'
    }
  }

  // Environment flag helpers
  static isDevelopmentMode(): boolean {
    return isDevelopment
  }

  static logMockUsage(componentName: string, method: string) {
    if (isDevelopment) {
      console.info(`🔧 ${componentName} using mock data: ${method}`)
    }
  }
}

// Helper function to conditionally use mock vs real data
export function useMockDataInDevelopment() {
  return MockDataService.isDevelopmentMode()
}