# Fraud Detection Integration

# Fraud Detection Structure
- `detector.ts` - Main fraud detection engine
- `rules.ts` - Fraud detection rules
- `scoring.ts` - Risk scoring algorithms
- `prevention.ts` - Prevention mechanisms
- `reporting.ts` - Fraud reporting and alerts

# Fraud Detection Engine
```tsx
export class FraudDetector {
  private rules: FraudRule[] = [];
  private threshold = 0.7; // Risk score threshold
  
  constructor() {
    this.loadRules();
  }
  
  async analyzeCall(callData: CallAnalysisData): Promise<FraudAnalysisResult> {
    const riskFactors: RiskFactor[] = [];
    let totalScore = 0;
    
    // Run all fraud detection rules
    for (const rule of this.rules) {
      const result = await rule.evaluate(callData);
      if (result.triggered) {
        riskFactors.push({
          ruleId: rule.id,
          name: rule.name,
          score: result.score,
          description: result.description,
          severity: result.severity,
        });
        totalScore += result.score;
      }
    }
    
    const normalizedScore = Math.min(totalScore, 1.0);
    const isFraud = normalizedScore >= this.threshold;
    
    const analysis: FraudAnalysisResult = {
      callId: callData.callId,
      riskScore: normalizedScore,
      isFraud,
      riskFactors,
      confidence: this.calculateConfidence(riskFactors),
      timestamp: new Date(),
    };
    
    // Store analysis result
    await this.storeAnalysisResult(analysis);
    
    // Take action if fraud detected
    if (isFraud) {
      await this.handleFraudDetected(analysis);
    }
    
    return analysis;
  }
  
  private async handleFraudDetected(analysis: FraudAnalysisResult) {
    // Flag the call
    await supabase
      .from('calls')
      .update({
        status: 'fraud',
        fraud_score: analysis.riskScore,
        quality_score: 0,
        payout_amount: 0,
      })
      .eq('id', analysis.callId);
    
    // Alert administrators
    await this.sendFraudAlert(analysis);
    
    // Block payout
    await this.blockPayout(analysis.callId);
  }
}
```

# Fraud Detection Rules
```tsx
interface FraudRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evaluate: (data: CallAnalysisData) => Promise<RuleResult>;
}

export const FRAUD_RULES: FraudRule[] = [
  {
    id: 'duplicate_caller',
    name: 'Duplicate Caller Detection',
    description: 'Detects multiple calls from same number in short time',
    enabled: true,
    severity: 'high',
    evaluate: async (data) => {
      const recentCalls = await supabase
        .from('calls')
        .select('*')
        .eq('caller_number', data.callerNumber)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
        .neq('id', data.callId);
      
      const count = recentCalls.data?.length || 0;
      
      if (count >= 3) {
        return {
          triggered: true,
          score: Math.min(count * 0.2, 0.8),
          description: `${count} calls from same number in last hour`,
          severity: 'high',
        };
      }
      
      return { triggered: false, score: 0 };
    },
  },
  
  {
    id: 'short_call_duration',
    name: 'Short Call Duration',
    description: 'Flags unusually short calls',
    enabled: true,
    severity: 'medium',
    evaluate: async (data) => {
      if (data.duration < 30) { // Less than 30 seconds
        return {
          triggered: true,
          score: 0.4,
          description: `Call duration only ${data.duration} seconds`,
          severity: 'medium',
        };
      }
      
      return { triggered: false, score: 0 };
    },
  },
  
  {
    id: 'geographic_anomaly',
    name: 'Geographic Anomaly',
    description: 'Detects calls from unexpected locations',
    enabled: true,
    severity: 'medium',
    evaluate: async (data) => {
      const callerState = await this.getCallerState(data.callerNumber);
      const campaignStates = data.campaign.filters.states || [];
      
      if (campaignStates.length > 0 && !campaignStates.includes(callerState)) {
        return {
          triggered: true,
          score: 0.5,
          description: `Call from ${callerState}, campaign targets ${campaignStates.join(', ')}`,
          severity: 'medium',
        };
      }
      
      return { triggered: false, score: 0 };
    },
  },
  
  {
    id: 'velocity_check',
    name: 'Call Velocity Check',
    description: 'Detects unusually high call volume from supplier',
    enabled: true,
    severity: 'high',
    evaluate: async (data) => {
      const hourlyLimit = 100; // Max calls per hour per supplier
      
      const recentCalls = await supabase
        .from('calls')
        .select('id')
        .eq('supplier_id', data.supplierId)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString());
      
      const count = recentCalls.data?.length || 0;
      
      if (count > hourlyLimit) {
        return {
          triggered: true,
          score: 0.9,
          description: `${count} calls in last hour (limit: ${hourlyLimit})`,
          severity: 'critical',
        };
      }
      
      return { triggered: false, score: 0 };
    },
  },
];
```

