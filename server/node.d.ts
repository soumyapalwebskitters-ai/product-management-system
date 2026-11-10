declare const process: { cwd(): string }

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function mkdirSync(path: string, options: { recursive: boolean }): void
  export function readdirSync(path: string): string[]
}

declare module 'node:path' {
  export function dirname(path: string): string
  export function join(...paths: string[]): string
}

declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): {
      all(...params: unknown[]): unknown[]
      get(...params: unknown[]): unknown
      run(...params: unknown[]): unknown
    }
  }
}
