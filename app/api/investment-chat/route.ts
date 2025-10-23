import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a professional investment advisor AI with expertise in portfolio management. Your role:

COMMUNICATION STYLE:
- Be CONCISE and ACTIONABLE - keep responses 2-4 sentences unless explaining complex strategy
- Ask ONE specific question at a time when gathering info
- Use a friendly, confident tone like a trusted advisor
- Reference the user's current portfolio naturally in conversation
- Acknowledge user concerns and preferences

INFORMATION GATHERING (Ask in order):
1. Age or life stage (20s, 40s, retirement)
2. Risk tolerance (conservative, moderate, aggressive)
3. Investment timeline (short <5yrs, medium 5-10yrs, long >10yrs)
4. Primary goal (growth, income, preservation, retirement)
5. Income level or investable amount (optional but helpful)

Once you have 3-4 key pieces of info, suggest a portfolio.

PORTFOLIO STRATEGY GUIDELINES:

**Aggressive (High Risk, High Growth)**
- Ages 20-35, long timeline, growth-focused
- 80-90% stocks, 10-20% bonds/alternatives
- Example: 50% US Large Cap, 20% International, 15% Small Cap, 10% Bonds, 5% REITs

**Moderate (Balanced)**
- Ages 35-55, medium timeline, balanced goals
- 60-70% stocks, 30-40% bonds/stable
- Example: 40% US Large Cap, 15% International, 10% Small Cap, 25% Bonds, 10% REITs

**Conservative (Low Risk, Preservation)**
- Ages 55+, short timeline, income/preservation
- 30-50% stocks, 50-70% bonds/stable
- Example: 25% US Large Cap, 10% International, 40% Bonds, 15% REITs, 10% Cash

PORTFOLIO CATEGORIES (use relevant ones):
- US Large Cap Stocks (S&P 500 index funds)
- International Stocks (Developed & emerging markets)
- Small Cap Stocks (Higher growth potential)
- Government Bonds (Treasury, municipal)
- Corporate Bonds (Investment grade)
- Real Estate (REITs for diversification)
- Commodities (Gold, inflation hedge)
- Cash/Money Market (Emergency fund, liquidity)

PORTFOLIO UPDATE FORMAT:
CRITICAL: When creating or updating a portfolio, you MUST include this EXACT format in your response:

[UPDATE_PORTFOLIO]
[{"category": "US Large Cap Stocks", "percentage": 40, "description": "S&P 500 index funds for core growth"},
{"category": "International Stocks", "percentage": 20, "description": "Exposure to developed & emerging markets"},
{"category": "Bonds", "percentage": 20, "description": "Government bonds for stability"}]

You can write text before and after, but the [UPDATE_PORTFOLIO] tag followed by the JSON array is MANDATORY.
The percentages MUST add up to approximately 100.

Example response:
"Perfect. With wealth accumulation in mind, here's a suggested aggressive portfolio for you:

[UPDATE_PORTFOLIO]
[{"category": "US Large Cap Stocks", "percentage": 45, "description": "S&P 500 index funds"},
{"category": "International Stocks", "percentage": 25, "description": "Emerging markets growth"},
{"category": "Small Cap Stocks", "percentage": 15, "description": "Higher growth potential"},
{"category": "REITs", "percentage": 10, "description": "Real estate diversification"},
{"category": "Bonds", "percentage": 5, "description": "Minimal stability buffer"}]

This blend aims to maximize growth while providing some diversification. How does this align with your thoughts?"

CONTEXT AWARENESS:
- Always acknowledge the current portfolio state
- When suggesting changes, explain WHY (e.g., "Since you're 28 and have a long timeline, we can be more aggressive")
- If user asks to adjust, make smart incremental changes
- Validate that suggestions align with their stated risk tolerance

REBALANCING:
- Suggest rebalancing if allocation drifts >5% from targets
- Recommend annual reviews
- Consider tax implications

Be conversational, not robotic. Think like a human financial advisor who cares about the client's success.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface InvestmentAllocation {
  category: string;
  percentage: number;
  description?: string;
}

