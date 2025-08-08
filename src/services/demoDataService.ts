/**
 * Demo Data Service
 * 
 * Provides realistic mock data for demonstrating platform features
 * to non-authenticated users. All data is generated client-side
 * and does not persist or connect to real services.
 * 
 * Security: This service only provides read-only demo data and
 * cannot perform any real operations.
 */

import { UserRole } from '../types/auth'

// Types for demo data
export interface DemoCampaign {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed'
  vertical: string
  payout: number
  dailyBudget: number
  callsReceived: number
  totalPayout: number
  conversionRate: number
  qualityScore: number
  createdAt: string
  lastCallAt?: string
}

export interface DemoCall {
  id: string
  campaignId: string
  campaignName: string
  duration: number
  quality: 'excellent' | 'good' | 'poor'
  status: 'completed' | 'in_progress' | 'missed'
  callerState: string
  callerCity: string
  timestamp: string
  payout: number
  qualityScore: number
}

export interface DemoAnalytics {
  totalCalls: number
  totalRevenue: number
  averageCallDuration: number
  conversionRate: number
  topPerformingCampaigns: Array<{
    name: string
    calls: number
    revenue: number
  }>
  callsByHour: Array<{
    hour: number
    calls: number
  }>
  callsByState: Array<{
    state: string
    calls: number
  }>
  recentActivity: Array<{
    id: string
    type: string
    description: string
    timestamp: string
  }>
}

class DemoDataService {
  private campaigns: Map<UserRole, DemoCampaign[]> = new Map()
  private calls: Map<UserRole, DemoCall[]> = new Map()
  private analytics: Map<UserRole, DemoAnalytics> = new Map()

  constructor() {
    this.generateDemoData()
  }

  private generateDemoData(): void {
    // Generate supplier demo data
    this.campaigns.set('supplier', this.generateSupplierCampaigns())
    this.calls.set('supplier', this.generateSupplierCalls())
    this.analytics.set('supplier', this.generateSupplierAnalytics())

    // Generate buyer demo data
    this.campaigns.set('buyer', this.generateBuyerCampaigns())
    this.calls.set('buyer', this.generateBuyerCalls())
    this.analytics.set('buyer', this.generateBuyerAnalytics())

    // Generate admin demo data (combination of all data)
    this.campaigns.set('admin', [
      ...this.generateSupplierCampaigns(),
      ...this.generateBuyerCampaigns(),
    ])
    this.calls.set('admin', [
      ...this.generateSupplierCalls(),
      ...this.generateBuyerCalls(),
    ])
    this.analytics.set('admin', this.generateAdminAnalytics())

    // Network data is similar to admin but with network-focused metrics
    this.campaigns.set('network', this.campaigns.get('admin') || [])
    this.calls.set('network', this.calls.get('admin') || [])
    this.analytics.set('network', this.generateNetworkAnalytics())
  }

  private generateSupplierCampaigns(): DemoCampaign[] {
    return [
      {
        id: 'camp-1',
        name: 'Home Security Leads - Premium',
        status: 'active',
        vertical: 'Home Security',
        payout: 45.00,
        dailyBudget: 2500,
        callsReceived: 127,
        totalPayout: 5715.00,
        conversionRate: 0.78,
        qualityScore: 9.2,
        createdAt: '2025-01-15T10:00:00Z',
        lastCallAt: '2025-01-20T14:32:00Z'
      },
      {
        id: 'camp-2',
        name: 'Solar Installation - California',
        status: 'active',
        vertical: 'Solar Energy',
        payout: 85.00,
        dailyBudget: 1800,
        callsReceived: 89,
        totalPayout: 7565.00,
        conversionRate: 0.82,
        qualityScore: 8.8,
        createdAt: '2025-01-10T09:30:00Z',
        lastCallAt: '2025-01-20T16:15:00Z'
      },
      {
        id: 'camp-3',
        name: 'Medicare Insurance - Nationwide',
        status: 'paused',
        vertical: 'Insurance',
        payout: 25.00,
        dailyBudget: 1200,
        callsReceived: 234,
        totalPayout: 5850.00,
        conversionRate: 0.65,
        qualityScore: 7.9,
        createdAt: '2024-12-20T08:00:00Z',
        lastCallAt: '2025-01-18T11:45:00Z'
      },
      {
        id: 'camp-4',
        name: 'Debt Consolidation - High Intent',
        status: 'active',
        vertical: 'Financial Services',
        payout: 35.00,
        dailyBudget: 3000,
        callsReceived: 156,
        totalPayout: 5460.00,
        conversionRate: 0.71,
        qualityScore: 8.4,
        createdAt: '2025-01-05T12:00:00Z',
        lastCallAt: '2025-01-20T17:22:00Z'
      }
    ]
  }

