import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number = 500,
  ) {
    super(message)
  }
}

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}
