import { Schema, model, Types } from 'mongoose'

// Project interface
interface IProject {
    userId: Types.ObjectId
    name: string
    color?: string
    createdAt: Date
    updatedAt: Date
}

// Project Schema
const projectSchema = new Schema<IProject>({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: String
}, { timestamps: true, collection: 'projects' })

projectSchema.index({ userId: 1, name: 1 })

const Project = model<IProject>('Project', projectSchema)
export default Project