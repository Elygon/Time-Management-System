import express, { Request, Response } from 'express'
const app = express()

import dotenv from 'dotenv'
dotenv.config()

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

//Import route files
import auth from './routes/auth'
app.use('/auth', auth)

import task from './routes/task'
app.use('/task', task)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    connectDB()
})