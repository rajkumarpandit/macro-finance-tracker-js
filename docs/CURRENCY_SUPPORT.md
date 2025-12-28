# Multi-Currency Support with Live Exchange Rates

## Overview
The application now supports multiple currencies with **automatic conversion to INR** (Indian Rupees) using **live exchange rates** fetched from the internet.

## ✨ Key Features

- 🌍 **Top 10 Global Currencies** supported
- 🔄 **Live Exchange Rate Updates** via API
- 💾 **Firestore Storage** for offline access
- 🎯 **Accurate Multi-Currency Calculations**
- 📱 **User-Friendly Currency Manager** interface
- ⚡ **Smart Caching** to minimize database reads

## How It Works

### 1. **Transaction Storage**
- Transactions are stored with their **original currency** (USD, EUR, GBP, etc.)
- **Raw amounts** are saved (e.g., $10.00, ₹199.00)
- Currency metadata is preserved

### 2. **Automatic Conversion**
- When displaying totals, amounts are automatically converted to INR
- Conversion uses exchange rates from Firestore
- Dashboard and Reports show accurate totals in INR

### 3. **Display Format**
- **Dashboard**: Shows totals in INR after conversion
- **Reports Table**: Shows original currency + INR equivalent
  - Example: `$10.00 (₹845.00)` for a USD transaction
  - Example: `₹199.00` for an INR transaction

### 4. **Example Scenario**
**Your Subscriptions:**
- Netflix: ₹199.00
- GitHub Copilot: $10.00

**Calculation with Live Rates (1 USD = ₹84.50):**
- Netflix: ₹199.00
- GitHub Copilot: $10.00 × 84.50 = ₹845.00
- **Total: ₹1,044.00** ✅ (Correct!)

## 📊 Currency Manager

**Access**: Available to all authenticated users (not restricted to admins)  
**Location**: Side menu → Currency Manager

The Currency Manager is a read-only interface with a single action: **Refresh Rates**. No add/edit/delete operations - anyone can view rates and refresh them when they become stale.

### View Exchange Rates
- See current rates for top 10 currencies
- All rates displayed relative to INR (1 Currency Unit = X INR)
- Check when rates were last updated
- View update status (Up to date / Needs update / Outdated)

### Refresh Exchange Rates
1. Click **"Refresh Rates"** button
2. System fetches latest rates from FreeCurrencyAPI.com (USD-based)
3. Rates are automatically converted to INR-base
4. Updated rates are saved to Firestore
5. All users get updated rates instantly (via cache refresh)

### Initial Setup
When the app is first used or if no rates exist in Firestore:
1. System automatically detects missing rates
2. Attempts to fetch live rates from API
3. If API fails, falls back to default hardcoded rates
4. Rates are saved to Firestore for all users
5. Status shown with appropriate message

**No manual setup required** - the system handles initialization automatically!

### Supported Currencies

| Currency | Code | Symbol | Example Rate |
|----------|------|--------|--------------|
| Indian Rupee | INR | ₹ | 1.00 (base) |
| US Dollar | USD | $ | 84.50 |
| Euro | EUR | € | 92.00 |
| British Pound | GBP | £ | 107.00 |
| Japanese Yen | JPY | ¥ | 0.54 |
| Australian Dollar | AUD | A$ | 56.50 |
| Canadian Dollar | CAD | C$ | 62.00 |
| Swiss Franc | CHF | CHF | 95.00 |
| Chinese Yuan | CNY | ¥ | 12.00 |
| Singapore Dollar | SGD | S$ | 63.00 |

## 🔧 Technical Implementation

### Exchange Rate API
- **Provider**: FreeCurrencyAPI.com
- **API Key**: Securely embedded in app
- **Format**: JSON response with USD-based rates
- **Conversion**: Automatically converted to INR base

### Data Storage
- **Collection**: `exchange_rates` in Firestore
- **Document**: `current`
- **Fields**:
  - `rates`: Object with currency codes and rates
  - `lastUpdated`: Timestamp
  - `source`: API source name
  - `rawData`: Original API response (for reference)

### Caching Strategy
- Exchange rates are cached in memory for 1 hour
- Reduces Firestore reads
- Automatic cache invalidation
- Fallback to default rates if Firestore unavailable

### Security
- Firestore rules allow public read for exchange rates
- Only authenticated users can update rates
- API key is safely embedded (free tier, no sensitive data)

## 🎯 Benefits

✅ **Accurate Calculations**: No more incorrect currency mixing  
✅ **Always Up-to-Date**: Refresh rates whenever needed  
✅ **Offline Support**: Cached rates work without internet  
✅ **User Control**: Users decide when to update rates  
✅ **Transparent**: See original currency and converted amount  
✅ **Fast Performance**: Smart caching minimizes database calls

## 💡 Best Practices

### For Regular Users
1. **Update Weekly**: Refresh rates once a week for accuracy
2. **Before Major Expenses**: Update before recording large foreign currency transactions
3. **Check Status**: Look for "Needs update" or "Outdated" warnings

### For Admins
1. **Monthly Updates**: Set a reminder to update rates monthly
2. **Market Volatility**: Update more frequently during currency fluctuations
3. **Monitor API**: Check if API calls are working correctly

## 🔄 Fallback Mechanism

The system has multiple fallback layers:

1. **Primary**: Live rates from FreeCurrencyAPI
2. **Secondary**: Cached rates from Firestore
3. **Tertiary**: Default hardcoded rates in utils
4. **Last Resort**: Assumes all amounts are in INR

## 🚀 Future Enhancements (Optional)

### Planned
- [ ] Automatic daily rate updates (scheduled function)
- [ ] Multiple currency base options (let users choose base currency)
- [ ] Historical rate tracking
- [ ] Rate change notifications
- [ ] Currency conversion calculator tool

### Advanced
- [ ] Real-time rate updates (WebSocket)
