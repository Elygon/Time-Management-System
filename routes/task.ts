import { Router, Request, Response } from 'express'
const router = Router()

import auth from '../middleware/jwt'
import Task from '../models/task'


// Create Task
router.post('/create', auth, async (req: any, res: Response) => {
    const { title, category, startAt, dueAt, reminderMins, description, priority } = req.body

    if (!title || !startAt || !dueAt) {
        return res.status(400).json({ status: 'error', msg: 'Title, startAt and dueAt are required' })
    }

    // Validate category
    const validCategories = ['personal', 'study', 'work']
    if (category && !validCategories.includes(category)) {
        return res.status(400).json({ status: 'error', msg: 'Category must be personal, study or work' })
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({ status: 'error', msg: 'Priority must be low, medium, high or urgent' })
    }

    try {
        // Calculate reminderAt from startAt minus reminderMins
        let reminderAt: Date | undefined
        let reminderEnabled = false

        if (reminderMins !== undefined && reminderMins > 0) {
            const startDate = new Date(startAt)
            reminderAt = new Date(startDate.getTime() - reminderMins * 60 * 1000)
            reminderEnabled = true
        }

        const task = await Task.create({
            userId: req.user._id,
            title,
            category,
            startAt: new Date(startAt),
            dueAt: new Date(dueAt),
            reminderEnabled,
            reminderAt,
            description,
            priority: priority ||'medium'
        })

        return res.status(201).json({ status: 'ok', msg: 'success', data: {
            _id: task._id,
            title: task.title,
            category: task.category,
            startAt: task.startAt,
            dueAt: task.dueAt,
            priority: task.priority,
            reminderEnabled: task.reminderEnabled,
            reminderAt: task.reminderAt,
            status: task.status,
            createdAt: task.createdAt
        }})
    } catch (err) {
        console.error('Create task error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// Update Task
router.post('/update', auth, async (req: any, res: Response) => {
    const { taskId, title, category, startAt, dueAt, reminderMins, reminderEnabled, description, priority, status } = req.body

    // Validate enums if provided
    const validCategories = ['personal', 'study', 'work']
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    const validStatus = ['pending', 'in_progress', 'completed', 'cancelled']

    if (category && !validCategories.includes(category)) {
        return res.status(400).json({ status: 'error', msg: 'Invalid Category' })
    }
    if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({ status: 'error', msg: 'Invalid Priority' })
    }
    if (status && !validStatus.includes(status)) {
        return res.status(400).json({ status: 'error', msg: 'Invalid Status' })
    }

    try {
        const task = await Task.findOne({ _id: taskId, userId: req.user._id }) 
        if (!task) {
            return res.status(404).json({ status: 'error', msg: 'Task not found' })
        }
        
        // Only update fileds that were actually sent
        if (title) task.title = title
        if (description) task.description = description
        if (category) task.category = category
        if (priority) task.priority = priority
        if (startAt) task.startAt = startAt
        if (dueAt) task.dueAt = dueAt

        // Handle reminder update
        if (reminderMins !== undefined && task.startAt) {
            task.reminderEnabled = true
            task.reminderAt = new Date(new Date(task.startAt).getTime() - reminderMins * 60 * 1000)
        }
        if (reminderEnabled === false) {
            task.reminderEnabled = false
        }

        // If task is marked completed, record completedAt
        if (status === 'completed') {
            task.completedAt = new Date()
        }
        if (status) task.status = status

        await task.save()

        return res.status(200).json({ status: 'ok', msg: 'success', data: task })
    } catch (err) {
        console.error('Update task error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// Get Reminders (Dynamic Overdue / Upcoming calculation)
router.post('/reminders', auth, async (req: any, res: Response) => {
    try {
        const now = new Date()

        // 1. Fetch active tasks with reminder enabled (exclude completed & cancelled)
        const tasks = await Task.find({
            userId: req.user._id,
            deletedAt: { $exists: false },
            reminderEnabled: true,
            status: { $nin: ['completed', 'cancelled'] }
        }).sort({ dueAt: 1 }) // Earliest due dates first (puts overdue at the top)

        // 2. Map and compute dynamic badge and reminder time difference
        const reminders = tasks.map((task) => {
            const isOverdue = task.dueAt && new Date(task.dueAt) < now

            // Calculate reminder offset in minutes (e.g., 30 for "30 min before")
            let reminderMinutesBefore = 0
            if (task.startAt && task.reminderAt) {
                const diffMs = new Date(task.startAt).getTime() - new Date(task.reminderAt).getTime()
                reminderMinutesBefore = Math.max(0, Math.round(diffMs / (60 * 1000)))
            }

            return {
                _id: task._id,
                title: task.title,
                category: task.category,
                priority: task.priority,
                status: task.status, // 'pending' | 'in_progress'
                startAt: task.startAt,
                dueAt: task.dueAt,
                reminderAt: task.reminderAt,
                reminderMinutesBefore, // e.g. 30 -> "30 min before"
                badge: isOverdue ? 'Overdue' : 'Upcoming' // dynamically computed!
            }
        })

        const overdueCount = reminders.filter(r => r.badge === 'Overdue').length
        const upcomingCount = reminders.filter(r => r.badge === 'Upcoming').length

        return res.status(200).json({
            status: 'ok',
            msg: 'success',
            count: reminders.length,
            overdueCount,
            upcomingCount,
            data: reminders
        })

    } catch (err) {
        console.error('Reminders error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// View All Tasks (By the logged-in user)
router.post('/all', auth, async (req: any, res: Response) => {
    try {
        const tasks = await Task.find({
            userId: req.user._id,
            deletedAt: { $exists: false }
        }).sort({ createdAt: -1 })

        return res.status(200).json({ status: 'ok', msg: 'success', count: tasks.length, data: tasks })
    } catch (err) {
        console.error('View all tasks error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error'})
    }
})


// View Specific Task
router.post('/single', auth, async (req: any, res: Response) => {
    const { taskId } = req.body

    if (!taskId){
        return res.status(400).json({ status: 'error', msg: 'Task ID is required' })
    }

    try {
        const task = await Task.findOne({
            _id: taskId,
            userId: req.user._id
        })

        if (!task) {
            return res.status(404).json({ status: 'error', msg: 'Task not found' })
        }

        return res.status(200).json({ status: 'ok', msg: 'success', data: task })
    } catch (err) {
        console.error('View task error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error'})
    }
})


// Delete Task
router.post('/delete', auth, async (req: any, res: Response) => {
    const { taskId } = req.body

    try {
        const task = await Task.findOneAndDelete({ _id: taskId, userId: req.user._id })

        if (!task) {
            return res.status(404).json({ status: 'error', msg: 'Task not found' })
        }

        return res.status(200).json({ status: 'ok', msg: 'success' })
    } catch (err) {
        console.error('Delete task error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error'})
    }
})


/*
// ==========================================
// TRASH & RESTORE ENDPOINTS (FOR FUTURE USE)
// ==========================================

// View Deleted Tasks (Trash)
router.post('/trash', auth, async (req: any, res: Response) => {
    try {
        const tasks = await Task.find({
            userId: req.user._id,
            deletedAt: { $exists: true }
        }).sort({ deletedAt: -1 })

        return res.status(200).json({ status: 'ok', msg: 'success', data: tasks })
    } catch (err) {
        console.error('View trash error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// Restore Deleted Task
router.post('/restore', auth, async (req: any, res: Response) => {
    const { taskId } = req.body

    if (!taskId) {
        return res.status(400).json({ status: 'error', msg: 'Task ID is required' })
    }

    try {
        const task = await Task.findOne({
            _id: taskId,
            userId: req.user._id,
            deletedAt: { $exists: true }
        })

        if (!task) {
            return res.status(404).json({ status: 'error', msg: 'Deleted task not found' })
        }

        task.deletedAt = undefined as any
        await task.save()

        return res.status(200).json({ status: 'ok', msg: 'Task restored successfully', data: task })
    } catch (err) {
        console.error('Restore task error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// Permanently Delete Task (Empty / Purge from trash)
router.post('/permanent-delete', auth, async (req: any, res: Response) => {
    const { taskId } = req.body

    if (!taskId) {
        return res.status(400).json({ status: 'error', msg: 'Task ID is required' })
    }

    try {
        const task = await Task.findOneAndDelete({
            _id: taskId,
            userId: req.user._id,
            deletedAt: { $exists: true }
        })

        if (!task) {
            return res.status(404).json({ status: 'error', msg: 'Deleted task not found' })
        }

        return res.status(200).json({ status: 'ok', msg: 'Task permanently deleted' })
    } catch (err) {
        console.error('Permanent delete error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})
*/

export default router