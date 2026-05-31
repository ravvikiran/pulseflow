/**
 * PulseFlow Asset Registry
 * Single source of truth for all tradeable assets across markets.
 * Each registry is strictly isolated — no cross-contamination between markets.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketDomain = "INDIA" | "CRYPTO" | "US" | "INDEX";
export type AssetClass = "STOCK" | "CRYPTO" | "INDEX" | "ETF";
export type MarketCap = "LARGE" | "MID" | "SMALL" | "MICRO";
export type CryptoCategory = "LAYER1" | "LAYER2" | "DEFI" | "EXCHANGE" | "MEME" | "STABLECOIN" | "INFRASTRUCTURE" | "GAMING" | "PRIVACY";

export interface NSEAsset {
  symbol: string;
  name: string;
  sector: string;
  exchange: "NSE" | "BSE";
  currency: "INR";
  marketCap: MarketCap;
  domain: "INDIA";
  assetClass: "STOCK";
  basePrice: number;
  isin?: string;
}

export interface CryptoAsset {
  symbol: string;
  name: string;
  category: CryptoCategory;
  exchange: "BINANCE" | "COINBASE" | "KRAKEN" | "MULTI";
  currency: "USD";
  domain: "CRYPTO";
  assetClass: "CRYPTO";
  basePrice: number;
  circulatingSupply?: number;
  sector: string; // "Cryptocurrency" for all, with subcategory in category field
}

export interface USAsset {
  symbol: string;
  name: string;
  sector: string;
  exchange: "NYSE" | "NASDAQ";
  currency: "USD";
  marketCap: MarketCap;
  domain: "US";
  assetClass: "STOCK";
  basePrice: number;
}

export interface IndexAsset {
  symbol: string;
  name: string;
  domain: "INDIA" | "US" | "CRYPTO";
  exchange: "NSE" | "BSE" | "NYSE" | "NASDAQ" | "CRYPTO";
  currency: "INR" | "USD";
  assetClass: "INDEX";
  basePrice: number;
  sector: string;
}

export type AnyAsset = NSEAsset | CryptoAsset | USAsset | IndexAsset;

// ─── NSE India Registry ───────────────────────────────────────────────────────
// 50 real NSE stocks, strictly India-only

export const NSE_REGISTRY: NSEAsset[] = [
  // NIFTY 50 Large Caps
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Oil & Gas", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 2850 },
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "Information Technology", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 3920 },
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1680 },
  { symbol: "INFY", name: "Infosys", sector: "Information Technology", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1750 },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1240 },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 2450 },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 820 },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 7200 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1580 },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1890 },
  { symbol: "WIPRO", name: "Wipro", sector: "Information Technology", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 465 },
  { symbol: "HCLTECH", name: "HCL Technologies", sector: "Information Technology", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1620 },
  { symbol: "ASIANPAINT", name: "Asian Paints", sector: "Consumer Goods", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 2680 },
  { symbol: "MARUTI", name: "Maruti Suzuki", sector: "Automobiles", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 12800 },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1720 },
  { symbol: "TITAN", name: "Titan Company", sector: "Consumer Goods", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 3450 },
  { symbol: "ONGC", name: "Oil and Natural Gas Corp", sector: "Oil & Gas", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 285 },
  { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Automobiles", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 980 },
  { symbol: "POWERGRID", name: "Power Grid Corporation", sector: "Infrastructure", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 340 },
  { symbol: "NTPC", name: "NTPC", sector: "Infrastructure", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 380 },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 6200 },
  { symbol: "CIPLA", name: "Cipla", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1580 },
  { symbol: "TATASTEEL", name: "Tata Steel", sector: "Metals & Mining", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 165 },
  { symbol: "JSWSTEEL", name: "JSW Steel", sector: "Metals & Mining", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 920 },
  { symbol: "COALINDIA", name: "Coal India", sector: "Metals & Mining", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 480 },
  { symbol: "DLF", name: "DLF", sector: "Real Estate", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 820 },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", sector: "Infrastructure", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 10200 },
  { symbol: "NESTLEIND", name: "Nestle India", sector: "FMCG", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 2450 },
  { symbol: "TECHM", name: "Tech Mahindra", sector: "Information Technology", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 1580 },
  { symbol: "ADANIENT", name: "Adani Enterprises", sector: "Infrastructure", exchange: "NSE", currency: "INR", marketCap: "LARGE", domain: "INDIA", assetClass: "STOCK", basePrice: 2850 },
  // Mid Caps
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 1680 },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 680 },
  { symbol: "SBILIFE", name: "SBI Life Insurance", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 1580 },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 6800 },
  { symbol: "DIVISLAB", name: "Divi's Laboratories", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 4200 },
  { symbol: "EICHERMOT", name: "Eicher Motors", sector: "Automobiles", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 4850 },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto", sector: "Automobiles", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 9200 },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp", sector: "Automobiles", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 4800 },
  { symbol: "GRASIM", name: "Grasim Industries", sector: "Infrastructure", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 2650 },
  { symbol: "INDUSINDBK", name: "IndusInd Bank", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 1050 },
  { symbol: "TATACONSUM", name: "Tata Consumer Products", sector: "FMCG", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 1080 },
  { symbol: "PIDILITIND", name: "Pidilite Industries", sector: "Consumer Goods", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 2850 },
  { symbol: "HAVELLS", name: "Havells India", sector: "Consumer Goods", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 1680 },
  { symbol: "MUTHOOTFIN", name: "Muthoot Finance", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 1950 },
  { symbol: "LUPIN", name: "Lupin", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 1680 },
  { symbol: "TORNTPHARM", name: "Torrent Pharmaceuticals", sector: "Healthcare & Pharma", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 3200 },
  { symbol: "AMBUJACEM", name: "Ambuja Cements", sector: "Infrastructure", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 620 },
  { symbol: "SHREECEM", name: "Shree Cement", sector: "Infrastructure", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 28500 },
  { symbol: "ICICIPRULI", name: "ICICI Prudential Life", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 680 },
  { symbol: "BANKBARODA", name: "Bank of Baroda", sector: "Banking & Finance", exchange: "NSE", currency: "INR", marketCap: "MID", domain: "INDIA", assetClass: "STOCK", basePrice: 240 },
];

// ─── Crypto Registry ──────────────────────────────────────────────────────────
// 30 real crypto assets, strictly crypto-only

export const CRYPTO_REGISTRY: CryptoAsset[] = [
  // Layer 1
  { symbol: "BTC", name: "Bitcoin", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 67500, sector: "Cryptocurrency" },
  { symbol: "ETH", name: "Ethereum", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 3450, sector: "Cryptocurrency" },
  { symbol: "SOL", name: "Solana", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 185, sector: "Cryptocurrency" },
  { symbol: "ADA", name: "Cardano", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.48, sector: "Cryptocurrency" },
  { symbol: "AVAX", name: "Avalanche", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 38, sector: "Cryptocurrency" },
  { symbol: "DOT", name: "Polkadot", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 8.5, sector: "Cryptocurrency" },
  { symbol: "ATOM", name: "Cosmos", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 9.2, sector: "Cryptocurrency" },
  { symbol: "NEAR", name: "NEAR Protocol", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 7.8, sector: "Cryptocurrency" },
  { symbol: "APT", name: "Aptos", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 12.5, sector: "Cryptocurrency" },
  { symbol: "SUI", name: "Sui", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 1.85, sector: "Cryptocurrency" },
  // Layer 2
  { symbol: "MATIC", name: "Polygon", category: "LAYER2", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.72, sector: "Cryptocurrency" },
  { symbol: "ARB", name: "Arbitrum", category: "LAYER2", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 1.15, sector: "Cryptocurrency" },
  { symbol: "OP", name: "Optimism", category: "LAYER2", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 2.45, sector: "Cryptocurrency" },
  { symbol: "IMX", name: "Immutable X", category: "LAYER2", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 2.1, sector: "Cryptocurrency" },
  // DeFi
  { symbol: "UNI", name: "Uniswap", category: "DEFI", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 9.8, sector: "Cryptocurrency" },
  { symbol: "AAVE", name: "Aave", category: "DEFI", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 185, sector: "Cryptocurrency" },
  { symbol: "LINK", name: "Chainlink", category: "INFRASTRUCTURE", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 18.5, sector: "Cryptocurrency" },
  { symbol: "MKR", name: "Maker", category: "DEFI", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 2850, sector: "Cryptocurrency" },
  { symbol: "CRV", name: "Curve DAO", category: "DEFI", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.58, sector: "Cryptocurrency" },
  // Exchange Tokens
  { symbol: "BNB", name: "Binance Coin", category: "EXCHANGE", exchange: "BINANCE", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 580, sector: "Cryptocurrency" },
  { symbol: "OKB", name: "OKB", category: "EXCHANGE", exchange: "KRAKEN", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 52, sector: "Cryptocurrency" },
  // Payments / Cross-chain
  { symbol: "XRP", name: "Ripple", category: "INFRASTRUCTURE", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.62, sector: "Cryptocurrency" },
  { symbol: "LTC", name: "Litecoin", category: "LAYER1", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 92, sector: "Cryptocurrency" },
  { symbol: "XLM", name: "Stellar", category: "INFRASTRUCTURE", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.14, sector: "Cryptocurrency" },
  // Meme
  { symbol: "DOGE", name: "Dogecoin", category: "MEME", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.18, sector: "Cryptocurrency" },
  { symbol: "SHIB", name: "Shiba Inu", category: "MEME", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.000028, sector: "Cryptocurrency" },
  { symbol: "PEPE", name: "Pepe", category: "MEME", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.0000145, sector: "Cryptocurrency" },
  // Gaming / Metaverse
  { symbol: "AXS", name: "Axie Infinity", category: "GAMING", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 8.2, sector: "Cryptocurrency" },
  { symbol: "SAND", name: "The Sandbox", category: "GAMING", exchange: "MULTI", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 0.48, sector: "Cryptocurrency" },
  // Privacy
  { symbol: "XMR", name: "Monero", category: "PRIVACY", exchange: "KRAKEN", currency: "USD", domain: "CRYPTO", assetClass: "CRYPTO", basePrice: 165, sector: "Cryptocurrency" },
];

// ─── US Market Registry ───────────────────────────────────────────────────────
// 25 real US stocks, strictly US-only

export const US_REGISTRY: USAsset[] = [
  // Tech
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 185 },
  { symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 415 },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 175 },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 195 },
  { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 875 },
  { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 520 },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 245 },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Technology", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 165 },
  { symbol: "INTC", name: "Intel Corporation", sector: "Technology", exchange: "NASDAQ", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 32 },
  // Finance
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 215 },
  { symbol: "BAC", name: "Bank of America Corp.", sector: "Financials", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 38 },
  { symbol: "GS", name: "Goldman Sachs Group", sector: "Financials", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 480 },
  { symbol: "V", name: "Visa Inc.", sector: "Financials", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 275 },
  // Healthcare
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 148 },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 520 },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 28 },
  // Energy
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 115 },
  { symbol: "CVX", name: "Chevron Corporation", sector: "Energy", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 158 },
  // Consumer
  { symbol: "KO", name: "The Coca-Cola Company", sector: "Consumer Staples", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 62 },
  { symbol: "PG", name: "Procter & Gamble Co.", sector: "Consumer Staples", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 168 },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Discretionary", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 68 },
  // Industrial
  { symbol: "BA", name: "The Boeing Company", sector: "Industrials", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 185 },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 365 },
  // Telecom
  { symbol: "VZ", name: "Verizon Communications", sector: "Communication Services", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 40 },
  { symbol: "T", name: "AT&T Inc.", sector: "Communication Services", exchange: "NYSE", currency: "USD", marketCap: "LARGE", domain: "US", assetClass: "STOCK", basePrice: 17 },
];

// ─── Index Registry ───────────────────────────────────────────────────────────

export const INDEX_REGISTRY: IndexAsset[] = [
  // India Indices
  { symbol: "NIFTY50", name: "Nifty 50", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 24800, sector: "Index" },
  { symbol: "SENSEX", name: "BSE Sensex", domain: "INDIA", exchange: "BSE", currency: "INR", assetClass: "INDEX", basePrice: 81500, sector: "Index" },
  { symbol: "NIFTYBANK", name: "Nifty Bank", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 52000, sector: "Index" },
  { symbol: "NIFTYIT", name: "Nifty IT", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 38000, sector: "Index" },
  { symbol: "NIFTYPHARMA", name: "Nifty Pharma", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 21000, sector: "Index" },
  { symbol: "NIFTYMETAL", name: "Nifty Metal", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 9800, sector: "Index" },
  { symbol: "NIFTYAUTO", name: "Nifty Auto", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 24000, sector: "Index" },
  { symbol: "NIFTYFMCG", name: "Nifty FMCG", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 58000, sector: "Index" },
  { symbol: "NIFTYMIDCAP", name: "Nifty Midcap 100", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 56000, sector: "Index" },
  { symbol: "NIFTYSMALLCAP", name: "Nifty Smallcap 100", domain: "INDIA", exchange: "NSE", currency: "INR", assetClass: "INDEX", basePrice: 18500, sector: "Index" },
  // US Indices
  { symbol: "SPX", name: "S&P 500", domain: "US", exchange: "NYSE", currency: "USD", assetClass: "INDEX", basePrice: 5280, sector: "Index" },
  { symbol: "NDX", name: "NASDAQ 100", domain: "US", exchange: "NASDAQ", currency: "USD", assetClass: "INDEX", basePrice: 18500, sector: "Index" },
  { symbol: "DJI", name: "Dow Jones Industrial Average", domain: "US", exchange: "NYSE", currency: "USD", assetClass: "INDEX", basePrice: 39800, sector: "Index" },
  { symbol: "RUT", name: "Russell 2000", domain: "US", exchange: "NYSE", currency: "USD", assetClass: "INDEX", basePrice: 2080, sector: "Index" },
  { symbol: "VIX", name: "CBOE Volatility Index", domain: "US", exchange: "NYSE", currency: "USD", assetClass: "INDEX", basePrice: 18.5, sector: "Index" },
];

// ─── Validation Layer ─────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AssetValidationLog {
  timestamp: number;
  totalAssets: number;
  nseCount: number;
  cryptoCount: number;
  usCount: number;
  indexCount: number;
  duplicates: string[];
  crossContamination: string[];
  invalidSymbols: string[];
  status: "CLEAN" | "WARNINGS" | "ERRORS";
}

/** Normalize a symbol: uppercase, trim whitespace, remove special chars */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9\-\.]/g, "");
}

