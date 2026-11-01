import { Schema, model, Types } from 'mongoose'

// Task Activity interface
interface IActivity{
    userId: Types.ObjectId,
    taskId: Types.ObjectId,
    action: 'created' | 'updated' | 'priority_changed' | 'deadline_changed' | 'completed' | 'reopened'
    | 'cancelled' | 'deleted' ,
    changes: any,
    createdAt: Date
}

// Task Activity Schema
const activitySchema = new Schema<IActivity>({
    userId: { type: Schema.Types.ObjectId },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    action: { 
        type: String, 
        enum: [
            'created', 'updated', 'priority_changed', 'deadline_changed', 'completed', 
            'reopened', 'cancelled', 'deleted'
        ]
    },
    changes: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true, collection: 'task_activities' })

activitySchema.index({ userId: 1, taskId: 1, createdAt: -1 })

// Export Activity model
const TaskActivity = model<IActivity>('TaskActivity', activitySchema)
export default TaskActivity