export type AgentType = "market" | "research" | "trading" | "risk";

export type MarketKind = "exchange" | "stock" | "etf";

export type AIModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "o3"
  | "claude-4-sonnet"
  | "claude-4-opus"
  | "gemini-2.5-pro"
  | "gemini-2.5-flash";

export type Cadence = "realtime" | "1m" | "5m" | "15m" | "1h" | "1d" | "manual";

export type MemoryMode = "none" | "session" | "persistent";

export type Instrument = {
  id: string;
  kind: MarketKind;
  symbol: string;
  name: string;
  venue: string;
  region: string;
};

export type AgentConfig = {
  name: string;
  instructions: string;
  model: AIModel;
  temperature: number;
  maxTokens: number;
  maxIterations: number;
  cadence: Cadence;
  memory: MemoryMode;
  enabled: true | false;
  tools: string[];
  // Market
  fields: string[];
  lookbackDays: number;
  // Research
  sources: string[];
  // Trading
  horizon: "intraday" | "swing" | "position";
  confidence: number;
  longOnly: boolean;
  // Risk
  maxDrawdown: number;
  maxPosition: number;
  stopLoss: number;
};

export type AgentNodeData = {
  type: AgentType;
  config: AgentConfig;
};

export type Workspace = {
  id: string;
  name: string;
  instrument: Instrument;
  createdAt: string;
  updatedAt: string;
  nodes: Array<{
    id: string;
    type: "agent";
    position: { x: number; y: number };
    data: AgentNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
};
