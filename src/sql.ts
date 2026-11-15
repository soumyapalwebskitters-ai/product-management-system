export type SqlValue = string | number | null

export type SqlStatement = {
  sql: string
  params: SqlValue[]
}

export type Sql = {
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>
  batch(statements: SqlStatement[]): Promise<void>
}
