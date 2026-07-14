export async function fetchBoardRegistry<Board, Response>(
  boards: Board[],
  fetchBoard: (board: Board) => Promise<Response>,
  describeBoard: (board: Board) => string,
): Promise<{ entries: Array<{ board: Board; response: Response }>; warnings: string[] }> {
  const settled = await Promise.allSettled(
    boards.map(async (board) => ({ board, response: await fetchBoard(board) })),
  );
  const entries: Array<{ board: Board; response: Response }> = [];
  const warnings: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      entries.push(result.value);
      return;
    }
    const board = boards[index];
    if (board) warnings.push(`${describeBoard(board)}: ${errorText(result.reason)}`);
  });

  if (entries.length === 0 && warnings.length > 0) {
    throw new Error(`All company boards failed: ${warnings.join('; ')}`);
  }
  return { entries, warnings };
}

export function unknownToStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(unknownToStrings);
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  return [];
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
