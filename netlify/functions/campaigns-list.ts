import type { Handler } from '@netlify/functions'
import { requireRole, ApiError } from '../../src/lib/auth-middleware'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
  vertical: z.string().optional(),
  search: z.string().optional(),
})

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  return requireRole(['supplier', 'buyer', 'admin'])(event, async (context) => {
    const queryParams = querySchema.parse(event.queryStringParameters || {})
    const { page, limit, status, vertical, search } = queryParams
    const offset = (page - 1) * limit

    let query = context.supabase.from('campaigns').select(
      `
        id,
        name,
        description,
        category,
        vertical,
        status,
        bid_floor,
        max_concurrent_calls,
        quality_threshold,
        targeting,
        created_at,
        updated_at,
        suppliers!campaigns_supplier_id_fkey (
          id,
          company_name,
          users!suppliers_user_id_fkey (
            first_name,
            last_name,
            email
          )
        )
      `,
      { count: 'exact' }
    )

    // Role-based filtering
    if (context.user?.role === 'supplier') {
      // Suppliers can only see campaigns they created
      const { data: supplierData } = await context.supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', context.user.id)
        .single()

      if (!supplierData) {
        throw new ApiError('Supplier profile not found', 404, 'SUPPLIER_NOT_FOUND')
      }

      query = query.eq('supplier_id', supplierData.id)
    } else if (context.user?.role === 'buyer') {
      // Buyers can see all active campaigns or their own buyer campaigns
      // For this endpoint, show active campaigns they can bid on
      query = query.eq('status', 'active')
    }
    // Admins can see all campaigns (no additional filtering)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (vertical) {
      query = query.eq('vertical', vertical)
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`
      )
    }

    // Apply pagination and ordering
    const {
      data: campaigns,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching campaigns:', error)
      throw new ApiError('Failed to fetch campaigns', 500, 'FETCH_FAILED')
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / limit)
    const hasNext = page < totalPages
    const hasPrev = page > 1

    return {
      success: true,
      data: campaigns || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext,
        hasPrev,
      },
    }
  })
}
