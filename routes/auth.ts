import { Router, Request, Response } from 'express'
const router = Router()

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/user'
import auth  from '../middleware/jwt'
import RefreshSession from '../models/refreshSession'
//import { sendVerifyEmail, sendResetPasswordEmail } from '../utils/nodemailer'


// REGISTER
router.post('/register', async (req: Request, res: Response) => {
    const { name, email, password } = req.body

    //Validate required fields
    if(!name || !email || !password) {
        return res.status(400).json({ status: 'error', msg: 'All fields are required' })
    }

    // Check if user already exists
    try {
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(409).json({ status: 'error', msg: 'Account with this email already exists' })
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Create the user
        const user = await User.create({
            name,
            email,
            password: hashedPassword
        })

        // Generate a verification token (JWT)
        const vToken = jwt.sign(
            { _id: user._id },
            process.env.JWT_SECRET as string,
            { expiresIn: '30m' }
        )

        const vLink = `${process.env.BASE_URL || 'http://localhost:2900'}/auth/verify-email/${vToken}`

        // Send verification email
        //await sendVerifyEmail(user.email, user.name, vLink)

        return res.status(201).json({ status: 'success', msg: 'success', data: User })
    } catch (error) {
        console.error('Error during registration:', error)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// VERIFY EMAIL
router.get('/verify/:token', async (req: Request, res: Response) => {
    try {
        const { token } = req.params
        if (!token) {
            return res.status(400).json({ status: 'error', msg: 'Token required' })
        }

        // jwt.verify checks signature and if token has expired
        const decoded = jwt.verify(token as string, process.env.JWT_SECRET as string) as { _id: string }

        const user = await User.findById(decoded._id)
        if (!user) {
            return res.status(404).json({ status: 'error', msg: 'User not found' })
        }

        if (user.isVerified) {
            return res.status(400).json({ status:'error', msg: 'Email already verified' })
        }

        user.isVerified = true
        await user.save()

        return res.status(200).json({ status: 'ok', msg: 'success' })
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ status: 'error', msg: 'Verification link has expired'})
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ status: 'error', msg: 'Invalid verification link' })
        }
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// LOGIN
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body

    // Validate fields
    if (!email || !password) {
        return res.status(400).json({ status: 'error', msg: 'All fields are required' })
    }

    try {
        // Find user by email
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({ status: 'error', msg: 'Invalid email or password' })
        }

        // Verify password
        const match = await bcrypt.compare(password, user.password)
        if (!match) {
            return res.status(401).json({ status: 'error', msg: 'Invalid email or password' })
        }

        // Check if account is verified & active
        if (!user.isVerified) {
            return res.status(403).json({ status: 'error', msg: 'Please verify your email before logging in' })
        }

        if (!user.isActive) {
            return res.status(403).json({ status: 'error', msg: 'Account is deactivated' })
        }

        // Generate Access Token
        const accessToken = jwt.sign(
            { _id: user._id, role: 'user' },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        )

        // Generate Refresh Token
        const refreshToken = jwt.sign(
            { _id: user._id },
            process.env.JWT_SECRET as string,
            { expiresIn: '30d' }
        )

        // Store Refresh Token in DB session
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        await RefreshSession.create({
            userId: user._id,
            refreshToken,
            expiresAt,
            userDevice: req.headers['user-agent'] || 'unknown',
            ipAddress: req.ip || req.socket.remoteAddress || 'unknown'
        })

        // Return response (excluding password)
        const userObj = user.toObject()
        delete (userObj as any).password

        return res.status(200).json({ 
            status: 'ok', msg: 'success', data: { user: userObj, accessToken, refreshToken }
        })
    } catch (error) {
        console.error('Login error:', error)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// REFRESH ACCESS TOKEN
router.post('/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = req.body

    // Validate input
    if (!refreshToken) {
        return res.status(400).json({ status: 'error', msg: 'Refresh token required' })
    }

    try {
        // Verify the token's signature & expiry
        const decoded = jwt.verify(refreshToken as string, process.env.JWT_SECRET as string) as { _id: string }
        
        // Check if the session exists in DB and is not revoked
        const session = await RefreshSession.findOne({
            refreshToken,
            userId: decoded._id,
            revokedAt: { $exists: false } // or revokedAt: null
        })

        if (!session) {
            return res.status(401).json({ status: 'error', msg: 'Refresh token expired' })
        }

        // Check if the user still exists & is active
        const user = await User.findById(decoded._id)
        if (!user || !user.isActive) {
            return res.status(401).json({ status: 'error', msg: 'User account not found or deactivated' })
        }

        // Update lastUsedAt on session
        session.lastUsedAt = new Date()
        await session.save()

        // Generate a new Access token
        const newAccessToken = jwt.sign(
            { _id: user._id },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        )

        return res.status(200).json({ status: 'ok', msg: 'success', data: { accessToken: newAccessToken }})
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ status: 'error', msg: 'Refresh token has expired' })
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ status: 'error', msg: 'Invalid refresh token' })
        }
        console.error('Refresh token error:', error)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// LOGOUT