# Risk Scoring System
```tsx
export class RiskScorer {
  calculateCallRiskScore(call: Call, context: CallContext): number {
    let score = 0;
    
    // Duration-based scoring
    score += this.scoreDuration(call.duration);
    
    // Time-based scoring
    score += this.scoreTimeOfDay(call.created_at);
    
    // Caller history scoring
    score += this.scoreCallerHistory(call.caller_number, context);
    
    // Supplier reputation scoring
    score += this.scoreSupplierReputation(call.supplier_id, context);
    
    // Campaign compliance scoring
    score += this.scoreCampaignCompliance(call, context.campaign);
    
    return Math.min(score, 1.0);
  }
  
  private scoreDuration(duration: number): number {
    if (duration < 10) return 0.8; // Very short calls are suspicious
    if (duration < 30) return 0.4;
    if (duration > 1800) return 0.2; // Very long calls might be suspicious
    return 0; // Normal duration
  }
  
  private scoreTimeOfDay(timestamp: string): number {
    const hour = new Date(timestamp).getHours();
    
    // Calls outside business hours are more suspicious
    if (hour < 6 || hour > 22) return 0.3;
    if (hour < 8 || hour > 20) return 0.1;
    return 0;
  }
  
  private async scoreCallerHistory(callerNumber: string, context: CallContext): Promise<number> {
    const history = await this.getCallerHistory(callerNumber, 30); // Last 30 days
    
    if (history.totalCalls === 0) return 0.1; // New caller, slight risk
    
    const fraudRate = history.fraudCalls / history.totalCalls;
    return fraudRate * 0.8; // Scale fraud rate
  }
}
```

# Real-time Fraud Prevention
```tsx
export class FraudPrevention {
  async checkCallAllowed(callData: IncomingCallData): Promise<CallDecision> {
    // Quick pre-checks before allowing call
    const checks = await Promise.all([
      this.checkBlacklist(callData.callerNumber),
      this.checkRateLimit(callData.supplierId),
      this.checkCampaignFilters(callData),
      this.checkSupplierStatus(callData.supplierId),
    ]);
    
    const blocked = checks.some(check => check.blocked);
    
    if (blocked) {
      const reasons = checks
        .filter(check => check.blocked)
        .map(check => check.reason);
      
      return {
        allowed: false,
        reasons,
        action: 'block',
      };
    }
    
    return { allowed: true, action: 'allow' };
  }
  
  private async checkBlacklist(callerNumber: string): Promise<CheckResult> {
    const { data: blacklisted } = await supabase
      .from('phone_blacklist')
      .select('*')
      .eq('phone_number', callerNumber)
      .single();
    
    return {
      blocked: !!blacklisted,
      reason: blacklisted ? 'Caller number is blacklisted' : undefined,
    };
  }
  
  async addToBlacklist(phoneNumber: string, reason: string, addedBy: string) {
    await supabase.from('phone_blacklist').insert({
      phone_number: phoneNumber,
      reason,
      added_by: addedBy,
      created_at: new Date(),
    });
    
    // Immediately block any active calls from this number
    await this.blockActiveCallsFromNumber(phoneNumber);
  }
}
```

# Machine Learning Integration
```tsx
export class MLFraudDetector {
  private model: MLModel | null = null;
  
  async initialize() {
    // Load pre-trained fraud detection model
    this.model = await this.loadModel();
  }
  
  async predictFraud(features: CallFeatures): Promise<MLPrediction> {
    if (!this.model) {
      throw new Error('ML model not initialized');
    }
    
    const prediction = await this.model.predict(features);
    
    return {
      fraudProbability: prediction.probability,
      confidence: prediction.confidence,
      features: this.explainFeatures(features, prediction),
    };
  }
  
  async retrainModel() {
    // Collect recent fraud data for model retraining
    const trainingData = await this.collectTrainingData();
    
    // Retrain model with new data
    this.model = await this.trainModel(trainingData);
    
    // Validate model performance
    const metrics = await this.validateModel(this.model);
    
    if (metrics.accuracy < 0.85) {
      throw new Error('Model performance below threshold');
    }
  }
}
```

# Fraud Reporting
```tsx
export class FraudReporter {
  async generateFraudReport(params: FraudReportParams): Promise<FraudReport> {
    const { startDate, endDate, supplierId, campaignId } = params;
    
    const fraudStats = await this.getFraudStatistics(params);
    const trends = await this.getFraudTrends(params);
    const topRisks = await this.getTopRiskFactors(params);
    
    return {
      period: { startDate, endDate },
      summary: {
        totalCalls: fraudStats.totalCalls,
        fraudCalls: fraudStats.fraudCalls,
        fraudRate: fraudStats.fraudRate,
        blockedAmount: fraudStats.blockedAmount,
      },
      trends,
      topRisks,
      recommendations: this.generateRecommendations(fraudStats),
    };
  }
  
  private generateRecommendations(stats: FraudStatistics): string[] {
    const recommendations: string[] = [];
    
    if (stats.fraudRate > 0.05) {
      recommendations.push('Consider tightening campaign filters');
    }
    
    if (stats.duplicateCallerRate > 0.1) {
      recommendations.push('Implement stricter duplicate caller detection');
    }
    
    if (stats.shortCallRate > 0.2) {
      recommendations.push('Review minimum call duration requirements');
    }
    
    return recommendations;
  }
}
```

# CRITICAL RULES
- NO regex in fraud detection logic
- NO any types in fraud interfaces
- ALWAYS validate fraud detection accuracy
- ALWAYS provide clear fraud explanations
- IMPLEMENT multiple detection layers
- TEST fraud detection thoroughly
- BALANCE false positives vs false negatives
- MAINTAIN audit trails for all decisions
- REGULARLY update fraud rules
- ENSURE fair treatment of legitimate traffic