// Fallback portfolio generator
function generateDefaultPortfolio(userInfo: any): InvestmentAllocation[] {
  const age = parseInt(userInfo.age) || 30;
  const riskTolerance = userInfo.riskTolerance?.toLowerCase() || 'moderate';
  
  // Aggressive portfolio (high growth)
  if (riskTolerance.includes('aggressive') || age < 35) {
    return [
      { category: "US Large Cap Stocks", percentage: 45, description: "S&P 500 index funds for core growth" },
      { category: "International Stocks", percentage: 25, description: "Emerging markets & developed international" },
      { category: "Small Cap Stocks", percentage: 15, description: "Higher growth potential" },
      { category: "Real Estate (REITs)", percentage: 10, description: "Diversification & income" },
      { category: "Bonds", percentage: 5, description: "Stability buffer" }
    ];
  }
  
  // Conservative portfolio (preservation)
  if (riskTolerance.includes('conservative') || age > 55) {
    return [
      { category: "US Large Cap Stocks", percentage: 25, description: "Blue chip stability" },
      { category: "International Stocks", percentage: 10, description: "Global diversification" },
      { category: "Government Bonds", percentage: 40, description: "Safe, stable income" },
      { category: "Corporate Bonds", percentage: 15, description: "Higher yield bonds" },
      { category: "Real Estate (REITs)", percentage: 10, description: "Income generation" }
    ];
  }
  
  // Moderate/Balanced portfolio (default)
  return [
    { category: "US Large Cap Stocks", percentage: 35, description: "S&P 500 core holdings" },
    { category: "International Stocks", percentage: 20, description: "Global market exposure" },
    { category: "Small Cap Stocks", percentage: 10, description: "Growth opportunities" },
    { category: "Bonds", percentage: 25, description: "Stability & income" },
    { category: "Real Estate (REITs)", percentage: 10, description: "Diversification" }
  ];
}

