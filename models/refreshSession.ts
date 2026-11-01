import { Schema, model, Types } from 'mongoose'

// Refresh session interface
interface IRefresh{
    userId: Types.ObjectId,
    refreshToken: string,
    expiresAt: Date,
    revokedAt: Date,
    createdAt: Date,
    lastUsedAt: Date,
    userDevice: string,
    ipAddress: string
}

// Refreshtoken Schema
const refreshSchema = new Schema<IRefresh>({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    lastUsedAt: { type: Date, default: Date.now },
    userDevice: String,
    ipAddress: String
}, { 
    timestamps: true, 
    //collection: 'refresh_session'
})


refreshSchema.index({ userId: 1, revokedAt: 1})


// Export Refresh session model
const RefreshSession = model<IRefresh>('RefreshSession', refreshSchema)
export default RefreshSession