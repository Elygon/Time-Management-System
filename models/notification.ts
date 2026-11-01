import { Schema, model, Types } from 'mongoose'

// Notification interface
interface INotify {
    userId: Types.ObjectId,
    taskId: Types.ObjectId,
    scheduleId: Types.ObjectId,
    type: 'task_reminder' | 'deadline_reminder' | 'overdue_task' | 'schedule_reminder' | 'system',
    title: string,
    message: string,
    channel: 'in_app' | 'email' | 'push',
    scheduledFor: Date,
    deliveredAt: Date,
    readAt: Date,
    status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled',
    attempts: number,
    lastAttempt: Date,
    failReason: string,
    createdAt: Date,
    updatedAt: Date
}

// Notification Schema
const notifySchema = new Schema<INotify>({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule' },
    type: { 
        type: String, 
        enum: ['task_reminder', 'deadline_reminder', 'overdue_task', 'schedule_reminder', 'system']
    },
    title: String,
    message: String,
    channel: { type: String, enum: ['in_app', 'email', 'push'], default: 'in_app' },
    scheduledFor: Date,
    deliveredAt: Date,
    readAt: Date,
    status: { 
        type: String, 
        enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'], default: 'pending'
    },
    attempts: { type: Number, default: 0, min: 0 },
    lastAttempt: Date,
    failReason: String,
}, { timestamps: true, collection: 'notification' })


notifySchema.index({ userId: 1, readAt: 1 })
notifySchema.index({ userId: 1, readAt: 1 })
notifySchema.index({ status: 1, scheduledFor: 1 })


// Export Notification model
const Notification = model<INotify>('Notification', notifySchema)
export default Notification