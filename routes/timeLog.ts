import { Router, Request, Response } from 'express'
const router = Router()

import auth from '../middleware/jwt'
import TimeLog from '../models/timeLog'
import Task from '../models/task'


// TODAY VIEW ENDPOINT
router.post('/today', auth, async (req: any, res: Response) => {
    try {
        // 1. Calculate start and end of "Today" in UTC/local
        const now = new Date()
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

        // 2. Fetch all tasks scheduled for today (or due today)
        const tasks = await Task.find({
            userId: req.user._id,
            deletedAt: { $exists: false },
            $or: [
                { startAt: { $gte: startOfDay, $lte: endOfDay } },
                { dueAt: { $gte: startOfDay, $lte: endOfDay } }
            ]
        }).sort({ startAt: 1 })

        // 3. Determine "Next up" task (earliest pending/in_progress task starting now or in the future today)
        const nextUp = tasks.find(t => 
            t.status !== 'completed' && 
            t.status !== 'cancelled'
        ) || null

        // 4. Calculate total time worked today from TimeLog (in minutes)
        const logs = await TimeLog.find({
            userId: req.user._id,
            startAt: { $gte: startOfDay, $lte: endOfDay },
            status: 'completed'
        })

        const totalMinutesWorked = logs.reduce((acc, log) => acc + (log.duration || 0), 0)
        const hours = Math.floor(totalMinutesWorked / 60)
        const mins = totalMinutesWorked % 60
        const timeWorkedFormatted = `${hours} h ${mins} min` // e.g. "2 h 15 min"

        return res.status(200).json({
            status: 'ok',
            msg: 'success',
            data: {
                timeWorkedToday: {
                    totalMinutes: totalMinutesWorked,
                    formatted: timeWorkedFormatted
                },
                nextUp,
                tasksCount: tasks.length,
                tasks
            }
        })

    } catch (err) {
        console.error('Today view error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})

export default router