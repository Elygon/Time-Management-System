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


// START TIMER
router.post('/start', auth, async (req: any, res: Response) => {
    const { taskId, note } = req.body

    try {
        // 1. Check if user already has an active running timer
        const activeTimer = await TimeLog.findOne({
            userId: req.user._id,
            status: 'running'
        })

        if (activeTimer) {
            return res.status(400).json({
                status: 'error',
                msg: 'You already have a running timer. Please stop it first.',
                data: activeTimer
            })
        }

        // 2. Optionally verify taskId belongs to user if provided
        if (taskId) {
            const task = await Task.findOne({ _id: taskId, userId: req.user._id })
            if (!task) {
                return res.status(404).json({ status: 'error', msg: 'Task not found' })
            }
            // If task was pending, mark it in_progress
            if (task.status === 'pending') {
                task.status = 'in_progress'
                await task.save()
            }
        }

        // 3. Create the running time log
        const timeLog = await TimeLog.create({
            userId: req.user._id,
            taskId: taskId || null,
            startAt: new Date(),
            status: 'running',
            note: note || ''
        })

        return res.status(201).json({ status: 'ok', msg: 'success', data: timeLog })

    } catch (err) {
        console.error('Start timer error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// STOP TIMER
router.post('/stop', auth, async (req: any, res: Response) => {
    const { timeLogId, note } = req.body

    try {
        // 1. Find the running timer (either by timeLogId or the user's current running timer)
        const filter: any = { userId: req.user._id, status: 'running' }
        if (timeLogId) filter._id = timeLogId

        const runningTimer = await TimeLog.findOne(filter)
        if (!runningTimer) {
            return res.status(404).json({
                status: 'error',
                msg: 'No running timer found'
            })
        }

        // 2. Calculate endAt and duration in minutes
        const endAt = new Date()
        const diffMs = endAt.getTime() - new Date(runningTimer.startAt).getTime()
        const durationMinutes = Math.max(1, Math.round(diffMs / (60 * 1000))) // minimum 1 minute

        // 3. Update the record to completed
        runningTimer.endAt = endAt
        runningTimer.duration = durationMinutes
        runningTimer.status = 'completed'
        if (note) runningTimer.note = note

        await runningTimer.save()

        return res.status(200).json({
            status: 'ok',
            msg: 'success',
            data: {
                _id: runningTimer._id,
                taskId: runningTimer.taskId,
                startAt: runningTimer.startAt,
                endAt: runningTimer.endAt,
                durationMinutes,
                formatted: `${Math.floor(durationMinutes / 60)} h ${durationMinutes % 60} min`
            }
        })

    } catch (err) {
        console.error('Stop timer error:', err)
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})


// GET CURRENT RUNNING TIMER
router.post('/current', auth, async (req: any, res: Response) => {
    try {
        const currentTimer = await TimeLog.findOne({
            userId: req.user._id,
            status: 'running'
        }).populate('taskId', 'title category priority')

        return res.status(200).json({
            status: 'ok',
            msg: 'success',
            data: currentTimer // returns null if no timer is running
        })
    } catch (err) {
        return res.status(500).json({ status: 'error', msg: 'Internal server error' })
    }
})

export default router