  private generateBuyerCampaigns(): DemoCampaign[] {
    return [
      {
        id: 'buy-camp-1',
        name: 'Premium Mortgage Leads',
        status: 'active',
        vertical: 'Mortgage',
        payout: 55.00,
        dailyBudget: 5000,
        callsReceived: 198,
        totalPayout: 10890.00,
        conversionRate: 0.84,
        qualityScore: 9.1,
        createdAt: '2025-01-12T10:00:00Z',
        lastCallAt: '2025-01-20T15:45:00Z'
      },
      {
        id: 'buy-camp-2',
        name: 'Auto Insurance - Texas Market',
        status: 'active',
        vertical: 'Insurance',
        payout: 28.00,
        dailyBudget: 2800,
        callsReceived: 267,
        totalPayout: 7476.00,
        conversionRate: 0.79,
        qualityScore: 8.6,
        createdAt: '2025-01-08T11:30:00Z',
        lastCallAt: '2025-01-20T16:30:00Z'
      }
    ]
  }

  private generateSupplierCalls(): DemoCall[] {
    const calls: DemoCall[] = []
    const campaigns = this.campaigns.get('supplier') || []
    
    // Generate calls for the last 7 days
    for (let day = 6; day >= 0; day--) {
      const date = new Date()
      date.setDate(date.getDate() - day)
      
      // Generate 10-20 calls per day
      const callCount = Math.floor(Math.random() * 11) + 10
      
      for (let i = 0; i < callCount; i++) {
        const campaign = campaigns[Math.floor(Math.random() * campaigns.length)]
        const hour = Math.floor(Math.random() * 12) + 8 // Business hours 8-20
        const minute = Math.floor(Math.random() * 60)
        
        const callDate = new Date(date)
        callDate.setHours(hour, minute, 0, 0)
        
        const qualities = ['excellent', 'good', 'poor'] as const
        const quality = qualities[Math.floor(Math.random() * qualities.length)]
        const qualityScore = quality === 'excellent' ? Math.random() * 2 + 8 : 
                           quality === 'good' ? Math.random() * 3 + 5 : 
                           Math.random() * 2 + 3
        
        calls.push({
          id: `call-${calls.length + 1}`,
          campaignId: campaign.id,
          campaignName: campaign.name,
          duration: Math.floor(Math.random() * 600) + 120, // 2-12 minutes
          quality,
          status: Math.random() > 0.05 ? 'completed' : 'missed',
          callerState: this.getRandomState(),
          callerCity: this.getRandomCity(),
          timestamp: callDate.toISOString(),
          payout: campaign.payout,
          qualityScore: Number(qualityScore.toFixed(1))
        })
      }
    }
    
    return calls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  private generateBuyerCalls(): DemoCall[] {
    const calls: DemoCall[] = []
    const campaigns = this.campaigns.get('buyer') || []
    
    // Similar generation logic but for buyer campaigns
    for (let day = 6; day >= 0; day--) {
      const date = new Date()
      date.setDate(date.getDate() - day)
      
      const callCount = Math.floor(Math.random() * 15) + 15 // More calls for buyers
      
      for (let i = 0; i < callCount; i++) {
        const campaign = campaigns[Math.floor(Math.random() * campaigns.length)]
        const hour = Math.floor(Math.random() * 12) + 8
        const minute = Math.floor(Math.random() * 60)
        
        const callDate = new Date(date)
        callDate.setHours(hour, minute, 0, 0)
        
        const qualities = ['excellent', 'good', 'poor'] as const
        const quality = qualities[Math.floor(Math.random() * qualities.length)]
        const qualityScore = quality === 'excellent' ? Math.random() * 2 + 8 : 
                           quality === 'good' ? Math.random() * 3 + 5 : 
                           Math.random() * 2 + 3
        
        calls.push({
          id: `buy-call-${calls.length + 1}`,
          campaignId: campaign.id,
          campaignName: campaign.name,
          duration: Math.floor(Math.random() * 800) + 180, // 3-16 minutes
          quality,
          status: Math.random() > 0.03 ? 'completed' : 'missed',
          callerState: this.getRandomState(),
          callerCity: this.getRandomCity(),
          timestamp: callDate.toISOString(),
          payout: campaign.payout,
          qualityScore: Number(qualityScore.toFixed(1))
        })
      }
    }
    
    return calls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  private generateSupplierAnalytics(): DemoAnalytics {
    const campaigns = this.campaigns.get('supplier') || []
    const calls = this.calls.get('supplier') || []
    
    return {
      totalCalls: calls.length,
      totalRevenue: calls.reduce((sum, call) => sum + call.payout, 0),
      averageCallDuration: calls.reduce((sum, call) => sum + call.duration, 0) / calls.length,
      conversionRate: 0.76,
      topPerformingCampaigns: campaigns
        .map(campaign => ({
          name: campaign.name,
          calls: calls.filter(call => call.campaignId === campaign.id).length,
          revenue: calls.filter(call => call.campaignId === campaign.id)
            .reduce((sum, call) => sum + call.payout, 0)
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3),
      callsByHour: this.generateHourlyData(calls),
      callsByState: this.generateStateData(calls),
      recentActivity: this.generateRecentActivity('supplier')
    }
  }

  private generateBuyerAnalytics(): DemoAnalytics {
    const campaigns = this.campaigns.get('buyer') || []
    const calls = this.calls.get('buyer') || []
    
    return {
      totalCalls: calls.length,
      totalRevenue: calls.reduce((sum, call) => sum + call.payout, 0),
      averageCallDuration: calls.reduce((sum, call) => sum + call.duration, 0) / calls.length,
      conversionRate: 0.81,
      topPerformingCampaigns: campaigns
        .map(campaign => ({
          name: campaign.name,
          calls: calls.filter(call => call.campaignId === campaign.id).length,
          revenue: calls.filter(call => call.campaignId === campaign.id)
            .reduce((sum, call) => sum + call.payout, 0)
        }))
        .sort((a, b) => b.revenue - a.revenue),
      callsByHour: this.generateHourlyData(calls),
      callsByState: this.generateStateData(calls),
      recentActivity: this.generateRecentActivity('buyer')
    }
  }

  private generateAdminAnalytics(): DemoAnalytics {
    const allCalls = [
      ...(this.calls.get('supplier') || []),
      ...(this.calls.get('buyer') || [])
    ]
    
    return {
      totalCalls: allCalls.length,
      totalRevenue: allCalls.reduce((sum, call) => sum + call.payout, 0),
      averageCallDuration: allCalls.reduce((sum, call) => sum + call.duration, 0) / allCalls.length,
      conversionRate: 0.78,
      topPerformingCampaigns: [
        { name: 'Premium Mortgage Leads', calls: 198, revenue: 10890.00 },
        { name: 'Auto Insurance - Texas Market', calls: 267, revenue: 7476.00 },
        { name: 'Solar Installation - California', calls: 89, revenue: 7565.00 }
      ],
      callsByHour: this.generateHourlyData(allCalls),
      callsByState: this.generateStateData(allCalls),
      recentActivity: this.generateRecentActivity('admin')
    }
  }

  private generateNetworkAnalytics(): DemoAnalytics {
    const adminAnalytics = this.generateAdminAnalytics()
    
    return {
      ...adminAnalytics,
      // Network-specific metrics would go here
      recentActivity: this.generateRecentActivity('network')
    }
  }

  private generateHourlyData(calls: DemoCall[]): Array<{hour: number, calls: number}> {
    const hourlyData = new Array(24).fill(0).map((_, hour) => ({ hour, calls: 0 }))
    
    calls.forEach(call => {
      const hour = new Date(call.timestamp).getHours()
      hourlyData[hour].calls++
    })
    
    return hourlyData
  }

  private generateStateData(calls: DemoCall[]): Array<{state: string, calls: number}> {
    const stateData = new Map<string, number>()
    
    calls.forEach(call => {
      const current = stateData.get(call.callerState) || 0
      stateData.set(call.callerState, current + 1)
    })
    
    return Array.from(stateData.entries())
      .map(([state, calls]) => ({ state, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10)
  }

  private generateRecentActivity(userType: UserRole): Array<{id: string, type: string, description: string, timestamp: string}> {
    const activities = []
    const now = new Date()
    
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - (i * 1000 * 60 * Math.random() * 120)) // Last 2 hours
      
      const activityTypes = userType === 'supplier' 
        ? ['call_completed', 'payout_processed']
        : userType === 'buyer'
        ? ['call_completed', 'campaign_paused']
        : ['call_completed', 'campaign_paused', 'payout_processed']
      
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)]
      
      let description = ''
      switch (type) {
        case 'call_completed':
          description = `High-quality call completed for ${this.getRandomCampaignName(userType)}`
          break
        case 'campaign_paused':
          description = `Campaign "${this.getRandomCampaignName(userType)}" paused due to budget cap`
          break
        case 'payout_processed':
          description = `Payout of $${(Math.random() * 100 + 25).toFixed(2)} processed`
          break
      }
      
      activities.push({
        id: `activity-${i}`,
        type,
        description,
        timestamp: timestamp.toISOString()
      })
    }
    
    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  private getRandomState(): string {
    const states = ['California', 'Texas', 'Florida', 'New York', 'Pennsylvania', 'Illinois', 'Ohio', 'Georgia', 'North Carolina', 'Michigan']
    return states[Math.floor(Math.random() * states.length)]
  }

  private getRandomCity(): string {
    const cities = ['Los Angeles', 'Houston', 'Miami', 'New York', 'Philadelphia', 'Chicago', 'Columbus', 'Atlanta', 'Charlotte', 'Detroit']
    return cities[Math.floor(Math.random() * cities.length)]
  }

  private getRandomCampaignName(userType: UserRole): string {
    const supplierCampaigns = ['Home Security Leads', 'Solar Installation', 'Medicare Insurance', 'Debt Consolidation']
    const buyerCampaigns = ['Premium Mortgage Leads', 'Auto Insurance - Texas']
    const allCampaigns = [...supplierCampaigns, ...buyerCampaigns]
    
    const campaigns = userType === 'supplier' ? supplierCampaigns :
                     userType === 'buyer' ? buyerCampaigns :
                     allCampaigns
    
    return campaigns[Math.floor(Math.random() * campaigns.length)]
  }

  // Public API methods
  getDemoCampaigns(userType: UserRole): DemoCampaign[] {
    return this.campaigns.get(userType) || []
  }

  getDemoCalls(userType: UserRole): DemoCall[] {
    return this.calls.get(userType) || []
  }

  getDemoAnalytics(userType: UserRole): DemoAnalytics {
    return this.analytics.get(userType) || {
      totalCalls: 0,
      totalRevenue: 0,
      averageCallDuration: 0,
      conversionRate: 0,
      topPerformingCampaigns: [],
      callsByHour: [],
      callsByState: [],
      recentActivity: []
    }
  }

  // Simulate real-time updates for demo
  getRealtimeUpdate(userType: UserRole): DemoCall | null {
    // Occasionally return a "new" call for demonstration
    if (Math.random() > 0.95) {
      const campaigns = this.campaigns.get(userType) || []
      if (campaigns.length === 0) return null
      
      const campaign = campaigns[Math.floor(Math.random() * campaigns.length)]
      const now = new Date()
      
      return {
        id: `realtime-call-${Date.now()}`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        duration: Math.floor(Math.random() * 600) + 120,
        quality: Math.random() > 0.7 ? 'excellent' : 'good',
        status: 'in_progress',
        callerState: this.getRandomState(),
        callerCity: this.getRandomCity(),
        timestamp: now.toISOString(),
        payout: campaign.payout,
        qualityScore: Number((Math.random() * 2 + 8).toFixed(1))
      }
    }
    
    return null
  }
}

// Export singleton instance
export const demoDataService = new DemoDataService()