/** Validate that a symbol belongs to the correct market domain */
export function validateAssetDomain(symbol: string, expectedDomain: MarketDomain): ValidationResult {
  const normalized = normalizeSymbol(symbol);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for cross-contamination
  const inNSE = NSE_REGISTRY.some(a => a.symbol === normalized);
  const inCrypto = CRYPTO_REGISTRY.some(a => a.symbol === normalized);
  const inUS = US_REGISTRY.some(a => a.symbol === normalized);
  const inIndex = INDEX_REGISTRY.some(a => a.symbol === normalized);

  const domains: MarketDomain[] = [];
  if (inNSE) domains.push("INDIA");
  if (inCrypto) domains.push("CRYPTO");
  if (inUS) domains.push("US");
  if (inIndex) domains.push("INDEX");

  if (domains.length > 1) {
    errors.push(`Symbol ${normalized} appears in multiple registries: ${domains.join(", ")}`);
  }

  if (domains.length === 0) {
    warnings.push(`Symbol ${normalized} not found in any registry`);
  } else if (!domains.includes(expectedDomain)) {
    errors.push(`Symbol ${normalized} belongs to ${domains[0]} but was expected in ${expectedDomain}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Run a full data integrity audit across all registries */
export function runDataValidation(): AssetValidationLog {
  const allSymbols: string[] = [
    ...NSE_REGISTRY.map(a => `NSE:${a.symbol}`),
    ...CRYPTO_REGISTRY.map(a => `CRYPTO:${a.symbol}`),
    ...US_REGISTRY.map(a => `US:${a.symbol}`),
    ...INDEX_REGISTRY.map(a => `INDEX:${a.symbol}`),
  ];

  const duplicates: string[] = [];
  const crossContamination: string[] = [];
  const invalidSymbols: string[] = [];

  // Check for duplicate symbols within same domain
  const nseSymbols = NSE_REGISTRY.map(a => a.symbol);
  const cryptoSymbols = CRYPTO_REGISTRY.map(a => a.symbol);
  const usSymbols = US_REGISTRY.map(a => a.symbol);

  const findDuplicates = (arr: string[], domain: string) => {
    const seen = new Set<string>();
    arr.forEach(s => {
      if (seen.has(s)) duplicates.push(`${domain}:${s}`);
      seen.add(s);
    });
  };
  findDuplicates(nseSymbols, "NSE");
  findDuplicates(cryptoSymbols, "CRYPTO");
  findDuplicates(usSymbols, "US");

  // Check for cross-contamination (same symbol in multiple registries)
  nseSymbols.forEach(s => {
    if (cryptoSymbols.includes(s)) crossContamination.push(`NSE/CRYPTO:${s}`);
    if (usSymbols.includes(s)) crossContamination.push(`NSE/US:${s}`);
  });
  cryptoSymbols.forEach(s => {
    if (usSymbols.includes(s)) crossContamination.push(`CRYPTO/US:${s}`);
  });

  // Validate symbol format
  [...NSE_REGISTRY, ...CRYPTO_REGISTRY, ...US_REGISTRY].forEach(asset => {
    if (!/^[A-Z0-9\-\.]+$/.test(asset.symbol)) {
      invalidSymbols.push(asset.symbol);
    }
    if (asset.symbol !== normalizeSymbol(asset.symbol)) {
      invalidSymbols.push(`${asset.symbol} (needs normalization)`);
    }
  });

  const hasErrors = duplicates.length > 0 || crossContamination.length > 0 || invalidSymbols.length > 0;
  const status: AssetValidationLog["status"] = hasErrors ? "ERRORS" : "CLEAN";

  return {
    timestamp: Date.now(),
    totalAssets: allSymbols.length,
    nseCount: NSE_REGISTRY.length,
    cryptoCount: CRYPTO_REGISTRY.length,
    usCount: US_REGISTRY.length,
    indexCount: INDEX_REGISTRY.length,
    duplicates,
    crossContamination,
    invalidSymbols,
    status,
  };
}

/** Get all assets for a specific market domain */
export function getAssetsByDomain(domain: MarketDomain): AnyAsset[] {
  switch (domain) {
    case "INDIA": return NSE_REGISTRY;
    case "CRYPTO": return CRYPTO_REGISTRY;
    case "US": return US_REGISTRY;
    case "INDEX": return INDEX_REGISTRY;
    default: return [];
  }
}

/** Get a single asset by symbol, searching all registries */
export function getAssetBySymbol(symbol: string): AnyAsset | undefined {
  const normalized = normalizeSymbol(symbol);
  return (
    NSE_REGISTRY.find(a => a.symbol === normalized) ||
    CRYPTO_REGISTRY.find(a => a.symbol === normalized) ||
    US_REGISTRY.find(a => a.symbol === normalized) ||
    INDEX_REGISTRY.find(a => a.symbol === normalized)
  );
}

/** Get the market domain for a symbol */
export function getSymbolDomain(symbol: string): MarketDomain | null {
  const normalized = normalizeSymbol(symbol);
  if (NSE_REGISTRY.some(a => a.symbol === normalized)) return "INDIA";
  if (CRYPTO_REGISTRY.some(a => a.symbol === normalized)) return "CRYPTO";
  if (US_REGISTRY.some(a => a.symbol === normalized)) return "US";
  if (INDEX_REGISTRY.some(a => a.symbol === normalized)) return "INDEX";
  return null;
}

/** Get all unique sectors for a domain */
export function getSectorsByDomain(domain: "INDIA" | "CRYPTO" | "US"): string[] {
  const assets = getAssetsByDomain(domain) as (NSEAsset | CryptoAsset | USAsset)[];
  const sectors = new Set(assets.map(a => a.sector));
  return Array.from(sectors).sort();
}

// ─── Backward-compatible exports (replace old marketEngine arrays) ─────────────

/** @deprecated Use NSE_REGISTRY instead */
export const NSE_STOCKS = NSE_REGISTRY;
/** @deprecated Use CRYPTO_REGISTRY instead */
export const CRYPTO_ASSETS = CRYPTO_REGISTRY;
/** @deprecated Use US_REGISTRY instead */
export const US_STOCKS = US_REGISTRY;
/** @deprecated Use INDEX_REGISTRY instead */
export const INDICES = INDEX_REGISTRY;

// Combined for backward compat
export const ALL_ASSETS: AnyAsset[] = [
  ...NSE_REGISTRY,
  ...CRYPTO_REGISTRY,
  ...US_REGISTRY,
  ...INDEX_REGISTRY,
];
