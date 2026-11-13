import { Router, Request, Response } from 'express'
const router = Router()

import Project from '../models/project'
import Task from '../models/task'
import auth from '../middleware/jwt'


// Create Project
router.post('/create', auth, async (req: any, res: Response) => {
    const { name } = req.body

    if (!name || !name.trim()) {
        return res.status(400).json({ status: 'error', msg: 'Project name is required' })
    }

    try {
        // Prevent duplicate project names for the same user
        const existing = await Project.findOne({
            userId: req.user._id,
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        })

        if (existing) {
            return res.status(400).json({ status: 'error', msg: 'A project with this name already exists' })
        }

        const project = await Project.create({
            userId: req.user._id,
            name: name.trim()
        })

        return res.status(201).json({ status: 'ok', msg: 'success', data: project })
    } catch (err) {
        console.error('Create project error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})

// Update Project
router.post('/update', auth, async (req: any, res: Response) => {
    const { projectId, name } = req.body

    if (!projectId || !name || !name.trim()) {
        return res.status(400).json({ status: 'error', msg: 'All fields are required' })
    }

    try {
        const project = await Project.findOne({ _id: projectId, userId: req.user._id })
        if (!project) {
            return res.status(404).json({ status: 'error', msg: 'Project not found' })
        }

        project.name = name.trim()
        await project.save()

        return res.status(200).json({ status: 'ok', msg: 'success', data: project })
    } catch (err) {
        console.error('Update project error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})

// View All Projects
router.post('/all', auth, async (req: any, res: Response) => {
    try {
        const projects = await Project.find({ userId: req.user._id }).sort({ createdAt: -1 })

        // Attach task counts for each project: e.g '3 tasks', '0 done'
        const projectsWithStats = await Promise.all(
            projects.map(async (p) => {
                const totalTasks = await Task.countDocuments({
                    userId: req.user._id,
                    projectId: p._id,
                    deletedAt: { $exists: false }
                })
                
                const doneTasks = await Task.countDocuments({
                    userId: req.user._id,
                    projectId: p._id,
                    status: 'completed',
                    deletedAt: { $exists: false }
                })
                
                return {
                    _id: p._id,
                    name: p.name,
                    createdAt: p.createdAt,
                    totalTasks,
                    doneTasks,
                    taskLabel: `${totalTasks} tasks`,
                    doneLabel: `${doneTasks} done`
                }
            })
        )

        return res.status(200).json({ 
            status: 'ok',
            msg: 'success',
            count: projectsWithStats.length,
            data: projectsWithStats
        })
    } catch (err) {
        console.error('View all projects error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})

// View specific Projects
router.post('/single', auth, async (req: any, res: Response) => {
    const { projectId } = req.body
    
    if (!projectId) {
        return res.status(400).json({ status: 'error', msg: 'Project ID is required' })
    }
    
    try {
        const project = await Project.findOne({ _id: projectId, userId: req.user._id })

        if (!project) {
            return res.status(404).json({ status: 'error', msg: 'Project not found' })
        }

        // Get all active taskd belonging to this project
        const tasks = await Task.find({
            userId: req.user._id,
            projectId,
            deletedAt: { $exists: false }
        }).sort({ createdAt: -1 })

        return res.status(200).json({ 
            status: 'ok',
            msg: 'success',
            data: {
                project,
                tasksCount: tasks.length,
                tasks
            }
        })
    } catch (err) {
        console.error('View project error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})

// Delete Project
router.post('/delete', auth, async (req: any, res: Response) => {
    const { projectId } = req.body
    
    if (!projectId) {
        return res.status(400).json({ status: 'error', msg: 'Project ID is required' })
    }
    
    try {
        const project = await Project.findOneAndDelete({ _id: projectId, userId: req.user._id })
        if (!project) {
            return res.status(404).json({ status: 'error', msg: 'Project not found' })
        }

        // Get all active taskd belonging to this project
        await Task.updateMany(
            { projectId, userId: req.user._id },
            { $unset: { projectId: 1 } }
        )

        return res.status(200).json({ status: 'ok', msg: 'success' })
    } catch (err) {
        console.error('Delete project error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})

export default router