import { NextResponse } from 'next/server'

// Remove all previous backend logic and just proxy to Docker container
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const apiUrl = process.env.API_URL || 'http://localhost:8000'
    
    const response = await fetch(`${apiUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in chat route:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
} 