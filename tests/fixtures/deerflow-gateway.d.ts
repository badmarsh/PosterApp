type DeerflowFrame = { event: string; data: unknown }
type DeerflowFrameSet = DeerflowFrame[]

export declare function createDeerflowFixture(opts?: {
  frames?: DeerflowFrameSet
}): {
  start(): Promise<string>
  stop(): Promise<void>
  url: string
  server: import("node:http").Server
}

export declare function buildImprovePosterProposal(opts?: {
  cardId?: string
  iterationCount?: number
  cleanCompile?: boolean
  patchesPerIteration?: number
}): unknown

export declare function improvePosterFrames(proposal: unknown): DeerflowFrameSet

export declare function createImprovePosterFixture(opts?: {
  callFrames?: DeerflowFrameSet[]
  proposal?: unknown
  cardId?: string
}): {
  start(): Promise<string>
  stop(): Promise<void>
  url: string
  server: import("node:http").Server
  callCount: number
  resetCalls(): void
}
