import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Board, boardSchema } from "../shared/board";

export async function loadSavedBoard(file: string, repo: string): Promise<Board | null> {
  try {
    const saved = boardSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
    return saved.success && saved.data.repo === repo ? saved.data : null;
  } catch {
    return null;
  }
}

export async function saveBoard(file: string, board: Board) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(board));
}
