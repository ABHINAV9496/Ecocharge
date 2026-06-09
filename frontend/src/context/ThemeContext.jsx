/*
  Theme Context
  -------------
  Manages dark mode / light mode switching.

  What it does:
  - Remembers the user's preference in localStorage
  - Checks the system preference on first visit
  - Adds/removes the "dark" class on the HTML element
  - Provides a toggle function to switch themes

  How to use:
    import { useTheme } from '../context/ThemeContext'
    function MyComponent() {
      var { dark, toggle } = useTheme()
      return <button onClick={toggle}>{dark ? 'Light' : 'Dark'}</button>
    }
*/

import { createContext, useContext, useState, useEffect } from 'react'

var ThemeContext = createContext(null)

export function ThemeProvider(props) {
  var children = props.children

  // Initialize theme based on saved preference or system setting
  var [dark, setDark] = useState(function () {
    // First, check if user has saved a preference before
    var savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      return savedTheme === 'dark'
    }

    // If no saved preference, check if the user's system uses dark mode
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
    return prefersDark.matches
  })

  // Whenever 'dark' state changes, update the HTML class and save preference
  useEffect(function () {
    var htmlElement = document.documentElement

    if (dark) {
      htmlElement.classList.add('dark')
    } else {
      htmlElement.classList.remove('dark')
    }

    // Save user's preference so it persists after page reload
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])  // This runs every time 'dark' changes

  // Switch between dark and light mode
  function toggleTheme() {
    setDark(function (currentValue) {
      return !currentValue
    })
  }

  return (
    <ThemeContext.Provider value={{ dark: dark, toggle: toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  var context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside of ThemeProvider')
  }
  return context
}
