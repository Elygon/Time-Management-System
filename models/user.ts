import { Schema, model } from 'mongoose'

// User interface
interface IUser {
    name: string,
    email: string,
    password: string,
    isVerified: boolean,
    timezone: string,
    preferences: {
        theme: 'light' | 'dark' | 'system',
        timeFormat: '12h' | '24h',
        weekStartsOn: number,
        defaultReminderMins: number
    },
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
}

// User schema
const userSchema = new Schema<IUser>({
    name: String,
    email: String,
    password: String,
    isVerified: { type: Boolean, default: false },
    timezone: String,
    preferences: {
        theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
        timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
        weekStartsOn: { type: Number, enum: [0, 1, 2, 3, 4, 5, 6], default: 1},
        defaultReminderMins: { type: Number, min: 0, max: 10080, default: 10 }
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true, collection: 'users' })

// Create and export User model
const User = model<IUser>('User', userSchema)
export default User