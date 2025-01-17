import { AccessToken } from 'livekit-server-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const body = await req.json()
    const { userId, languageCode } = body

    if (!userId || !languageCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify userId matches session user
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      return NextResponse.json(
        { error: 'LiveKit configuration missing' },
        { status: 500 }
      )
    }

    // Create access token
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: userId,
        name: session.user.name || userId,
      }
    )

    // Grant permissions
    at.addGrant({ 
      room: languageCode,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    })

    // Add metadata
    at.metadata = JSON.stringify({
      userId,
      languageCode,
    })

    try {
      // Generate token and ensure it's a string
      const token = await at.toJwt()
      console.log('Generated token:', token)

      if (typeof token !== 'string') {
        console.error('Token is not a string:', token)
        return NextResponse.json(
          { error: 'Invalid token generated' },
          { status: 500 }
        )
      }

      return NextResponse.json({ token })
    } catch (error) {
      console.error('Error generating JWT:', error)
      return NextResponse.json(
        { error: 'Failed to generate token' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error generating LiveKit token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 