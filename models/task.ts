import { Schema, model, Types } from 'mongoose'

// Task interface
interface ITask {
    userId: Types.ObjectId,
    title: string,
    description: string,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
    priority: 'low' | 'medium' | 'high' | 'urgent',
    duration: number,
    dueAt: Date,
    startAt: Date,
    completedAt: Date,
    reminderEnabled: boolean,
    reminderAt: Date,
    category: string,
    position: number,
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date
}

// Task schema
const taskSchema = new Schema<ITask>({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    title: String,
    description: String,
    status: { 
        type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending'
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    duration: { type: Number, min: 1, default: null },
    dueAt: Date, // Task deadline
    startAt: Date, // Starting time of the task
    completedAt: Date, // When the task was completed
    reminderEnabled: { type: Boolean, default: false }, // when the task reminder is active
    reminderAt: Date, // Schedule reminder time
    category: { type: String, trim: true, maxlength: 100 }, // Task Category
    position: { type: Number, default: 0 }, //manual ordering
    deletedAt: Date
}, { timestamps: true, collection: 'tasks' })


taskSchema.index({ userId: 1, status: 1, dueAt: 1})
taskSchema.index({ userId: 1, createdAt: -1 })

// Export Task model
const Task = model<ITask>('Task', taskSchema)
export default Task