import { Schema, model, Types } from 'mongoose'

// Timelog interface
interface ITimeLog {
    userId: Types.ObjectId,
    taskId: Types.ObjectId,
    scheduleId: Types.ObjectId,
    startAt: Date,
    endAt: Date,
    duration: number,
    status: 'running' | 'completed',
    note: String,
    createdAt: Date,
    updatedAt: Date
}

// Timelog Schema
const timeLogSchema = new Schema<ITimeLog>({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule' },
    startAt: Date,
    endAt: Date,
    duration: { type: Number, min: 0, default: null },
    status: { type: String, enum: ['running', 'completed'], default: 'running' },
    note: String
}, { timestamps: true, collection: 'timeLog' })

timeLogSchema.index({ userId: 1, startAt: -1 })
timeLogSchema.index({ userId: 1, taskId: 1,startAt: -1 })

// Allow only one running timer per user
timeLogSchema.index(
    { userId: 1},
    { unique: true, partialFilterExpression: { status: 'running' }}
)

// Export TimeLog model
const TimeLog = model<ITimeLog>('TimeLog', timeLogSchema)
export default TimeLog