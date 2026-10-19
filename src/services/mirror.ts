import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export interface MirrorFileInfo {
  filename: string;
  size: number;
  modifiedAt: Date;
}

export class MirrorService {
  private baseDir: string;

  constructor(baseDir: string = './storage/mirror') {
    this.baseDir = path.resolve(baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getStorageDir(): string {
    return this.baseDir;
  }

  public getFilePath(filename: string): string {
    // Prevent directory traversal attacks
    const sanitized = path.basename(filename);
    return path.join(this.baseDir, sanitized);
  }

  public fileExists(filename: string): boolean {
    const filePath = this.getFilePath(filename);
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  }

  public getFileStat(filename: string): fs.Stats | null {
    const filePath = this.getFilePath(filename);
    if (!this.fileExists(filename)) {
      return null;
    }
    return fs.statSync(filePath);
  }

  public getFileStream(filename: string): { stream: Readable; size: number } | null {
    const filePath = this.getFilePath(filename);
    if (!this.fileExists(filename)) {
      return null;
    }
    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    return { stream, size: stat.size };
  }

  public listFiles(): MirrorFileInfo[] {
    if (!fs.existsSync(this.baseDir)) {
      return [];
    }
    const entries = fs.readdirSync(this.baseDir, { withFileTypes: true });
    const results: MirrorFileInfo[] = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(this.baseDir, entry.name);
        const stat = fs.statSync(fullPath);
        results.push({
          filename: entry.name,
          size: stat.size,
          modifiedAt: stat.mtime,
        });
      }
    }
    return results;
  }
}
