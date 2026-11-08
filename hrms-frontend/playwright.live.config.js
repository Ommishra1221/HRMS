import { defineConfig } from '@playwright/test'
import config from './playwright.config.js'

export default defineConfig({ ...config, testMatch: 'probation-live.spec.js', fullyParallel: false, workers: 1, timeout: 120000 })
