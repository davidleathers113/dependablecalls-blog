export * from './users'
export * from './campaigns'
export * from './calls'

// Factory helper to create multiple instances
export const createMany = <T>(factory: () => T, count: number): T[] => {
  return Array.from({ length: count }, factory)
}

// Utility to create test data with relationships
export const createTestScenario = () => {
  const supplier = createTestSupplier({ email: 'supplier@scenario.com' })
  const buyer = createTestBuyer({ email: 'buyer@scenario.com' })
  const campaign = createTestCampaign({ buyerId: buyer.id })
  const calls = createMany(() => createTestCall({ 
    campaignId: campaign.id,
    supplierId: supplier.id,
    buyerId: buyer.id 
  }), 5)
  
  return { supplier, buyer, campaign, calls }
}

// Re-export specific test data sets
export { testUsers } from './users'
export { testCampaigns } from './campaigns'  
export { testCalls } from './calls'