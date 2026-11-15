export type SqlValue = string | number | null

export type SqlStatement = {
  sql: string
  params: SqlValue[]
}

export type Sql = {
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>
<<<<<<< HEAD
  batch(statements: SqlStatement[]): Promise<void>
}
=======
  batch(statements: SqlStatement[]): Promise<void>
}
>>>>>>> 1e93a50f783b841383173e99bc31d39d2d1aeb4b
