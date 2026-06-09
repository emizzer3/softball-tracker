import '@testing-library/jest-dom'

// Polyfill localStorage for jsdom if not available
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    data: {},
    getItem(key) {
      return this.data[key] || null
    },
    setItem(key, value) {
      this.data[key] = String(value)
    },
    removeItem(key) {
      delete this.data[key]
    },
    clear() {
      this.data = {}
    },
  }
}

// Clear localStorage between tests
beforeEach(() => {
  localStorage.clear()
})
