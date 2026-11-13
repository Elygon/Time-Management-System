import express, { Request, Response } from 'express'
const app = express()

import dotenv from 'dotenv'
dotenv.config()

import cors from 'cors'
// Enable CORS
app.use(cors({
    origin: '*', // allow all origins
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'From']
}))


import mongoose from 'mongoose'
const MONGODB_URI = process.env.DATABASE_URL || '' 

const PORT = process.env.PORT

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI)
        console.log('Successfully connected to MongoDB!')
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error)
        process.exit(1) // Kill the server - no point running without a database
    }
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

//Import route files
import auth from './routes/auth'
app.use('/auth', auth)

import task from './routes/task'
app.use('/task', task)

import timeLog from './routes/timeLog'
app.use('/timeLog', timeLog)

import project from './routes/project'
app.use('/project', project)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    connectDB()
})