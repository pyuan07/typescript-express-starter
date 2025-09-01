/**
 * Shared pagination and query types
 * Used across multiple entities for consistent pagination behavior
 */

export interface QueryOptions {
  sortBy?: string;
  limit?: string | number;
  page?: string | number;
}

export interface QueryResult<T> {
  results: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}
