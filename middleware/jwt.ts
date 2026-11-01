
import { Request, Response, NextFunction } from 'express'
// Import the JSON Web Token (JWT) library for verifying tokens
import jwt, { JwtPayload } from 'jsonwebtoken'

// Import your database models (user)
import User from '../models/user'

// Extend Express Request to include custom fields
interface AuthRequest extends Request {
  user?: any
  token?: string
}

// Authentication middleware to protect routes
const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get the 'Authorization' header from the request
    const authHeader = req.header('Authorization')

    // If the header starts with "Bearer ", remove it and extract only the token.
    // Otherwise, check for an 'x-auth-token' header (some clients use that instead).
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.header('x-auth-token')

    // If there’s no token at all, deny access.
    if (!token) {
      return res.status(401).json({ status: 'error', msg: 'No token provided' })
    }

    // Get the "From" header (this tells us who is making the request)
    const from = req.header('From')

    // If the 'From' header is missing, reject the request
    if (!from) {
      return res.status(401).json({ status: 'error', msg: 'From header must be set user' })
    }

    // Verify the token using your secret key from the .env file
    // This decodes the token and gives access to the payload (e.g., the user's ID)
    const decoded = jwt.verify(token, process.env.jwt_secret as string) as JwtPayload & { _id: string }

    // Store the token on the request object (optional but useful later)
    req.token = token;

    // ==============================
    // 👇🏽 CASE 1: If the request came from an admin
    // ==============================
    if (from === 'user') {
      // Find the user in the database using the decoded ID
      const user = await User.findById(decoded._id).lean()

      // If no user matches that token, deny access
      if (!user) return res.status(401).json({ status: 'error', msg: 'User not found' })

      // Attach user info and role ("user") to the request
      req.user = { ...user, role: decoded.role, from: 'user' }

      // Continue to the next middleware or route
      next()
    } 

    // ==============================
    // 👇🏽 CASE 2: Invalid "From" header value
    // ==============================
    else {
      return res.status(400).json({ status: 'error', msg: 'Invalid From header value' })
    }
  } 
  catch (error: any) {
    // If token is expired, handle it clearly
    if (error.name === 'TokenExpiredError')
      return res.status(401).json({ status: 'error', msg: 'Token expired' })

    // If token is invalid or malformed
    if (error.name === 'JsonWebTokenError')
      return res.status(401).json({ status: 'error', msg: 'Invalid token' })

    // If some unexpected server error occurs
    console.error('Auth middleware error:', error)
    res.status(500).json({ status: 'error', msg: 'Server error during authentication' })
  }
}

// Export the middleware so you can use it in your routes
export default auth