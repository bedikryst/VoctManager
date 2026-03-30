export const archiveQueryKeys = {
  pieces: ['archivePieces'] as const,
  composers: ['archiveComposers'] as const,
  voiceLines: ['archiveVoiceLines'] as const,
  tracks: (pieceId: string | number) => ['archiveTracks', String(pieceId)] as const,
  sharedPieces: ['pieces'] as const,
  sharedComposers: ['composers'] as const,
};