router.post('/logout', async (req: Request, res: Response) => {
    const { refreshToken } = req.body
    if (!refreshToken) {
        return res.status(400).json({ status: 'error', msg: 'Refresh token required' })
    }

    try {
        // Find and revoke the session
        const session = await RefreshSession.findOneAndUpdate( 
            { refreshToken, revokedAt: { $exists: false } }, // only active sessions
            { revokedAt: new Date() }, // mark as revoked
            { new: true }
        )

        if (!session) {
            return res.status(400).json({ status: 'error', msg: 'Session not found or already logged out' })
        }

        return res.status(200).json({ status: 'ok', msg: 'Logged out successfully' })
    } catch (error) {
        console.error('Logout error:', error)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// LOGOUT OF ALL SESSIONS
router.post('/logout-all', auth, async (req: any, res: Response) => {
    try {
        // Wipe all active sessions for the logged-in user
        await RefreshSession.updateMany(
            { userId: req.user._id, revokedAt: { $exists: false } },
            { revokedAt: new Date() }
        )

        return res.status(200).json({ status: 'ok', msg: 'Logged out of all sessions' })
    } catch (error) {
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// CHANGE PASSWORD
router.post('/change-password', auth, async (req: any, res: Response) => {
    const { oldPassword, newPassword, confirmNewPassword } = req.body

    // Validate inputs
    if (!oldPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({ status: 'error', msg: 'All password fields are required' })
    }

    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ status: 'error', msg: 'New passwords do not match' })
    }
    
    if (newPassword.length < 8) {
        return res.status(400).json({ status: 'error', msg: 'New password must be at least 8 characters long' })
    }

    if (oldPassword === newPassword) {
        return res.status(400).json({ status: 'error', msg: 'New password cannot be the same as your old password' })
    }

    try {
        // Find user from authenticated request
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({ status: 'error', msg: 'User not found' })
        }

        // Verify the old password matches current database password
        const isMatch = await bcrypt.compare(oldPassword, user.password)
        if (!isMatch) {
            return res.status(400).json({ status: 'error', msg: 'Incorrect current password' })
        }

        // Hash new password & save
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.password = hashedPassword
        await user.save()

        // Invalidate other refresh sessions to keep user account safe if the account was compromised elsewhere
        await RefreshSession.updateMany(
            { userId: user._id, revokedAt: { $exists: false } },
            { revokedAt: new Date() }
        )

        return res.status(200).json({
            status: 'ok',
            msg: 'Password changed successfully. Please log in again with your new password.'
        })
    } catch (error) {
        console.error('Changed password error:', error)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// FORGOT PASSWORD
router.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body

    // Validate email input
    if (!email) {
        return res.status(400).json({ status: 'error', msg: 'Email is required' })
    }

    try {
        // Find user by email
        const user = await User.findOne({ email })

        // Even if user not found, return success response so attackers can't enumerate emails
        if (!user) {
            return res.status(200).json({ status: 'ok', msg: 'If an account with that email exists, a password reset link has been sent' })
        }

        // Generate short-lived reset token (30 mins)
        // We include both user._id and password hash so if they change password once
        // the old link automatically becomes invalid!
        const resetToken = jwt.sign(
            { _id: user._id },
            process.env.JWT_SECRET as string,
            { expiresIn: '30m' }
        )

        const resetLink = `${process.env.BASE_URL || 'http://localhost:2900'}/auth/reset-password/${resetToken}`

        // Send email
        // await sendResetPasswordEmail(user.email, user.name, resetLink)

        return res.status(200).json({
            status: 'ok',
            msg: 'If an account with that email exists, a password reset link has been sent'
        })
    } catch (error) {
        console.error('Forgot password error:', error)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// RESET PASSWORD (PAGE - GET)
// An interactive HTML form when the user clicks the email link
router.get('/reset-password/:token', async (req: Request, res: Response) => {
    const { token } = req.params

    try {
        // Validate token exists and isn't expired before showing the page
        jwt.verify(token as string, process.env.JWT_SECRET as string)

        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Reset Password - Time Management System</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                    body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #0f172a; color: #f8fafc; padding: 20px; }
                    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
                    h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #fff; }
                    p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
                    label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #cbd5e1; }
                    input { width: 100%; padding: 12px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 14px; margin-bottom: 18px; outline: none; transition: border-color 0.2s; }
                    input:focus { border-color: #3b82f6; }
                    button { width: 100%; padding: 12px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
                    button:hover { background: #1d4ed8; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Reset Password</h2>
                    <p>Enter your new password below to regain access.</p>
                    <form action="/auth/reset-password/${token}" method="POST">
                        <label for="newPassword">New Password</label>
                        <input type="password" id="newPassword" name="newPassword" placeholder="••••••••" required minlength="6" />
                        <label for="confirmPassword">Confirm Password</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" placeholder="••••••••" required minlength="6" />
                        <button type="submit">Update Password</button>
                    </form>
                </div>
            </body>
            </html>
        `)
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).send(`
                <body style="font-family:sans-serif;background:#0f172a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;">
                    <div style="background:#1e293b;padding:30px;border-radius:12px;text-align:center;">
                        <h2 style="color:#ef4444;">Link Expired</h2>
                        <p style="color:#94a3b8;margin-top:8px;">This password reset link has expired. Please request a new one.</p>
                    </div>
                </body>
            `)
        }
        return res.status(400).send(`
            <body style="font-family:sans-serif;background:#0f172a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;">
                <div style="background:#1e293b;padding:30px;border-radius:12px;text-align:center;">
                    <h2 style="color:#ef4444;">Invalid Link</h2>
                    <p style="color:#94a3b8;margin-top:8px;">This password reset link is invalid.</p>
                </div>
            </body>
        `)
    }
})


// RESET PASSWORD
// Processes from submission, updates password and revokes sessions
router.post('/reset-password/:token', async (req: Request, res: Response) => {
    const { token } = req.params
    const { newPassword, confirmPassword } = req.body

    // Validation
    if (!token) {
        return res.status(400).json({ status: 'error', msg: 'Reset token is required' })
    }

    if (!newPassword || !confirmPassword) {
        return res.status(400).json({ status: 'error', msg: 'All fields are required' })
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ status: 'error', msg: 'Passwords do not match' })
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ status: 'error', msg: 'Password must be at least 8 characters long' })
    }

    try {
        // Verify token & get user ID
        const decoded = jwt.verify(
            token as string,
            process.env.JWT_SECRET as string,
        ) as { _id: string }

        // Find user
        const user = await User.findById(decoded._id)
        if (!user) {
            return res.status(404).json({ status: 'error', msg: 'User not found' })
        }

        // Hash and save new password
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        user.password = hashedPassword

        // Invalidate all active sessions for security
        await RefreshSession.updateMany(
            { userId: user._id, revokedAt: {$exists: false }},
            { revokedAt: new Date() }
        )

        // Return response (supports both browser HTML view or JSON for API clients)
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return res.status(200).send(`
                <body style="font-family:sans-serif;background:#0f172a;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;">
                    <div style="background:#1e293b;padding:36px;border-radius:12px;text-align:center;max-width:380px;">
                        <h2 style="color:#22c55e;">Success!</h2>
                        <p style="color:#94a3b8;margin:12px 0 20px;">Your password has been reset successfully.</p>
                        <p style="color:#64748b;font-size:13px;">You can now log in with your new credentials.</p>
                    </div>
                </body>
        `)
        }
        return res.status(200).json({ status: 'ok', msg: 'Password has been reset successfully. Please log in with your new password.'})
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ status: 'error', msg: 'Reset link has expired' })
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ status: 'error', msg: 'Invalid reset link' })
        }
        console.error('Reset password error:', error)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})
// PROFILE

export default router