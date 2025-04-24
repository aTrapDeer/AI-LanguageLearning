import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import dns from 'dns'
import net from 'net'
import { promisify } from 'util'

const lookup = promisify(dns.lookup)

async function testTcpConnection(host: string, port: number): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false

    socket.setTimeout(5000) // 5 second timeout

    socket.on('connect', () => {
      if (!resolved) {
        resolved = true
        socket.destroy()
        resolve({ success: true })
      }
    })

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true
        socket.destroy()
        resolve({ success: false, error: 'Connection timeout' })
      }
    })

    socket.on('error', (error) => {
      if (!resolved) {
        resolved = true
        resolve({ success: false, error: error.message })
      }
    })

    socket.connect(port, host)
  })
}

async function getHostInfo() {
  try {
    // Try to resolve the RDS hostname
    const dnsResult = await lookup('ailanguage.c92k0og42pjt.us-east-1.rds.amazonaws.com')
    const tcpTest = await testTcpConnection(dnsResult.address, 5432)
    return {
      resolved: true,
      ip: dnsResult.address,
      family: dnsResult.family,
      tcpConnection: tcpTest
    }
  } catch (error) {
    return {
      resolved: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function GET(req: Request) {
  try {
    // Get DNS resolution info
    const hostInfo = await getHostInfo()
    
    // Get request headers and connection info
    const headers = Object.fromEntries(req.headers)
    const clientIp = headers['x-real-ip'] || headers['x-forwarded-for'] || 'unknown'
    
    // Test database connection
    let dbResult
    try {
      // Test DB connection with a simple user query
      await db.user.findUnique({
        where: { id: 'test-connection' }
      })
      dbResult = { success: true }
    } catch (error) {
      dbResult = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
    
    return NextResponse.json({
      status: dbResult.success ? "success" : "error",
      message: dbResult.success ? "Database connection successful" : "Database connection failed",
      error: dbResult.error,
      diagnostics: {
        clientIp,
        vercelRegion: process.env.VERCEL_REGION,
        databaseHost: {
          name: 'ailanguage.c92k0og42pjt.us-east-1.rds.amazonaws.com',
          ...hostInfo
        },
        headers: {
          ...headers,
          // Remove sensitive headers
          authorization: undefined,
          cookie: undefined
        },
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL_ENV: process.env.VERCEL_ENV,
          VERCEL_REGION: process.env.VERCEL_REGION
        }
      },
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@')
    })
  } catch (error) {
    console.error("Test endpoint error:", error)
    return NextResponse.json({
      status: "error",
      message: "Test endpoint error",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 