export async function POST(request: NextRequest) {
  try {
    const { message, context, userId, conversationHistory } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create Supabase client with user's auth token (only if user is logged in)
    let supabase = null;
    if (userId) {
      const authHeader = request.headers.get('authorization');
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: authHeader ? { Authorization: authHeader } : {}
          }
        }
      );
    }

    // Build context message about current state
    let contextMessage = '';
    if (context.hasStrategy && context.currentStrategy) {
      const allocations = context.currentStrategy
        .map((s: InvestmentAllocation) => `${s.category}: ${s.percentage}%`)
        .join(', ');
      contextMessage = `Current portfolio: ${allocations}. `;
    } else {
      contextMessage = 'User has no portfolio yet. ';
    }

    if (context.userInfo && Object.keys(context.userInfo).length > 0) {
      const info = Object.entries(context.userInfo)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      contextMessage += `Known user info: ${info}.`;
    } else {
      contextMessage += 'Need to gather user information for personalized advice.';
    }

    // Extract user info from conversation before checking
    const userInfoToCheck: any = context.userInfo || {};
    
    // Combine all user messages for parsing
    const userMessages = conversationHistory
      .filter((m: Message) => m.role === 'user')
      .map((m: Message) => m.content.toLowerCase());
    
    const allUserText = [...userMessages, message.toLowerCase()].join(' ');
    
    // Quick extraction for decision making
    if (!userInfoToCheck.age && !userInfoToCheck.lifeStage) {
      const ageMatch = allUserText.match(/\b(\d{2})\s*(?:years old|year old|yo|yrs old|age|years)\b/) ||
                      allUserText.match(/(?:i'm|im|i am)\s*(\d{2})\b/);
      if (ageMatch) userInfoToCheck.age = ageMatch[1];
    }
    
    if (!userInfoToCheck.riskTolerance) {
      if (allUserText.match(/\b(?:aggressive|high risk)\b/)) {
        userInfoToCheck.riskTolerance = 'Aggressive';
      } else if (allUserText.match(/\b(?:moderate|balanced)\b/)) {
        userInfoToCheck.riskTolerance = 'Moderate';
      } else if (allUserText.match(/\b(?:conservative|low risk)\b/)) {
        userInfoToCheck.riskTolerance = 'Conservative';
      }
    }

    // Check if we have enough information to generate portfolio
    const shouldGeneratePortfolio = userInfoToCheck && 
      (userInfoToCheck.age || userInfoToCheck.lifeStage) &&
      userInfoToCheck.riskTolerance &&
      !context.hasStrategy;
    
    let additionalInstruction = '';
    if (shouldGeneratePortfolio) {
      additionalInstruction = '\n\nIMPORTANT: The user has provided enough information. You MUST now generate a portfolio allocation using the [UPDATE_PORTFOLIO] format in your response.';
    }

    // Build messages for OpenAI
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextMessage + additionalInstruction }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((msg: Message) => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantResponse = completion.choices[0].message.content || '';

    // Check if response contains portfolio update
    let strategyUpdated = false;
    let finalResponse = assistantResponse;
    let generatedStrategy = null;
    let generatedUserInfo = null;
    
    console.log('AI Response:', assistantResponse);
    
    if (assistantResponse.includes('[UPDATE_PORTFOLIO]')) {
      try {
        // Extract JSON from response - find the array after [UPDATE_PORTFOLIO]
        const startIdx = assistantResponse.indexOf('[UPDATE_PORTFOLIO]') + '[UPDATE_PORTFOLIO]'.length;
        const remainingText = assistantResponse.substring(startIdx).trim();
        
        // Find the JSON array
        let jsonStr = '';
        let bracketCount = 0;
        let startFound = false;
        
        for (let i = 0; i < remainingText.length; i++) {
          const char = remainingText[i];
          if (char === '[' && !startFound) {
            startFound = true;
            bracketCount = 1;
            jsonStr = '[';
          } else if (startFound) {
            jsonStr += char;
            if (char === '[') bracketCount++;
            if (char === ']') bracketCount--;
            if (bracketCount === 0) break;
          }
        }
        
        console.log('Extracted JSON:', jsonStr);
        
        if (jsonStr) {
          const portfolioData = JSON.parse(jsonStr);
          
          // Validate and normalize percentages
          const total = portfolioData.reduce((sum: number, item: InvestmentAllocation) => 
            sum + item.percentage, 0);
          
          const normalizedPortfolio = portfolioData.map((item: InvestmentAllocation) => ({
            category: item.category,
            percentage: Math.round((item.percentage / total) * 100),
            description: item.description || ''
          }));

          // Extract user info from the conversation if available
          const userInfoToSave: any = context.userInfo || {};
          
          // Combine all user messages for parsing
          const userMessages = conversationHistory
            .filter((m: Message) => m.role === 'user')
            .map((m: Message) => m.content.toLowerCase());
          
          const allUserText = [...userMessages, message.toLowerCase()].join(' ');
          
          // Extract age
          const ageMatch = allUserText.match(/\b(\d{2})\s*(?:years old|year old|yo|yrs old|age|years)\b/) ||
                          allUserText.match(/(?:i'm|im|i am)\s*(\d{2})\b/);
          if (ageMatch && !userInfoToSave.age) {
            userInfoToSave.age = ageMatch[1];
          }

          // Extract age ranges or life stage
          if (!userInfoToSave.age && !userInfoToSave.lifeStage) {
            if (allUserText.match(/\b(?:20s|twenties)\b/)) userInfoToSave.lifeStage = '20s';
            else if (allUserText.match(/\b(?:30s|thirties)\b/)) userInfoToSave.lifeStage = '30s';
            else if (allUserText.match(/\b(?:40s|forties)\b/)) userInfoToSave.lifeStage = '40s';
            else if (allUserText.match(/\b(?:50s|fifties)\b/)) userInfoToSave.lifeStage = '50s';
            else if (allUserText.match(/\b(?:retire|retirement|retired)\b/)) userInfoToSave.lifeStage = 'Retirement';
          }

          // Extract income
          const incomeMatch = allUserText.match(/\$(\d+)k?\s*(?:income|salary|earn|make|year|annual)/) ||
                             allUserText.match(/(?:income|salary|earn|make)\s*(?:is|of)?\s*\$?(\d+)k/);
          if (incomeMatch && !userInfoToSave.income) {
            const amount = incomeMatch[1];
            userInfoToSave.income = amount.length > 3 ? `$${amount}` : `$${amount}k`;
          }

          // Extract risk tolerance
          if (!userInfoToSave.riskTolerance) {
            if (allUserText.match(/\b(?:aggressive|high risk|very risky|maximum growth)\b/)) {
              userInfoToSave.riskTolerance = 'Aggressive';
            } else if (allUserText.match(/\b(?:moderate|balanced|medium risk|somewhat risky)\b/)) {
              userInfoToSave.riskTolerance = 'Moderate';
            } else if (allUserText.match(/\b(?:conservative|low risk|safe|cautious|avoid risk)\b/)) {
              userInfoToSave.riskTolerance = 'Conservative';
            }
          }

          // Extract investment timeline
          if (!userInfoToSave.timeline) {
            const timelineMatch = allUserText.match(/(\d+)\s*(?:years?|yrs?)/);
            if (timelineMatch) {
              const years = parseInt(timelineMatch[1]);
              if (years < 5) userInfoToSave.timeline = 'Short-term (<5 years)';
              else if (years <= 10) userInfoToSave.timeline = `Medium-term (${years} years)`;
              else userInfoToSave.timeline = `Long-term (${years}+ years)`;
            } else if (allUserText.match(/\b(?:short|near|soon)\b/)) {
              userInfoToSave.timeline = 'Short-term';
            } else if (allUserText.match(/\b(?:long|decades|retirement)\b/)) {
              userInfoToSave.timeline = 'Long-term';
            }
          }

          // Extract investment goals
          if (!userInfoToSave.goal) {
            if (allUserText.match(/\b(?:wealth accumulation|accumulation|build wealth)\b/)) {
              userInfoToSave.goal = 'Wealth Accumulation';
            } else if (allUserText.match(/\b(?:growth|grow|increase|maximize)\b/)) {
              userInfoToSave.goal = 'Growth';
            } else if (allUserText.match(/\b(?:income|dividend|cash flow)\b/)) {
              userInfoToSave.goal = 'Income';
            } else if (allUserText.match(/\b(?:preserve|preservation|protect|safe)\b/)) {
              userInfoToSave.goal = 'Preservation';
            } else if (allUserText.match(/\b(?:retire|retirement)\b/)) {
              userInfoToSave.goal = 'Retirement';
            }
          }

          console.log('Extracted user info:', userInfoToSave);
          console.log('Normalized portfolio to save:', normalizedPortfolio);

          // Store for return value
          generatedStrategy = normalizedPortfolio;
          generatedUserInfo = userInfoToSave;

          // Update Supabase only if user is logged in
          if (supabase && userId) {
            const { data: updateData, error } = await supabase
              .from('profiles')
              .update({
                investment_strategy: normalizedPortfolio,
                investment_user_info: userInfoToSave
              })
              .eq('id', userId)
              .select();

            console.log('Supabase update result:', { data: updateData, error });

            if (!error) {
              strategyUpdated = true;
              console.log('Portfolio successfully saved to database');
            } else {
              console.error('Failed to save portfolio:', error);
            }
          } else {
            // For non-logged in users, still mark as updated so frontend can save to localStorage
            strategyUpdated = true;
          }

          // Remove the update command from the response
          finalResponse = assistantResponse.replace(/\[UPDATE_PORTFOLIO\]\s*\[[\s\S]*?\]/g, '').trim();
          
          // Add a natural confirmation if response is empty
          if (!finalResponse || finalResponse.length < 10) {
            finalResponse = "I've created your personalized portfolio allocation based on our conversation. Take a look at the chart - let me know if you'd like to adjust anything!";
          }
        }
      } catch (parseError) {
        console.error('Error parsing portfolio update:', parseError);
        console.error('Parse error details:', parseError);
      }
    }

    // Fallback: If AI should have generated portfolio but didn't, do it manually
    if (!strategyUpdated && shouldGeneratePortfolio && userInfoToCheck) {
      console.log('🔄 AI did not generate portfolio, using fallback');
      console.log('📊 User info for fallback:', userInfoToCheck);
      
      try {
        const fallbackPortfolio = generateDefaultPortfolio(userInfoToCheck);
        console.log('💼 Generated fallback portfolio:', fallbackPortfolio);
        
        // Store for return value
        generatedStrategy = fallbackPortfolio;
        generatedUserInfo = userInfoToCheck;
        
        if (supabase && userId) {
          const { data: fallbackData, error } = await supabase
            .from('profiles')
            .update({
              investment_strategy: fallbackPortfolio,
              investment_user_info: userInfoToCheck
            })
            .eq('id', userId)
            .select();

          console.log('📝 Fallback update result:', { data: fallbackData, error });

          if (!error) {
            strategyUpdated = true;
            finalResponse += "\n\nI've created a personalized portfolio for you based on your profile. Check out the chart on the left!";
            console.log('✅ Fallback portfolio saved successfully');
          } else {
            console.error('❌ Fallback Supabase update error:', error);
          }
        } else {
          // For non-logged in users
          strategyUpdated = true;
          finalResponse += "\n\nI've created a personalized portfolio for you based on your profile. Check out the chart on the left!";
        }
      } catch (fallbackError) {
        console.error('❌ Fallback generation error:', fallbackError);
      }
    }

    return NextResponse.json({
      response: finalResponse,
      strategyUpdated,
      strategy: generatedStrategy,
      userInfo: generatedUserInfo
    });

  } catch (error: any) {
    console.error('Investment chat error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
