import { Schema, model, Types } from 'mongoose'

// Schedule Interface
interface ISchedule {
    userId: Types.ObjectId,
    taskId: Types.ObjectId,
    title: string,
    description: string,
    startAt: Date,
    endAt: Date,
    status: 'scheduled' | 'completed' | 'cancelled',
    isFlexible: boolean,
    createdAt: Date,
    updatedAt: Date
}

// Schedule schema
const scheduleSchema = new Schema<ISchedule>({
    userId: { type: Types.ObjectId, ref: 'User ' },
    taskId: { type: Types.ObjectId, ref: 'Task' },
    title: String,
    description: String,
    startAt: Date,
    endAt: Date,
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    isFlexible: { type: Boolean, default: false },
}, { timestamps: true, collection: 'schedule' })


scheduleSchema.index({ userId: 1, startAt: 1 })
scheduleSchema.index({ userId: 1, status: 1, startAt: 1 })

// Export Schedule model
const Schedule = model<ISchedule>('Schedule', scheduleSchema)
export default Schedule