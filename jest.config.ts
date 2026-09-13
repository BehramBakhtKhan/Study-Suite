import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  // Translates "@/*" path aliases correctly
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Runs database cleanup hooks before each integration test
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)

