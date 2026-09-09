// jest.config.ts
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './', // Tells Next.js where your app is to look for configs
})

const config = {
  testEnvironment: 'node',
  // 🚀 FIX: This tells Jest to translate "@/*" into your "src/*" folder paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
