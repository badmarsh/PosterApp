import { describe, it, expect, vi, beforeEach } from 'vitest'
import { jobQueue } from '@/lib/job-queue'

describe('JobQueue', () => {
  beforeEach(() => {
    // Clear jobs before each test
    // We can do this by cancelling all jobs
    jobQueue.getJobs().forEach(j => jobQueue.cancel(j.id))
  })

  it('enqueues a job and executes it', async () => {
    let executed = false
    const promise = new Promise<void>((resolve) => {
      jobQueue.enqueue('Test Job', async (onProgress, signal) => {
        executed = true
        onProgress(50)
        onProgress(100)
        resolve()
      })
    })

    await promise
    
    // Allow state to settle
    await new Promise(r => setTimeout(r, 0))

    expect(executed).toBe(true)
    const jobs = jobQueue.getJobs()
    expect(jobs.length).toBeGreaterThan(0)
    expect(jobs[0].status).toBe('done')
    expect(jobs[0].progress).toBe(100)
  })

  it('can cancel a running job', async () => {
    let aborted = false
    const promise = new Promise<void>((resolve) => {
      const id = jobQueue.enqueue('Long Job', async (onProgress, signal) => {
        return new Promise<void>((_, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true
            reject(new Error('AbortError'))
          })
        })
      })
      
      setTimeout(() => {
        jobQueue.cancel(id)
        resolve()
      }, 10)
    })

    await promise

    // Allow state to settle
    await new Promise(r => setTimeout(r, 0))
    
    expect(aborted).toBe(true)
    const jobs = jobQueue.getJobs()
    expect(jobs[0].status).toBe('cancelled')
  })

  it('handles job errors correctly', async () => {
    const promise = new Promise<void>((resolve) => {
      jobQueue.enqueue('Failing Job', async () => {
        resolve()
        throw new Error('Something went wrong')
      })
    })

    await promise

    // Allow state to settle
    await new Promise(r => setTimeout(r, 0))

    const jobs = jobQueue.getJobs()
    expect(jobs[0].status).toBe('error')
    expect(jobs[0].error).toBe('Something went wrong')
  })
})
