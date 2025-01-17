import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import dns from 'dns'
import { promisify } from 'util'

const lookup = promisify(dns.lookup)

async function getHostInfo() {
  try {
    // Try to resolve the RDS hostname
    const dnsResult = await lookup('ailanguage.c92k0og42pjt.us-east-1.rds.amazonaws.com')
    return {
      resolved: true,
      ip: dnsResult.address,
      family: dnsResult.family
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
      await db.$queryRaw`SELECT 1`
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