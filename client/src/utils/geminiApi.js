import { checkGeminiApiLimit, incrementGeminiApiCount } from './apiLimits';
import { GEMINI_CONFIG } from '../config/constants';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_API_URL = `${GEMINI_CONFIG.API_BASE_URL}/${GEMINI_CONFIG.API_VERSION}/models/${GEMINI_CONFIG.MODEL_NAME}:generateContent`;

/**
 * Parse transaction description using Gemini API
 * Extracts: amount, currency, type, category, date, paymentMode, paymentType
 */
export async function parseTransactionWithGemini(description, userId) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  // Check API limit
  if (userId) {
    const limitCheck = await checkGeminiApiLimit(userId);
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.message);
    }
  }

  const prompt = `You are a financial transaction parser. Parse the following transaction description and extract structured data.

Transaction: "${description}"

Extract and return ONLY a valid JSON object with these exact fields:
{
  "amount": (number - the transaction amount, REQUIRED),
  "currency": (string - "INR", "USD", etc. Default to "INR" if not specified or rupees mentioned),
  "type": (string - "expense" or "income". Set to "income" if words like "received", "earned", "credited", "got", "salary" are present. Set to "expense" if words like "spent", "paid", "purchased", "bought" are present. Default to "expense" if unclear),
  "category": (string - for expense: transportation, groceries, food, entertainment, utilities, healthcare, shopping, education, household, rent, fuel, sundry. For income: Fixed, NonFixed. Default to "sundry" for expenses or "Fixed" for income),
  "expenseHead": (string - For expenses: Household Expenses, Education, Transportation, Healthcare, Food & Dining, Entertainment, Shopping, Investment, Bills & Utilities, Other. For income: Salary, Interest-Income, Dividend, Others. Default to "Other" for expenses or "Salary" for income),
  "transactionDesc": (string - brief description of what the transaction was for. Extract the key purpose/item/place like "BigMarket", "frying pan", "BigBazaar", "groceries". Keep it short and meaningful for user to identify the transaction),
  "date": (string - ISO date format YYYY-MM-DD, use today's date if not specified),
  "paymentMode": (string - UPI, Credit Card, Debit Card, Cash, Net Banking, Wallet. Default to "UPI" if not specified)
}

Rules:
- Amount is REQUIRED, must be a number
- Currency defaults to "INR"
- Type should be "income" if words like "received", "earned", "credited", "got", "salary" are present, otherwise "expense"
- Category defaults to "sundry" for expenses, "Fixed" for income
- ExpenseHead defaults to "Other" for expenses, "Salary" for income
- TransactionDesc should be a brief, meaningful description (e.g., "BigMarket", "frying pan", "groceries", "taxi")
- Payment mode defaults to "UPI"
- Use today's date if not specified: ${new Date().toISOString().split('T')[0]}
- Return ONLY the JSON object, no additional text or explanation`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No response from Gemini API');
    }

    console.log('Gemini raw response:', generatedText);

    // Extract JSON from response (sometimes Gemini wraps it in markdown)
    let jsonText = generatedText.trim();
    
    // Remove markdown code blocks
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    // Try to extract JSON object if there's additional text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    jsonText = jsonText.trim();
    console.log('Extracted JSON text:', jsonText);

    const parsed = JSON.parse(jsonText);

    // Apply defaults for missing fields
    const result = {
      amount: parsed.amount,
      currency: parsed.currency || 'INR',
      type: parsed.type || 'expense',
      category: parsed.category || (parsed.type === 'income' ? 'Fixed' : 'sundry'),
      expenseHead: parsed.expenseHead || (parsed.type === 'income' ? 'Salary' : 'Other'),
      transactionDesc: parsed.transactionDesc || '',
      date: parsed.date || new Date().toISOString().split('T')[0],
      paymentMode: parsed.paymentMode || 'UPI'
    };

    // Validate only amount is required
    if (!result.amount) {
      throw new Error('Invalid transaction data: Amount is required.');
    }

    // Record API call
    if (userId) {
      await incrementGeminiApiCount(userId);
    }

    return result;
  } catch (error) {
    console.error('Error parsing transaction with Gemini:', error);
    if (error.message.includes('JSON')) {
      throw new Error('Failed to parse transaction. Please try describing it differently.');
    }
    throw error;
  }
}
